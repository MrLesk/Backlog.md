import { createHash } from "node:crypto";
import type { Task } from "../types/index.ts";

/** A revision describes the file that was read, including edits outside Backlog's owned fields. */
export function getTaskRevision(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

export class TaskChangedError extends Error {
	constructor(taskId: string) {
		super(`Task ${taskId} has changed. Refresh and discard your edits before saving.`);
		this.name = "TaskChangedError";
	}
}

/** Call after re-reading the record under its task or draft lock, before applying any updates. */
export function assertTaskRevision(task: Task, expectedRevision: string | undefined): void {
	if (expectedRevision !== undefined && task.revision !== expectedRevision) throw new TaskChangedError(task.id);
}
