"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { apiClient } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
	Accepted: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
	Deprecated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
	Superseded: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
	Proposed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function DecisionsPage() {
	const { decisions, isLoading, refreshData } = useAppContext();
	const [creating, setCreating] = useState(false);
	const [newTitle, setNewTitle] = useState("");

	const handleCreate = async () => {
		if (!newTitle.trim()) return;
		await apiClient.createDecision({ title: newTitle.trim(), status: "Proposed" });
		setNewTitle("");
		setCreating(false);
		await refreshData();
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Decisions</h2>
				<button
					onClick={() => setCreating(true)}
					className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 transition-colors cursor-pointer"
				>
					+ New Decision
				</button>
			</div>

			{creating && (
				<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex gap-3">
					<input
						autoFocus
						type="text"
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleCreate();
							if (e.key === "Escape") {
								setCreating(false);
								setNewTitle("");
							}
						}}
						placeholder="Decision title…"
						className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
					/>
					<button
						onClick={handleCreate}
						className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors cursor-pointer"
					>
						Create
					</button>
					<button
						onClick={() => {
							setCreating(false);
							setNewTitle("");
						}}
						className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer"
					>
						Cancel
					</button>
				</div>
			)}

			{isLoading ? (
				<div className="text-center py-12 text-gray-500">Loading…</div>
			) : decisions.length === 0 ? (
				<div className="text-center py-12 text-gray-500 dark:text-gray-400">
					No decisions yet. Use this to track architectural and technical decisions.
				</div>
			) : (
				<div className="space-y-3">
					{decisions.map((d) => (
						<Link
							key={d.id}
							href={`/decisions/${d.id}`}
							className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex-1">
									<div className="flex items-center gap-2 mb-1">
										<span className="text-xs font-mono text-gray-400 dark:text-gray-500">{d.id}</span>
										{d.status && (
											<span
												className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[d.status] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
											>
												{d.status}
											</span>
										)}
									</div>
									<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{d.title}</h3>
								</div>
								<span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
									{d.createdDate.slice(0, 10)}
								</span>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
