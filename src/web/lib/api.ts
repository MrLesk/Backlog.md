import type { TaskStatistics } from "../../core/statistics.ts";
import type {
	BacklogConfig,
	Decision,
	Document,
	Milestone,
	SearchPriorityFilter,
	SearchResult,
	SearchResultType,
	Task,
	TaskStatus,
} from "../../types/index.ts";

const API_BASE = "/api";

export interface ReorderTaskPayload {
	taskId: string;
	targetStatus: string;
	orderedTaskIds: string[];
	targetMilestone?: string | null;
}

export interface InitializationStatus {
	initialized: boolean;
	projectPath: string;
	backlogDirectory?: string | null;
	backlogDirectorySource?: "backlog" | ".backlog" | "custom" | null;
	configLocation?: "folder" | "root" | null;
	rootConfigPath?: string | null;
	currentProject?: string | null;
}

export interface ProjectSummary {
	key: string;
	path?: string;
	projectName?: string;
}

export interface ProjectsResponse {
	defaultProject?: string;
	projects: ProjectSummary[];
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
		const message = `HTTP ${response.status}: ${response.statusText}`;
		return new ApiError(message, response.status, response.statusText, data);
	}
}

export class NetworkError extends Error {
	constructor(message = "Network request failed") {
		super(message);
		this.name = "NetworkError";
	}
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
	private config: RequestConfig;
	private activeProject: string | null = null;

	constructor(config: RequestConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	setActiveProject(project: string | null | undefined): void {
		this.activeProject = project?.trim() || null;
	}

	getActiveProject(): string | null {
		return this.activeProject;
	}

	private resolveProject(project?: string | null): string | null {
		return project?.trim() || this.activeProject;
	}

	private buildUrl(path: string, project?: string | null): string {
		const resolvedProject = this.resolveProject(project);
		if (!resolvedProject) {
			return path;
		}

		const [pathname, queryString = ""] = path.split("?");
		const params = new URLSearchParams(queryString);
		params.set("project", resolvedProject);
		return `${pathname}?${params.toString()}`;
	}

	private withProjectBody<T extends object>(body: T, project?: string | null): T | (T & { project: string }) {
		const resolvedProject = this.resolveProject(project);
		if (!resolvedProject) {
			return body;
		}
		return { ...body, project: resolvedProject };
	}

	// Enhanced fetch with retry logic and better error handling
	private async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
		const { retries = 3, timeout = 10000 } = this.config;
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				// Add timeout to the request
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				const response = await fetch(url, {
					...options,
					signal: controller.signal,
					headers: {
						"Content-Type": "application/json",
						...options.headers,
					},
				});

				clearTimeout(timeoutId);

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

	// Helper method for JSON responses
	private async fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
		const response = await this.fetchWithRetry(url, options);
		return response.json();
	}
	async fetchTasks(options?: {
		status?: string;
		assignee?: string;
		parent?: string;
		priority?: SearchPriorityFilter;
		labels?: string[];
		crossBranch?: boolean;
		project?: string;
	}): Promise<Task[]> {
		const params = new URLSearchParams();
		if (options?.status) params.append("status", options.status);
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

		const url = this.buildUrl(`${API_BASE}/tasks${params.toString() ? `?${params.toString()}` : ""}`, options?.project);
		return this.fetchJson<Task[]>(url);
	}

	async search(
		options: {
			query?: string;
			types?: SearchResultType[];
			status?: string | string[];
			priority?: SearchPriorityFilter | SearchPriorityFilter[];
			labels?: string[];
			limit?: number;
			project?: string;
		} = {},
	): Promise<SearchResult[]> {
		const params = new URLSearchParams();
		if (options.query) {
			params.set("query", options.query);
		}
		if (options.types && options.types.length > 0) {
			for (const type of options.types) {
				params.append("type", type);
			}
		}
		if (options.status) {
			const statuses = Array.isArray(options.status) ? options.status : [options.status];
			for (const status of statuses) {
				params.append("status", status);
			}
		}
		if (options.priority) {
			const priorities = Array.isArray(options.priority) ? options.priority : [options.priority];
			for (const priority of priorities) {
				params.append("priority", priority);
			}
		}
		if (options.labels) {
			for (const label of options.labels) {
				if (label && label.trim().length > 0) {
					params.append("label", label.trim());
				}
			}
		}
		if (options.limit !== undefined) {
			params.set("limit", String(options.limit));
		}

		const url = this.buildUrl(`${API_BASE}/search${params.toString() ? `?${params.toString()}` : ""}`, options.project);
		return this.fetchJson<SearchResult[]>(url);
	}

