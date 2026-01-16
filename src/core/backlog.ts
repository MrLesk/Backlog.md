import { join } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { FileSystem } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import {
	type AcceptanceCriterion,
	type BacklogConfig,
	type Decision,
	type Document,
	EntityType,
	isLocalEditableTask,
	type SearchFilters,
	type Sequence,
	type Task,
	type TaskCreateInput,
	type TaskListFilter,
	type TaskUpdateInput,
} from "../types/index.ts";
import { normalizeAssignee } from "../utils/assignee.ts";
import { documentIdsEqual } from "../utils/document-id.ts";
import { openInEditor } from "../utils/editor.ts";
import { buildIdRegex, getPrefixForType, normalizeId } from "../utils/prefix-config.ts";
import {
	getCanonicalStatus as resolveCanonicalStatus,
	getValidStatuses as resolveValidStatuses,
} from "../utils/status.ts";
import { executeStatusCallback } from "../utils/status-callback.ts";
import {
	normalizeDependencies,
	normalizeStringList,
	stringArraysEqual,
	validateDependencies,
} from "../utils/task-builders.ts";
import { getTaskFilename, getTaskPath, normalizeTaskId, taskIdsEqual } from "../utils/task-path.ts";
import { migrateConfig, needsMigration } from "./config-migration.ts";
import { ContentStore } from "./content-store.ts";
import { migrateDraftPrefixes, needsDraftPrefixMigration } from "./prefix-migration.ts";
import { calculateNewOrdinal, DEFAULT_ORDINAL_STEP, resolveOrdinalConflicts } from "./reorder.ts";
import { SearchService } from "./search-service.ts";
import { computeSequences, planMoveToSequence, planMoveToUnsequenced } from "./sequences.ts";
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

export class Core {
	public fs: FileSystem;
	public git: GitOperations;
	private contentStore?: ContentStore;
	private searchService?: SearchService;
	private readonly enableWatchers: boolean;

