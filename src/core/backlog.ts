import { rename as moveFile, stat, unlink } from "node:fs/promises";
import { basename, isAbsolute, join, relative } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { FileSystem, isCreateLockError } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import {
	type AcceptanceCriterion,
	type BacklogConfig,
	type Decision,
	DOCUMENT_TYPE_VALUES,
	type Document,
	type DocumentCreateInput,
	type DocumentType,
	type DocumentUpdateInput,
	EntityType,
	isLocalEditableTask,
	type Milestone,
	type SearchFilters,
	type Task,
	type TaskCommentInput,
	type TaskCreateInput,
	type TaskListFilter,
	type TaskUpdateInput,
} from "../types/index.ts";
import { normalizeAssignee } from "../utils/assignee.ts";
import { documentIdsEqual, normalizeDocumentId } from "../utils/document-id.ts";
import {
	getDocumentSubPathFromRelativePath,
	normalizeDocumentRelativePath,
	normalizeDocumentSubPath,
} from "../utils/document-path.ts";
import { openInEditor } from "../utils/editor.ts";
import { generateNextDocId } from "../utils/id-generators.ts";
import {
	createMilestoneFilterValueResolver,
	normalizeMilestoneFilterValue,
	resolveClosestMilestoneFilterValue,
} from "../utils/milestone-filter.ts";
import {
	buildGlobPattern,
	buildIdRegex,
	extractAnyPrefix,
	generateNextId as generateNextPrefixedId,
	generateNextSubtaskId,
	getPrefixForType,
	normalizeId,
} from "../utils/prefix-config.ts";
import { formatValidPriorityValues, normalizePriorityValue, resolvePriorityValue } from "../utils/priority-config.ts";
import {
	getCanonicalStatus as resolveCanonicalStatus,
	getValidStatuses as resolveValidStatuses,
} from "../utils/status.ts";
import { executeStatusCallback } from "../utils/status-callback.ts";
import {
	buildDefinitionOfDoneItems,
	normalizeDependencies,
	normalizeStringList,
	stringArraysEqual,
	validateDependencies,
} from "../utils/task-builders.ts";
import { resolveTaskById } from "../utils/task-id.ts";
import {
	AmbiguousTaskIdError,
	getTaskFilename,
	getTaskPath,
	normalizeTaskId,
	taskIdsEqual,
} from "../utils/task-path.ts";
import { attachSubtaskSummaries } from "../utils/task-subtasks.ts";
import { formatValidTaskTypeValues, matchesTaskTypeFilter, resolveTaskTypeValue } from "../utils/task-type-config.ts";
import { upsertTaskUpdatedDate } from "../utils/task-updated-date.ts";
import { isTerminalStatus } from "../utils/terminal-status.ts";
import { migrateConfig, needsMigration } from "./config-migration.ts";
import { ContentStore } from "./content-store.ts";
import {
	applyDuplicateTaskIdRepair,
	type DuplicateRepairPlan,
	type DuplicateRepairResult,
	previewDuplicateTaskIdRepair,
} from "./duplicate-task-repair.ts";
import { migrateDraftPrefixes, needsDraftPrefixMigration } from "./prefix-migration.ts";
import { calculateNewOrdinal, DEFAULT_ORDINAL_STEP, resolveOrdinalConflicts } from "./reorder.ts";
import { SearchService } from "./search-service.ts";
import {
	type BranchTaskStateEntry,
	findTaskInLocalBranches,
	findTaskInRemoteBranches,
	getTaskLoadingMessage,
	loadLocalBranchTasks,
	loadRemoteTasks,
	resolveTaskConflict,
} from "./task-loader.ts";

interface BlessedScreen {
	program: {
		disableMouse(): void;
		enableMouse(): void;
		hideCursor(): void;
		showCursor(): void;
		input: NodeJS.EventEmitter;
		pause?: () => (() => void) | undefined;
		flush?: () => void;
		put?: {
			keypad_local?: () => void;
			keypad_xmit?: () => void;
		};
	};
	leave(): void;
	enter(): void;
	render(): void;
	clearRegion(x1: number, x2: number, y1: number, y2: number): void;
	width: number;
	height: number;
	emit(event: string): void;
}

interface TaskQueryOptions {
	filters?: TaskListFilter;
	query?: string;
	limit?: number;
	includeCrossBranch?: boolean;
}

export type TuiTaskEditFailureReason = "not_found" | "read_only" | "editor_failed";

export interface TuiTaskEditResult {
	changed: boolean;
	task?: Task;
	reason?: TuiTaskEditFailureReason;
}

function buildUpdatedDateComparableTask(task: Task): Record<string, unknown> {
	return {
		id: task.id,
		title: task.title,
		status: task.status,
		assignee: task.assignee ?? [],
		reporter: task.reporter,
		createdDate: task.createdDate,
		labels: task.labels ?? [],
		milestone: task.milestone,
		dependencies: task.dependencies ?? [],
		references: task.references ?? [],
		documentation: task.documentation ?? [],
		modifiedFiles: task.modifiedFiles ?? [],
		rawContent: task.rawContent ?? "",
		description: task.description,
		implementationPlan: task.implementationPlan,
		implementationNotes: task.implementationNotes,
		comments: task.comments ?? [],
		finalSummary: task.finalSummary,
		acceptanceCriteriaItems: task.acceptanceCriteriaItems ?? [],
		definitionOfDoneItems: task.definitionOfDoneItems ?? [],
		parentTaskId: task.parentTaskId,
		subtasks: task.subtasks ?? [],
		priority: task.priority,
		type: task.type,
		onStatusChange: task.onStatusChange,
	};
}

function hasUpdatedDateRelevantChanges(originalTask: Task | null, nextTask: Task): boolean {
	if (!originalTask) {
		return true;
	}

	return (
		JSON.stringify(buildUpdatedDateComparableTask(originalTask)) !==
		JSON.stringify(buildUpdatedDateComparableTask(nextTask))
	);
}

function buildLatestStateMap(
	stateEntries: BranchTaskStateEntry[] = [],
	localTasks: Array<Task & { lastModified?: Date; updatedDate?: string }> = [],
): Map<string, BranchTaskStateEntry> {
	const latest = new Map<string, BranchTaskStateEntry>();
	const update = (entry: BranchTaskStateEntry) => {
		const existing = latest.get(entry.id);
		if (!existing || entry.lastModified > existing.lastModified) {
			latest.set(entry.id, entry);
		}
	};

	for (const entry of stateEntries) {
		update(entry);
	}

	for (const task of localTasks) {
		if (!task.id) continue;
		const lastModified = task.lastModified ?? (task.updatedDate ? new Date(task.updatedDate) : new Date(0));

		update({
			id: task.id,
			type: "task",
			branch: "local",
			path: "",
			lastModified,
		});
	}

	return latest;
}

function filterTasksByStateSnapshots(tasks: Task[], latestState: Map<string, BranchTaskStateEntry>): Task[] {
	return tasks.filter((task) => {
		const latest = latestState.get(task.id);
		if (!latest) return true;
		return latest.type === "task";
	});
}

function normalizeDocumentTypeInput(type: unknown): DocumentType | undefined {
	if (type === undefined) {
		return undefined;
	}
	if (typeof type === "string" && (DOCUMENT_TYPE_VALUES as readonly string[]).includes(type)) {
		return type as DocumentType;
	}
	throw new Error(`Document type must be one of: ${DOCUMENT_TYPE_VALUES.join(", ")}.`);
}

/**
 * Extract IDs from state map where latest state is "task" or "completed" (not "archived" or "draft")
 * Used for ID generation to determine which IDs are in use.
 */
function getActiveAndCompletedIdsFromStateMap(latestState: Map<string, BranchTaskStateEntry>): string[] {
	const ids: string[] = [];
	for (const [id, entry] of latestState) {
		if (entry.type === "task" || entry.type === "completed") {
			ids.push(id);
		}
	}
	return ids;
}

function formatAvailableIndexHint(items: AcceptanceCriterion[], emptyMessage: string): string {
	if (items.length === 0) {
		return emptyMessage;
	}
	const indexes = items.map((item) => item.index).sort((a, b) => a - b);
	const first = indexes[0] ?? 1;
	const last = indexes[indexes.length - 1] ?? first;
	const range = first === last ? `#${first}` : `#${first}-#${last}`;
	return `Available indexes: ${range}.`;
}

export class Core {
	public fs: FileSystem;
	public git: GitOperations;
	private contentStore?: ContentStore;
	private searchService?: SearchService;
	private readonly enableWatchers: boolean;
	private activeBranchTaskEntries: BranchTaskStateEntry[] = [];
	private activeBranchFingerprint: string | null = null;
	private activeBranchFingerprintPromise: Promise<string> | null = null;
	private activeBranchRefreshPromise: Promise<void> | null = null;

	constructor(projectRoot: string, options?: { enableWatchers?: boolean }) {
		this.fs = new FileSystem(projectRoot);
		this.git = new GitOperations(projectRoot, null, () => this.fs.loadConfig());
		// Disable watchers by default for CLI commands (non-interactive)
		// Interactive modes (TUI, browser, MCP) should explicitly pass enableWatchers: true
		this.enableWatchers = options?.enableWatchers ?? false;
		// Note: Config is loaded lazily when needed since constructor can't be async
	}

	async withCreateLock<T>(fn: () => Promise<T>): Promise<T> {
		return await this.fs.withCreateLock(fn);
	}

	async previewDuplicateTaskIdRepair(options: { includeBranches?: boolean } = {}): Promise<DuplicateRepairPlan> {
		return await previewDuplicateTaskIdRepair(this, options);
	}

	async repairDuplicateTaskIds(expectedFingerprint: string): Promise<DuplicateRepairResult> {
		const result = await applyDuplicateTaskIdRepair(this, expectedFingerprint);
		if (this.contentStore) {
			await this.contentStore.refreshTasks();
		}
		return result;
	}

	private async resolveCreateOrdinal(inputOrdinal: number | undefined, isDraft: boolean): Promise<number | undefined> {
		if (typeof inputOrdinal === "number") {
			return inputOrdinal;
		}
		if (isDraft) {
			return undefined;
		}

		const tasks = await this.fs.listTasks();
		const ordinals = tasks
			.map((task) => task.ordinal)
			.filter((ordinal): ordinal is number => typeof ordinal === "number" && Number.isFinite(ordinal));

		if (ordinals.length === 0) {
			return tasks.length === 0 ? DEFAULT_ORDINAL_STEP : undefined;
		}

		return Math.max(...ordinals) + DEFAULT_ORDINAL_STEP;
	}

	async getContentStore(): Promise<ContentStore> {
		if (!this.contentStore) {
			// Use loadTasks as the task loader to include cross-branch tasks
			this.contentStore = new ContentStore(this.fs, () => this.loadTasks(), this.enableWatchers);
		}
		await this.contentStore.ensureInitialized();
		return this.contentStore;
	}

	async getSearchService(): Promise<SearchService> {
		if (!this.searchService) {
			const store = await this.getContentStore();
			this.searchService = new SearchService(store);
		}
		await this.searchService.ensureInitialized();
		return this.searchService;
	}

	private async refreshCachedTasksForCrossBranchRead(includeCrossBranch: boolean): Promise<void> {
		if (!this.enableWatchers || !includeCrossBranch || !this.contentStore) {
			return;
		}

		await this.contentStore.refreshTasks();
	}

	private async computeActiveBranchFingerprint(config: BacklogConfig | null): Promise<string> {
		const settings = {
			checkActiveBranches: config?.checkActiveBranches !== false,
			activeBranchDays: config?.activeBranchDays ?? 30,
			remoteOperations: config?.remoteOperations !== false,
			filesystemOnly: config?.filesystemOnly === true,
			taskPrefix: config?.prefixes?.task ?? "task",
			taskResolutionStrategy: config?.taskResolutionStrategy ?? "most_progressed",
			statuses: config?.statuses ?? DEFAULT_STATUSES,
			backlogDir: this.fs.backlogDirName,
		};

		this.git.setConfig(config);
		if (!settings.checkActiveBranches || settings.filesystemOnly) {
			return JSON.stringify(settings);
		}

		const branchTips = await this.git.listRecentBranchTips(settings.activeBranchDays);
		return JSON.stringify({ ...settings, branchTips });
	}

	private async getActiveBranchFingerprint(config?: BacklogConfig | null): Promise<string> {
		if (config !== undefined) {
			return await this.computeActiveBranchFingerprint(config);
		}
		if (!this.activeBranchFingerprintPromise) {
			const fingerprintPromise = this.fs
				.loadConfig()
				.then((loadedConfig) => this.computeActiveBranchFingerprint(loadedConfig));
			this.activeBranchFingerprintPromise = fingerprintPromise;
			const clearFingerprintPromise = () => {
				if (this.activeBranchFingerprintPromise === fingerprintPromise) {
					this.activeBranchFingerprintPromise = null;
				}
			};
			void fingerprintPromise.then(clearFingerprintPromise, clearFingerprintPromise);
		}
		return await this.activeBranchFingerprintPromise;
	}

	/** Refresh the existing cross-branch store only when relevant config or refs changed. */
	async refreshTasksForTaskRead(): Promise<void> {
		while (true) {
			const fingerprint = await this.getActiveBranchFingerprint();
			if (fingerprint === this.activeBranchFingerprint) {
				return;
			}

			if (!this.activeBranchRefreshPromise) {
				const refreshPromise = (async () => {
					const store = await this.getContentStore();
					await store.refreshTasks();
				})();
				this.activeBranchRefreshPromise = refreshPromise;
				const clearRefreshPromise = () => {
					if (this.activeBranchRefreshPromise === refreshPromise) {
						this.activeBranchRefreshPromise = null;
					}
				};
				void refreshPromise.then(clearRefreshPromise, clearRefreshPromise);
			}

			await this.activeBranchRefreshPromise;
		}
	}

