/**
 * Parents and subtasks. A task's parent is the task its parentTaskId names, and its subtasks are the tasks whose
 * parentTaskId names it. Subtasks nest to any depth (BACK-760.1.2 under BACK-760.1 under BACK-760). The CLI's task
 * view, the delete guard, the TUI's task view and the web read these relations here, so they agree on them. The TUI
 * board still groups subtasks with a lookup of its own (src/ui/board.ts), which drops a grandchild that has its
 * ancestors' status (GitHub issue #1260); BACK-549 moves the TUI board onto these rules.
 */

import type { Task } from "../types/index.ts";
import { extractAnyPrefix } from "./prefix-config.ts";
import { canonicalTaskId } from "./task-id.ts";
import { sortByTaskId } from "./task-sorting.ts";
import { isTerminalStatus } from "./terminal-status.ts";

/** Which task is the parent of which, read once from one task list. */
export interface TaskHierarchy {
	/** The task's direct subtasks in task ID order, so BACK-2.2 comes before BACK-2.10. */
	subtasksOf(task: Pick<Task, "id">): readonly Task[];
	/** The task its parentTaskId names, or null when the list does not hold it. */
	parentOf(task: Pick<Task, "id" | "parentTaskId">): Task | null;
}

/**
 * The canonical ID of the task's parent, where letter case and zero padding do not matter. A parent ID written
 * without a prefix takes the prefix of the task's own ID, which a subtask shares with its parent. Only archived task
 * files keep such IDs: reading active tasks and drafts already gives every parent ID a prefix.
 */
function canonicalParentId(task: Pick<Task, "id" | "parentTaskId">): string | null {
	if (!task.parentTaskId) return null;
	return canonicalTaskId(task.parentTaskId, extractAnyPrefix(task.id) ?? undefined);
}

/** Reads the parent of every task in one pass, so a page can ask for the subtasks of each of thousands of tasks. */
export function createTaskHierarchy(tasks: readonly Task[]): TaskHierarchy {
	const taskById = new Map<string, Task>();
	const subtasksByParentId = new Map<string, Task[]>();
	for (const task of tasks) {
		const id = canonicalTaskId(task.id);
		// When two tasks claim one ID, the first one is the parent, as a search of the list would find it.
		if (!taskById.has(id)) taskById.set(id, task);
		const parentId = canonicalParentId(task);
		if (!parentId) continue;
		const siblings = subtasksByParentId.get(parentId);
		if (siblings) siblings.push(task);
		else subtasksByParentId.set(parentId, [task]);
	}
	for (const [parentId, subtasks] of subtasksByParentId) {
		subtasksByParentId.set(parentId, sortByTaskId(subtasks));
	}

	return {
		subtasksOf: (task) => subtasksByParentId.get(canonicalTaskId(task.id)) ?? [],
		parentOf: (task) => {
			const parentId = canonicalParentId(task);
			return parentId ? (taskById.get(parentId) ?? null) : null;
		},
	};
}

/**
 * The tasks one status group of a list shows at its top level, in the group's order. A task whose parent is in the
 * same group is shown under that parent instead, at any depth, so opening the levels from the top-level tasks reaches
 * every task of the group. Tasks whose parents form a loop, which only a hand-edited file can make, cannot be reached
 * that way: the first of them is shown at the top level, and the others under it.
 */
export function findTopLevelTasks(groupTasks: readonly Task[], hierarchy: TaskHierarchy): Task[] {
	// Tasks are compared by canonical ID, so the group may hold copies of the tasks the hierarchy was read from.
	const groupIds = new Set(groupTasks.map((task) => canonicalTaskId(task.id)));
	const isInGroup = (task: Task) => groupIds.has(canonicalTaskId(task.id));
	const topLevelIds = new Set<string>();
	const reachableIds = new Set<string>();
	const showAtTopLevel = (task: Task) => {
		topLevelIds.add(canonicalTaskId(task.id));
		const pending = [task];
		for (let next = pending.pop(); next; next = pending.pop()) {
			const id = canonicalTaskId(next.id);
			if (reachableIds.has(id)) continue;
			reachableIds.add(id);
			pending.push(...hierarchy.subtasksOf(next).filter(isInGroup));
		}
	};

	for (const task of groupTasks) {
		const parent = hierarchy.parentOf(task);
		if (!parent || !isInGroup(parent)) showAtTopLevel(task);
	}
	for (const task of groupTasks) {
		if (!reachableIds.has(canonicalTaskId(task.id))) showAtTopLevel(task);
	}
	return groupTasks.filter((task) => topLevelIds.has(canonicalTaskId(task.id)));
}

export interface SubtaskProgress {
	total: number;
	/** The subtasks in the configured final status. */
	completed: number;
}

/** How many of a task's subtasks are finished, where finished means the configured final status; null without any. */
export function summarizeSubtaskProgress(
	subtasks: readonly Task[],
	statuses: readonly string[],
): SubtaskProgress | null {
	if (subtasks.length === 0) return null;
	const completed = subtasks.filter((subtask) => isTerminalStatus(subtask.status, statuses)).length;
	return { total: subtasks.length, completed };
}

/** The task's direct subtasks in task ID order. */
export function findDirectSubtasks(task: Pick<Task, "id">, tasks: readonly Task[]): Task[] {
	return [...createTaskHierarchy(tasks).subtasksOf(task)];
}

/** The task with its parent's title and its direct subtasks' IDs and titles, for the task detail of the CLI and TUI. */
export function attachSubtaskSummaries(task: Task, tasks: Task[]): Task {
	const hierarchy = createTaskHierarchy(tasks);
	const parentTitle = hierarchy.parentOf(task)?.title;
	const subtasks = hierarchy.subtasksOf(task);

	// The same object comes back when there is nothing to add.
	let summarized = task;
	if (parentTitle && parentTitle !== task.parentTaskTitle) {
		summarized = { ...summarized, parentTaskTitle: parentTitle };
	}
	if (subtasks.length > 0) {
		summarized = {
			...summarized,
			subtasks: subtasks.map((subtask) => subtask.id),
			subtaskSummaries: subtasks.map((subtask) => ({ id: subtask.id, title: subtask.title })),
		};
	}
	return summarized;
}