	constructor(projectRoot: string, options?: { enableWatchers?: boolean }) {
		this.fs = new FileSystem(projectRoot);
		this.git = new GitOperations(projectRoot);
		// Disable watchers by default for CLI commands (non-interactive)
		// Interactive modes (TUI, browser, MCP) should explicitly pass enableWatchers: true
		this.enableWatchers = options?.enableWatchers ?? false;
		// Note: Config is loaded lazily when needed since constructor can't be async
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

	private applyTaskFilters(tasks: Task[], filters?: TaskListFilter): Task[] {
		if (!filters) {
			return tasks;
		}
		let result = tasks;
		if (filters.status) {
			const statusLower = filters.status.toLowerCase();
			result = result.filter((task) => (task.status ?? "").toLowerCase() === statusLower);
		}
		if (filters.assignee) {
			const assigneeLower = filters.assignee.toLowerCase();
			result = result.filter((task) => (task.assignee ?? []).some((value) => value.toLowerCase() === assigneeLower));
		}
		if (filters.priority) {
			const priorityLower = String(filters.priority).toLowerCase();
			result = result.filter((task) => (task.priority ?? "").toLowerCase() === priorityLower);
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

	private normalizePriority(value: string | undefined): ("high" | "medium" | "low") | undefined {
		if (value === undefined || value === "") {
			return undefined;
		}
		const normalized = value.toLowerCase();
		const allowed = ["high", "medium", "low"] as const;
		if (!allowed.includes(normalized as (typeof allowed)[number])) {
			throw new Error(`Invalid priority: ${value}. Valid values are: high, medium, low`);
		}
		return normalized as "high" | "medium" | "low";
	}

	async queryTasks(options: TaskQueryOptions = {}): Promise<Task[]> {
		const { filters, query, limit } = options;
		const trimmedQuery = query?.trim();
		const includeCrossBranch = options.includeCrossBranch ?? true;

		const applyFiltersAndLimit = (collection: Task[]): Task[] => {
			let filtered = this.applyTaskFilters(collection, filters);
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
			const tasks = store.getTasks();
			return applyFiltersAndLimit(tasks);
		}

		const searchService = await this.getSearchService();
		const searchFilters: SearchFilters = {};
		if (filters?.status) {
			searchFilters.status = filters.status;
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

		return applyFiltersAndLimit(tasks);
	}

	async getTask(taskId: string): Promise<Task | null> {
		const store = await this.getContentStore();
		const tasks = store.getTasks();
		const match = tasks.find((task) => taskIdsEqual(taskId, task.id));
		if (match) {
			return match;
		}

		// Pass raw ID to loadTask - it will handle prefix detection via getTaskPath
		return await this.fs.loadTask(taskId);
	}

	async loadTaskById(taskId: string): Promise<Task | null> {
		// Pass raw ID to loadTask - it will handle prefix detection via getTaskPath
		const localTask = await this.fs.loadTask(taskId);
		if (localTask) return localTask;

		// Check config for remote operations
		const config = await this.fs.loadConfig();
		const sinceDays = config?.activeBranchDays ?? 30;
		const taskPrefix = config?.prefixes?.task ?? "task";

		// For cross-branch search, normalize with configured prefix
		const canonicalId = normalizeTaskId(taskId, taskPrefix);

		// Try other local branches first (faster than remote)
		const localBranchTask = await findTaskInLocalBranches(
			this.git,
			canonicalId,
			DEFAULT_DIRECTORIES.BACKLOG,
			sinceDays,
			taskPrefix,
		);
		if (localBranchTask) return localBranchTask;

		// Skip remote if disabled
		if (config?.remoteOperations === false) return null;

		// Try remote branches
		return await findTaskInRemoteBranches(this.git, canonicalId, DEFAULT_DIRECTORIES.BACKLOG, sinceDays, taskPrefix);
	}

	async getTaskContent(taskId: string): Promise<string | null> {
		const filePath = await getTaskPath(taskId, this);
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

		const relativePath = document.path ?? `${document.id}.md`;
		const filePath = join(this.fs.docsDir, relativePath);
		try {
			return await Bun.file(filePath).text();
		} catch {
			return null;
		}
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
		// Always use "backlog" as the directory name
		return DEFAULT_DIRECTORIES.BACKLOG;
	}

	async shouldAutoCommit(overrideValue?: boolean): Promise<boolean> {
		// If override is explicitly provided, use it
		if (overrideValue !== undefined) {
			return overrideValue;
		}
		// Otherwise, check config (default to false for safety)
		const config = await this.fs.loadConfig();
		return config?.autoCommit ?? false;
	}

	async getGitOps() {
		await this.ensureConfigLoaded();
		return this.git;
	}

	// Config migration
	async ensureConfigMigrated(): Promise<void> {
		await this.ensureConfigLoaded();
		let config = await this.fs.loadConfig();

		if (!config || needsMigration(config)) {
			config = migrateConfig(config || {});
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
			const upperParent = normalizedParent.toUpperCase();
			let max = 0;
			for (const id of allIds) {
				// Case-insensitive comparison to handle legacy lowercase IDs
				if (id.toUpperCase().startsWith(`${upperParent}.`)) {
					const rest = id.slice(normalizedParent.length + 1);
					const num = Number.parseInt(rest.split(".")[0] || "0", 10);
					if (num > max) max = num;
				}
			}
			const nextSubIdNumber = max + 1;
			const padding = config?.zeroPaddedIds;

			if (padding && padding > 0) {
				const paddedSubId = String(nextSubIdNumber).padStart(2, "0");
				return `${normalizedParent}.${paddedSubId}`;
			}

			return `${normalizedParent}.${nextSubIdNumber}`;
		}

		// Top-level ID generation using prefix-aware regex
		const regex = buildIdRegex(prefix);
		const upperPrefix = prefix.toUpperCase();
		let max = 0;
		for (const id of allIds) {
			const match = id.match(regex);
			if (match?.[1] && !match[1].includes(".")) {
				const num = Number.parseInt(match[1], 10);
				if (num > max) max = num;
			}
		}
		const nextIdNumber = max + 1;
		const padding = config?.zeroPaddedIds;

		if (padding && padding > 0) {
			const paddedId = String(nextIdNumber).padStart(padding, "0");
			return `${upperPrefix}-${paddedId}`;
		}

		return `${upperPrefix}-${nextIdNumber}`;
	}

	/**
	 * Gets all task IDs that are in use (active or completed) across all branches.
	 * Respects cross-branch config settings. Archived IDs are excluded (can be reused).
	 *
	 * This is used for ID generation to determine the next available ID.
	 */
	private async getActiveAndCompletedTaskIds(): Promise<string[]> {
		const config = await this.fs.loadConfig();

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

		// If cross-branch checking is enabled, scan other branches for task states
		if (config?.checkActiveBranches !== false) {
			const branchStateEntries: BranchTaskStateEntry[] = [];

			// Load states from remote and local branches in parallel
			await Promise.all([
				loadRemoteTasks(this.git, config, undefined, localTasks, branchStateEntries),
				loadLocalBranchTasks(this.git, config, undefined, localTasks, branchStateEntries),
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

	// High-level operations that combine filesystem and git
	async createTaskFromData(
		taskData: {
			title: string;
			status?: string;
			assignee?: string[];
			labels?: string[];
			dependencies?: string[];
			parentTaskId?: string;
			priority?: "high" | "medium" | "low";
			// First-party structured fields from Web UI / CLI
			description?: string;
			acceptanceCriteriaItems?: import("../types/index.ts").AcceptanceCriterion[];
			implementationPlan?: string;
			implementationNotes?: string;
			milestone?: string;
		},
		autoCommit?: boolean,
	): Promise<Task> {
		// Determine entity type before generating ID - drafts get DRAFT-X, tasks get TASK-X
		const isDraft = taskData.status?.toLowerCase() === "draft";
		const entityType = isDraft ? EntityType.Draft : EntityType.Task;
		const id = await this.generateNextId(entityType, isDraft ? undefined : taskData.parentTaskId);

		const task: Task = {
			id,
			title: taskData.title,
			status: taskData.status || "",
			assignee: taskData.assignee || [],
			labels: taskData.labels || [],
			dependencies: taskData.dependencies || [],
			rawContent: "",
			createdDate: new Date().toISOString().slice(0, 16).replace("T", " "),
			...(taskData.parentTaskId && { parentTaskId: taskData.parentTaskId }),
			...(taskData.priority && { priority: taskData.priority }),
			...(typeof taskData.milestone === "string" &&
				taskData.milestone.trim().length > 0 && {
					milestone: taskData.milestone.trim(),
				}),
			...(typeof taskData.description === "string" && { description: taskData.description }),
			...(Array.isArray(taskData.acceptanceCriteriaItems) &&
				taskData.acceptanceCriteriaItems.length > 0 && {
					acceptanceCriteriaItems: taskData.acceptanceCriteriaItems,
				}),
			...(typeof taskData.implementationPlan === "string" && { implementationPlan: taskData.implementationPlan }),
			...(typeof taskData.implementationNotes === "string" && { implementationNotes: taskData.implementationNotes }),
		};

		// Save as draft or task based on status
		if (isDraft) {
			await this.createDraft(task, autoCommit);
		} else {
			await this.createTask(task, autoCommit);
		}

		return task;
	}

	async createTaskFromInput(input: TaskCreateInput, autoCommit?: boolean): Promise<{ task: Task; filePath?: string }> {
		if (!input.title || input.title.trim().length === 0) {
			throw new Error("Title is required to create a task.");
		}

		// Determine if this is a draft BEFORE generating the ID
		const requestedStatus = input.status?.trim();
		const isDraft = requestedStatus?.toLowerCase() === "draft";

		// Generate ID with appropriate entity type - drafts get DRAFT-X, tasks get TASK-X
		const entityType = isDraft ? EntityType.Draft : EntityType.Task;
		const id = await this.generateNextId(entityType, isDraft ? undefined : input.parentTaskId);

		const normalizedLabels = normalizeStringList(input.labels) ?? [];
		const normalizedAssignees = normalizeStringList(input.assignee) ?? [];
		const normalizedDependencies = normalizeDependencies(input.dependencies);
		const normalizedReferences = normalizeStringList(input.references) ?? [];
		const normalizedDocumentation = normalizeStringList(input.documentation) ?? [];

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

		const priority = this.normalizePriority(input.priority);
		const createdDate = new Date().toISOString().slice(0, 16).replace("T", " ");

		const acceptanceCriteriaItems = Array.isArray(input.acceptanceCriteria)
			? input.acceptanceCriteria
					.map((criterion, index) => ({
						index: index + 1,
						text: String(criterion.text ?? "").trim(),
						checked: Boolean(criterion.checked),
					}))
					.filter((criterion) => criterion.text.length > 0)
			: [];

		const task: Task = {
			id,
			title: input.title.trim(),
			status,
			assignee: normalizedAssignees,
			labels: normalizedLabels,
			dependencies: validDependencies,
			references: normalizedReferences,
			documentation: normalizedDocumentation,
			rawContent: input.rawContent ?? "",
			createdDate,
			...(input.parentTaskId && { parentTaskId: input.parentTaskId }),
			...(priority && { priority }),
			...(typeof input.milestone === "string" &&
				input.milestone.trim().length > 0 && {
					milestone: input.milestone.trim(),
				}),
			...(typeof input.description === "string" && { description: input.description }),
			...(typeof input.implementationPlan === "string" && { implementationPlan: input.implementationPlan }),
			...(typeof input.implementationNotes === "string" && { implementationNotes: input.implementationNotes }),
			...(acceptanceCriteriaItems.length > 0 && { acceptanceCriteriaItems }),
		};

		const filePath = isDraft ? await this.createDraft(task, autoCommit) : await this.createTask(task, autoCommit);

		// Load the saved task/draft to return updated data
		const savedTask = isDraft ? await this.fs.loadDraft(id) : await this.fs.loadTask(id);
		return { task: savedTask ?? task, filePath };
	}

	async createTask(task: Task, autoCommit?: boolean): Promise<string> {
		if (!task.status) {
			const config = await this.fs.loadConfig();
			task.status = config?.defaultStatus || FALLBACK_STATUS;
		}

		normalizeAssignee(task);

		const filepath = await this.fs.saveTask(task);

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.git.addAndCommitTaskFile(task.id, filepath, "create");
		}

		return filepath;
	}

	async createDraft(task: Task, autoCommit?: boolean): Promise<string> {
		// Drafts always have status "Draft", regardless of config default
		task.status = "Draft";
		normalizeAssignee(task);

		const filepath = await this.fs.saveDraft(task);

		if (await this.shouldAutoCommit(autoCommit)) {
			await this.git.addFile(filepath);
			await this.git.commitTaskChange(task.id, `Create draft ${task.id}`);
		}

		return filepath;
	}

	async updateTask(task: Task, autoCommit?: boolean): Promise<void> {
		normalizeAssignee(task);

		// Load original task to detect status changes for callbacks
		const originalTask = await this.fs.loadTask(task.id);
		const oldStatus = originalTask?.status ?? "";
		const newStatus = task.status ?? "";
		const statusChanged = oldStatus !== newStatus;

		// Always set updatedDate when updating a task
		task.updatedDate = new Date().toISOString().slice(0, 16).replace("T", " ");

		await this.fs.saveTask(task);

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

	async updateTaskFromInput(taskId: string, input: TaskUpdateInput, autoCommit?: boolean): Promise<Task> {
		const task = await this.fs.loadTask(taskId);
		if (!task) {
			throw new Error(`Task not found: ${taskId}`);
		}

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
			const canonicalStatus =
				input.status.trim().toLowerCase() === "draft" ? "Draft" : await this.requireCanonicalStatus(input.status);
			if ((task.status ?? "") !== canonicalStatus) {
				task.status = canonicalStatus;
				mutated = true;
			}
		}

		if (input.priority !== undefined) {
			const normalizedPriority = this.normalizePriority(String(input.priority));
			if (task.priority !== normalizedPriority) {
				task.priority = normalizedPriority;
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
			if (Number.isNaN(input.ordinal) || input.ordinal < 0) {
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
						.join(", ")} not found`,
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
				throw new Error(`Acceptance criterion ${label} not found`);
			}
		};

		toggleCriteria(input.checkAcceptanceCriteria, true);
		toggleCriteria(input.uncheckAcceptanceCriteria, false);

		task.acceptanceCriteriaItems = acceptanceCriteria;

		if (!mutated) {
			return task;
		}

		await this.updateTask(task, autoCommit);
		const refreshed = await this.fs.loadTask(taskId);
		return refreshed ?? task;
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
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(commitMessage || `Update ${tasks.length} tasks`);
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
		const movedTask = validTasks.find((t) => taskIdsEqual(t.id, taskId));
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
		const validOrderedIds = orderedTaskIds.filter((id) => validTasks.some((t) => taskIdsEqual(t.id, id)));
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

	// Sequences operations (business logic lives in core, not server)
	async listActiveSequences(): Promise<{ unsequenced: Task[]; sequences: Sequence[] }> {
		const all = await this.fs.listTasks();
		const active = all.filter((t) => (t.status || "").toLowerCase() !== "done");
		return computeSequences(active);
	}

	async moveTaskInSequences(params: {
		taskId: string;
		unsequenced?: boolean;
		targetSequenceIndex?: number;
	}): Promise<{ unsequenced: Task[]; sequences: Sequence[] }> {
		const taskId = String(params.taskId || "").trim();
		if (!taskId) throw new Error("taskId is required");

		const allTasks = await this.fs.listTasks();
		const exists = allTasks.some((t) => t.id === taskId);
		if (!exists) throw new Error(`Task ${taskId} not found`);

		const active = allTasks.filter((t) => (t.status || "").toLowerCase() !== "done");
		const { sequences } = computeSequences(active);

		if (params.unsequenced) {
			const res = planMoveToUnsequenced(allTasks, taskId);
			if (!res.ok) throw new Error(res.error);
			await this.updateTasksBulk(res.changed, `Move ${taskId} to Unsequenced`);
		} else {
			const targetSequenceIndex = params.targetSequenceIndex;
			if (targetSequenceIndex === undefined || Number.isNaN(targetSequenceIndex)) {
				throw new Error("targetSequenceIndex must be a number");
			}
			if (targetSequenceIndex < 1) throw new Error("targetSequenceIndex must be >= 1");
			const changed = planMoveToSequence(allTasks, sequences, taskId, targetSequenceIndex);
			if (changed.length > 0) await this.updateTasksBulk(changed, `Update deps/order for ${taskId}`);
		}

		// Return updated sequences
		const afterAll = await this.fs.listTasks();
		const afterActive = afterAll.filter((t) => (t.status || "").toLowerCase() !== "done");
		return computeSequences(afterActive);
	}

	async archiveTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		// Get paths before moving the file
		const taskPath = await getTaskPath(taskId, this);
		const taskFilename = await getTaskFilename(taskId, this);

		if (!taskPath || !taskFilename) return false;

		const fromPath = taskPath;
		const toPath = join(await this.fs.getArchiveTasksDir(), taskFilename);

		const success = await this.fs.archiveTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			// Stage the file move for proper Git tracking
			await this.git.stageFileMove(fromPath, toPath);
			await this.git.commitChanges(`backlog: Archive task ${normalizeTaskId(taskId)}`);
		}

		return success;
	}

	async completeTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		// Get paths before moving the file
		const completedDir = this.fs.completedDir;
		const taskPath = await getTaskPath(taskId, this);
		const taskFilename = await getTaskFilename(taskId, this);

		if (!taskPath || !taskFilename) return false;

		const fromPath = taskPath;
		const toPath = join(completedDir, taskFilename);

		const success = await this.fs.completeTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			// Stage the file move for proper Git tracking
			await this.git.stageFileMove(fromPath, toPath);
			await this.git.commitChanges(`backlog: Complete task ${normalizeTaskId(taskId)}`);
		}

		return success;
	}

	async getDoneTasksByAge(olderThanDays: number): Promise<Task[]> {
		const tasks = await this.fs.listTasks();
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

		return tasks.filter((task) => {
			if (task.status !== "Done") return false;

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
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Archive draft ${normalizeId(draftId, "draft")}`);
		}

		return success;
	}

	async promoteDraft(draftId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.promoteDraft(draftId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Promote draft ${normalizeId(draftId, "draft")}`);
		}

		return success;
	}

	async demoteTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.demoteTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Demote task ${normalizeTaskId(taskId)}`);
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

	async createDecision(decision: Decision, autoCommit?: boolean): Promise<void> {
		await this.fs.saveDecision(decision);

		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Add decision ${decision.id}`);
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
		const relativePath = await this.fs.saveDocument(doc, subPath);
		doc.path = relativePath;

		if (await this.shouldAutoCommit(autoCommit)) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Add document ${doc.id}`);
		}
	}

	async updateDocument(existingDoc: Document, content: string, autoCommit?: boolean): Promise<void> {
		const updatedDoc = {
			...existingDoc,
			rawContent: content,
			updatedDate: new Date().toISOString().slice(0, 16).replace("T", " "),
		};

		let normalizedSubPath = "";
		if (existingDoc.path) {
			const segments = existingDoc.path.split(/[\\/]/).slice(0, -1);
			if (segments.length > 0) {
				normalizedSubPath = segments.join("/");
			}
		}

		await this.createDocument(updatedDoc, autoCommit, normalizedSubPath);
	}

	async createDocumentWithId(title: string, content: string, autoCommit?: boolean): Promise<Document> {
		// Import the generateNextDocId function from CLI
		const { generateNextDocId } = await import("../cli.js");
		const id = await generateNextDocId(this);

		const document: Document = {
			id,
			title,
			type: "other" as const,
			createdDate: new Date().toISOString().slice(0, 16).replace("T", " "),
			rawContent: content,
		};

		await this.createDocument(document, autoCommit);
		return document;
	}

	async initializeProject(projectName: string, autoCommit = false): Promise<void> {
		await this.fs.ensureBacklogStructure();

		const config: BacklogConfig = {
			projectName: projectName,
			statuses: [...DEFAULT_STATUSES],
			labels: [],
			milestones: [],
			defaultStatus: DEFAULT_STATUSES[0], // Use first status as default
			dateFormat: "yyyy-mm-dd",
			maxColumnWidth: 20, // Default for terminal display
			autoCommit: false, // Default to false for user control
			prefixes: {
				task: "task",
			},
		};

		await this.fs.saveConfig(config);
		// Update git operations with the new config
		await this.ensureConfigLoaded();

		if (autoCommit) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Initialize backlog project: ${projectName}`);
		}
	}

	async listTasksWithMetadata(
		includeBranchMeta = false,
	): Promise<Array<Task & { lastModified?: Date; branch?: string }>> {
		const tasks = await this.fs.listTasks();
		return await Promise.all(
			tasks.map(async (task) => {
				const filePath = await getTaskPath(task.id, this);

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
	): Promise<{ tasks: Task[]; drafts: Task[]; statuses: string[] }> {
		const config = await this.fs.loadConfig();
		const statuses = (config?.statuses || DEFAULT_STATUSES) as string[];
		const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";

		// Load local and completed tasks first
		progressCallback?.("Loading local tasks...");
		const [localTasks, completedTasks] = await Promise.all([
			this.listTasksWithMetadata(),
			this.fs.listCompletedTasks(),
		]);

		// Load remote tasks and local branch tasks in parallel
		const branchStateEntries: BranchTaskStateEntry[] | undefined =
			config?.checkActiveBranches === false ? undefined : [];
		const [remoteTasks, localBranchTasks] = await Promise.all([
			loadRemoteTasks(this.git, config, progressCallback, localTasks, branchStateEntries),
			loadLocalBranchTasks(this.git, config, progressCallback, localTasks, branchStateEntries),
		]);
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

		return { tasks: activeTasks, drafts, statuses: statuses as string[] };
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
		const config = await this.fs.loadConfig();
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
		progressCallback?.(getTaskLoadingMessage(config));

		const branchStateEntries: BranchTaskStateEntry[] | undefined =
			config?.checkActiveBranches === false ? undefined : [];
		const [remoteTasks, localBranchTasks] = await Promise.all([
			loadRemoteTasks(this.git, config, progressCallback, localTasks, branchStateEntries, includeCompleted),
			loadLocalBranchTasks(this.git, config, progressCallback, localTasks, branchStateEntries, includeCompleted),
		]);

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

		return filteredTasks;
	}
}