	async fetchTask(id: string, project?: string): Promise<Task> {
		return this.fetchJson<Task>(this.buildUrl(`${API_BASE}/task/${id}`, project));
	}

	async createTask(task: Omit<Task, "id" | "createdDate">, project?: string): Promise<Task> {
		return this.fetchJson<Task>(this.buildUrl(`${API_BASE}/tasks`, project), {
			method: "POST",
			body: JSON.stringify(this.withProjectBody(task, project)),
		});
	}

	async updateTask(
		id: string,
		updates: Omit<Partial<Task>, "milestone"> & { milestone?: string | null },
		project?: string,
	): Promise<Task> {
		return this.fetchJson<Task>(this.buildUrl(`${API_BASE}/tasks/${id}`, project), {
			method: "PUT",
			body: JSON.stringify(this.withProjectBody(updates, project)),
		});
	}

	async reorderTask(payload: ReorderTaskPayload, project?: string): Promise<{ success: boolean; task: Task }> {
		return this.fetchJson<{ success: boolean; task: Task }>(this.buildUrl(`${API_BASE}/tasks/reorder`, project), {
			method: "POST",
			body: JSON.stringify(this.withProjectBody(payload, project)),
		});
	}

	async archiveTask(id: string, project?: string): Promise<void> {
		await this.fetchWithRetry(this.buildUrl(`${API_BASE}/tasks/${id}`, project), {
			method: "DELETE",
		});
	}

	async completeTask(id: string, project?: string): Promise<void> {
		await this.fetchWithRetry(this.buildUrl(`${API_BASE}/tasks/${id}/complete`, project), {
			method: "POST",
		});
	}

	async getCleanupPreview(age: number): Promise<{
		count: number;
		tasks: Array<{ id: string; title: string; updatedDate?: string; createdDate: string }>;
	}> {
		return this.fetchJson<{
			count: number;
			tasks: Array<{ id: string; title: string; updatedDate?: string; createdDate: string }>;
		}>(this.buildUrl(`${API_BASE}/tasks/cleanup?age=${age}`));
	}

	async executeCleanup(
		age: number,
	): Promise<{ success: boolean; movedCount: number; totalCount: number; message: string; failedTasks?: string[] }> {
		return this.fetchJson<{
			success: boolean;
			movedCount: number;
			totalCount: number;
			message: string;
			failedTasks?: string[];
		}>(this.buildUrl(`${API_BASE}/tasks/cleanup/execute`), {
			method: "POST",
			body: JSON.stringify(this.withProjectBody({ age }, undefined)),
		});
	}

	async updateTaskStatus(id: string, status: TaskStatus, project?: string): Promise<Task> {
		return this.updateTask(id, { status }, project);
	}

	async fetchStatuses(project?: string): Promise<string[]> {
		return this.fetchJson<string[]>(this.buildUrl(`${API_BASE}/statuses`, project));
	}

	async fetchProjects(): Promise<ProjectsResponse> {
		return this.fetchJson<ProjectsResponse>(`${API_BASE}/projects`);
	}

	async fetchConfig(project?: string): Promise<BacklogConfig> {
		return this.fetchJson<BacklogConfig>(this.buildUrl(`${API_BASE}/config`, project));
	}

	async updateConfig(config: BacklogConfig, project?: string): Promise<BacklogConfig> {
		return this.fetchJson<BacklogConfig>(this.buildUrl(`${API_BASE}/config`, project), {
			method: "PUT",
			body: JSON.stringify(this.withProjectBody(config, project)),
		});
	}

	async fetchDocs(project?: string): Promise<Document[]> {
		return this.fetchJson<Document[]>(this.buildUrl(`${API_BASE}/docs`, project));
	}

