import { type MouseEvent, useId } from "react";
import type { Task } from "../../types";
import { readSubtaskLevel, type SubtaskLevels, subtaskPath, type TaskNesting } from "../lib/task-nesting.ts";
import { taskLinkLabel } from "../lib/task-links.ts";
import AcceptanceCriteriaProgress from "./AcceptanceCriteriaProgress";
import StatusMark from "./StatusMark";
import { NO_MATCHING_SUBTASKS, SubtaskMarker, SubtaskRails } from "./SubtaskControls";
import TaskLink, { isTaskOpeningClick } from "./TaskLink";

/**
 * How a tree is drawn. "card": compact rows inside a Board card, which has no room for more. "page": the task page's
 * rows, as drawn for it: 38 px tall, divided by hairlines, with medium titles and each subtask's criteria ring.
 */
type SubtaskTreeVariant = "card" | "page";

/** What every level of a tree passes on to the level below it, unchanged. */
interface SubtaskTreeLevelProps {
	nesting: TaskNesting;
	/** The configured statuses in workflow order. */
	statuses: string[];
	levels: SubtaskLevels;
	/** Opens a subtask on a click elsewhere on its row; its title is a link that opens it by itself. */
	onOpenTask: (task: Task) => void;
	variant: SubtaskTreeVariant;
}

interface SubtaskTreeProps extends SubtaskTreeLevelProps {
	/** The task whose subtasks the tree lists. Each subtask that has subtasks of its own opens one level further. */
	parent: Task;
	/** The path of the parent's level; see SubtaskLevels. */
	path: string;
	/** The id of the list, which the control that opens it names. */
	id?: string;
	/** How many rails the rows of this level draw: none for the first level of the tree. */
	rails?: number;
}

const ROW_STYLES: Record<SubtaskTreeVariant, { row: string; title: string; id: string }> = {
	card: {
		row: "min-h-7 rounded-[6px] pl-1",
		title: "text-[12.5px]",
		id: "text-[11.5px]",
	},
	page: {
		row: "min-h-[38px] px-3",
		title: "text-[13.5px] font-medium",
		id: "text-xs",
	},
};

// The lists of a tree: the first level, and the levels opened under a row. On the page every row has a hairline
// between it and the next one: between the rows of one level (divide-y), and above an opened level, which follows its
// parent's row.
const LIST_STYLES: Record<SubtaskTreeVariant, { first: string; opened: string }> = {
	card: { first: "", opened: "" },
	page: {
		first: "overflow-hidden rounded-[10px] border border-line divide-y divide-line-soft",
		opened: "border-t border-line-soft divide-y divide-line-soft",
	},
};

/**
 * The tree of a task's subtasks, inside a Board card and on the task page: one row per subtask with its status, ID,
 * title and marker. A row is not a card: it opens its task, and cannot be dragged or selected.
 */
export default function SubtaskTree({ parent, path, id, rails = 0, ...level }: SubtaskTreeProps) {
	const subtasks = level.nesting.visible.subtasksOf(parent);
	const listStyle = LIST_STYLES[level.variant][rails === 0 ? "first" : "opened"];
	if (subtasks.length === 0) {
		return (
			<p id={id} className={`py-1.5 text-xs text-ink-3 ${level.variant === "page" ? "px-3" : ""}`}>
				{NO_MATCHING_SUBTASKS}
			</p>
		);
	}
	// role="list": Safari's VoiceOver drops the list semantics of a list without bullets, and the nesting levels
	// are what tells a screen reader how deep a subtask sits. On the page the whole tree sits in one bordered box.
	return (
		<ul id={id} role="list" className={listStyle || undefined}>
			{subtasks.map((subtask) => (
				<SubtaskTreeRow key={subtask.id} task={subtask} path={subtaskPath(path, subtask)} rails={rails} {...level} />
			))}
		</ul>
	);
}

interface SubtaskTreeRowProps extends SubtaskTreeLevelProps {
	task: Task;
	path: string;
	rails: number;
}

function SubtaskTreeRow({ task, path, rails, ...level }: SubtaskTreeRowProps) {
	const { nesting, statuses, levels, onOpenTask, variant } = level;
	const subtasksId = useId();
	const { progress, isOpen } = readSubtaskLevel(task, path, nesting, levels, statuses);
	const styles = ROW_STYLES[variant];
	// The row stops the click it opens the subtask with, so the card around it does not open as well.
	const openTask = (event: MouseEvent) => {
		if (!isTaskOpeningClick(event)) return;
		event.stopPropagation();
		onOpenTask(task);
	};

	return (
		<li>
			{/* The title link is the keyboard and screen reader path to the subtask; a click anywhere else on the row
			    is a shortcut for the mouse. */}
			<div
				onClick={openTask}
				className={`flex cursor-pointer items-stretch transition-colors duration-200 hover:bg-hover ${styles.row}`}
			>
				<SubtaskRails count={rails} />
				{/* The status and the ID are one title line tall (h-5, leading-5), so they stay beside the title's first
				    line when the marker wraps under the title. */}
				<div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1.5 gap-y-0.5 self-center py-1 pr-1">
					<span className="flex h-5 shrink-0 items-center">
						<StatusMark status={task.status} statuses={statuses} />
					</span>
					<span className={`min-w-0 font-mono leading-5 font-medium text-ink-3 wrap-anywhere ${styles.id}`}>{task.id}</span>
					{/* The title keeps 7rem for itself: with less room left beside the ID, the title moves under it, and with
					    less room beside the title, the marker and the ring wrap under the title. It grows only to its own
					    width, so the marker stays right after it. */}
					<span className="flex min-w-0 flex-1 basis-28 flex-wrap items-center gap-x-1.5 gap-y-0.5">
						{/* draggable={false}: inside a Board card, a drag that starts on the link moves nothing, as on the row. */}
						<TaskLink
							task={task}
							draggable={false}
							title={task.title}
							aria-label={taskLinkLabel(task)}
							className={`min-w-0 max-w-fit grow basis-28 truncate rounded-[4px] text-left leading-5 text-ink focus-ring ${styles.title}`}
						>
							{task.title}
						</TaskLink>
						{progress && (
							<SubtaskMarker
								progress={progress}
								isOpen={isOpen}
								onToggle={() => levels.setOpen(path, !isOpen)}
								controls={subtasksId}
							/>
						)}
						{variant === "page" && (
							<span className="ml-auto flex shrink-0">
								<AcceptanceCriteriaProgress task={task} density="list" />
							</span>
						)}
					</span>
				</div>
			</div>
			{isOpen && <SubtaskTree parent={task} path={path} id={subtasksId} rails={rails + 1} {...level} />}
		</li>
	);
}
