import { useId, useState } from "react";
import type { Task } from "../../types";
import { sectionTasks, sortTasks } from "../../utils/task-sorting.ts";
import { findTopLevelTasks } from "../../utils/task-subtasks.ts";
import { getTerminalStatus } from "../../utils/terminal-status.ts";
import {
	readSubtaskLevel,
	type SubtaskLevels,
	subtaskPath,
	type TaskNesting,
	useSubtaskLevels,
} from "../lib/task-nesting.ts";
import AcceptanceCriteriaProgress from "./AcceptanceCriteriaProgress";
import CleanupButton from "./CleanupButton";
import PriorityBars from "./PriorityBars";
import StatusMark from "./StatusMark";
import StoredDate from "./StoredDate";
import { NO_MATCHING_SUBTASKS, ParentTaskLink, SubtaskMarker, SubtaskRails } from "./SubtaskControls";
import TaskBranch from "./TaskBranch";
import TaskTags from "./TaskTags";

interface TaskListProps {
	/** The tasks to show, already narrowed by the filters of the page. */
	tasks: Task[];
	/** Which tasks are subtasks of which, among every task and among the tasks the filters keep. */
	nesting: TaskNesting;
	statuses: string[];
	priorities?: string[];
	projects?: string[];
	/**
	 * Whether the group of the final status is open until the person opens or closes it. The page asks for it while
	 * the Status filter selects the final status; otherwise that group starts closed.
	 */
	finalGroupOpenByDefault: boolean;
	isLoading: boolean;
	dateFormat?: string;
	onEditTask: (task: Task) => void;
	/** Opens the cleanup dialog; absent without write access. */
	onCleanup?: () => void;
}

/**
 * The List layout of the Tasks page: one group per status and one row per task. Groups and their order come from
 * the shared task list functions, so the list matches `backlog task list --plain`: configured statuses in workflow
 * order, then any other status, and inside a group ordinal, then priority, then ID. A subtask whose parent is in the
 * same group is listed under that parent, which opens it in place; findTopLevelTasks decides which tasks those are.
 */
