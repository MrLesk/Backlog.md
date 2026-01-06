import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import {
	buildFilenameIdRegex,
	buildGlobPattern,
	extractAnyPrefix,
	idForFilename,
	normalizeId,
} from "./prefix-config.ts";

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

	// Extract prefix from the taskId, or use default
	const prefix = extractAnyPrefix(taskId) ?? DEFAULT_TASK_PREFIX;
	const globPattern = buildGlobPattern(prefix);

	try {
		const files = await Array.fromAsync(new Bun.Glob(globPattern).scan({ cwd: coreInstance.filesystem.tasksDir }));
		const normalizedId = normalizeTaskId(taskId, prefix);
		// Use lowercase ID for filename matching (filenames use lowercase prefix)
		const filenameId = idForFilename(normalizedId);
		// First try exact prefix match for speed
		let taskFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));

		// If not found, try loose numeric match ignoring leading zeros
		if (!taskFile) {
			taskFile = files.find((f) => idsMatchLoosely(taskId, f, prefix));
		}

		if (taskFile) {
			return join(coreInstance.filesystem.tasksDir, taskFile);
		}

		return null;
	} catch {
		return null;
	}
}

/** Default prefix for drafts */
const DEFAULT_DRAFT_PREFIX = "draft";

/**
 * Normalize a draft ID by ensuring the draft prefix is present (uppercase).
 */
function normalizeDraftId(draftId: string): string {
	return normalizeId(draftId, DEFAULT_DRAFT_PREFIX);
}

/**
 * Checks if an input ID matches a filename loosely for drafts.
 */
function draftIdsMatchLoosely(inputId: string, filename: string): boolean {
	const candidate = extractDraftIdFromFilename(filename);
	if (!candidate) return false;
	return draftIdsEqual(inputId, candidate);
}

/**
 * Extracts the draft ID from a filename.
 */
function extractDraftIdFromFilename(filename: string): string | null {
	const regex = buildFilenameIdRegex(DEFAULT_DRAFT_PREFIX);
	const match = filename.match(regex);
	if (!match || !match[1]) return null;
	return normalizeDraftId(`${DEFAULT_DRAFT_PREFIX}-${match[1]}`);
}

/**
 * Compares two draft IDs for equality.
 */
function draftIdsEqual(left: string, right: string): boolean {
	const leftBody = extractDraftBody(left);
	const rightBody = extractDraftBody(right);

	if (leftBody && rightBody) {
		const leftSegs = leftBody.split(".").map((seg) => Number.parseInt(seg, 10));
		const rightSegs = rightBody.split(".").map((seg) => Number.parseInt(seg, 10));
		if (leftSegs.length !== rightSegs.length) {
			return false;
		}
		return leftSegs.every((value, index) => value === rightSegs[index]);
	}

	return normalizeDraftId(left).toLowerCase() === normalizeDraftId(right).toLowerCase();
}

/**
 * Extracts the body from a draft ID.
 */
function extractDraftBody(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed === "") return "";
	const prefixPattern = new RegExp(`^(?:${escapeRegex(DEFAULT_DRAFT_PREFIX)}-)?([0-9]+(?:\\.[0-9]+)*)$`, "i");
	const match = trimmed.match(prefixPattern);
	return match?.[1] ?? null;
}

/**
 * Get the file path for a draft by ID
 */
export async function getDraftPath(draftId: string, core: Core): Promise<string | null> {
	try {
		const draftsDir = await core.filesystem.getDraftsDir();
		const files = await Array.fromAsync(new Bun.Glob(buildGlobPattern("draft")).scan({ cwd: draftsDir }));
		const normalizedId = normalizeDraftId(draftId);
		// Use lowercase ID for filename matching (filenames use lowercase prefix)
		const filenameId = idForFilename(normalizedId);
		// First exact match
		let draftFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));
		// Fallback to loose numeric match ignoring leading zeros
		if (!draftFile) {
			draftFile = files.find((f) => draftIdsMatchLoosely(draftId, f));
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

	// Extract prefix from the taskId, or use default
	const prefix = extractAnyPrefix(taskId) ?? DEFAULT_TASK_PREFIX;
	const globPattern = buildGlobPattern(prefix);

	try {
		const files = await Array.fromAsync(new Bun.Glob(globPattern).scan({ cwd: coreInstance.filesystem.tasksDir }));
		const normalizedId = normalizeTaskId(taskId, prefix);
		// Use lowercase ID for filename matching (filenames use lowercase prefix)
		const filenameId = idForFilename(normalizedId);
		// First exact match
		let taskFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));
		if (!taskFile) {
			taskFile = files.find((f) => idsMatchLoosely(taskId, f, prefix));
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
