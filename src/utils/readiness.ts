import type { Task } from "../types/index.ts";
import { createTaskRecordIndex } from "./task-record-index.ts";
import { isTerminalStatus } from "./terminal-status.ts";

export interface TaskReadiness {
	/** Work can start now: the task is unfinished and every dependency is resolved and completed. */
	isReady: boolean;
	/** Work cannot start: at least one dependency is unfinished or unresolved. */
	isBlocked: boolean;
	/** Dependencies that resolved to a task that has not been completed. */
	blockingDependencies: string[];
	/** Dependency IDs that could not be resolved to exactly one task in the graph. */
	missingDependencies: string[];
}

type DependencyResolution =
	| { state: "completed" }
	| { state: "unfinished"; id: string }
	/** Not in the graph, or more than one record claims the identity. Never treated as satisfied. */
	| { state: "unresolved" };

/**
 * An index over the task graph readiness resolves dependencies against.
 *
 * Built once per evaluation so filtering a large list stays linear, and it is what makes the
 * two completion signals explicit: a record's location in the completed corpus, and its status.
 */
export interface ReadinessGraph {
	resolveDependency(dependencyId: string): DependencyResolution;
	/** True when this task's own record lives in the completed corpus. */
	isCompletedRecord(taskId: string): boolean;
	/** Configured statuses with the project default applied, so an empty config still resolves. */
	readonly statuses: readonly string[];
}

/**
 * Build the readiness index over the corpus this read is allowed to see.
 *
 * Identity, ambiguity, and completion evidence come from the shared task record index, so readiness
 * and the dependency graph never disagree about which record an ID means. An identity claimed by
 * more than one record resolves as unresolved rather than picking a winner by insertion order.
 */
export function createReadinessGraph(options: {
	tasks: Task[];
	completedTasks?: Task[];
	statuses?: readonly string[];
	ambiguousIds?: ReadonlySet<string>;
}): ReadinessGraph {
	const index = createTaskRecordIndex(options);

	return {
		statuses: index.statuses,
		isCompletedRecord(taskId) {
			const record = index.lookup(taskId);
			return record !== undefined && record !== "ambiguous" && record.completedRecord;
		},
		resolveDependency(dependencyId) {
			const record = index.lookup(dependencyId);
			if (record === undefined || record === "ambiguous") return { state: "unresolved" };
			if (index.isFinished(record)) return { state: "completed" };
			return { state: "unfinished", id: record.task.id };
		},
	};
}

/**
 * Derive readiness for a single task from its dependencies at read time.
 *
 * Readiness never reorders or mutates anything: it answers "can this task be started now?".
 * Dependencies that resolved to unfinished work and dependency IDs that could not be resolved are
 * reported separately, and both fail closed, so a partial or ambiguous graph is never mistaken for
 * satisfied work.
 */
export function getTaskReadiness(task: Task, graph: ReadinessGraph): TaskReadiness {
	const notActionable: TaskReadiness = {
		isReady: false,
		isBlocked: false,
		blockingDependencies: [],
		missingDependencies: [],
	};

	// A task that is already completed is neither ready to start nor blocked.
	if (graph.isCompletedRecord(task.id) || isTerminalStatus(task.status, graph.statuses)) {
		return notActionable;
	}

	const dependencies = task.dependencies ?? [];
	if (dependencies.length === 0) {
		return { isReady: true, isBlocked: false, blockingDependencies: [], missingDependencies: [] };
	}

	const blockingDependencies: string[] = [];
	const missingDependencies: string[] = [];
	for (const dependencyId of dependencies) {
		const resolution = graph.resolveDependency(dependencyId);
		if (resolution.state === "unresolved") {
			missingDependencies.push(dependencyId);
		} else if (resolution.state === "unfinished") {
			blockingDependencies.push(resolution.id);
		}
	}

	const isBlocked = blockingDependencies.length > 0 || missingDependencies.length > 0;
	return { isReady: !isBlocked, isBlocked, blockingDependencies, missingDependencies };
}

/**
 * Explain why a task is not ready, in one line shared by every surface. Unfinished dependencies
 * and dependency IDs that could not be resolved are named separately so they are not confused.
 */
export function formatReadinessBlockers(readiness: TaskReadiness): string {
	const reasons: string[] = [];
	if (readiness.blockingDependencies.length > 0) {
		reasons.push(`Blocked by ${readiness.blockingDependencies.join(", ")}`);
	}
	if (readiness.missingDependencies.length > 0) {
		const noun = readiness.missingDependencies.length === 1 ? "dependency" : "dependencies";
		reasons.push(`Unknown ${noun} ${readiness.missingDependencies.join(", ")}`);
	}
	return reasons.join("; ");
}
