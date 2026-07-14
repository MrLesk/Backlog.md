import { basename, join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import {
	buildFilenameIdRegex,
	buildGlobPattern,
	escapeRegex,
	extractAnyPrefix,
	getDraftPrefix,
	idForFilename,
	normalizeId,
} from "./prefix-config.ts";
import { canonicalTaskId, normalizeTaskId, numericIdBodiesEqual, taskIdsEqual } from "./task-id.ts";

export { canonicalTaskId, normalizeTaskId, taskIdsEqual } from "./task-id.ts";

// Interface for task path resolution context
interface TaskPathContext {
	filesystem: {
		tasksDir: string;
		completedDir?: string;
	};
}

const TASK_FILENAME_ID_PATTERN = /^([a-zA-Z]+)-([a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*) -/;

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

export class AmbiguousTaskIdError extends Error {
	readonly taskId: string;
	readonly candidates: string[];

	constructor(taskId: string, candidates: string[]) {
		const sortedCandidates = [...candidates].sort((left, right) => left.localeCompare(right));
		super(
			[
				`Task ID ${canonicalTaskId(taskId)} is ambiguous; ${sortedCandidates.length} files match:`,
				...sortedCandidates.map((candidate) => `  - ${candidate}`),
				"Run 'backlog doctor' to preview a safe repair.",
			].join("\n"),
		);
		this.name = "AmbiguousTaskIdError";
		this.taskId = taskId;
		this.candidates = sortedCandidates;
	}
}

export function isAmbiguousTaskIdError(error: unknown): error is AmbiguousTaskIdError {
	return error instanceof AmbiguousTaskIdError;
}

/**
 * Extracts the task ID from a filename.
 *
 * @param filename - The filename to extract from (e.g., "task-123 - Some Title.md")
 * @returns The normalized task ID, or null if not found
 *
 * @example
 * extractTaskIdFromFilename("task-123 - Title.md") // => "task-123"
 * extractTaskIdFromFilename("JIRA-456 - Title.md") // => "JIRA-456"
 */
export function extractTaskIdFromFilename(filename: string): string | null {
	const match = filename.match(TASK_FILENAME_ID_PATTERN);
	const prefix = match?.[1];
	const body = match?.[2];
	if (!prefix || !body) return null;
	return normalizeTaskId(`${prefix}-${body}`, prefix);
}

/**
 * Get the file path for a task by ID.
 * For numeric-only IDs, automatically detects the prefix from existing files.
 */
export async function getTaskPath(taskId: string, core?: Core | TaskPathContext): Promise<string | null> {
	const coreInstance = core || new Core(process.cwd());
	const activeMatches = await findMatchingTaskPaths(coreInstance.filesystem.tasksDir, taskId);
	const completedMatches = coreInstance.filesystem.completedDir
		? await findMatchingTaskPaths(coreInstance.filesystem.completedDir, taskId)
		: [];
	const allMatches = [...activeMatches, ...completedMatches];
	if (allMatches.length > 1) {
		throw new AmbiguousTaskIdError(taskId, allMatches);
	}
	return activeMatches[0] ?? null;
}

async function findMatchingTaskPaths(directory: string, taskId: string): Promise<string[]> {
	const detectedPrefix = extractAnyPrefix(taskId);
	try {
		const files = await Array.fromAsync(
			new Bun.Glob(detectedPrefix ? buildGlobPattern(detectedPrefix) : "*.md").scan({
				cwd: directory,
				followSymlinks: true,
			}),
		);
		return files
			.filter((file) => {
				const fileTaskId = extractTaskIdFromFilename(file);
				if (!fileTaskId) return false;
				const filePrefix = extractAnyPrefix(fileTaskId);
				if (detectedPrefix && filePrefix?.toLowerCase() !== detectedPrefix.toLowerCase()) return false;
				return taskIdsEqual(taskId, fileTaskId);
			})
			.map((file) => join(directory, file))
			.sort((left, right) => left.localeCompare(right));
	} catch {
		return [];
	}
}
/**
 * Normalize a draft ID by ensuring the draft prefix is present (uppercase).
 * Drafts share the task ID space, so the prefix is the configured task prefix.
 */
function normalizeDraftId(draftId: string, prefix: string): string {
	return normalizeId(draftId, prefix);
}

/**
 * Checks if an input ID matches a filename loosely for drafts.
 */
function draftIdsMatchLoosely(inputId: string, filename: string, prefix: string): boolean {
	const candidate = extractDraftIdFromFilename(filename, prefix);
	if (!candidate) return false;
	return draftIdsEqual(inputId, candidate, prefix);
}

/**
 * Extracts the draft ID from a filename.
 */
function extractDraftIdFromFilename(filename: string, prefix: string): string | null {
	const regex = buildFilenameIdRegex(prefix);
	const match = filename.match(regex);
	if (!match?.[1]) return null;
	return normalizeDraftId(`${prefix}-${match[1]}`, prefix);
}

/**
 * Compares two draft IDs for equality.
 */
function draftIdsEqual(left: string, right: string, prefix: string): boolean {
	const leftBody = extractDraftBody(left, prefix);
	const rightBody = extractDraftBody(right, prefix);

	if (leftBody && rightBody) {
		return numericIdBodiesEqual(leftBody, rightBody);
	}

	return normalizeDraftId(left, prefix).toLowerCase() === normalizeDraftId(right, prefix).toLowerCase();
}

/**
 * Extracts the body from a draft ID.
 */
function extractDraftBody(value: string, prefix: string): string | null {
	const trimmed = value.trim();
	if (trimmed === "") return "";
	const prefixPattern = new RegExp(`^(?:${escapeRegex(prefix)}-)?([0-9]+(?:\\.[0-9]+)*)$`, "i");
	const match = trimmed.match(prefixPattern);
	return match?.[1] ?? null;
}

/**
 * Get the file path for a draft by ID
 */
export async function getDraftPath(draftId: string, core: Core): Promise<string | null> {
	try {
		const draftsDir = await core.filesystem.getDraftsDir();
		const draftPrefix = getDraftPrefix((await core.filesystem.loadConfig()) ?? undefined);
		const files = await Array.fromAsync(
			new Bun.Glob(buildGlobPattern(draftPrefix.toLowerCase())).scan({ cwd: draftsDir, followSymlinks: true }),
		);
		const normalizedId = normalizeDraftId(draftId, draftPrefix);
		// Use lowercase ID for filename matching (filenames use lowercase prefix)
		const filenameId = idForFilename(normalizedId);
		// First exact match
		let draftFile = files.find((f) => f.startsWith(`${filenameId} -`) || f.startsWith(`${filenameId}-`));
		// Fallback to loose numeric match ignoring leading zeros
		if (!draftFile) {
			draftFile = files.find((f) => draftIdsMatchLoosely(draftId, f, draftPrefix));
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
	const path = await getTaskPath(taskId, core);
	return path ? basename(path) : null;
}

/**
 * Check if a task file exists
 */
export async function taskFileExists(taskId: string, core?: Core | TaskPathContext): Promise<boolean> {
	const path = await getTaskPath(taskId, core);
	return path !== null;
}
