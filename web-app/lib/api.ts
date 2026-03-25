"use client";

import type { BacklogConfig, Decision, Document, Task, TaskCreateInput, TaskUpdateInput } from "@/types";

const API_BASE = "/api";

export interface ReorderTaskPayload {
	taskId: string;
	targetStatus: string;
	orderedTaskIds: string[];
}

export class ApiError extends Error {
	constructor(
		message: string,
		public status?: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export class NetworkError extends Error {
	constructor(message = "Network request failed") {
		super(message);
		this.name = "NetworkError";
	}
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 10000);

	try {
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
			throw new ApiError(`HTTP ${response.status}: ${response.statusText}`, response.status);
		}

		return response.json();
	} catch (err) {
		clearTimeout(timeoutId);
		if (err instanceof ApiError) throw err;
		throw new NetworkError(err instanceof Error ? err.message : "Request failed");
	}
}

export const apiClient = {
	// Tasks
	fetchTasks(): Promise<Task[]> {
		return fetchJson(`${API_BASE}/tasks`);
	},

	fetchDrafts(): Promise<Task[]> {
		return fetchJson(`${API_BASE}/tasks?drafts=true`);
	},

	fetchTask(id: string): Promise<Task> {
		return fetchJson(`${API_BASE}/tasks/${id}`);
	},

	createTask(task: TaskCreateInput): Promise<Task> {
		return fetchJson(`${API_BASE}/tasks`, { method: "POST", body: JSON.stringify(task) });
	},

	updateTask(id: string, updates: TaskUpdateInput): Promise<Task> {
		return fetchJson(`${API_BASE}/tasks/${id}`, { method: "PUT", body: JSON.stringify(updates) });
	},

	completeTask(id: string): Promise<Task> {
		return fetchJson(`${API_BASE}/tasks/${id}`, {
			method: "PUT",
			body: JSON.stringify({ _action: "complete" }),
		});
	},

	archiveTask(id: string): Promise<void> {
		return fetchJson(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
	},

	reorderTask(payload: ReorderTaskPayload): Promise<{ success: boolean }> {
		// Map payload to our API format: update each task's ordinal
		return fetchJson(`${API_BASE}/tasks/reorder`, {
			method: "POST",
			body: JSON.stringify(payload),
		});
	},

	search(query: string): Promise<Task[]> {
		return fetchJson(`${API_BASE}/tasks/search?q=${encodeURIComponent(query)}`);
	},

	getCleanupPreview(): Promise<{ count: number; tasks: Task[] }> {
		return fetchJson(`${API_BASE}/tasks/cleanup`);
	},

	executeCleanup(): Promise<{ deleted: number }> {
		return fetchJson(`${API_BASE}/tasks/cleanup`, { method: "POST" });
	},

	// Config
	fetchConfig(): Promise<BacklogConfig> {
		return fetchJson(`${API_BASE}/config`);
	},

	fetchStatuses(): Promise<string[]> {
		return fetchJson<BacklogConfig>(`${API_BASE}/config`).then((c) => c.statuses);
	},

	updateConfig(config: Partial<BacklogConfig>): Promise<BacklogConfig> {
		return fetchJson(`${API_BASE}/config`, { method: "PUT", body: JSON.stringify(config) });
	},

	// Documents
	fetchDocs(): Promise<Document[]> {
		return fetchJson(`${API_BASE}/docs`);
	},

	fetchDoc(id: string): Promise<Document> {
		return fetchJson(`${API_BASE}/docs/${encodeURIComponent(id)}`);
	},

	createDoc(input: { title: string; content?: string }): Promise<Document> {
		return fetchJson(`${API_BASE}/docs`, { method: "POST", body: JSON.stringify(input) });
	},

	updateDoc(id: string, input: { title?: string; content?: string }): Promise<Document> {
		return fetchJson(`${API_BASE}/docs/${encodeURIComponent(id)}`, {
			method: "PUT",
			body: JSON.stringify(input),
		});
	},

	deleteDoc(id: string): Promise<void> {
		return fetchJson(`${API_BASE}/docs/${encodeURIComponent(id)}`, { method: "DELETE" });
	},

	// Decisions
	fetchDecisions(): Promise<Decision[]> {
		return fetchJson(`${API_BASE}/decisions`);
	},

	fetchDecision(id: string): Promise<Decision> {
		return fetchJson(`${API_BASE}/decisions/${encodeURIComponent(id)}`);
	},

	createDecision(input: { title: string; status?: string; content?: string }): Promise<Decision> {
		return fetchJson(`${API_BASE}/decisions`, { method: "POST", body: JSON.stringify(input) });
	},

	updateDecision(id: string, input: { title?: string; status?: string; content?: string }): Promise<Decision> {
		return fetchJson(`${API_BASE}/decisions/${encodeURIComponent(id)}`, {
			method: "PUT",
			body: JSON.stringify(input),
		});
	},

	deleteDecision(id: string): Promise<void> {
		return fetchJson(`${API_BASE}/decisions/${encodeURIComponent(id)}`, { method: "DELETE" });
	},

	// Statistics
	fetchStatistics(): Promise<{
		statusCounts: Record<string, number>;
		priorityCounts: Record<string, number>;
		totalTasks: number;
		completedTasks: number;
		completionPercentage: number;
		draftCount: number;
	}> {
		return fetchJson(`${API_BASE}/statistics`);
	},
};
