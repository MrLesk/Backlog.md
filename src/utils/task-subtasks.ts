import type { Task } from "../types/index.ts";
import { taskIdsEqual } from "./task-id.ts";
import { sortByTaskId } from "./task-sorting.ts";
import { isTerminalStatus } from "./terminal-status.ts";

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

export interface SubtaskProgress {
	total: number;
	completed: number;
}

export function summarizeSubtaskProgress(
	task: Pick<Task, "id">,
	tasks: readonly Task[],
	statuses: readonly string[],
): SubtaskProgress | null {
	let total = 0;
	let completed = 0;
	for (const candidate of tasks) {
		if (!candidate.parentTaskId) continue;
		if (!taskIdsEqual(candidate.parentTaskId, task.id)) continue;
		total += 1;
		if (isTerminalStatus(candidate.status, statuses)) {
			completed += 1;
		}
	}
	return total === 0 ? null : { total, completed };
}

export function findDirectSubtasks(task: Pick<Task, "id">, tasks: readonly Task[]): Task[] {
	const children = tasks.filter((candidate) => candidate.parentTaskId && taskIdsEqual(candidate.parentTaskId, task.id));
	return sortByTaskId(children);
}

export function findParentTask(task: Pick<Task, "parentTaskId">, tasks: readonly Task[]): Task | null {
	if (!task.parentTaskId) return null;
	const parentId = task.parentTaskId;
	return tasks.find((candidate) => taskIdsEqual(parentId, candidate.id)) ?? null;
}
