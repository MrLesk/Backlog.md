import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "../lib/api";
import type {
	SearchPriorityFilter,
	Task,
	TaskSearchResult,
} from "../../types";

interface TaskListProps {
	onEditTask: (task: Task) => void;
	onNewTask: () => void;
	tasks: Task[];
	availableStatuses: string[];
}

const PRIORITY_OPTIONS: Array<{ label: string; value: "" | SearchPriorityFilter }> = [
	{ label: "All priorities", value: "" },
	{ label: "High", value: "high" },
	{ label: "Medium", value: "medium" },
	{ label: "Low", value: "low" },
];

function sortTasksByIdDescending(list: Task[]): Task[] {
	return [...list].sort((a, b) => {
		const idA = Number.parseInt(a.id.replace("task-", ""), 10);
		const idB = Number.parseInt(b.id.replace("task-", ""), 10);
		return idB - idA;
	});
}

const TaskList: React.FC<TaskListProps> = ({ onEditTask, onNewTask, tasks, availableStatuses }) => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [searchValue, setSearchValue] = useState(() => searchParams.get("query") ?? "");
	const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");
	const [priorityFilter, setPriorityFilter] = useState<"" | SearchPriorityFilter>(
		() => (searchParams.get("priority") as SearchPriorityFilter | null) ?? "",
	);
	const [displayTasks, setDisplayTasks] = useState<Task[]>(() => sortTasksByIdDescending(tasks));
	const [error, setError] = useState<string | null>(null);

	const sortedBaseTasks = useMemo(() => sortTasksByIdDescending(tasks), [tasks]);
	const normalizedSearch = searchValue.trim();
	const hasActiveFilters = Boolean(normalizedSearch || statusFilter || priorityFilter);
	const totalTasks = sortedBaseTasks.length;

	useEffect(() => {
		const paramQuery = searchParams.get("query") ?? "";
		const paramStatus = searchParams.get("status") ?? "";
		const paramPriority = (searchParams.get("priority") as SearchPriorityFilter | null) ?? "";

		if (paramQuery !== searchValue) {
			setSearchValue(paramQuery);
		}
		if (paramStatus !== statusFilter) {
			setStatusFilter(paramStatus);
		}
		if (paramPriority !== priorityFilter) {
			setPriorityFilter(paramPriority);
		}
	}, [searchParams]);

	useEffect(() => {
		if (!hasActiveFilters) {
			setDisplayTasks(sortedBaseTasks);
			setError(null);
		}
	}, [hasActiveFilters, sortedBaseTasks]);

	useEffect(() => {
		if (!hasActiveFilters) {
			return;
		}

		let cancelled = false;
		setError(null);

		const fetchFilteredTasks = async () => {
			try {
				const results = await apiClient.search({
					query: normalizedSearch || undefined,
					types: ["task"],
					status: statusFilter || undefined,
					priority: (priorityFilter || undefined) as SearchPriorityFilter | undefined,
				});
				if (cancelled) {
					return;
				}
				const taskResults = results.filter((result): result is TaskSearchResult => result.type === "task");
				setDisplayTasks(sortTasksByIdDescending(taskResults.map((result) => result.task)));
			} catch (err) {
				console.error("Failed to apply task filters:", err);
				if (!cancelled) {
					setDisplayTasks([]);
					setError("Unable to fetch tasks for the selected filters.");
				}
			}
		};

		fetchFilteredTasks();

		return () => {
			cancelled = true;
		};
	}, [hasActiveFilters, normalizedSearch, priorityFilter, statusFilter]);

	const syncUrl = (nextQuery: string, nextStatus: string, nextPriority: "" | SearchPriorityFilter) => {
		const params = new URLSearchParams();
		const trimmedQuery = nextQuery.trim();
		if (trimmedQuery) {
			params.set("query", trimmedQuery);
		}
		if (nextStatus) {
			params.set("status", nextStatus);
		}
		if (nextPriority) {
			params.set("priority", nextPriority);
		}
		setSearchParams(params, { replace: true });
	};

	const handleSearchChange = (value: string) => {
		setSearchValue(value);
		syncUrl(value, statusFilter, priorityFilter);
	};

	const handleStatusChange = (value: string) => {
		setStatusFilter(value);
		syncUrl(searchValue, value, priorityFilter);
	};

	const handlePriorityChange = (value: "" | SearchPriorityFilter) => {
		setPriorityFilter(value);
		syncUrl(searchValue, statusFilter, value);
	};

	const handleClearFilters = () => {
		setSearchValue("");
		setStatusFilter("");
		setPriorityFilter("");
		syncUrl("", "", "");
		setDisplayTasks(sortedBaseTasks);
		setError(null);
	};

	const getStatusColor = (status: string) => {
		switch (status.toLowerCase()) {
			case "to do":
				return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
			case "in progress":
				return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200";
			case "done":
				return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
		}
	};

	const getPriorityColor = (priority?: string) => {
		switch (priority?.toLowerCase()) {
			case "high":
				return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200";
			case "medium":
				return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200";
			case "low":
				return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200";
			default:
				return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
		}
	};

	const currentCount = displayTasks.length;

	return (
		<div className="container mx-auto px-4 py-8 transition-colors duration-200">
			<div className="flex flex-col gap-4 mb-6">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Tasks</h1>
					<button
						className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer"
						onClick={onNewTask}
					>
						+ New Task
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<div className="relative flex-1 min-w-[220px]">
						<span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
							<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						</span>
						<input
							type="text"
							value={searchValue}
							onChange={(event) => handleSearchChange(event.target.value)}
							placeholder="Search tasks"
							className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200"
						/>
						{searchValue && (
							<button
								type="button"
								onClick={() => handleSearchChange("")}
								className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
							>
								<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						)}
					</div>

					<select
						value={statusFilter}
						onChange={(event) => handleStatusChange(event.target.value)}
						className="min-w-[160px] py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
					>
						<option value="">All statuses</option>
						{availableStatuses.map((status) => (
							<option key={status} value={status}>
								{status}
							</option>
						))}
					</select>

					<select
						value={priorityFilter}
						onChange={(event) => handlePriorityChange(event.target.value as "" | SearchPriorityFilter)}
						className="min-w-[160px] py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
					>
						{PRIORITY_OPTIONS.map((option) => (
							<option key={option.value || "all"} value={option.value}>
								{option.label}
							</option>
						))}
					</select>

					{hasActiveFilters && (
						<button
							type="button"
							onClick={handleClearFilters}
							className="py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
						>
							Clear filters
						</button>
					)}

					<div className="ml-auto text-sm text-gray-600 dark:text-gray-300">
						Showing {currentCount} of {totalTasks} tasks
					</div>
				</div>

				{error && (
					<div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
						{error}
					</div>
				)}
			</div>

			{displayTasks.length === 0 ? (
				<div className="text-center py-12">
					<svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
					</svg>
					<h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
						{hasActiveFilters ? "No tasks match the current filters" : "No tasks"}
					</h3>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{hasActiveFilters
							? "Try adjusting your search or clearing filters to see more tasks."
							: "Get started by creating a new task."}
					</p>
				</div>
			) : (
				<div className="space-y-4">
					{displayTasks.map((task) => (
						<div
							key={task.id}
							className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
							onClick={() => onEditTask(task)}
						>
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-center space-x-3 mb-2">
										<h3 className="text-lg font-medium text-gray-900 dark:text-white">{task.title}</h3>
										<span className={`px-2 py-1 text-xs font-medium rounded-circle ${getStatusColor(task.status)}`}>
											{task.status}
										</span>
										{task.priority && (
											<span className={`px-2 py-1 text-xs font-medium rounded-circle ${getPriorityColor(task.priority)}`}>
												{task.priority}
											</span>
										)}
									</div>
									<div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
										<span>{task.id}</span>
										<span>Created: {new Date(task.createdDate).toLocaleDateString()}</span>
										{task.updatedDate && (
											<span>Updated: {new Date(task.updatedDate).toLocaleDateString()}</span>
										)}
									</div>
									{task.assignee && task.assignee.length > 0 && (
										<div className="flex items-center space-x-2 mb-2">
											<span className="text-sm text-gray-500 dark:text-gray-400">Assigned to:</span>
											<div className="flex flex-wrap gap-1">
												{task.assignee.map((person) => (
													<span key={person} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded-circle">
														{person}
													</span>
												))}
											</div>
										</div>
									)}
									{task.labels && task.labels.length > 0 && (
										<div className="flex flex-wrap gap-1">
											{task.labels.map((label) => (
												<span key={label} className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-circle">
													{label}
												</span>
											))}
										</div>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default TaskList;
