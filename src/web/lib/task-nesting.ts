/**
 * How tasks nest on the Tasks page and in the task dialog: what a marker counts, which subtasks an opened level
 * lists, and when a level is open. Which task is a subtask of which is decided in src/utils/task-subtasks.ts.
 */

import { useCallback, useMemo, useState } from "react";
import type { Task } from "../../types";
import {
	createTaskHierarchy,
	type SubtaskProgress,
	summarizeSubtaskProgress,
	type TaskHierarchy,
} from "../../utils/task-subtasks.ts";

export interface TaskNesting {
	/** Parents and subtasks among every task: a marker counts these subtasks, and a parent link opens these parents. */
	all: TaskHierarchy;
	/** Parents and subtasks among the tasks the filters keep: an opened level lists these subtasks. */
	visible: TaskHierarchy;
	/** Whether filters or the search narrow the page. A level with matching subtasks then opens by itself. */
	isFiltered: boolean;
}

/** The nesting of the task dialog, which has no filters: every subtask is listed. */
export function createUnfilteredNesting(tasks: readonly Task[]): TaskNesting {
	const hierarchy = createTaskHierarchy(tasks);
	return { all: hierarchy, visible: hierarchy, isFiltered: false };
}

/**
 * The open state of the subtask levels of one tree owner: the List, the Board or the task dialog. A level is named by
 * its path, the task IDs from the top-level row or card down to the level's task, joined by "/", so a task shown in
 * two places opens and closes on its own in each. Only the levels a person opened or closed are recorded; every other
 * level follows its default.
 */
export interface SubtaskLevels {
	recorded: Readonly<Record<string, boolean>>;
	setOpen: (path: string, open: boolean) => void;
}

/** The open state of the subtask levels a component shows, kept for as long as the component stays on screen. */
export function useSubtaskLevels(): SubtaskLevels {
	const [recorded, setRecorded] = useState<Readonly<Record<string, boolean>>>({});
	const setOpen = useCallback((path: string, open: boolean) => {
		setRecorded((levels) => ({ ...levels, [path]: open }));
	}, []);
	return useMemo(() => ({ recorded, setOpen }), [recorded, setOpen]);
}

/** The path of a subtask's level, under the level at `parentPath`. */
export function subtaskPath(parentPath: string, subtask: Pick<Task, "id">): string {
	return `${parentPath}/${subtask.id}`;
}

/**
 * What a row shows about the subtasks of `task` at `path`: the marker's count of every direct subtask against the
 * configured final status (null without subtasks, so no marker), and whether its level is open. A level is open as the
 * person last set it there; otherwise only while the filters narrow the page and some of its subtasks match, so a
 * match never hides inside a closed parent.
 */
export function readSubtaskLevel(
	task: Task,
	path: string,
	nesting: TaskNesting,
	levels: SubtaskLevels,
	statuses: readonly string[],
): { progress: SubtaskProgress | null; isOpen: boolean } {
	const progress = summarizeSubtaskProgress(nesting.all.subtasksOf(task), statuses);
	if (!progress) return { progress, isOpen: false };
	const recorded = levels.recorded[path];
	if (recorded !== undefined) return { progress, isOpen: recorded };
	// A task already above its own level sits in a loop of hand-edited parents. Opening it by itself would open the
	// same levels again without end.
	const isInLoop = path.split("/").slice(0, -1).includes(task.id);
	return { progress, isOpen: nesting.isFiltered && !isInLoop && nesting.visible.subtasksOf(task).length > 0 };
}
