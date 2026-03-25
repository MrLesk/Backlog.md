import React, { useState } from 'react';
import Modal from './Modal';
import { apiClient } from '../lib/api';

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

const AGE_OPTIONS = [
	{ label: "1 day", value: 1 },
	{ label: "1 week", value: 7 },
	{ label: "2 weeks", value: 14 },
	{ label: "3 weeks", value: 21 },
	{ label: "1 month", value: 30 },
	{ label: "3 months", value: 90 },
	{ label: "1 year", value: 365 },
];

const CleanupModal: React.FC<CleanupModalProps> = ({ isOpen, onClose, onSuccess }) => {
	const [selectedAge, setSelectedAge] = useState<number | null>(null);
	const [previewTasks, setPreviewTasks] = useState<TaskPreview[]>([]);
	const [previewCount, setPreviewCount] = useState(0);
	const [isLoadingPreview, setIsLoadingPreview] = useState(false);
	const [isExecuting, setIsExecuting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showConfirmation, setShowConfirmation] = useState(false);

	const handleAgeSelect = async (age: number) => {
		setSelectedAge(age);
		setError(null);
		setIsLoadingPreview(true);

		try {
			const preview = await apiClient.getCleanupPreview(age);
			setPreviewTasks(preview.tasks);
			setPreviewCount(preview.count);
			setShowConfirmation(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load preview');
			setPreviewTasks([]);
			setPreviewCount(0);
		} finally {
			setIsLoadingPreview(false);
		}
	};

	const handleExecuteCleanup = async () => {
		if (selectedAge === null) return;

		setIsExecuting(true);
		setError(null);

		try {
			const result = await apiClient.executeCleanup(selectedAge);

			if (result.success) {
				onSuccess(result.movedCount);
				handleClose();
			} else {
				setError(result.message || 'Cleanup failed');
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to execute cleanup');
		} finally {
			setIsExecuting(false);
		}
	};

	const handleClose = () => {
		setSelectedAge(null);
		setPreviewTasks([]);
		setPreviewCount(0);
		setError(null);
		setShowConfirmation(false);
		onClose();
	};

	const formatDate = (dateStr?: string) => {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Clean Up Completed Tasks" maxWidthClass="max-w-3xl">
			<div className="space-y-6">
				{/* Age Selector */}
				<div>
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
						Move tasks to completed folder if they are older than:
					</label>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
							{AGE_OPTIONS.map(option => (
								<button
									key={option.value}
									onClick={() => handleAgeSelect(option.value)}
									disabled={isLoadingPreview || isExecuting}
									className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
										selectedAge === option.value
											? 'bg-blue-500 dark:bg-blue-600 text-white'
											: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
									} disabled:opacity-50`}
								>
									{option.label}
								</button>
							))}
						</div>
						<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
							Tasks will be moved to the backlog/completed/ folder and removed from the board
						</p>
					</div>

				{/* Error Message */}
				{error && (
					<div className="rounded-md bg-red-100 dark:bg-red-900/40 p-3">
						<p className="text-sm text-red-700 dark:text-red-200">{error}</p>
					</div>
				)}

				{/* Loading Preview */}
				{isLoadingPreview && (
					<div className="text-center py-4">
						<div className="text-gray-600 dark:text-gray-400">Loading preview...</div>
					</div>
				)}

				{/* Preview Section */}
				{!isLoadingPreview && selectedAge !== null && !showConfirmation && (
					<div>
						{previewCount === 0 ? (
							<div className="text-center py-8 text-gray-500 dark:text-gray-400">
								No tasks found that are older than {AGE_OPTIONS.find(o => o.value === selectedAge)?.label}.
							</div>
						) : (
							<>
								<h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
									Found {previewCount} task{previewCount !== 1 ? 's' : ''} to clean up:
								</h3>
								<div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
									<ul className="divide-y divide-gray-200 dark:divide-gray-700">
										{previewTasks.slice(0, 10).map(task => (
											<li key={task.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
												<div className="flex justify-between items-start">
													<div className="flex-1 min-w-0">
														<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
															{task.title}
														</p>
														<p className="text-xs text-gray-500 dark:text-gray-400">
															{task.id} • {formatDate(task.updatedDate || task.createdDate)}
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
						<h3 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
							Confirm Cleanup
						</h3>
							<p className="text-sm text-amber-700 dark:text-amber-300">
								Are you sure you want to move {previewCount} task{previewCount !== 1 ? 's' : ''} to the completed folder?
								These tasks will be moved to backlog/completed/ and removed from the board.
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
										onClick={() => setShowConfirmation(true)}
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
										{isExecuting ? 'Moving Tasks...' : `Move ${previewCount} Task${previewCount !== 1 ? 's' : ''}`}
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
