import type { Task } from "../types/index.ts";
import { extractAnyPrefix } from "./prefix-config.ts";
import { stringArraysEqual } from "./task-builders.ts";
import { taskIdsEqual } from "./task-id.ts";

/**
 * True when the reference names exactly this task rather than merely containing its ID: a URL or a
 * file path that mentions TASK-1 is not a reference to TASK-1.
 *
 * Both sides must carry a prefix, and the same one, so a bare number or a doc, draft or decision ID
 * never matches a task. Past that guard the comparison is the project's task-ID identity, not the
 * spelling: TASK-01 and TASK-1 are one task everywhere else, so a reference written either way is a
 * reference to the same record.
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
	return taskIdsEqual(trimmed, taskId);
}

/**
 * True when an entry of a task's `documentation` list names the file at `projectPath`, a path
 * written from the project root with forward slashes such as
 * `backlog/docs/guides/doc-3 - API-Guidelines.md`.
 *
 * `documentation` holds free text: paths and URLs, not record IDs. An entry names the file when it
 * is that path, optionally with `./` in front of it or with `#` and a fragment after it. Nothing
 * else counts: not a URL, not an absolute path, and not a bare ID such as `doc-3`.
 */
export function documentationEntryNamesFile(entry: string, projectPath: string): boolean {
	const trimmed = entry.trim();
	const path = trimmed.startsWith("./") ? trimmed.slice(2) : trimmed;
	// A file name may itself contain `#`, so the fragment is whatever follows the whole path.
	return path === projectPath || path.startsWith(`${projectPath}#`);
}

/**
 * One line naming the tasks and drafts whose `documentation` list still names a file that is no
 * longer at that path. Every interface says it in the same words, and says nothing when no record
 * names the file.
 */
export function formatDocumentationReferencesMessage(recordIds: readonly string[]): string | null {
	if (recordIds.length === 0) return null;
	return `Still listed as documentation by: ${recordIds.join(", ")}`;
}

/**
 * The task with every dependency and reference naming `vacatedTaskId` removed, or `null` when it
 * named the ID nowhere.
 *
 * Demoting or deleting a task hands its ID back to the allocator, so a reference kept anywhere -
 * on another task, or on a demoted record itself, which keeps its old links under a new identity -
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
