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
	private boundBacklogDir: string | null = null;
	private closed = false;

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
			await this.refreshTasksFromDisk(undefined, undefined, epoch);
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
		const previous = this.tasks.get(task.id);
		if (previous && !this.hasTaskChanged(previous, task)) {
			return;
		}
		this.nextContentItemGeneration("tasks", normalizeTaskId(task.id));
		this.nextContentItemVersion("tasks", normalizeTaskId(task.id));
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
		const loaded = await this.loadCurrentContent(this.rootWatcherEpoch, (snapshot) => {
			this.replaceTasks(snapshot.tasks);
			this.replaceDocuments(snapshot.documents);
			this.replaceDecisions(snapshot.decisions);
		});
		if (!loaded) return;

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

	private nextContentItemVersion(collection: ContentCollection, id: string): number {
		const versions = this.contentItemVersions[collection];
		const version = (versions.get(id) ?? 0) + 1;
		versions.set(id, version);
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
				this.cachedTasks,
				(task) => normalizeTaskId(task.id),
				itemVersions.tasks,
				this.contentItemVersions.tasks,
			),
			documents: this.mergeConcurrentChanges(
				documents,
				before.documents,
				this.cachedDocuments,
				(document) => document.id,
				itemVersions.documents,
				this.contentItemVersions.documents,
			),
			decisions: this.mergeConcurrentChanges(
				decisions,
				before.decisions,
				this.cachedDecisions,
				(decision) => decision.id,
				itemVersions.decisions,
				this.contentItemVersions.decisions,
			),
		});
		return true;
	}

	private async loadCurrentCollection<T, S>(
		collection: ContentCollection,
		epoch: number,
		loader: () => Promise<T>,
		isValid: (result: T) => boolean,
		capture: () => S,
		reconcile: (result: T, before: S) => T,
		publish: (result: T) => boolean,
	): Promise<boolean | null> {
		const generation = this.nextContentRefreshGeneration(collection);
		const before = capture();
		const result = await this.retryRead(loader, isValid, 12, 75, () => {
			return this.isRootWatcherCurrent(epoch) && this.isContentRefreshCurrent(collection, generation);
		});
		if (result === null || !this.isRootWatcherCurrent(epoch) || !this.isContentRefreshCurrent(collection, generation)) {
			return null;
		}

		return publish(reconcile(result, before));
	}

	private createTaskWatcher(epoch: number): WatchHandle {
		const tasksDir = this.filesystem.tasksDir;
		const watcher: FSWatcher = watch(tasksDir, { recursive: false }, (eventType, filename) => {
			const file = this.normalizeFilename(filename);
			// Accept any prefix pattern (task-, jira-, etc.) followed by ID and ending in .md
			if (!file || !/^[a-zA-Z]+-/.test(file) || !file.endsWith(".md")) {
				this.enqueueRoot(epoch, async () => {
					await this.refreshTasksFromDisk(undefined, undefined, epoch);
				});
				return;
			}

			this.enqueueRoot(epoch, async () => {
				const [taskId] = file.split(" ");
				if (!taskId) return;
				const normalizedTaskId = normalizeTaskId(taskId);
				const generation = this.nextContentItemGeneration("tasks", normalizedTaskId);

				const fullPath = join(tasksDir, file);
				const exists = await Bun.file(fullPath).exists();
				if (
					!this.isRootWatcherCurrent(epoch) ||
					!this.isContentItemGenerationCurrent("tasks", normalizedTaskId, generation)
				)
					return;

				if (!exists) {
					if (this.tasks.delete(normalizedTaskId)) {
						this.nextContentItemVersion("tasks", normalizedTaskId);
						this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
						this.notify("tasks");
					}
					return;
				}

				if (eventType === "rename" && exists) {
					await this.refreshTasksFromDisk(undefined, undefined, epoch);
					return;
				}

				const previous = this.tasks.get(normalizedTaskId);
				const task = await this.retryRead(
					async () => {
						const stillExists = await Bun.file(fullPath).exists();
						if (!stillExists) {
							return null;
						}
						const content = await Bun.file(fullPath).text();
						return normalizeTaskIdentity(parseTask(content));
					},
					(result) => {
						if (!result) {
							return false;
						}
						if (!taskIdsEqual(result.id, normalizedTaskId)) {
							return false;
						}
						if (!previous) {
							return true;
						}
						return this.hasTaskChanged(previous, result);
					},
					12,
					75,
					() =>
						this.isRootWatcherCurrent(epoch) &&
						this.isContentItemGenerationCurrent("tasks", normalizedTaskId, generation),
				);
				if (
					!this.isRootWatcherCurrent(epoch) ||
					!this.isContentItemGenerationCurrent("tasks", normalizedTaskId, generation)
				)
					return;
				if (!task) {
					await this.refreshTasksFromDisk(normalizedTaskId, previous, epoch);
					return;
				}

				if (
					!this.isRootWatcherCurrent(epoch) ||
					!this.isContentItemGenerationCurrent("tasks", normalizedTaskId, generation)
				)
					return;
				this.nextContentItemVersion("tasks", normalizedTaskId);
				this.tasks.set(task.id, task);
				this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
				this.notify("tasks");
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
					await this.refreshDecisionsFromDisk(undefined, undefined, epoch);
				});
				return;
			}

			this.enqueueRoot(epoch, async () => {
				const [idPart] = file.split(" - ");
				if (!idPart) return;
				const generation = this.nextContentItemGeneration("decisions", idPart);

				const fullPath = join(decisionsDir, file);
				const exists = await Bun.file(fullPath).exists();
				if (!this.isRootWatcherCurrent(epoch) || !this.isContentItemGenerationCurrent("decisions", idPart, generation))
					return;

				if (!exists) {
					if (this.decisions.delete(idPart)) {
						this.nextContentItemVersion("decisions", idPart);
						this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
						this.notify("decisions");
					}
					return;
				}

				if (eventType === "rename" && exists) {
					await this.refreshDecisionsFromDisk(undefined, undefined, epoch);
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
					12,
					75,
					() =>
						this.isRootWatcherCurrent(epoch) && this.isContentItemGenerationCurrent("decisions", idPart, generation),
				);
				if (!this.isRootWatcherCurrent(epoch) || !this.isContentItemGenerationCurrent("decisions", idPart, generation))
					return;
				if (!decision) {
					await this.refreshDecisionsFromDisk(idPart, previous, epoch);
					return;
				}
				if (!this.isRootWatcherCurrent(epoch) || !this.isContentItemGenerationCurrent("decisions", idPart, generation))
					return;
				this.nextContentItemVersion("decisions", idPart);
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

	private async createDocumentWatcher(epoch: number): Promise<WatchHandle> {
		const docsDir = this.filesystem.docsDir;
		return this.createDirectoryWatcher(docsDir, epoch, async (eventType, absolutePath, relativePath) => {
			if (!this.isRootWatcherCurrent(epoch)) return;
			const base = basename(absolutePath);
			if (!base.endsWith(".md")) {
				if (relativePath === null) {
					await this.refreshDocumentsFromDisk(undefined, undefined, epoch);
				}
				return;
			}

			if (!base.startsWith("doc-")) {
				await this.refreshDocumentsFromDisk(undefined, undefined, epoch);
				return;
			}

			const [idPart] = base.split(" - ");
			if (!idPart) {
				await this.refreshDocumentsFromDisk(undefined, undefined, epoch);
				return;
			}
			const generation = this.nextContentItemGeneration("documents", idPart);

			const exists = await Bun.file(absolutePath).exists();
			if (!this.isRootWatcherCurrent(epoch) || !this.isContentItemGenerationCurrent("documents", idPart, generation))
				return;

			if (!exists) {
				if (this.documents.delete(idPart)) {
					this.nextContentItemVersion("documents", idPart);
					this.cachedDocuments = [...this.documents.values()].sort((a, b) => a.title.localeCompare(b.title));
					this.notify("documents");
				}
				return;
			}

			if (eventType === "rename" && exists) {
				await this.refreshDocumentsFromDisk(undefined, undefined, epoch);
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
				12,
				75,
				() => this.isRootWatcherCurrent(epoch) && this.isContentItemGenerationCurrent("documents", idPart, generation),
			);
			if (!this.isRootWatcherCurrent(epoch) || !this.isContentItemGenerationCurrent("documents", idPart, generation))
				return;
			if (!document) {
				await this.refreshDocumentsFromDisk(idPart, previous, epoch);
				return;
			}

			if (!this.isRootWatcherCurrent(epoch) || !this.isContentItemGenerationCurrent("documents", idPart, generation))
				return;
			this.nextContentItemVersion("documents", idPart);
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
			await this.refreshDocumentsFromDisk(documentId, this.documents.get(documentId), epoch);
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

	private mergeConcurrentChanges<T>(
		loaded: T[],
		before: T[],
		current: T[],
		getId: (item: T) => string,
		beforeVersions: ReadonlyMap<string, number>,
		currentVersions: ReadonlyMap<string, number>,
	): T[] {
		const merged = new Map(loaded.map((item) => [getId(item), item]));
		const beforeById = new Map(before.map((item) => [getId(item), item]));
		const currentById = new Map(current.map((item) => [getId(item), item]));

		for (const [id] of beforeById) {
			if (beforeVersions.get(id) === currentVersions.get(id)) {
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
			if (!beforeById.has(id) && beforeVersions.get(id) !== currentVersions.get(id)) {
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

	private async refreshTasksFromDisk(
		expectedId?: string,
		previous?: Task,
		epoch = this.rootWatcherEpoch,
	): Promise<void> {
		const changed = await this.loadCurrentCollection(
			"tasks",
			epoch,
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
			() => ({ items: this.cachedTasks.slice(), versions: new Map(this.contentItemVersions.tasks) }),
			(tasks, before) =>
				this.mergeConcurrentChanges(
					tasks,
					before.items,
					this.cachedTasks,
					(task) => normalizeTaskId(task.id),
					before.versions,
					this.contentItemVersions.tasks,
				),
			(tasks) => {
				if (!this.hasTaskCollectionChanged(tasks)) {
					return false;
				}
				this.replaceTasks(tasks);
				return true;
			},
		);
		if (!changed) {
			return;
		}
		this.notify("tasks");
	}

	private async refreshDocumentsFromDisk(
		expectedId?: string,
		previous?: Document,
		epoch = this.rootWatcherEpoch,
	): Promise<void> {
		const changed = await this.loadCurrentCollection(
			"documents",
			epoch,
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
			() => ({ items: this.cachedDocuments.slice(), versions: new Map(this.contentItemVersions.documents) }),
			(documents, before) =>
				this.mergeConcurrentChanges(
					documents,
					before.items,
					this.cachedDocuments,
					(document) => document.id,
					before.versions,
					this.contentItemVersions.documents,
				),
			(documents) => {
				this.replaceDocuments(documents);
				return true;
			},
		);
		if (!changed) {
			return;
		}
		this.notify("documents");
	}

	private async refreshDecisionsFromDisk(
		expectedId?: string,
		previous?: Decision,
		epoch = this.rootWatcherEpoch,
	): Promise<void> {
		const changed = await this.loadCurrentCollection(
			"decisions",
			epoch,
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
			() => ({ items: this.cachedDecisions.slice(), versions: new Map(this.contentItemVersions.decisions) }),
			(decisions, before) =>
				this.mergeConcurrentChanges(
					decisions,
					before.items,
					this.cachedDecisions,
					(decision) => decision.id,
					before.versions,
					this.contentItemVersions.decisions,
				),
			(decisions) => {
				this.replaceDecisions(decisions);
				return true;
			},
		);
		if (!changed) {
			return;
		}
		this.notify("decisions");
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
		const generation = this.nextContentItemGeneration("tasks", normalizedTaskId);
		const previous = this.tasks.get(normalizedTaskId);
		const task = await this.retryRead(
			async () => this.filesystem.loadTask(taskId),
			(result) => result !== null && (!previous || this.hasTaskChanged(previous, result)),
			12,
			75,
			() =>
				this.isRootWatcherCurrent(epoch) && this.isContentItemGenerationCurrent("tasks", normalizedTaskId, generation),
		);
		if (
			!task ||
			!this.isRootWatcherCurrent(epoch) ||
			!this.isContentItemGenerationCurrent("tasks", normalizedTaskId, generation)
		) {
			return;
		}
		this.nextContentItemVersion("tasks", normalizedTaskId);
		this.tasks.set(task.id, task);
		this.cachedTasks = sortByTaskId(Array.from(this.tasks.values()));
		this.notify("tasks");
	}

	private async updateDecisionFromDisk(decisionId: string, epoch = this.rootWatcherEpoch): Promise<void> {
		const generation = this.nextContentItemGeneration("decisions", decisionId);
		const previous = this.decisions.get(decisionId);
		const decision = await this.retryRead(
			async () => this.filesystem.loadDecision(decisionId),
			(result) => result !== null && (!previous || this.hasDecisionChanged(previous, result)),
			12,
			75,
			() =>
				this.isRootWatcherCurrent(epoch) && this.isContentItemGenerationCurrent("decisions", decisionId, generation),
		);
		if (
			!decision ||
			!this.isRootWatcherCurrent(epoch) ||
			!this.isContentItemGenerationCurrent("decisions", decisionId, generation)
		) {
			return;
		}
		this.nextContentItemVersion("decisions", decisionId);
		this.decisions.set(decision.id, decision);
		this.cachedDecisions = sortByTaskId(Array.from(this.decisions.values()));
		this.notify("decisions");
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

	private async retryRead<T>(
		loader: () => Promise<T>,
		isValid: (result: T) => boolean = (value) => value !== null && value !== undefined,
		attempts = 12,
		delayMs = 75,
		shouldContinue: () => boolean = () => !this.closed,
	): Promise<T | null> {
		let lastError: unknown = null;
		for (let attempt = 1; attempt <= attempts; attempt++) {
			if (!shouldContinue()) return null;
			try {
				const result = await loader();
				if (!shouldContinue()) return null;
				if (isValid(result)) {
					return result;
				}
			} catch (error) {
				lastError = error;
			}
			if (attempt < attempts) {
				await this.delay(delayMs * attempt);
				if (!shouldContinue()) return null;
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
