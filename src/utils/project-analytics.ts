import type { Task } from "../types/index.ts";
import type {
	AnalysisTimeframe,
	DependencyMetrics,
	Duration,
	Percentage,
	ProjectOverview,
	ProjectTrends,
	QualityMetrics,
	TaskCount,
	TeamMetrics,
	TrendData,
	VelocityMetrics,
} from "../types/project-overview.ts";

/**
 * Utility functions for project analytics and metrics calculation
 */

// Helper function to create branded types
export const createPercentage = (value: number): Percentage => {
	const clamped = Math.max(0, Math.min(100, Math.round(value)));
	return clamped as Percentage;
};

export const createTaskCount = (value: number): TaskCount => {
	return Math.max(0, Math.floor(value)) as TaskCount;
};

export const createDuration = (value: number): Duration => {
	return Math.max(0, Math.round(value)) as Duration;
};

// Date utility functions
export function getDateRange(timeframe: AnalysisTimeframe): { start: Date; end: Date } {
	const now = new Date();
	const end = new Date(now);

	switch (timeframe.type) {
		case "days": {
			const start = new Date(now);
			start.setDate(start.getDate() - timeframe.value);
			return { start, end };
		}
		case "weeks": {
			const start = new Date(now);
			start.setDate(start.getDate() - timeframe.value * 7);
			return { start, end };
		}
		case "months": {
			const start = new Date(now);
			start.setMonth(start.getMonth() - timeframe.value);
			return { start, end };
		}
		case "preset": {
			switch (timeframe.value) {
				case "last7days": {
					const start = new Date(now);
					start.setDate(start.getDate() - 7);
					return { start, end };
				}
				case "last30days": {
					const start = new Date(now);
					start.setDate(start.getDate() - 30);
					return { start, end };
				}
				case "last90days": {
					const start = new Date(now);
					start.setDate(start.getDate() - 90);
					return { start, end };
				}
				case "thisMonth": {
					const start = new Date(now.getFullYear(), now.getMonth(), 1);
					return { start, end };
				}
				case "thisQuarter": {
					const quarterStart = Math.floor(now.getMonth() / 3) * 3;
					const start = new Date(now.getFullYear(), quarterStart, 1);
					return { start, end };
				}
			}
			break;
		}
		case "custom": {
			return { start: timeframe.start, end: timeframe.end };
		}
	}
}

export function formatTimeframeDescription(timeframe: AnalysisTimeframe): string {
	switch (timeframe.type) {
		case "days":
			return `Last ${timeframe.value} days`;
		case "weeks":
			return `Last ${timeframe.value} weeks`;
		case "months":
			return `Last ${timeframe.value} months`;
		case "preset":
			return {
				last7days: "Last 7 days",
				last30days: "Last 30 days",
				last90days: "Last 90 days",
				thisMonth: "This month",
				thisQuarter: "This quarter",
			}[timeframe.value];
		case "custom":
			return `${timeframe.start.toISOString().split("T")[0]} to ${timeframe.end.toISOString().split("T")[0]}`;
	}
}

// Task filtering functions
export function filterTasksByTimeframe(tasks: readonly Task[], timeframe: AnalysisTimeframe): Task[] {
	const { start, end } = getDateRange(timeframe);
	return tasks.filter((task) => {
		const taskDate = new Date(task.createdDate);
		return taskDate >= start && taskDate <= end;
	});
}

export function filterTasksByStatus(tasks: readonly Task[], statuses: readonly string[]): Task[] {
	return tasks.filter((task) => statuses.includes(task.status?.toLowerCase() || ""));
}

export function filterTasksByAssignee(tasks: readonly Task[], assignees: readonly string[]): Task[] {
	return tasks.filter(
		(task) => task.assignee && Array.isArray(task.assignee) && task.assignee.some((a) => assignees.includes(a)),
	);
}

// Core metrics calculation
export function calculateProjectOverview(tasks: readonly Task[]): ProjectOverview {
	const totalTasks = createTaskCount(tasks.length);
	const completedTasks = createTaskCount(tasks.filter((t) => t.status?.toLowerCase() === "done").length);
	const inProgressTasks = createTaskCount(tasks.filter((t) => t.status?.toLowerCase() === "in progress").length);
	const todoTasks = createTaskCount(tasks.filter((t) => t.status?.toLowerCase() === "to do").length);
	const blockedTasks = createTaskCount(tasks.filter((t) => t.status?.toLowerCase() === "blocked").length);

	const completionRate = totalTasks > 0 ? createPercentage((completedTasks / totalTasks) * 100) : createPercentage(0);

	// Calculate average completion time (simplified - using creation to update date)
	const completedTasksWithDates = tasks.filter(
		(t) => t.status?.toLowerCase() === "done" && t.createdDate && t.updatedDate,
	);

	let averageCompletionTime = 0;
	if (completedTasksWithDates.length > 0) {
		const totalTime = completedTasksWithDates.reduce((sum, task) => {
			const created = new Date(task.createdDate);
			const updated = new Date(task.updatedDate || task.createdDate);
			return sum + (updated.getTime() - created.getTime());
		}, 0);
		averageCompletionTime = totalTime / completedTasksWithDates.length / (1000 * 60 * 60 * 24); // Convert to days
	}

	return {
		totalTasks,
		completedTasks,
		inProgressTasks,
		todoTasks,
		blockedTasks,
		completionRate,
		averageCompletionTime: createDuration(averageCompletionTime),
	};
}

