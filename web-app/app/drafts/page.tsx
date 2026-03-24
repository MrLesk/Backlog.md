"use client";

import React, { useEffect, useState } from "react";
import type { Task } from "@/types";
import { apiClient } from "@/lib/api";
import { useAppContext } from "@/contexts/AppContext";

export default function DraftsPage() {
	const { openEditTask, openNewTask, refreshData } = useAppContext();
	const [drafts, setDrafts] = useState<Task[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const loadDrafts = async () => {
		setIsLoading(true);
		try {
			const data = await apiClient.fetchDrafts();
			setDrafts(data);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		loadDrafts();
	}, []);

	const handlePromote = async (task: Task) => {
		await apiClient.updateTask(task.id, { isDraft: false, status: "To Do" });
		await loadDrafts();
		await refreshData();
	};

	const handleArchive = async (task: Task) => {
		if (!window.confirm(`Archive "${task.title}"?`)) return;
		await apiClient.archiveTask(task.id);
		await loadDrafts();
		await refreshData();
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Drafts</h2>
				<button
					onClick={() => openNewTask(true)}
					className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 transition-colors cursor-pointer"
				>
					+ New Draft
				</button>
			</div>

			{isLoading ? (
				<div className="text-center py-12 text-gray-500">Loading…</div>
			) : drafts.length === 0 ? (
				<div className="text-center py-12 text-gray-500 dark:text-gray-400">
					No drafts. Drafts are tasks in progress of being defined before adding to the board.
				</div>
			) : (
				<div className="space-y-3">
					{drafts.map((task) => (
						<div
							key={task.id}
							className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-start justify-between gap-4"
						>
							<div className="flex-1 cursor-pointer" onClick={() => openEditTask(task)}>
								<div className="flex items-center gap-2 mb-1">
									<span className="text-xs font-mono text-gray-500 dark:text-gray-400">
										{task.id.replace("task-", "TASK-")}
									</span>
									{task.priority && (
										<span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
											{task.priority}
										</span>
									)}
								</div>
								<h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</h3>
								{task.description && (
									<p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
										{task.description}
									</p>
								)}
							</div>
							<div className="flex gap-2 flex-shrink-0">
								<button
									onClick={() => handlePromote(task)}
									title="Move to board"
									className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
								>
									Promote
								</button>
								<button
									onClick={() => handleArchive(task)}
									title="Archive draft"
									className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
								>
									Archive
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
