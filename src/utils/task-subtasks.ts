import type { Task } from "../types/index.ts";
import { taskIdsEqual } from "./task-path.ts";
import { sortByTaskId } from "./task-sorting.ts";

export function attachSubtaskSummaries(task: Task, tasks: Task[]): Task {
	let parentTitle: string | undefined;
	if (task.parentTaskId) {
		const parent = tasks.find((candidate) => taskIdsEqual(task.parentTaskId ?? "", candidate.id));
		if (parent) {
			parentTitle = parent.title;
		}
	}

	const summaries: Array<{ id: string; title: string }> = [];
	for (const candidate of tasks) {
		if (!candidate.parentTaskId) continue;
		if (!taskIdsEqual(candidate.parentTaskId, task.id)) continue;
		summaries.push({ id: candidate.id, title: candidate.title });
	}

	if (summaries.length === 0) {
		if (parentTitle && parentTitle !== task.parentTaskTitle) {
			return {
				...task,
				parentTaskTitle: parentTitle,
			};
		}
		return task;
	}

	const sortedSummaries = sortByTaskId(summaries);
	return {
		...task,
		...(parentTitle && parentTitle !== task.parentTaskTitle ? { parentTaskTitle: parentTitle } : {}),
		subtasks: sortedSummaries.map((summary) => summary.id),
		subtaskSummaries: sortedSummaries,
	};
}
