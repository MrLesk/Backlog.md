import { type FSWatcher, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import type { FileSystem } from "../file-system/operations.ts";
import { parseDecision, parseDocument, parseTask } from "../markdown/parser.ts";
import type { Decision, Document, Task, TaskListFilter } from "../types/index.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";

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
	private chainTail: Promise<void> = Promise.resolve();
	private watchersInitialized = false;

	constructor(private readonly filesystem: FileSystem) {}

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

		return tasks.slice();
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

		const [tasks, documents, decisions] = await Promise.all([
			this.filesystem.listTasks(),
			this.filesystem.listDocuments(),
			this.filesystem.listDecisions(),
		]);

		this.replaceTasks(tasks);
		this.replaceDocuments(documents);
		this.replaceDecisions(decisions);

		this.initialized = true;
		await this.setupWatchers();
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
	}

	private createTaskWatcher(): WatchHandle {
		const tasksDir = this.filesystem.tasksDir;
		const watcher: FSWatcher = watch(tasksDir, { recursive: false }, (eventType, filename) => {
			const file = this.normalizeFilename(filename);
			if (!file || !file.startsWith("task-") || !file.endsWith(".md")) {
				this.enqueue(async () => {
					await this.refreshTasksFromDisk();
				});
				return;
			}

			this.enqueue(async () => {
				const [taskId] = file.split(" ");
				if (!taskId) return;

				const fullPath = join(tasksDir, file);
				const exists = await Bun.file(fullPath).exists();

				if (!exists && eventType === "rename") {
					if (this.tasks.delete(taskId)) {
						this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
						this.notify("tasks");
					}
					return;
				}

				const previous = this.tasks.get(taskId);
				const task = await this.retryRead(
					async () => {
						const stillExists = await Bun.file(fullPath).exists();
						if (!stillExists) {
							return null;
						}
						const content = await Bun.file(fullPath).text();
						return parseTask(content);
					},
					(result) => {
						if (!result) {
							return false;
						}
						if (result.id !== taskId) {
							return false;
						}
						if (!previous) {
							return true;
						}
						return this.hasTaskChanged(previous, result);
					},
				);
				if (!task) {
					await this.refreshTasksFromDisk(taskId, previous);
					return;
				}

				this.tasks.set(task.id, task);
				this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
				this.notify("tasks");
			});
		});

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
			if (!file || !file.startsWith("decision-") || !file.endsWith(".md")) {
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

				if (!exists && eventType === "rename") {
					if (this.decisions.delete(idPart)) {
						this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
						this.notify("decisions");
					}
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

			if (!exists && eventType === "rename") {
				if (this.documents.delete(idPart)) {
					this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
					this.notify("documents");
				}
				return;
			}

			const previous = this.documents.get(idPart);
			const document = await this.retryRead(
				async () => {
					try {
						const content = await Bun.file(absolutePath).text();
						return parseDocument(content);
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
			async () => this.filesystem.listTasks(),
			(expected) => {
				if (!expectedId) {
					return true;
				}
				const match = expected.find((task) => task.id === expectedId);
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
		attempts = 10,
		delayMs = 50,
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
}

export type { ContentSnapshot };
