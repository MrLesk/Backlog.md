import type { Task } from "../types/index.ts";

export interface TaskStatistics {
	statusCounts: Map<string, number>;
	priorityCounts: Map<string, number>;
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
export function getTaskStatistics(tasks: Task[], drafts: Task[], statuses: string[]): TaskStatistics {
	const statusCounts = new Map<string, number>();
	const priorityCounts = new Map<string, number>();

	// Initialize status counts
	for (const status of statuses) {
		statusCounts.set(status, 0);
	}

	// Initialize priority counts
	priorityCounts.set("high", 0);
	priorityCounts.set("medium", 0);
	priorityCounts.set("low", 0);
	priorityCounts.set("none", 0);

	let completedTasks = 0;
	const now = new Date();
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const recentlyCreated: Task[] = [];
	const recentlyUpdated: Task[] = [];
	const staleTasks: Task[] = [];
	const blockedTasks: Task[] = [];
	let totalAge = 0;
	let taskCount = 0;

	// Process each task
	for (const task of tasks) {
		// Skip tasks with empty or undefined status
		if (!task.status || task.status === "") {
			continue;
		}

		// Count by status
		const currentCount = statusCounts.get(task.status) || 0;
		statusCounts.set(task.status, currentCount + 1);

		// Count completed tasks
		if (task.status === "Done") {
			completedTasks++;
		}

		// Count by priority
		const priority = task.priority || "none";
		const priorityCount = priorityCounts.get(priority) || 0;
		priorityCounts.set(priority, priorityCount + 1);

		// Track recent activity
		if (task.createdDate) {
			const createdDate = new Date(task.createdDate);
			if (createdDate >= oneWeekAgo) {
				recentlyCreated.push(task);
			}

			// Calculate task age
			const ageInDays = Math.floor((now.getTime() - createdDate.getTime()) / (24 * 60 * 60 * 1000));
			totalAge += ageInDays;
			taskCount++;
		}

		if (task.updatedDate) {
			const updatedDate = new Date(task.updatedDate);
			if (updatedDate >= oneWeekAgo) {
				recentlyUpdated.push(task);
			}
		}

		// Identify stale tasks (not updated in 30 days and not done)
		if (task.status !== "Done") {
			const lastDate = task.updatedDate || task.createdDate;
			if (lastDate) {
				const date = new Date(lastDate);
				if (date < oneMonthAgo) {
					staleTasks.push(task);
				}
			}
		}

		// Identify blocked tasks (has dependencies that are not done)
		if (task.dependencies && task.dependencies.length > 0 && task.status !== "Done") {
			// Check if any dependency is not done
			const hasBlockingDependency = task.dependencies.some((depId) => {
				const dep = tasks.find((t) => t.id === depId);
				return dep && dep.status !== "Done";
			});

			if (hasBlockingDependency) {
				blockedTasks.push(task);
			}
		}
	}

	// Sort recent activity by date
	recentlyCreated.sort((a, b) => {
		const dateA = new Date(a.createdDate || 0);
		const dateB = new Date(b.createdDate || 0);
		return dateB.getTime() - dateA.getTime();
	});

	recentlyUpdated.sort((a, b) => {
		const dateA = new Date(a.updatedDate || 0);
		const dateB = new Date(b.updatedDate || 0);
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
