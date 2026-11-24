import { useState } from "react";
import type { Task } from "../../types";
import { sectionTasks, sortTasks } from "../../utils/task-sorting.ts";
import { getTerminalStatus } from "../../utils/terminal-status.ts";
import AcceptanceCriteriaProgress from "./AcceptanceCriteriaProgress";
import CleanupButton from "./CleanupButton";
import PriorityBars from "./PriorityBars";
import StatusMark from "./StatusMark";
import StoredDate from "./StoredDate";
import TaskBranch from "./TaskBranch";
import TaskTags from "./TaskTags";

interface TaskListProps {
	/** The tasks to show, already narrowed by the filters of the page. */
	tasks: Task[];
	statuses: string[];
	priorities?: string[];
	projects?: string[];
	/**
	 * Whether the group of the final status is open until the person opens or closes it. The page asks for it while
	 * the Status filter selects the final status; otherwise that group starts closed.
	 */
	finalGroupOpenByDefault: boolean;
	isLoading: boolean;
	isFiltered: boolean;
	dateFormat?: string;
	onEditTask: (task: Task) => void;
	/** Opens the cleanup dialog; absent without write access. */
	onCleanup?: () => void;
}

/**
 * The List layout of the Tasks page: one group per status and one row per task. Groups and their order come from
 * the shared task list functions, so the list matches `backlog task list --plain`: configured statuses in workflow
 * order, then any other status, and inside a group ordinal, then priority, then ID.
 */
export default function TaskList({
	tasks,
	statuses,
	priorities,
	projects,
	finalGroupOpenByDefault,
	isLoading,
	isFiltered,
	dateFormat,
	onEditTask,
	onCleanup,
}: TaskListProps) {
	// Only the groups a person opened or closed are recorded; every other group follows its default.
	const [openByStatus, setOpenByStatus] = useState<Record<string, boolean>>({});

	if (isLoading) {
		return (
			<div role="status" aria-label="Loading tasks" className="space-y-3 panel-gutter py-6">
				{[0, 1, 2].map((row) => (
					<div key={row} className="h-4 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
				))}
			</div>
		);
	}

	const groups = sectionTasks(sortTasks(tasks, undefined, priorities), undefined, statuses);
	if (groups.length === 0) {
		return (
			<p className="panel-gutter py-10 text-center text-sm text-ink-2">
				{isFiltered ? "No tasks match these filters" : "No tasks yet"}
			</p>
		);
	}

	const finalStatus = getTerminalStatus(statuses);
	// IDs are drawn in the mono face, so a width in ch of the longest ID lines up every row of the list.
	const idWidth = `${Math.max(...tasks.map((task) => task.id.length))}ch`;

	return (
		<div className="@container">
			{groups.map(({ status, tasks: groupTasks }, index) => {
				const name = status ?? "";
				const isFinal = name === finalStatus;
				const isOpen = openByStatus[name] ?? (!isFinal || finalGroupOpenByDefault);
				const listId = `task-group-${index}`;
				return (
					<div key={name} className="border-t border-line-soft first:border-t-0">
						<div className="flex h-[34px] items-center gap-2 bg-surface-2 panel-gutter">
							<h3 className="min-w-0 flex-1">
								<button
									type="button"
									aria-expanded={isOpen}
									aria-controls={listId}
									onClick={() => setOpenByStatus((current) => ({ ...current, [name]: !isOpen }))}
									className="flex max-w-full items-center gap-2 rounded-[6px] text-sm font-semibold text-ink focus-ring"
								>
									<svg viewBox="0 0 16 16" className={`size-3.5 shrink-0 text-ink-3 transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true">
										<path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
									</svg>
									<StatusMark status={name} statuses={statuses} decorative />
									<span className="truncate">{name}</span>
									<span className="font-mono text-[11.5px] font-medium text-ink-3">{groupTasks.length}</span>
								</button>
							</h3>
							{isFinal && onCleanup && <CleanupButton onClick={onCleanup} />}
						</div>
						{isOpen && (
							<ul id={listId}>
								{groupTasks.map((task) => (
									<TaskRow
										key={task.id}
										task={task}
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
	statuses: string[];
	priorities?: string[];
	projects?: string[];
	idWidth: string;
	dateFormat?: string;
	onEditTask: (task: Task) => void;
}

/**
 * One task: priority, ID, status and title, then its details. When the list is narrow, the details move to a second
 * line instead of squeezing the title.
 */
function TaskRow({ task, statuses, priorities, projects, idWidth, dateFormat, onEditTask }: TaskRowProps) {
	const [firstAssignee, ...otherAssignees] = task.assignee;

	return (
		// The title button is the keyboard and screen reader path to the task; a click anywhere else on the row is a
		// shortcut for the mouse.
		<li
			onClick={() => onEditTask(task)}
			className="grid cursor-pointer grid-cols-[14px_auto_14px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 border-t border-line-soft panel-gutter py-2.5 transition-colors duration-200 hover:bg-hover @4xl:grid-cols-[14px_auto_14px_minmax(0,1fr)_auto] @4xl:py-2"
		>
			<PriorityBars priority={task.priority} priorities={priorities} />
			<span className="font-mono text-xs font-medium text-ink-3" style={{ width: idWidth }}>
				{task.id}
			</span>
			<StatusMark status={task.status} statuses={statuses} />
			<button
				type="button"
				onClick={(event) => {
					event.stopPropagation();
					onEditTask(task);
				}}
				title={task.title}
				aria-label={`Open ${task.id}: ${task.title}`}
				className="min-w-0 truncate rounded-[4px] text-left text-sm font-medium text-ink focus-ring"
			>
				{task.title}
			</button>
			<div className="col-start-2 col-end-[-1] flex flex-wrap items-center gap-x-3 gap-y-1 @4xl:col-start-auto @4xl:col-end-auto @4xl:flex-nowrap @4xl:justify-end">
				<div className="flex min-w-0 flex-wrap items-center gap-1.5 @4xl:flex-nowrap @4xl:justify-end">
					{task.branch && <TaskBranch branch={task.branch} />}
					{task.dueDate && (
						<span className="whitespace-nowrap text-xs text-ink-2">
							Due <StoredDate value={task.dueDate} dateFormat={dateFormat} />
						</span>
					)}
					<TaskTags task={task} projects={projects} />
				</div>
				<span className="flex items-center empty:hidden @4xl:w-16 @4xl:empty:block">
					<AcceptanceCriteriaProgress task={task} density="list" />
				</span>
				<span
					className="min-w-0 truncate font-mono text-xs text-ink-2 empty:hidden @4xl:w-[6.5rem] @4xl:empty:block"
					title={task.assignee.join(", ")}
				>
					{firstAssignee}
					{otherAssignees.length > 0 && <span className="text-ink-3"> +{otherAssignees.length}</span>}
				</span>
				<span className="whitespace-nowrap text-xs text-ink-3 @4xl:w-20 @4xl:text-right">
					<span className="sr-only">Updated </span>
					<StoredDate value={task.updatedDate || task.createdDate} dateFormat={dateFormat} compact />
				</span>
			</div>
		</li>
	);
}
