import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { canonicalTaskId } from "./task-id.ts";
import { isTerminalStatus } from "./terminal-status.ts";

export interface TaskReadiness {
	/** Work can start now: the task is unfinished and every dependency is resolved and completed. */
	isReady: boolean;
	/** Work cannot start: at least one dependency is unfinished or unresolved. */
	isBlocked: boolean;
	/** Dependencies that resolved to a task that has not reached the terminal status. */
	blockingDependencies: string[];
	/** Dependency IDs that could not be resolved in the provided task graph. */
	missingDependencies: string[];
}

/**
 * Derive readiness for a single task from its dependencies at read time.
 *
 * Readiness never reorders or mutates anything: it answers "can this task be started now?"
 * by resolving each dependency against the task graph the caller supplies. Dependency IDs
 * that cannot be resolved are reported separately from unfinished ones and fail closed, so a
 * partial graph is never mistaken for satisfied work.
 *
 * When `allTasks` holds more than one entry for the same task identity, the first one wins, so
 * callers can append a fallback corpus (for example completed tasks) after the live one.
 */
export function getTaskReadiness(task: Task, allTasks: Task[], statuses: readonly string[]): TaskReadiness {
	// A task that already reached the terminal status is neither ready to start nor blocked.
	if (isTerminalStatus(task.status, statuses)) {
		return { isReady: false, isBlocked: false, blockingDependencies: [], missingDependencies: [] };
	}

	const dependencies = task.dependencies ?? [];
	if (dependencies.length === 0) {
		return { isReady: true, isBlocked: false, blockingDependencies: [], missingDependencies: [] };
	}

	// Key by the project's canonical task identity so zero-padded and prefixed variants
	// resolve the same way they do everywhere else in the product.
	const tasksById = new Map<string, Task>();
	for (const candidate of allTasks) {
		const key = canonicalTaskId(candidate.id);
		if (!tasksById.has(key)) tasksById.set(key, candidate);
	}

	const blockingDependencies: string[] = [];
	const missingDependencies: string[] = [];

	for (const dependencyId of dependencies) {
		const dependency = tasksById.get(canonicalTaskId(dependencyId));
		if (!dependency) {
			missingDependencies.push(dependencyId);
		} else if (!isTerminalStatus(dependency.status, statuses)) {
			blockingDependencies.push(dependency.id);
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

/**
 * Load the task graph readiness resolves against: the unfiltered task corpus plus completed
 * tasks, so a dependency that was completed and moved out of the active corpus still resolves.
 *
 * Readiness must never be evaluated against a filtered list: `--status "To Do" --ready` would
 * otherwise see none of the completed dependencies it needs to answer the question.
 */
export async function loadReadinessGraph(core: Core): Promise<Task[]> {
	const [tasks, completedTasks] = await Promise.all([
		core.queryTasks({ includeCrossBranch: false }),
		core.filesystem.listCompletedTasks(),
	]);
	return [...tasks, ...completedTasks];
}
