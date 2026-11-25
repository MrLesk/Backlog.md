/**
 * Where a link to a task goes, and what stays beneath an open task. Every place in the browser that opens a task (rows,
 * cards, subtask trees, parent links, dependency links, Markdown task links, search results and the task rows of other
 * pages) builds its link here, so a task opens the same way from anywhere, over the page it was opened from, and
 * closing it returns to that page.
 */

import type { Task } from "../../types";
import { createUrlPath } from "../utils/urlHelpers";
import { readRememberedTaskLayout, TASK_LAYOUT_PATHS, taskLayoutOfPath } from "./task-view.ts";

/** A page of the app as a link names it: its path and its query. */
export interface PageAddress {
	pathname: string;
	search: string;
}

/** What a task route carries in browser history. */
export interface TaskRouteState {
	/**
	 * The page the task was opened from. It stays on screen beneath the task, out of reach until the task closes, and
	 * closing the task goes back to it. Absent for a task opened from outside the app (a typed or shared link, a new tab).
	 */
	background?: PageAddress;
	/** Why a task link could not be opened, shown on the page it falls back to. */
	taskRouteError?: string;
}

export function readTaskRouteState(state: unknown): TaskRouteState {
	return state && typeof state === "object" ? (state as TaskRouteState) : {};
}

/**
 * The page beneath the task route at `location`: the page the task was opened from, or for a task opened from outside
 * the app, the Tasks page of the route's layout with its query (its filters). The links, the breadcrumb, closing a task
 * and the fallback of a task that cannot be opened all go by this one rule.
 */
export function pageBeneath(location: { pathname: string; search: string; state?: unknown }): PageAddress {
	const background = readTaskRouteState(location.state).background;
	if (background) return background;
	const layout = taskLayoutOfPath(location.pathname) ?? readRememberedTaskLayout();
	return { pathname: TASK_LAYOUT_PATHS[layout], search: location.search };
}

interface TaskLinkTarget {
	to: string;
	state?: TaskRouteState;
	/** Replace the current history entry instead of adding one. */
	replace: boolean;
}

/**
 * The link to `task` from the address bar's `location`. The task route is in the layout of the Tasks page the person is
 * on, with its query, or in the layout used last from any other page. From a page, the link opens the task over that
 * page. From an open task, it replaces that task and keeps its page beneath, so closing the new task does not walk back
 * through the old one.
 */
export function taskLinkTarget(
	task: Pick<Task, "id" | "title">,
	location: { pathname: string; search: string; state?: unknown },
): TaskLinkTarget {
	const layout = taskLayoutOfPath(location.pathname);
	const tasksPath = TASK_LAYOUT_PATHS[layout ?? readRememberedTaskLayout()];
	const isTaskOpen = location.pathname.startsWith(`${tasksPath}/`);
	const background = isTaskOpen
		? readTaskRouteState(location.state).background
		: { pathname: location.pathname, search: location.search };
	return {
		to: `${createUrlPath(tasksPath, task.id, task.title)}${layout ? location.search : ""}`,
		state: background ? { background } : undefined,
		replace: isTaskOpen,
	};
}

/** The accessible name of a link that opens a task, the same wherever the link is. */
export function taskLinkLabel(task: Pick<Task, "id" | "title">): string {
	return task.title ? `Open ${task.id}: ${task.title}` : `Open ${task.id}`;
}
