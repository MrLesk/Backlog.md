import { join } from "node:path";
import { DEFAULT_DIRECTORIES, DEFAULT_STATUSES, FALLBACK_STATUS } from "../constants/index.ts";
import { FileSystem } from "../file-system/operations.ts";
import { GitOperations } from "../git/operations.ts";
import type {
	AcceptanceCriterion,
	BacklogConfig,
	Decision,
	Document,
	SearchFilters,
	Sequence,
	Task,
	TaskCreateInput,
	TaskListFilter,
	TaskUpdateInput,
} from "../types/index.ts";
import { normalizeAssignee } from "../utils/assignee.ts";
import { documentIdsEqual } from "../utils/document-id.ts";
import { openInEditor } from "../utils/editor.ts";
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
import { filterTasksByLatestState, getLatestTaskStatesForIds } from "./cross-branch-tasks.ts";
import { loadLocalBranchTasks, loadRemoteTasks, resolveTaskConflict } from "./remote-tasks.ts";
import { calculateNewOrdinal, DEFAULT_ORDINAL_STEP, resolveOrdinalConflicts } from "./reorder.ts";
import { SearchService } from "./search-service.ts";
import { computeSequences, planMoveToSequence, planMoveToUnsequenced } from "./sequences.ts";
import { findTaskInLocalBranches, findTaskInRemoteBranches } from "./task-loader.ts";

interface BlessedScreen {
	program: {
		disableMouse(): void;
		enableMouse(): void;
		hideCursor(): void;
		showCursor(): void;
		input: NodeJS.EventEmitter;
		pause?: () => (() => void) | undefined;
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
		return result;
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

		const applyFiltersAndLimit = (collection: Task[]): Task[] => {
			const filtered = this.applyTaskFilters(collection, filters);
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

		const canonicalId = normalizeTaskId(taskId);
		return await this.fs.loadTask(canonicalId);
	}

	async loadTaskById(taskId: string): Promise<Task | null> {
		const canonicalId = normalizeTaskId(taskId);

		// First try local filesystem
		const localTask = await this.fs.loadTask(canonicalId);
		if (localTask) return localTask;

		// Check config for remote operations
		const config = await this.fs.loadConfig();
		const sinceDays = config?.activeBranchDays ?? 30;

		// Try other local branches first (faster than remote)
		const localBranchTask = await findTaskInLocalBranches(
			this.git,
			canonicalId,
			DEFAULT_DIRECTORIES.BACKLOG,
			sinceDays,
		);
		if (localBranchTask) return localBranchTask;

		// Skip remote if disabled
		if (config?.remoteOperations === false) return null;

		// Try remote branches
		return await findTaskInRemoteBranches(this.git, canonicalId, DEFAULT_DIRECTORIES.BACKLOG, sinceDays);
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
	}

	// ID generation
	async generateNextId(parent?: string): Promise<string> {
		const config = await this.fs.loadConfig();

		// Use ContentStore for all tasks (local + cross-branch + remote)
		// This is the single source of truth for task IDs
		const store = await this.getContentStore();
		const tasks = store.getTasks();

		// Also include drafts (which aren't in ContentStore yet)
		const drafts = await this.fs.listDrafts();

		const allIds: string[] = [];

		for (const t of tasks) {
			allIds.push(t.id);
		}
		for (const d of drafts) {
			allIds.push(d.id);
		}

		if (parent) {
			const prefix = allIds.find((id) => taskIdsEqual(parent, id)) ?? normalizeTaskId(parent);
			let max = 0;
			for (const id of allIds) {
				if (id.startsWith(`${prefix}.`)) {
					const rest = id.slice(prefix.length + 1);
					const num = Number.parseInt(rest.split(".")[0] || "0", 10);
					if (num > max) max = num;
				}
			}
			const nextSubIdNumber = max + 1;
			const padding = config?.zeroPaddedIds;

			if (padding && padding > 0) {
				const paddedSubId = String(nextSubIdNumber).padStart(2, "0");
				return `${prefix}.${paddedSubId}`;
			}

			return `${prefix}.${nextSubIdNumber}`;
		}

		let max = 0;
		for (const id of allIds) {
			const match = id.match(/^task-(\d+)/);
			if (match) {
				const num = Number.parseInt(match[1] || "0", 10);
				if (num > max) max = num;
			}
		}
		const nextIdNumber = max + 1;
		const padding = config?.zeroPaddedIds;

		if (padding && padding > 0) {
			const paddedId = String(nextIdNumber).padStart(padding, "0");
			return `task-${paddedId}`;
		}

		return `task-${nextIdNumber}`;
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
		},
		autoCommit?: boolean,
	): Promise<Task> {
		const id = await this.generateNextId(taskData.parentTaskId);

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
			...(typeof taskData.description === "string" && { description: taskData.description }),
			...(Array.isArray(taskData.acceptanceCriteriaItems) &&
				taskData.acceptanceCriteriaItems.length > 0 && {
					acceptanceCriteriaItems: taskData.acceptanceCriteriaItems,
				}),
			...(typeof taskData.implementationPlan === "string" && { implementationPlan: taskData.implementationPlan }),
			...(typeof taskData.implementationNotes === "string" && { implementationNotes: taskData.implementationNotes }),
		};

