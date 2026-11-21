import { DEFAULT_STATUSES } from "../../constants/index.ts";
import type { DuplicateRepairPlan, DuplicateRepairResult } from "../../core/duplicate-task-repair.ts";
import { SearchIndex } from "../../core/search-service.ts";
import { getTaskStatistics, type TaskStatistics } from "../../core/statistics.ts";
import { type TaskDetail, toTaskDetail } from "../../core/task-detail.ts";
import type {
	BacklogConfig,
	Decision,
	DecisionUpdateInput,
	Document,
	Milestone,
	SearchPriorityFilter,
	SearchResult,
	SearchResultType,
	Task,
	TaskStatus,
} from "../../types/index.ts";
import { findDecisionById } from "../../utils/decision-id.ts";
import { findDocumentById } from "../../utils/document-id.ts";
import { isAmbiguousIdError } from "../../utils/entity-id.ts";
import { formatValidPriorityValues, resolvePriorityValue } from "../../utils/priority-config.ts";
import { resolveConfiguredStatuses } from "../../utils/status-filter.ts";
import { resolveTaskById } from "../../utils/task-id.ts";
import { type BrowserSnapshot, browserSnapshot } from "./browser-snapshot.ts";

const API_BASE = "/api";

export interface ReorderTaskPayload {
	taskId: string;
	targetStatus: string;
	orderedTaskIds: string[];
	targetMilestone?: string | null;
}

export interface MoveTasksPayload {
	taskIds: string[];
	targetStatus: string;
	targetMilestone?: string | null;
}

export interface MoveTasksResult {
	success: boolean;
	tasks: Task[];
	changedTasks: Task[];
	failures: Array<{ taskId: string; reason: string }>;
}

/**
 * Read the marker the server forwards when a mutation failed after the record had already moved.
 * The view converges on what happened instead of offering a retry of a move that already ran.
 */
function readMovedFailureData(error: unknown): Record<string, unknown> | null {
	if (
		!(error instanceof ApiError) ||
		error.status === undefined ||
		error.status < 500 ||
		typeof error.data !== "object" ||
		error.data === null
	) {
		return null;
	}
	return error.data as Record<string, unknown>;
}

export function readMovedFailureState(
	error: unknown,
	key: "archiveState" | "demotionState",
): "moved" | "partial" | null {
	const state = readMovedFailureData(error)?.[key];
	return state === "moved" || state === "partial" ? state : null;
}

export function readDemotionFailureCause(error: unknown): "cleanup" | "commit" | null {
	const cause = readMovedFailureData(error)?.demotionFailureCause;
	return cause === "cleanup" || cause === "commit" ? cause : null;
}

/** Demoting vacates a task ID: `cleanedTaskIds` names the records that lost a reference to it. */
export interface TaskVacancyResponse {
	success: boolean;
	cleanedTaskIds: string[];
}

export type TaskUpdateRequest = Omit<Partial<Task>, "milestone" | "dueDate" | "project"> & {
	expectedRevision?: string;
	milestone?: string | null;
	dueDate?: string | null;
	project?: string | null;
	commentsAppend?: string[];
	commentAuthor?: string;
};

export interface InitializationStatus {
	initialized: boolean;
	projectPath: string;
	backlogDirectory?: string | null;
	backlogDirectorySource?: "backlog" | ".backlog" | "custom" | null;
	configLocation?: "folder" | "root" | null;
	rootConfigPath?: string | null;
}

// Enhanced error types for better error handling
export class ApiError extends Error {
	constructor(
		message: string,
		public status?: number,
		public code?: string,
		public data?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}

	static fromResponse(response: Response, data?: unknown): ApiError {
		const errorMessage =
			typeof data === "object" && data !== null && "error" in data ? (data as { error?: unknown }).error : undefined;
		const message =
			typeof errorMessage === "string" && errorMessage.trim().length > 0
				? errorMessage
				: `HTTP ${response.status}: ${response.statusText}`;
		return new ApiError(message, response.status, response.statusText, data);
	}
}

