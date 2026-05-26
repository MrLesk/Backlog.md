import { type FSWatcher, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import type { FileSystem, SaveTaskOptions } from "../file-system/operations.ts";
import { parseDecision, parseDocument, parseTask } from "../markdown/parser.ts";
import type { Decision, Document, Task, TaskListFilter } from "../types/index.ts";
import { normalizeDocumentRelativePath } from "../utils/document-path.ts";
import { normalizeTaskId, normalizeTaskIdentity, taskIdsEqual } from "../utils/task-path.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";
import type { TaskHookDispatcher } from "./task-hook-dispatcher.ts";
import { hashTaskContent, type TaskWriteCoordinator } from "./task-write-coordinator.ts";

/**
 * Optional collaborators injected by `Core` so the watcher and the saveTask
 * wrapper can participate in the onStatusChange hook flow. Without these the
 * store keeps its legacy behavior: a pure read-through cache with no hook
 * dispatch.
 */
export interface ContentStoreHooks {
	dispatcher?: TaskHookDispatcher;
	coordinator?: TaskWriteCoordinator;
}

interface ContentSnapshot {
	tasks: Task[];
	documents: Document[];
	decisions: Decision[];
}

type ContentStoreEventType = "ready" | "tasks" | "documents" | "decisions";

export type ContentStoreEvent =
	| { type: "ready"; snapshot: ContentSnapshot; version: number }
	| { type: "tasks"; tasks: Task[]; snapshot: ContentSnapshot; version: number }
	| { type: "documents"; documents: Document[]; snapshot: ContentSnapshot; version: number }
	| { type: "decisions"; decisions: Decision[]; snapshot: ContentSnapshot; version: number };

export type ContentStoreListener = (event: ContentStoreEvent) => void;

interface WatchHandle {
	stop(): void;
}

export class ContentStore {
	private initialized = false;
	private initializing: Promise<void> | null = null;
	private version = 0;

	private readonly tasks = new Map<string, Task>();
	private readonly documents = new Map<string, Document>();
	private readonly decisions = new Map<string, Decision>();

	private cachedTasks: Task[] = [];
	private cachedDocuments: Document[] = [];
	private cachedDecisions: Decision[] = [];

	private readonly listeners = new Set<ContentStoreListener>();
	private readonly watchers: WatchHandle[] = [];
	private restoreFilesystemPatch?: () => void;
	private chainTail: Promise<void> = Promise.resolve();
	private watchersInitialized = false;
	private configWatcherActive = false;

	private attachWatcherErrorHandler(watcher: FSWatcher, context: string): void {
		watcher.on("error", (error) => {
			if (process.env.DEBUG) {
				console.warn(`Watcher error (${context})`, error);
			}
		});
	}

	constructor(
		private readonly filesystem: FileSystem,
		private readonly taskLoader?: () => Promise<Task[]>,
		private readonly enableWatchers = false,
		private readonly hooks?: ContentStoreHooks,
	) {
		this.patchFilesystem();
	}

	subscribe(listener: ContentStoreListener): () => void {
		this.listeners.add(listener);

		if (this.initialized) {
			listener({ type: "ready", snapshot: this.getSnapshot(), version: this.version });
		} else {
			void this.ensureInitialized();
		}

		return () => {
			this.listeners.delete(listener);
		};
	}

	async ensureInitialized(): Promise<ContentSnapshot> {
		if (this.initialized) {
			return this.getSnapshot();
		}

		if (!this.initializing) {
			this.initializing = this.loadInitialData().catch((error) => {
				this.initializing = null;
				throw error;
			});
		}

		await this.initializing;
		return this.getSnapshot();
	}

	getTasks(filter?: TaskListFilter): Task[] {
		if (!this.initialized) {
			throw new Error("ContentStore not initialized. Call ensureInitialized() first.");
		}

		let tasks = this.cachedTasks;
		if (filter?.status) {
			const statusLower = filter.status.toLowerCase();
			tasks = tasks.filter((task) => task.status.toLowerCase() === statusLower);
		}
		if (filter?.assignee) {
			const assignee = filter.assignee;
			tasks = tasks.filter((task) => task.assignee.includes(assignee));
		}
		if (filter?.priority) {
			const priority = filter.priority.toLowerCase();
			tasks = tasks.filter((task) => (task.priority ?? "").toLowerCase() === priority);
		}
		if (filter?.parentTaskId) {
			const parentFilter = filter.parentTaskId;
			tasks = tasks.filter((task) => task.parentTaskId && taskIdsEqual(parentFilter, task.parentTaskId));
		}

		return tasks.slice();
	}

	upsertTask(task: Task): void {
		if (!this.initialized) {
			return;
		}
		this.tasks.set(task.id, task);
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
		this.notify("tasks");
		// Hook dispatch is owned by the file-watcher path (with content-hash
		// suppression) and by Core's explicit dispatchInProcess for paths
		// that bypass the wrapped saveTask (e.g. editTaskInTui). Routing
		// upsertTask through the dispatcher too would multi-fire on every
		// API read that refreshes the cache from disk.
	}

	getDocuments(): Document[] {
		if (!this.initialized) {
			throw new Error("ContentStore not initialized. Call ensureInitialized() first.");
		}
		return this.cachedDocuments.slice();
	}

	getDecisions(): Decision[] {
		if (!this.initialized) {
			throw new Error("ContentStore not initialized. Call ensureInitialized() first.");
		}
		return this.cachedDecisions.slice();
	}

	getSnapshot(): ContentSnapshot {
		return {
			tasks: this.cachedTasks.slice(),
			documents: this.cachedDocuments.slice(),
			decisions: this.cachedDecisions.slice(),
		};
	}

	dispose(): void {
		if (this.restoreFilesystemPatch) {
			this.restoreFilesystemPatch();
			this.restoreFilesystemPatch = undefined;
		}
		for (const watcher of this.watchers) {
			try {
				watcher.stop();
			} catch {
				// Ignore watcher shutdown errors
			}
		}
		this.watchers.length = 0;
		this.watchersInitialized = false;
	}

	private emit(event: ContentStoreEvent): void {
		for (const listener of [...this.listeners]) {
			listener(event);
		}
	}

	private notify(type: ContentStoreEventType): void {
		this.version += 1;
		const snapshot = this.getSnapshot();

		if (type === "tasks") {
			this.emit({ type, tasks: snapshot.tasks, snapshot, version: this.version });
			return;
		}

		if (type === "documents") {
			this.emit({ type, documents: snapshot.documents, snapshot, version: this.version });
			return;
		}

		if (type === "decisions") {
			this.emit({ type, decisions: snapshot.decisions, snapshot, version: this.version });
			return;
		}

		this.emit({ type: "ready", snapshot, version: this.version });
	}

	private async loadInitialData(): Promise<void> {
		await this.filesystem.ensureBacklogStructure();

		// Use custom task loader if provided (e.g., loadTasks for cross-branch support)
		// Otherwise fall back to filesystem-only loading
		const [tasks, documents, decisions] = await Promise.all([
			this.loadTasksWithLoader(),
			this.filesystem.listDocuments(),
			this.filesystem.listDecisions(),
		]);

		this.replaceTasks(tasks);
		this.replaceDocuments(documents);
		this.replaceDecisions(decisions);

		// Seed the dispatcher's previous-status snapshot from the initial
		// load. Without this seeding, the first watcher event after startup
		// would treat the current on-disk status as a "new" task (no
		// transition) and miss the very first hand-edit that happens before
		// any other reload populates the snapshot.
		this.hooks?.dispatcher?.seedSnapshot(tasks);

		this.initialized = true;
		if (this.enableWatchers) {
			await this.setupWatchers();
		}
		this.notify("ready");
	}

	private async setupWatchers(): Promise<void> {
		if (this.watchersInitialized) return;
		this.watchersInitialized = true;

		try {
			this.watchers.push(this.createTaskWatcher());
		} catch (error) {
			if (process.env.DEBUG) {
				console.error("Failed to initialize task watcher", error);
			}
		}

		try {
			this.watchers.push(this.createDecisionWatcher());
		} catch (error) {
			if (process.env.DEBUG) {
				console.error("Failed to initialize decision watcher", error);
			}
		}

		try {
			const docWatcher = await this.createDocumentWatcher();
			this.watchers.push(docWatcher);
		} catch (error) {
			if (process.env.DEBUG) {
				console.error("Failed to initialize document watcher", error);
			}
		}

		try {
			const configWatcher = this.createConfigWatcher();
			if (configWatcher) {
				this.watchers.push(configWatcher);
				this.configWatcherActive = true;
			}
		} catch (error) {
			if (process.env.DEBUG) {
				console.error("Failed to initialize config watcher", error);
			}
		}
	}

	/**
	 * Retry setting up the config watcher after initialization.
	 * Called when the config file is created after the server started.
	 */
	ensureConfigWatcher(): void {
		if (this.configWatcherActive) {
			return;
		}
		try {
			const configWatcher = this.createConfigWatcher();
			if (configWatcher) {
				this.watchers.push(configWatcher);
				this.configWatcherActive = true;
			}
		} catch (error) {
			if (process.env.DEBUG) {
				console.error("Failed to setup config watcher after init", error);
			}
		}
	}

	private createConfigWatcher(): WatchHandle | null {
		const configPath = this.filesystem.configFilePath;
		try {
			const watcher: FSWatcher = watch(configPath, (eventType) => {
				if (eventType !== "change" && eventType !== "rename") {
					return;
				}
				this.enqueue(async () => {
					this.filesystem.invalidateConfigCache();
					this.notify("tasks");
				});
			});
			this.attachWatcherErrorHandler(watcher, "config");

			return {
				stop() {
					watcher.close();
				},
			};
		} catch (error) {
			if (process.env.DEBUG) {
				console.error("Failed to watch config file", error);
			}
			return null;
		}
	}

	private createTaskWatcher(): WatchHandle {
		const tasksDir = this.filesystem.tasksDir;
		const watcher: FSWatcher = watch(tasksDir, { recursive: false }, (eventType, filename) => {
			const file = this.normalizeFilename(filename);
			// Accept any prefix pattern (task-, jira-, etc.) followed by ID and ending in .md
			if (!file || !/^[a-zA-Z]+-/.test(file) || !file.endsWith(".md")) {
				this.enqueue(async () => {
					await this.refreshTasksFromDisk();
				});
				return;
			}

			this.enqueue(async () => {
				const [taskId] = file.split(" ");
				if (!taskId) return;
				const normalizedTaskId = normalizeTaskId(taskId);

				const fullPath = join(tasksDir, file);
				const exists = await Bun.file(fullPath).exists();

				if (!exists) {
					if (this.tasks.delete(normalizedTaskId)) {
						this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
						this.notify("tasks");
						// Drop the snapshot entry so a future re-creation with
						// the same id isn't treated as a status transition
						// from the long-dead previous value.
						this.hooks?.dispatcher?.forgetTask(normalizedTaskId);
					}
					return;
				}

				if (eventType === "rename" && exists) {
					await this.refreshTasksFromDisk();
					return;
				}

				const previous = this.tasks.get(normalizedTaskId);
				const result = await this.retryRead(
					async () => {
						const stillExists = await Bun.file(fullPath).exists();
						if (!stillExists) {
							return null;
						}
						const content = await Bun.file(fullPath).text();
						return { task: normalizeTaskIdentity(parseTask(content)), content };
					},
					(value) => {
						if (!value) {
							return false;
						}
						if (!taskIdsEqual(value.task.id, normalizedTaskId)) {
							return false;
						}
						if (!previous) {
							return true;
						}
						return this.hasTaskChanged(previous, value.task);
					},
				);
				if (!result) {
					await this.refreshTasksFromDisk(normalizedTaskId, previous);
					return;
				}

				const { task, content } = result;
				this.tasks.set(task.id, task);
				this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
				this.notify("tasks");
				// Decide suppression deterministically: if the bytes we just
				// read match a hash recorded by an in-process write, this
				// event is the watcher observing our own write — suppress.
				// Otherwise treat as a hand edit.
				const dispatcher = this.hooks?.dispatcher;
				if (dispatcher) {
					try {
						const hash = await hashTaskContent(content);
						const isInProcess = this.hooks?.coordinator?.consumeMatchingWrite(task.id, hash) ?? false;
						void dispatcher.onTaskWrite(task, { suppress: isInProcess });
					} catch {
						// Hashing should never fail in practice; if it does,
						// fire as a hand edit to avoid silent regressions.
						void dispatcher.onTaskWrite(task);
					}
				}
			});
		});
		this.attachWatcherErrorHandler(watcher, "tasks");

		return {
			stop() {
				watcher.close();
			},
		};
	}

	private createDecisionWatcher(): WatchHandle {
		const decisionsDir = this.filesystem.decisionsDir;
		const watcher: FSWatcher = watch(decisionsDir, { recursive: false }, (eventType, filename) => {
			const file = this.normalizeFilename(filename);
			if (!file?.startsWith("decision-") || !file.endsWith(".md")) {
				this.enqueue(async () => {
					await this.refreshDecisionsFromDisk();
				});
				return;
			}

			this.enqueue(async () => {
				const [idPart] = file.split(" - ");
				if (!idPart) return;

				const fullPath = join(decisionsDir, file);
				const exists = await Bun.file(fullPath).exists();

				if (!exists) {
					if (this.decisions.delete(idPart)) {
						this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
						this.notify("decisions");
					}
					return;
				}

				if (eventType === "rename" && exists) {
					await this.refreshDecisionsFromDisk();
					return;
				}

				const previous = this.decisions.get(idPart);
				const decision = await this.retryRead(
					async () => {
						try {
							const content = await Bun.file(fullPath).text();
							return parseDecision(content);
						} catch {
							return null;
						}
					},
					(result) => {
						if (!result) {
							return false;
						}
						if (result.id !== idPart) {
							return false;
						}
						if (!previous) {
							return true;
						}
						return this.hasDecisionChanged(previous, result);
					},
				);
				if (!decision) {
					await this.refreshDecisionsFromDisk(idPart, previous);
					return;
				}
				this.decisions.set(decision.id, decision);
				this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
				this.notify("decisions");
			});
		});
		this.attachWatcherErrorHandler(watcher, "decisions");

		return {
			stop() {
				watcher.close();
			},
		};
	}

	private async createDocumentWatcher(): Promise<WatchHandle> {
		const docsDir = this.filesystem.docsDir;
		return this.createDirectoryWatcher(docsDir, async (eventType, absolutePath, relativePath) => {
			const base = basename(absolutePath);
			if (!base.endsWith(".md")) {
				if (relativePath === null) {
					await this.refreshDocumentsFromDisk();
				}
				return;
			}

			if (!base.startsWith("doc-")) {
				await this.refreshDocumentsFromDisk();
				return;
			}

			const [idPart] = base.split(" - ");
			if (!idPart) {
				await this.refreshDocumentsFromDisk();
				return;
			}

			const exists = await Bun.file(absolutePath).exists();

			if (!exists) {
				if (this.documents.delete(idPart)) {
					this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
					this.notify("documents");
				}
				return;
			}

			if (eventType === "rename" && exists) {
				await this.refreshDocumentsFromDisk();
				return;
			}

			const previous = this.documents.get(idPart);
			const document = await this.retryRead(
				async () => {
					try {
						const content = await Bun.file(absolutePath).text();
						const documentPath = normalizeDocumentRelativePath(relativePath ?? relative(docsDir, absolutePath));
						return { ...parseDocument(content), path: documentPath };
					} catch {
						return null;
					}
				},
				(result) => {
					if (!result) {
						return false;
					}
					if (result.id !== idPart) {
						return false;
					}
					if (!previous) {
						return true;
					}
					return this.hasDocumentChanged(previous, result);
				},
			);
			if (!document) {
				await this.refreshDocumentsFromDisk(idPart, previous);
				return;
			}

			this.documents.set(document.id, document);
			this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
			this.notify("documents");
		});
	}

	private normalizeFilename(value: string | Buffer | null | undefined): string | null {
		if (typeof value === "string") {
			return value;
		}
		if (value instanceof Buffer) {
			return value.toString();
		}
		return null;
	}

	private async createDirectoryWatcher(
		rootDir: string,
		handler: (eventType: string, absolutePath: string, relativePath: string | null) => Promise<void> | void,
	): Promise<WatchHandle> {
		try {
			const watcher = watch(rootDir, { recursive: true }, (eventType, filename) => {
				const relativePath = this.normalizeFilename(filename);
				const absolutePath = relativePath ? join(rootDir, relativePath) : rootDir;

				this.enqueue(async () => {
					await handler(eventType, absolutePath, relativePath);
				});
			});
			this.attachWatcherErrorHandler(watcher, `dir:${rootDir}`);

			return {
				stop() {
					watcher.close();
				},
			};
		} catch (error) {
			if (this.isRecursiveUnsupported(error)) {
				return this.createManualRecursiveWatcher(rootDir, handler);
			}
			throw error;
		}
	}

	private isRecursiveUnsupported(error: unknown): boolean {
		if (!error || typeof error !== "object") {
			return false;
		}
		const maybeError = error as { code?: string; message?: string };
		if (maybeError.code === "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM") {
			return true;
		}
		return (
			typeof maybeError.message === "string" &&
			maybeError.message.toLowerCase().includes("recursive") &&
			maybeError.message.toLowerCase().includes("not supported")
		);
	}

	private replaceTasks(tasks: Task[]): void {
		this.tasks.clear();
		for (const task of tasks) {
			this.tasks.set(task.id, task);
		}
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
	}

	private replaceDocuments(documents: Document[]): void {
		this.documents.clear();
		for (const document of documents) {
			this.documents.set(document.id, document);
		}
		this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
	}

	private replaceDecisions(decisions: Decision[]): void {
		this.decisions.clear();
		for (const decision of decisions) {
			this.decisions.set(decision.id, decision);
		}
		this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
	}

	private patchFilesystem(): void {
		if (this.restoreFilesystemPatch) {
			return;
		}

		const originalSaveTask = this.filesystem.saveTask;
		const originalSaveDocument = this.filesystem.saveDocument;
		const originalSaveDecision = this.filesystem.saveDecision;

		this.filesystem.saveTask = (async (task: Task, opts: SaveTaskOptions = {}): Promise<string> => {
			// Hook into saveTask's onSerialized callback so we record the
			// content hash BEFORE Bun.write hits disk. This closes the race
			// window where fs.watch could otherwise deliver the change event
			// before recordWrite ran, causing the watcher to treat our own
			// write as a hand edit and double-fire the hook.
			const coordinator = this.hooks?.coordinator;
			const callerOnSerialized = opts.onSerialized;
			const filePath = await originalSaveTask.call(this.filesystem, task, {
				...opts,
				onSerialized: async (info) => {
					if (coordinator) {
						try {
							const hash = await hashTaskContent(info.content);
							coordinator.recordWrite(task.id, hash);
						} catch {
							// If hashing fails, fall back to firing as a hand
							// edit — safer than silent suppression on a stale
							// recordWrite.
						}
					}
					if (callerOnSerialized) await callerOnSerialized(info);
				},
			});
			await this.handleTaskWrite(task.id);
			return filePath;
		}) as FileSystem["saveTask"];

		this.filesystem.saveDocument = (async (document: Document, subPath = ""): Promise<string> => {
			const result = await originalSaveDocument.call(this.filesystem, document, subPath);
			await this.handleDocumentWrite(document.id);
			return result;
		}) as FileSystem["saveDocument"];

		this.filesystem.saveDecision = (async (decision: Decision): Promise<void> => {
			await originalSaveDecision.call(this.filesystem, decision);
			await this.handleDecisionWrite(decision.id);
		}) as FileSystem["saveDecision"];

		this.restoreFilesystemPatch = () => {
			this.filesystem.saveTask = originalSaveTask;
			this.filesystem.saveDocument = originalSaveDocument;
			this.filesystem.saveDecision = originalSaveDecision;
		};
	}

	private async handleTaskWrite(taskId: string): Promise<void> {
		if (!this.initialized) {
			return;
		}
		await this.updateTaskFromDisk(taskId);
	}

	private async handleDocumentWrite(documentId: string): Promise<void> {
		if (!this.initialized) {
			return;
		}
		await this.refreshDocumentsFromDisk(documentId, this.documents.get(documentId));
	}

	private hasTaskChanged(previous: Task, next: Task): boolean {
		return JSON.stringify(previous) !== JSON.stringify(next);
	}

	private hasDocumentChanged(previous: Document, next: Document): boolean {
		return JSON.stringify(previous) !== JSON.stringify(next);
	}

	private hasDecisionChanged(previous: Decision, next: Decision): boolean {
		return JSON.stringify(previous) !== JSON.stringify(next);
	}

	private async refreshTasksFromDisk(expectedId?: string, previous?: Task): Promise<void> {
		const tasks = await this.retryRead(
			async () => this.loadTasksWithLoader(),
			(expected) => {
				if (!expectedId) {
					return true;
				}
				const match = expected.find((task) => taskIdsEqual(task.id, expectedId));
				if (!match) {
					return false;
				}
				if (previous && !this.hasTaskChanged(previous, match)) {
					return false;
				}
				return true;
			},
		);
		if (!tasks) {
			return;
		}
		this.replaceTasks(tasks);
		this.notify("tasks");
		// Bulk-refresh paths (rename events, retry-exhausted fallback) also
		// need to give the dispatcher a chance to detect status transitions.
		// onTaskWrite is a no-op for tasks whose status matches the snapshot,
		// so iterating the full set is cheap and self-suppressing.
		if (this.hooks?.dispatcher) {
			for (const task of tasks) {
				void this.hooks.dispatcher.onTaskWrite(task);
			}
		}
	}

	private async refreshDocumentsFromDisk(expectedId?: string, previous?: Document): Promise<void> {
		const documents = await this.retryRead(
			async () => this.filesystem.listDocuments(),
			(expected) => {
				if (!expectedId) {
					return true;
				}
				const match = expected.find((doc) => doc.id === expectedId);
				if (!match) {
					return false;
				}
				if (previous && !this.hasDocumentChanged(previous, match)) {
					return false;
				}
				return true;
			},
		);
		if (!documents) {
			return;
		}
		this.replaceDocuments(documents);
		this.notify("documents");
	}

	private async refreshDecisionsFromDisk(expectedId?: string, previous?: Decision): Promise<void> {
		const decisions = await this.retryRead(
			async () => this.filesystem.listDecisions(),
			(expected) => {
				if (!expectedId) {
					return true;
				}
				const match = expected.find((decision) => decision.id === expectedId);
				if (!match) {
					return false;
				}
				if (previous && !this.hasDecisionChanged(previous, match)) {
					return false;
				}
				return true;
			},
		);
		if (!decisions) {
			return;
		}
		this.replaceDecisions(decisions);
		this.notify("decisions");
	}

	private async handleDecisionWrite(decisionId: string): Promise<void> {
		if (!this.initialized) {
			return;
		}
		await this.updateDecisionFromDisk(decisionId);
	}

	private async updateTaskFromDisk(taskId: string): Promise<void> {
		const normalizedTaskId = normalizeTaskId(taskId);
		const previous = this.tasks.get(normalizedTaskId);
		const task = await this.retryRead(
			async () => this.filesystem.loadTask(taskId),
			(result) => result !== null && (!previous || this.hasTaskChanged(previous, result)),
		);
		if (!task) {
			return;
		}
		this.tasks.set(task.id, task);
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
		this.notify("tasks");
	}

	private async updateDecisionFromDisk(decisionId: string): Promise<void> {
		const previous = this.decisions.get(decisionId);
		const decision = await this.retryRead(
			async () => this.filesystem.loadDecision(decisionId),
			(result) => result !== null && (!previous || this.hasDecisionChanged(previous, result)),
		);
		if (!decision) {
			return;
		}
		this.decisions.set(decision.id, decision);
		this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
		this.notify("decisions");
	}

	private async createManualRecursiveWatcher(
		rootDir: string,
		handler: (eventType: string, absolutePath: string, relativePath: string | null) => Promise<void> | void,
	): Promise<WatchHandle> {
		const watchers = new Map<string, FSWatcher>();
		let disposed = false;

		const removeSubtreeWatchers = (baseDir: string) => {
			const prefix = baseDir.endsWith(sep) ? baseDir : `${baseDir}${sep}`;
			for (const path of [...watchers.keys()]) {
				if (path === baseDir || path.startsWith(prefix)) {
					watchers.get(path)?.close();
					watchers.delete(path);
				}
			}
		};

		const addWatcher = async (dir: string): Promise<void> => {
			if (disposed || watchers.has(dir)) {
				return;
			}

			const watcher = watch(dir, { recursive: false }, (eventType, filename) => {
				if (disposed) {
					return;
				}
				const relativePath = this.normalizeFilename(filename);
				const absolutePath = relativePath ? join(dir, relativePath) : dir;
				const normalizedRelative = relativePath ? relative(rootDir, absolutePath) : null;

				this.enqueue(async () => {
					await handler(eventType, absolutePath, normalizedRelative);

					if (eventType === "rename" && relativePath) {
						try {
							const stats = await stat(absolutePath);
							if (stats.isDirectory()) {
								await addWatcher(absolutePath);
							}
						} catch {
							removeSubtreeWatchers(absolutePath);
						}
					}
				});
			});
			this.attachWatcherErrorHandler(watcher, `manual:${dir}`);

			watchers.set(dir, watcher);

			try {
				const entries = await readdir(dir, { withFileTypes: true });
				for (const entry of entries) {
					const entryPath = join(dir, entry.name);
					if (entry.isDirectory()) {
						await addWatcher(entryPath);
						continue;
					}

					if (entry.isFile()) {
						this.enqueue(async () => {
							await handler("change", entryPath, relative(rootDir, entryPath));
						});
					}
				}
			} catch {
				// Ignore transient directory enumeration issues
			}
		};

		await addWatcher(rootDir);

		return {
			stop() {
				disposed = true;
				for (const watcher of watchers.values()) {
					watcher.close();
				}
				watchers.clear();
			},
		};
	}

	private async retryRead<T>(
		loader: () => Promise<T>,
		isValid: (result: T) => boolean = (value) => value !== null && value !== undefined,
		attempts = 12,
		delayMs = 75,
	): Promise<T | null> {
		let lastError: unknown = null;
		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				const result = await loader();
				if (isValid(result)) {
					return result;
				}
			} catch (error) {
				lastError = error;
			}
			if (attempt < attempts) {
				await this.delay(delayMs * attempt);
			}
		}

		if (lastError && process.env.DEBUG) {
			console.error("ContentStore retryRead exhausted attempts", lastError);
		}
		return null;
	}

	private async delay(ms: number): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, ms));
	}

	private enqueue(fn: () => Promise<void>): void {
		this.chainTail = this.chainTail
			.then(() => fn())
			.catch((error) => {
				if (process.env.DEBUG) {
					console.error("ContentStore update failed", error);
				}
			});
	}

	private async loadTasksWithLoader(): Promise<Task[]> {
		if (this.taskLoader) {
			return await this.taskLoader();
		}
		return await this.filesystem.listTasks();
	}
}

export type { ContentSnapshot };
