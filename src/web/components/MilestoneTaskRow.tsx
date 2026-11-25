import React from "react";
import type { Task } from "../../types";
import TaskLink from "./TaskLink";

interface MilestoneTaskRowProps {
	task: Task;
	isDone: boolean;
	statusBadgeClass: string;
	priorityBadgeClass: string;
	drag?: {
		start: (event: React.DragEvent, task: Task) => void;
		end: (event: React.DragEvent) => void;
	};
}

const DragHandle = () => (
	<svg className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" viewBox="0 0 24 24" fill="currentColor">
		<circle cx="9" cy="6" r="1.5" />
		<circle cx="15" cy="6" r="1.5" />
		<circle cx="9" cy="12" r="1.5" />
		<circle cx="15" cy="12" r="1.5" />
		<circle cx="9" cy="18" r="1.5" />
		<circle cx="15" cy="18" r="1.5" />
	</svg>
);

const MilestoneTaskRow: React.FC<MilestoneTaskRowProps> = ({
	task,
	isDone,
	statusBadgeClass,
	priorityBadgeClass,
	drag,
}) => (
	// A link to the task. Where the milestone can change, the row is also what drags the task to another milestone, so
	// it carries the task's ID instead of the link's address.
	<TaskLink
		task={task}
		draggable={Boolean(drag)}
		onDragStart={drag ? (event) => drag.start(event, task) : undefined}
		onDragEnd={drag?.end}
		className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 md:grid md:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] md:gap-3"
	>
		<span className="flex w-6 justify-center opacity-40 transition-opacity empty:hidden group-hover:opacity-100 md:empty:flex">
			{drag && <DragHandle />}
		</span>

		<span className="font-mono text-xs text-gray-500 dark:text-gray-400 md:w-24">{task.id}</span>

		<span className={`order-first min-w-0 basis-full wrap-anywhere text-sm font-medium md:order-none md:truncate ${isDone ? "text-gray-500 line-through dark:text-gray-400" : "text-gray-900 dark:text-gray-100"}`}>
			{task.title}
		</span>

		<span className="flex max-w-full justify-center md:w-24">
			<span className={`wrap-anywhere rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass}`}>{task.status}</span>
		</span>

		<span className="flex justify-center md:w-20">
			{task.priority ? (
				<span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityBadgeClass}`}>{task.priority}</span>
			) : (
				<span className="hidden text-xs text-gray-300 dark:text-gray-600 md:inline">—</span>
			)}
		</span>
	</TaskLink>
);

export default MilestoneTaskRow;
