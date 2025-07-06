export interface Task {
	id: string;
	title: string;
	description: string;
	status: TaskStatus;
	assignee: string[];
	labels: string[];
	createdDate: string;
	updatedDate?: string;
	dependencies: string[];
	parentTaskId?: string;
	priority?: "high" | "medium" | "low";
}

export type TaskStatus = string;

export interface CreateTaskRequest {
	title: string;
	description?: string;
	status?: TaskStatus;
	assignee?: string[];
	labels?: string[];
	dependencies?: string[];
	parentTaskId?: string;
	priority?: "high" | "medium" | "low";
}

export interface UpdateTaskRequest {
	title?: string;
	description?: string;
	status?: TaskStatus;
	assignee?: string[];
	labels?: string[];
	dependencies?: string[];
	parentTaskId?: string;
	priority?: "high" | "medium" | "low";
}
