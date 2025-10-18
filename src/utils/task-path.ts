import { join } from "node:path";
import { Core } from "../core/backlog.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
	};
}

/**
 * Normalize a task ID by ensuring the "task-" prefix is present (case-insensitive)
 * while preserving the numeric/content portion as provided.
 */
export function normalizeTaskId(taskId: string): string {
	const trimmed = taskId.trim();
	const match = trimmed.match(/^task-(.+)$/i);
	const body = match ? match[1] : trimmed;
	return `task-${body}`;
}

function extractTaskBody(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed === "") return "";
	const match = trimmed.match(/^(?:task-)?([0-9]+(?:\.[0-9]+)*)$/i);
	return match?.[1] ?? null;
}

function extractTaskIdFromFilename(filename: string): string | null {
	const match = filename.match(/^task-([0-9]+(?:\.[0-9]+)*)/i);
	if (!match || !match[1]) return null;
	return normalizeTaskId(`task-${match[1]}`);
}

export function taskIdsEqual(left: string, right: string): boolean {
	const leftBody = extractTaskBody(left);
	const rightBody = extractTaskBody(right);

	if (leftBody && rightBody) {
		const leftSegs = leftBody.split(".").map((seg) => Number.parseInt(seg, 10));
		const rightSegs = rightBody.split(".").map((seg) => Number.parseInt(seg, 10));
		if (leftSegs.length !== rightSegs.length) {
			return false;
		}
		return leftSegs.every((value, index) => value === rightSegs[index]);
	}

	return normalizeTaskId(left).toLowerCase() === normalizeTaskId(right).toLowerCase();
}

function idsMatchLoosely(inputId: string, filename: string): boolean {
	const candidate = extractTaskIdFromFilename(filename);
	if (!candidate) return false;
	return taskIdsEqual(inputId, candidate);
}

/**
 * Get the file path for a task by ID
 */
export async function getTaskPath(taskId: string, core?: Core | TaskPathContext): Promise<string | null> {
	const coreInstance = core || new Core(process.cwd());

	try {
		const files = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: coreInstance.filesystem.tasksDir }));
		const normalizedId = normalizeTaskId(taskId);
		// First try exact prefix match for speed
		let taskFile = files.find((f) => f.startsWith(`${normalizedId} -`) || f.startsWith(`${normalizedId}-`));

		// If not found, try loose numeric match ignoring leading zeros
		if (!taskFile) {
			taskFile = files.find((f) => idsMatchLoosely(taskId, f));
		}

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
		// First exact match
		let draftFile = files.find((f) => f.startsWith(`${normalizedId} -`) || f.startsWith(`${normalizedId}-`));
		// Fallback to loose numeric match ignoring leading zeros
		if (!draftFile) {
			draftFile = files.find((f) => idsMatchLoosely(taskId, f));
		}

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
		// First exact match
		let taskFile = files.find((f) => f.startsWith(`${normalizedId} -`) || f.startsWith(`${normalizedId}-`));
		if (!taskFile) {
			taskFile = files.find((f) => idsMatchLoosely(taskId, f));
		}

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
