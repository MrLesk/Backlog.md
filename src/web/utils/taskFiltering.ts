import type { Task } from "../../types";
import type { TaskFilters } from "../hooks/useTaskFilters";

/**
 * Filter tasks based on the provided filters
 * Combines all filters with AND semantics
 */
export const filterTasks = (tasks: Task[], filters: TaskFilters): Task[] => {
	return tasks.filter((task) => {
		// Status filter
		if (filters.status && task.status.toLowerCase() !== filters.status.toLowerCase()) {
			return false;
		}

		// Priority filter
		if (filters.priority && task.priority?.toLowerCase() !== filters.priority.toLowerCase()) {
			return false;
		}

		// Assignee filter
		if (filters.assignee) {
			const assigneeMatch = task.assignee.some((assignee) =>
				assignee.toLowerCase().includes(filters.assignee?.toLowerCase() || ""),
			);
			if (!assigneeMatch) {
				return false;
			}
		}

		// Text search filter (searches both title and description)
		if (filters.search) {
			const searchTerm = filters.search.toLowerCase();
			const titleMatch = task.title.toLowerCase().includes(searchTerm);
			const descriptionMatch = task.description?.toLowerCase().includes(searchTerm) || false;

			if (!titleMatch && !descriptionMatch) {
				return false;
			}
		}

		return true;
	});
};

/**
 * Get unique assignees from a list of tasks
 */
export const getUniqueAssignees = (tasks: Task[]): string[] => {
	const assignees = new Set<string>();

	tasks.forEach((task) => {
		task.assignee.forEach((assignee) => {
			assignees.add(assignee);
		});
	});

	return Array.from(assignees).sort();
};

/**
 * Get task counts by filter criteria
 */
export const getFilteredTaskCounts = (tasks: Task[], filters: TaskFilters) => {
	const filteredTasks = filterTasks(tasks, filters);

	return {
		total: filteredTasks.length,
		byStatus: filteredTasks.reduce(
			(counts, task) => {
				counts[task.status] = (counts[task.status] || 0) + 1;
				return counts;
			},
			{} as Record<string, number>,
		),
		byPriority: filteredTasks.reduce(
			(counts, task) => {
				const priority = task.priority || "unset";
				counts[priority] = (counts[priority] || 0) + 1;
				return counts;
			},
			{} as Record<string, number>,
		),
	};
};
