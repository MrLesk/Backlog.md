import { z } from "zod";

const TaskSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().optional(),
	status: z.string(),
	priority: z.enum(["low", "medium", "high"]),
	assignee: z.string().optional(),
	labels: z.array(z.string()).default([]),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

const API_BASE = "/api";

class APIClient {
	private async request<T>(
		endpoint: string,
		options?: RequestInit,
	): Promise<T> {
		const response = await fetch(`${API_BASE}${endpoint}`, {
			headers: {
				"Content-Type": "application/json",
				...options?.headers,
			},
			...options,
		});

		if (!response.ok) {
			throw new Error(
				`API request failed: ${response.status} ${response.statusText}`,
			);
		}

		return response.json();
	}

	async getTasks(): Promise<Task[]> {
		return this.request<Task[]>("/tasks");
	}

	async getTask(id: string): Promise<Task> {
		return this.request<Task>(`/tasks/${id}`);
	}

	async createTask(
		task: Omit<Task, "id" | "createdAt" | "updatedAt">,
	): Promise<Task> {
		return this.request<Task>("/tasks", {
			method: "POST",
			body: JSON.stringify(task),
		});
	}

	async updateTask(
		id: string,
		updates: Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>,
	): Promise<Task> {
		return this.request<Task>(`/tasks/${id}`, {
			method: "PUT",
			body: JSON.stringify(updates),
		});
	}

	async archiveTask(id: string): Promise<void> {
		await this.request(`/tasks/${id}`, {
			method: "DELETE",
		});
	}

	async getBoardData(): Promise<{ statuses: string[]; tasks: Task[] }> {
		return this.request<{ statuses: string[]; tasks: Task[] }>("/board");
	}
}

export const api = new APIClient();
