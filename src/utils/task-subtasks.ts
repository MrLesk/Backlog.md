import type { Task } from "../types/index.ts";
import { taskIdsEqual } from "./task-path.ts";
import { sortByTaskId } from "./task-sorting.ts";

export function attachSubtaskSummaries(task: Task, tasks: Task[]): Task {
	const summaries: Array<{ id: string; title: string }> = [];
	for (const candidate of tasks) {
		if (!candidate.parentTaskId) continue;
		if (!taskIdsEqual(candidate.parentTaskId, task.id)) continue;
		summaries.push({ id: candidate.id, title: candidate.title });
	}

	if (summaries.length === 0) {
		if (!task.subtasks && !task.subtaskSummaries) {
			return task;
		}
		return {
			...task,
			subtasks: undefined,
			subtaskSummaries: undefined,
		};
	}

	const sortedSummaries = sortByTaskId(summaries);
	return {
		...task,
		subtasks: sortedSummaries.map((summary) => summary.id),
		subtaskSummaries: sortedSummaries,
	};
}
