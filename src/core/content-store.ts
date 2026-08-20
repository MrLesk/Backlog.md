import { type FSWatcher, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { FileSystem } from "../file-system/operations.ts";
import { parseDecision, parseDocument, parseTask } from "../markdown/parser.ts";
import type { BacklogConfig, Decision, Document, Task, TaskListFilter } from "../types/index.ts";
import { watchConfigFile } from "../utils/config-watcher.ts";
import { documentIdKey, documentIdsEqual } from "../utils/document-id.ts";
import { normalizeDocumentRelativePath } from "../utils/document-path.ts";
import { normalizePriorityValue } from "../utils/priority-config.ts";
import { matchesProjectFilter } from "../utils/project-config.ts";
import { canonicalTaskId, normalizeTaskId, normalizeTaskIdentity, taskIdsEqual } from "../utils/task-path.ts";
import { sortByTaskId } from "../utils/task-sorting.ts";
import { matchesTaskTypeFilter } from "../utils/task-type-config.ts";
import {
	normalizeTaskLifecyclePath,
	type TaskIdentityIndex,
	type TaskIdentityResolution,
} from "./task-identity-index.ts";
import type { BranchTaskStateEntry } from "./task-loader.ts";

export interface TaskCorpusSnapshot {
	tasks: Task[];
	activeTasks: Task[];
	completedTasks: Task[];
	identityIndex?: TaskIdentityIndex;
	branchStateEntries?: BranchTaskStateEntry[];
	config?: BacklogConfig | null;
}

type TaskLoaderResult = Task[] | TaskCorpusSnapshot;
type ProgressCallback = (message: string) => void;

interface ContentSnapshot {
	tasks: Task[];
	documents: Document[];
	decisions: Decision[];
	taskCorpus?: TaskCorpusSnapshot;
}

type ContentStoreEventType = "ready" | "tasks" | "documents" | "decisions";
type ContentCollection = "tasks" | "documents" | "decisions";

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

interface PublicationOwner {
	root: string;
}

interface DeferredRecheck {
	epoch: number;
	attempt: number;
	budgetRefreshed: boolean;
	timer: ReturnType<typeof setTimeout> | null;
	reconcile: () => Promise<boolean>;
}

interface RenameReconciliation<T> {
	key: string;
	epoch: number;
	readEventPath: () => Promise<T | null>;
	findIdentity: () => Promise<IdentityLookup<T>>;
	current: () => T | undefined;
	hasChanged: (previous: T, next: T) => boolean;
	publish: (item: T) => void;
	remove: () => void;
}

type IdentityLookup<T> = { state: "found"; item: T } | { state: "absent" } | { state: "incomplete" };

const CONTENT_RETRY_ATTEMPTS = 12;
const CONTENT_RETRY_DELAY_MS = 75;

/**
 * Document ID carried by a watched filename, for both `doc-1.md` and `doc-1 - Title.md`,
 * or null when the name carries no addressable document identity.
 */
function documentFilenameId(filename: string): string | null {
	const [candidate] = basename(filename, ".md").split(" - ");
	if (!candidate?.startsWith("doc-") || !documentIdKey(candidate)) return null;
	return candidate;
}

/** Docs-relative path a watcher event refers to, or null when it cannot be expressed as one. */
function watchedDocumentPath(docsDir: string, absolutePath: string, relativePath: string | null): string | null {
	try {
		return normalizeDocumentRelativePath(relativePath ?? relative(docsDir, absolutePath));
	} catch {
		return null;
	}
}

export class ContentStore {
	private initialized = false;
	private initializing: Promise<void> | null = null;
	private version = 0;

	private readonly tasks = new Map<string, Task>();
	private readonly documents = new Map<string, Document>();
	private readonly decisions = new Map<string, Decision>();

	private cachedTasks: Task[] = [];
	private activeTasks: Task[] = [];
	private completedTasks: Task[] = [];
	private taskIdentityIndex?: TaskIdentityIndex;
	private branchTaskStateEntries: BranchTaskStateEntry[] = [];
	private taskCorpusConfig: BacklogConfig | null | undefined;
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
	private readonly contentRefreshGenerations: Record<ContentCollection, number> = {
		tasks: 0,
		documents: 0,
		decisions: 0,
	};
	private readonly contentItemGenerations: Record<ContentCollection, Map<string, number>> = {
		tasks: new Map(),
		documents: new Map(),
		decisions: new Map(),
	};
	private readonly contentItemVersions: Record<ContentCollection, Map<string, number>> = {
		tasks: new Map(),
		documents: new Map(),
		decisions: new Map(),
	};
	private readonly contentItemPublicationRoots: Record<ContentCollection, Map<string, string>> = {
		tasks: new Map(),
		documents: new Map(),
		decisions: new Map(),
	};
	private readonly pendingTaskPublications = new Map<string, { root: string; task: Task }>();
	private publishedRoot: string;
	private boundBacklogDir: string | null = null;
	private closed = false;
	private readonly deferredRechecks = new Map<string, DeferredRecheck>();
	private taskBatchDepth = 0;
	private pendingTaskNotification = false;
	private localTaskRefreshPromise: Promise<void> | null = null;

	private attachWatcherErrorHandler(watcher: FSWatcher, context: string): void {
		watcher.on("error", (error) => {
			if (process.env.DEBUG) {
				console.warn(`Watcher error (${context})`, error);
			}
		});
	}

	constructor(
		private readonly filesystem: FileSystem,
		private readonly taskLoader?: (progressCallback?: ProgressCallback) => Promise<TaskLoaderResult>,
		private readonly enableWatchers = false,
	) {
		this.publishedRoot = this.currentRoot();
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

	async ensureInitialized(progressCallback?: ProgressCallback): Promise<ContentSnapshot> {
		this.assertOpen();
		if (this.initialized) {
			return this.getSnapshot();
		}

		if (!this.initializing) {
			this.initializing = this.loadInitialData(progressCallback).catch((error) => {
				this.initializing = null;
				throw error;
			});
		}

		await this.initializing;
		return this.getSnapshot();
	}

	isInitialized(): boolean {
		return this.initialized;
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

	async refreshLocalTaskCorpus(): Promise<void> {
		if (!this.initialized) {
			await this.ensureInitialized();
			return;
		}
		if (!this.localTaskRefreshPromise) {
			const epoch = this.rootWatcherEpoch;
			const refresh = this.enqueueRoot(epoch, async () => {
				const targetRoot = this.currentRoot();
				const generation = this.nextContentRefreshGeneration("tasks");
				const versionsBeforeLoad = new Map(this.contentItemVersions.tasks);
				const [activeTasks, completedTasks] = await Promise.all([
					this.filesystem.listTasks(),
					this.filesystem.listCompletedTasks(),
				]);
				if (
					!this.isRootWatcherCurrent(epoch) ||
					targetRoot !== this.currentRoot() ||
					!this.isContentRefreshCurrent("tasks", generation)
				) {
					return;
				}
				const mergedActiveTasks = this.mergeConcurrentTaskCorpus(
					activeTasks,
					this.activeTasks,
					versionsBeforeLoad,
					targetRoot,
				);
				const mergedCompletedTasks = this.mergeConcurrentTaskCorpus(
					completedTasks,
					this.completedTasks,
					versionsBeforeLoad,
					targetRoot,
				);
				if (this.needsBranchFallbackHydration(mergedActiveTasks, mergedCompletedTasks)) {
					await this.refreshTasksFromDisk(undefined, epoch);
					return;
				}
				const previousFingerprint = this.taskIdentityIndex?.getFingerprint();
				this.activeTasks = mergedActiveTasks;
				this.completedTasks = mergedCompletedTasks;
				if (this.taskIdentityIndex) {
					this.taskIdentityIndex = this.taskIdentityIndex.withWorkingCopyCorpus(
						mergedActiveTasks,
						mergedCompletedTasks,
					);
					const tasks = this.taskIdentityIndex.getTasks(false);
					const changed = this.hasTaskCollectionChanged(tasks);
					const identityChanged = previousFingerprint !== this.taskIdentityIndex.getFingerprint();
					this.replaceVisibleTasks(tasks);
					if (changed || identityChanged) this.publishTaskChange();
				} else {
					const changed = this.hasTaskCollectionChanged(mergedActiveTasks);
					this.replaceVisibleTasks(mergedActiveTasks);
					if (changed) this.publishTaskChange();
				}
			});
			this.localTaskRefreshPromise = refresh;
			const clearRefreshPromise = () => {
				if (this.localTaskRefreshPromise === refresh) this.localTaskRefreshPromise = null;
			};
			void refresh.then(clearRefreshPromise, clearRefreshPromise);
		}
		await this.localTaskRefreshPromise;
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
		if (filter?.project) {
			tasks = tasks.filter((task) => matchesProjectFilter(task.project, filter.project));
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

	getTaskCorpusSnapshot(): TaskCorpusSnapshot {
		if (!this.initialized) throw new Error("ContentStore not initialized. Call ensureInitialized() first.");
		return {
			tasks: this.cachedTasks.slice(),
			activeTasks: this.activeTasks.slice(),
			completedTasks: this.completedTasks.slice(),
			identityIndex: this.taskIdentityIndex,
			branchStateEntries: this.branchTaskStateEntries.slice(),
			config: this.taskCorpusConfig,
		};
	}

	resolveTaskForRead(taskId: string): TaskIdentityResolution {
		if (!this.initialized) throw new Error("ContentStore not initialized. Call ensureInitialized() first.");
		if (this.taskIdentityIndex) return this.taskIdentityIndex.resolveForRead(taskId);
		const task = this.cachedTasks.find((candidate) => taskIdsEqual(candidate.id, taskId));
		return task ? { status: "found", task } : { status: "not-found" };
	}

	resolveTaskForMutation(taskId: string): TaskIdentityResolution {
		if (!this.initialized) throw new Error("ContentStore not initialized. Call ensureInitialized() first.");
		if (this.taskIdentityIndex) return this.taskIdentityIndex.resolveForMutation(taskId);
		const task = this.cachedTasks.find((candidate) => taskIdsEqual(candidate.id, taskId));
		return task ? { status: "found", task } : { status: "not-found" };
	}

	upsertTask(task: Task, owner?: PublicationOwner): void {
		if (!this.canPublishContent()) {
			return;
		}
		const publicationRoot = task.filePath
			? resolve(dirname(dirname(task.filePath)))
			: owner
				? resolve(owner.root)
				: null;
		if (!publicationRoot) {
			return;
		}
		if (publicationRoot !== this.currentRoot()) {
			return;
		}
		const normalizedId = normalizeTaskId(task.id);
		const previous =
			publicationRoot === this.publishedRoot
				? this.tasks.get(task.id)
				: this.pendingTaskPublications.get(normalizedId)?.task;
		if (previous && !this.hasTaskChanged(previous, task)) {
			return;
		}
		this.nextContentItemGeneration("tasks", normalizedId);
		this.nextContentItemVersion("tasks", normalizedId, publicationRoot);
		if (publicationRoot !== this.publishedRoot) {
			this.pendingTaskPublications.set(normalizedId, { root: publicationRoot, task });
			return;
		}
		if (task.branch && this.taskIdentityIndex) {
			this.taskIdentityIndex = this.taskIdentityIndex.withRecord({
				id: task.id,
				type: "task",
				branch: task.branch,
				path: task.filePath ?? `${task.branch}:${task.id}`,
				lastModified: task.lastModified ?? (task.updatedDate ? new Date(task.updatedDate) : new Date(0)),
				task,
			});
			this.replaceVisibleTasks(this.taskIdentityIndex.getTasks(false));
			this.publishTaskChange();
			return;
		}
		this.activeTasks = this.activeTasks.filter(
			(candidate) =>
				candidate.filePath !== task.filePath &&
				(candidate.filePath !== undefined || task.filePath !== undefined || !taskIdsEqual(candidate.id, task.id)),
		);
		this.activeTasks.push(task);
		if (this.taskIdentityIndex) {
			this.taskIdentityIndex = this.taskIdentityIndex.withWorkingCopyCorpus(this.activeTasks, this.completedTasks);
			this.replaceVisibleTasks(this.taskIdentityIndex.getTasks(false));
		} else {
			this.tasks.set(task.id, task);
			this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
		}
		this.publishTaskChange();
	}

	async batchTaskUpdates<T>(operation: () => Promise<T>): Promise<T> {
		this.taskBatchDepth += 1;
		try {
			return await operation();
		} finally {
			this.taskBatchDepth -= 1;
			if (this.taskBatchDepth === 0 && this.pendingTaskNotification) {
				this.pendingTaskNotification = false;
				if (this.initialized) this.notify("tasks");
			}
		}
	}

	private publishTaskChange(): void {
		if (!this.initialized) return;
		if (this.taskBatchDepth > 0) this.pendingTaskNotification = true;
		else this.notify("tasks");
	}

	transitionTask(taskId: string, completedTask?: Task): void {
		const activeTasks = this.activeTasks.filter((task) => !taskIdsEqual(task.id, taskId));
		const completedTasks = this.completedTasks.filter((task) => !taskIdsEqual(task.id, taskId));
		if (completedTask) completedTasks.push({ ...completedTask, source: "completed" });
		if (
			activeTasks.length === this.activeTasks.length &&
			completedTasks.length === this.completedTasks.length &&
			!completedTask
		)
			return;
		const normalizedId = normalizeTaskId(taskId);
		this.nextContentItemGeneration("tasks", normalizedId);
		this.nextContentItemVersion("tasks", normalizedId, this.currentRoot());
		this.activeTasks = activeTasks;
		this.completedTasks = completedTasks;
		if (this.taskIdentityIndex) {
			this.taskIdentityIndex = this.taskIdentityIndex.withWorkingCopyCorpus(this.activeTasks, this.completedTasks);
			this.replaceVisibleTasks(this.taskIdentityIndex.getTasks(false));
		} else {
			this.replaceVisibleTasks(this.activeTasks);
		}
		this.publishTaskChange();
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
		this.invalidateRootWatchers();
		this.stopConfigWatcher();
		if (this.restoreFilesystemPatch) {
			this.restoreFilesystemPatch();
			this.restoreFilesystemPatch = undefined;
		}
		this.pendingTaskPublications.clear();
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
		if (this.closed || !this.initialized) {
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
		if (this.closed || !this.initialized) {
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

	private canPublishContent(): boolean {
		return !this.closed && (this.initialized || this.initializing !== null);
	}

	private currentRoot(): string {
		return resolve(this.filesystem.backlogDir);
	}

	private isPublicationOwnerCurrent(owner: PublicationOwner): boolean {
		return !this.closed && owner.root === this.currentRoot();
	}

	private tasksForPublicationRoot(root: string): Task[] {
		const tasks = new Map(this.cachedTasks.map((task) => [normalizeTaskId(task.id), task]));
		for (const [id, publication] of this.pendingTaskPublications) {
			if (publication.root === root) {
				tasks.set(id, publication.task);
			}
		}
		return [...tasks.values()];
	}

	private async loadInitialData(progressCallback?: ProgressCallback): Promise<void> {
		let ready = false;
		for (let attempt = 0; attempt < 12 && !ready; attempt += 1) {
			if (this.closed) {
				throw new Error("ContentStore has been disposed.");
			}
			const owner: PublicationOwner = { root: this.currentRoot() };
			await this.filesystem.ensureBacklogStructure();
			if (!this.isPublicationOwnerCurrent(owner)) {
				continue;
			}

			// Use custom task loader if provided (e.g., loadTasks for cross-branch support)
			// Otherwise fall back to filesystem-only loading
			const epoch = this.rootWatcherEpoch;
			const attemptLoaded = await this.loadCurrentContent(
				epoch,
				(snapshot) => {
					this.installTaskCorpus(snapshot.taskCorpus ?? this.asTaskCorpus(snapshot.tasks));
					this.replaceDocuments(snapshot.documents);
					this.replaceDecisions(snapshot.decisions);
				},
				progressCallback,
			);
			if (!attemptLoaded || !this.isPublicationOwnerCurrent(owner)) {
				continue;
			}

			if (this.enableWatchers) {
				await this.setupWatchers();
				if (
					this.publishedRoot !== this.currentRoot() ||
					(this.rootWatchersInitialized && !this.hasCurrentRootWatchers())
				) {
					this.invalidateRootWatchers();
					continue;
				}
			}
			ready = true;
		}
		if (!ready) {
			if (this.closed) {
				throw new Error("ContentStore has been disposed.");
			}
			throw new Error("ContentStore initialization could not stabilize after concurrent changes.");
		}

		this.initialized = true;
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
			this.canPublishContent() &&
			this.enableWatchers &&
			(!this.hasCurrentRootWatchers() || this.publishedRoot !== this.currentRoot());
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
				await this.handleConfigChanged(config, true);
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

	private async handleConfigChanged(config: BacklogConfig, bestEffortWatcherBinding = false): Promise<void> {
		if (this.closed) return;

		const nextBacklogDir = resolve(this.filesystem.backlogDir);
		const transitionOwner: PublicationOwner = { root: nextBacklogDir };
		const previousBacklogDir = this.boundBacklogDir ? resolve(this.boundBacklogDir) : null;
		const rootChanged = previousBacklogDir !== null && previousBacklogDir !== nextBacklogDir;
		const needsRootWatcher = !this.hasCurrentRootWatchers();
		let transitionEpoch = this.rootWatcherEpoch;

		if (rootChanged) {
			this.invalidateRootWatchers();
			transitionEpoch = this.rootWatcherEpoch;
		}

		await this.enqueue(async () => {
			if (
				this.closed ||
				(rootChanged && transitionEpoch !== this.rootWatcherEpoch) ||
				!this.isPublicationOwnerCurrent(transitionOwner)
			)
				return;

			await this.filesystem.ensureBacklogStructure();
			if (
				this.closed ||
				(rootChanged && transitionEpoch !== this.rootWatcherEpoch) ||
				!this.isPublicationOwnerCurrent(transitionOwner)
			)
				return;

			if (rootChanged || needsRootWatcher) {
				this.boundBacklogDir = nextBacklogDir;
				try {
					await this.bindRootWatchers(transitionEpoch);
				} catch (error) {
					if (process.env.DEBUG) {
						console.error("Failed to reconcile content watchers", error);
					}
					if (!bestEffortWatcherBinding) {
						throw error;
					}
				}
				if (!this.isRootWatcherCurrent(transitionEpoch) || !this.isPublicationOwnerCurrent(transitionOwner)) return;
			}
			if (!this.isPublicationOwnerCurrent(transitionOwner)) return;

			const loaded = await this.loadCurrentContent(transitionEpoch, (snapshot) => {
				this.installTaskCorpus(snapshot.taskCorpus ?? this.asTaskCorpus(snapshot.tasks));
				this.replaceDocuments(snapshot.documents);
				this.replaceDecisions(snapshot.decisions);
			});
			if (!loaded) return;
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

	private invalidateRootWatchers(): void {
		this.rootWatcherEpoch += 1;
		this.stopRootWatchers();
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

	private hasCurrentRootWatchers(): boolean {
		return (
			this.rootWatchersInitialized &&
			this.boundBacklogDir !== null &&
			resolve(this.boundBacklogDir) === this.currentRoot()
		);
	}

	private nextContentRefreshGeneration(collection: ContentCollection): number {
		const generation = this.contentRefreshGenerations[collection] + 1;
		this.contentRefreshGenerations[collection] = generation;
		return generation;
	}

	private isContentRefreshCurrent(collection: ContentCollection, generation: number): boolean {
		return !this.closed && generation === this.contentRefreshGenerations[collection];
	}

	private nextContentItemGeneration(collection: ContentCollection, id: string): number {
		const generations = this.contentItemGenerations[collection];
		const generation = (generations.get(id) ?? 0) + 1;
		generations.set(id, generation);
		return generation;
	}

	private nextContentItemVersion(
		collection: ContentCollection,
		id: string,
		publicationRoot = this.currentRoot(),
	): number {
		const versions = this.contentItemVersions[collection];
		const version = (versions.get(id) ?? 0) + 1;
		versions.set(id, version);
		this.contentItemPublicationRoots[collection].set(id, publicationRoot);
		return version;
	}

	private isContentItemGenerationCurrent(collection: ContentCollection, id: string, generation: number): boolean {
		return !this.closed && generation === this.contentItemGenerations[collection].get(id);
	}

	private invalidateContentItemGenerations(collection: ContentCollection): void {
		const generations = this.contentItemGenerations[collection];
		for (const [id, generation] of generations) {
			generations.set(id, generation + 1);
		}
	}

	private async loadCurrentContent(
		epoch: number,
		publish: (snapshot: ContentSnapshot) => void,
		progressCallback?: ProgressCallback,
	): Promise<boolean> {
		const targetRoot = this.currentRoot();
		const generations: Record<ContentCollection, number> = {
			tasks: this.nextContentRefreshGeneration("tasks"),
			documents: this.nextContentRefreshGeneration("documents"),
			decisions: this.nextContentRefreshGeneration("decisions"),
		};
		const before = this.getSnapshot();
		const itemVersions: Record<ContentCollection, Map<string, number>> = {
			tasks: new Map(this.contentItemVersions.tasks),
			documents: new Map(this.contentItemVersions.documents),
			decisions: new Map(this.contentItemVersions.decisions),
		};
		const [taskCorpus, documents, decisions] = await Promise.all([
			this.loadTasksWithLoader(progressCallback),
			this.filesystem.listDocuments(),
			this.filesystem.listDecisions(),
		]);
		if (
			!this.isRootWatcherCurrent(epoch) ||
			targetRoot !== this.currentRoot() ||
			!this.isContentRefreshCurrent("tasks", generations.tasks) ||
			!this.isContentRefreshCurrent("documents", generations.documents) ||
			!this.isContentRefreshCurrent("decisions", generations.decisions)
		) {
			return false;
		}

		const reconciledTaskCorpus = this.mergeConcurrentWorkingCopyCorpus(taskCorpus, itemVersions.tasks, targetRoot);
		const mergedTasks = this.mergeConcurrentChanges(
			reconciledTaskCorpus.tasks,
			before.tasks,
			this.tasksForPublicationRoot(targetRoot),
			(task) => normalizeTaskId(task.id),
			itemVersions.tasks,
			this.contentItemVersions.tasks,
			this.contentItemPublicationRoots.tasks,
			targetRoot,
		);
		publish({
			tasks: mergedTasks,
			taskCorpus: {
				...reconciledTaskCorpus,
				tasks: mergedTasks,
				activeTasks: reconciledTaskCorpus.identityIndex ? reconciledTaskCorpus.activeTasks : mergedTasks,
			},
			documents: this.mergeConcurrentChanges(
				documents,
				before.documents,
				this.cachedDocuments,
				(document) => document.id,
				itemVersions.documents,
				this.contentItemVersions.documents,
				this.contentItemPublicationRoots.documents,
				targetRoot,
			),
			decisions: this.mergeConcurrentChanges(
				decisions,
				before.decisions,
				this.cachedDecisions,
				(decision) => decision.id,
				itemVersions.decisions,
				this.contentItemVersions.decisions,
				this.contentItemPublicationRoots.decisions,
				targetRoot,
			),
		});
		this.publishedRoot = targetRoot;
		this.pendingTaskPublications.clear();
		return true;
	}

	private publishWatchedTask(task: Task, replacedPath?: string): void {
		const id = normalizeTaskId(task.id);
		this.nextContentItemGeneration("tasks", id);
		this.nextContentItemVersion("tasks", id, this.currentRoot());
		this.activeTasks = this.activeTasks.filter(
			(candidate) =>
				candidate.filePath !== task.filePath &&
				candidate.filePath !== replacedPath &&
				(candidate.filePath !== undefined || task.filePath !== undefined || !taskIdsEqual(candidate.id, task.id)),
		);
		this.activeTasks.push(task);
		if (this.taskIdentityIndex) {
			this.taskIdentityIndex = this.taskIdentityIndex.withWorkingCopyCorpus(this.activeTasks, this.completedTasks);
			this.replaceVisibleTasks(this.taskIdentityIndex.getTasks(false));
		} else this.replaceVisibleTasks(this.activeTasks);
		this.notify("tasks");
	}

	private removeWatchedTask(id: string, watchedPath?: string): void {
		const normalizedId = normalizeTaskId(id);
		const removedTasks = this.activeTasks.filter((task) =>
			watchedPath ? task.filePath === watchedPath : taskIdsEqual(task.id, normalizedId),
		);
		if (removedTasks.length === 0) return;
		this.activeTasks = this.activeTasks.filter((task) =>
			watchedPath ? task.filePath !== watchedPath : !taskIdsEqual(task.id, normalizedId),
		);
		for (const removedId of new Set([normalizedId, ...removedTasks.map((task) => normalizeTaskId(task.id))])) {
			this.nextContentItemGeneration("tasks", removedId);
			this.nextContentItemVersion("tasks", removedId, this.currentRoot());
		}
		if (this.taskIdentityIndex) {
			this.taskIdentityIndex = this.taskIdentityIndex.withWorkingCopyCorpus(this.activeTasks, this.completedTasks);
			this.replaceVisibleTasks(this.taskIdentityIndex.getTasks(false));
		} else this.replaceVisibleTasks(this.activeTasks);
		this.notify("tasks");
	}

	/**
	 * Documents are keyed by frontmatter ID, so equivalent IDs can be spelled differently and belong to
	 * different files. A watcher event is about one file, so its store entry is the one holding that path.
	 */
	private findWatchedDocumentByPath(path?: string): Document | undefined {
		if (!path) return undefined;
		return [...this.documents.values()].find((document) => document.path === path);
	}

	/** Drops one entry and versions the removal so a concurrent refresh cannot resurrect it. */
	private dropWatchedDocument(document: Document): boolean {
		if (!this.documents.delete(document.id)) return false;
		this.nextContentItemGeneration("documents", document.id);
		this.nextContentItemVersion("documents", document.id, this.currentRoot());
		return true;
	}

	/**
	 * Publishes one watched file. Returns true when the publish landed on a path the store did not
	 * hold while an equivalent ID still sits at another path: the file may have been renamed and
	 * respelled at once with only the destination event delivered, and no path identifies what it
	 * vacated. Only a full refresh can settle that without guessing which entry it was.
	 */
	private publishWatchedDocument(document: Document, replacedPath?: string): boolean {
		// A respelled frontmatter ID rekeys the entry, so drop the one this file used to occupy.
		const replaced = this.findWatchedDocumentByPath(replacedPath) ?? this.findWatchedDocumentByPath(document.path);
		if (replaced && replaced.id !== document.id) this.dropWatchedDocument(replaced);
		this.nextContentItemGeneration("documents", document.id);
		this.nextContentItemVersion("documents", document.id, this.currentRoot());
		this.documents.set(document.id, document);
		this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
		this.notify("documents");
		if (replaced) return false;
		return this.cachedDocuments.some(
			(candidate) => candidate.path !== document.path && documentIdsEqual(candidate.id, document.id),
		);
	}

	private removeWatchedDocument(path: string): void {
		const existing = this.findWatchedDocumentByPath(path);
		if (!existing || !this.dropWatchedDocument(existing)) return;
		this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
		this.notify("documents");
	}

	private publishWatchedDecision(decision: Decision): void {
		this.nextContentItemGeneration("decisions", decision.id);
		this.nextContentItemVersion("decisions", decision.id, this.currentRoot());
		this.decisions.set(decision.id, decision);
		this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
		this.notify("decisions");
	}

	private removeWatchedDecision(id: string): void {
		if (!this.decisions.delete(id)) return;
		this.nextContentItemGeneration("decisions", id);
		this.nextContentItemVersion("decisions", id, this.currentRoot());
		this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
		this.notify("decisions");
	}

	private createTaskWatcher(epoch: number): WatchHandle {
		const tasksDir = this.filesystem.tasksDir;
		const watcher: FSWatcher = watch(tasksDir, { recursive: false }, (eventType, filename) => {
			const file = this.normalizeFilename(filename);
			if (!file || !/^[a-zA-Z]+-/.test(file) || !file.endsWith(".md")) {
				void this.enqueueRoot(epoch, async () => this.refreshTasksFromDisk(undefined, epoch));
				return;
			}

			void this.enqueueRoot(epoch, async () => {
				const [taskId] = file.split(" ");
				if (!taskId) return;
				const normalizedTaskId = normalizeTaskId(taskId);
				const fullPath = join(tasksDir, file);
				if (eventType === "rename") {
					await this.reconcileRenamedItem({
						key: `task:${normalizedTaskId}`,
						epoch,
						readEventPath: async () => {
							if (!(await Bun.file(fullPath).exists())) return null;
							const task = { ...normalizeTaskIdentity(parseTask(await Bun.file(fullPath).text())), filePath: fullPath };
							return task;
						},
						findIdentity: async () => {
							const local = await this.findIdentityCandidate(
								tasksDir,
								"*.md",
								(path) => {
									const [candidateId] = basename(path).split(" ");
									return candidateId ? taskIdsEqual(candidateId, normalizedTaskId) : false;
								},
								async (candidatePath) => {
									const task = {
										...normalizeTaskIdentity(parseTask(await Bun.file(candidatePath).text())),
										filePath: candidatePath,
									};
									if (!taskIdsEqual(task.id, normalizedTaskId)) throw new Error("Task identity mismatch");
									return task;
								},
							);
							if (local.state !== "absent" || !this.taskLoader) return local;
							try {
								const matches = (await this.loadTasksWithLoader()).activeTasks.filter((task) =>
									taskIdsEqual(task.id, normalizedTaskId),
								);
								if (matches.length === 0) return { state: "absent" };
								if (matches.length !== 1) return { state: "incomplete" };
								return { state: "found", item: matches[0] as Task };
							} catch {
								return { state: "incomplete" };
							}
						},
						current: () => this.activeTasks.find((task) => task.filePath === fullPath),
						hasChanged: (previous, next) => this.hasTaskChanged(previous, next),
						publish: (task) => this.publishWatchedTask(task, fullPath),
						remove: () => this.removeWatchedTask(normalizedTaskId, fullPath),
					});
					return;
				}

				await this.reconcileOrSchedule(`task:${normalizedTaskId}`, epoch, async () => {
					if (!(await Bun.file(fullPath).exists())) {
						this.removeWatchedTask(normalizedTaskId, fullPath);
						return false;
					}
					try {
						const task = { ...normalizeTaskIdentity(parseTask(await Bun.file(fullPath).text())), filePath: fullPath };
						if (!taskIdsEqual(task.id, normalizedTaskId)) {
							this.publishWatchedTask(task);
							return false;
						}
						const previous = this.tasks.get(normalizedTaskId);
						if (previous && !this.hasTaskChanged(previous, task)) return true;
						this.publishWatchedTask(task);
						return false;
					} catch {
						return true;
					}
				});
			});
		});
		this.attachWatcherErrorHandler(watcher, "tasks");
		const completedWatcher = watch(this.filesystem.completedDir, { recursive: false }, () => {
			void this.enqueueRoot(epoch, async () => this.refreshTasksFromDisk(undefined, epoch));
		});
		this.attachWatcherErrorHandler(completedWatcher, "completed tasks");
		return {
			stop: () => {
				watcher.close();
				completedWatcher.close();
			},
		};
	}

	private createDecisionWatcher(epoch: number): WatchHandle {
		const decisionsDir = this.filesystem.decisionsDir;
		const watcher: FSWatcher = watch(decisionsDir, { recursive: false }, (eventType, filename) => {
			const file = this.normalizeFilename(filename);
			if (!file?.startsWith("decision-") || !file.endsWith(".md")) {
				void this.enqueueRoot(epoch, async () => this.refreshDecisionsFromDisk(undefined, epoch));
				return;
			}

			void this.enqueueRoot(epoch, async () => {
				const [id] = file.split(" - ");
				if (!id) return;
				const fullPath = join(decisionsDir, file);
				if (eventType === "rename") {
					await this.reconcileRenamedItem({
						key: `decision:${id}`,
						epoch,
						readEventPath: async () => {
							if (!(await Bun.file(fullPath).exists())) return null;
							const decision = { ...parseDecision(await Bun.file(fullPath).text()), path: file };
							if (decision.id !== id) throw new Error("Decision identity mismatch");
							return decision;
						},
						findIdentity: () =>
							this.findIdentityCandidate(
								decisionsDir,
								"decision-*.md",
								(path) => basename(path).split(" - ")[0] === id,
								async (candidatePath, candidateRelativePath) => {
									const decision = {
										...parseDecision(await Bun.file(candidatePath).text()),
										path: candidateRelativePath,
									};
									if (decision.id !== id) throw new Error("Decision identity mismatch");
									return decision;
								},
							),
						current: () => this.decisions.get(id),
						hasChanged: (previous, next) => this.hasDecisionChanged(previous, next),
						publish: (decision) => this.publishWatchedDecision(decision),
						remove: () => this.removeWatchedDecision(id),
					});
					return;
				}

				await this.reconcileOrSchedule(`decision:${id}`, epoch, async () => {
					if (!(await Bun.file(fullPath).exists())) {
						this.removeWatchedDecision(id);
						return false;
					}
					try {
						const decision = { ...parseDecision(await Bun.file(fullPath).text()), path: file };
						if (decision.id !== id) return true;
						const previous = this.decisions.get(id);
						if (previous && !this.hasDecisionChanged(previous, decision)) return true;
						this.publishWatchedDecision(decision);
						return false;
					} catch {
						return true;
					}
				});
			});
		});
		this.attachWatcherErrorHandler(watcher, "decisions");
		return { stop: () => watcher.close() };
	}

	private async createDocumentWatcher(epoch: number): Promise<WatchHandle> {
		const docsDir = this.filesystem.docsDir;
		return this.createDirectoryWatcher(docsDir, epoch, async (eventType, absolutePath, relativePath) => {
			if (!this.isRootWatcherCurrent(epoch)) return;
			const base = basename(absolutePath);
			if (!base.endsWith(".md")) {
				if (relativePath === null) await this.refreshDocumentsFromDisk(undefined, epoch);
				return;
			}
			const id = documentFilenameId(base);
			const eventPath = watchedDocumentPath(docsDir, absolutePath, relativePath);
			if (!id || !eventPath) {
				await this.refreshDocumentsFromDisk(undefined, epoch);
				return;
			}

			let strandedEquivalent = false;
			if (eventType === "rename") {
				await this.reconcileRenamedItem({
					key: `document:${id}`,
					epoch,
					readEventPath: async () => {
						if (!(await Bun.file(absolutePath).exists())) return null;
						const document = { ...parseDocument(await Bun.file(absolutePath).text()), path: eventPath };
						if (!documentIdsEqual(document.id, id)) throw new Error("Document identity mismatch");
						return document;
					},
					findIdentity: () =>
						this.findIdentityCandidate(
							docsDir,
							"**/*.md",
							(path) => {
								const candidateId = documentFilenameId(path);
								return candidateId ? documentIdsEqual(candidateId, id) : false;
							},
							async (candidatePath, candidateRelativePath) => {
								const document = {
									...parseDocument(await Bun.file(candidatePath).text()),
									path: normalizeDocumentRelativePath(candidateRelativePath),
								};
								if (!documentIdsEqual(document.id, id)) throw new Error("Document identity mismatch");
								return document;
							},
						),
					current: () => this.findWatchedDocumentByPath(eventPath),
					hasChanged: (previous, next) => this.hasDocumentChanged(previous, next),
					publish: (document) => {
						strandedEquivalent = this.publishWatchedDocument(document, eventPath);
					},
					remove: () => this.removeWatchedDocument(eventPath),
				});
				if (strandedEquivalent) await this.refreshDocumentsFromDisk(undefined, epoch);
				return;
			}

			await this.reconcileOrSchedule(`document:${id}`, epoch, async () => {
				if (!(await Bun.file(absolutePath).exists())) {
					this.removeWatchedDocument(eventPath);
					return false;
				}
				try {
					const document = { ...parseDocument(await Bun.file(absolutePath).text()), path: eventPath };
					if (!documentIdsEqual(document.id, id)) return true;
					const previous = this.findWatchedDocumentByPath(eventPath);
					if (previous && !this.hasDocumentChanged(previous, document)) return true;
					strandedEquivalent = this.publishWatchedDocument(document, eventPath);
					return false;
				} catch {
					return true;
				}
			});
			if (strandedEquivalent) await this.refreshDocumentsFromDisk(undefined, epoch);
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

	private replaceVisibleTasks(tasks: Task[]): void {
		this.tasks.clear();
		for (const task of tasks) this.tasks.set(task.id, task);
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
	}

	private asTaskCorpus(tasks: Task[]): TaskCorpusSnapshot {
		return { tasks, activeTasks: tasks, completedTasks: [] };
	}

	private installTaskCorpus(corpus: TaskCorpusSnapshot, visibleTasks = corpus.tasks): void {
		this.invalidateContentItemGenerations("tasks");
		this.activeTasks = corpus.activeTasks.slice();
		this.completedTasks = corpus.completedTasks.slice();
		this.taskIdentityIndex = corpus.identityIndex;
		this.branchTaskStateEntries = corpus.branchStateEntries?.slice() ?? [];
		this.taskCorpusConfig = corpus.config;
		this.replaceVisibleTasks(visibleTasks);
	}

	private replaceDocuments(documents: Document[]): void {
		this.invalidateContentItemGenerations("documents");
		this.documents.clear();
		for (const document of documents) {
			this.documents.set(document.id, document);
		}
		this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
	}

	private replaceDecisions(decisions: Decision[]): void {
		this.invalidateContentItemGenerations("decisions");
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

		this.filesystem.saveTask = (async (task: Task): Promise<string> => {
			const owner: PublicationOwner = { root: this.currentRoot() };
			const result = await originalSaveTask.call(this.filesystem, task);
			const savedTask = { ...normalizeTaskIdentity(parseTask(await Bun.file(result).text())), filePath: result };
			await this.updateTaskFromDisk(task.id, owner, savedTask);
			return result;
		}) as FileSystem["saveTask"];

		this.filesystem.saveDocument = (async (document: Document, subPath = "") => {
			const owner: PublicationOwner = { root: this.currentRoot() };
			const result = await originalSaveDocument.call(this.filesystem, document, subPath);
			await this.handleDocumentWrite(document.id, owner);
			return result;
		}) as FileSystem["saveDocument"];

		this.filesystem.saveDecision = (async (
			decision: Decision,
		): Promise<{ filepath: string; removedFilepaths: string[] }> => {
			const owner: PublicationOwner = { root: this.currentRoot() };
			const result = await originalSaveDecision.call(this.filesystem, decision);
			await this.handleDecisionWrite(decision.id, owner);
			return result;
		}) as FileSystem["saveDecision"];

		this.restoreFilesystemPatch = () => {
			this.filesystem.saveTask = originalSaveTask;
			this.filesystem.saveDocument = originalSaveDocument;
			this.filesystem.saveDecision = originalSaveDecision;
		};
	}

	private async handleDocumentWrite(documentId: string, owner: PublicationOwner): Promise<void> {
		if (!this.canPublishContent() || !this.isPublicationOwnerCurrent(owner)) {
			return;
		}
		await this.enqueuePublication(owner, async () => {
			await this.updateDocumentFromDisk(documentId, owner);
		});
	}

	private hasTaskChanged(previous: Task, next: Task): boolean {
		const { lastModified: _previousLastModified, source: _previousSource, ...previousState } = previous;
		const { lastModified: _nextLastModified, source: _nextSource, ...nextState } = next;
		return JSON.stringify(previousState) !== JSON.stringify(nextState);
	}

	private hasDocumentChanged(previous: Document, next: Document): boolean {
		return JSON.stringify(previous) !== JSON.stringify(next);
	}

	private hasDecisionChanged(previous: Decision, next: Decision): boolean {
		return JSON.stringify(previous) !== JSON.stringify(next);
	}

	private hasCollectionChanged<T>(
		current: readonly T[],
		next: readonly T[],
		hasItemChanged: (previous: T, next: T) => boolean,
	): boolean {
		if (current.length !== next.length) return true;
		return next.some((item, index) => {
			const previous = current[index];
			return !previous || hasItemChanged(previous, item);
		});
	}

	private async reconcileOrSchedule(key: string, epoch: number, reconcile: () => Promise<boolean>): Promise<void> {
		if (!this.isRootWatcherCurrent(epoch)) return;
		let shouldRetry = true;
		try {
			shouldRetry = await reconcile();
		} catch {}
		if (!this.isRootWatcherCurrent(epoch)) return;
		if (!shouldRetry) {
			this.cancelDeferredRecheck(key);
			return;
		}
		this.scheduleDeferredRecheck(key, epoch, reconcile);
	}

	private async reconcileRenamedItem<T>(options: RenameReconciliation<T>): Promise<void> {
		await this.reconcileOrSchedule(options.key, options.epoch, async () => {
			let lookup: IdentityLookup<T>;
			try {
				const eventItem = await options.readEventPath();
				lookup = eventItem ? { state: "found", item: eventItem } : await options.findIdentity();
			} catch {
				return true;
			}
			if (!this.isRootWatcherCurrent(options.epoch)) return false;
			if (lookup.state === "incomplete") return true;
			if (lookup.state === "found") {
				const previous = options.current();
				if (!previous || options.hasChanged(previous, lookup.item)) options.publish(lookup.item);
				return false;
			}
			options.remove();
			return false;
		});
	}

	private async findIdentityCandidate<T>(
		rootDir: string,
		pattern: string,
		matchesIdentity: (relativePath: string) => boolean,
		readCandidate: (absolutePath: string, relativePath: string) => Promise<T>,
	): Promise<IdentityLookup<T>> {
		let relativePaths: string[];
		try {
			const root = await stat(rootDir);
			if (!root.isDirectory()) return { state: "incomplete" };
			relativePaths = await Array.fromAsync(new Bun.Glob(pattern).scan({ cwd: rootDir, followSymlinks: true }));
			await stat(rootDir);
		} catch {
			return { state: "incomplete" };
		}
		const candidates = relativePaths.filter(matchesIdentity);
		if (candidates.length === 0) return { state: "absent" };
		if (candidates.length !== 1) return { state: "incomplete" };
		const relativePath = candidates[0];
		if (!relativePath) return { state: "incomplete" };
		try {
			return {
				state: "found",
				item: await readCandidate(join(rootDir, ...relativePath.split("/")), relativePath),
			};
		} catch {
			return { state: "incomplete" };
		}
	}

	private scheduleDeferredRecheck(key: string, epoch: number, reconcile: () => Promise<boolean>): void {
		const existing = this.deferredRechecks.get(key);
		if (existing?.epoch === epoch) {
			if (existing.attempt > 1 && !existing.budgetRefreshed) {
				if (existing.timer) clearTimeout(existing.timer);
				const refreshed: DeferredRecheck = {
					epoch,
					attempt: 1,
					budgetRefreshed: true,
					timer: null,
					reconcile,
				};
				this.deferredRechecks.set(key, refreshed);
				this.armDeferredRecheck(key, refreshed);
				return;
			}
			existing.reconcile = reconcile;
			return;
		}
		if (existing) this.cancelDeferredRecheck(key);
		const recheck: DeferredRecheck = {
			epoch,
			attempt: 1,
			budgetRefreshed: false,
			timer: null,
			reconcile,
		};
		this.deferredRechecks.set(key, recheck);
		this.armDeferredRecheck(key, recheck);
	}

	private armDeferredRecheck(key: string, recheck: DeferredRecheck): void {
		if (recheck.attempt >= CONTENT_RETRY_ATTEMPTS || !this.isRootWatcherCurrent(recheck.epoch)) {
			if (this.deferredRechecks.get(key) === recheck) this.deferredRechecks.delete(key);
			return;
		}
		recheck.timer = this.startDeferredTimer(() => {
			recheck.timer = null;
			void this.enqueueRoot(recheck.epoch, async () => {
				if (this.deferredRechecks.get(key) !== recheck) return;
				let shouldRetry = true;
				try {
					shouldRetry = await recheck.reconcile();
				} catch {}
				if (this.deferredRechecks.get(key) !== recheck || !this.isRootWatcherCurrent(recheck.epoch)) return;
				if (!shouldRetry) {
					this.deferredRechecks.delete(key);
					return;
				}
				recheck.attempt += 1;
				this.armDeferredRecheck(key, recheck);
			}).catch((error) => {
				if (process.env.DEBUG) console.error("ContentStore deferred recheck failed", error);
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
		if (!recheck) return;
		if (recheck.timer) clearTimeout(recheck.timer);
		this.deferredRechecks.delete(key);
	}

	private clearDeferredRechecks(): void {
		for (const recheck of this.deferredRechecks.values()) {
			if (recheck.timer) clearTimeout(recheck.timer);
		}
		this.deferredRechecks.clear();
	}

	private async refreshTasksFromDisk(expectedId?: string, epoch = this.rootWatcherEpoch): Promise<void> {
		const normalizedExpectedId = expectedId ? normalizeTaskId(expectedId) : "*";
		await this.reconcileOrSchedule(`task:${normalizedExpectedId}`, epoch, async () => {
			const targetRoot = this.currentRoot();
			const generation = this.nextContentRefreshGeneration("tasks");
			const before = {
				items: this.cachedTasks.slice(),
				versions: new Map(this.contentItemVersions.tasks),
			};
			let corpus: TaskCorpusSnapshot;
			try {
				const loaded = await this.loadTasksWithLoader();
				corpus = Array.isArray(loaded) ? this.asTaskCorpus(loaded) : loaded;
			} catch {
				return true;
			}
			if (expectedId && !corpus.activeTasks.some((task) => taskIdsEqual(task.id, expectedId))) return true;
			if (
				!this.isRootWatcherCurrent(epoch) ||
				targetRoot !== this.currentRoot() ||
				!this.isContentRefreshCurrent("tasks", generation)
			)
				return false;
			const reconciledCorpus = this.mergeConcurrentWorkingCopyCorpus(corpus, before.versions, targetRoot);
			const merged = this.mergeConcurrentChanges(
				reconciledCorpus.tasks,
				before.items,
				this.cachedTasks,
				(task) => normalizeTaskId(task.id),
				before.versions,
				this.contentItemVersions.tasks,
				this.contentItemPublicationRoots.tasks,
				targetRoot,
			);
			const visibleChanged = this.hasTaskCollectionChanged(merged);
			const identityChanged =
				this.taskIdentityIndex?.getFingerprint() !== reconciledCorpus.identityIndex?.getFingerprint();
			const corpusChanged =
				this.hasTaskListChanged(this.activeTasks, reconciledCorpus.activeTasks) ||
				this.hasTaskListChanged(this.completedTasks, reconciledCorpus.completedTasks) ||
				this.hasBranchTaskStateChanged(reconciledCorpus.branchStateEntries ?? []) ||
				JSON.stringify(this.taskCorpusConfig) !== JSON.stringify(reconciledCorpus.config);
			if (!visibleChanged && !identityChanged && !corpusChanged) return false;
			this.installTaskCorpus(reconciledCorpus, merged);
			this.notify("tasks");
			return false;
		});
	}

	private async refreshDocumentsFromDisk(expectedId?: string, epoch = this.rootWatcherEpoch): Promise<void> {
		await this.reconcileOrSchedule(`document:${expectedId ?? "*"}`, epoch, async () => {
			const targetRoot = this.currentRoot();
			const generation = this.nextContentRefreshGeneration("documents");
			const before = { items: this.cachedDocuments.slice(), versions: new Map(this.contentItemVersions.documents) };
			let documents: Document[];
			try {
				documents = await this.filesystem.listDocuments();
			} catch {
				return true;
			}
			if (expectedId && !documents.some((document) => document.id === expectedId)) return true;
			if (
				!this.isRootWatcherCurrent(epoch) ||
				targetRoot !== this.currentRoot() ||
				!this.isContentRefreshCurrent("documents", generation)
			)
				return false;
			const merged = this.mergeConcurrentChanges(
				documents,
				before.items,
				this.cachedDocuments,
				(document) => document.id,
				before.versions,
				this.contentItemVersions.documents,
				this.contentItemPublicationRoots.documents,
				targetRoot,
			);
			const sorted = [...merged].sort((a, b) => a.title.localeCompare(b.title));
			if (!this.hasCollectionChanged(this.cachedDocuments, sorted, (a, b) => this.hasDocumentChanged(a, b)))
				return false;
			this.replaceDocuments(merged);
			this.notify("documents");
			return false;
		});
	}

	private async refreshDecisionsFromDisk(expectedId?: string, epoch = this.rootWatcherEpoch): Promise<void> {
		await this.reconcileOrSchedule(`decision:${expectedId ?? "*"}`, epoch, async () => {
			const targetRoot = this.currentRoot();
			const generation = this.nextContentRefreshGeneration("decisions");
			const before = { items: this.cachedDecisions.slice(), versions: new Map(this.contentItemVersions.decisions) };
			let decisions: Decision[];
			try {
				decisions = await this.filesystem.listDecisions();
			} catch {
				return true;
			}
			if (expectedId && !decisions.some((decision) => decision.id === expectedId)) return true;
			if (
				!this.isRootWatcherCurrent(epoch) ||
				targetRoot !== this.currentRoot() ||
				!this.isContentRefreshCurrent("decisions", generation)
			)
				return false;
			const merged = this.mergeConcurrentChanges(
				decisions,
				before.items,
				this.cachedDecisions,
				(decision) => decision.id,
				before.versions,
				this.contentItemVersions.decisions,
				this.contentItemPublicationRoots.decisions,
				targetRoot,
			);
			const sorted = sortByTaskId(merged);
			if (!this.hasCollectionChanged(this.cachedDecisions, sorted, (a, b) => this.hasDecisionChanged(a, b)))
				return false;
			this.replaceDecisions(merged);
			this.notify("decisions");
			return false;
		});
	}

	private mergeConcurrentTaskCorpus(
		loaded: Task[],
		current: Task[],
		versionsBeforeLoad: ReadonlyMap<string, number>,
		targetRoot: string,
	): Task[] {
		const changedIds = new Set<string>();
		for (const [id, version] of this.contentItemVersions.tasks) {
			if (version !== versionsBeforeLoad.get(id) && this.contentItemPublicationRoots.tasks.get(id) === targetRoot) {
				changedIds.add(id);
			}
		}
		if (changedIds.size === 0) return loaded;
		return [
			...loaded.filter((task) => !changedIds.has(normalizeTaskId(task.id))),
			...current.filter((task) => changedIds.has(normalizeTaskId(task.id))),
		];
	}

	private mergeConcurrentWorkingCopyCorpus(
		loaded: TaskCorpusSnapshot,
		beforeVersions: ReadonlyMap<string, number>,
		targetRoot: string,
	): TaskCorpusSnapshot {
		const { activeTasks, completedTasks } = this.mergeConcurrentWorkingCopyTasks(
			loaded.activeTasks,
			loaded.completedTasks,
			beforeVersions,
			targetRoot,
		);
		const identityIndex = loaded.identityIndex?.withWorkingCopyCorpus(activeTasks, completedTasks);
		return {
			...loaded,
			activeTasks,
			completedTasks,
			identityIndex,
			tasks: identityIndex ? identityIndex.getTasks(false) : activeTasks,
		};
	}

	private mergeConcurrentWorkingCopyTasks(
		loadedActiveTasks: Task[],
		loadedCompletedTasks: Task[],
		beforeVersions: ReadonlyMap<string, number>,
		targetRoot: string,
	): { activeTasks: Task[]; completedTasks: Task[] } {
		const activeTasks = this.mergeConcurrentTaskCorpus(loadedActiveTasks, this.activeTasks, beforeVersions, targetRoot);
		const completedTasks = this.mergeConcurrentTaskCorpus(
			loadedCompletedTasks,
			this.completedTasks,
			beforeVersions,
			targetRoot,
		);
		return { activeTasks, completedTasks };
	}

	private mergeConcurrentChanges<T>(
		loaded: T[],
		before: T[],
		current: T[],
		getId: (item: T) => string,
		beforeVersions: ReadonlyMap<string, number>,
		currentVersions: ReadonlyMap<string, number>,
		currentPublicationRoots: ReadonlyMap<string, string>,
		targetRoot: string,
	): T[] {
		const merged = new Map(loaded.map((item) => [getId(item), item]));
		const beforeById = new Map(before.map((item) => [getId(item), item]));
		const currentById = new Map(current.map((item) => [getId(item), item]));

		for (const [id] of beforeById) {
			if (beforeVersions.get(id) === currentVersions.get(id)) {
				continue;
			}
			if (currentPublicationRoots.get(id) !== targetRoot) {
				continue;
			}
			const currentItem = currentById.get(id);
			if (!currentItem) {
				merged.delete(id);
				continue;
			}
			merged.set(id, currentItem);
		}
		for (const [id, currentItem] of currentById) {
			if (
				!beforeById.has(id) &&
				beforeVersions.get(id) !== currentVersions.get(id) &&
				currentPublicationRoots.get(id) === targetRoot
			) {
				merged.set(id, currentItem);
			}
		}

		return [...merged.values()];
	}

	private hasTaskCollectionChanged(nextTasks: Task[]): boolean {
		return this.hasTaskListChanged(this.cachedTasks, nextTasks);
	}

	private hasTaskListChanged(currentTasks: Task[], nextTasks: Task[]): boolean {
		const current = sortByTaskId(currentTasks);
		const next = sortByTaskId(nextTasks);
		if (current.length !== next.length) return true;
		return next.some((task, index) => {
			const previous = current[index];
			return !previous || this.hasTaskChanged(previous, task);
		});
	}

	private needsBranchFallbackHydration(activeTasks: Task[], completedTasks: Task[]): boolean {
		if (!this.taskLoader || this.branchTaskStateEntries.length === 0) return false;
		const identity = (id: string, path: string | undefined): string | null => {
			if (!path) return null;
			const projectPath = isAbsolute(path) ? relative(this.filesystem.rootDir, path) : path;
			return `${canonicalTaskId(id)}\0${normalizeTaskLifecyclePath(
				projectPath.replaceAll("\\", "/"),
				this.filesystem.backlogDirName,
			)}`;
		};
		const nextIdentities = new Set(
			[...activeTasks, ...completedTasks].flatMap((task) => {
				const value = identity(task.id, task.filePath);
				return value ? [value] : [];
			}),
		);
		const removedIdentities = new Set(
			[...this.activeTasks, ...this.completedTasks].flatMap((task) => {
				const value = identity(task.id, task.filePath);
				return value && !nextIdentities.has(value) ? [value] : [];
			}),
		);
		if (removedIdentities.size === 0) return false;
		return this.branchTaskStateEntries.some((entry) => {
			if (entry.task || (entry.type !== "task" && entry.type !== "completed")) return false;
			const value = identity(entry.id, entry.path);
			return value !== null && removedIdentities.has(value);
		});
	}

	private hasBranchTaskStateChanged(nextEntries: BranchTaskStateEntry[]): boolean {
		const serialize = (entries: BranchTaskStateEntry[]) =>
			entries
				.map((entry) =>
					JSON.stringify({
						...entry,
						lastModified: entry.lastModified.toISOString(),
					}),
				)
				.sort((left, right) => left.localeCompare(right));
		return JSON.stringify(serialize(this.branchTaskStateEntries)) !== JSON.stringify(serialize(nextEntries));
	}

	private async handleDecisionWrite(decisionId: string, owner: PublicationOwner): Promise<void> {
		if (!this.canPublishContent() || !this.isPublicationOwnerCurrent(owner)) {
			return;
		}
		await this.enqueuePublication(owner, async () => {
			await this.updateDecisionFromDisk(decisionId, owner);
		});
	}

	private async updateTaskFromDisk(
		taskId: string,
		owner: PublicationOwner = { root: this.currentRoot() },
		exactTask?: Task,
	): Promise<void> {
		if (!this.canPublishContent() || !this.isPublicationOwnerCurrent(owner)) return;
		const normalizedTaskId = normalizeTaskId(taskId);
		const epoch = this.rootWatcherEpoch;
		await this.reconcileOrSchedule(`task:${normalizedTaskId}`, epoch, async () => {
			let task: Task | null | undefined = exactTask;
			if (!task) {
				try {
					task = await this.filesystem.loadTask(taskId);
				} catch {
					return true;
				}
			}
			if (!task || !taskIdsEqual(task.id, normalizedTaskId)) return true;
			this.upsertTask(task, owner);
			return false;
		});
	}

	private async updateDocumentFromDisk(
		documentId: string,
		owner: PublicationOwner = { root: this.currentRoot() },
	): Promise<void> {
		const generation = this.nextContentItemGeneration("documents", documentId);
		const epoch = this.rootWatcherEpoch;
		await this.reconcileOrSchedule(`document:${documentId}`, epoch, async () => {
			if (
				!this.isPublicationOwnerCurrent(owner) ||
				!this.isContentItemGenerationCurrent("documents", documentId, generation)
			)
				return false;
			let document: Document;
			try {
				document = await this.filesystem.loadDocument(documentId);
			} catch {
				return true;
			}
			const previous = this.documents.get(documentId);
			if (previous && !this.hasDocumentChanged(previous, document)) return false;
			if (
				!this.isPublicationOwnerCurrent(owner) ||
				!this.isContentItemGenerationCurrent("documents", documentId, generation)
			)
				return false;
			this.nextContentItemVersion("documents", documentId, owner.root);
			this.documents.set(document.id, document);
			this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
			if (this.initialized) this.notify("documents");
			return false;
		});
	}

	private async updateDecisionFromDisk(
		decisionId: string,
		owner: PublicationOwner = { root: this.currentRoot() },
	): Promise<void> {
		const generation = this.nextContentItemGeneration("decisions", decisionId);
		const epoch = this.rootWatcherEpoch;
		await this.reconcileOrSchedule(`decision:${decisionId}`, epoch, async () => {
			if (
				!this.isPublicationOwnerCurrent(owner) ||
				!this.isContentItemGenerationCurrent("decisions", decisionId, generation)
			)
				return false;
			let decision: Decision | null;
			try {
				decision = await this.filesystem.loadDecision(decisionId);
			} catch {
				return true;
			}
			if (!decision || decision.id !== decisionId) return true;
			const previous = this.decisions.get(decisionId);
			if (previous && !this.hasDecisionChanged(previous, decision)) return false;
			if (
				!this.isPublicationOwnerCurrent(owner) ||
				!this.isContentItemGenerationCurrent("decisions", decisionId, generation)
			)
				return false;
			this.nextContentItemVersion("decisions", decisionId, owner.root);
			this.decisions.set(decision.id, decision);
			this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
			if (this.initialized) this.notify("decisions");
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

	private enqueuePublication(owner: PublicationOwner, fn: () => Promise<void>): Promise<void> {
		return this.enqueue(async () => {
			if (!this.isPublicationOwnerCurrent(owner)) return;
			await fn();
		});
	}

	private async loadTasksWithLoader(progressCallback?: ProgressCallback): Promise<TaskCorpusSnapshot> {
		if (this.taskLoader) {
			const loaded = await this.taskLoader(progressCallback);
			return Array.isArray(loaded) ? this.asTaskCorpus(loaded) : loaded;
		}
		return this.asTaskCorpus(await this.filesystem.listTasks());
	}
}

export type { ContentSnapshot };