// Quality metrics calculation
export function calculateQualityMetrics(tasks: readonly Task[]): QualityMetrics {
	const totalTasks = tasks.length;
	const tasksWithDescription = createTaskCount(tasks.filter((t) => t.description?.trim()).length);
	const tasksWithAcceptanceCriteria = createTaskCount(
		tasks.filter((t) => t.acceptanceCriteriaItems && t.acceptanceCriteriaItems.length > 0).length,
	);
	const tasksWithImplementationNotes = createTaskCount(tasks.filter((t) => t.implementationNotes?.trim()).length);

	const documentationRate =
		totalTasks > 0 ? createPercentage((tasksWithDescription / totalTasks) * 100) : createPercentage(0);

	const acceptanceCriteriaRate =
		totalTasks > 0 ? createPercentage((tasksWithAcceptanceCriteria / totalTasks) * 100) : createPercentage(0);

	// Calculate average task complexity (based on description length, AC count, etc.)
	const averageTaskComplexity =
		totalTasks > 0
			? tasks.reduce((sum, task) => {
					let complexity = 1; // Base complexity
					if (task.description && task.description.length > 100) complexity += 1;
					if (task.acceptanceCriteriaItems && task.acceptanceCriteriaItems.length > 2) complexity += 1;
					if (task.dependencies && task.dependencies.length > 0) complexity += 1;
					if (task.subtasks && task.subtasks.length > 0) complexity += 1;
					return sum + complexity;
				}, 0) / totalTasks
			: 0;

	return {
		tasksWithDescription,
		tasksWithAcceptanceCriteria,
		tasksWithImplementationNotes,
		documentationRate,
		acceptanceCriteriaRate,
		averageTaskComplexity,
	};
}

// Team metrics calculation
export function calculateTeamMetrics(tasks: readonly Task[]): TeamMetrics {
	// Get all unique assignees
	const allAssignees = new Set<string>();
	for (const task of tasks) {
		if (task.assignee && Array.isArray(task.assignee)) {
			for (const assignee of task.assignee) {
				allAssignees.add(assignee);
			}
		}
	}

	const teamSize = allAssignees.size;

	// Calculate workload distribution
	const workloadDistribution = Array.from(allAssignees).map((assignee) => {
		const assigneeTasks = tasks.filter((t) => t.assignee && Array.isArray(t.assignee) && t.assignee.includes(assignee));
		const completedTasks = createTaskCount(assigneeTasks.filter((t) => t.status?.toLowerCase() === "done").length);
		const taskCount = createTaskCount(assigneeTasks.length);
		const completionRate = taskCount > 0 ? createPercentage((completedTasks / taskCount) * 100) : createPercentage(0);

		return {
			assignee,
			taskCount,
			completedTasks,
			completionRate,
		};
	});

	// Calculate productivity trends (simplified)
	const productivityTrends = Array.from(allAssignees).map((assignee) => {
		const assigneeTasks = tasks.filter((t) => t.assignee && Array.isArray(t.assignee) && t.assignee.includes(assignee));

		// Calculate weekly velocity (tasks completed in last week)
		const oneWeekAgo = new Date();
		oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

		const weeklyVelocity = assigneeTasks.filter((t) => {
			if (t.status?.toLowerCase() !== "done") return false;
			const updateDate = t.updatedDate ? new Date(t.updatedDate) : new Date(t.createdDate);
			return updateDate >= oneWeekAgo;
		}).length;

		// Simple trend calculation (could be enhanced with historical data)
		const trend = weeklyVelocity > 2 ? "improving" : weeklyVelocity > 0 ? "stable" : "declining";

		return {
			assignee,
			weeklyVelocity,
			trend: trend as "improving" | "declining" | "stable",
		};
	});

	const activeContributors = workloadDistribution.filter((w) => w.taskCount > 0).length;

	return {
		teamSize,
		activeContributors,
		workloadDistribution,
		productivityTrends,
	};
}