export class NetworkError extends Error {
	constructor(message = "Network request failed") {
		super(message);
		this.name = "NetworkError";
	}
}

/** Builds an ApiError that keeps the server's message when the response body carries one. */
async function toApiError(response: Response, fallbackMessage: string): Promise<ApiError> {
	const data = await response.json().catch(() => undefined);
	const serverMessage = typeof data === "object" && data !== null ? (data as { error?: unknown }).error : undefined;
	const message =
		typeof serverMessage === "string" && serverMessage.trim().length > 0 ? serverMessage : fallbackMessage;
	return new ApiError(message, response.status, response.statusText, data);
}

/** The document and decision endpoints answer 409 only when an ID matches more than one file. */
export function isAmbiguousIdConflict(error: unknown): error is ApiError {
	return error instanceof ApiError && error.status === 409;
}

function requirePublishedRecord<T>(find: () => T | null, label: string): T {
	let record: T | null;
	try {
		record = find();
	} catch (error) {
		if (isAmbiguousIdError(error)) throw new ApiError(error.message, 409);
		throw error;
	}
	if (record === null) throw new ApiError(`${label} not found`, 404);
	return record;
}

interface BrowserSearchOptions {
	query?: string;
	types?: SearchResultType[];
	status?: string | string[];
	excludeStatus?: string | string[];
	priority?: SearchPriorityFilter | SearchPriorityFilter[];
	assignee?: string | string[];
	labels?: string[];
	modifiedFiles?: string[];
	limit?: number;
}

type BrowserStatistics = Omit<TaskStatistics, "statusCounts" | "priorityCounts"> & {
	statusCounts: Record<string, number>;
	priorityCounts: Record<string, number>;
};

function searchValues(values: string | string[] = []): string[] {
	return Array.isArray(values) ? values : [values];
}

function trimmedSearchValues(values?: string | string[]): string[] {
	return searchValues(values)
		.map((value) => value.trim())
		.filter(Boolean);
}

function appendSearchValues(params: URLSearchParams, name: string, values: string[]): void {
	for (const value of values) {
		params.append(name, value);
	}
}

function publishedStatuses(config: BacklogConfig): string[] {
	return config.statuses.length ? config.statuses : [...DEFAULT_STATUSES];
}

function publishedSearchFilters(
	filters: Omit<BrowserSearchOptions, "query" | "types" | "limit">,
	config: BacklogConfig,
) {
	const invalidPriority = searchValues(filters.priority).find((value) => !resolvePriorityValue(value, config));
	if (invalidPriority) {
		throw new ApiError(`Unsupported priority '${invalidPriority}'. Use ${formatValidPriorityValues(config)}.`, 400);
	}

	const excluded = trimmedSearchValues(filters.excludeStatus).flatMap((status) => status.split(","));
	const { values, invalid, validStatuses } = resolveConfiguredStatuses(excluded, publishedStatuses(config));
	if (invalid.length > 0) {
		throw new ApiError(
			`Invalid excludeStatus filter: ${invalid.join(", ")}. Valid statuses are: ${validStatuses.join(", ")}.`,
			400,
		);
	}
	return { ...filters, excludeStatus: values };
}

// Request configuration interface
interface RequestConfig {
	retries?: number;
	timeout?: number;
	Headers?: Record<string, string>;
}

// Default configuration
const DEFAULT_CONFIG: RequestConfig = {
	retries: 3,
	timeout: 10000,
};

export class ApiClient {
	private readonly config: RequestConfig;
	private readonly snapshotSearch?: SearchIndex;

	constructor(
		config: RequestConfig = {},
		private readonly snapshot?: BrowserSnapshot,
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		if (snapshot) {
			this.snapshotSearch = new SearchIndex({
				tasks: snapshot.tasks,
				documents: snapshot.docs,
				decisions: snapshot.decisions,
			});
		}
	}

