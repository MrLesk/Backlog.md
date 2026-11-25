import { type MouseEvent, useCallback } from "react";
import { Link, type LinkProps, useLocation, useNavigate } from "react-router-dom";
import type { Task } from "../../types";
import { taskLinkTarget } from "../lib/task-links.ts";

type TaskLinkProps = Omit<LinkProps, "to" | "state" | "replace"> & {
	task: Pick<Task, "id" | "title">;
};

/**
 * A link to a task, built by taskLinkTarget. It is a real link: a plain click opens the task in the app, and
 * Ctrl/Cmd-click, middle-click and the context menu open it in a new tab.
 */
export default function TaskLink({ task, ...linkProps }: TaskLinkProps) {
	const target = taskLinkTarget(task, useLocation());
	return <Link {...linkProps} to={target.to} state={target.state} replace={target.replace} />;
}

/**
 * Whether a click on a row or a card opens its task. A row or a card opens its task on a plain click anywhere outside
 * its links, as a shortcut for the mouse. A link inside has already answered its own plain click (it marks the click
 * with preventDefault), so the row around it does not open a task a second time. A click with Ctrl, Cmd, Shift or Alt
 * is left to the browser, which opens a link in a new tab, and to the Board, which selects cards with it.
 */
export function isTaskOpeningClick(event: MouseEvent): boolean {
	return !event.defaultPrevented && !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
}

/**
 * Opens a task where its TaskLink would go. For the mouse shortcuts that are not links themselves, such as a click
 * elsewhere on a row or a card, and for links of older versions that name a task in the query.
 */
export function useOpenTask(): (task: Pick<Task, "id" | "title">) => void {
	const location = useLocation();
	const navigate = useNavigate();
	return useCallback(
		(task) => {
			const target = taskLinkTarget(task, location);
			navigate(target.to, { state: target.state, replace: target.replace });
		},
		[location, navigate],
	);
}
