"use client";

import MDEditor from "@uiw/react-md-editor";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { Document } from "@/types";
import { apiClient } from "@/lib/api";
import { useAppContext } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import MermaidMarkdown from "@/components/MermaidMarkdown";

export default function DocDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();
	const { refreshData } = useAppContext();
	const { theme } = useTheme();
	const [doc, setDoc] = useState<Document | null>(null);
	const [editing, setEditing] = useState(false);
	const [editTitle, setEditTitle] = useState("");
	const [editContent, setEditContent] = useState("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (id) {
			apiClient.fetchDoc(id).then((d) => {
				setDoc(d);
				setEditTitle(d.title);
				setEditContent(d.content);
			});
		}
	}, [id]);

	const handleSave = async () => {
		if (!doc) return;
		setSaving(true);
		try {
			const updated = await apiClient.updateDoc(doc.id, {
				title: editTitle.trim(),
				content: editContent,
			});
			setDoc(updated);
			setEditing(false);
			await refreshData();
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!doc) return;
		if (!window.confirm(`Delete "${doc.title}"?`)) return;
		await apiClient.deleteDoc(doc.id);
		await refreshData();
		router.push("/docs");
	};

	if (!doc) return <div className="text-center py-12 text-gray-500">Loading…</div>;

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
						<MDEditor
							value={editContent}
							onChange={(v) => setEditContent(v || "")}
							height={600}
							data-color-mode={theme}
						/>
					</div>
				) : (
					<div>
						<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{doc.title}</h1>
						<p className="text-xs text-gray-400 dark:text-gray-500 mb-6">
							{doc.id} · Created {doc.createdDate.slice(0, 10)}
						</p>
						<div className="prose prose-sm !max-w-none wmde-markdown" data-color-mode={theme}>
							<MermaidMarkdown source={doc.content || "_No content yet. Click Edit to add._"} />
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