	private async fetchLive(url: string, options?: RequestInit): Promise<Response> {
		if (this.snapshot) throw new ApiError("This operation is unavailable in a static export.", 405);
		return fetch(url, options);
	}

	// Enhanced fetch with retry logic and better error handling
	private async fetchWithRetry(url: string, options: RequestInit = {}, retriesOverride?: number): Promise<Response> {
		const { retries: configuredRetries = 3, timeout = 10000 } = this.config;
		const retries = retriesOverride ?? configuredRetries;
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				// Add timeout to the request
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				const response = await this.fetchLive(url, {
					...options,
					signal: controller.signal,
					headers: {
						"Content-Type": "application/json",
						...options.headers,
					},
				}).finally(() => clearTimeout(timeoutId));

				if (!response.ok) {
					let errorData: unknown = null;
					try {
						errorData = await response.json();
					} catch {
						// Ignore JSON parse errors for error data
					}
					throw ApiError.fromResponse(response, errorData);
				}

				return response;
			} catch (error) {
				lastError = error as Error;

				// Don't retry on client errors (4xx) or specific cases
				if (error instanceof ApiError && error.status && error.status >= 400 && error.status < 500) {
					throw error;
				}

				// For network errors or server errors, retry with exponential backoff
				if (attempt < retries) {
					const delay = Math.min(1000 * 2 ** attempt, 10000);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		// If we get here, all retries failed
		if (lastError instanceof ApiError) {
			throw lastError;
		}
		throw new NetworkError(`Request failed after ${retries + 1} attempts: ${lastError?.message}`);
	}

	private async fetchWithoutRetry(url: string, options: RequestInit = {}): Promise<Response> {
		return await this.fetchWithRetry(url, options, 0);
	}

	// Helper method for JSON responses
	private async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
		const response = await this.fetchWithRetry(url, options);
		return response.json();
	}
	async fetchTasks(options?: {
		status?: string;
		excludeStatus?: string | string[];
		assignee?: string;
		parent?: string;
		priority?: SearchPriorityFilter;
		labels?: string[];
		crossBranch?: boolean;
	}): Promise<Task[]> {
		const params = new URLSearchParams();
		if (options?.status) params.append("status", options.status);
		if (options?.excludeStatus) {
			const statuses = Array.isArray(options.excludeStatus) ? options.excludeStatus : [options.excludeStatus];
			for (const status of statuses) {
				if (status && status.trim().length > 0) {
					params.append("excludeStatus", status.trim());
				}
			}
		}
		if (options?.assignee) params.append("assignee", options.assignee);
		if (options?.parent) params.append("parent", options.parent);
		if (options?.priority) params.append("priority", options.priority);
		if (options?.labels) {
			for (const label of options.labels) {
				if (label && label.trim().length > 0) {
					params.append("label", label.trim());
				}
			}
		}
		// Default to true for cross-branch loading to match TUI behavior
		if (options?.crossBranch !== false) params.append("crossBranch", "true");

		const url = `${API_BASE}/tasks${params.toString() ? `?${params.toString()}` : ""}`;
		return this.fetchJson<Task[]>(url);
	}

	async search({ query, types, limit, ...filters }: BrowserSearchOptions = {}): Promise<SearchResult[]> {
		if (this.snapshot && this.snapshotSearch) {
			return this.snapshotSearch.search({
				query,
				types,
				limit,
				filters: publishedSearchFilters(filters, this.snapshot.config),
			});
		}

		const params = new URLSearchParams();
		if (query) params.set("query", query);
		appendSearchValues(params, "type", types ?? []);
		appendSearchValues(params, "status", searchValues(filters.status));
		appendSearchValues(params, "excludeStatus", trimmedSearchValues(filters.excludeStatus));
		appendSearchValues(params, "priority", searchValues(filters.priority));
		appendSearchValues(params, "assignee", trimmedSearchValues(filters.assignee));
		appendSearchValues(params, "label", trimmedSearchValues(filters.labels));
		appendSearchValues(params, "modifiedFile", trimmedSearchValues(filters.modifiedFiles));
		if (limit !== undefined) params.set("limit", String(limit));

		return this.fetchJson<SearchResult[]>(`${API_BASE}/search${params.size ? `?${params}` : ""}`);
	}

