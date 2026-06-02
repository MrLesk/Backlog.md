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
	WikiPage,
	WikiTreeNode,
} from "../../types/index.ts";

const API_BASE = "/api";

export interface ReorderTaskPayload {
	taskId: string;
	targetStatus: string;
	orderedTaskIds: string[];
	targetMilestone?: string | null;
}

export type TaskUpdateRequest = Omit<Partial<Task>, "milestone"> & {
	milestone?: string | null;
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

	constructor(config: RequestConfig = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
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

		const url = `${API_BASE}/tasks${params.toString() ? `?${params.toString()}` : ""}`;
		return this.fetchJson<Task[]>(url);
	}

	async search(
		options: {
			query?: string;
			types?: SearchResultType[];
			status?: string | string[];
			priority?: SearchPriorityFilter | SearchPriorityFilter[];
			assignee?: string | string[];
			labels?: string[];
			modifiedFiles?: string[];
			limit?: number;
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
		if (options.assignee) {
			const assignees = Array.isArray(options.assignee) ? options.assignee : [options.assignee];
			for (const assignee of assignees) {
				if (assignee && assignee.trim().length > 0) {
					params.append("assignee", assignee.trim());
				}
			}
		}
		if (options.labels) {
			for (const label of options.labels) {
				if (label && label.trim().length > 0) {
					params.append("label", label.trim());
				}
			}
		}
		if (options.modifiedFiles) {
			for (const file of options.modifiedFiles) {
				if (file && file.trim().length > 0) {
					params.append("modifiedFile", file.trim());
				}
			}
		}
		if (options.limit !== undefined) {
			params.set("limit", String(options.limit));
		}

		const url = `${API_BASE}/search${params.toString() ? `?${params.toString()}` : ""}`;
		return this.fetchJson<SearchResult[]>(url);
	}

	async fetchTask(id: string): Promise<Task> {
		return this.fetchJson<Task>(`${API_BASE}/task/${id}`);
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

	async reorderTask(payload: ReorderTaskPayload): Promise<{ success: boolean; task: Task }> {
		return this.fetchJson<{ success: boolean; task: Task }>(`${API_BASE}/tasks/reorder`, {
			method: "POST",
			body: JSON.stringify(payload),
		});
	}

	async archiveTask(id: string): Promise<void> {
		await this.fetchWithRetry(`${API_BASE}/tasks/${id}`, {
			method: "DELETE",
		});
	}

	async completeTask(id: string): Promise<void> {
		await this.fetchWithRetry(`${API_BASE}/tasks/${id}/complete`, {
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
		}>(`${API_BASE}/tasks/cleanup?age=${age}`);
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
		}>(`${API_BASE}/tasks/cleanup/execute`, {
			method: "POST",
			body: JSON.stringify({ age }),
		});
	}

	async updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
		return this.updateTask(id, { status });
	}

	async fetchStatuses(): Promise<string[]> {
		const response = await fetch(`${API_BASE}/statuses`);
		if (!response.ok) {
			throw new Error("Failed to fetch statuses");
		}
		return response.json();
	}

	async fetchConfig(): Promise<BacklogConfig> {
		const response = await fetch(`${API_BASE}/config`);
		if (!response.ok) {
			throw new Error("Failed to fetch config");
		}
		return response.json();
	}

	async updateConfig(config: BacklogConfig): Promise<BacklogConfig> {
		const response = await fetch(`${API_BASE}/config`, {
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

	async listFiles(path: string): Promise<{ name: string; type: "file" | "directory" }[]> {
		const response = await fetch(`${API_BASE}/list-files?path=${encodeURIComponent(path)}`);
		if (!response.ok) {
			throw new Error("Failed to list files");
		}
		const data = await response.json() as { entries: { name: string; type: "file" | "directory" }[] };
		return data.entries;
	}

	async searchFiles(query: string): Promise<{ name: string; path: string; type: "file" | "directory" }[]> {
		const response = await fetch(`${API_BASE}/search-files?query=${encodeURIComponent(query)}`);
		if (!response.ok) {
			throw new Error("Failed to search files");
		}
		const data = await response.json() as { results: { name: string; path: string; type: "file" | "directory" }[] };
		return data.results;
	}

	async fetchDocs(): Promise<Document[]> {
		const response = await fetch(`${API_BASE}/docs`);
		if (!response.ok) {
			throw new Error("Failed to fetch documentation");
		}
		return response.json();
	}

	async fetchDoc(filename: string): Promise<Document> {
		const response = await fetch(`${API_BASE}/docs/${encodeURIComponent(filename)}`);
		if (!response.ok) {
			throw new Error("Failed to fetch document");
		}
		return response.json();
	}

	async fetchDocument(id: string): Promise<Document> {
		const response = await fetch(`${API_BASE}/doc/${encodeURIComponent(id)}`);
		if (!response.ok) {
			throw new Error("Failed to fetch document");
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

		const response = await fetch(`${API_BASE}/docs/${encodeURIComponent(filename)}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});
		if (!response.ok) {
			throw new Error("Failed to update document");
		}
		return response.json();
	}

	async createDoc(filename: string, content: string, path?: string): Promise<Document & { success?: boolean }> {
		const response = await fetch(`${API_BASE}/docs`, {
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

	async fetchDecisions(): Promise<Decision[]> {
		const response = await fetch(`${API_BASE}/decisions`);
		if (!response.ok) {
			throw new Error("Failed to fetch decisions");
		}
		return response.json();
	}

	async fetchDecision(id: string): Promise<Decision> {
		const response = await fetch(`${API_BASE}/decisions/${encodeURIComponent(id)}`);
		if (!response.ok) {
			throw new Error("Failed to fetch decision");
		}
		return response.json();
	}

	async fetchDecisionData(id: string): Promise<Decision> {
		const response = await fetch(`${API_BASE}/decision/${encodeURIComponent(id)}`);
		if (!response.ok) {
			throw new Error("Failed to fetch decision");
		}
		return response.json();
	}

	async updateDecision(id: string, content: string): Promise<void> {
		const response = await fetch(`${API_BASE}/decisions/${encodeURIComponent(id)}`, {
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

	async createDecision(title: string): Promise<Decision> {
		const response = await fetch(`${API_BASE}/decisions`, {
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
		const response = await fetch(`${API_BASE}/milestones`);
		if (!response.ok) {
			throw new Error("Failed to fetch milestones");
		}
		return response.json();
	}

	async fetchArchivedMilestones(): Promise<Milestone[]> {
		const response = await fetch(`${API_BASE}/milestones/archived`);
		if (!response.ok) {
			throw new Error("Failed to fetch archived milestones");
		}
		return response.json();
	}

	async fetchMilestone(id: string): Promise<Milestone> {
		const response = await fetch(`${API_BASE}/milestones/${encodeURIComponent(id)}`);
		if (!response.ok) {
			throw new Error("Failed to fetch milestone");
		}
		return response.json();
	}

	async createMilestone(title: string, description?: string): Promise<Milestone> {
		const response = await fetch(`${API_BASE}/milestones`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ title, description }),
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
	): Promise<{ success: boolean; milestone?: Milestone | null; message?: string }> {
		const response = await fetch(`${API_BASE}/milestones/${encodeURIComponent(id)}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ title }),
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
		const response = await fetch(`${API_BASE}/milestones/${encodeURIComponent(id)}`, {
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
		const response = await fetch(`${API_BASE}/milestones/${encodeURIComponent(id)}/archive`, {
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
		>(`${API_BASE}/statistics`);
	}

	async fetchWikiTree(): Promise<WikiTreeNode[]> {
		const response = await fetch(`${API_BASE}/wiki/tree`);
		if (!response.ok) {
			throw new Error("Failed to fetch wiki tree");
		}
		return response.json();
	}

	async fetchWikiPage(path: string): Promise<WikiPage> {
		const response = await fetch(`${API_BASE}/wiki/${encodeURIComponent(path)}`);
		if (!response.ok) {
			throw new Error("Failed to fetch wiki page");
		}
		return response.json();
	}

	async updateWikiPage(path: string, content: string, title?: string, labels?: string[]): Promise<void> {
		const response = await fetch(`${API_BASE}/wiki/${encodeURIComponent(path)}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content, title, ...(labels !== undefined && { labels }) }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to update wiki page");
		}
	}

	async createWikiPage(path: string, content?: string, labels?: string[]): Promise<{ success: boolean; path: string }> {
		const response = await fetch(`${API_BASE}/wiki`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path, content, ...(labels !== undefined && { labels }) }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to create wiki page");
		}
		return response.json();
	}

	async createWikiFolder(path: string): Promise<{ success: boolean; path: string }> {
		const response = await fetch(`${API_BASE}/wiki`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path, isFolder: true }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to create wiki folder");
		}
		return response.json();
	}

	async renameWikiItem(oldPath: string, newPath: string): Promise<{ success: boolean; path: string }> {
		const response = await fetch(`${API_BASE}/wiki/${encodeURIComponent(oldPath)}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ newPath }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to rename wiki item");
		}
		return response.json();
	}

	async checkStatus(): Promise<InitializationStatus> {
		return this.fetchJson<InitializationStatus>(`${API_BASE}/status`);
	}

	async fetchFileContent(path: string): Promise<{
		content: string;
		path: string;
		lineStart?: number;
		lineEnd?: number;
		totalLines: number;
		isMarkdown: boolean;
	}> {
		return this.fetchJson<{
			content: string;
			path: string;
			lineStart?: number;
			lineEnd?: number;
			totalLines: number;
			isMarkdown: boolean;
		}>(`${API_BASE}/file-content?path=${encodeURIComponent(path)}`);
	}

	async uploadTempAsset(file: File): Promise<{ url: string }> {
		const formData = new FormData();
		formData.append("file", file);
		const response = await fetch(`${API_BASE}/upload?temp=1`, {
			method: "POST",
			body: formData,
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to upload asset");
		}
		return response.json();
	}

	async uploadTempAssetFromUrl(imageUrl: string): Promise<{ url: string }> {
		const response = await fetch(`${API_BASE}/upload?temp=1`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: imageUrl }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to upload asset from URL");
		}
		return response.json();
	}

	async uploadTempAssetFromDataUri(dataUri: string): Promise<{ url: string }> {
		const response = await fetch(`${API_BASE}/upload?temp=1`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dataUri }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to upload asset from data URI");
		}
		return response.json();
	}

	async convertDocx(
		file: File,
	): Promise<{ html: string; images: { tempUrl: string; alt: string }[]; messages: string[] }> {
		const formData = new FormData();
		formData.append("file", file);
		const response = await fetch(`${API_BASE}/docx/convert`, {
			method: "POST",
			body: formData,
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to convert Word document");
		}
		return response.json();
	}

	async promoteAssets(urls: string[]): Promise<Record<string, string>> {
		const response = await fetch(`${API_BASE}/assets/promote`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ urls }),
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.error || "Failed to promote assets");
		}
		return response.json();
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

export const apiClient = new ApiClient();