	private applyTaskFilters(
		tasks: Task[],
		filters?: TaskListFilter,
		resolveMilestoneFilterValue?: (milestoneValue: string) => string,
	): Task[] {
		if (!filters) {
			return tasks;
		}
		let result = tasks;
		if (filters.status) {
			const statusLower = filters.status.toLowerCase();
			result = result.filter((task) => (task.status ?? "").toLowerCase() === statusLower);
		}
		if (filters.excludeStatus) {
			const excludedStatuses = Array.isArray(filters.excludeStatus) ? filters.excludeStatus : [filters.excludeStatus];
			const excluded = new Set(
				excludedStatuses.map((status) => status.trim().toLowerCase()).filter((status) => status.length > 0),
			);
			if (excluded.size > 0) {
				result = result.filter((task) => !excluded.has((task.status ?? "").toLowerCase()));
			}
		}
		if (filters.type) {
			result = result.filter((task) => matchesTaskTypeFilter(task.type, filters.type));
		}
		if (filters.assignee) {
			const assigneeLower = filters.assignee.toLowerCase();
			result = result.filter((task) => (task.assignee ?? []).some((value) => value.toLowerCase() === assigneeLower));
		}
		if (filters.unassigned) {
			result = result.filter((task) => !(task.assignee ?? []).some((value) => value.trim().length > 0));
		}
		if (filters.priority) {
			const priorityLower = normalizePriorityValue(String(filters.priority));
			result = result.filter((task) => normalizePriorityValue(task.priority) === priorityLower);
		}
		if (filters.milestone) {
			const milestoneFilter = resolveClosestMilestoneFilterValue(
				filters.milestone,
				result.map((task) => resolveMilestoneFilterValue?.(task.milestone ?? "") ?? task.milestone ?? ""),
			);
			result = result.filter(
				(task) =>
					normalizeMilestoneFilterValue(resolveMilestoneFilterValue?.(task.milestone ?? "") ?? task.milestone ?? "") ===
					milestoneFilter,
			);
		}
		if (filters.parentTaskId) {
			const parentFilter = filters.parentTaskId;
			result = result.filter((task) => task.parentTaskId && taskIdsEqual(parentFilter, task.parentTaskId));
		}
		if (filters.labels && filters.labels.length > 0) {
			const requiredLabels = filters.labels.map((label) => label.toLowerCase()).filter(Boolean);
			if (requiredLabels.length > 0) {
				result = result.filter((task) => {
					const taskLabels = task.labels?.map((label) => label.toLowerCase()) || [];
					if (taskLabels.length === 0) return false;
					const labelSet = new Set(taskLabels);
					return requiredLabels.some((label) => labelSet.has(label));
				});
			}
		}
		return result;
	}

	private filterLocalEditableTasks(tasks: Task[]): Task[] {
		return tasks.filter(isLocalEditableTask);
	}

	private async requireCanonicalStatus(status: string): Promise<string> {
		const canonical = await resolveCanonicalStatus(status, this);
		if (canonical) {
			return canonical;
		}
		const validStatuses = await resolveValidStatuses(this);
		throw new Error(`Invalid status: ${status}. Valid statuses are: ${validStatuses.join(", ")}`);
	}

	private async normalizePriority(value: string | undefined): Promise<string | undefined> {
		if (value === undefined || value.trim() === "") {
			return undefined;
		}
		const config = await this.fs.loadConfig();
		const normalized = resolvePriorityValue(value, config);
		if (!normalized) {
			throw new Error(`Invalid priority: ${value}. Valid values are: ${formatValidPriorityValues(config)}`);
		}
		return normalized;
	}

	private async normalizeTaskType(value: string | undefined): Promise<string | undefined> {
		if (value === undefined || value === "") {
			return undefined;
		}
		const config = await this.fs.loadConfig();
		const canonical = resolveTaskTypeValue(value, config);
		if (!canonical) {
			throw new Error(`Invalid type: ${value}. Valid types are: ${formatValidTaskTypeValues(config)}`);
		}
		return canonical;
	}

	private isExactTaskReference(reference: string, taskId: string): boolean {
		const trimmed = reference.trim();
		if (!trimmed) {
			return false;
		}
		const taskPrefix = extractAnyPrefix(taskId);
		const referencePrefix = extractAnyPrefix(trimmed);
		if (!taskPrefix || !referencePrefix) {
			return false;
		}
		if (taskPrefix.toLowerCase() !== referencePrefix.toLowerCase()) {
			return false;
		}
		return normalizeTaskId(trimmed, taskPrefix).toLowerCase() === normalizeTaskId(taskId, taskPrefix).toLowerCase();
	}

	private sanitizeArchivedTaskLinks(tasks: Task[], archivedTaskId: string): Task[] {
		const changedTasks: Task[] = [];

		for (const task of tasks) {
			const dependencies = task.dependencies ?? [];
			const references = task.references ?? [];

			const sanitizedDependencies = dependencies.filter((dependency) => !taskIdsEqual(dependency, archivedTaskId));
			const sanitizedReferences = references.filter(
				(reference) => !this.isExactTaskReference(reference, archivedTaskId),
			);

			const dependenciesChanged = !stringArraysEqual(dependencies, sanitizedDependencies);
			const referencesChanged = !stringArraysEqual(references, sanitizedReferences);
			if (!dependenciesChanged && !referencesChanged) {
				continue;
			}

			changedTasks.push({
				...task,
				dependencies: sanitizedDependencies,
				references: sanitizedReferences,
			});
		}

		return changedTasks;
	}

	async queryTasks(options: TaskQueryOptions = {}): Promise<Task[]> {
		const { filters, query, limit } = options;
		const trimmedQuery = query?.trim();
		const includeCrossBranch = options.includeCrossBranch ?? true;
		const milestoneResolverPromise = filters?.milestone
			? Promise.all([this.fs.listMilestones(), this.fs.listArchivedMilestones()]).then(
					([activeMilestones, archivedMilestones]) =>
						createMilestoneFilterValueResolver([...activeMilestones, ...archivedMilestones]),
				)
			: undefined;

		const applyFiltersAndLimit = async (collection: Task[]): Promise<Task[]> => {
			const resolveMilestoneFilterValue = milestoneResolverPromise ? await milestoneResolverPromise : undefined;
			let filtered = this.applyTaskFilters(collection, filters, resolveMilestoneFilterValue);
			if (!includeCrossBranch) {
				filtered = this.filterLocalEditableTasks(filtered);
			}
			if (typeof limit === "number" && limit >= 0) {
				return filtered.slice(0, limit);
			}
			return filtered;
		};

		if (!trimmedQuery) {
			const store = await this.getContentStore();
			await this.refreshCachedTasksForCrossBranchRead(includeCrossBranch);
			const tasks = store.getTasks();
			return await applyFiltersAndLimit(tasks);
		}

		await this.getContentStore();
		await this.refreshCachedTasksForCrossBranchRead(includeCrossBranch);
		const searchService = await this.getSearchService();
		const searchFilters: SearchFilters = {};
		if (filters?.status) {
			searchFilters.status = filters.status;
		}
		if (filters?.excludeStatus) {
			searchFilters.excludeStatus = filters.excludeStatus;
		}
		if (filters?.type) {
			searchFilters.type = filters.type;
		}
		if (filters?.priority) {
			searchFilters.priority = filters.priority;
		}
		if (filters?.assignee) {
			searchFilters.assignee = filters.assignee;
		}
		if (filters?.labels) {
			searchFilters.labels = filters.labels;
		}

		const searchResults = searchService.search({
			query: trimmedQuery,
			limit,
			types: ["task"],
			filters: Object.keys(searchFilters).length > 0 ? searchFilters : undefined,
		});

		const seen = new Set<string>();
		const tasks: Task[] = [];
		for (const result of searchResults) {
			if (result.type !== "task") continue;
			const task = result.task;
			if (seen.has(task.id)) continue;
			seen.add(task.id);
			tasks.push(task);
		}

		return await applyFiltersAndLimit(tasks);
	}

	async getTask(taskId: string): Promise<Task | null> {
		const localResolution = resolveTaskById(await this.fs.listTasks(), taskId);
		if (localResolution.status === "invalid") {
			return null;
		}
		if (localResolution.status === "ambiguous") {
			throw new AmbiguousTaskIdError(
				taskId,
				localResolution.tasks.map((task) => task.filePath ?? task.id),
			);
		}

		// Also fail closed when an active task collides with a completed file.
		await this.fs.loadTask(taskId);

		const store = await this.getContentStore();
		const tasks = store.getTasks();
		const resolution = resolveTaskById(tasks, taskId);
		if (resolution.status === "invalid") {
			return null;
		}
		if (resolution.status === "ambiguous") {
			throw new AmbiguousTaskIdError(
				taskId,
				resolution.tasks.map((task) => task.filePath ?? `${task.branch ?? "unknown branch"}:${task.id}`),
			);
		}
		if (
			localResolution.status === "found" &&
			resolution.status === "found" &&
			localResolution.task.id.toLowerCase() !== resolution.task.id.toLowerCase()
		) {
			throw new AmbiguousTaskIdError(taskId, [
				localResolution.task.filePath ?? localResolution.task.id,
				resolution.task.filePath ?? `${resolution.task.branch ?? "unknown branch"}:${resolution.task.id}`,
			]);
		}
		if (resolution.status === "found") {
			return resolution.task;
		}
		if (localResolution.status === "found") {
			return localResolution.task;
		}
		return null;
	}

	async hasActiveBranchTaskIdCollision(taskId: string, localTasks: Task[]): Promise<boolean> {
		const localMatches = localTasks.filter((task) => taskIdsEqual(taskId, task.id));
		if (localMatches.length > 1) {
			return true;
		}

		const config = await this.fs.loadConfig();
		if (config?.checkActiveBranches === false) {
			this.activeBranchTaskEntries = [];
			return false;
		}

		const branchMatches = this.activeBranchTaskEntries.filter((entry) => taskIdsEqual(taskId, entry.id));
		if (branchMatches.length === 0) {
			return false;
		}

		const branchPaths = new Map<string, Set<string>>();
		for (const entry of branchMatches) {
			const tree = entry.tree ?? entry.branch;
			const paths = branchPaths.get(tree) ?? new Set<string>();
			paths.add(entry.path);
			branchPaths.set(tree, paths);
			if (paths.size > 1) {
				return true;
			}
		}

		const identities = new Set(
			branchMatches.map((entry) =>
				entry.objectId ? `blob:${entry.objectId}` : `location:${entry.branch}\0${entry.path}`,
			),
		);
		const localTask = localMatches[0];
		if (localTask) {
			const objectId = localTask.filePath ? await this.git.hashFile(localTask.filePath) : null;
			identities.add(objectId ? `blob:${objectId}` : `local:${localTask.id}\0${localTask.filePath ?? ""}`);
		}

		return identities.size > 1;
	}

	async getTaskWithSubtasks(taskId: string, localTasks?: Task[]): Promise<Task | null> {
		const task = await this.loadTaskById(taskId);
		if (!task) {
			return null;
		}

		const tasks = localTasks ?? (await this.fs.listTasks());
		return attachSubtaskSummaries(task, tasks);
	}

	async loadTaskById(taskId: string): Promise<Task | null> {
		// Pass raw ID to loadTask - it will handle prefix detection via getTaskPath
		const localTask = await this.fs.loadTask(taskId);
		if (localTask) return localTask;

		// Check config for remote operations
		const config = await this.fs.loadConfig();
		if (config?.checkActiveBranches === false) return null;

		const sinceDays = config?.activeBranchDays ?? 30;
		const taskPrefix = config?.prefixes?.task ?? "task";

		// For cross-branch search, normalize with configured prefix
		const canonicalId = normalizeTaskId(taskId, taskPrefix);

		// Try other local branches first (faster than remote)
		const localBranchTask = await findTaskInLocalBranches(
			this.git,
			canonicalId,
			await this.getBacklogDirectoryName(),
			sinceDays,
			taskPrefix,
		);
		if (localBranchTask) return localBranchTask;

		// Skip remote if disabled
		if (config?.remoteOperations === false) return null;

		// Try remote branches
		return await findTaskInRemoteBranches(
			this.git,
			canonicalId,
			await this.getBacklogDirectoryName(),
			sinceDays,
			taskPrefix,
		);
	}

	async getTaskContent(taskId: string): Promise<string | null> {
		const task = await this.fs.loadTask(taskId);
		const filePath = task?.filePath ?? null;
		if (!filePath) return null;
		return await Bun.file(filePath).text();
	}

	async getDocument(documentId: string): Promise<Document | null> {
		const documents = await this.fs.listDocuments();
		const match = documents.find((doc) => documentIdsEqual(documentId, doc.id));
		return match ?? null;
	}

	async getDocumentContent(documentId: string): Promise<string | null> {
		const document = await this.getDocument(documentId);
		if (!document) return null;

		const relativePath = normalizeDocumentRelativePath(document.path ?? `${document.id}.md`);
		const filePath = join(this.fs.docsDir, ...relativePath.split("/"));
		try {
			return await Bun.file(filePath).text();
		} catch {
			return null;
		}
	}

	/**
	 * Re-point this Core instance to a different project root.
	 * Disposes caches and re-creates FileSystem / GitOperations.
	 */
	reinitializeProjectRoot(projectRoot: string): void {
		this.disposeSearchService();
		this.disposeContentStore();
		this.fs = new FileSystem(projectRoot);
		this.git = new GitOperations(projectRoot, null, () => this.fs.loadConfig());
	}

	disposeSearchService(): void {
		if (this.searchService) {
			this.searchService.dispose();
			this.searchService = undefined;
		}
	}

