import type { Task } from "../types/index.ts";
import { isTerminalStatus } from "./terminal-status.ts";

export interface TaskReadiness {
	isReady: boolean;
	isBlocked: boolean;
	blockingDependencies: string[];
	missingDependencies: string[];
}

export function getTaskReadiness(task: Task, allTasks: Task[], statuses: readonly string[]): TaskReadiness {
	// If task itself is already terminal/done, it is not "ready for work"
	if (isTerminalStatus(task.status, statuses)) {
		return {
			isReady: false,
			isBlocked: false,
			blockingDependencies: [],
			missingDependencies: [],
		};
	}

	const dependencies = task.dependencies ?? [];
	if (dependencies.length === 0) {
		return {
			isReady: true,
			isBlocked: false,
			blockingDependencies: [],
			missingDependencies: [],
		};
	}

	const taskMap = new Map<string, Task>();
	for (const t of allTasks) {
		taskMap.set(t.id.toLowerCase(), t);
	}

	const blockingDependencies: string[] = [];
	const missingDependencies: string[] = [];

	for (const depId of dependencies) {
		const targetTask = taskMap.get(depId.toLowerCase());
		if (!targetTask) {
			missingDependencies.push(depId);
			blockingDependencies.push(depId);
		} else if (!isTerminalStatus(targetTask.status, statuses)) {
			blockingDependencies.push(targetTask.id);
		}
	}

	const isBlocked = blockingDependencies.length > 0;
	return {
		isReady: !isBlocked,
		isBlocked,
		blockingDependencies,
		missingDependencies,
	};
}
