import { DEFAULT_STATUSES } from "../constants/index.ts";
import type { Task } from "../types/index.ts";
import { canonicalTaskId } from "./task-id.ts";
import { isTerminalStatus } from "./terminal-status.ts";

/** A record found in the corpus a read is allowed to see. */
export interface TaskRecord {
	task: Task;
	/** The record lives in the archive, off the board. */
	archived: boolean;
}

/** `undefined` when no record claims the identity, `"ambiguous"` when more than one does. */
export type TaskRecordLookup = TaskRecord | "ambiguous" | undefined;

/**
 * A canonical-identity index over one visible task corpus.
 *
 * Readiness and the dependency graph both answer questions about the same corpus, so they resolve
 * identity here rather than each keeping its own rule: one canonical key per record, an identity
 * claimed by more than one record is ambiguous instead of won by insertion order, and a record is
 * finished when it holds the final status, on the board and in the archive alike.
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
 * `archivedTasks` are records that live in the archive. They claim their IDs like any task on the
 * board. Being archived says nothing about whether the work was finished: canceled and duplicate
 * work is archived too, so only the status answers that.
 */
export function createTaskRecordIndex(options: {
	tasks: Task[];
	archivedTasks?: Task[];
	statuses?: readonly string[];
	ambiguousIds?: ReadonlySet<string>;
}): TaskRecordIndex {
	const statuses = options.statuses?.length ? options.statuses : DEFAULT_STATUSES;
	const records: TaskRecord[] = [];
	const byIdentity = new Map<string, TaskRecord | "ambiguous">();
	// A corpus can be handed collisions it cannot show: a loader that resolves each identity to one
	// record leaves a contested ID looking singly claimed here. Seeding those keys keeps the read
	// failing closed on the collision its source saw rather than on the records that reached us.
	for (const id of options.ambiguousIds ?? []) byIdentity.set(canonicalTaskId(id), "ambiguous");

	const add = (task: Task, archived: boolean) => {
		const key = canonicalTaskId(task.id);
		const existing = byIdentity.get(key);

		// One file can arrive twice: `task view <archived-id>` hands the viewer the record to display
		// while the viewer separately loads the archived corpus. That is the same record listed
		// twice, not two records claiming one identity. Two *different* files claiming one identity
		// still poison it, which is the collision worth failing closed on.
		if (
			existing !== undefined &&
			existing !== "ambiguous" &&
			task.filePath &&
			existing.task.filePath === task.filePath
		) {
			if (archived) {
				existing.task = task;
				existing.archived = true;
			}
			return;
		}

		const record: TaskRecord = { task, archived };
		records.push(record);
		byIdentity.set(key, existing === undefined ? record : "ambiguous");
	};
	for (const task of options.tasks) add(task, false);
	for (const task of options.archivedTasks ?? []) add(task, true);

	return {
		records,
		statuses,
		lookup(taskId) {
			return byIdentity.get(canonicalTaskId(taskId));
		},
		isFinished(record) {
			return isTerminalStatus(record.task.status, statuses);
		},
	};
}