	disposeContentStore(): void {
		if (this.contentStore) {
			this.contentStore.dispose();
			this.contentStore = undefined;
		}
		this.activeBranchTaskEntries = [];
		this.activeBranchFingerprint = null;
		this.activeBranchFingerprintPromise = null;
		this.activeBranchRefreshPromise = null;
	}

	// Backward compatibility aliases
	get filesystem() {
		return this.fs;
	}

	get gitOps() {
		return this.git;
	}

	async ensureConfigLoaded(): Promise<void> {
		try {
			const config = await this.fs.loadConfig();
			this.git.setConfig(config);
		} catch (error) {
			// Config loading failed, git operations will work with null config
			if (process.env.DEBUG) {
				console.warn("Failed to load config for git operations:", error);
			}
		}
	}

	private async getBacklogDirectoryName(): Promise<string> {
		return this.fs.backlogDirName;
	}

	async shouldAutoCommit(overrideValue?: boolean): Promise<boolean> {
		const config = await this.fs.loadConfig();
		this.git.setConfig(config);
		if (config?.filesystemOnly) {
			return false;
		}
		// If override is explicitly provided, use it
		if (overrideValue !== undefined) {
			return overrideValue;
		}
		// Otherwise, check config (default to false for safety)
		return config?.autoCommit ?? false;
	}

	async getGitOps() {
		await this.ensureConfigLoaded();
		return this.git;
	}

