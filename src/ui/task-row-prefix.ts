import blessed from "neo-neo-bblessed";
import type { Task } from "../types/index.ts";
import { formatAcceptanceCriteriaProgress } from "./acceptance-criteria-progress.ts";
import { formatStatusWithIcon, getStatusColor, wrapStatusColor } from "./status-icon.ts";
import { stripBlessedFgTags } from "./utils/strip-tags.ts";

const { unicode } = blessed as unknown as { unicode: { strWidth(value: string): number } };

/** Cells a segment occupies once blessed has consumed its color tags. */
function displayWidth(segment: string): number {
	return unicode.strWidth(stripBlessedFgTags(segment));
}

function widestSegment(tasks: Task[], segment: (task: Task) => string): number {
	return tasks.reduce((widest, task) => Math.max(widest, displayWidth(segment(task))), 0);
}

/** A column no row fills is dropped entirely, separator included. */
function pad(segment: string, width: number): string {
	return width === 0 ? "" : `${segment}${" ".repeat(width - displayWidth(segment) + 1)}`;
}

export type TaskRowPrefix = (task: Task) => string;

/**
 * Build the prefix that precedes the task id in one-line TUI summaries: the status, on
 * surfaces that do not already name it, then the acceptance-criteria progress.
 *
 * Each segment is padded to the widest one across `tasks`, so ids line up down the render
 * while no row pays for width nothing on screen uses -- a list without progress, or with
 * only single-digit counts, spends nothing on the three-digit case. Both segments carry
 * their own color tags, so callers must place the prefix outside any row-level tag: a
 * bare {/} closes the enclosing color, not just its own.
 */
export function createTaskRowPrefix(tasks: Task[], options: { showStatus: boolean }): TaskRowPrefix {
	const status = (task: Task) =>
		options.showStatus ? wrapStatusColor(formatStatusWithIcon(task.status), getStatusColor(task.status)) : "";
	const statusWidth = widestSegment(tasks, status);
	const progressWidth = widestSegment(tasks, formatAcceptanceCriteriaProgress);

	return (task) => pad(status(task), statusWidth) + pad(formatAcceptanceCriteriaProgress(task), progressWidth);
}
