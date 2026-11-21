import type { Task } from "../types/index.ts";
import { getPriorityValues, normalizePriorityValue } from "../utils/priority-config.ts";
import { createStatusResolver, isTerminalStatus } from "../utils/terminal-status.ts";
import { parseStoredUtcDate } from "../utils/utc-timestamp.ts";

export interface TaskStatistics {
	statusCounts: Map<string, number>;
	priorityCounts: Map<string, number>;
	noPriorityCount: number;
	totalTasks: number;
	completedTasks: number;
	completionPercentage: number;
	draftCount: number;
	recentActivity: {
		created: Task[];
		updated: Task[];
	};
	projectHealth: {
		averageTaskAge: number;
		staleTasks: Task[];
		blockedTasks: Task[];
	};
}

/**
 * Calculate comprehensive task statistics for the overview
 */
export function getTaskStatistics(
	tasks: Task[],
	drafts: Task[],
	statuses: string[],
	priorityOrder?: readonly string[],
	dependencyTasks: readonly Pick<Task, "id" | "status">[] = tasks,
): TaskStatistics {
	const resolveStatus = createStatusResolver(statuses);
	const statusCounts = new Map<string, number>();
	const priorityCounts = new Map<string, number>();

	// Initialize status counts
	for (const status of statuses) {
		statusCounts.set(status, 0);
	}

	// Initialize priority counts
	for (const priority of getPriorityValues(priorityOrder)) {
		priorityCounts.set(priority, 0);
	}

	let completedTasks = 0;
	let noPriorityCount = 0;
	const now = new Date();
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const recentlyCreated: Task[] = [];
	const recentlyUpdated: Task[] = [];
	const staleTasks: Task[] = [];
	const blockedTasks: Task[] = [];
	let totalAge = 0;
	let taskCount = 0;

	// Count board tasks and archived final-status work. Dependencies still use the full corpus.
	for (const task of tasks) {
		const completed = isTerminalStatus(task.status, statuses);
		if (!task.status || (task.source === "archived" && !completed)) {
			continue;
		}

		// Count by status
		const status = resolveStatus(task.status);
		statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);

		// Count completed tasks
		if (completed) {
			completedTasks++;
		}

		// Count by priority
		const priority = normalizePriorityValue(task.priority);
		if (priority) {
			const priorityCount = priorityCounts.get(priority) || 0;
			priorityCounts.set(priority, priorityCount + 1);
		} else {
			noPriorityCount++;
		}

		// Track recent activity
		if (task.createdDate) {
			const createdDate = parseStoredUtcDate(task.createdDate) ?? new Date(Number.NaN);
			if (createdDate >= oneWeekAgo) {
				recentlyCreated.push(task);
			}

			// Calculate task age
			// For completed tasks, use the time from creation to completion
			// For active tasks, use the time from creation to now
			let ageInDays: number;
			if (completed && task.updatedDate) {
				const updatedDate = parseStoredUtcDate(task.updatedDate) ?? new Date(Number.NaN);
				ageInDays = Math.floor((updatedDate.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
			} else {
				ageInDays = Math.floor((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
			}
			totalAge += ageInDays;
			taskCount++;
		}

		if (task.updatedDate) {
			const updatedDate = parseStoredUtcDate(task.updatedDate) ?? new Date(Number.NaN);
			if (updatedDate >= oneWeekAgo) {
				recentlyUpdated.push(task);
			}
		}

		// Identify unfinished tasks whose last update was over 30 days ago.
		if (!completed) {
			const lastDate = task.updatedDate || task.createdDate;
			if (lastDate) {
				const date = parseStoredUtcDate(lastDate) ?? new Date(Number.NaN);
				if (date < oneMonthAgo) {
					staleTasks.push(task);
				}
			}
		}

		if (!completed && task.dependencies?.length) {
			const hasBlockingDependency = task.dependencies.some((depId) => {
				const dep = dependencyTasks.find((t) => t.id === depId);
				return dep && !isTerminalStatus(dep.status, statuses);
			});

			if (hasBlockingDependency) {
				blockedTasks.push(task);
			}
		}
	}

	// Sort recent activity by date
	recentlyCreated.sort((a, b) => {
		const dateA = parseStoredUtcDate(a.createdDate) ?? new Date(0);
		const dateB = parseStoredUtcDate(b.createdDate) ?? new Date(0);
		return dateB.getTime() - dateA.getTime();
	});

	recentlyUpdated.sort((a, b) => {
		const dateA = parseStoredUtcDate(a.updatedDate) ?? new Date(0);
		const dateB = parseStoredUtcDate(b.updatedDate) ?? new Date(0);
		return dateB.getTime() - dateA.getTime();
	});

	// Calculate average task age
	const averageTaskAge = taskCount > 0 ? Math.round(totalAge / taskCount) : 0;

	// Calculate completion percentage (only count tasks with valid status)
	const totalTasks = Array.from(statusCounts.values()).reduce((sum, count) => sum + count, 0);
	const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

	return {
		statusCounts,
		priorityCounts,
		noPriorityCount,
		totalTasks,
		completedTasks,
		completionPercentage,
		draftCount: drafts.length,
		recentActivity: {
			created: recentlyCreated.slice(0, 5), // Top 5 most recent
			updated: recentlyUpdated.slice(0, 5), // Top 5 most recent
		},
		projectHealth: {
			averageTaskAge,
			staleTasks: staleTasks.slice(0, 5), // Top 5 stale tasks
			blockedTasks: blockedTasks.slice(0, 5), // Top 5 blocked tasks
		},
	};
}