	async fetchDoc(filename: string, project?: string): Promise<Document> {
		return this.fetchJson<Document>(this.buildUrl(`${API_BASE}/docs/${encodeURIComponent(filename)}`, project));
	}

	async fetchDocument(id: string, project?: string): Promise<Document> {
		return this.fetchJson<Document>(this.buildUrl(`${API_BASE}/doc/${encodeURIComponent(id)}`, project));
	}

	async updateDoc(filename: string, content: string, title?: string, project?: string): Promise<void> {
		const payload: Record<string, unknown> = { content };
		if (typeof title === "string") {
			payload.title = title;
		}

		const response = await fetch(this.buildUrl(`${API_BASE}/docs/${encodeURIComponent(filename)}`, project), {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(this.withProjectBody(payload, project)),
		});
		if (!response.ok) {
			throw new Error("Failed to update document");
		}
	}

	async createDoc(filename: string, content: string, project?: string): Promise<{ id: string }> {
		const response = await fetch(this.buildUrl(`${API_BASE}/docs`, project), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(this.withProjectBody({ filename, content }, project)),
		});
		if (!response.ok) {
			throw new Error("Failed to create document");
		}
		return response.json();
	}

	async fetchDecisions(project?: string): Promise<Decision[]> {
		return this.fetchJson<Decision[]>(this.buildUrl(`${API_BASE}/decisions`, project));
	}

	async fetchDecision(id: string, project?: string): Promise<Decision> {
		return this.fetchJson<Decision>(this.buildUrl(`${API_BASE}/decisions/${encodeURIComponent(id)}`, project));
	}

	async fetchDecisionData(id: string, project?: string): Promise<Decision> {
		return this.fetchJson<Decision>(this.buildUrl(`${API_BASE}/decision/${encodeURIComponent(id)}`, project));
	}

	async updateDecision(id: string, content: string, project?: string): Promise<void> {
		const response = await fetch(this.buildUrl(`${API_BASE}/decisions/${encodeURIComponent(id)}`, project), {
			method: "PUT",
			headers: {
				"Content-Type": "text/plain",
			},
			body: content,
		});
		if (!response.ok) {
			throw new Error("Failed to update decision");
		}
	}

	async createDecision(title: string, project?: string): Promise<Decision> {
		const response = await fetch(this.buildUrl(`${API_BASE}/decisions`, project), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(this.withProjectBody({ title }, project)),
		});
		if (!response.ok) {
			throw new Error("Failed to create decision");
		}
		return response.json();
	}

	async fetchMilestones(project?: string): Promise<Milestone[]> {
		return this.fetchJson<Milestone[]>(this.buildUrl(`${API_BASE}/milestones`, project));
	}

	async fetchArchivedMilestones(project?: string): Promise<Milestone[]> {
		return this.fetchJson<Milestone[]>(this.buildUrl(`${API_BASE}/milestones/archived`, project));
	}

	async fetchMilestone(id: string, project?: string): Promise<Milestone> {
		return this.fetchJson<Milestone>(this.buildUrl(`${API_BASE}/milestones/${encodeURIComponent(id)}`, project));
	}

	async createMilestone(title: string, description?: string, project?: string): Promise<Milestone> {
		const response = await fetch(this.buildUrl(`${API_BASE}/milestones`, project), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(this.withProjectBody({ title, description }, project)),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to create milestone");
		}
		return response.json();
	}

	async archiveMilestone(id: string, project?: string): Promise<{ success: boolean; milestone?: Milestone | null }> {
		const response = await fetch(this.buildUrl(`${API_BASE}/milestones/${encodeURIComponent(id)}/archive`, project), {
			method: "POST",
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to archive milestone");
		}
		return response.json();
	}

	async fetchStatistics(): Promise<
		TaskStatistics & { statusCounts: Record<string, number>; priorityCounts: Record<string, number> }
	> {
		return this.fetchJson<
			TaskStatistics & { statusCounts: Record<string, number>; priorityCounts: Record<string, number> }
		>(this.buildUrl(`${API_BASE}/statistics`));
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

export const apiClient = new ApiClient();
