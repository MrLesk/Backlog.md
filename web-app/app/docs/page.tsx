"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { apiClient } from "@/lib/api";

export default function DocsPage() {
	const { docs, isLoading, refreshData } = useAppContext();
	const [creating, setCreating] = useState(false);
	const [newTitle, setNewTitle] = useState("");

	const handleCreate = async () => {
		if (!newTitle.trim()) return;
		await apiClient.createDoc({ title: newTitle.trim() });
		setNewTitle("");
		setCreating(false);
		await refreshData();
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Documents</h2>
				<button
					onClick={() => setCreating(true)}
					className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-md hover:bg-blue-600 transition-colors cursor-pointer"
				>
					+ New Document
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
						placeholder="Document title…"
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
						className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
					>
						Cancel
					</button>
				</div>
			)}

			{isLoading ? (
				<div className="text-center py-12 text-gray-500">Loading…</div>
			) : docs.length === 0 ? (
				<div className="text-center py-12 text-gray-500 dark:text-gray-400">
					No documents yet.
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{docs.map((doc) => (
						<Link
							key={doc.id}
							href={`/docs/${doc.id}`}
							className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
						>
							<div className="flex items-start justify-between mb-2">
								<span className="text-xs font-mono text-gray-400 dark:text-gray-500">
									{doc.id}
								</span>
							</div>
							<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
								{doc.title}
							</h3>
							<p className="text-xs text-gray-400 dark:text-gray-500">{doc.createdDate.slice(0, 10)}</p>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
