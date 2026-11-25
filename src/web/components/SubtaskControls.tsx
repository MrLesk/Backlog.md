import type { MouseEvent } from "react";
import type { Task } from "../../types";
import type { SubtaskProgress } from "../../utils/task-subtasks.ts";

/**
 * The parts of nested tasks that the List, the Board and the task dialog share. SubtaskMarker and SubtaskBar say how
 * many direct subtasks a task has and how many are done, and open and close them in place; ParentTaskLink opens the
 * parent of a task shown apart from it; SubtaskRails draws the guide lines of a nested row. The controls sit inside
 * rows and cards that open their task on a click, so each one stops its own click.
 */

/** What an opened level says when the filters keep none of its subtasks. */
export const NO_MATCHING_SUBTASKS = "No subtasks match these filters";

function countSubtasks(total: number): string {
	return `${total} ${total === 1 ? "subtask" : "subtasks"}`;
}

/** What a marker says to screen readers and in its tooltip, for example "3 subtasks, 1 done". */
export function describeSubtasks({ total, completed }: SubtaskProgress): string {
	return `${countSubtasks(total)}, ${completed === 0 ? "none" : completed} done`;
}

interface SubtaskToggleProps {
	progress: SubtaskProgress;
	isOpen: boolean;
	onToggle: () => void;
	/** The id of the list of subtasks this control opens. */
	controls: string;
}

function stopping(action: () => void) {
	return (event: MouseEvent) => {
		event.stopPropagation();
		action();
	};
}

/** A stem with two branches, each ending in a subtask. One path, as rows of a large list draw many of them. */
function SubtasksIcon() {
	return (
		<svg viewBox="0 0 16 16" className="size-[13px] shrink-0" aria-hidden="true">
			<path
				d="M3.5 2.5v9h4.5M3.5 6.5H8M12.25 6.5a1.75 1.75 0 1 1-3.5 0a1.75 1.75 0 1 1 3.5 0M12.25 11.5a1.75 1.75 0 1 1-3.5 0a1.75 1.75 0 1 1 3.5 0"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** Points right while closed and down while open. */
function Chevron({ isOpen }: { isOpen: boolean }) {
	return (
		<svg viewBox="0 0 16 16" className="size-3 shrink-0" aria-hidden="true">
			<path
				d={isOpen ? "m4 6 4 4 4-4" : "m6 4 4 4-4 4"}
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** The marker after a title in the List and in a tree of subtasks: "1/3" with a chevron. */
export function SubtaskMarker({ progress, isOpen, onToggle, controls }: SubtaskToggleProps) {
	const description = describeSubtasks(progress);
	return (
		<button
			type="button"
			aria-expanded={isOpen}
			aria-controls={controls}
			aria-label={description}
			title={description}
			onClick={stopping(onToggle)}
			className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-[6px] border border-line pr-1 pl-1.5 font-mono text-[11.5px] font-medium text-ink-2 transition-colors duration-200 hover:border-ink-3 hover:text-ink focus-ring ${isOpen ? "bg-surface-2" : "bg-surface"}`}
		>
			<SubtasksIcon />
			<span>
				{progress.completed}/{progress.total}
			</span>
			<Chevron isOpen={isOpen} />
		</button>
	);
}

/** The last line of a Board card whose task has subtasks: "3 subtasks" and "1/3". */
export function SubtaskBar({ progress, isOpen, onToggle, controls }: SubtaskToggleProps) {
	const description = describeSubtasks(progress);
	return (
		<button
			type="button"
			aria-expanded={isOpen}
			aria-controls={controls}
			aria-label={description}
			title={description}
			onClick={stopping(onToggle)}
			// Closed, the bar is the card's last line, so its fill follows the card's rounded corners: 9px is TaskCard's
			// 10px corner radius minus its 1px border, so change the two together.
			className={`flex h-8 w-full items-center gap-1.5 border-t border-line-soft px-3 text-left text-xs font-medium transition-colors duration-200 focus-ring ${isOpen ? "bg-surface-2 text-ink" : "rounded-b-[9px] text-ink-2 hover:bg-hover hover:text-ink"}`}
		>
			<SubtasksIcon />
			<span className="whitespace-nowrap">{countSubtasks(progress.total)}</span>
			<span className="ml-auto font-mono text-[11.5px]">
				{progress.completed}/{progress.total}
			</span>
			<Chevron isOpen={isOpen} />
		</button>
	);
}

interface ParentTaskLinkProps {
	/** The task shown apart from its parent. */
	task: Task;
	/** Its parent, or null when the page does not hold it (archived or missing): the ID is then shown as text. */
	parent: Task | null;
	onOpenTask: (task: Task) => void;
}

/** The parent's ID with a chevron, before the ID or title of a subtask shown apart from its parent. */
export function ParentTaskLink({ task, parent, onOpenTask }: ParentTaskLinkProps) {
	const className = "inline-flex shrink-0 items-center gap-0.5 font-mono text-xs leading-4 font-medium text-ink-3";
	if (!parent) {
		return (
			<span className={className}>
				<span className="sr-only">Parent task </span>
				{task.parentTaskId}
				<Chevron isOpen={false} />
			</span>
		);
	}
	return (
		<button
			type="button"
			aria-label={`Parent task ${parent.id}: ${parent.title}`}
			title={`Parent task ${parent.id}: ${parent.title}`}
			onClick={stopping(() => onOpenTask(parent))}
			className={`${className} rounded-[4px] transition-colors duration-200 hover:text-ink focus-ring`}
		>
			{parent.id}
			<Chevron isOpen={false} />
		</button>
	);
}

/**
 * One guide line per level above a nested row, each 14px wide. The lines run the full height of the row, so they join
 * from row to row.
 */
export function SubtaskRails({ count }: { count: number }) {
	if (count === 0) return null;
	return (
		<span aria-hidden="true" className="flex shrink-0">
			{Array.from({ length: count }, (_, level) => (
				<span key={level} className="ml-1.5 w-2 border-l border-line" />
			))}
		</span>
	);
}
