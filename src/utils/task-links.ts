import type { Task } from "../types/index.ts";
import { extractAnyPrefix } from "./prefix-config.ts";
import { stringArraysEqual } from "./task-builders.ts";
import { normalizeTaskId, taskIdsEqual } from "./task-id.ts";

/**
 * True when the reference names exactly this task rather than merely containing its ID: a URL or a
 * file path that mentions TASK-1 is not a reference to TASK-1.
 */
export function isExactTaskReference(reference: string, taskId: string): boolean {
	const trimmed = reference.trim();
	if (!trimmed) {
		return false;
	}
	const taskPrefix = extractAnyPrefix(taskId);
	const referencePrefix = extractAnyPrefix(trimmed);
	if (!taskPrefix || !referencePrefix) {
		return false;
	}
	if (taskPrefix.toLowerCase() !== referencePrefix.toLowerCase()) {
		return false;
	}
	return normalizeTaskId(trimmed, taskPrefix).toLowerCase() === normalizeTaskId(taskId, taskPrefix).toLowerCase();
}

/**
 * The task with every dependency and reference naming `vacatedTaskId` removed, or `null` when it
 * named the ID nowhere.
 *
 * Archiving and demoting hand the ID back to the allocator, so a reference kept anywhere - on
 * another task, or on the demoted record itself, which keeps its old links under a new identity -
 * rebinds to whatever task is created next.
 */
export function withoutVacatedTaskLinks(task: Task, vacatedTaskId: string): Task | null {
	const dependencies = task.dependencies ?? [];
	const references = task.references ?? [];

	const sanitizedDependencies = dependencies.filter((dependency) => !taskIdsEqual(dependency, vacatedTaskId));
	const sanitizedReferences = references.filter((reference) => !isExactTaskReference(reference, vacatedTaskId));

	if (stringArraysEqual(dependencies, sanitizedDependencies) && stringArraysEqual(references, sanitizedReferences)) {
		return null;
	}

	return { ...task, dependencies: sanitizedDependencies, references: sanitizedReferences };
}
