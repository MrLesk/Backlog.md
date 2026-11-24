/**
 * How the Tasks page shows its tasks: the layout, which the path names (/tasks or /board), and the lanes of the
 * board, which the `lane` parameter names. Both are also remembered in this browser, so the sidebar's Tasks entry
 * and the start page open the layout used last, and the board keeps the lanes used last.
 */

import type { LaneMode } from "./lanes.ts";

export type TaskLayout = "list" | "board";

export const TASK_LAYOUT_PATHS: Record<TaskLayout, string> = { list: "/tasks", board: "/board" };

// The Tasks page layout this browser used last: "list" or "board". Without it, the board opens.
const LAYOUT_STORAGE_KEY = "backlog.tasks.layout";
const LANE_STORAGE_KEY = "backlog.board.lane";

/** The layout a path shows, or null outside the Tasks page. A task route keeps the layout it opens over. */
export function taskLayoutOfPath(pathname: string): TaskLayout | null {
	if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return "list";
	if (pathname === "/board" || pathname.startsWith("/board/")) return "board";
	return null;
}

export function readRememberedTaskLayout(): TaskLayout {
	return localStorage.getItem(LAYOUT_STORAGE_KEY) === "list" ? "list" : "board";
}

export function rememberTaskLayout(layout: TaskLayout): void {
	localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
}

function parseLaneMode(value: string | null): LaneMode | null {
	return value === "milestone" || value === "none" ? value : null;
}

/** The lanes of the board: the `lane` parameter, else the lanes used last, else none. */
export function readLaneMode(params: URLSearchParams): LaneMode {
	return parseLaneMode(params.get("lane")) ?? parseLaneMode(localStorage.getItem(LANE_STORAGE_KEY)) ?? "none";
}

export function rememberLaneMode(mode: LaneMode): void {
	localStorage.setItem(LANE_STORAGE_KEY, mode);
}
