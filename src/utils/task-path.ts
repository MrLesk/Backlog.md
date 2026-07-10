import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import {
	buildFilenameIdRegex,
	buildGlobPattern,
	escapeRegex,
	extractAnyPrefix,
	idForFilename,
	normalizeId,
} from "./prefix-config.ts";
import { isNumericTaskId, normalizeTaskId, numericIdBodiesEqual, taskIdsEqual } from "./task-id.ts";

export { normalizeTaskId, taskIdsEqual } from "./task-id.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
	};
}

const DEFAULT_TASK_PREFIX = "task";

export function normalizeTaskIdentity(task: Task): Task {
	const normalizedId = normalizeTaskId(task.id);
	const normalizedParent = task.parentTaskId ? normalizeTaskId(task.parentTaskId) : undefined;

	if (normalizedId === task.id && normalizedParent === task.parentTaskId) {
		return task;
	}

	return {
		...task,
		id: normalizedId,
		parentTaskId: normalizedParent,
	};
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
	if (!match?.[1]) return null;
	return normalizeTaskId(`${prefix}-${match[1]}`, prefix);
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
 * Get the file path for a task by ID.
 * For numeric-only IDs, automatically detects the prefix from existing files.
 */
export async function getTaskPath(taskId: string, core?: Core | TaskPathContext): Promise<string | null> {
	const coreInstance = core || new Core(process.cwd());

	// Extract prefix from the taskId
	const detectedPrefix = extractAnyPrefix(taskId);

	// If prefix is detected, search only for that prefix
	if (detectedPrefix) {
		const globPattern = buildGlobPattern(detectedPrefix);
		try {
			const files = await Array.fromAsync(
				new Bun.Glob(globPattern).scan({ cwd: coreInstance.filesystem.tasksDir, followSymlinks: true }),
			);
			const taskFile = findMatchingFile(files, taskId, detectedPrefix);
			if (taskFile) {
				return join(coreInstance.filesystem.tasksDir, taskFile);
			}
		} catch {
			// Fall through to return null
		}
		return null;
	}

	// For numeric-only IDs, scan all .md files and find one matching the number
	try {
		const allFiles = await Array.fromAsync(
			new Bun.Glob("*.md").scan({ cwd: coreInstance.filesystem.tasksDir, followSymlinks: true }),
		);

		const taskFile = findMatchingNumericTaskFile(allFiles, taskId.trim());
		return taskFile ? join(coreInstance.filesystem.tasksDir, taskFile) : null;
	} catch {
		return null;
	}
}

/**
 * Helper to find a matching file from a list of files
 */
function findMatchingFile(files: string[], taskId: string, prefix: string): string | undefined {
	if (!isNumericTaskId(taskId)) {
		const filenameId = idForFilename(normalizeTaskId(taskId, prefix));
		const exactMatches = files.filter((file) => file.startsWith(`${filenameId} -`));
		return exactMatches.length === 1 ? exactMatches[0] : undefined;
	}

	const matches = files.filter((file) => idsMatchLoosely(taskId, file, prefix));
	return matches.length === 1 ? matches[0] : undefined;
}

function findMatchingNumericTaskFile(files: string[], numericPart: string): string | undefined {
	const matches = files.filter((file) => {
		const filePrefix = extractAnyPrefix(file);
		if (!filePrefix) return false;
		const fileBody = extractTaskBodyFromFilename(file, filePrefix);
		return fileBody ? numericIdBodiesEqual(numericPart, fileBody) : false;
	});
	return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Extract the numeric body from a filename given a prefix
 */
function extractTaskBodyFromFilename(filename: string, prefix: string): string | null {
	// Pattern: <prefix>-<number> - <title>.md or <prefix>-<number>.<subtask> - <title>.md
	const regex = new RegExp(`^${escapeRegex(prefix)}-(\\d+(?:\\.\\d+)*)\\s*-`, "i");
	const match = filename.match(regex);
	return match?.[1] ?? null;
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
	if (!match?.[1]) return null;
	return normalizeDraftId(`${DEFAULT_DRAFT_PREFIX}-${match[1]}`);
}

/**
 * Compares two draft IDs for equality.
 */
function draftIdsEqual(left: string, right: string): boolean {
	const leftBody = extractDraftBody(left);
	const rightBody = extractDraftBody(right);

	if (leftBody && rightBody) {
		return numericIdBodiesEqual(leftBody, rightBody);
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
		const files = await Array.fromAsync(
			new Bun.Glob(buildGlobPattern("draft")).scan({ cwd: draftsDir, followSymlinks: true }),
		);
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
 * Get the filename (without directory) for a task by ID.
 * For numeric-only IDs, automatically detects the prefix from existing files.
 */
export async function getTaskFilename(taskId: string, core?: Core | TaskPathContext): Promise<string | null> {
	const coreInstance = core || new Core(process.cwd());

	// Extract prefix from the taskId
	const detectedPrefix = extractAnyPrefix(taskId);

	// If prefix is detected, search only for that prefix
	if (detectedPrefix) {
		const globPattern = buildGlobPattern(detectedPrefix);
		try {
			const files = await Array.fromAsync(
				new Bun.Glob(globPattern).scan({ cwd: coreInstance.filesystem.tasksDir, followSymlinks: true }),
			);
			return findMatchingFile(files, taskId, detectedPrefix) ?? null;
		} catch {
			return null;
		}
	}

	// For numeric-only IDs, scan all .md files and find one matching the number
	try {
		const allFiles = await Array.fromAsync(
			new Bun.Glob("*.md").scan({ cwd: coreInstance.filesystem.tasksDir, followSymlinks: true }),
		);

		return findMatchingNumericTaskFile(allFiles, taskId.trim()) ?? null;
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