	/** Reads one task through the detail path, so the response already carries its dependency graph. */
	async fetchTask(id: string): Promise<TaskDetail> {
		if (this.snapshot) {
			const { tasks, config, archivedDependencyStatuses } = this.snapshot;
			const result = resolveTaskById(tasks, id);
			switch (result.status) {
				case "found":
					return toTaskDetail(result.task, {
						tasks,
						archivedTasks: archivedDependencyStatuses,
						statuses: config.statuses,
					});
				case "invalid":
					throw new ApiError(`Invalid task ID: ${id}`, 400);
				case "ambiguous":
					throw new ApiError(`Task ID ${id} is ambiguous.`, 409);
				case "not-found":
					throw new ApiError(`Task ${id} not found`, 404);
			}
		}
		return this.fetchJson<TaskDetail>(`${API_BASE}/task/${encodeURIComponent(id)}`);
	}

	async createTask(task: Omit<Task, "id" | "createdDate">): Promise<Task> {
		return this.fetchJson<Task>(`${API_BASE}/tasks`, {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	async updateTask(id: string, updates: TaskUpdateRequest): Promise<Task> {
		return this.fetchJson<Task>(`${API_BASE}/tasks/${id}`, {
			method: "PUT",
			body: JSON.stringify(updates),
		});
	}

	async reorderTask(payload: ReorderTaskPayload): Promise<{ success: boolean; task: Task; changedTasks: Task[] }> {
		return this.fetchJson<{ success: boolean; task: Task; changedTasks: Task[] }>(`${API_BASE}/tasks/reorder`, {
			method: "POST",
			body: JSON.stringify(payload),
		});
	}

	async moveTasks(payload: MoveTasksPayload): Promise<MoveTasksResult> {
		return this.fetchJson<MoveTasksResult>(`${API_BASE}/tasks/move`, {
			method: "POST",
			body: JSON.stringify(payload),
		});
	}

	// Not retried, for the same reason demote is not: the second attempt would target a task the
	// first attempt already archived, and its "not found" would replace the real outcome.
	async archiveTask(id: string): Promise<void> {
		await this.fetchWithoutRetry(`${API_BASE}/tasks/${encodeURIComponent(id)}/archive`, {
			method: "POST",
		});
	}

	async demoteTask(id: string): Promise<TaskVacancyResponse> {
		const response = await this.fetchWithoutRetry(`${API_BASE}/tasks/${encodeURIComponent(id)}/demote`, {
			method: "POST",
		});
		return response.json();
	}

	async getCleanupPreview(age: number): Promise<{
		count: number;
		tasks: Array<{ id: string; title: string; updatedDate?: string; createdDate: string }>;
	}> {
		return this.fetchJson<{
			count: number;
			tasks: Array<{ id: string; title: string; updatedDate?: string; createdDate: string }>;
		}>(`${API_BASE}/tasks/cleanup?age=${age}`);
	}

	/**
	 * Archive the tasks a cleanup preview showed, and only those. The server skips a task that has left
	 * the board or the final status since the preview.
	 */
	async executeCleanup(
		taskIds: string[],
	): Promise<{ success: boolean; movedCount: number; totalCount: number; message: string; failedTasks?: string[] }> {
		return this.fetchJson<{
			success: boolean;
			movedCount: number;
			totalCount: number;
			message: string;
			failedTasks?: string[];
		}>(`${API_BASE}/tasks/cleanup/execute`, {
			method: "POST",
			body: JSON.stringify({ taskIds }),
		});
	}

	async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
		return this.updateTask(id, { status });
	}

	async fetchDuplicateTaskRepairPlan(): Promise<DuplicateRepairPlan> {
		return await this.fetchJson<DuplicateRepairPlan>(`${API_BASE}/tasks/duplicates`);
	}

	async repairDuplicateTaskIds(fingerprint: string): Promise<DuplicateRepairResult> {
		return await this.fetchJson<DuplicateRepairResult>(`${API_BASE}/tasks/duplicates`, {
			method: "POST",
			body: JSON.stringify({ fingerprint }),
		});
	}

	async fetchStatuses(): Promise<string[]> {
		if (this.snapshot) return publishedStatuses(this.snapshot.config);
		const response = await this.fetchLive(`${API_BASE}/statuses`);
		if (!response.ok) {
			throw new Error("Failed to fetch statuses");
		}
		return response.json();
	}

	async fetchConfig(): Promise<BacklogConfig> {
		if (this.snapshot) return this.snapshot.config;
		const response = await this.fetchLive(`${API_BASE}/config`);
		if (!response.ok) {
			throw new Error("Failed to fetch config");
		}
		return response.json();
	}

	async updateConfig(config: BacklogConfig): Promise<BacklogConfig> {
		const response = await this.fetchLive(`${API_BASE}/config`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(config),
		});
		if (!response.ok) {
			throw new Error("Failed to update config");
		}
		return response.json();
	}

	async fetchDoc(id: string): Promise<Document> {
		const docs = this.snapshot?.docs;
		if (docs) {
			return requirePublishedRecord(() => findDocumentById(docs, id, (doc) => doc.path ?? doc.title), "Document");
		}
		const response = await this.fetchLive(`${API_BASE}/docs/${encodeURIComponent(id)}`);
		if (!response.ok) {
			throw await toApiError(response, "Failed to fetch document");
		}
		return response.json();
	}

	async updateDoc(filename: string, content: string, title?: string, path?: string | null): Promise<Document> {
		const payload: Record<string, unknown> = { content };
		if (typeof title === "string") {
			payload.title = title;
		}
		if (path !== undefined) {
			payload.path = path;
		}

		const response = await this.fetchLive(`${API_BASE}/docs/${encodeURIComponent(filename)}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
		if (!response.ok) {
			throw await toApiError(response, "Failed to update document");
		}
		return response.json();
	}

	async createDoc(filename: string, content: string, path?: string): Promise<Document & { success?: boolean }> {
		const response = await this.fetchLive(`${API_BASE}/docs`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ filename, content, path }),
		});
		if (!response.ok) {
			throw new Error("Failed to create document");
		}
		return response.json();
	}

	// Archive is not retried, for the reason task archive is not: the second attempt would target a
	// record the first attempt already archived, and its refusal would replace the real outcome.
	async archiveDoc(id: string): Promise<void> {
		await this.fetchWithoutRetry(`${API_BASE}/docs/${encodeURIComponent(id)}/archive`, { method: "POST" });
	}

	async archiveDecision(id: string): Promise<void> {
		await this.fetchWithoutRetry(`${API_BASE}/decisions/${encodeURIComponent(id)}/archive`, { method: "POST" });
	}

	async fetchDecision(id: string): Promise<Decision> {
		const decisions = this.snapshot?.decisions;
		if (decisions) {
			return requirePublishedRecord(
				() => findDecisionById(decisions, id, (decision) => decision.path ?? decision.title),
				"Decision",
			);
		}
		const response = await this.fetchLive(`${API_BASE}/decisions/${encodeURIComponent(id)}`);
		if (!response.ok) {
			throw await toApiError(response, "Failed to fetch decision");
		}
		return response.json();
	}

	async updateDecision(id: string, input: DecisionUpdateInput): Promise<void> {
		const response = await this.fetchLive(`${API_BASE}/decisions/${encodeURIComponent(id)}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(input),
		});
		if (!response.ok) {
			throw await toApiError(response, "Failed to update decision");
		}
	}

