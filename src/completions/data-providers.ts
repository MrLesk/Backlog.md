import { Core } from "../index.ts";
import type { BacklogConfig } from "../types/index.ts";

/**
 * Get all task IDs from the backlog
 */
export async function getTaskIds(): Promise<string[]> {
	try {
		const tasks = await Core.listTasks();
		return tasks.map((t) => t.id).sort();
	} catch {
		return [];
	}
}

/**
 * Get configured status values
 */
export async function getStatuses(): Promise<string[]> {
	try {
		const config: BacklogConfig = await Core.getConfig();
		const statuses = config.statuses || ["To Do", "In Progress", "Done"];
		return statuses;
	} catch {
		return ["To Do", "In Progress", "Done"];
	}
}

/**
 * Get priority values
 */
export function getPriorities(): string[] {
	return ["high", "medium", "low"];
}

/**
 * Get unique labels from all tasks
 */
export async function getLabels(): Promise<string[]> {
	try {
		const tasks = await Core.listTasks();
		const labels = new Set<string>();
		for (const task of tasks) {
			if (task.labels) {
				for (const label of task.labels) {
					labels.add(label);
				}
			}
		}
		return Array.from(labels).sort();
	} catch {
		return [];
	}
}

/**
 * Get unique assignees from all tasks
 */
export async function getAssignees(): Promise<string[]> {
	try {
		const tasks = await Core.listTasks();
		const assignees = new Set<string>();
		for (const task of tasks) {
			if (task.assignee) {
				for (const assignee of task.assignee) {
					assignees.add(assignee);
				}
			}
		}
		return Array.from(assignees).sort();
	} catch {
		return [];
	}
}

/**
 * Get all document IDs from the backlog
 */
export async function getDocumentIds(): Promise<string[]> {
	try {
		const docs = await Core.listDocuments();
		return docs.map((d) => d.id).sort();
	} catch {
		return [];
	}
}
