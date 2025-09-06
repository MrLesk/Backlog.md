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

function parseIdSegments(id: string): number[] | null {
	const withoutPrefix = id.startsWith("task-") ? id.slice(5) : id;
	if (!/^[0-9]+(?:\.[0-9]+)*$/.test(withoutPrefix)) return null;
	return withoutPrefix.split(".").map((seg) => Number.parseInt(seg, 10));
}

function extractSegmentsFromFilename(filename: string): number[] | null {
	const m = filename.match(/^task-([0-9]+(?:\.[0-9]+)*)/);
	if (!m || !m[1]) return null;
	const idPart = m[1];
	return idPart.split(".").map((seg) => Number.parseInt(seg, 10));
}

function idsMatchLoosely(inputId: string, filename: string): boolean {
	const inputSegs = parseIdSegments(inputId);
	if (!inputSegs) return false;
	const fileSegs = extractSegmentsFromFilename(filename);
	if (!fileSegs) return false;
	if (inputSegs.length !== fileSegs.length) return false;
	for (let i = 0; i < inputSegs.length; i++) {
		if (inputSegs[i] !== fileSegs[i]) return false;
	}
	return true;
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
