import { type MouseEvent, useId } from "react";
import type { Task } from "../../types";
import { readSubtaskLevel, type SubtaskLevels, subtaskPath, type TaskNesting } from "../lib/task-nesting.ts";
import AcceptanceCriteriaProgress from "./AcceptanceCriteriaProgress";
import StatusMark from "./StatusMark";
import { NO_MATCHING_SUBTASKS, SubtaskMarker, SubtaskRails } from "./SubtaskControls";

/** What every level of a tree passes on to the level below it, unchanged. */
interface SubtaskTreeLevelProps {
	nesting: TaskNesting;
	/** The configured statuses in workflow order. */
	statuses: string[];
	levels: SubtaskLevels;
	onOpenTask: (task: Task) => void;
	/** The task dialog shows each subtask's acceptance-criteria progress; a card has no room for it. */
	showsCriteria?: boolean;
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

/**
 * The compact tree of a task's subtasks, inside a Board card and in the task dialog: one row per subtask with its
 * status, ID, title and marker. A row is not a card: it opens its task, and cannot be dragged or selected.
 */
export default function SubtaskTree({ parent, path, id, rails = 0, ...level }: SubtaskTreeProps) {
	const subtasks = level.nesting.visible.subtasksOf(parent);
	if (subtasks.length === 0) {
		return (
			<p id={id} className="py-1.5 text-xs text-ink-3">
				{NO_MATCHING_SUBTASKS}
			</p>
		);
	}
	// role="list": Safari's VoiceOver drops the list semantics of a list without bullets, and the nesting levels
	// are what tells a screen reader how deep a subtask sits.
	return (
		<ul id={id} role="list">
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
	const { nesting, statuses, levels, onOpenTask, showsCriteria } = level;
	const subtasksId = useId();
	const { progress, isOpen } = readSubtaskLevel(task, path, nesting, levels, statuses);
	// The row stops the click, so the card around it does not open as well.
	const openTask = (event: MouseEvent) => {
		event.stopPropagation();
		onOpenTask(task);
	};

	return (
		<li>
			{/* The title button is the keyboard and screen reader path to the subtask; a click anywhere else on the row
			    is a shortcut for the mouse. */}
			<div
				onClick={openTask}
				className="flex min-h-7 cursor-pointer items-stretch rounded-[6px] pl-1 transition-colors duration-200 hover:bg-hover"
			>
				<SubtaskRails count={rails} />
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 py-1 pr-1">
					<StatusMark status={task.status} statuses={statuses} />
					<span className="min-w-0 font-mono text-[11.5px] leading-4 font-medium text-ink-3 wrap-anywhere">
						{task.id}
					</span>
					{/* The title keeps 7rem for itself: with less room left beside the ID, the title moves under it, and with
					    less room beside the title, the marker and the ring wrap under the title. It grows only to its own
					    width, so the marker stays right after it. */}
					<span className="flex min-w-0 flex-1 basis-28 flex-wrap items-center gap-x-1.5 gap-y-0.5">
						<button
							type="button"
							onClick={openTask}
							title={task.title}
							aria-label={`Open ${task.id}: ${task.title}`}
							className="min-w-0 max-w-fit grow basis-28 truncate rounded-[4px] text-left text-[12.5px] leading-5 text-ink focus-ring"
						>
							{task.title}
						</button>
						{progress && (
							<SubtaskMarker
								progress={progress}
								isOpen={isOpen}
								onToggle={() => levels.setOpen(path, !isOpen)}
								controls={subtasksId}
							/>
						)}
						{showsCriteria && (
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
