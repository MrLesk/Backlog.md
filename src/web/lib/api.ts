import type { Task, TaskStatus } from "../types/task";

const API_BASE = "/api";

export class ApiClient {
	async fetchTasks(): Promise<Task[]> {
		const response = await fetch(`${API_BASE}/tasks`);
		if (!response.ok) {
			throw new Error("Failed to fetch tasks");
		}
		return response.json();
	}

	async createTask(task: Omit<Task, "id" | "createdDate">): Promise<Task> {
		const response = await fetch(`${API_BASE}/tasks`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(task),
		});
		if (!response.ok) {
			throw new Error("Failed to create task");
		}
		return response.json();
	}

	async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
		const response = await fetch(`${API_BASE}/tasks/${id}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(updates),
		});
		if (!response.ok) {
			throw new Error("Failed to update task");
		}
		return response.json();
	}

	async archiveTask(id: string): Promise<void> {
		const response = await fetch(`${API_BASE}/tasks/${id}`, {
			method: "DELETE",
		});
		if (!response.ok) {
			throw new Error("Failed to archive task");
		}
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

	async fetchConfig(): Promise<{ projectName: string }> {
		const response = await fetch(`${API_BASE}/config`);
		if (!response.ok) {
			throw new Error("Failed to fetch config");
		}
		return response.json();
	}

	async checkHealth(): Promise<{
		status: "healthy" | "unhealthy";
		timestamp: string;
		responseTime: number;
		project: string;
		checks: {
			filesystem: string;
			config: string;
		};
		error?: string;
	}> {
		const response = await fetch(`${API_BASE}/health`);
		if (!response.ok) {
			throw new Error("Health check failed");
		}
		return response.json();
	}
}

export const apiClient = new ApiClient();
