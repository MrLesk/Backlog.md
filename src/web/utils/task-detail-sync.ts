import { type TaskDetail, taskDependencyGraph, taskReadiness } from "../../core/task-detail";
import type { Task } from "../../types";
import { canonicalTaskId } from "../../utils/task-id";

/**
 * Everything the readiness of one task is derived from, as a comparable string: its own status and
 * dependency list, plus every record in the corpus that claims one of those dependency IDs.
 *
 * A dependency completing, being reopened, leaving the corpus, or gaining a second claimant all
 * move the verdict without touching the task's own record, which is why the dependency records are
 * part of this rather than the task alone. It decides when to read the detail again; the verdict
 * itself is still only ever derived in core.
 */
export function readinessInputs(task: Task, corpus: readonly Task[]): string {
	const dependencies = task.dependencies ?? [];
	if (dependencies.length === 0) return task.status;

	const claimantsByIdentity = new Map<string, string[]>();
	for (const candidate of corpus) {
		const key = canonicalTaskId(candidate.id);
		const claim = `${candidate.id}:${candidate.status}`;
		const claimants = claimantsByIdentity.get(key);
		if (claimants) claimants.push(claim);
		else claimantsByIdentity.set(key, [claim]);
	}

	const claims = dependencies.map((dependency) => {
		const claimants = claimantsByIdentity.get(canonicalTaskId(dependency)) ?? [];
		return `${dependency}=${[...claimants].sort().join("|")}`;
	});
	return [task.status, ...claims].join(",");
}

/** What a previous sync of this modal settled on, so the next one knows what it is comparing to. */
export interface SyncedTaskRecord {
	/** The list record that was folded in. Refreshes preserve identity for unchanged records. */
	record: Task;
	/** The readiness inputs that record was read against. */
	inputs: string;
}

export interface OpenTaskDetailSync {
	/** The record the modal should show now. */
	task: Task | TaskDetail;
	/** Nothing moved: the caller can leave the modal exactly as it is. */
	changed: boolean;
	/** The verdict no longer describes the corpus, so the detail has to be read again. */
	rereadDetail: boolean;
	/** Record this with the applied record, as the baseline for the next sync. */
	readinessInputs: string;
}

/**
 * Fold a refreshed list record into the task detail a modal currently shows.
 *
 * The list carries stored records; the detail read carries the fields derived from the whole
 * corpus. Refreshing from the list must not drop them, or the dependency graph would disappear the
 * first time anything is saved, so the graph is kept in place while a fresh one is read. Readiness
 * is a verdict rather than a picture, so it is dropped instead of shown once the records it answers
 * about have moved, and the caller reads the detail again.
 *
 * A refresh that changes a dependency leaves this task's own record untouched, and the list
 * reconcile hands back the very same object for it. That is why the corpus decides here and record
 * identity alone does not: the modal on a blocked task has to notice its blocker completing.
 */
export function syncOpenTaskDetail(options: {
	/** The record the modal currently shows, carrying whatever the last detail read derived. */
	open: Task | TaskDetail;
	/** The same task as the refreshed list holds it. */
	refreshed: Task;
	/** The refreshed corpus, which is where the dependency records come from. */
	corpus: readonly Task[];
	/** What the previous sync applied, or null when this modal has not synced yet. */
	previous: SyncedTaskRecord | null;
}): OpenTaskDetailSync {
	const { open, refreshed, corpus, previous } = options;
	const inputs = readinessInputs(refreshed, corpus);
	// A previous sync only speaks for the task it synced: after graph-link navigation it names the
	// task the modal came from, and its fingerprint says nothing about this one.
	const previousInputs = previous && previous.record.id === refreshed.id ? previous.inputs : null;
	// Without a recorded fingerprint the open record is the only baseline there is, which still
	// catches an inline edit to this task's own status or dependencies.
	const rereadDetail = (previousInputs ?? readinessInputs(open, corpus)) !== inputs;

	const dependencyGraph = taskDependencyGraph(open);
	const readiness = rereadDetail ? undefined : taskReadiness(open);
	return {
		task: {
			...refreshed,
			...(dependencyGraph ? { dependencyGraph } : {}),
			...(readiness ? { readiness } : {}),
		},
		changed: previous === null || previous.record !== refreshed || rereadDetail,
		rereadDetail,
		readinessInputs: inputs,
	};
}
