import type { BacklogConfig, Decision, Document, Task, TaskStatus } from "../../types/index.ts";

const API_BASE = "/api";

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
	async fetchTasks(options?: { status?: string; assignee?: string; parent?: string }): Promise<Task[]> {
		const params = new URLSearchParams();
		if (options?.status) params.append("status", options.status);
		if (options?.assignee) params.append("assignee", options.assignee);
		if (options?.parent) params.append("parent", options.parent);

		const url = `${API_BASE}/tasks${params.toString() ? `?${params.toString()}` : ""}`;
		return this.fetchJson<Task[]>(url);
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

	async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
		return this.fetchJson<Task>(`${API_BASE}/tasks/${id}`, {
			method: "PUT",
			body: JSON.stringify(updates),
		});
	}

	async reorderTask(
		taskId: string,
		newOrdinal: number,
		columnTasks?: Task[],
	): Promise<{ success: boolean; task: Task }> {
		return this.fetchJson<{ success: boolean; task: Task }>(`${API_BASE}/tasks/reorder`, {
			method: "POST",
			body: JSON.stringify({ taskId, newOrdinal, columnTasks }),
		});
	}

	async archiveTask(id: string): Promise<void> {
		await this.fetchWithRetry(`${API_BASE}/tasks/${id}`, {
			method: "DELETE",
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

	async updateDoc(filename: string, content: string): Promise<void> {
		const response = await fetch(`${API_BASE}/docs/${encodeURIComponent(filename)}`, {
			method: "PUT",
			headers: {
				"Content-Type": "text/plain",
			},
			body: content,
		});
		if (!response.ok) {
			throw new Error("Failed to update document");
		}
	}

	async createDoc(filename: string, content: string): Promise<{ id: string }> {
		const response = await fetch(`${API_BASE}/docs`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ filename, content }),
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
}

export const apiClient = new ApiClient();
