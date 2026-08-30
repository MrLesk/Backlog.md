import { DEFAULT_STATUSES } from "../constants/index.ts";
import type { Task } from "../types/index.ts";
import { canonicalTaskId } from "./task-id.ts";
import { isTerminalStatus } from "./terminal-status.ts";

/** A record found in the corpus a read is allowed to see, with the evidence that it is finished. */
export interface TaskRecord {
	task: Task;
	/** The record lives in the completed corpus, which is completion evidence on its own. */
	completedRecord: boolean;
}

/** `undefined` when no record claims the identity, `"ambiguous"` when more than one does. */
export type TaskRecordLookup = TaskRecord | "ambiguous" | undefined;

/**
 * A canonical-identity index over one visible task corpus.
 *
 * Readiness and the dependency graph both answer questions about the same corpus, so they resolve
 * identity here rather than each keeping its own rule: one canonical key per record, an identity
 * claimed by more than one record is ambiguous instead of won by insertion order, and completion
 * keeps its two independent signals of corpus location and terminal status.
 */
export interface TaskRecordIndex {
	lookup(taskId: string): TaskRecordLookup;
	/** Every record in the corpus, in the order it was supplied. */
	readonly records: readonly TaskRecord[];
	isFinished(record: TaskRecord): boolean;
	/** Configured statuses with the project default applied, so an empty config still resolves. */
	readonly statuses: readonly string[];
}

/**
 * Build the index.
 *
 * `completedTasks` are records that live in the completed corpus (`backlog/completed`). Their
 * location is the completion evidence, so they count as finished whatever their status string says:
 * the terminal status may have been renamed since, or the record may predate the current
 * configuration. Passing them separately is what keeps that distinction available.
 */
export function createTaskRecordIndex(options: {
	tasks: Task[];
	completedTasks?: Task[];
	statuses?: readonly string[];
}): TaskRecordIndex {
	const statuses = options.statuses?.length ? options.statuses : DEFAULT_STATUSES;
	const records: TaskRecord[] = [];
	const byIdentity = new Map<string, TaskRecord | "ambiguous">();

	const add = (task: Task, completedRecord: boolean) => {
		const key = canonicalTaskId(task.id);
		const existing = byIdentity.get(key);

		// One file can arrive twice: `task view <completed-id>` hands the viewer the record to display
		// while the viewer separately loads the completed corpus. That is the same record listed
		// twice, not two records claiming one identity, and poisoning it would throw away the
		// completion evidence the corpus location carries. Two *different* files claiming one
		// identity still poison it, which is the collision worth failing closed on.
		if (
			existing !== undefined &&
			existing !== "ambiguous" &&
			task.filePath &&
			existing.task.filePath === task.filePath
		) {
			if (completedRecord) {
				existing.task = task;
				existing.completedRecord = true;
			}
			return;
		}

		const record: TaskRecord = { task, completedRecord };
		records.push(record);
		byIdentity.set(key, existing === undefined ? record : "ambiguous");
	};
	for (const task of options.tasks) add(task, false);
	for (const task of options.completedTasks ?? []) add(task, true);

	return {
		records,
		statuses,
		lookup(taskId) {
			return byIdentity.get(canonicalTaskId(taskId));
		},
		isFinished(record) {
			return record.completedRecord || isTerminalStatus(record.task.status, statuses);
		},
	};
}
