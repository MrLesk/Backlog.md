import { type FSWatcher, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
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
		this.tasks.set(task.id, task);
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
		if (this.initialized) {
			this.notify("tasks");
		}
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

	private async loadInitialData(): Promise<void> {
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
			const attemptLoaded = await this.loadCurrentContent(epoch, (snapshot) => {
				this.replaceTasks(snapshot.tasks);
				this.replaceDocuments(snapshot.documents);
				this.replaceDecisions(snapshot.decisions);
			});
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
				this.replaceTasks(snapshot.tasks);
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

	private async loadCurrentContent(epoch: number, publish: (snapshot: ContentSnapshot) => void): Promise<boolean> {
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
		const [tasks, documents, decisions] = await Promise.all([
			this.loadTasksWithLoader(),
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

		publish({
			tasks: this.mergeConcurrentChanges(
				tasks,
				before.tasks,
				this.tasksForPublicationRoot(targetRoot),
				(task) => normalizeTaskId(task.id),
				itemVersions.tasks,
				this.contentItemVersions.tasks,
				this.contentItemPublicationRoots.tasks,
				targetRoot,
			),
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

	private publishWatchedTask(task: Task): void {
		const id = normalizeTaskId(task.id);
		this.nextContentItemGeneration("tasks", id);
		this.nextContentItemVersion("tasks", id, this.currentRoot());
		this.tasks.set(id, task);
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
		this.notify("tasks");
	}

	private removeWatchedTask(id: string): void {
		const normalizedId = normalizeTaskId(id);
		if (!this.tasks.delete(normalizedId)) return;
		this.nextContentItemGeneration("tasks", normalizedId);
		this.nextContentItemVersion("tasks", normalizedId, this.currentRoot());
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
		this.notify("tasks");
	}

	private publishWatchedDocument(document: Document): void {
		this.nextContentItemGeneration("documents", document.id);
		this.nextContentItemVersion("documents", document.id, this.currentRoot());
		this.documents.set(document.id, document);
		this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
		this.notify("documents");
	}

	private removeWatchedDocument(id: string): void {
		if (!this.documents.delete(id)) return;
		this.nextContentItemGeneration("documents", id);
		this.nextContentItemVersion("documents", id, this.currentRoot());
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
							if (!taskIdsEqual(task.id, normalizedTaskId)) throw new Error("Task identity mismatch");
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
								const matches = (await this.loadTasksWithLoader()).filter((task) =>
									taskIdsEqual(task.id, normalizedTaskId),
								);
								if (matches.length === 0) return { state: "absent" };
								if (matches.length !== 1) return { state: "incomplete" };
								return { state: "found", item: matches[0] as Task };
							} catch {
								return { state: "incomplete" };
							}
						},
						current: () => this.tasks.get(normalizedTaskId),
						hasChanged: (previous, next) => this.hasTaskChanged(previous, next),
						publish: (task) => this.publishWatchedTask(task),
						remove: () => this.removeWatchedTask(normalizedTaskId),
					});
					return;
				}

				await this.reconcileOrSchedule(`task:${normalizedTaskId}`, epoch, async () => {
					if (!(await Bun.file(fullPath).exists())) {
						this.removeWatchedTask(normalizedTaskId);
						return false;
					}
					try {
						const task = { ...normalizeTaskIdentity(parseTask(await Bun.file(fullPath).text())), filePath: fullPath };
						if (!taskIdsEqual(task.id, normalizedTaskId)) return true;
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
		return { stop: () => watcher.close() };
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
							const decision = parseDecision(await Bun.file(fullPath).text());
							if (decision.id !== id) throw new Error("Decision identity mismatch");
							return decision;
						},
						findIdentity: () =>
							this.findIdentityCandidate(
								decisionsDir,
								"decision-*.md",
								(path) => basename(path).split(" - ")[0] === id,
								async (candidatePath) => {
									const decision = parseDecision(await Bun.file(candidatePath).text());
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
						const decision = parseDecision(await Bun.file(fullPath).text());
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
			if (!base.startsWith("doc-")) {
				await this.refreshDocumentsFromDisk(undefined, epoch);
				return;
			}
			const [id] = base.split(" - ");
			if (!id) {
				await this.refreshDocumentsFromDisk(undefined, epoch);
				return;
			}

			if (eventType === "rename") {
				await this.reconcileRenamedItem({
					key: `document:${id}`,
					epoch,
					readEventPath: async () => {
						if (!(await Bun.file(absolutePath).exists())) return null;
						const document = {
							...parseDocument(await Bun.file(absolutePath).text()),
							path: normalizeDocumentRelativePath(relativePath ?? relative(docsDir, absolutePath)),
						};
						if (document.id !== id) throw new Error("Document identity mismatch");
						return document;
					},
					findIdentity: () =>
						this.findIdentityCandidate(
							docsDir,
							"**/*.md",
							(path) => basename(path).split(" - ")[0] === id,
							async (candidatePath, candidateRelativePath) => {
								const document = {
									...parseDocument(await Bun.file(candidatePath).text()),
									path: normalizeDocumentRelativePath(candidateRelativePath),
								};
								if (document.id !== id) throw new Error("Document identity mismatch");
								return document;
							},
						),
					current: () => this.documents.get(id),
					hasChanged: (previous, next) => this.hasDocumentChanged(previous, next),
					publish: (document) => this.publishWatchedDocument(document),
					remove: () => this.removeWatchedDocument(id),
				});
				return;
			}

			await this.reconcileOrSchedule(`document:${id}`, epoch, async () => {
				if (!(await Bun.file(absolutePath).exists())) {
					this.removeWatchedDocument(id);
					return false;
				}
				try {
					const document = {
						...parseDocument(await Bun.file(absolutePath).text()),
						path: normalizeDocumentRelativePath(relativePath ?? relative(docsDir, absolutePath)),
					};
					if (document.id !== id) return true;
					const previous = this.documents.get(id);
					if (previous && !this.hasDocumentChanged(previous, document)) return true;
					this.publishWatchedDocument(document);
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
		this.invalidateContentItemGenerations("tasks");
		this.tasks.clear();
		for (const task of tasks) {
			this.tasks.set(task.id, task);
		}
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
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
			await this.handleTaskWrite(task.id, owner);
			return result;
		}) as FileSystem["saveTask"];

		this.filesystem.saveDocument = (async (document: Document, subPath = ""): Promise<string> => {
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

	private async handleTaskWrite(taskId: string, owner: PublicationOwner): Promise<void> {
		if (!this.canPublishContent() || !this.isPublicationOwnerCurrent(owner)) {
			return;
		}
		await this.enqueuePublication(owner, async () => {
			await this.updateTaskFromDisk(taskId, owner);
		});
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
		return JSON.stringify(previous) !== JSON.stringify(next);
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
			const before = { items: this.cachedTasks.slice(), versions: new Map(this.contentItemVersions.tasks) };
			let tasks: Task[];
			try {
				tasks = await this.loadTasksWithLoader();
			} catch {
				return true;
			}
			if (expectedId && !tasks.some((task) => taskIdsEqual(task.id, expectedId))) return true;
			if (
				!this.isRootWatcherCurrent(epoch) ||
				targetRoot !== this.currentRoot() ||
				!this.isContentRefreshCurrent("tasks", generation)
			)
				return false;
			const merged = this.mergeConcurrentChanges(
				tasks,
				before.items,
				this.cachedTasks,
				(task) => normalizeTaskId(task.id),
				before.versions,
				this.contentItemVersions.tasks,
				this.contentItemPublicationRoots.tasks,
				targetRoot,
			);
			if (!this.hasTaskCollectionChanged(merged)) return false;
			this.replaceTasks(merged);
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
		const nextCachedTasks = sortByTaskId(nextTasks);
		if (this.cachedTasks.length !== nextCachedTasks.length) {
			return true;
		}

		return nextCachedTasks.some((task, index) => {
			const previous = this.cachedTasks[index];
			return !previous || this.hasTaskChanged(previous, task);
		});
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
	): Promise<void> {
		const normalizedTaskId = normalizeTaskId(taskId);
		const generation = this.nextContentItemGeneration("tasks", normalizedTaskId);
		const epoch = this.rootWatcherEpoch;
		await this.reconcileOrSchedule(`task:${normalizedTaskId}`, epoch, async () => {
			if (
				!this.isPublicationOwnerCurrent(owner) ||
				!this.isContentItemGenerationCurrent("tasks", normalizedTaskId, generation)
			)
				return false;
			let task: Task | null;
			try {
				task = await this.filesystem.loadTask(taskId);
			} catch {
				return true;
			}
			if (!task || !taskIdsEqual(task.id, normalizedTaskId)) return true;
			const previous = this.tasks.get(normalizedTaskId);
			if (previous && !this.hasTaskChanged(previous, task)) return false;
			if (
				!this.isPublicationOwnerCurrent(owner) ||
				!this.isContentItemGenerationCurrent("tasks", normalizedTaskId, generation)
			)
				return false;
			this.nextContentItemVersion("tasks", normalizedTaskId, owner.root);
			this.tasks.set(normalizedTaskId, task);
			this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
			if (this.initialized) this.notify("tasks");
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

	private async loadTasksWithLoader(): Promise<Task[]> {
		if (this.taskLoader) {
			return await this.taskLoader();
		}
		return await this.filesystem.listTasks();
	}
}

export type { ContentSnapshot };
