import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { apiClient } from "../lib/api";
import StoredDate from "./StoredDate";

interface CleanupModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (message: string) => void;
	dateFormat?: string;
}

interface TaskPreview {
	id: string;
	title: string;
	updatedDate?: string;
	createdDate: string;
}

const AGE_OPTIONS = [
	{ label: "1 day", value: 1 },
	{ label: "1 week", value: 7 },
	{ label: "2 weeks", value: 14 },
	{ label: "3 weeks", value: 21 },
	{ label: "1 month", value: 30 },
	{ label: "3 months", value: 90 },
	{ label: "1 year", value: 365 },
];

type CleanupSelection =
	| { phase: "choose" }
	| { phase: "loading"; age: number }
	| { phase: "preview" | "confirm" | "executing"; age: number; tasks: TaskPreview[] };

const CleanupModal: React.FC<CleanupModalProps> = ({ isOpen, onClose, onSuccess, dateFormat }) => {
	const [selection, setSelection] = useState<CleanupSelection>({ phase: "choose" });
	const [error, setError] = useState<string | null>(null);
	const requestId = useRef(0);
	const executing = useRef(false);
	const selectedAge = "age" in selection ? selection.age : null;
	const previewTasks = "tasks" in selection ? selection.tasks : [];
	const previewCount = previewTasks.length;
	const isLoadingPreview = selection.phase === "loading";
	const isExecuting = selection.phase === "executing";
	const showConfirmation = selection.phase === "confirm" || isExecuting;

	useEffect(() => {
		if (!isOpen) {
			setSelection({ phase: "choose" });
			setError(null);
		}
		return () => {
			// Closing, reopening or unmounting makes earlier responses irrelevant.
			requestId.current++;
			executing.current = false;
		};
	}, [isOpen]);

	const handleAgeSelect = async (age: number) => {
		if (executing.current) return;
		const request = ++requestId.current;
		setSelection({ phase: "loading", age });
		setError(null);

		try {
			const preview = await apiClient.getCleanupPreview(age);
			if (request !== requestId.current) return;
			setSelection({ phase: "preview", age, tasks: preview.tasks });
		} catch (err) {
			if (request !== requestId.current) return;
			setError(err instanceof Error ? err.message : "Failed to load preview");
			setSelection({ phase: "choose" });
		}
	};

	const handleExecuteCleanup = async () => {
		if (selection.phase !== "confirm" || !selection.tasks.length || executing.current) return;

		executing.current = true;
		const request = ++requestId.current;
		setSelection({ ...selection, phase: "executing" });
		setError(null);

		try {
			// Only the tasks the preview showed, not whatever matches the age by now.
			const result = await apiClient.executeCleanup(selection.tasks.map((task) => task.id));
			if (request !== requestId.current) return;

			// A task that could not be archived is shown as an error, not in the success toast.
			if (result.success && !result.failedTasks?.length) {
				onSuccess(result.message);
				handleClose();
			} else {
				setError(result.message || "Cleanup failed");
			}
		} catch (err) {
			if (request !== requestId.current) return;
			setError(err instanceof Error ? err.message : "Failed to execute cleanup");
		} finally {
			if (request === requestId.current) {
				executing.current = false;
				setSelection({ ...selection, phase: "confirm" });
			}
		}
	};

	const handleClose = () => {
		requestId.current++;
		executing.current = false;
		setSelection({ phase: "choose" });
		setError(null);
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			disableEscapeClose={isExecuting}
			title="Clean Up Completed Tasks"
			maxWidthClass="max-w-3xl"
		>
			<div className="space-y-6">
				{/* Age Selector */}
				<div>
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
						Archive tasks if they are older than:
					</label>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
						{AGE_OPTIONS.map((option) => (
							<button
								key={option.value}
								onClick={() => handleAgeSelect(option.value)}
								disabled={isExecuting}
								className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
									selectedAge === option.value
										? "bg-blue-500 dark:bg-blue-600 text-white"
										: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
								} disabled:opacity-50`}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>

				{/* Error Message */}
				{error && (
					<div className="rounded-md bg-red-100 dark:bg-red-900/40 p-3">
						<p className="text-sm text-red-700 dark:text-red-200 whitespace-pre-line">{error}</p>
					</div>
				)}

				{/* Loading Preview */}
				{isLoadingPreview && (
					<div className="text-center py-4">
						<div className="text-gray-600 dark:text-gray-400">Loading preview...</div>
					</div>
				)}

				{/* Preview Section */}
				{selection.phase === "preview" && (
					<div>
						{previewCount === 0 ? (
							<div className="text-center py-8 text-gray-500 dark:text-gray-400">
								No tasks found that are older than {AGE_OPTIONS.find((o) => o.value === selectedAge)?.label}.
							</div>
						) : (
							<>
								<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
									Found {previewCount} task{previewCount !== 1 ? "s" : ""} to clean up:
								</h3>
								<div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
									<ul className="divide-y divide-gray-200 dark:divide-gray-700">
										{previewTasks.slice(0, 10).map((task) => (
											<li
												key={task.id}
												className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
											>
												<div className="flex justify-between items-start">
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
															{task.title}
														</p>
														<p className="text-xs text-gray-500 dark:text-gray-400">
															{task.id} •{" "}
															<StoredDate value={task.updatedDate || task.createdDate} dateFormat={dateFormat} />
														</p>
													</div>
												</div>
											</li>
										))}
										{previewCount > 10 && (
											<li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 italic">
												... and {previewCount - 10} more
											</li>
										)}
									</ul>
								</div>
							</>
						)}
					</div>
				)}

				{/* Confirmation Section */}
				{showConfirmation && previewCount > 0 && (
					<div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4">
						<h3 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Confirm Cleanup</h3>
						<p className="text-sm text-amber-700 dark:text-amber-300">
							Are you sure you want to archive {previewCount} task{previewCount !== 1 ? "s" : ""}?
						</p>
					</div>
				)}

				{/* Action Buttons */}
				<div className="flex justify-end gap-3">
					<button
						onClick={handleClose}
						disabled={isExecuting}
						className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors duration-200"
					>
						Cancel
					</button>

					{selectedAge !== null && previewCount > 0 && (
						<>
							{!showConfirmation ? (
								<button
									onClick={() => {
										if (selection.phase === "preview") setSelection({ ...selection, phase: "confirm" });
									}}
									disabled={isLoadingPreview || isExecuting}
									className="px-4 py-2 text-sm font-medium text-white bg-blue-500 dark:bg-blue-600 rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
								>
									Continue
								</button>
							) : (
								<button
									onClick={handleExecuteCleanup}
									disabled={isExecuting}
									className="px-4 py-2 text-sm font-medium text-white bg-red-500 dark:bg-red-600 rounded-md hover:bg-red-600 dark:hover:bg-red-700 disabled:opacity-50 transition-colors duration-200"
								>
									{isExecuting ? "Archiving Tasks..." : `Archive ${previewCount} Task${previewCount !== 1 ? "s" : ""}`}
								</button>
							)}
						</>
					)}
				</div>
			</div>
		</Modal>
	);
};

export default CleanupModal;
