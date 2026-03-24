"use client";

import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { apiClient } from "@/lib/api";

interface CleanupModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (movedCount: number) => void;
}

interface TaskPreview {
	id: string;
	title: string;
	updatedDate?: string;
	createdDate: string;
}

const CleanupModal: React.FC<CleanupModalProps> = ({ isOpen, onClose, onSuccess }) => {
	const [previewTasks, setPreviewTasks] = useState<TaskPreview[]>([]);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [isExecuting, setIsExecuting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		setIsLoadingPreview(true);
		setError(null);
		apiClient
			.getCleanupPreview()
			.then((data) => setPreviewTasks(data.tasks as TaskPreview[]))
			.catch((err) => setError(err instanceof Error ? err.message : "Failed to load preview"))
			.finally(() => setIsLoadingPreview(false));
	}, [isOpen]);

	const handleExecute = async () => {
		setIsExecuting(true);
		setError(null);
		try {
			const result = await apiClient.executeCleanup();
			onSuccess(result.deleted);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Cleanup failed");
		} finally {
			setIsExecuting(false);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Archive Completed Tasks" maxWidthClass="max-w-lg">
			<div className="space-y-4">
				<p className="text-sm text-gray-600 dark:text-gray-400">
					This will permanently archive all completed tasks from the board.
				</p>

				{error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

				{isLoadingPreview ? (
					<div className="text-center py-4 text-gray-500">Loading…</div>
				) : previewTasks.length === 0 ? (
					<div className="text-center py-4 text-gray-500 dark:text-gray-400">
						No completed tasks to archive.
					</div>
				) : (
					<div>
						<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							{previewTasks.length} task{previewTasks.length !== 1 ? "s" : ""} will be archived:
						</p>
						<ul className="max-h-48 overflow-y-auto space-y-1 bg-gray-50 dark:bg-gray-900 rounded-md p-2">
							{previewTasks.map((t) => (
								<li key={t.id} className="text-sm text-gray-700 dark:text-gray-300 truncate">
									<span className="font-mono text-xs text-gray-400 mr-2">
										{t.id.replace("task-", "TASK-")}
									</span>
									{t.title}
								</li>
							))}
						</ul>
					</div>
				)}

				<div className="flex justify-end gap-3 pt-2">
					<button
						onClick={onClose}
						className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
					>
						Cancel
					</button>
					<button
						onClick={handleExecute}
						disabled={isExecuting || previewTasks.length === 0}
						className="px-4 py-2 rounded-lg text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					>
						{isExecuting ? "Archiving…" : `Archive ${previewTasks.length} task${previewTasks.length !== 1 ? "s" : ""}`}
					</button>
				</div>
			</div>
		</Modal>
	);
};

export default CleanupModal;
