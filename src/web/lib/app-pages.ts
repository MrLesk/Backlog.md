/**
 * The pages of the browser app with the names people see for them. The sidebar names its entries from this list and
 * the breadcrumb of a task page names the page beneath the task from it, so a page is called the same everywhere.
 */

import { taskLayoutOfPath } from "./task-view.ts";

export const APP_PAGES = {
	// The Tasks page is at /tasks in the List layout and at /board in the Board layout (task-view.ts).
	tasks: { path: "/tasks", label: "Tasks" },
	milestones: { path: "/milestones", label: "Milestones" },
	drafts: { path: "/drafts", label: "Drafts" },
	statistics: { path: "/statistics", label: "Statistics" },
	documents: { path: "/documentation", label: "Documents" },
	decisions: { path: "/decisions", label: "Decisions" },
	settings: { path: "/settings", label: "Settings" },
} as const;

/** The name of the page at `pathname`, or of the page a record at it belongs to, such as a document. */
export function pageLabelOf(pathname: string): string | undefined {
	if (taskLayoutOfPath(pathname)) return APP_PAGES.tasks.label;
	return Object.values(APP_PAGES).find(({ path }) => pathname === path || pathname.startsWith(`${path}/`))?.label;
}
