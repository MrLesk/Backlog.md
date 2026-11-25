/**
 * Where a link to a task goes. Every place in the browser that opens a task (rows, cards, subtask trees, parent links,
 * dependency links, Markdown task links, search results and the task rows of other pages) builds its link here, so a
 * task opens the same way from anywhere and closing it returns to where the person came from.
 */

import type { Task } from "../../types";
import { createUrlPath } from "../utils/urlHelpers";
import { readRememberedTaskLayout, TASK_LAYOUT_PATHS, taskLayoutOfPath } from "./task-view.ts";

/** What a task route carries in browser history. */
export interface TaskRouteState {
	/**
	 * Set when a link in this tab opened the task, so closing it goes back one step in history, to where the person
	 * came from. Absent for a task opened from outside the app (a typed or shared link), which closes to the Tasks page
	 * beneath it.
	 */
	openedInApp?: boolean;
	/** Why a task link could not be opened, shown on the Tasks page it falls back to. */
	taskRouteError?: string;
}

export function readTaskRouteState(state: unknown): TaskRouteState {
	return state && typeof state === "object" ? (state as TaskRouteState) : {};
}

interface TaskLinkTarget {
	to: string;
	state?: TaskRouteState;
	/** Replace the current history entry instead of adding one. */
	replace: boolean;
}

/**
 * The Tasks page that a task opened from `location` sits over: on the Tasks page or an open task, that page's layout
 * and its query (its filters); from any other page, the layout used last, without a query.
 */
export function tasksPageOf(location: { pathname: string; search: string }): { path: string; search: string } {
	const layout = taskLayoutOfPath(location.pathname);
	return layout
		? { path: TASK_LAYOUT_PATHS[layout], search: location.search }
		: { path: TASK_LAYOUT_PATHS[readRememberedTaskLayout()], search: "" };
}

/**
 * The link to `task` from the page at `location`: the task route over the Tasks page of tasksPageOf. From an open
 * task it replaces that task and keeps how it was opened, so closing the new one does not walk back through the old
 * one; from anywhere else it adds a history entry that closing goes back from.
 */
export function taskLinkTarget(
	task: Pick<Task, "id" | "title">,
	location: { pathname: string; search: string; state?: unknown },
): TaskLinkTarget {
	const tasksPage = tasksPageOf(location);
	const isTaskOpen = location.pathname.startsWith(`${tasksPage.path}/`);
	const openedInApp = isTaskOpen ? readTaskRouteState(location.state).openedInApp === true : true;
	return {
		to: `${createUrlPath(tasksPage.path, task.id, task.title)}${tasksPage.search}`,
		state: openedInApp ? { openedInApp: true } : undefined,
		replace: isTaskOpen,
	};
}