export default function TaskList({
	tasks,
	nesting,
	statuses,
	priorities,
	projects,
	finalGroupOpenByDefault,
	isLoading,
	dateFormat,
	onEditTask,
	onCleanup,
}: TaskListProps) {
	// Only the groups a person opened or closed are recorded; every other group follows its default.
	const [openByStatus, setOpenByStatus] = useState<Record<string, boolean>>({});
	const subtaskLevels = useSubtaskLevels();

	if (isLoading) {
		return (
			<div role="status" aria-label="Loading tasks" className="space-y-3 panel-gutter py-6">
				{[0, 1, 2].map((row) => (
					<div key={row} className="h-4 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
				))}
			</div>
		);
	}

	// The page says when its filters match nothing, so an empty list here means the project has no tasks.
	const groups = sectionTasks(sortTasks(tasks, undefined, priorities), undefined, statuses).map((group) => ({
		...group,
		topLevelTasks: findTopLevelTasks(group.tasks, nesting.visible),
	}));
	if (groups.length === 0) {
		return <p className="panel-gutter py-10 text-center text-sm text-ink-2">No tasks yet</p>;
	}

	const finalStatus = getTerminalStatus(statuses);
	// IDs are drawn in the mono face, so a width in ch of the longest ID lines up the top-level rows of the list.
	// Subtask rows put their ID in the flexible middle column instead.
	const idWidth = `${Math.max(...groups.flatMap((group) => group.topLevelTasks.map((task) => task.id.length)))}ch`;

	// relative keeps the rows' screen-reader-only labels inside the list. Without it they are placed against the
	// page and stretch it, which gives the window a second scroll bar.
	return (
		<div className="relative @container">
			{groups.map(({ status, tasks: groupTasks, topLevelTasks }, index) => {
				const name = status ?? "";
				const isFinal = name === finalStatus;
				const isOpen = openByStatus[name] ?? (!isFinal || finalGroupOpenByDefault);
				const listId = `task-group-${index}`;
				return (
					<div key={name} className="border-t border-line-soft first:border-t-0">
						<div className="flex h-[34px] items-center gap-2 bg-surface-2 panel-gutter">
							<h3 className="flex min-w-0 flex-1 self-stretch">
								<button
									type="button"
									aria-expanded={isOpen}
									aria-controls={listId}
									onClick={() => setOpenByStatus((current) => ({ ...current, [name]: !isOpen }))}
									className="flex h-full w-full min-w-0 items-center gap-2 rounded-[6px] text-left text-sm font-semibold text-ink focus-ring"
								>
									<svg viewBox="0 0 16 16" className={`size-3.5 shrink-0 text-ink-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true">
										<path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
									</svg>
									<StatusMark status={name} statuses={statuses} decorative />
									<span className="truncate">{name}</span>
									{/* Every task of the status the filters keep, also the ones listed under a closed parent. */}
									<span className="font-mono text-[11.5px] font-medium text-ink-3">{groupTasks.length}</span>
								</button>
							</h3>
							{isFinal && onCleanup && <CleanupButton onClick={onCleanup} />}
						</div>
						{isOpen && (
							<ul id={listId}>
								{topLevelTasks.map((task) => (
									<TaskRow
										key={task.id}
										task={task}
										path={task.id}
										depth={0}
										nesting={nesting}
										levels={subtaskLevels}
										statuses={statuses}
										priorities={priorities}
										projects={projects}
										idWidth={idWidth}
										dateFormat={dateFormat}
										onEditTask={onEditTask}
									/>
								))}
							</ul>
						)}
					</div>
				);
			})}
		</div>
	);
}

interface TaskRowProps {
	task: Task;
	/** The path of the row's level; see SubtaskLevels. */
	path: string;
	/** 0 for a row at the top of its group, one more for each level below it: one rail each. */
	depth: number;
	nesting: TaskNesting;
	levels: SubtaskLevels;
	statuses: string[];
	priorities?: string[];
	projects?: string[];
	idWidth: string;
	dateFormat?: string;
	onEditTask: (task: Task) => void;
}

/**
 * The two row grids. A row at the top of its group has priority, ID, status, title and details. A subtask row has
 * priority, one rail per level, then status, ID and title together, and details: the rails take width from the title
 * only, so the details stay in their columns at every depth. Below 64rem the details move to a second line, under
 * the column where the title starts.
 */
// A row's vertical padding, and the rails' negative margins that reach into it so the guide lines join from row to
// row: change the two together.
const ROW_PADDING = "py-2.5 @5xl:py-2";
const RAILS_CELL = "-my-2.5 flex self-stretch @5xl:-my-2";

const ROW_LAYOUTS = {
	topLevel: {
		grid: "grid-cols-[14px_auto_14px_minmax(0,1fr)] @5xl:grid-cols-[14px_auto_14px_minmax(0,1fr)_auto]",
		details: "col-start-2 col-end-[-1] @5xl:col-start-auto @5xl:col-end-auto",
	},
	subtask: {
		grid: "grid-cols-[14px_auto_minmax(0,1fr)] @5xl:grid-cols-[14px_auto_minmax(0,1fr)_auto]",
		details: "col-start-3 col-end-[-1] @5xl:col-start-auto @5xl:col-end-auto",
	},
};

/**
 * One task and, while its marker is open, its subtasks that the filters keep, one level deeper. A list of 64rem or
 * more shows a row on one line and cuts a long title with an ellipsis; a narrower list puts the details on a second
 * line and wraps the title.
 */
function TaskRow(props: TaskRowProps) {
	const { task, path, depth, nesting, levels, statuses, priorities, projects, idWidth, dateFormat, onEditTask } = props;
	const subtasksId = useId();
	const { progress, isOpen } = readSubtaskLevel(task, path, nesting, levels, statuses);
	const isTopLevel = depth === 0;
	const layout = isTopLevel ? ROW_LAYOUTS.topLevel : ROW_LAYOUTS.subtask;
	const visibleSubtasks = nesting.visible.subtasksOf(task);

	// The title with the marker after it. A subtask at the top of its group is listed apart from its parent, so its
	// title starts with a link to the parent. Below 64rem the title moves under that link when less than 10rem is left.
	const titleCell = (
		<div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 @5xl:flex-nowrap">
			{isTopLevel && task.parentTaskId && (
				<ParentTaskLink task={task} parent={nesting.all.parentOf(task)} onOpenTask={onEditTask} />
			)}
			<button
				type="button"
				onClick={(event) => {
					event.stopPropagation();
					onEditTask(task);
				}}
				title={task.title}
				aria-label={`Open ${task.id}: ${task.title}`}
				className="min-w-0 grow basis-40 rounded-[4px] text-left text-sm font-medium text-ink wrap-anywhere focus-ring @5xl:grow-0 @5xl:basis-auto @5xl:truncate"
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
		</div>
	);

	return (
		<li>
			{/* The title button is the keyboard and screen reader path to the task; a click anywhere else on the row is a
			    shortcut for the mouse. The click is on the row, not the li, so a click on a subtask row below cannot
			    reach it. */}
			<div
				onClick={() => onEditTask(task)}
				className={`grid cursor-pointer items-start gap-x-2.5 gap-y-1 border-t border-line-soft panel-gutter transition-colors duration-200 hover:bg-hover @5xl:items-center ${ROW_PADDING} ${layout.grid}`}
			>
				{/* The marks and the ID are one title line tall, so they stay beside the first line of a title that wraps. */}
				<span className="flex h-5 items-center">
					<PriorityBars priority={task.priority} priorities={priorities} />
				</span>
				{isTopLevel ? (
					<>
						<span className="font-mono text-xs leading-5 font-medium text-ink-3" style={{ width: idWidth }}>
							{task.id}
						</span>
						<span className="flex h-5 items-center">
							<StatusMark status={task.status} statuses={statuses} />
						</span>
						{titleCell}
					</>
				) : (
					<>
						{/* Below 64rem the rails run beside the details line as well. */}
						<span className={`row-span-2 @5xl:row-span-1 ${RAILS_CELL}`}>
							<SubtaskRails count={depth} />
						</span>
						{/* Below 64rem the title moves under the status and ID when they leave it less than 12rem. */}
						<div className="flex min-w-0 flex-wrap items-start gap-x-2.5 gap-y-1 @5xl:flex-nowrap">
							<span className="flex h-5 items-center">
								<StatusMark status={task.status} statuses={statuses} />
							</span>
							<span className="font-mono text-xs leading-5 font-medium whitespace-nowrap text-ink-3">{task.id}</span>
							<div className="min-w-0 grow basis-48 @5xl:basis-auto">{titleCell}</div>
						</div>
					</>
				)}
				<TaskRowDetails task={task} projects={projects} dateFormat={dateFormat} placement={layout.details} />
			</div>
			{isOpen &&
				(visibleSubtasks.length > 0 ? (
					<ul id={subtasksId}>
						{visibleSubtasks.map((subtask) => (
							<TaskRow key={subtask.id} {...props} task={subtask} path={subtaskPath(path, subtask)} depth={depth + 1} />
						))}
					</ul>
				) : (
					// Drawn where the first subtask row would start, one level deeper.
					<div
						id={subtasksId}
						className={`grid items-center gap-x-2.5 border-t border-line-soft panel-gutter ${ROW_PADDING} ${ROW_LAYOUTS.subtask.grid}`}
					>
						<span />
						<span className={RAILS_CELL}>
							<SubtaskRails count={depth + 1} />
						</span>
						<p className="text-xs leading-5 text-ink-3">{NO_MATCHING_SUBTASKS}</p>
					</div>
				))}
		</li>
	);
}

/** The details at the right of a row, or on its second line in a narrow list: `placement` puts them in the grid. */
function TaskRowDetails({
	task,
	projects,
	dateFormat,
	placement,
}: Pick<TaskRowProps, "task" | "projects" | "dateFormat"> & { placement: string }) {
	const [firstAssignee, ...otherAssignees] = task.assignee;
	return (
		<div className={`flex flex-wrap items-center gap-x-3 gap-y-1 @5xl:flex-nowrap @5xl:justify-end ${placement}`}>
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 @5xl:flex-nowrap @5xl:justify-end">
				{task.branch && <TaskBranch branch={task.branch} />}
				{task.dueDate && (
					<span className="whitespace-nowrap text-xs text-ink-2">
						Due <StoredDate value={task.dueDate} dateFormat={dateFormat} />
					</span>
				)}
				<TaskTags task={task} projects={projects} />
			</div>
			<span className="flex items-center empty:hidden @5xl:w-16 @5xl:empty:block">
				<AcceptanceCriteriaProgress task={task} density="list" />
			</span>
			<span
				className="min-w-0 truncate font-mono text-xs text-ink-2 empty:hidden @5xl:w-[6.5rem] @5xl:empty:block"
				title={task.assignee.join(", ")}
			>
				{firstAssignee}
				{otherAssignees.length > 0 && <span className="text-ink-3"> +{otherAssignees.length}</span>}
			</span>
			<span className="whitespace-nowrap text-xs text-ink-3 @5xl:w-20 @5xl:text-right">
				<span className="sr-only">Updated </span>
				<StoredDate value={task.updatedDate || task.createdDate} dateFormat={dateFormat} compact />
			</span>
		</div>
	);
}
