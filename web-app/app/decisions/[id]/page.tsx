"use client";

import MDEditor from "@uiw/react-md-editor";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { Decision } from "@/types";
import { apiClient } from "@/lib/api";
import { useAppContext } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import MermaidMarkdown from "@/components/MermaidMarkdown";

const DECISION_STATUSES = ["Proposed", "Accepted", "Deprecated", "Superseded"];

export default function DecisionDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const { refreshData } = useAppContext();
	const { theme } = useTheme();
	const [decision, setDecision] = useState<Decision | null>(null);
	const [editing, setEditing] = useState(false);
	const [editTitle, setEditTitle] = useState("");
	const [editStatus, setEditStatus] = useState("");
	const [editContent, setEditContent] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (id) {
			apiClient.fetchDecision(id).then((d) => {
				setDecision(d);
				setEditTitle(d.title);
				setEditStatus(d.status ?? "Proposed");
				setEditContent(d.content);
			});
		}
	}, [id]);

	const handleSave = async () => {
		if (!decision) return;
		setSaving(true);
		try {
			const updated = await apiClient.updateDecision(decision.id, {
				title: editTitle.trim(),
				status: editStatus,
				content: editContent,
			});
			setDecision(updated);
			setEditing(false);
			await refreshData();
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!decision) return;
		if (!window.confirm(`Delete "${decision.title}"?`)) return;
		await apiClient.deleteDecision(decision.id);
		await refreshData();
		router.push("/decisions");
	};

	if (!decision) return <div className="text-center py-12 text-gray-500">Loading…</div>;

	return (
		<div className="max-w-4xl mx-auto space-y-4">
			<div className="flex items-center justify-between">
				<button
					onClick={() => router.back()}
					className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1"
				>
					← Back
				</button>
				<div className="flex gap-2">
					{editing ? (
						<>
							<button
								onClick={() => setEditing(false)}
								className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
							>
								Cancel
							</button>
							<button
								onClick={handleSave}
								disabled={saving}
								className="px-4 py-2 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
							>
								{saving ? "Saving…" : "Save"}
							</button>
						</>
					) : (
						<>
							<button
								onClick={() => setEditing(true)}
								className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
							>
								Edit
							</button>
							<button
								onClick={handleDelete}
								className="px-4 py-2 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer"
							>
								Delete
							</button>
						</>
					)}
				</div>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
				{editing ? (
					<div className="space-y-4">
						<input
							type="text"
							value={editTitle}
							onChange={(e) => setEditTitle(e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-lg font-semibold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
						/>
						<select
							value={editStatus}
							onChange={(e) => setEditStatus(e.target.value)}
							className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
						>
							{DECISION_STATUSES.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
						<MDEditor
							value={editContent}
							onChange={(v) => setEditContent(v || "")}
							height={600}
							data-color-mode={theme}
						/>
					</div>
				) : (
					<div>
						<div className="flex items-center gap-3 mb-2">
							<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
								{decision.title}
							</h1>
							{decision.status && (
								<span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
									{decision.status}
								</span>
							)}
						</div>
						<p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
							{decision.id} · Created {decision.createdDate.slice(0, 10)}
						</p>
						<div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
							<MermaidMarkdown
								source={decision.content || "_No content yet. Click Edit to add._"}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
