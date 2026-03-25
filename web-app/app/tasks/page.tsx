"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Task } from "@/types";
import { apiClient } from "@/lib/api";
import { useAppContext } from "@/contexts/AppContext";
import CleanupModal from "@/components/CleanupModal";
import { SuccessToast } from "@/components/SuccessToast";

const PRIORITY_OPTIONS = [
	{ label: "All priorities", value: "" },
	{ label: "High", value: "high" },
	{ label: "Medium", value: "medium" },
	{ label: "Low", value: "low" },
] as const;

function sortByIdDesc(list: Task[]): Task[] {
	return [...list].sort((a, b) => {
		const idA = parseInt(a.id.replace("task-", ""), 10);
		const idB = parseInt(b.id.replace("task-", ""), 10);
		return idB - idA;
	});
}

function TasksPageInner() {
	const { tasks, config, isLoading, refreshData, openEditTask, openNewTask } = useAppContext();
	const searchParams = useSearchParams();
	const router = useRouter();

	const [searchValue, setSearchValue] = useState(() => searchParams.get("query") ?? "");
	const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "");
	const [priorityFilter, setPriorityFilter] = useState<string>(
		() => searchParams.get("priority") ?? "",
	);
	const [labelFilter, setLabelFilter] = useState<string[]>(() =>
		searchParams.getAll("label").filter(Boolean),
	);
	const [displayTasks, setDisplayTasks] = useState<Task[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [showCleanupModal, setShowCleanupModal] = useState(false);
	const [cleanupSuccessMessage, setCleanupSuccessMessage] = useState<string | null>(null);
	const [showLabelsMenu, setShowLabelsMenu] = useState(false);
	const labelsButtonRef = useRef<HTMLButtonElement | null>(null);

	const sortedBase = useMemo(() => sortByIdDesc(tasks), [tasks]);

	const hasFilters = Boolean(
		searchValue.trim() || statusFilter || priorityFilter || labelFilter.length > 0,
	);

	// Collect available labels from tasks + config
	const availableLabels = useMemo(() => {
		const fromTasks = tasks.flatMap((t) => t.labels ?? []);
		const fromConfig = config.labels ?? [];
		return [...new Set([...fromConfig, ...fromTasks])].sort();
	}, [tasks, config.labels]);

	// Apply filters / search
	useEffect(() => {
		if (!hasFilters) {
			setDisplayTasks(sortedBase);
			setError(null);
			return;
		}
		let cancelled = false;
		setError(null);

		const run = async () => {
			try {
				const q = searchValue.trim();
				let results = q ? await apiClient.search(q) : [...sortedBase];
				if (statusFilter) results = results.filter((t) => t.status === statusFilter);
				if (priorityFilter) results = results.filter((t) => t.priority === priorityFilter);
				if (labelFilter.length > 0)
					results = results.filter((t) =>
						labelFilter.every((l) => (t.labels ?? []).includes(l)),
					);
				if (!cancelled) setDisplayTasks(sortByIdDesc(results));
			} catch (err) {
				if (!cancelled) {
					setError("Failed to apply filters.");
					setDisplayTasks([]);
				}
			}
		};
		run();
		return () => {
			cancelled = true;
		};
	}, [hasFilters, searchValue, statusFilter, priorityFilter, labelFilter, sortedBase]);

	const syncUrl = (query: string, status: string, priority: string, labels: string[]) => {
		const params = new URLSearchParams();
		if (query.trim()) params.set("query", query.trim());
		if (status) params.set("status", status);
		if (priority) params.set("priority", priority);
		for (const l of labels) params.append("label", l);
		router.replace(`/tasks?${params.toString()}`, { scroll: false });
	};

	const setSearch = (v: string) => {
		setSearchValue(v);
		syncUrl(v, statusFilter, priorityFilter, labelFilter);
	};
	const setStatus = (v: string) => {
		setStatusFilter(v);
		syncUrl(searchValue, v, priorityFilter, labelFilter);
	};
	const setPriority = (v: string) => {
		setPriorityFilter(v);
		syncUrl(searchValue, statusFilter, v, labelFilter);
	};
	const toggleLabel = (l: string) => {
		const next = labelFilter.includes(l) ? labelFilter.filter((x) => x !== l) : [...labelFilter, l];
		setLabelFilter(next);
		syncUrl(searchValue, statusFilter, priorityFilter, next);
	};
	const clearFilters = () => {
		setSearchValue("");
		setStatusFilter("");
		setPriorityFilter("");
		setLabelFilter([]);
		router.replace("/tasks", { scroll: false });
		setDisplayTasks(sortedBase);
	};

	const handleCleanupSuccess = async (count: number) => {
		setShowCleanupModal(false);
		setCleanupSuccessMessage(`Archived ${count} task${count !== 1 ? "s" : ""}`);
		await refreshData();
		setTimeout(() => setCleanupSuccessMessage(null), 4000);
	};

	const priorityColor: Record<string, string> = {
		high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
		medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
		low: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">All Tasks</h2>
				<button
					onClick={() => openNewTask()}
					className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors cursor-pointer"
				>
					+ New Task
				</button>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
				<input
					type="text"
					placeholder="Search tasks…"
					value={searchValue}
					onChange={(e) => setSearch(e.target.value)}
					className="flex-1 min-w-40 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
				/>
				<select
					value={statusFilter}
					onChange={(e) => setStatus(e.target.value)}
					className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
				>
					<option value="">All statuses</option>
					{config.statuses.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
				<select
					value={priorityFilter}
					onChange={(e) => setPriority(e.target.value)}
					className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
				>
					{PRIORITY_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
				{availableLabels.length > 0 && (
					<div className="relative">
						<button
							ref={labelsButtonRef}
							onClick={() => setShowLabelsMenu((o) => !o)}
							className={`px-3 py-1.5 border rounded-md text-sm transition-colors cursor-pointer ${
								labelFilter.length > 0
									? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
									: "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
							}`}
						>
							Labels {labelFilter.length > 0 && `(${labelFilter.length})`}
						</button>
						{showLabelsMenu && (
							<div className="absolute left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 min-w-40 max-h-60 overflow-y-auto p-1">
								{availableLabels.map((l) => (
									<button
										key={l}
										onClick={() => toggleLabel(l)}
										className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors cursor-pointer ${
											labelFilter.includes(l)
												? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
												: "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
										}`}
									>
										{l}
									</button>
								))}
							</div>
						)}
					</div>
				)}
				{hasFilters && (
					<button
						onClick={clearFilters}
						className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
					>
						Clear
					</button>
				)}
				<span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
					{displayTasks.length} task{displayTasks.length !== 1 ? "s" : ""}
				</span>
			</div>

			{error && (
				<div className="text-sm text-red-600 dark:text-red-400 px-1">{error}</div>
			)}

			{/* Task Table */}
			{isLoading ? (
				<div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading…</div>
			) : displayTasks.length === 0 ? (
				<div className="text-center py-12 text-gray-500 dark:text-gray-400">
					{hasFilters ? "No tasks match the current filters." : "No tasks yet. Create one!"}
				</div>
			) : (
				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead className="bg-gray-50 dark:bg-gray-900/50">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
									ID
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Title
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
									Status
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
									Priority
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
									Labels
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
									Assignee
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
							{displayTasks.map((task) => (
								<tr
									key={task.id}
									className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
									onClick={() => openEditTask(task)}
								>
									<td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
										{task.id.replace("task-", "TASK-")}
									</td>
									<td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 max-w-sm truncate">
										{task.title}
									</td>
									<td className="px-4 py-3">
										<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
											{task.status}
										</span>
									</td>
									<td className="px-4 py-3">
										{task.priority && (
											<span
												className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityColor[task.priority] ?? ""}`}
											>
												{task.priority}
											</span>
										)}
									</td>
									<td className="px-4 py-3">
										<div className="flex flex-wrap gap-1">
											{(task.labels ?? []).map((l) => (
												<span
													key={l}
													className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
												>
													{l}
												</span>
											))}
										</div>
									</td>
									<td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
										{(task.assignee ?? []).join(", ")}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<CleanupModal
				isOpen={showCleanupModal}
				onClose={() => setShowCleanupModal(false)}
				onSuccess={handleCleanupSuccess}
			/>

			{cleanupSuccessMessage && (
				<SuccessToast
					message={cleanupSuccessMessage}
					onDismiss={() => setCleanupSuccessMessage(null)}
				/>
			)}
		</div>
	);
}

export default function TasksPage() {
	return (
		<Suspense fallback={null}>
			<TasksPageInner />
		</Suspense>
	);
}