// Velocity metrics calculation
export function calculateVelocityMetrics(tasks: readonly Task[]): VelocityMetrics {
	const completedTasks = tasks.filter((t) => t.status?.toLowerCase() === "done");

	// Weekly velocity
	const oneWeekAgo = new Date();
	oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

	const weeklyVelocity = completedTasks.filter((t) => {
		const updateDate = t.updatedDate ? new Date(t.updatedDate) : new Date(t.createdDate);
		return updateDate >= oneWeekAgo;
	}).length;

	// Monthly velocity
	const oneMonthAgo = new Date();
	oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

	const monthlyVelocity = completedTasks.filter((t) => {
		const updateDate = t.updatedDate ? new Date(t.updatedDate) : new Date(t.createdDate);
		return updateDate >= oneMonthAgo;
	}).length;

	// Average velocity (tasks per week over project lifetime)
	const projectStart = tasks.reduce((earliest, task) => {
		const taskDate = new Date(task.createdDate);
		return taskDate < earliest ? taskDate : earliest;
	}, new Date());

	const projectWeeks = Math.max(1, Math.ceil((Date.now() - projectStart.getTime()) / (7 * 24 * 60 * 60 * 1000)));
	const averageVelocity = completedTasks.length / projectWeeks;

	// Velocity trend (simplified - compare last 2 weeks)
	const twoWeeksAgo = new Date();
	twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

	const lastWeekVelocity = completedTasks.filter((t) => {
		const updateDate = t.updatedDate ? new Date(t.updatedDate) : new Date(t.createdDate);
		return updateDate >= oneWeekAgo;
	}).length;

	const previousWeekVelocity = completedTasks.filter((t) => {
		const updateDate = t.updatedDate ? new Date(t.updatedDate) : new Date(t.createdDate);
		return updateDate >= twoWeeksAgo && updateDate < oneWeekAgo;
	}).length;

	let velocityTrend: "increasing" | "decreasing" | "stable" = "stable";
	if (lastWeekVelocity > previousWeekVelocity) {
		velocityTrend = "increasing";
	} else if (lastWeekVelocity < previousWeekVelocity) {
		velocityTrend = "decreasing";
	}

	// Predicted completion (very simplified)
	const remainingTasks = tasks.filter((t) => t.status?.toLowerCase() !== "done").length;
	const predictedWeeks = averageVelocity > 0 ? Math.ceil(remainingTasks / averageVelocity) : 0;
	const predictedDate = new Date();
	predictedDate.setDate(predictedDate.getDate() + predictedWeeks * 7);
	const predictedCompletion = predictedDate.toISOString().split("T")[0];

	return {
		weeklyVelocity,
		monthlyVelocity,
		averageVelocity,
		velocityTrend,
		predictedCompletion: predictedCompletion || "",
	};
}

// Dependency metrics calculation
export function calculateDependencyMetrics(tasks: readonly Task[]): DependencyMetrics {
	const tasksWithDependencies = createTaskCount(
		tasks.filter((t) => t.dependencies && t.dependencies.length > 0).length,
	);

	const totalDependencies = tasks.reduce((sum, task) => sum + (task.dependencies?.length || 0), 0);

	const dependencyRate =
		tasks.length > 0 ? createPercentage((tasksWithDependencies / tasks.length) * 100) : createPercentage(0);

	// Find tasks blocked by dependencies (simplified)
	const blockedByDependencies = createTaskCount(
		tasks.filter((t) => {
			if (!t.dependencies || t.dependencies.length === 0) return false;
			// Check if any dependencies are not completed
			const incompleteDeps = t.dependencies.filter((depId) => {
				const depTask = tasks.find((task) => task.id === depId);
				return depTask && depTask.status?.toLowerCase() !== "done";
			});
			return incompleteDeps.length > 0;
		}).length,
	);

	// Calculate critical path (simplified - just list tasks with most dependencies)
	const criticalPath = tasks
		.filter((t) => t.dependencies && t.dependencies.length > 0)
		.sort((a, b) => (b.dependencies?.length || 0) - (a.dependencies?.length || 0))
		.slice(0, 5)
		.map((t) => t.id);

	return {
		tasksWithDependencies,
		totalDependencies,
		dependencyRate,
		criticalPath,
		blockedByDependencies,
	};
}

// Trend calculation helper
export function calculateTrends(tasks: readonly Task[], timeframe: AnalysisTimeframe): ProjectTrends {
	// This is a simplified implementation - in a real system you'd want historical data
	const { start, end } = getDateRange(timeframe);
	const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
	const periods = Math.min(10, Math.max(4, Math.floor(daysDiff / 7))); // 4-10 periods

	const trendData: TrendData[] = [];
	for (let i = 0; i < periods; i++) {
		const periodStart = new Date(start.getTime() + ((i * daysDiff) / periods) * 24 * 60 * 60 * 1000);
		const periodEnd = new Date(start.getTime() + (((i + 1) * daysDiff) / periods) * 24 * 60 * 60 * 1000);

		const periodTasks = tasks.filter((t) => {
			const taskDate = new Date(t.createdDate);
			return taskDate >= periodStart && taskDate < periodEnd;
		});

		trendData.push({
			period: periodStart.toISOString().split("T")[0] || "",
			value: periodTasks.length,
			change: i > 0 ? periodTasks.length - (trendData[i - 1]?.value ?? 0) : 0,
			changeDirection:
				i > 0
					? periodTasks.length > (trendData[i - 1]?.value ?? 0)
						? "up"
						: periodTasks.length < (trendData[i - 1]?.value ?? 0)
							? "down"
							: "stable"
					: "stable",
		});
	}

	return {
		velocity: trendData, // Simplified - using same data for all trends
		qualityMetrics: trendData,
		completionRate: trendData,
		taskCreation: trendData,
	};
}
