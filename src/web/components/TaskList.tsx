import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "../lib/api";
import type {
	Milestone,
	SearchPriorityFilter,
	Task,
	TaskSearchResult,
} from "../../types";
import { collectAvailableLabels } from "../../utils/label-filter.ts";
import { getMilestoneLabel } from "../utils/milestones";
import CleanupModal from "./CleanupModal";
import { SuccessToast } from "./SuccessToast";

interface TaskListProps {
	onEditTask: (task: Task) => void;
	onNewTask: () => void;
	tasks: Task[];
	availableStatuses: string[];
	availableLabels: string[];
	availableMilestones: string[];
	milestoneEntities: Milestone[];
	onRefreshData?: () => Promise<void>;
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

const TaskList: React.FC<TaskListProps> = ({
	onEditTask,
	onNewTask,
	tasks,
	availableStatuses,
	availableLabels,
	availableMilestones,
	milestoneEntities,
	onRefreshData,
}) => {
	const [searchParams, setSearchParams] = useSearchParams();
	const [searchValue, setSearchValue] = useState(() => searchParams.get("query") ?? "");
	const [statusFilter, setStatusFilter] = useState<string[]>(() => {
		const raw = searchParams.get("status") ?? "";
		return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
	});
	const [priorityFilter, setPriorityFilter] = useState<"" | SearchPriorityFilter>(
		() => (searchParams.get("priority") as SearchPriorityFilter | null) ?? "",
	);
	const [milestoneFilter, setMilestoneFilter] = useState(() => searchParams.get("milestone") ?? "");
	const initialLabelParams = useMemo(() => {
		const labels = [...searchParams.getAll("label"), ...searchParams.getAll("labels")];
		const labelsCsv = searchParams.get("labels");
		if (labelsCsv) labels.push(...labelsCsv.split(","));
		return labels.map((label) => label.trim()).filter((label) => label.length > 0);
	}, []);
	const [labelFilter, setLabelFilter] = useState<string[]>(initialLabelParams);
	const [displayTasks, setDisplayTasks] = useState<Task[]>(() => sortTasksByIdDescending(tasks));
	const [error, setError] = useState<string | null>(null);
	const [showCleanupModal, setShowCleanupModal] = useState(false);
	const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState<string | null>(null);
	const [showStatusMenu, setShowStatusMenu] = useState(false);
	const statusButtonRef = useRef<HTMLButtonElement | null>(null);
	const statusMenuRef = useRef<HTMLDivElement | null>(null);
	const [showLabelsMenu, setShowLabelsMenu] = useState(false);
	const labelsButtonRef = useRef<HTMLButtonElement | null>(null);
	const labelsMenuRef = useRef<HTMLDivElement | null>(null);

	const sortedBaseTasks = useMemo(() => sortTasksByIdDescending(tasks), [tasks]);
	const mergedAvailableLabels = useMemo(
		() => collectAvailableLabels(tasks, availableLabels),
		[tasks, availableLabels],
	);
	const milestoneOptions = useMemo(() => {
		const uniqueMilestones = Array.from(new Set([...availableMilestones.map((m) => m.trim()).filter(Boolean)]));
		return uniqueMilestones;
	}, [availableMilestones]);
	const normalizedSearch = searchValue.trim();
	const hasActiveFilters = Boolean(
		normalizedSearch || statusFilter.length > 0 || priorityFilter || labelFilter.length > 0 || milestoneFilter,
	);
	const totalTasks = sortedBaseTasks.length;

	useEffect(() => {
		const paramQuery = searchParams.get("query") ?? "";
		const paramStatusRaw = searchParams.get("status") ?? "";
		const paramStatus = paramStatusRaw ? paramStatusRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
		const paramPriority = (searchParams.get("priority") as SearchPriorityFilter | null) ?? "";
		const paramMilestone = searchParams.get("milestone") ?? "";
		const paramLabels = [...searchParams.getAll("label"), ...searchParams.getAll("labels")];
		const labelsCsv = searchParams.get("labels");
		if (labelsCsv) {
			paramLabels.push(...labelsCsv.split(","));
		}
		const normalizedLabels = paramLabels.map((label) => label.trim()).filter((label) => label.length > 0);

		if (paramQuery !== searchValue) {
			setSearchValue(paramQuery);
		}
		if (paramStatus.join("|") !== statusFilter.join("|")) {
			setStatusFilter(paramStatus);
		}
		if (paramPriority !== priorityFilter) {
			setPriorityFilter(paramPriority);
		}
		if (paramMilestone !== milestoneFilter) {
			setMilestoneFilter(paramMilestone);
		}
		if (normalizedLabels.join("|") !== labelFilter.join("|")) {
			setLabelFilter(normalizedLabels);
		}
	}, [searchParams]);

	useEffect(() => {
		if (!hasActiveFilters) {
			setDisplayTasks(sortedBaseTasks);
			setError(null);
		}
	}, [hasActiveFilters, sortedBaseTasks]);

	useEffect(() => {
		const normalizeMilestone = (value: string) => value.trim();
		const filterByMilestone = (list: Task[]): Task[] => {
			const normalized = normalizeMilestone(milestoneFilter);
			if (!normalized) return list;
			if (normalized === "__none") return list.filter((task) => !task.milestone || task.milestone.trim() === "");
			return list.filter((task) => task.milestone?.trim() === normalized);
		};

		const shouldUseApi =
			Boolean(normalizedSearch) || statusFilter.length > 0 || Boolean(priorityFilter) || labelFilter.length > 0;

		if (!hasActiveFilters) {
			return;
		}

		let cancelled = false;
		setError(null);

		const fetchFilteredTasks = async () => {
			// If only milestone filter is active, filter locally to avoid an extra request
			if (!shouldUseApi) {
				setDisplayTasks(filterByMilestone(sortedBaseTasks));
				return;
			}
			try {
				const results = await apiClient.search({
					query: normalizedSearch || undefined,
					types: ["task"],
					status: statusFilter.length > 0 ? statusFilter.join(",") : undefined,
					priority: (priorityFilter || undefined) as SearchPriorityFilter | undefined,
					labels: labelFilter.length > 0 ? labelFilter : undefined,
				});
				if (cancelled) {
					return;
				}
				const taskResults = results.filter((result): result is TaskSearchResult => result.type === "task");
				const filtered = filterByMilestone(taskResults.map((result) => result.task));
				setDisplayTasks(sortTasksByIdDescending(filtered));
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
	}, [hasActiveFilters, normalizedSearch, priorityFilter, statusFilter, labelFilter, tasks, milestoneFilter, sortedBaseTasks]);

	const syncUrl = (
		nextQuery: string,
		nextStatus: string[],
		nextPriority: "" | SearchPriorityFilter,
		nextLabels: string[],
		nextMilestone: string,
	) => {
		const params = new URLSearchParams();
		const trimmedQuery = nextQuery.trim();
		if (trimmedQuery) {
			params.set("query", trimmedQuery);
		}
		if (nextStatus.length > 0) {
			params.set("status", nextStatus.join(","));
		}
		if (nextPriority) {
			params.set("priority", nextPriority);
		}
		if (nextLabels.length > 0) {
			for (const label of nextLabels) {
				params.append("label", label);
			}
		}
		if (nextMilestone) {
			params.set("milestone", nextMilestone);
		}
		setSearchParams(params, { replace: true });
	};

	const handleSearchChange = (value: string) => {
		setSearchValue(value);
		syncUrl(value, statusFilter, priorityFilter, labelFilter, milestoneFilter);
	};

	const handleStatusChange = (next: string[]) => {
		setStatusFilter(next);
		syncUrl(searchValue, next, priorityFilter, labelFilter, milestoneFilter);
	};

	const handlePriorityChange = (value: "" | SearchPriorityFilter) => {
		setPriorityFilter(value);
		syncUrl(searchValue, statusFilter, value, labelFilter, milestoneFilter);
	};

	const handleLabelChange = (next: string[]) => {
		const normalized = next.map((label) => label.trim()).filter((label) => label.length > 0);
		setLabelFilter(normalized);
		syncUrl(searchValue, statusFilter, priorityFilter, normalized, milestoneFilter);
	};

	const handleMilestoneChange = (value: string) => {
		setMilestoneFilter(value);
		syncUrl(searchValue, statusFilter, priorityFilter, labelFilter, value);
	};

	const handleClearFilters = () => {
		setSearchValue("");
		setStatusFilter([]);
		setPriorityFilter("");
		setLabelFilter([]);
		setMilestoneFilter("");
		syncUrl("", [], "", [], "");
		setDisplayTasks(sortedBaseTasks);
		setError(null);
	};

	useEffect(() => {
		if (!showStatusMenu) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				statusButtonRef.current &&
				statusMenuRef.current &&
				!statusButtonRef.current.contains(target) &&
				!statusMenuRef.current.contains(target)
			) {
				setShowStatusMenu(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showStatusMenu]);

	useEffect(() => {
		if (!showLabelsMenu) return;
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				labelsButtonRef.current &&
				labelsMenuRef.current &&
				!labelsButtonRef.current.contains(target) &&
				!labelsMenuRef.current.contains(target)
			) {
				setShowLabelsMenu(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showLabelsMenu]);

	const handleCleanupSuccess = async (movedCount: number) => {
		setShowCleanupModal(false);
		setCleanupSuccessMessage(`Successfully moved ${movedCount} task${movedCount !== 1 ? 's' : ''} to completed folder`);

		// Refresh the data - existing effects will handle re-filtering automatically
		if (onRefreshData) {
			await onRefreshData();
		}

		// Auto-dismiss success message after 4 seconds
		setTimeout(() => {
			setCleanupSuccessMessage(null);
		}, 4000);
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
				<div className="flex items-center justify-between gap-3">
						<h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Tasks</h1>
						<button
							className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 dark:focus:ring-offset-gray-900 transition-colors duration-200"
							onClick={onNewTask}
						>
							+ New Task
					</button>
				</div>

				<div className="flex flex-wrap items-center gap-3 justify-between">
					<div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
						<div className="relative flex-1 basis-[200px] min-w-[180px] max-w-[280px]">
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
									className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
								>
									<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						)}
						</div>

					<div className="relative">
						<button
							type="button"
							ref={statusButtonRef}
							onClick={() => setShowStatusMenu((open) => !open)}
							className="min-w-[140px] h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200 text-left"
						>
							<div className="flex items-center justify-between gap-2">
								<span>Status</span>
								<span className="text-xs text-gray-500 dark:text-gray-400">
									{statusFilter.length === 0
										? "All"
										: statusFilter.length === 1
											? statusFilter[0]
											: `${statusFilter.length} selected`}
								</span>
							</div>
						</button>
						{showStatusMenu && (
							<div
								ref={statusMenuRef}
								className="absolute z-10 mt-2 w-[200px] max-h-56 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
							>
								{availableStatuses.length === 0 ? (
									<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No statuses</div>
								) : (
									availableStatuses.map((status) => {
										const isSelected = statusFilter.includes(status);
										return (
											<label
												key={status}
												className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
											>
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => {
														const next = isSelected
															? statusFilter.filter((item) => item !== status)
															: [...statusFilter, status];
														handleStatusChange(next);
													}}
													className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
												/>
												<span className="truncate">{status}</span>
											</label>
										);
									})
								)}
								{statusFilter.length > 0 && (
									<button
										type="button"
										className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-t border-gray-200 dark:border-gray-700"
										onClick={() => {
											handleStatusChange([]);
											setShowStatusMenu(false);
										}}
									>
										Clear status filter
									</button>
								)}
							</div>
						)}
					</div>

					<select
						value={priorityFilter}
						onChange={(event) => handlePriorityChange(event.target.value as "" | SearchPriorityFilter)}
						className="min-w-[140px] h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
					>
						{PRIORITY_OPTIONS.map((option) => (
							<option key={option.value || "all"} value={option.value}>
								{option.label}
							</option>
						))}
					</select>

					<select
						value={milestoneFilter}
						onChange={(event) => handleMilestoneChange(event.target.value)}
						className="min-w-[160px] h-10 py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200"
					>
						<option value="">All milestones</option>
						<option value="__none">No milestone</option>
						{milestoneOptions.map((milestone) => (
							<option key={milestone} value={milestone}>
								{getMilestoneLabel(milestone, milestoneEntities)}
							</option>
						))}
					</select>

					<div className="relative">
						<button
							type="button"
							ref={labelsButtonRef}
							onClick={() => setShowLabelsMenu((open) => !open)}
							className="min-w-[200px] py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 transition-colors duration-200 text-left"
						>
							<div className="flex items-center justify-between gap-2">
								<span>Labels</span>
								<span className="text-xs text-gray-500 dark:text-gray-400">
									{labelFilter.length === 0
										? "All"
										: labelFilter.length === 1
											? labelFilter[0]
											: `${labelFilter.length} selected`}
								</span>
							</div>
						</button>
						{showLabelsMenu && (
							<div
								ref={labelsMenuRef}
								className="absolute z-10 mt-2 w-[220px] max-h-56 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg"
							>
								{mergedAvailableLabels.length === 0 ? (
									<div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No labels</div>
								) : (
									mergedAvailableLabels.map((label) => {
										const isSelected = labelFilter.includes(label);
										return (
											<label
												key={label}
												className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
											>
												<input
													type="checkbox"
													checked={isSelected}
													onChange={() => {
														const next = isSelected
															? labelFilter.filter((item) => item !== label)
															: [...labelFilter, label];
														handleLabelChange(next);
													}}
													className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
												/>
												<span className="truncate">{label}</span>
											</label>
										);
									})
								)}
								{labelFilter.length > 0 && (
									<button
										type="button"
										className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-t border-gray-200 dark:border-gray-700"
										onClick={() => {
											handleLabelChange([]);
											setShowLabelsMenu(false);
										}}
									>
										Clear label filter
									</button>
								)}
							</div>
						)}
					</div>

					</div>

					<div className="flex items-center gap-3 flex-shrink-0">
						{statusFilter.length === 1 && statusFilter[0].toLowerCase() === 'done' && displayTasks.length > 0 && (
								<button
									type="button"
									onClick={() => setShowCleanupModal(true)}
									className="py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center gap-2 whitespace-nowrap"
									title="Clean up old completed tasks"
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
								Clean Up
							</button>
						)}

							<div className="relative">
								<button
									type="button"
									onClick={hasActiveFilters ? handleClearFilters : undefined}
									className="py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg whitespace-nowrap transition-colors duration-200 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
									style={{ visibility: hasActiveFilters ? "visible" : "hidden" }}
									aria-hidden={!hasActiveFilters}
								>
									Clear filters
							</button>
						</div>

						<div className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap text-right min-w-[170px]">
							Showing {currentCount} of {totalTasks} tasks
						</div>
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
					{displayTasks.map((task) => {
						const isFromOtherBranch = Boolean(task.branch);
						return (
						<div
							key={task.id}
							className={`bg-white dark:bg-gray-800 border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer ${
								isFromOtherBranch 
									? 'border-amber-300 dark:border-amber-700 opacity-75' 
									: 'border-gray-200 dark:border-gray-700'
							}`}
							onClick={() => onEditTask(task)}
						>
							{/* Cross-branch indicator banner */}
							{isFromOtherBranch && (
								<div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 -mx-1 -mt-1 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 rounded-t text-xs text-amber-700 dark:text-amber-300">
									<svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
									</svg>
									<span>
										Read-only: From <span className="font-semibold">{task.branch}</span> branch
									</span>
								</div>
							)}
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<div className="flex items-center space-x-3 mb-2">
										<h3 className={`text-lg font-medium ${isFromOtherBranch ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>{task.title}</h3>
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
					)})}
				</div>
			)}

			{/* Cleanup Modal */}
			<CleanupModal
				isOpen={showCleanupModal}
				onClose={() => setShowCleanupModal(false)}
				onSuccess={handleCleanupSuccess}
			/>

			{/* Cleanup Success Toast */}
			{cleanupSuccessMessage && (
				<SuccessToast
					message={cleanupSuccessMessage}
					onDismiss={() => setCleanupSuccessMessage(null)}
					icon={
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					}
				/>
			)}
		</div>
	);
};

export default TaskList;