		// Check if this should be a draft based on status
		if (task.status && task.status.toLowerCase() === "draft") {
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

		const id = await this.generateNextId(input.parentTaskId);

		const normalizedLabels = normalizeStringList(input.labels) ?? [];
		const normalizedAssignees = normalizeStringList(input.assignee) ?? [];
		const normalizedDependencies = normalizeDependencies(input.dependencies);

		const { valid: validDependencies, invalid: invalidDependencies } = await validateDependencies(
			normalizedDependencies,
			this,
		);
		if (invalidDependencies.length > 0) {
			throw new Error(
				`The following dependencies do not exist: ${invalidDependencies.join(", ")}. Please create these tasks first or verify the IDs.`,
			);
		}

		const requestedStatus = input.status?.trim();
		let status = "";
		if (requestedStatus) {
			if (requestedStatus.toLowerCase() === "draft") {
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
			rawContent: input.rawContent ?? "",
			createdDate,
			...(input.parentTaskId && { parentTaskId: input.parentTaskId }),
			...(priority && { priority }),
			...(typeof input.description === "string" && { description: input.description }),
			...(typeof input.implementationPlan === "string" && { implementationPlan: input.implementationPlan }),
			...(typeof input.implementationNotes === "string" && { implementationNotes: input.implementationNotes }),
			...(acceptanceCriteriaItems.length > 0 && { acceptanceCriteriaItems }),
		};

		const isDraft = (status || "").toLowerCase() === "draft";
		const filePath = isDraft ? await this.createDraft(task, autoCommit) : await this.createTask(task, autoCommit);

		const savedTask = await this.fs.loadTask(id);
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
		commitMessage?: string;
		autoCommit?: boolean;
		defaultStep?: number;
	}): Promise<{ updatedTask: Task; changedTasks: Task[] }> {
		const taskId = String(params.taskId || "").trim();
		const targetStatus = String(params.targetStatus || "").trim();
		const orderedTaskIds = params.orderedTaskIds.map((id) => String(id || "").trim()).filter(Boolean);
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
			return (original.ordinal ?? null) !== (task.ordinal ?? null) || (original.status ?? "") !== (task.status ?? "");
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
			await this.git.commitChanges(`backlog: Archive task ${taskId}`);
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
			await this.git.commitChanges(`backlog: Complete task ${taskId}`);
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

	async archiveDraft(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.archiveDraft(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Archive draft ${taskId}`);
		}

		return success;
	}

	async promoteDraft(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.promoteDraft(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Promote draft ${taskId}`);
		}

		return success;
	}