	// Config migration
	private parseLegacyInlineArray(value: string): string[] {
		const items: string[] = [];
		let current = "";
		let quote: '"' | "'" | null = null;

		const pushCurrent = () => {
			const normalized = current.trim().replace(/\\(['"])/g, "$1");
			if (normalized) {
				items.push(normalized);
			}
			current = "";
		};

		for (let i = 0; i < value.length; i += 1) {
			const ch = value[i];
			const prev = i > 0 ? value[i - 1] : "";
			if (quote) {
				if (ch === quote && prev !== "\\") {
					quote = null;
					continue;
				}
				current += ch;
				continue;
			}
			if (ch === '"' || ch === "'") {
				quote = ch;
				continue;
			}
			if (ch === ",") {
				pushCurrent();
				continue;
			}
			current += ch;
		}
		pushCurrent();
		return items;
	}

	private stripYamlComment(value: string): string {
		let quote: '"' | "'" | null = null;
		for (let i = 0; i < value.length; i += 1) {
			const ch = value[i];
			const prev = i > 0 ? value[i - 1] : "";
			if (quote) {
				if (ch === quote && prev !== "\\") {
					quote = null;
				}
				continue;
			}
			if (ch === '"' || ch === "'") {
				quote = ch;
				continue;
			}
			if (ch === "#") {
				return value.slice(0, i).trimEnd();
			}
		}
		return value;
	}

	private parseLegacyYamlValue(value: string): string {
		const trimmed = this.stripYamlComment(value).trim();
		const singleQuoted = trimmed.match(/^'(.*)'$/);
		if (singleQuoted?.[1] !== undefined) {
			return singleQuoted[1].replace(/''/g, "'");
		}
		const doubleQuoted = trimmed.match(/^"(.*)"$/);
		if (doubleQuoted?.[1] !== undefined) {
			return doubleQuoted[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
		}
		return trimmed;
	}

	private async extractLegacyConfigMilestones(): Promise<string[]> {
		try {
			const configPath = this.fs.configFilePath;
			const content = await Bun.file(configPath).text();
			const lines = content.split("\n");
			for (let i = 0; i < lines.length; i += 1) {
				const line = lines[i] ?? "";
				const match = line.match(/^(\s*)milestones\s*:\s*(.*)$/);
				if (!match) {
					continue;
				}

				const milestoneIndent = (match[1] ?? "").length;
				const trailing = this.stripYamlComment(match[2] ?? "").trim();
				if (trailing.startsWith("[")) {
					let combined = trailing;
					let closed = trailing.endsWith("]");
					let j = i + 1;
					while (!closed && j < lines.length) {
						const segment = this.stripYamlComment(lines[j] ?? "").trim();
						combined += segment;
						if (segment.includes("]")) {
							closed = true;
							break;
						}
						j += 1;
					}
					if (closed) {
						const openIndex = combined.indexOf("[");
						const closeIndex = combined.lastIndexOf("]");
						if (openIndex !== -1 && closeIndex > openIndex) {
							const parsed = this.parseLegacyInlineArray(combined.slice(openIndex + 1, closeIndex));
							return parsed.map((item) => this.parseLegacyYamlValue(item)).filter(Boolean);
						}
					}
				}
				if (trailing.length > 0) {
					const single = this.parseLegacyYamlValue(trailing);
					return single ? [single] : [];
				}

				const values: string[] = [];
				for (let j = i + 1; j < lines.length; j += 1) {
					const nextLine = lines[j] ?? "";
					if (!nextLine.trim()) {
						continue;
					}
					const nextIndent = nextLine.match(/^\s*/)?.[0].length ?? 0;
					if (nextIndent <= milestoneIndent) {
						break;
					}
					const trimmed = nextLine.trim();
					if (!trimmed.startsWith("-")) {
						continue;
					}
					const itemValue = this.parseLegacyYamlValue(trimmed.slice(1));
					if (itemValue) {
						values.push(itemValue);
					}
				}
				return values;
			}
			return [];
		} catch {
			return [];
		}
	}

	private async migrateLegacyConfigMilestonesToFiles(legacyMilestones: string[]): Promise<void> {
		if (legacyMilestones.length === 0) {
			return;
		}
		const existingMilestones = await this.fs.listMilestones();
		const existingKeys = new Set<string>();
		for (const milestone of existingMilestones) {
			const idKey = milestone.id.trim().toLowerCase();
			const titleKey = milestone.title.trim().toLowerCase();
			if (idKey) {
				existingKeys.add(idKey);
			}
			if (titleKey) {
				existingKeys.add(titleKey);
			}
		}
		for (const name of legacyMilestones) {
			const normalized = name.trim();
			const key = normalized.toLowerCase();
			if (!normalized || existingKeys.has(key)) {
				continue;
			}
			const created = await this.fs.createMilestone(normalized);
			const createdIdKey = created.id.trim().toLowerCase();
			const createdTitleKey = created.title.trim().toLowerCase();
			if (createdIdKey) {
				existingKeys.add(createdIdKey);
			}
			if (createdTitleKey) {
				existingKeys.add(createdTitleKey);
			}
		}
	}

	async ensureConfigMigrated(): Promise<void> {
		await this.ensureConfigLoaded();
		const legacyMilestones = await this.extractLegacyConfigMilestones();
		let config = await this.fs.loadConfig();
		const needsSchemaMigration = !config || needsMigration(config);

		if (needsSchemaMigration) {
			config = migrateConfig(config || {});
		}
		if (legacyMilestones.length > 0) {
			await this.migrateLegacyConfigMilestonesToFiles(legacyMilestones);
		}
		if (config && (needsSchemaMigration || legacyMilestones.length > 0)) {
			// Rewrite config to apply schema defaults and strip legacy milestones key after successful migration.
			await this.fs.saveConfig(config);
		}

		// Run draft prefix migration if needed (one-time migration)
		// This renames task-*.md files in drafts/ to draft-*.md
		if (needsDraftPrefixMigration(config)) {
			await migrateDraftPrefixes(this.fs);
		}
	}

	// ID generation
	/**
	 * Generates the next ID for a given entity type.
	 *
	 * @param type - The entity type (Task, Draft, Document, Decision). Defaults to Task.
	 * @param parent - Optional parent ID for subtask generation (only applicable for tasks).
	 * @returns The next available ID (e.g., "task-42", "draft-5", "doc-3")
	 *
	 * Folder scanning by type:
	 * - Task: /tasks, /completed, cross-branch (if enabled), remote (if enabled)
	 * - Draft: /drafts only
	 * - Document: /documents only
	 * - Decision: /decisions only
	 */
	async generateNextId(type: EntityType = EntityType.Task, parent?: string): Promise<string> {
		const config = await this.fs.loadConfig();
		const prefix = getPrefixForType(type, config ?? undefined);

		// Collect existing IDs based on entity type
		const allIds = await this.getExistingIdsForType(type);

		if (parent) {
			// Subtask generation (only applicable for tasks)
			const normalizedParent = allIds.find((id) => taskIdsEqual(parent, id)) ?? normalizeTaskId(parent);
			return generateNextSubtaskId(allIds, normalizedParent, prefix, config?.zeroPaddedIds);
		}

		return generateNextPrefixedId(allIds, prefix, config?.zeroPaddedIds);
	}

	/**
	 * Gets all task IDs that are in use (active or completed) across all branches.
	 * Respects cross-branch config settings. Archived IDs are excluded (can be reused).
	 *
	 * This is used for ID generation to determine the next available ID.
	 */
	private async loadWorktreeTaskStateEntries(taskPrefix: string): Promise<BranchTaskStateEntry[]> {
		const [repoRoot, worktreeRoots] = await Promise.all([this.git.getRepositoryRoot(), this.git.listWorktreePaths()]);
		if (!repoRoot || worktreeRoots.length === 0) {
			return [];
		}

		const projectRelativePath = relative(repoRoot, this.fs.rootDir);
		if (projectRelativePath.startsWith("..") || isAbsolute(projectRelativePath)) {
			return [];
		}

		const backlogDir = await this.getBacklogDirectoryName();
		const entries: BranchTaskStateEntry[] = [];
		for (const worktreeRoot of worktreeRoots) {
			const projectRoot = projectRelativePath ? join(worktreeRoot, projectRelativePath) : worktreeRoot;
			entries.push(...(await this.loadTaskStateEntriesFromWorktree(projectRoot, backlogDir, taskPrefix, worktreeRoot)));
		}

		return entries;
	}

	private async loadTaskStateEntriesFromWorktree(
		projectRoot: string,
		backlogDir: string,
		taskPrefix: string,
		worktreeRoot: string,
	): Promise<BranchTaskStateEntry[]> {
		const idRegex = buildIdRegex(taskPrefix);
		const globPattern = buildGlobPattern(taskPrefix.toLowerCase());
		const directories: Array<{ path: string; type: "task" | "completed" }> = [
			{ path: join(projectRoot, backlogDir, DEFAULT_DIRECTORIES.TASKS), type: "task" },
			{ path: join(projectRoot, backlogDir, DEFAULT_DIRECTORIES.COMPLETED), type: "completed" },
		];
		const entries: BranchTaskStateEntry[] = [];

		for (const { path, type } of directories) {
			let files: string[];
			try {
				files = await Array.fromAsync(new Bun.Glob(globPattern).scan({ cwd: path, followSymlinks: true }));
			} catch {
				continue;
			}

			for (const file of files) {
				const match = file.match(idRegex);
				if (!match?.[1]) continue;

				const filePath = join(path, file);
				const stats = await stat(filePath).catch(() => null);
				entries.push({
					id: normalizeId(match[1], taskPrefix),
					type,
					branch: `worktree:${worktreeRoot}`,
					path: filePath,
					lastModified: stats?.mtime ?? new Date(0),
				});
			}
		}

		return entries;
	}

	private async getActiveAndCompletedTaskIds(): Promise<string[]> {
		const config = await this.fs.loadConfig();
		const taskPrefix = config?.prefixes?.task ?? "task";

		// Load local active and completed tasks
		const localTasks = await this.listTasksWithMetadata();
		const localCompletedTasks = await this.fs.listCompletedTasks();

		// Build initial state entries from local tasks
		const stateEntries: BranchTaskStateEntry[] = [];

		// Add local active tasks to state
		for (const task of localTasks) {
			if (!task.id) continue;
			const lastModified = task.lastModified ?? (task.updatedDate ? new Date(task.updatedDate) : new Date(0));
			stateEntries.push({
				id: task.id,
				type: "task",
				branch: "local",
				path: "",
				lastModified,
			});
		}

		// Add local completed tasks to state
		for (const task of localCompletedTasks) {
			if (!task.id) continue;
			const lastModified = task.updatedDate ? new Date(task.updatedDate) : new Date(0);
			stateEntries.push({
				id: task.id,
				type: "completed",
				branch: "local",
				path: "",
				lastModified,
			});
		}

		// Same-repository worktrees share the task ID namespace even before their
		// task files are committed, so include their filesystem state for allocation.
		stateEntries.push(...(await this.loadWorktreeTaskStateEntries(taskPrefix)));

		// If cross-branch checking is enabled, scan other branches for task states
		if (config?.checkActiveBranches !== false) {
			const branchStateEntries: BranchTaskStateEntry[] = [];
			const backlogDir = await this.getBacklogDirectoryName();

			// Load states from remote and local branches in parallel
			await Promise.all([
				loadRemoteTasks(this.git, config, undefined, localTasks, branchStateEntries, false, backlogDir),
				loadLocalBranchTasks(this.git, config, undefined, localTasks, branchStateEntries, false, backlogDir),
			]);

			// Add branch state entries
			stateEntries.push(...branchStateEntries);
		}

		// Build the latest state map and extract active + completed IDs
		const latestState = buildLatestStateMap(stateEntries, []);
		return getActiveAndCompletedIdsFromStateMap(latestState);
	}

	/**
	 * Gets all existing IDs for a given entity type.
	 * Used internally by generateNextId to determine the next available ID.
	 *
	 * Note: Archived tasks are intentionally excluded - archived IDs can be reused.
	 * This makes archive act as a soft delete for ID purposes.
	 */
	private async getExistingIdsForType(type: EntityType): Promise<string[]> {
		switch (type) {
			case EntityType.Task: {
				// Get active + completed task IDs from all branches (respects config)
				// Archived IDs are excluded - they can be reused (soft delete behavior)
				return this.getActiveAndCompletedTaskIds();
			}
			case EntityType.Draft: {
				const drafts = await this.fs.listDrafts();
				return drafts.map((d) => d.id);
			}
			case EntityType.Document: {
				const documents = await this.fs.listDocuments();
				return documents.map((d) => d.id);
			}
			case EntityType.Decision: {
				const decisions = await this.fs.listDecisions();
				return decisions.map((d) => d.id);
			}
			default:
				return [];
		}
	}

	private async writePreparedTask(task: Task, isDraft: boolean): Promise<string> {
		if (isDraft) {
			task.status = "Draft";
			normalizeAssignee(task);
			return await this.fs.saveDraft(task);
		}

		normalizeAssignee(task);
		return await this.fs.saveTask(task);
	}

	private async finalizeCreatedTask(
		task: Task,
		filepath: string,
		isDraft: boolean,
		autoCommit?: boolean,
	): Promise<Task | null> {
		const savedTask = isDraft ? await this.fs.loadDraft(task.id) : await this.fs.loadTask(task.id);

		if (!isDraft && this.contentStore && savedTask) {
			this.contentStore.upsertTask(savedTask);
		}

		if (await this.shouldAutoCommit(autoCommit)) {
			if (isDraft) {
				await this.git.addFile(filepath);
				await this.git.commitTaskChange(task.id, `Create draft ${task.id}`, filepath);
			} else {
				await this.git.addAndCommitTaskFile(task.id, filepath, "create");
			}
		}

		return savedTask;
	}

	async createTaskFromInput(input: TaskCreateInput, autoCommit?: boolean): Promise<{ task: Task; filePath?: string }> {
		if (!input.title || input.title.trim().length === 0) {
			throw new Error("Title is required to create a task.");
		}

		// Determine if this is a draft BEFORE generating the ID
		const requestedStatus = input.status?.trim();
		const isDraft = requestedStatus?.toLowerCase() === "draft";
		const requestedParentTaskId = input.parentTaskId?.trim();

		// Generate ID with appropriate entity type - drafts get DRAFT-X, tasks get TASK-X
		const entityType = isDraft ? EntityType.Draft : EntityType.Task;

		const normalizedLabels = normalizeStringList(input.labels) ?? [];
		const normalizedAssignees = normalizeStringList(input.assignee) ?? [];
		const normalizedDependencies = normalizeDependencies(input.dependencies);
		const normalizedReferences = normalizeStringList(input.references) ?? [];
		const normalizedDocumentation = normalizeStringList(input.documentation) ?? [];
		const normalizedModifiedFiles = normalizeStringList(input.modifiedFiles) ?? [];

		const { valid: validDependencies, invalid: invalidDependencies } = await validateDependencies(
			normalizedDependencies,
			this,
		);
		if (invalidDependencies.length > 0) {
			throw new Error(
				`The following dependencies do not exist: ${invalidDependencies.join(", ")}. Please create these tasks first or verify the IDs.`,
			);
		}

		let status = "";
		if (requestedStatus) {
			if (isDraft) {
				status = "Draft";
			} else {
				status = await this.requireCanonicalStatus(requestedStatus);
			}
		}

		const priority = await this.normalizePriority(input.priority);
		const type = await this.normalizeTaskType(input.type);
		const createdDate = new Date().toISOString().slice(0, 16).replace("T", " ");
		if (
			input.ordinal !== undefined &&
			(typeof input.ordinal !== "number" || !Number.isFinite(input.ordinal) || input.ordinal < 0)
		) {
			throw new Error("Ordinal must be a non-negative number.");
		}

		const acceptanceCriteriaItems = Array.isArray(input.acceptanceCriteria)
			? input.acceptanceCriteria
					.map((criterion, index) => ({
						index: index + 1,
						text: String(criterion.text ?? "").trim(),
						checked: Boolean(criterion.checked),
					}))
					.filter((criterion) => criterion.text.length > 0)
			: [];
		const config = await this.fs.loadConfig();
		const definitionOfDoneItems = buildDefinitionOfDoneItems({
			defaults: config?.definitionOfDone,
			add: input.definitionOfDoneAdd,
			disableDefaults: input.disableDefinitionOfDoneDefaults,
		});
		const resolvedStatus = isDraft ? "Draft" : status || config?.defaultStatus || FALLBACK_STATUS;

		const { task, filePath } = await this.withCreateLock(async () => {
			const parentTaskId = requestedParentTaskId
				? await this.resolveParentTaskIdForCreate(requestedParentTaskId)
				: undefined;
			const id = await this.generateNextId(entityType, isDraft ? undefined : parentTaskId);
			const ordinal = await this.resolveCreateOrdinal(input.ordinal, isDraft);
			const task: Task = {
				id,
				title: input.title.trim(),
				status: resolvedStatus,
				assignee: normalizedAssignees,
				labels: normalizedLabels,
				dependencies: validDependencies,
				references: normalizedReferences,
				documentation: normalizedDocumentation,
				modifiedFiles: normalizedModifiedFiles,
				rawContent: input.rawContent ?? "",
				createdDate,
				...(parentTaskId && { parentTaskId }),
				...(priority && { priority }),
				...(type && { type }),
				...(typeof ordinal === "number" && { ordinal }),
				...(typeof input.milestone === "string" &&
					input.milestone.trim().length > 0 && {
						milestone: input.milestone.trim(),
					}),
				...(typeof input.description === "string" && { description: input.description }),
				...(typeof input.implementationPlan === "string" && { implementationPlan: input.implementationPlan }),
				...(typeof input.implementationNotes === "string" && { implementationNotes: input.implementationNotes }),
				...(typeof input.finalSummary === "string" && { finalSummary: input.finalSummary }),
				...(acceptanceCriteriaItems.length > 0 && { acceptanceCriteriaItems }),
				...(definitionOfDoneItems && definitionOfDoneItems.length > 0 && { definitionOfDoneItems }),
			};

			const filePath = await this.writePreparedTask(task, isDraft);
			return { task, filePath };
		});

		const savedTask = await this.finalizeCreatedTask(task, filePath, isDraft, autoCommit);
		return { task: savedTask ?? task, filePath };
	}

	private async resolveParentTaskIdForCreate(parentTaskId: string): Promise<string> {
		const parentTask = await this.loadTaskById(parentTaskId);
		if (!parentTask) {
			const normalizedParent = normalizeTaskId(parentTaskId);
			throw new Error(
				`Parent task ${normalizedParent} not found. Use an existing task ID with --parent; use --milestone to assign a task to a milestone.`,
			);
		}
		return parentTask.id;
	}

	async createTask(task: Task, autoCommit?: boolean): Promise<string> {
		if (!task.status) {
			const config = await this.fs.loadConfig();
			task.status = config?.defaultStatus || FALLBACK_STATUS;
		}

		const filepath = await this.writePreparedTask(task, false);
		await this.finalizeCreatedTask(task, filepath, false, autoCommit);

		return filepath;
	}

	async updateTask(task: Task, autoCommit?: boolean): Promise<void> {
		normalizeAssignee(task);

		// Load original task to detect status changes for callbacks
		const originalTask = await this.fs.loadTask(task.id);
		const oldStatus = originalTask?.status ?? "";
		const newStatus = task.status ?? "";
		const statusChanged = oldStatus !== newStatus;

		if (hasUpdatedDateRelevantChanges(originalTask, task)) {
			task.updatedDate = new Date().toISOString().slice(0, 16).replace("T", " ");
		} else if (originalTask?.updatedDate) {
			task.updatedDate = originalTask.updatedDate;
		} else {
			delete task.updatedDate;
		}

		await this.fs.saveTask(task);
		// Keep any in-process ContentStore in sync for immediate UI/search freshness.
		if (this.contentStore) {
			const savedTask = await this.fs.loadTask(task.id);
			if (savedTask) {
				this.contentStore.upsertTask(savedTask);
			}
		}

		if (await this.shouldAutoCommit(autoCommit)) {
			const filePath = await getTaskPath(task.id, this);
			if (filePath) {
				await this.git.addAndCommitTaskFile(task.id, filePath, "update");
			}
		}

		// Fire status change callback if status changed
		if (statusChanged) {
			await this.executeStatusChangeCallback(task, oldStatus, newStatus);
		}
	}

	private async applyTaskUpdateInput(
		task: Task,
		input: TaskUpdateInput,
		statusResolver: (status: string) => Promise<string>,
	): Promise<{ task: Task; mutated: boolean }> {
		let mutated = false;

		const applyStringField = (
			value: string | undefined,
			current: string | undefined,
			assign: (next: string) => void,
		) => {
			if (typeof value === "string") {
				const next = value;
				if ((current ?? "") !== next) {
					assign(next);
					mutated = true;
				}
			}
		};

		if (input.title !== undefined) {
			const trimmed = input.title.trim();
			if (trimmed.length === 0) {
				throw new Error("Title cannot be empty.");
			}
			if (task.title !== trimmed) {
				task.title = trimmed;
				mutated = true;
			}
		}

		applyStringField(input.description, task.description, (next) => {
			task.description = next;
		});

		if (input.status !== undefined) {
			const canonicalStatus = await statusResolver(input.status);
			if ((task.status ?? "") !== canonicalStatus) {
				task.status = canonicalStatus;
				mutated = true;
			}
		}

		if (input.priority !== undefined) {
			const normalizedPriority = await this.normalizePriority(String(input.priority));
			if (task.priority !== normalizedPriority) {
				task.priority = normalizedPriority;
				mutated = true;
			}
		}

		if (input.type !== undefined) {
			const normalizedType = await this.normalizeTaskType(String(input.type));
			if (task.type !== normalizedType) {
				task.type = normalizedType;
				mutated = true;
			}
		}

		if (input.milestone !== undefined) {
			const normalizedMilestone =
				input.milestone === null ? undefined : input.milestone.trim().length > 0 ? input.milestone.trim() : undefined;
			if ((task.milestone ?? undefined) !== normalizedMilestone) {
				if (normalizedMilestone === undefined) {
					delete task.milestone;
				} else {
					task.milestone = normalizedMilestone;
				}
				mutated = true;
			}
		}

		if (input.ordinal !== undefined) {
			if (typeof input.ordinal !== "number" || !Number.isFinite(input.ordinal) || input.ordinal < 0) {
				throw new Error("Ordinal must be a non-negative number.");
			}
			if (task.ordinal !== input.ordinal) {
				task.ordinal = input.ordinal;
				mutated = true;
			}
		}

		if (input.assignee !== undefined) {
			const sanitizedAssignee = normalizeStringList(input.assignee) ?? [];
			if (!stringArraysEqual(sanitizedAssignee, task.assignee ?? [])) {
				task.assignee = sanitizedAssignee;
				mutated = true;
			}
		}

		const resolveLabelChanges = (): void => {
			let currentLabels = [...(task.labels ?? [])];
			if (input.labels !== undefined) {
				const sanitizedLabels = normalizeStringList(input.labels) ?? [];
				if (!stringArraysEqual(sanitizedLabels, currentLabels)) {
					task.labels = sanitizedLabels;
					mutated = true;
				}
				currentLabels = sanitizedLabels;
			}

			const labelsToAdd = normalizeStringList(input.addLabels) ?? [];
			if (labelsToAdd.length > 0) {
				const labelSet = new Set(currentLabels.map((label) => label.toLowerCase()));
				for (const label of labelsToAdd) {
					if (!labelSet.has(label.toLowerCase())) {
						currentLabels.push(label);
						labelSet.add(label.toLowerCase());
						mutated = true;
					}
				}
				task.labels = currentLabels;
			}

			const labelsToRemove = normalizeStringList(input.removeLabels) ?? [];
			if (labelsToRemove.length > 0) {
				const removalSet = new Set(labelsToRemove.map((label) => label.toLowerCase()));
				const filtered = currentLabels.filter((label) => !removalSet.has(label.toLowerCase()));
				if (!stringArraysEqual(filtered, currentLabels)) {
					task.labels = filtered;
					mutated = true;
				}
			}
		};

		resolveLabelChanges();

		const resolveDependencies = async (): Promise<void> => {
			let currentDependencies = [...(task.dependencies ?? [])];

			if (input.dependencies !== undefined) {
				const normalized = normalizeDependencies(input.dependencies);
				const { valid, invalid } = await validateDependencies(normalized, this);
				if (invalid.length > 0) {
					throw new Error(
						`The following dependencies do not exist: ${invalid.join(", ")}. Please create these tasks first or verify the IDs.`,
					);
				}
				if (!stringArraysEqual(valid, currentDependencies)) {
					currentDependencies = valid;
					mutated = true;
				}
			}

			if (input.addDependencies && input.addDependencies.length > 0) {
				const additions = normalizeDependencies(input.addDependencies);
				const { valid, invalid } = await validateDependencies(additions, this);
				if (invalid.length > 0) {
					throw new Error(
						`The following dependencies do not exist: ${invalid.join(", ")}. Please create these tasks first or verify the IDs.`,
					);
				}
				const depSet = new Set(currentDependencies);
				for (const dep of valid) {
					if (!depSet.has(dep)) {
						currentDependencies.push(dep);
						depSet.add(dep);
						mutated = true;
					}
				}
			}

			if (input.removeDependencies && input.removeDependencies.length > 0) {
				const removals = new Set(normalizeDependencies(input.removeDependencies));
				const filtered = currentDependencies.filter((dep) => !removals.has(dep));
				if (!stringArraysEqual(filtered, currentDependencies)) {
					currentDependencies = filtered;
					mutated = true;
				}
			}

			task.dependencies = currentDependencies;
		};

		await resolveDependencies();

		const resolveReferences = (): void => {
			let currentReferences = [...(task.references ?? [])];
			if (input.references !== undefined) {
				const sanitizedReferences = normalizeStringList(input.references) ?? [];
				if (!stringArraysEqual(sanitizedReferences, currentReferences)) {
					task.references = sanitizedReferences;
					mutated = true;
				}
				currentReferences = sanitizedReferences;
			}

			const referencesToAdd = normalizeStringList(input.addReferences) ?? [];
			if (referencesToAdd.length > 0) {
				const refSet = new Set(currentReferences);
				for (const ref of referencesToAdd) {
					if (!refSet.has(ref)) {
						currentReferences.push(ref);
						refSet.add(ref);
						mutated = true;
					}
				}
				task.references = currentReferences;
			}

			const referencesToRemove = normalizeStringList(input.removeReferences) ?? [];
			if (referencesToRemove.length > 0) {
				const removalSet = new Set(referencesToRemove);
				const filtered = currentReferences.filter((ref) => !removalSet.has(ref));
				if (!stringArraysEqual(filtered, currentReferences)) {
					task.references = filtered;
					mutated = true;
				}
			}
		};

		resolveReferences();

		const resolveDocumentation = (): void => {
			let currentDocumentation = [...(task.documentation ?? [])];
			if (input.documentation !== undefined) {
				const sanitizedDocumentation = normalizeStringList(input.documentation) ?? [];
				if (!stringArraysEqual(sanitizedDocumentation, currentDocumentation)) {
					task.documentation = sanitizedDocumentation;
					mutated = true;
				}
				currentDocumentation = sanitizedDocumentation;
			}

			const documentationToAdd = normalizeStringList(input.addDocumentation) ?? [];
			if (documentationToAdd.length > 0) {
				const docSet = new Set(currentDocumentation);
				for (const doc of documentationToAdd) {
					if (!docSet.has(doc)) {
						currentDocumentation.push(doc);
						docSet.add(doc);
						mutated = true;
					}
				}
				task.documentation = currentDocumentation;
			}

			const documentationToRemove = normalizeStringList(input.removeDocumentation) ?? [];
			if (documentationToRemove.length > 0) {
				const removalSet = new Set(documentationToRemove);
				const filtered = currentDocumentation.filter((doc) => !removalSet.has(doc));
				if (!stringArraysEqual(filtered, currentDocumentation)) {
					task.documentation = filtered;
					mutated = true;
				}
			}
		};

		resolveDocumentation();

		const resolveModifiedFiles = (): void => {
			if (input.modifiedFiles === undefined) {
				return;
			}
			const sanitizedModifiedFiles = normalizeStringList(input.modifiedFiles) ?? [];
			if (!stringArraysEqual(sanitizedModifiedFiles, task.modifiedFiles ?? [])) {
				task.modifiedFiles = sanitizedModifiedFiles;
				mutated = true;
			}
		};

		resolveModifiedFiles();

		const sanitizeAppendInput = (values: string[] | undefined): string[] => {
			if (!values) return [];
			return values.map((value) => String(value).trim()).filter((value) => value.length > 0);
		};

		const appendBlock = (
			existing: string | undefined,
			additions: string[] | undefined,
		): { value?: string; changed: boolean } => {
			const sanitizedAdditions = (additions ?? [])
				.map((value) => String(value).trim())
				.filter((value) => value.length > 0);
			if (sanitizedAdditions.length === 0) {
				return { value: existing, changed: false };
			}
			const current = (existing ?? "").trim();
			const additionBlock = sanitizedAdditions.join("\n\n");
			if (current.length === 0) {
				return { value: additionBlock, changed: true };
			}
			return { value: `${current}\n\n${additionBlock}`, changed: true };
		};

		const containsCommentMarker = (inputValue: string): boolean => /<!--\s*COMMENTS?:/i.test(inputValue);
		const containsCommentDelimiter = (inputValue: string): boolean =>
			/^\s*---\s*$/m.test(inputValue.replace(/\r\n/g, "\n"));

		const sanitizeCommentInput = (value: TaskCommentInput | string): TaskCommentInput | undefined => {
			const rawBody = typeof value === "string" ? value : value.body;
			const body = String(rawBody ?? "")
				.replace(/\r\n/g, "\n")
				.trim();
			if (body.length === 0) return undefined;
			if (containsCommentMarker(body)) {
				throw new Error("Comment body cannot contain Backlog comment markers.");
			}
			if (containsCommentDelimiter(body)) {
				throw new Error("Comment body cannot contain standalone '---' delimiter lines.");
			}
			const author =
				typeof value === "string"
					? undefined
					: String(value.author ?? "")
							.replace(/\s+/g, " ")
							.trim();
			const createdDate = typeof value === "string" ? undefined : String(value.createdDate ?? "").trim();
			if (author && containsCommentMarker(author)) {
				throw new Error("Comment author cannot contain Backlog comment markers.");
			}
			if (author && containsCommentDelimiter(author)) {
				throw new Error("Comment author cannot contain standalone '---' delimiter lines.");
			}
			if (createdDate && containsCommentMarker(createdDate)) {
				throw new Error("Comment created date cannot contain Backlog comment markers.");
			}
			if (createdDate && containsCommentDelimiter(createdDate)) {
				throw new Error("Comment created date cannot contain standalone '---' delimiter lines.");
			}
			return {
				body,
				...(author && { author }),
				...(createdDate && { createdDate }),
			};
		};

		if (input.clearImplementationPlan) {
			if (task.implementationPlan !== undefined) {
				delete task.implementationPlan;
				mutated = true;
			}
		}

		applyStringField(input.implementationPlan, task.implementationPlan, (next) => {
			task.implementationPlan = next;
		});

		const planAppends = sanitizeAppendInput(input.appendImplementationPlan);
		if (planAppends.length > 0) {
			const { value, changed } = appendBlock(task.implementationPlan, planAppends);
			if (changed) {
				task.implementationPlan = value;
				mutated = true;
			}
		}

		if (input.clearImplementationNotes) {
			if (task.implementationNotes !== undefined) {
				delete task.implementationNotes;
				mutated = true;
			}
		}

		applyStringField(input.implementationNotes, task.implementationNotes, (next) => {
			task.implementationNotes = next;
		});

		const notesAppends = sanitizeAppendInput(input.appendImplementationNotes);
		if (notesAppends.length > 0) {
			const { value, changed } = appendBlock(task.implementationNotes, notesAppends);
			if (changed) {
				task.implementationNotes = value;
				mutated = true;
			}
		}

		if (input.appendComments && input.appendComments.length > 0) {
			const currentComments = Array.isArray(task.comments) ? task.comments.map((comment) => ({ ...comment })) : [];
			let nextIndex = currentComments.length > 0 ? Math.max(...currentComments.map((comment) => comment.index)) + 1 : 1;
			const createdDate = new Date().toISOString().slice(0, 16).replace("T", " ");
			for (const value of input.appendComments) {
				const sanitized = sanitizeCommentInput(value);
				if (!sanitized) continue;
				currentComments.push({
					index: nextIndex++,
					body: sanitized.body,
					createdDate: sanitized.createdDate ?? createdDate,
					...(sanitized.author && { author: sanitized.author }),
				});
				mutated = true;
			}
			if (mutated) {
				task.comments = currentComments;
			}
		}

		if (input.clearFinalSummary) {
			if (task.finalSummary !== undefined) {
				task.finalSummary = "";
				mutated = true;
			}
		}

		applyStringField(input.finalSummary, task.finalSummary, (next) => {
			task.finalSummary = next;
		});

		const finalSummaryAppends = sanitizeAppendInput(input.appendFinalSummary);
		if (finalSummaryAppends.length > 0) {
			const { value, changed } = appendBlock(task.finalSummary, finalSummaryAppends);
			if (changed) {
				task.finalSummary = value;
				mutated = true;
			}
		}

		let acceptanceCriteria = Array.isArray(task.acceptanceCriteriaItems)
			? task.acceptanceCriteriaItems.map((criterion) => ({ ...criterion }))
			: [];

		const rebuildIndices = () => {
			acceptanceCriteria = acceptanceCriteria.map((criterion, index) => ({
				...criterion,
				index: index + 1,
			}));
		};

		if (input.acceptanceCriteria !== undefined) {
			const sanitized = input.acceptanceCriteria
				.map((criterion) => ({
					text: String(criterion.text ?? "").trim(),
					checked: Boolean(criterion.checked),
				}))
				.filter((criterion) => criterion.text.length > 0)
				.map((criterion, index) => ({
					index: index + 1,
					text: criterion.text,
					checked: criterion.checked,
				}));
			acceptanceCriteria = sanitized;
			mutated = true;
		}

		if (input.addAcceptanceCriteria && input.addAcceptanceCriteria.length > 0) {
			const additions = input.addAcceptanceCriteria
				.map((criterion) => (typeof criterion === "string" ? criterion.trim() : String(criterion.text ?? "").trim()))
				.filter((text) => text.length > 0);
			let index =
				acceptanceCriteria.length > 0 ? Math.max(...acceptanceCriteria.map((criterion) => criterion.index)) + 1 : 1;
			for (const text of additions) {
				acceptanceCriteria.push({ index: index++, text, checked: false });
				mutated = true;
			}
		}

		if (input.removeAcceptanceCriteria && input.removeAcceptanceCriteria.length > 0) {
			const removalSet = new Set(input.removeAcceptanceCriteria);
			const beforeLength = acceptanceCriteria.length;
			acceptanceCriteria = acceptanceCriteria.filter((criterion) => !removalSet.has(criterion.index));
			if (acceptanceCriteria.length === beforeLength) {
				throw new Error(
					`Acceptance criterion ${Array.from(removalSet)
						.map((index) => `#${index}`)
						.join(", ")} not found. ${formatAvailableIndexHint(
						acceptanceCriteria,
						"No acceptance criteria are defined.",
					)}`,
				);
			}
			mutated = true;
			rebuildIndices();
		}

		const toggleCriteria = (indices: number[] | undefined, checked: boolean) => {
			if (!indices || indices.length === 0) return;
			const missing: number[] = [];
			for (const index of indices) {
				const criterion = acceptanceCriteria.find((item) => item.index === index);
				if (!criterion) {
					missing.push(index);
					continue;
				}
				if (criterion.checked !== checked) {
					criterion.checked = checked;
					mutated = true;
				}
			}
			if (missing.length > 0) {
				const label = missing.map((index) => `#${index}`).join(", ");
				throw new Error(
					`Acceptance criterion ${label} not found. ${formatAvailableIndexHint(
						acceptanceCriteria,
						"No acceptance criteria are defined.",
					)}`,
				);
			}
		};

		toggleCriteria(input.checkAcceptanceCriteria, true);
		toggleCriteria(input.uncheckAcceptanceCriteria, false);

		task.acceptanceCriteriaItems = acceptanceCriteria;

		let definitionOfDone = Array.isArray(task.definitionOfDoneItems)
			? task.definitionOfDoneItems.map((criterion) => ({ ...criterion }))
			: [];

		const rebuildDefinitionIndices = () => {
			definitionOfDone = definitionOfDone.map((criterion, index) => ({
				...criterion,
				index: index + 1,
			}));
		};

		if (input.addDefinitionOfDone && input.addDefinitionOfDone.length > 0) {
			const additions = input.addDefinitionOfDone
				.map((criterion) => (typeof criterion === "string" ? criterion.trim() : String(criterion.text ?? "").trim()))
				.filter((text) => text.length > 0);
			let index =
				definitionOfDone.length > 0 ? Math.max(...definitionOfDone.map((criterion) => criterion.index)) + 1 : 1;
			for (const text of additions) {
				definitionOfDone.push({ index: index++, text, checked: false });
				mutated = true;
			}
		}

		const toggleDefinitionItems = (indices: number[] | undefined, checked: boolean) => {
			if (!indices || indices.length === 0) return;
			const missing: number[] = [];
			for (const index of indices) {
				const criterion = definitionOfDone.find((item) => item.index === index);
				if (!criterion) {
					missing.push(index);
					continue;
				}
				if (criterion.checked !== checked) {
					criterion.checked = checked;
					mutated = true;
				}
			}
			if (missing.length > 0) {
				const label = missing.map((index) => `#${index}`).join(", ");
				throw new Error(
					`Definition of Done item ${label} not found. ${formatAvailableIndexHint(
						definitionOfDone,
						"No Definition of Done items are defined.",
					)}`,
				);
			}
		};

		toggleDefinitionItems(input.checkDefinitionOfDone, true);
		toggleDefinitionItems(input.uncheckDefinitionOfDone, false);

		if (input.removeDefinitionOfDone && input.removeDefinitionOfDone.length > 0) {
			const removalSet = new Set(input.removeDefinitionOfDone);
			const beforeLength = definitionOfDone.length;
			definitionOfDone = definitionOfDone.filter((criterion) => !removalSet.has(criterion.index));
			if (definitionOfDone.length === beforeLength) {
				throw new Error(
					`Definition of Done item ${Array.from(removalSet)
						.map((index) => `#${index}`)
						.join(", ")} not found. ${formatAvailableIndexHint(
						definitionOfDone,
						"No Definition of Done items are defined.",
					)}`,
				);
			}
			mutated = true;
			rebuildDefinitionIndices();
		}

		task.definitionOfDoneItems = definitionOfDone;

		return { task, mutated };
	}

	async updateTaskFromInput(taskId: string, input: TaskUpdateInput, autoCommit?: boolean): Promise<Task> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		const requestedStatus = input.status?.trim().toLowerCase();
		if (requestedStatus === "draft") {
			return await this.demoteTaskWithUpdates(task, input, autoCommit);
		}

		const { mutated } = await this.applyTaskUpdateInput(task, input, async (status) =>
			this.requireCanonicalStatus(status),
		);

		if (!mutated) {
			return task;
		}

		await this.updateTask(task, autoCommit);
		const refreshed = await this.fs.loadTask(taskId);
		return refreshed ?? task;
	}

	async updateDraft(task: Task, autoCommit?: boolean): Promise<void> {
		// Drafts always keep status Draft
		task.status = "Draft";
		normalizeAssignee(task);
		task.updatedDate = new Date().toISOString().slice(0, 16).replace("T", " ");

		const filepath = await this.fs.saveDraft(task);

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.git.addFile(filepath);
			await this.git.commitTaskChange(task.id, `Update draft ${task.id}`, filepath);
		}
	}

	async updateDraftFromInput(draftId: string, input: TaskUpdateInput, autoCommit?: boolean): Promise<Task> {
		const draft = await this.fs.loadDraft(draftId);
		if (!draft) {
			throw new Error(`Draft not found: ${draftId}`);
		}

		const { mutated } = await this.applyTaskUpdateInput(draft, input, async (status) => {
			if (status.trim().toLowerCase() !== "draft") {
				throw new Error("Drafts must use status Draft.");
			}
			return "Draft";
		});

		if (!mutated) {
			return draft;
		}

		await this.updateDraft(draft, autoCommit);
		const refreshed = await this.fs.loadDraft(draftId);
		return refreshed ?? draft;
	}

	async editTaskOrDraft(taskId: string, input: TaskUpdateInput, autoCommit?: boolean): Promise<Task> {
		const draft = await this.fs.loadDraft(taskId);
		if (draft) {
			const requestedStatus = input.status?.trim();
			const wantsDraft = requestedStatus?.toLowerCase() === "draft";
			if (requestedStatus && !wantsDraft) {
				return await this.promoteDraftWithUpdates(draft, input, autoCommit);
			}
			return await this.updateDraftFromInput(draft.id, input, autoCommit);
		}

		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		const requestedStatus = input.status?.trim();
		const wantsDraft = requestedStatus?.toLowerCase() === "draft";
		if (wantsDraft) {
			return await this.demoteTaskWithUpdates(task, input, autoCommit);
		}

		return await this.updateTaskFromInput(task.id, input, autoCommit);
	}

	private async promoteDraftWithUpdates(draft: Task, input: TaskUpdateInput, autoCommit?: boolean): Promise<Task> {
		const targetStatus = input.status?.trim();
		if (!targetStatus || targetStatus.toLowerCase() === "draft") {
			throw new Error("Promoting a draft requires a non-draft status.");
		}

		const { mutated } = await this.applyTaskUpdateInput(draft, { ...input, status: undefined }, async (status) => {
			if (status.trim().toLowerCase() !== "draft") {
				throw new Error("Drafts must use status Draft.");
			}
			return "Draft";
		});

		const canonicalStatus = await this.requireCanonicalStatus(targetStatus);

		const { promotedTask, savedPath } = await this.withCreateLock(async () => {
			const newTaskId = await this.generateNextId(EntityType.Task, draft.parentTaskId);
			const draftPath = draft.filePath;

			const promotedTask: Task = {
				...draft,
				id: newTaskId,
				status: canonicalStatus,
				filePath: undefined,
				...(mutated || draft.status !== canonicalStatus
					? { updatedDate: new Date().toISOString().slice(0, 16).replace("T", " ") }
					: {}),
			};

			normalizeAssignee(promotedTask);
			const savedPath = await this.fs.saveTask(promotedTask);

			if (draftPath) {
				await unlink(draftPath);
			}

			return { promotedTask, savedPath };
		});

		const savedTask = await this.fs.loadTask(promotedTask.id);
		if (this.contentStore && savedTask) {
			this.contentStore.upsertTask(savedTask);
		}

		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			const repoRoot = await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Promote draft ${normalizeId(draft.id, "draft")}`, repoRoot);
		}

		return savedTask ?? { ...promotedTask, filePath: savedPath };
	}

	private async demoteTaskWithUpdates(task: Task, input: TaskUpdateInput, autoCommit?: boolean): Promise<Task> {
		const { mutated } = await this.applyTaskUpdateInput(task, { ...input, status: undefined }, async (status) => {
			if (status.trim().toLowerCase() === "draft") {
				return "Draft";
			}
			return this.requireCanonicalStatus(status);
		});

		const { demotedDraft, savedPath } = await this.withCreateLock(async () => {
			const newDraftId = await this.generateNextId(EntityType.Draft);
			const taskPath = task.filePath;

			const demotedDraft: Task = {
				...task,
				id: newDraftId,
				status: "Draft",
				filePath: undefined,
				...(mutated || task.status !== "Draft"
					? { updatedDate: new Date().toISOString().slice(0, 16).replace("T", " ") }
					: {}),
			};

			normalizeAssignee(demotedDraft);
			const savedPath = await this.fs.saveDraft(demotedDraft);

			if (taskPath) {
				await unlink(taskPath);
			}

			return { demotedDraft, savedPath };
		});

		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			const repoRoot = await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Demote task ${normalizeTaskId(task.id)}`, repoRoot);
		}

		return (await this.fs.loadDraft(demotedDraft.id)) ?? { ...demotedDraft, filePath: savedPath };
	}

	/**
	 * Execute the onStatusChange callback if configured.
	 * Per-task callback takes precedence over global config.
	 * Failures are logged but don't block the status change.
	 */
	private async executeStatusChangeCallback(task: Task, oldStatus: string, newStatus: string): Promise<void> {
		const config = await this.fs.loadConfig();

		// Per-task callback takes precedence over global config
		const callbackCommand = task.onStatusChange ?? config?.onStatusChange;
		if (!callbackCommand) {
			return;
		}

		try {
			const result = await executeStatusCallback({
				command: callbackCommand,
				taskId: task.id,
				oldStatus,
				newStatus,
				taskTitle: task.title,
				cwd: this.fs.rootDir,
			});

			if (!result.success) {
				console.error(`Status change callback failed for ${task.id}: ${result.error ?? "Unknown error"}`);
				if (result.output) {
					console.error(`Callback output: ${result.output}`);
				}
			} else if (process.env.DEBUG && result.output) {
				console.log(`Status change callback output for ${task.id}: ${result.output}`);
			}
		} catch (error) {
			console.error(`Failed to execute status change callback for ${task.id}:`, error);
		}
	}

	async editTask(taskId: string, input: TaskUpdateInput, autoCommit?: boolean): Promise<Task> {
		return await this.updateTaskFromInput(taskId, input, autoCommit);
	}

	async updateTasksBulk(tasks: Task[], commitMessage?: string, autoCommit?: boolean): Promise<void> {
		// Update all tasks without committing individually
		for (const task of tasks) {
			await this.updateTask(task, false); // Don't auto-commit each one
		}

		// Commit all changes at once if auto-commit is enabled
		if (await this.shouldAutoCommit(autoCommit)) {
			const filePaths: string[] = [];
			for (const task of tasks) {
				const filePath = await getTaskPath(task.id, this);
				if (filePath) filePaths.push(filePath);
			}
			if (filePaths.length > 0) {
				await this.git.addFiles(filePaths);
				await this.git.commitFiles(commitMessage || `Update ${tasks.length} tasks`, filePaths);
			}
		}
	}

	async reorderTask(params: {
		taskId: string;
		targetStatus: string;
		orderedTaskIds: string[];
		targetMilestone?: string | null;
		commitMessage?: string;
		autoCommit?: boolean;
		defaultStep?: number;
	}): Promise<{ updatedTask: Task; changedTasks: Task[] }> {
		const taskId = normalizeTaskId(String(params.taskId || "").trim());
		const targetStatus = String(params.targetStatus || "").trim();
		const orderedTaskIds = params.orderedTaskIds.map((id) => normalizeTaskId(String(id || "").trim())).filter(Boolean);
		const defaultStep = params.defaultStep ?? DEFAULT_ORDINAL_STEP;

		if (!taskId) throw new Error("taskId is required");
		if (!targetStatus) throw new Error("targetStatus is required");
		if (orderedTaskIds.length === 0) throw new Error("orderedTaskIds must include at least one task");
		if (!orderedTaskIds.includes(taskId)) {
			throw new Error("orderedTaskIds must include the task being moved");
		}

		const seen = new Set<string>();
		for (const id of orderedTaskIds) {
			if (seen.has(id)) {
				throw new Error(`Duplicate task id ${id} in orderedTaskIds`);
			}
			seen.add(id);
		}

		// Load all tasks from the ordered list - use getTask to include cross-branch tasks from the store
		const loadedTasks = await Promise.all(
			orderedTaskIds.map(async (id) => {
				const task = await this.getTask(id);
				return task;
			}),
		);

		// Filter out any tasks that couldn't be loaded (may have been moved/deleted)
		const validTasks = loadedTasks.filter((t): t is Task => t !== null);

		// Verify the moved task itself exists
		const movedTask = validTasks.find((t) => t.id === taskId);
		if (!movedTask) {
			throw new Error(`Task ${taskId} not found while reordering`);
		}

		// Reject reordering tasks from other branches - they can only be modified in their source branch
		if (movedTask.branch) {
			throw new Error(
				`Task ${taskId} exists in branch "${movedTask.branch}" and cannot be reordered from the current branch. Switch to that branch to modify it.`,
			);
		}

		const hasTargetMilestone = params.targetMilestone !== undefined;
		const normalizedTargetMilestone =
			params.targetMilestone === null
				? undefined
				: typeof params.targetMilestone === "string" && params.targetMilestone.trim().length > 0
					? params.targetMilestone.trim()
					: undefined;

		// Calculate target index within the valid tasks list
		const validOrderedIds = orderedTaskIds.filter((id) => validTasks.some((t) => t.id === id));
		const targetIndex = validOrderedIds.indexOf(taskId);

		if (targetIndex === -1) {
			throw new Error("Implementation error: Task found in validTasks but index missing");
		}

		const previousTask = targetIndex > 0 ? validTasks[targetIndex - 1] : null;
		const nextTask = targetIndex < validTasks.length - 1 ? validTasks[targetIndex + 1] : null;

		const { ordinal: newOrdinal, requiresRebalance } = calculateNewOrdinal({
			previous: previousTask,
			next: nextTask,
			defaultStep,
		});

		const updatedMoved: Task = {
			...movedTask,
			status: targetStatus,
			...(hasTargetMilestone ? { milestone: normalizedTargetMilestone } : {}),
			ordinal: newOrdinal,
		};

		const tasksInOrder: Task[] = validTasks.map((task, index) => (index === targetIndex ? updatedMoved : task));
		const resolutionUpdates = resolveOrdinalConflicts(tasksInOrder, {
			defaultStep,
			startOrdinal: defaultStep,
			forceSequential: requiresRebalance,
		});

		const updatesMap = new Map<string, Task>();
		for (const update of resolutionUpdates) {
			updatesMap.set(update.id, update);
		}
		if (!updatesMap.has(updatedMoved.id)) {
			updatesMap.set(updatedMoved.id, updatedMoved);
		}

		const originalMap = new Map(validTasks.map((task) => [task.id, task]));
		const changedTasks = Array.from(updatesMap.values()).filter((task) => {
			const original = originalMap.get(task.id);
			if (!original) return true;
			return (
				(original.ordinal ?? null) !== (task.ordinal ?? null) ||
				(original.status ?? "") !== (task.status ?? "") ||
				(original.milestone ?? "") !== (task.milestone ?? "")
			);
		});

		if (changedTasks.length > 0) {
			await this.updateTasksBulk(
				changedTasks,
				params.commitMessage ?? `Reorder tasks in ${targetStatus}`,
				params.autoCommit,
			);
		}

		const updatedTask = updatesMap.get(taskId) ?? updatedMoved;
		return { updatedTask, changedTasks };
	}

	async archiveTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const taskToArchive = await this.fs.loadTask(taskId);
		if (!taskToArchive) {
			return false;
		}
		const normalizedTaskId = taskToArchive.id;

		// Get paths before moving the file
		const taskPath = taskToArchive.filePath ?? (await getTaskPath(normalizedTaskId, this));
		const taskFilename = await getTaskFilename(normalizedTaskId, this);

		if (!taskPath || !taskFilename) return false;

		const fromPath = taskPath;
		const toPath = join(await this.fs.getArchiveTasksDir(), taskFilename);

		const success = await this.fs.archiveTask(normalizedTaskId);
		if (!success) {
			return false;
		}

		const activeTasks = await this.fs.listTasks();
		const sanitizedTasks = this.sanitizeArchivedTaskLinks(activeTasks, normalizedTaskId);
		if (sanitizedTasks.length > 0) {
			await this.updateTasksBulk(sanitizedTasks, undefined, false);
		}

		if (await this.shouldAutoCommit(autoCommit)) {
			// Stage the file move for proper Git tracking
			const repoRoot = await this.git.stageFileMove(fromPath, toPath);
			const commitPaths = [fromPath, toPath];
			for (const sanitizedTask of sanitizedTasks) {
				if (sanitizedTask.filePath) {
					await this.git.addFile(sanitizedTask.filePath);
					commitPaths.push(sanitizedTask.filePath);
				}
			}
			await this.git.commitFiles(`backlog: Archive task ${normalizedTaskId}`, commitPaths, repoRoot);
		}

		return true;
	}

	async archiveMilestone(
		identifier: string,
		autoCommit?: boolean,
	): Promise<{ success: boolean; sourcePath?: string; targetPath?: string; milestone?: Milestone }> {
		const result = await this.fs.archiveMilestone(identifier);

		if (result.success && result.sourcePath && result.targetPath && (await this.shouldAutoCommit(autoCommit))) {
			const repoRoot = await this.git.stageFileMove(result.sourcePath, result.targetPath);
			const label = result.milestone?.id ? ` ${result.milestone.id}` : "";
			const commitPaths = [result.sourcePath, result.targetPath];
			try {
				await this.git.commitFiles(`backlog: Archive milestone${label}`, commitPaths, repoRoot);
			} catch (error) {
				await this.git.resetPaths(commitPaths, repoRoot);
				try {
					await moveFile(result.targetPath, result.sourcePath);
				} catch {
					// Ignore rollback failure and propagate original commit error.
				}
				throw error;
			}
		}

		return {
			success: result.success,
			sourcePath: result.sourcePath,
			targetPath: result.targetPath,
			milestone: result.milestone,
		};
	}

	async renameMilestone(
		identifier: string,
		title: string,
		autoCommit?: boolean,
	): Promise<{
		success: boolean;
		sourcePath?: string;
		targetPath?: string;
		milestone?: Milestone;
		previousTitle?: string;
	}> {
		const result = await this.fs.renameMilestone(identifier, title);
		if (!result.success) {
			return result;
		}

		if (result.sourcePath && result.targetPath && (await this.shouldAutoCommit(autoCommit))) {
			const repoRoot = await this.git.stageFileMove(result.sourcePath, result.targetPath);
			const label = result.milestone?.id ? ` ${result.milestone.id}` : "";
			const commitPaths = [result.sourcePath, result.targetPath];
			try {
				await this.git.commitFiles(`backlog: Rename milestone${label}`, commitPaths, repoRoot);
			} catch (error) {
				await this.git.resetPaths(commitPaths, repoRoot);
				const rollbackTitle = result.previousTitle ?? title;
				try {
					await this.fs.renameMilestone(result.milestone?.id ?? identifier, rollbackTitle);
				} catch {
					// Ignore rollback failure and propagate original commit error.
				}
				throw error;
			}
		}

		return result;
	}

	async completeTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const task = await this.fs.loadTask(taskId);
		if (!task) return false;
		// Get paths before moving the file
		const completedDir = this.fs.completedDir;
		const taskPath = task.filePath ?? (await getTaskPath(task.id, this));
		const taskFilename = taskPath ? basename(taskPath) : null;

		if (!taskPath || !taskFilename) return false;

		const fromPath = taskPath;
		const toPath = join(completedDir, taskFilename);

		const success = await this.fs.completeTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			// Stage the file move for proper Git tracking
			const repoRoot = await this.git.stageFileMove(fromPath, toPath);
			await this.git.commitFiles(`backlog: Complete task ${normalizeTaskId(taskId)}`, [fromPath, toPath], repoRoot);
		}

		return success;
	}

	async getTerminalStatusTasksByAge(olderThanDays: number): Promise<Task[]> {
		const tasks = await this.fs.listTasks();
		const config = await this.fs.loadConfig();
		const statuses = config?.statuses ?? [...DEFAULT_STATUSES];
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

		return tasks.filter((task) => {
			if (!isTerminalStatus(task.status, statuses)) return false;

			// Check updatedDate first, then createdDate as fallback
			const taskDate = task.updatedDate || task.createdDate;
			if (!taskDate) return false;

			const date = new Date(taskDate);
			return date < cutoffDate;
		});
	}

	async archiveDraft(draftId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.archiveDraft(draftId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			const repoRoot = await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Archive draft ${normalizeId(draftId, "draft")}`, repoRoot);
		}

		return success;
	}

	async promoteDraft(draftId: string, autoCommit?: boolean): Promise<boolean> {
		let success = false;
		try {
			success = await this.withCreateLock(async () => {
				const draft = await this.fs.loadDraft(draftId);
				if (!draft?.filePath) return false;

				const config = await this.fs.loadConfig();
				const newTaskId = await this.generateNextId(EntityType.Task, draft.parentTaskId);
				const promotedStatus =
					!draft.status || draft.status.trim().toLowerCase() === "draft"
						? config?.defaultStatus || FALLBACK_STATUS
						: draft.status;

				const promotedTask: Task = {
					...draft,
					id: newTaskId,
					status: promotedStatus,
					filePath: undefined,
				};

				normalizeAssignee(promotedTask);
				await this.fs.saveTask(promotedTask);
				await unlink(draft.filePath);

				const savedTask = await this.fs.loadTask(promotedTask.id);
				if (this.contentStore && savedTask) {
					this.contentStore.upsertTask(savedTask);
				}

				return true;
			});
		} catch (error) {
			if (isCreateLockError(error)) {
				throw error;
			}
			return false;
		}

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			const repoRoot = await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Promote draft ${normalizeId(draftId, "draft")}`, repoRoot);
		}

		return success;
	}

	async demoteTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.demoteTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			const repoRoot = await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Demote task ${normalizeTaskId(taskId)}`, repoRoot);
		}

		return success;
	}

