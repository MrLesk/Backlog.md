import { join } from "node:path";
import { Core } from "../core/backlog.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
	};
}

/**
 * Normalize a task ID to ensure it starts with "task-"
 */
export function normalizeTaskId(taskId: string): string {
	return taskId.startsWith("task-") ? taskId : `task-${taskId}`;
}

/**
 * Get the file path for a task by ID
 */
export async function getTaskPath(taskId: string, core?: Core | TaskPathContext): Promise<string | null> {
	const coreInstance = core || new Core(process.cwd());

	try {
		const files = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: coreInstance.filesystem.tasksDir }));
		const normalizedId = normalizeTaskId(taskId);
		// Handle both formats: "task-123 - Title.md" and "task-123-title.md"
		const taskFile = files.find((f) => f.startsWith(`${normalizedId} -`) || f.startsWith(`${normalizedId}-`));

		if (taskFile) {
			return join(coreInstance.filesystem.tasksDir, taskFile);
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Get the file path for a draft by ID
 */
export async function getDraftPath(taskId: string, core: Core): Promise<string | null> {
	try {
		const draftsDir = await core.filesystem.getDraftsDir();
		const files = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: draftsDir }));
		const normalizedId = normalizeTaskId(taskId);
		// Handle both formats: "task-123 - Title.md" and "task-123-title.md"
		const draftFile = files.find((f) => f.startsWith(`${normalizedId} -`) || f.startsWith(`${normalizedId}-`));

		if (draftFile) {
			return join(draftsDir, draftFile);
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Get the filename (without directory) for a task by ID
 */
export async function getTaskFilename(taskId: string, core?: Core | TaskPathContext): Promise<string | null> {
	const coreInstance = core || new Core(process.cwd());

	try {
		const files = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: coreInstance.filesystem.tasksDir }));
		const normalizedId = normalizeTaskId(taskId);
		// Handle both formats: "task-123 - Title.md" and "task-123-title.md"
		const taskFile = files.find((f) => f.startsWith(`${normalizedId} -`) || f.startsWith(`${normalizedId}-`));

		return taskFile || null;
	} catch {
		return null;
	}
}

/**
 * Check if a task file exists
 */
export async function taskFileExists(taskId: string, core?: Core | TaskPathContext): Promise<boolean> {
	const path = await getTaskPath(taskId, core);
	return path !== null;
}