	async createDecision(title: string): Promise<Decision> {
		const response = await this.fetchLive(`${API_BASE}/decisions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ title }),
		});
		if (!response.ok) {
			throw new Error("Failed to create decision");
		}
		return response.json();
	}

	async fetchMilestones(): Promise<Milestone[]> {
		if (this.snapshot) return this.snapshot.milestones;
		const response = await this.fetchLive(`${API_BASE}/milestones`);
		if (!response.ok) {
			throw new Error("Failed to fetch milestones");
		}
		return response.json();
	}

	async fetchArchivedMilestones(): Promise<Milestone[]> {
		if (this.snapshot) return [];
		const response = await this.fetchLive(`${API_BASE}/milestones/archived`);
		if (!response.ok) {
			throw new Error("Failed to fetch archived milestones");
		}
		return response.json();
	}

	async createMilestone(title: string, description?: string, dueDate?: string): Promise<Milestone> {
		const response = await this.fetchLive(`${API_BASE}/milestones`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ title, description, dueDate }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to create milestone");
		}
		return response.json();
	}

	async updateMilestone(
		id: string,
		title: string,
		dueDate?: string | null,
	): Promise<{ success: boolean; milestone?: Milestone | null; message?: string }> {
		const response = await this.fetchLive(`${API_BASE}/milestones/${encodeURIComponent(id)}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ title, dueDate }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to update milestone");
		}
		return response.json();
	}

	async removeMilestone(
		id: string,
		options: { taskHandling?: "clear" | "keep" | "reassign"; reassignTo?: string } = {},
	): Promise<{ success: boolean; message?: string }> {
		const response = await this.fetchLive(`${API_BASE}/milestones/${encodeURIComponent(id)}`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(options),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to remove milestone");
		}
		return response.json();
	}

	async archiveMilestone(id: string): Promise<{ success: boolean; milestone?: Milestone | null }> {
		const response = await this.fetchLive(`${API_BASE}/milestones/${encodeURIComponent(id)}/archive`, {
			method: "POST",
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to archive milestone");
		}
		return response.json();
	}

	async fetchStatistics(): Promise<BrowserStatistics> {
		if (this.snapshot) {
			const { config, tasks, archivedDependencyStatuses } = this.snapshot;
			const statistics = getTaskStatistics(tasks, [], publishedStatuses(config), config.priorities, [
				...tasks,
				...archivedDependencyStatuses,
			]);
			return {
				...statistics,
				statusCounts: Object.fromEntries(statistics.statusCounts),
				priorityCounts: Object.fromEntries(statistics.priorityCounts),
			};
		}
		return this.fetchJson<BrowserStatistics>(`${API_BASE}/statistics`);
	}

	async checkStatus(): Promise<InitializationStatus> {
		return this.fetchJson<InitializationStatus>(`${API_BASE}/status`);
	}

	async initializeProject(options: {
		projectName: string;
		backlogDirectory?: string;
		backlogDirectorySource?: "backlog" | ".backlog" | "custom";
		configLocation?: "folder" | "root";
		integrationMode: "mcp" | "cli" | "none";
		mcpClients?: ("claude" | "codex" | "gemini" | "kiro" | "guide")[];
		agentInstructions?: ("CLAUDE.md" | "AGENTS.md" | "GEMINI.md" | ".github/copilot-instructions.md")[];
		installClaudeAgent?: boolean;
		filesystemOnly?: boolean;
		advancedConfig?: {
			checkActiveBranches?: boolean;
			remoteOperations?: boolean;
			activeBranchDays?: number;
			bypassGitHooks?: boolean;
			autoCommit?: boolean;
			zeroPaddedIds?: number;
			taskPrefix?: string;
			defaultEditor?: string;
			defaultPort?: number;
			autoOpenBrowser?: boolean;
		};
	}): Promise<{ success: boolean; projectName: string; mcpResults?: Record<string, string> }> {
		return this.fetchJson<{ success: boolean; projectName: string; mcpResults?: Record<string, string> }>(
			`${API_BASE}/init`,
			{
				method: "POST",
				body: JSON.stringify(options),
			},
		);
	}
}

export const apiClient = new ApiClient({}, browserSnapshot);