	async demoteTask(taskId: string, autoCommit?: boolean): Promise<boolean> {
		const success = await this.fs.demoteTask(taskId);

		if (success && (await this.shouldAutoCommit(autoCommit))) {
			const backlogDir = await this.getBacklogDirectoryName();
			await this.git.stageBacklogDirectory(backlogDir);
			await this.git.commitChanges(`backlog: Demote task ${taskId}`);
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

		// Store all event listeners before removing them
		const inputListeners = new Map<string, Array<(...args: unknown[]) => void>>();
		const eventNames = ["keypress", "data", "readable"];

		for (const eventName of eventNames) {
			const listeners = screen.program.input.listeners(eventName) as Array<(...args: unknown[]) => void>;
			if (listeners.length > 0) {
				inputListeners.set(eventName, [...listeners]);
			}
		}

		// Properly pause the terminal (raw mode off, normal buffer) if supported
		const resume = typeof screen.program.pause === "function" ? screen.program.pause() : undefined;
		try {
			// Ensure we are out of alt buffer
			screen.leave();
			return await openInEditor(filePath, config);
		} finally {
			// Resume terminal state
			if (typeof resume === "function") {
				resume();
			} else {
				screen.enter();
			}
			// Full redraw
			screen.clearRegion(0, screen.width, 0, screen.height);
			screen.render();
			process.nextTick(() => {
				screen.emit("resize");
			});
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
		const [remoteTasks, localBranchTasks] = await Promise.all([
			loadRemoteTasks(this.git, config, progressCallback, localTasks),
			loadLocalBranchTasks(this.git, config, progressCallback, localTasks),
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
			// Skip cross-branch checking for maximum performance
			progressCallback?.("Skipping cross-branch check (disabled in config)...");
			activeTasks = tasks;
		} else {
			// Get the latest state of each task across all branches
			progressCallback?.("Checking task states across branches...");
			const taskIds = tasks.map((t) => t.id);
			const latestTaskDirectories = await getLatestTaskStatesForIds(
				this.git,
				this.fs,
				taskIds,
				progressCallback || (() => {}),
				{
					recentBranchesOnly: true,
					daysAgo: config?.activeBranchDays ?? 30,
				},
			);

			// Filter tasks based on their latest directory location
			activeTasks = filterTasksByLatestState(tasks, latestTaskDirectories);
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
	async loadTasks(progressCallback?: (msg: string) => void, abortSignal?: AbortSignal): Promise<Task[]> {
		const config = await this.fs.loadConfig();
		const statuses = config?.statuses || [...DEFAULT_STATUSES];
		const resolutionStrategy = config?.taskResolutionStrategy || "most_progressed";

		// Check for cancellation
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Load local filesystem tasks first (needed for optimization)
		const localTasks = await this.listTasksWithMetadata();

		// Check for cancellation
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Load tasks from remote branches and other local branches in parallel
		const { getTaskLoadingMessage } = await import("./remote-tasks.ts");
		progressCallback?.(getTaskLoadingMessage(config));

		const [remoteTasks, localBranchTasks] = await Promise.all([
			loadRemoteTasks(this.git, config, progressCallback, localTasks),
			loadLocalBranchTasks(this.git, config, progressCallback, localTasks),
		]);

		// Check for cancellation after loading
		if (abortSignal?.aborted) {
			throw new Error("Loading cancelled");
		}

		// Create map with local tasks (current branch filesystem)
		const tasksById = new Map<string, Task>(localTasks.map((t) => [t.id, { ...t, source: "local" }]));

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
		let filteredTasks: Task[];

		if (config?.checkActiveBranches === false) {
			// Skip cross-branch checking for maximum performance
			progressCallback?.("Skipping cross-branch check (disabled in config)...");
			filteredTasks = tasks;
		} else {
			progressCallback?.("Resolving task states across branches...");
			const taskIds = tasks.map((t) => t.id);
			const latestTaskDirectories = await getLatestTaskStatesForIds(this.git, this.fs, taskIds, progressCallback, {
				recentBranchesOnly: true,
				daysAgo: config?.activeBranchDays ?? 30,
			});

			// Check for cancellation before filtering
			if (abortSignal?.aborted) {
				throw new Error("Loading cancelled");
			}

			// Filter tasks based on their latest directory location
			progressCallback?.("Filtering active tasks...");
			filteredTasks = filterTasksByLatestState(tasks, latestTaskDirectories);
		}

		return filteredTasks;
	}
}
