import { Core } from "../index.ts";
import type { BacklogConfig } from "../types/index.ts";

type CoreCallback<T> = (core: Core) => Promise<T>;

/**
 * Create a Core instance bound to the current working directory.
 */
function createCore(): Core {
	return new Core(process.cwd());
}

/**
 * Execute a callback with a Core instance, returning a fallback value if anything fails.
 */
async function withCore<T>(callback: CoreCallback<T>, fallback: T): Promise<T> {
	try {
		const core = createCore();
		return await callback(core);
	} catch {
		return fallback;
	}
}

function getDefaultStatuses(): string[] {
	return ["To Do", "In Progress", "Done"];
}

/**
 * Get all task IDs from the backlog
 */
export async function getTaskIds(): Promise<string[]> {
	return await withCore(async (core) => {
		const tasks = await core.filesystem.listTasks();
		return tasks.map((task) => task.id).sort();
	}, []);
}

/**
 * Get configured status values
 */
export async function getStatuses(): Promise<string[]> {
	return await withCore(async (core) => {
		const config: BacklogConfig | null = await core.filesystem.loadConfig();
		const statuses = config?.statuses;
		if (Array.isArray(statuses) && statuses.length > 0) {
			return statuses;
		}
		return getDefaultStatuses();
	}, getDefaultStatuses());
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
	return await withCore(async (core) => {
		const tasks = await core.filesystem.listTasks();
		const labels = new Set<string>();
		for (const task of tasks) {
			for (const label of task.labels) {
				labels.add(label);
			}
		}
		return Array.from(labels).sort();
	}, []);
}

/**
 * Get unique assignees from all tasks
 */
export async function getAssignees(): Promise<string[]> {
	return await withCore(async (core) => {
		const tasks = await core.filesystem.listTasks();
		const assignees = new Set<string>();
		for (const task of tasks) {
			for (const assignee of task.assignee) {
				assignees.add(assignee);
			}
		}
		return Array.from(assignees).sort();
	}, []);
}

/**
 * Get all document IDs from the backlog
 */
export async function getDocumentIds(): Promise<string[]> {
	return await withCore(async (core) => {
		const docs = await core.filesystem.listDocuments();
		return docs.map((doc) => doc.id).sort();
	}, []);
}
