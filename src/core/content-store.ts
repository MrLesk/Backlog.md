import { type FSWatcher, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import type { FileSystem } from "../file-system/operations.ts";
import { parseDecision, parseDocument, parseTask } from "../markdown/parser.ts";
import type { BacklogConfig, Decision, Document, Task, TaskListFilter } from "../types/index.ts";
import { watchConfigFile } from "../utils/config-watcher.ts";
import { normalizeDocumentRelativePath } from "../utils/document-path.ts";
import { normalizePriorityValue } from "../utils/priority-config.ts";
import { normalizeTaskId, normalizeTaskIdentity, taskIdsEqual } from "../utils/task-path.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";
import { matchesTaskTypeFilter } from "../utils/task-type-config.ts";

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
	| { type: "decisions"; decisions: Decision[]; snapshot: ContentSnapshot; version: number }
	| { type: "config"; config: BacklogConfig; snapshot: ContentSnapshot; version: number };

export type ContentStoreListener = (event: ContentStoreEvent) => void;

interface WatchHandle {
	stop(): void;
}

interface DeferredRecheck {
	epoch: number;
	attempt: number;
	timer: ReturnType<typeof setTimeout> | null;
	reconcile: () => Promise<boolean>;
}

const CONTENT_RETRY_ATTEMPTS = 12;
const CONTENT_RETRY_DELAY_MS = 75;

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
	private readonly rootWatchers: WatchHandle[] = [];
	private configWatcher: WatchHandle | null = null;
	private configWatcherPath: string | null = null;
	private restoreFilesystemPatch?: () => void;
	private chainTail: Promise<void> = Promise.resolve();
	private rootWatchersInitialized = false;
	private configWatcherActive = false;
	private rootWatcherEpoch = 0;
	private boundBacklogDir: string | null = null;
	private closed = false;
	private readonly deferredRechecks = new Map<string, DeferredRecheck>();

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
	) {
		this.patchFilesystem();
	}

	subscribe(listener: ContentStoreListener): () => void {
		this.assertOpen();
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
		this.assertOpen();
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

	async refreshTasks(): Promise<void> {
		this.assertOpen();
		if (!this.initialized) {
			await this.ensureInitialized();
			return;
		}
		const epoch = this.rootWatcherEpoch;
		await this.enqueueRoot(epoch, async () => {
			await this.refreshTasksFromDisk(undefined, epoch);
		});
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
		if (filter?.excludeStatus) {
			const excludedStatuses = Array.isArray(filter.excludeStatus) ? filter.excludeStatus : [filter.excludeStatus];
			const excluded = new Set(
				excludedStatuses.map((status) => status.trim().toLowerCase()).filter((status) => status.length > 0),
			);
			if (excluded.size > 0) {
				tasks = tasks.filter((task) => !excluded.has(task.status.toLowerCase()));
			}
		}
		if (filter?.type) {
			tasks = tasks.filter((task) => matchesTaskTypeFilter(task.type, filter.type));
		}
		if (filter?.assignee) {
			const assignee = filter.assignee;
			tasks = tasks.filter((task) => task.assignee.includes(assignee));
		}
		if (filter?.priority) {
			const priority = normalizePriorityValue(filter.priority);
			tasks = tasks.filter((task) => normalizePriorityValue(task.priority) === priority);
		}
		if (filter?.parentTaskId) {
			const parentFilter = filter.parentTaskId;
			tasks = tasks.filter((task) => task.parentTaskId && taskIdsEqual(parentFilter, task.parentTaskId));
		}

		return tasks.slice();
	}

	upsertTask(task: Task): void {
		if (this.closed || !this.initialized) {
			return;
		}
		this.tasks.set(task.id, task);
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
		this.notify("tasks");
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
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.rootWatcherEpoch += 1;
		this.stopRootWatchers();
		this.stopConfigWatcher();
		if (this.restoreFilesystemPatch) {
			this.restoreFilesystemPatch();
			this.restoreFilesystemPatch = undefined;
		}
		this.listeners.clear();
		this.initializing = null;
	}

	private emit(event: ContentStoreEvent): void {
		if (this.closed) {
			return;
		}
		for (const listener of [...this.listeners]) {
			listener(event);
		}
	}

	private notify(type: ContentStoreEventType): void {
		if (this.closed) {
			return;
		}
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

	private notifyConfig(config: BacklogConfig): void {
		if (this.closed) {
			return;
		}
		this.version += 1;
		this.emit({ type: "config", config, snapshot: this.getSnapshot(), version: this.version });
	}

	private assertOpen(): void {
		if (this.closed) {
			throw new Error("ContentStore has been disposed.");
		}
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
		if (this.closed) return;

		this.replaceTasks(tasks);
		this.replaceDocuments(documents);
		this.replaceDecisions(decisions);

		this.initialized = true;
		if (this.enableWatchers) {
			await this.setupWatchers();
		}
		this.notify("ready");
	}

	private async setupWatchers(): Promise<void> {
		if (this.closed) return;
		if (!this.rootWatchersInitialized) {
			const epoch = this.rootWatcherEpoch + 1;
			this.rootWatcherEpoch = epoch;
			this.boundBacklogDir = this.filesystem.backlogDir;
			try {
				await this.bindRootWatchers(epoch);
			} catch (error) {
				if (process.env.DEBUG) {
					console.error("Failed to initialize content watchers", error);
				}
			}
		}
		await this.ensureConfigWatcher();
	}

	/**
	 * Retry setting up the config watcher after initialization.
	 * Called when the config file is created after the server started.
	 */
	async ensureConfigWatcher(): Promise<void> {
		if (this.closed) {
			return;
		}
		const rootNeedsReconciliation =
			this.boundBacklogDir !== null && resolve(this.boundBacklogDir) !== resolve(this.filesystem.backlogDir);
		const configPath = resolve(this.filesystem.configFilePath);
		if (!this.configWatcherActive || this.configWatcherPath !== configPath) {
			this.stopConfigWatcher();
			try {
				const configWatcher = this.createConfigWatcher();
				if (configWatcher) {
					this.configWatcher = configWatcher;
					this.configWatcherPath = configPath;
					this.configWatcherActive = true;
				}
			} catch (error) {
				if (process.env.DEBUG) {
					console.error("Failed to setup config watcher after init", error);
				}
			}
		}

		if (rootNeedsReconciliation) {
			const config = await this.filesystem.loadConfig();
			if (config && !this.closed) {
				await this.handleConfigChanged(config);
			}
		}
	}

	private createConfigWatcher(): WatchHandle | null {
		return watchConfigFile(this.filesystem, {
			onConfigChanged: async (config) => {
				if (config) {
					await this.handleConfigChanged(config);
				}
			},
		});
	}

	private async handleConfigChanged(config: BacklogConfig): Promise<void> {
		if (this.closed) return;

		const nextBacklogDir = resolve(this.filesystem.backlogDir);
		const previousBacklogDir = this.boundBacklogDir ? resolve(this.boundBacklogDir) : null;
		const rootChanged = previousBacklogDir !== null && previousBacklogDir !== nextBacklogDir;
		const needsRootWatcher = !this.rootWatchersInitialized;
		let transitionEpoch = this.rootWatcherEpoch;

		if (rootChanged) {
			transitionEpoch += 1;
			this.rootWatcherEpoch = transitionEpoch;
			this.stopRootWatchers();
		}

		await this.enqueue(async () => {
			if (this.closed || (rootChanged && transitionEpoch !== this.rootWatcherEpoch)) return;

			await this.filesystem.ensureBacklogStructure();
			if (this.closed || (rootChanged && transitionEpoch !== this.rootWatcherEpoch)) return;

			if (rootChanged || needsRootWatcher) {
				this.boundBacklogDir = this.filesystem.backlogDir;
				await this.bindRootWatchers(transitionEpoch);
				if (!this.isRootWatcherCurrent(transitionEpoch)) return;
			}

			const [tasks, documents, decisions] = await Promise.all([
				this.loadTasksWithLoader(),
				this.filesystem.listDocuments(),
				this.filesystem.listDecisions(),
			]);
			if (this.closed || (rootChanged && !this.isRootWatcherCurrent(transitionEpoch))) return;

			this.replaceTasks(tasks);
			this.replaceDocuments(documents);
			this.replaceDecisions(decisions);
			this.notifyConfig(config);
		});
	}

	private async bindRootWatchers(epoch: number): Promise<void> {
		if (this.closed || epoch !== this.rootWatcherEpoch || this.rootWatchersInitialized) return;
		const created: WatchHandle[] = [];
		try {
			created.push(this.createTaskWatcher(epoch));
			created.push(this.createDecisionWatcher(epoch));
			created.push(await this.createDocumentWatcher(epoch));
			if (!this.isRootWatcherCurrent(epoch)) {
				for (const watcher of created) watcher.stop();
				return;
			}
			this.rootWatchers.push(...created);
			this.rootWatchersInitialized = true;
		} catch (error) {
			for (const watcher of created) {
				try {
					watcher.stop();
				} catch {}
			}
			throw error;
		}
	}

	private stopRootWatchers(): void {
		this.clearDeferredRechecks();
		for (const watcher of this.rootWatchers) {
			try {
				watcher.stop();
			} catch {}
		}
		this.rootWatchers.length = 0;
		this.rootWatchersInitialized = false;
	}

	private stopConfigWatcher(): void {
		try {
			this.configWatcher?.stop();
		} catch {}
		this.configWatcher = null;
		this.configWatcherPath = null;
		this.configWatcherActive = false;
	}

	private isRootWatcherCurrent(epoch: number): boolean {
		return !this.closed && epoch === this.rootWatcherEpoch;
	}

	private createTaskWatcher(epoch: number): WatchHandle {
		const tasksDir = this.filesystem.tasksDir;
		const watcher: FSWatcher = watch(tasksDir, { recursive: false }, (eventType, filename) => {
			const file = this.normalizeFilename(filename);
			// Accept any prefix pattern (task-, jira-, etc.) followed by ID and ending in .md
			if (!file || !/^[a-zA-Z]+-/.test(file) || !file.endsWith(".md")) {
				this.enqueueRoot(epoch, async () => {
					await this.refreshTasksFromDisk(undefined, epoch);
				});
				return;
			}

			this.enqueueRoot(epoch, async () => {
				const [taskId] = file.split(" ");
				if (!taskId) return;
				const normalizedTaskId = normalizeTaskId(taskId);

				const fullPath = join(tasksDir, file);
				if (eventType === "rename") {
					await this.refreshTasksFromDisk(undefined, epoch);
					return;
				}

				await this.reconcileOrSchedule(`task:${normalizedTaskId}`, epoch, async () => {
					if (!(await Bun.file(fullPath).exists())) {
						if (this.tasks.delete(normalizedTaskId)) {
							this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
							this.notify("tasks");
						}
						return false;
					}

					try {
						const content = await Bun.file(fullPath).text();
						const task = { ...normalizeTaskIdentity(parseTask(content)), filePath: fullPath };
						if (!taskIdsEqual(task.id, normalizedTaskId)) {
							return true;
						}
						const previous = this.tasks.get(normalizedTaskId);
						if (previous && !this.hasTaskChanged(previous, task)) {
							return true;
						}
						this.tasks.set(task.id, task);
						this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
						this.notify("tasks");
						return false;
					} catch {
						return true;
					}
				});
			});
		});
		this.attachWatcherErrorHandler(watcher, "tasks");

		return {
			stop() {
				watcher.close();
			},
		};
	}

	private createDecisionWatcher(epoch: number): WatchHandle {
		const decisionsDir = this.filesystem.decisionsDir;
		const watcher: FSWatcher = watch(decisionsDir, { recursive: false }, (eventType, filename) => {
			const file = this.normalizeFilename(filename);
			if (!file?.startsWith("decision-") || !file.endsWith(".md")) {
				this.enqueueRoot(epoch, async () => {
					await this.refreshDecisionsFromDisk(undefined, epoch);
				});
				return;
			}

			this.enqueueRoot(epoch, async () => {
				const [idPart] = file.split(" - ");
				if (!idPart) return;

				const fullPath = join(decisionsDir, file);
				if (eventType === "rename") {
					await this.refreshDecisionsFromDisk(undefined, epoch);
					return;
				}

				await this.reconcileOrSchedule(`decision:${idPart}`, epoch, async () => {
					if (!(await Bun.file(fullPath).exists())) {
						if (this.decisions.delete(idPart)) {
							this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
							this.notify("decisions");
						}
						return false;
					}

					try {
						const content = await Bun.file(fullPath).text();
						const decision = parseDecision(content);
						if (decision.id !== idPart) {
							return true;
						}
						const previous = this.decisions.get(idPart);
						if (previous && !this.hasDecisionChanged(previous, decision)) {
							return true;
						}
						this.decisions.set(decision.id, decision);
						this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
						this.notify("decisions");
						return false;
					} catch {
						return true;
					}
				});
			});
		});
		this.attachWatcherErrorHandler(watcher, "decisions");

		return {
			stop() {
				watcher.close();
			},
		};
	}

	private async createDocumentWatcher(epoch: number): Promise<WatchHandle> {
		const docsDir = this.filesystem.docsDir;
		return this.createDirectoryWatcher(docsDir, epoch, async (eventType, absolutePath, relativePath) => {
			if (!this.isRootWatcherCurrent(epoch)) return;
			const base = basename(absolutePath);
			if (!base.endsWith(".md")) {
				if (relativePath === null) {
					await this.refreshDocumentsFromDisk(undefined, epoch);
				}
				return;
			}

			if (!base.startsWith("doc-")) {
				await this.refreshDocumentsFromDisk(undefined, epoch);
				return;
			}

			const [idPart] = base.split(" - ");
			if (!idPart) {
				await this.refreshDocumentsFromDisk(undefined, epoch);
				return;
			}

			if (eventType === "rename") {
				await this.refreshDocumentsFromDisk(undefined, epoch);
				return;
			}

			await this.reconcileOrSchedule(`document:${idPart}`, epoch, async () => {
				if (!(await Bun.file(absolutePath).exists())) {
					if (this.documents.delete(idPart)) {
						this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
						this.notify("documents");
					}
					return false;
				}

				try {
					const content = await Bun.file(absolutePath).text();
					const documentPath = normalizeDocumentRelativePath(relativePath ?? relative(docsDir, absolutePath));
					const document = { ...parseDocument(content), path: documentPath };
					if (document.id !== idPart) {
						return true;
					}
					const previous = this.documents.get(idPart);
					if (previous && !this.hasDocumentChanged(previous, document)) {
						return true;
					}
					this.documents.set(document.id, document);
					this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
					this.notify("documents");
					return false;
				} catch {
					return true;
				}
			});
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
		epoch: number,
		handler: (eventType: string, absolutePath: string, relativePath: string | null) => Promise<void> | void,
	): Promise<WatchHandle> {
		try {
			const watcher = watch(rootDir, { recursive: true }, (eventType, filename) => {
				const relativePath = this.normalizeFilename(filename);
				const absolutePath = relativePath ? join(rootDir, relativePath) : rootDir;

				this.enqueueRoot(epoch, async () => {
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
				return this.createManualRecursiveWatcher(rootDir, epoch, handler);
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
			this.cancelDeferredRecheck(`task:${normalizeTaskId(task.id)}`);
			this.tasks.set(task.id, task);
		}
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
	}

	private replaceDocuments(documents: Document[]): void {
		this.documents.clear();
		for (const document of documents) {
			this.cancelDeferredRecheck(`document:${document.id}`);
			this.documents.set(document.id, document);
		}
		this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
	}

	private replaceDecisions(decisions: Decision[]): void {
		this.decisions.clear();
		for (const decision of decisions) {
			this.cancelDeferredRecheck(`decision:${decision.id}`);
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

		this.filesystem.saveTask = (async (task: Task): Promise<string> => {
			const epoch = this.rootWatcherEpoch;
			const result = await originalSaveTask.call(this.filesystem, task);
			await this.handleTaskWrite(task.id, epoch);
			return result;
		}) as FileSystem["saveTask"];

		this.filesystem.saveDocument = (async (document: Document, subPath = ""): Promise<string> => {
			const epoch = this.rootWatcherEpoch;
			const result = await originalSaveDocument.call(this.filesystem, document, subPath);
			await this.handleDocumentWrite(document.id, epoch);
			return result;
		}) as FileSystem["saveDocument"];

		this.filesystem.saveDecision = (async (decision: Decision): Promise<void> => {
			const epoch = this.rootWatcherEpoch;
			await originalSaveDecision.call(this.filesystem, decision);
			await this.handleDecisionWrite(decision.id, epoch);
		}) as FileSystem["saveDecision"];

		this.restoreFilesystemPatch = () => {
			this.filesystem.saveTask = originalSaveTask;
			this.filesystem.saveDocument = originalSaveDocument;
			this.filesystem.saveDecision = originalSaveDecision;
		};
	}

	private async handleTaskWrite(taskId: string, epoch: number): Promise<void> {
		if (!this.initialized || !this.isRootWatcherCurrent(epoch)) {
			return;
		}
		await this.enqueueRoot(epoch, async () => {
			await this.updateTaskFromDisk(taskId, epoch);
		});
	}

	private async handleDocumentWrite(documentId: string, epoch: number): Promise<void> {
		if (!this.initialized || !this.isRootWatcherCurrent(epoch)) {
			return;
		}
		await this.enqueueRoot(epoch, async () => {
			await this.refreshDocumentsFromDisk(documentId, epoch);
		});
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

	// Keep read validity separate from change detection: duplicate watcher events are valid no-ops.
	private hasCollectionChanged<T>(
		current: readonly T[],
		next: readonly T[],
		hasItemChanged: (previous: T, next: T) => boolean,
	): boolean {
		if (current.length !== next.length) {
			return true;
		}

		return next.some((item, index) => {
			const previous = current[index];
			return !previous || hasItemChanged(previous, item);
		});
	}

	private hasTaskCollectionChanged(nextTasks: Task[]): boolean {
		return this.hasCollectionChanged(this.cachedTasks, sortByTaskId(nextTasks), (previous, next) =>
			this.hasTaskChanged(previous, next),
		);
	}

	private hasDocumentCollectionChanged(nextDocuments: Document[]): boolean {
		const sortedDocuments = [...nextDocuments].sort((a, b) => a.title.localeCompare(b.title));
		return this.hasCollectionChanged(this.cachedDocuments, sortedDocuments, (previous, next) =>
			this.hasDocumentChanged(previous, next),
		);
	}

	private hasDecisionCollectionChanged(nextDecisions: Decision[]): boolean {
		return this.hasCollectionChanged(this.cachedDecisions, sortByTaskId(nextDecisions), (previous, next) =>
			this.hasDecisionChanged(previous, next),
		);
	}

	private async reconcileOrSchedule(key: string, epoch: number, reconcile: () => Promise<boolean>): Promise<void> {
		if (!this.isRootWatcherCurrent(epoch)) {
			return;
		}

		let shouldRetry = true;
		try {
			shouldRetry = await reconcile();
		} catch {
			// Retry transient read failures outside the serialized queue.
		}
		if (!this.isRootWatcherCurrent(epoch)) {
			return;
		}
		if (!shouldRetry) {
			this.cancelDeferredRecheck(key);
			return;
		}

		this.scheduleDeferredRecheck(key, epoch, reconcile);
	}

	private scheduleDeferredRecheck(key: string, epoch: number, reconcile: () => Promise<boolean>): void {
		const existing = this.deferredRechecks.get(key);
		if (existing?.epoch === epoch) {
			existing.reconcile = reconcile;
			return;
		}
		if (existing) {
			this.cancelDeferredRecheck(key);
		}

		const recheck: DeferredRecheck = {
			epoch,
			attempt: 1,
			timer: null,
			reconcile,
		};
		this.deferredRechecks.set(key, recheck);
		this.armDeferredRecheck(key, recheck);
	}

	private armDeferredRecheck(key: string, recheck: DeferredRecheck): void {
		if (recheck.attempt >= CONTENT_RETRY_ATTEMPTS || !this.isRootWatcherCurrent(recheck.epoch)) {
			if (this.deferredRechecks.get(key) === recheck) {
				this.deferredRechecks.delete(key);
			}
			return;
		}

		recheck.timer = this.startDeferredTimer(() => {
			recheck.timer = null;
			void this.enqueueRoot(recheck.epoch, async () => {
				if (this.deferredRechecks.get(key) !== recheck) {
					return;
				}

				let shouldRetry = true;
				try {
					shouldRetry = await recheck.reconcile();
				} catch {
					// Retry transient read failures until the bounded budget is exhausted.
				}
				if (this.deferredRechecks.get(key) !== recheck || !this.isRootWatcherCurrent(recheck.epoch)) {
					return;
				}
				if (!shouldRetry) {
					this.deferredRechecks.delete(key);
					return;
				}

				recheck.attempt += 1;
				this.armDeferredRecheck(key, recheck);
			}).catch((error) => {
				if (process.env.DEBUG) {
					console.error("ContentStore deferred recheck failed", error);
				}
			});
		}, CONTENT_RETRY_DELAY_MS * recheck.attempt);
	}

	private startDeferredTimer(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
		const timer = setTimeout(callback, delayMs);
		timer.unref();
		return timer;
	}

	private cancelDeferredRecheck(key: string): void {
		const recheck = this.deferredRechecks.get(key);
		if (!recheck) {
			return;
		}
		if (recheck.timer) {
			clearTimeout(recheck.timer);
		}
		this.deferredRechecks.delete(key);
	}

	private clearDeferredRechecks(): void {
		for (const recheck of this.deferredRechecks.values()) {
			if (recheck.timer) {
				clearTimeout(recheck.timer);
			}
		}
		this.deferredRechecks.clear();
	}

	private async refreshTasksFromDisk(expectedId?: string, epoch = this.rootWatcherEpoch): Promise<void> {
		const normalizedExpectedId = expectedId ? normalizeTaskId(expectedId) : "*";
		await this.reconcileOrSchedule(`task:${normalizedExpectedId}`, epoch, async () => {
			let tasks: Task[];
			try {
				tasks = await this.loadTasksWithLoader();
			} catch {
				return true;
			}
			if (expectedId && !tasks.some((task) => taskIdsEqual(task.id, expectedId))) {
				return true;
			}
			if (!expectedId) {
				for (const task of tasks) {
					this.cancelDeferredRecheck(`task:${normalizeTaskId(task.id)}`);
				}
			}
			if (!this.hasTaskCollectionChanged(tasks)) {
				return false;
			}
			this.replaceTasks(tasks);
			this.notify("tasks");
			return false;
		});
	}

	private async refreshDocumentsFromDisk(expectedId?: string, epoch = this.rootWatcherEpoch): Promise<void> {
		await this.reconcileOrSchedule(`document:${expectedId ?? "*"}`, epoch, async () => {
			let documents: Document[];
			try {
				documents = await this.filesystem.listDocuments();
			} catch {
				return true;
			}
			if (expectedId && !documents.some((document) => document.id === expectedId)) {
				return true;
			}
			if (!expectedId) {
				for (const document of documents) {
					this.cancelDeferredRecheck(`document:${document.id}`);
				}
			}
			if (!this.hasDocumentCollectionChanged(documents)) {
				return false;
			}
			this.replaceDocuments(documents);
			this.notify("documents");
			return false;
		});
	}

	private async refreshDecisionsFromDisk(expectedId?: string, epoch = this.rootWatcherEpoch): Promise<void> {
		await this.reconcileOrSchedule(`decision:${expectedId ?? "*"}`, epoch, async () => {
			let decisions: Decision[];
			try {
				decisions = await this.filesystem.listDecisions();
			} catch {
				return true;
			}
			if (expectedId && !decisions.some((decision) => decision.id === expectedId)) {
				return true;
			}
			if (!expectedId) {
				for (const decision of decisions) {
					this.cancelDeferredRecheck(`decision:${decision.id}`);
				}
			}
			if (!this.hasDecisionCollectionChanged(decisions)) {
				return false;
			}
			this.replaceDecisions(decisions);
			this.notify("decisions");
			return false;
		});
	}

	private async handleDecisionWrite(decisionId: string, epoch: number): Promise<void> {
		if (!this.initialized || !this.isRootWatcherCurrent(epoch)) {
			return;
		}
		await this.enqueueRoot(epoch, async () => {
			await this.updateDecisionFromDisk(decisionId, epoch);
		});
	}

	private async updateTaskFromDisk(taskId: string, epoch = this.rootWatcherEpoch): Promise<void> {
		const normalizedTaskId = normalizeTaskId(taskId);
		await this.reconcileOrSchedule(`task:${normalizedTaskId}`, epoch, async () => {
			let task: Task | null;
			try {
				task = await this.filesystem.loadTask(taskId);
			} catch {
				return true;
			}
			if (!task || !taskIdsEqual(task.id, normalizedTaskId)) {
				return true;
			}
			const previous = this.tasks.get(normalizedTaskId);
			if (previous && !this.hasTaskChanged(previous, task)) {
				return false;
			}
			this.tasks.set(task.id, task);
			this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
			this.notify("tasks");
			return false;
		});
	}

	private async updateDecisionFromDisk(decisionId: string, epoch = this.rootWatcherEpoch): Promise<void> {
		await this.reconcileOrSchedule(`decision:${decisionId}`, epoch, async () => {
			let decision: Decision | null;
			try {
				decision = await this.filesystem.loadDecision(decisionId);
			} catch {
				return true;
			}
			if (!decision || decision.id !== decisionId) {
				return true;
			}
			const previous = this.decisions.get(decisionId);
			if (previous && !this.hasDecisionChanged(previous, decision)) {
				return false;
			}
			this.decisions.set(decision.id, decision);
			this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
			this.notify("decisions");
			return false;
		});
	}

	private async createManualRecursiveWatcher(
		rootDir: string,
		epoch: number,
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
			if (disposed || !this.isRootWatcherCurrent(epoch) || watchers.has(dir)) {
				return;
			}

			const watcher = watch(dir, { recursive: false }, (eventType, filename) => {
				if (disposed) {
					return;
				}
				const relativePath = this.normalizeFilename(filename);
				const absolutePath = relativePath ? join(dir, relativePath) : dir;
				const normalizedRelative = relativePath ? relative(rootDir, absolutePath) : null;

				this.enqueueRoot(epoch, async () => {
					await handler(eventType, absolutePath, normalizedRelative);
					if (!this.isRootWatcherCurrent(epoch)) return;

					if (eventType === "rename" && relativePath) {
						try {
							const stats = await stat(absolutePath);
							if (!this.isRootWatcherCurrent(epoch)) return;
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
			if (disposed || !this.isRootWatcherCurrent(epoch)) {
				watcher.close();
				return;
			}

			watchers.set(dir, watcher);

			try {
				const entries = await readdir(dir, { withFileTypes: true });
				if (disposed || !this.isRootWatcherCurrent(epoch)) return;
				for (const entry of entries) {
					if (disposed || !this.isRootWatcherCurrent(epoch)) return;
					const entryPath = join(dir, entry.name);
					if (entry.isDirectory()) {
						await addWatcher(entryPath);
						continue;
					}

					if (entry.isFile()) {
						this.enqueueRoot(epoch, async () => {
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

	private enqueue(fn: () => Promise<void>): Promise<void> {
		if (this.closed) return Promise.resolve();
		const run = this.chainTail.then(async () => {
			if (this.closed) return;
			await fn();
		});
		this.chainTail = run.catch((error) => {
			if (process.env.DEBUG) {
				console.error("ContentStore update failed", error);
			}
		});
		return run;
	}

	private enqueueRoot(epoch: number, fn: () => Promise<void>): Promise<void> {
		return this.enqueue(async () => {
			if (!this.isRootWatcherCurrent(epoch)) return;
			await fn();
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