	/**
	 * Add acceptance criteria to a task
	 */
	async addAcceptanceCriteria(taskId: string, criteria: string[], autoCommit?: boolean): Promise<void> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		// Get existing criteria or initialize empty array
		const current = Array.isArray(task.acceptanceCriteriaItems) ? [...task.acceptanceCriteriaItems] : [];

		// Calculate next index (1-based)
		let nextIndex = current.length > 0 ? Math.max(...current.map((c) => c.index)) + 1 : 1;

		// Append new criteria
		const newCriteria = criteria.map((text) => ({ index: nextIndex++, text, checked: false }));
		task.acceptanceCriteriaItems = [...current, ...newCriteria];

		// Save the task
		await this.updateTask(task, autoCommit);
	}

	/**
	 * Remove acceptance criteria by indices (supports batch operations)
	 * @returns Array of removed indices
	 */
	async removeAcceptanceCriteria(taskId: string, indices: number[], autoCommit?: boolean): Promise<number[]> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		let list = Array.isArray(task.acceptanceCriteriaItems) ? [...task.acceptanceCriteriaItems] : [];
		const removed: number[] = [];

		// Sort indices in descending order to avoid index shifting issues
		const sortedIndices = [...indices].sort((a, b) => b - a);

		for (const idx of sortedIndices) {
			const before = list.length;
			list = list.filter((c) => c.index !== idx);
			if (list.length < before) {
				removed.push(idx);
			}
		}

		if (removed.length === 0) {
			throw new Error("No criteria were removed. Check that the specified indices exist.");
		}

		// Re-index remaining items (1-based)
		list = list.map((c, i) => ({ ...c, index: i + 1 }));
		task.acceptanceCriteriaItems = list;

		// Save the task
		await this.updateTask(task, autoCommit);

		return removed.sort((a, b) => a - b); // Return in ascending order
	}

	/**
	 * Check or uncheck acceptance criteria by indices (supports batch operations)
	 * Silently ignores invalid indices and only updates valid ones.
	 * @returns Array of updated indices
	 */
	async checkAcceptanceCriteria(
		taskId: string,
		indices: number[],
		checked: boolean,
		autoCommit?: boolean,
	): Promise<number[]> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		let list = Array.isArray(task.acceptanceCriteriaItems) ? [...task.acceptanceCriteriaItems] : [];
		const updated: number[] = [];

		// Filter to only valid indices and update them
		for (const idx of indices) {
			if (list.some((c) => c.index === idx)) {
				list = list.map((c) => {
					if (c.index === idx) {
						updated.push(idx);
						return { ...c, checked };
					}
					return c;
				});
			}
		}

		if (updated.length === 0) {
			throw new Error("No criteria were updated.");
		}

		task.acceptanceCriteriaItems = list;

		// Save the task
		await this.updateTask(task, autoCommit);

		return updated.sort((a, b) => a - b);
	}

	/**
	 * List all acceptance criteria for a task
	 */
	async listAcceptanceCriteria(taskId: string): Promise<AcceptanceCriterion[]> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

		return task.acceptanceCriteriaItems || [];
	}

	/**
	 * Stage and commit a single written file, scoped to exactly the paths this write touched
	 * (the new file, plus any previous paths it replaced). Never sweeps in unrelated dirty state.
	 */
	private async commitWrittenFile(message: string, previousPaths: string[], newPath: string): Promise<void> {
		if (previousPaths.length > 0) {
			let repoRoot: string | null = null;
			for (const previousPath of previousPaths) {
				repoRoot = await this.git.stageFileMove(previousPath, newPath);
			}
			await this.git.commitFiles(message, [...previousPaths, newPath], repoRoot);
		} else {
			await this.git.addFile(newPath);
			await this.git.commitFiles(message, [newPath]);
		}
	}

	async createDecision(decision: Decision, autoCommit?: boolean): Promise<void> {
		const { filepath, removedFilepaths } = await this.fs.saveDecision(decision);

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.commitWrittenFile(`backlog: Add decision ${decision.id}`, removedFilepaths, filepath);
		}
	}

	async updateDecisionFromContent(decisionId: string, content: string, autoCommit?: boolean): Promise<void> {
		const existingDecision = await this.fs.loadDecision(decisionId);
		if (!existingDecision) {
			throw new Error(`Decision ${decisionId} not found`);
		}

		// Parse the markdown content to extract the decision data
		const matter = await import("gray-matter");
		const { data } = matter.default(content);

		const extractSection = (content: string, sectionName: string): string | undefined => {
			const regex = new RegExp(`## ${sectionName}\\s*([\\s\\S]*?)(?=## |$)`, "i");
			const match = content.match(regex);
			return match ? match[1]?.trim() : undefined;
		};

		const updatedDecision = {
			...existingDecision,
			title: data.title || existingDecision.title,
			status: data.status || existingDecision.status,
			date: data.date || existingDecision.date,
			context: extractSection(content, "Context") || existingDecision.context,
			decision: extractSection(content, "Decision") || existingDecision.decision,
			consequences: extractSection(content, "Consequences") || existingDecision.consequences,
			alternatives: extractSection(content, "Alternatives") || existingDecision.alternatives,
		};

		await this.createDecision(updatedDecision, autoCommit);
	}

	async createDecisionWithTitle(title: string, autoCommit?: boolean): Promise<Decision> {
		// Import the generateNextDecisionId function from CLI
		const { generateNextDecisionId } = await import("../cli.js");
		const id = await generateNextDecisionId(this);

		const decision: Decision = {
			id,
			title,
			date: new Date().toISOString().slice(0, 16).replace("T", " "),
			status: "proposed",
			context: "[Describe the context and problem that needs to be addressed]",
			decision: "[Describe the decision that was made]",
			consequences: "[Describe the consequences of this decision]",
			rawContent: "",
		};

		await this.createDecision(decision, autoCommit);
		return decision;
	}

	async createDocument(doc: Document, autoCommit?: boolean, subPath = ""): Promise<void> {
		const previousRelativePath = doc.path;
		const relativePath = await this.fs.saveDocument(doc, normalizeDocumentSubPath(subPath));
		doc.path = relativePath;

		if (await this.shouldAutoCommit(autoCommit)) {
			const docsDir = this.fs.docsDir;
			const absolutePath = join(docsDir, ...relativePath.split("/"));
			const previousPaths =
				previousRelativePath && previousRelativePath !== relativePath
					? [join(docsDir, ...previousRelativePath.split("/"))]
					: [];
			await this.commitWrittenFile(`backlog: Add document ${doc.id}`, previousPaths, absolutePath);
		}
	}

	async updateDocument(existingDoc: Document, content: string, autoCommit?: boolean): Promise<void> {
		await this.updateDocumentFromInput(
			{
				id: existingDoc.id,
				title: existingDoc.title,
				type: existingDoc.type,
				tags: existingDoc.tags,
				content,
				...(existingDoc.path !== undefined && { path: getDocumentSubPathFromRelativePath(existingDoc.path) }),
			},
			autoCommit,
		);
	}

	async createDocumentWithId(title: string, content: string, autoCommit?: boolean): Promise<Document> {
		return await this.createDocumentFromInput({ title, content }, autoCommit);
	}

	async createDocumentFromInput(input: DocumentCreateInput, autoCommit?: boolean): Promise<Document> {
		const title = input.title.trim();
		if (!title) {
			throw new Error("Title is required to create a document.");
		}

		const subPath = normalizeDocumentSubPath(input.path);
		const tags = normalizeStringList(input.tags);
		const type = normalizeDocumentTypeInput(input.type) ?? "other";
		const document = await this.withCreateLock(async () => {
			const id = normalizeDocumentId(await generateNextDocId(this));
			const document: Document = {
				id,
				title,
				type,
				createdDate: new Date().toISOString().slice(0, 16).replace("T", " "),
				rawContent: input.content ?? "",
				...(tags && tags.length > 0 && { tags }),
			};

			await this.createDocument(document, autoCommit, subPath);
			return document;
		});

		return (await this.getDocument(document.id)) ?? document;
	}

	async updateDocumentFromInput(input: DocumentUpdateInput, autoCommit?: boolean): Promise<Document> {
		const existingDoc = await this.getDocument(input.id);
		if (!existingDoc) {
			throw new Error(`Document not found: ${input.id}`);
		}

		const normalizedTitle = input.title?.trim();
		if (input.title !== undefined && !normalizedTitle) {
			throw new Error("Document title cannot be empty.");
		}

		const tags = input.tags !== undefined ? normalizeStringList(input.tags) : existingDoc.tags;
		const type = normalizeDocumentTypeInput(input.type) ?? existingDoc.type;
		const subPath =
			input.path === undefined
				? getDocumentSubPathFromRelativePath(existingDoc.path)
				: normalizeDocumentSubPath(input.path);
		const updatedDoc: Document = {
			...existingDoc,
			id: normalizeDocumentId(existingDoc.id),
			title: normalizedTitle ?? existingDoc.title,
			type,
			rawContent: input.content,
			updatedDate: new Date().toISOString().slice(0, 16).replace("T", " "),
			tags: tags && tags.length > 0 ? tags : undefined,
		};

		await this.createDocument(updatedDoc, autoCommit, subPath);
		return (await this.getDocument(existingDoc.id)) ?? updatedDoc;
	}

	async listTasksWithMetadata(
		includeBranchMeta = false,
	): Promise<Array<Task & { lastModified?: Date; branch?: string }>> {
		const tasks = await this.fs.listTasks();
		return await Promise.all(
			tasks.map(async (task) => {
				const filePath = task.filePath ?? (await getTaskPath(task.id, this));

				if (filePath) {
					const bunFile = Bun.file(filePath);
					const stats = await bunFile.stat();
					return {
						...task,
						lastModified: new Date(stats.mtime),
						// Only include branch if explicitly requested
						...(includeBranchMeta && {
							branch: (await this.git.getFileLastModifiedBranch(filePath)) || undefined,
						}),
					};
				}
				return task;
			}),
		);
	}

	/**
	 * Open a file in the configured editor with minimal interference
	 * @param filePath - Path to the file to edit
	 * @param screen - Optional blessed screen to suspend (for TUI contexts)
	 */
	async editTaskInTui(taskId: string, screen: BlessedScreen, selectedTask?: Task): Promise<TuiTaskEditResult> {
		const contextualTask = selectedTask && taskIdsEqual(selectedTask.id, taskId) ? selectedTask : undefined;

		if (contextualTask && (!isLocalEditableTask(contextualTask) || contextualTask.branch)) {
			return { changed: false, task: contextualTask, reason: "read_only" };
		}

		const resolvedTask = contextualTask ?? (await this.getTask(taskId));
		if (!resolvedTask) {
			return { changed: false, reason: "not_found" };
		}
		if (!isLocalEditableTask(resolvedTask) || resolvedTask.branch) {
			return { changed: false, task: resolvedTask, reason: "read_only" };
		}

		const localTask = await this.fs.loadTask(resolvedTask.id);
		const editableTask = localTask ?? resolvedTask;

		const filePath = await getTaskPath(editableTask.id, this);
		if (!filePath) {
			return { changed: false, task: editableTask, reason: "not_found" };
		}

		let beforeContent: string;
		try {
			beforeContent = await Bun.file(filePath).text();
		} catch {
			return { changed: false, task: editableTask, reason: "not_found" };
		}

		const opened = await this.openEditor(filePath, screen);
		if (!opened) {
			return { changed: false, task: editableTask, reason: "editor_failed" };
		}

		let afterContent: string;
		try {
			afterContent = await Bun.file(filePath).text();
		} catch {
			return { changed: false, task: editableTask, reason: "not_found" };
		}

		if (afterContent === beforeContent) {
			const refreshedTask = await this.fs.loadTask(editableTask.id);
			return { changed: false, task: refreshedTask ?? editableTask };
		}

		const now = new Date().toISOString().slice(0, 16).replace("T", " ");
		const withUpdatedDate = upsertTaskUpdatedDate(afterContent, now);
		await Bun.write(filePath, withUpdatedDate);

		const refreshedTask = await this.fs.loadTask(editableTask.id);
		if (refreshedTask && this.contentStore) {
			this.contentStore.upsertTask(refreshedTask);
		}

		return {
			changed: true,
			task: refreshedTask ?? { ...editableTask, updatedDate: now },
		};
	}

	async openEditor(filePath: string, screen?: BlessedScreen): Promise<boolean> {
		const config = await this.fs.loadConfig();

		// If no screen provided, use simple editor opening
		if (!screen) {
			return await openInEditor(filePath, config);
		}

		const program = screen.program;

		// Leave alternate screen buffer FIRST
		screen.leave();

		// Reset keypad/cursor mode using terminfo if available
		if (typeof program.put?.keypad_local === "function") {
			program.put.keypad_local();
			if (typeof program.flush === "function") {
				program.flush();
			}
		}

		// Send escape sequences directly as reinforcement
		// ESC[0m   = Reset all SGR attributes (fixes white background in nano)
		// ESC[?25h = Show cursor (ensure cursor is visible)
		// ESC[?1l  = Reset DECCKM (cursor keys send CSI sequences)
		// ESC>     = DECKPNM (numeric keypad mode)
		const fs = await import("node:fs");
		fs.writeSync(1, "\u001b[0m\u001b[?25h\u001b[?1l\u001b>");

		// Pause the terminal AFTER leaving alt buffer (disables raw mode, releases terminal)
		const resume = typeof program.pause === "function" ? program.pause() : undefined;
		try {
			return await openInEditor(filePath, config);
		} finally {
			// Resume terminal state FIRST (re-enables raw mode)
			if (typeof resume === "function") {
				resume();
			}
			// Re-enter alternate screen buffer
			screen.enter();
			// Restore application cursor mode
			if (typeof program.put?.keypad_xmit === "function") {
				program.put.keypad_xmit();
				if (typeof program.flush === "function") {
					program.flush();
				}
			}
			// Full redraw
			screen.render();
		}
	}

	/**
	 * Load and process all tasks with the same logic as CLI overview
	 * This method extracts the common task loading logic for reuse
	 */
	async loadAllTasksForStatistics(
		progressCallback?: (msg: string) => void,
	): Promise<{ tasks: Task[]; drafts: Task[]; statuses: string[]; priorities: string[] }> {
		const config = await this.fs.loadConfig();
		const statuses = (config?.statuses || DEFAULT_STATUSES) as string[];
		const priorities = config?.priorities ?? [];
		const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";

		// Load local and completed tasks first
		progressCallback?.("Loading local tasks...");
		const [localTasks, completedTasks] = await Promise.all([
			this.listTasksWithMetadata(),
			this.fs.listCompletedTasks(),
		]);

		// Load remote tasks and local branch tasks in parallel
		// Skip entirely when cross-branch scanning is disabled
		let remoteTasks: Task[] = [];
		let localBranchTasks: Task[] = [];
		let branchStateEntries: BranchTaskStateEntry[] | undefined;

		if (config?.checkActiveBranches !== false) {
			const backlogDir = await this.getBacklogDirectoryName();
			branchStateEntries = [];
			[remoteTasks, localBranchTasks] = await Promise.all([
				loadRemoteTasks(this.git, config, progressCallback, localTasks, branchStateEntries, false, backlogDir),
				loadLocalBranchTasks(this.git, config, progressCallback, localTasks, branchStateEntries, false, backlogDir),
			]);
		}
		progressCallback?.("Loaded tasks");

		// Create map with local tasks
		const tasksById = new Map<string, Task>(localTasks.map((t) => [t.id, { ...t, source: "local" }]));

		// Add completed tasks to the map
		for (const completedTask of completedTasks) {
			if (!tasksById.has(completedTask.id)) {
				tasksById.set(completedTask.id, { ...completedTask, source: "completed" });
			}
		}

		// Merge tasks from other local branches
		progressCallback?.("Merging tasks...");
		for (const branchTask of localBranchTasks) {
			const existing = tasksById.get(branchTask.id);
			if (!existing) {
				tasksById.set(branchTask.id, branchTask);
			} else {
				const resolved = resolveTaskConflict(existing, branchTask, statuses, resolutionStrategy);
				tasksById.set(branchTask.id, resolved);
			}
		}

		// Merge remote tasks with local tasks
		for (const remoteTask of remoteTasks) {
			const existing = tasksById.get(remoteTask.id);
			if (!existing) {
				tasksById.set(remoteTask.id, remoteTask);
			} else {
				const resolved = resolveTaskConflict(existing, remoteTask, statuses, resolutionStrategy);
				tasksById.set(remoteTask.id, resolved);
			}
		}

		// Get all tasks as array
		const tasks = Array.from(tasksById.values());
		let activeTasks: Task[];

		if (config?.checkActiveBranches === false) {
			activeTasks = tasks;
		} else {
			progressCallback?.("Applying latest task states from branch scans...");
			activeTasks = filterTasksByStateSnapshots(tasks, buildLatestStateMap(branchStateEntries || [], localTasks));
		}

		// Load drafts
		progressCallback?.("Loading drafts...");
		const drafts = await this.fs.listDrafts();

		return { tasks: activeTasks, drafts, statuses: statuses as string[], priorities };
	}

	/**
	 * Load all tasks with cross-branch support
	 * This is the single entry point for loading tasks across all interfaces
	 */
	async loadTasks(
		progressCallback?: (msg: string) => void,
		abortSignal?: AbortSignal,
		options?: { includeCompleted?: boolean },
	): Promise<Task[]> {
		return await this.loadTasksWithStableBranchSnapshot(progressCallback, abortSignal, options, 0);
	}

	private async loadTasksWithStableBranchSnapshot(
		progressCallback: ((msg: string) => void) | undefined,
		abortSignal: AbortSignal | undefined,
		options: { includeCompleted?: boolean } | undefined,
		snapshotAttempt: number,
	): Promise<Task[]> {
		const config = await this.fs.loadConfig();
		this.git.setConfig(config);
		const snapshotBefore = await this.getActiveBranchFingerprint(config);
		const statuses = config?.statuses || [...DEFAULT_STATUSES];
		const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";
		const includeCompleted = options?.includeCompleted ?? false;

		// Check for cancellation
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Load local filesystem tasks first (needed for optimization)
		const [localTasks, completedTasks] = await Promise.all([
			this.listTasksWithMetadata(),
			includeCompleted ? this.fs.listCompletedTasks() : Promise.resolve([]),
		]);

		// Check for cancellation
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Load tasks from remote branches and other local branches in parallel
		// Skip entirely when cross-branch scanning is disabled
		let remoteTasks: Task[] = [];
		let localBranchTasks: Task[] = [];
		let branchStateEntries: BranchTaskStateEntry[] | undefined;

		if (config?.checkActiveBranches !== false) {
			progressCallback?.(getTaskLoadingMessage(config));
			branchStateEntries = [];
			const backlogDir = await this.getBacklogDirectoryName();
			[remoteTasks, localBranchTasks] = await Promise.all([
				loadRemoteTasks(
					this.git,
					config,
					progressCallback,
					localTasks,
					branchStateEntries,
					includeCompleted,
					backlogDir,
				),
				loadLocalBranchTasks(
					this.git,
					config,
					progressCallback,
					localTasks,
					branchStateEntries,
					includeCompleted,
					backlogDir,
				),
			]);
		}

		const currentBranch = config?.checkActiveBranches === false ? null : await this.git.getCurrentBranch();
		const nextActiveBranchTaskEntries = (branchStateEntries ?? []).filter(
			(entry) => entry.type === "task" && entry.branch !== currentBranch,
		);

		// Check for cancellation after loading
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Create map with local tasks (current branch filesystem)
		const tasksById = new Map<string, Task>(localTasks.map((t) => [t.id, { ...t, source: "local" }]));

		// Add local completed tasks when requested
		if (includeCompleted) {
			for (const completedTask of completedTasks) {
				tasksById.set(completedTask.id, { ...completedTask, source: "completed" });
			}
		}

		// Merge tasks from other local branches
		for (const branchTask of localBranchTasks) {
			if (abortSignal?.aborted) {
				throw new Error("Loading cancelled");
			}

			const existing = tasksById.get(branchTask.id);
			if (!existing) {
				tasksById.set(branchTask.id, branchTask);
			} else {
				const resolved = resolveTaskConflict(existing, branchTask, statuses, resolutionStrategy);
				tasksById.set(branchTask.id, resolved);
			}
		}

		// Merge remote tasks with local tasks
		for (const remoteTask of remoteTasks) {
			// Check for cancellation during merge
			if (abortSignal?.aborted) {
				throw new Error("Loading cancelled");
			}

			const existing = tasksById.get(remoteTask.id);
			if (!existing) {
				tasksById.set(remoteTask.id, remoteTask);
			} else {
				const resolved = resolveTaskConflict(existing, remoteTask, statuses, resolutionStrategy);
				tasksById.set(remoteTask.id, resolved);
			}
		}

		// Check for cancellation before cross-branch checking
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Get the latest directory location of each task across all branches
		const tasks = Array.from(tasksById.values());

		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		let filteredTasks: Task[];

		if (config?.checkActiveBranches === false) {
			filteredTasks = tasks;
		} else {
			progressCallback?.("Applying latest task states from branch scans...");
			if (!includeCompleted) {
				filteredTasks = filterTasksByStateSnapshots(tasks, buildLatestStateMap(branchStateEntries || [], localTasks));
			} else {
				const stateEntries = branchStateEntries || [];
				for (const completedTask of completedTasks) {
					if (!completedTask.id) continue;
					const lastModified = completedTask.updatedDate ? new Date(completedTask.updatedDate) : new Date(0);
					stateEntries.push({
						id: completedTask.id,
						type: "completed",
						branch: "local",
						path: "",
						lastModified,
					});
				}

				const latestState = buildLatestStateMap(stateEntries, localTasks);
				const completedIds = new Set<string>();
				for (const [id, entry] of latestState) {
					if (entry.type === "completed") {
						completedIds.add(id);
					}
				}

				filteredTasks = tasks
					.filter((task) => {
						const latest = latestState.get(task.id);
						if (!latest) return true;
						return latest.type === "task" || latest.type === "completed";
					})
					.map((task) => {
						if (!completedIds.has(task.id)) {
							return task;
						}
						return { ...task, source: "completed" };
					});
			}
		}

		const snapshotAfter = await this.getActiveBranchFingerprint();
		if (snapshotBefore !== snapshotAfter) {
			if (snapshotAttempt >= 2) {
				throw new Error("Active branch refs or configuration kept changing while tasks were loading");
			}
			return await this.loadTasksWithStableBranchSnapshot(progressCallback, abortSignal, options, snapshotAttempt + 1);
		}
		this.activeBranchTaskEntries = nextActiveBranchTaskEntries;
		this.activeBranchFingerprint = snapshotAfter;
		return filteredTasks;
	}
}
