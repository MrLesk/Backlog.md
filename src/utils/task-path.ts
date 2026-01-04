import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { buildFilenameIdRegex, idForFilename, normalizeId } from "./prefix-config.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
	};
}

/** Default prefix for tasks */
const DEFAULT_TASK_PREFIX = "task";

/**
 * Normalize a task ID by ensuring the prefix is present (uppercase).
 *
 * @param taskId - The ID to normalize (e.g., "123", "task-123", "TASK-123")
 * @param prefix - The prefix to use (default: "task")
 * @returns Normalized ID with uppercase prefix (e.g., "TASK-123")
 *
 * @example
 * normalizeTaskId("123") // => "TASK-123"
 * normalizeTaskId("task-123") // => "TASK-123"
 * normalizeTaskId("TASK-123") // => "TASK-123"
 */
export function normalizeTaskId(taskId: string, prefix: string = DEFAULT_TASK_PREFIX): string {
	return normalizeId(taskId, prefix);
}

/**
 * Extracts the body (numeric portion) from a task ID.
 *
 * @param value - The value to extract from (e.g., "task-123", "123", "task-5.2.1")
 * @param prefix - The prefix to strip (default: "task")
 * @returns The body portion, or null if invalid format
 *
 * @example
 * extractTaskBody("task-123") // => "123"
 * extractTaskBody("123") // => "123"
 * extractTaskBody("task-5.2.1") // => "5.2.1"
 * extractTaskBody("JIRA-456", "JIRA") // => "456"
 */
function extractTaskBody(value: string, prefix: string = DEFAULT_TASK_PREFIX): string | null {
	const trimmed = value.trim();
	if (trimmed === "") return "";
	// Build a pattern that optionally matches the prefix
	const prefixPattern = new RegExp(`^(?:${escapeRegex(prefix)}-)?([0-9]+(?:\\.[0-9]+)*)$`, "i");
	const match = trimmed.match(prefixPattern);
	return match?.[1] ?? null;
}

/**
 * Extracts the task ID from a filename.
 *
 * @param filename - The filename to extract from (e.g., "task-123 - Some Title.md")
 * @param prefix - The prefix to match (default: "task")
 * @returns The normalized task ID, or null if not found
 *
 * @example
 * extractTaskIdFromFilename("task-123 - Title.md") // => "task-123"
 * extractTaskIdFromFilename("JIRA-456 - Title.md", "JIRA") // => "JIRA-456"
 */
function extractTaskIdFromFilename(filename: string, prefix: string = DEFAULT_TASK_PREFIX): string | null {
	const regex = buildFilenameIdRegex(prefix);
	const match = filename.match(regex);
	if (!match || !match[1]) return null;
	return normalizeTaskId(`${prefix}-${match[1]}`, prefix);
}

/**
 * Compares two task IDs for equality.
 * Handles numeric comparison to treat "task-1" and "task-01" as equal.
 *
 * @param left - First ID to compare
 * @param right - Second ID to compare
 * @param prefix - The prefix both IDs should have (default: "task")
 * @returns true if IDs are equivalent
 *
 * @example
 * taskIdsEqual("task-123", "TASK-123") // => true
 * taskIdsEqual("task-1", "task-01") // => true (numeric comparison)
 * taskIdsEqual("task-1.2", "task-1.2") // => true
 */
export function taskIdsEqual(left: string, right: string, prefix: string = DEFAULT_TASK_PREFIX): boolean {
	const leftBody = extractTaskBody(left, prefix);
	const rightBody = extractTaskBody(right, prefix);

	if (leftBody && rightBody) {
		const leftSegs = leftBody.split(".").map((seg) => Number.parseInt(seg, 10));
		const rightSegs = rightBody.split(".").map((seg) => Number.parseInt(seg, 10));
		if (leftSegs.length !== rightSegs.length) {
			return false;
		}
		return leftSegs.every((value, index) => value === rightSegs[index]);
	}

	return normalizeTaskId(left, prefix).toLowerCase() === normalizeTaskId(right, prefix).toLowerCase();
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks if an input ID matches a filename loosely (ignoring leading zeros).
 */
function idsMatchLoosely(inputId: string, filename: string, prefix: string = DEFAULT_TASK_PREFIX): boolean {
	const candidate = extractTaskIdFromFilename(filename, prefix);
	if (!candidate) return false;
	return taskIdsEqual(inputId, candidate, prefix);
}

/**
 * Get the file path for a task by ID
 */
export async function getTaskPath(taskId: string, core?: Core | TaskPathContext): Promise<string | null> {
	const coreInstance = core || new Core(process.cwd());

	try {
		const files = await Array.fromAsync(new Bun.Glob("task-*.md").scan({ cwd: coreInstance.filesystem.tasksDir }));
		const normalizedId = normalizeTaskId(taskId);
		// Use lowercase ID for filename matching (filenames use lowercase prefix)
		const filenameId = idForFilename(normalizedId);
		// First try exact prefix match for speed
		let taskFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));

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
		// Use lowercase ID for filename matching (filenames use lowercase prefix)
		const filenameId = idForFilename(normalizedId);
		// First exact match
		let draftFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));
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
		// Use lowercase ID for filename matching (filenames use lowercase prefix)
		const filenameId = idForFilename(normalizedId);
		// First exact match
		let taskFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));
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
