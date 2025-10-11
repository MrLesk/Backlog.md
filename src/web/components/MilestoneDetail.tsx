import React, { useState, useEffect, memo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import MDEditor from '@uiw/react-md-editor';
import { type Milestone } from '../../types';
import ErrorBoundary from '../components/ErrorBoundary';
import { SuccessToast } from './SuccessToast';
import { useTheme } from '../contexts/ThemeContext';
import { sanitizeUrlTitle } from '../utils/urlHelpers';

// Utility function for ID transformations
const stripIdPrefix = (id: string): string => {
	if (id.startsWith('m-')) return id.replace('m-', '');
	return id;
};

// Custom MDEditor wrapper for proper height handling
const MarkdownEditor = memo(function MarkdownEditor({
	value,
	onChange,
	isEditing
}: {
	value: string;
	onChange?: (val: string | undefined) => void;
	isEditing: boolean;
	isReadonly?: boolean;
}) {
	const { theme } = useTheme();
	if (!isEditing) {
		// Preview mode - just show the rendered markdown without editor UI
		return (
			<div className="prose prose-sm !max-w-none w-full p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-color-mode={theme}>
				<MDEditor.Markdown source={value} />
			</div>
		);
	}

	// Edit mode - show full editor that fills the available space
	return (
		<div className="h-full w-full flex flex-col">
			<div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
				<MDEditor
					value={value}
					onChange={onChange}
					preview="edit"
					height="100%"
					hideToolbar={false}
					data-color-mode={theme}
					textareaProps={{
						placeholder: 'Write your milestone description here...',
						style: {
							fontSize: '14px',
							resize: 'none'
						}
					}}
				/>
			</div>
		</div>
	);
});

// Utility function to add milestone prefix for API calls
const addMilestonePrefix = (id: string): string => {
	return id.startsWith('m-') ? id : `m-${id}`;
};

interface MilestoneDetailProps {
	milestones: Milestone[];
	onRefreshData: () => Promise<void>;
}

export default function MilestoneDetail({ milestones, onRefreshData }: MilestoneDetailProps) {
	const { id, title } = useParams<{ id: string; title: string }>();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [milestone, setMilestone] = useState<Milestone | null>(null);
	const [content, setContent] = useState<string>('');
	const [originalContent, setOriginalContent] = useState<string>('');
	const [milestoneTitle, setMilestoneTitle] = useState<string>('');
	const [originalMilestoneTitle, setOriginalMilestoneTitle] = useState<string>('');
	const [milestoneStatus, setMilestoneStatus] = useState<"planned" | "active" | "completed" | "archived">('planned');
	const [originalMilestoneStatus, setOriginalMilestoneStatus] = useState<"planned" | "active" | "completed" | "archived">('planned');
	const [milestoneDueDate, setMilestoneDueDate] = useState<string>('');
	const [originalMilestoneDueDate, setOriginalMilestoneDueDate] = useState<string>('');
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	const [isNewMilestone, setIsNewMilestone] = useState(false);
	const [showSaveSuccess, setShowSaveSuccess] = useState(false);

	useEffect(() => {
		if (id === 'new') {
			// Handle new milestone creation
			setIsNewMilestone(true);
			setIsEditing(true);
			setIsLoading(false);
			setMilestoneTitle('');
			setOriginalMilestoneTitle('');
			setMilestoneStatus('planned');
			setOriginalMilestoneStatus('planned');
			setMilestoneDueDate('');
			setOriginalMilestoneDueDate('');
			setContent('');
			setOriginalContent('');
		} else if (id) {
			setIsNewMilestone(false);
			setIsEditing(false); // Ensure we start in preview mode for existing milestones
			loadMilestoneContent();
		}
	}, [id, milestones]);

	// Check for edit query parameter to start in edit mode
	useEffect(() => {
		if (searchParams.get('edit') === 'true') {
			setIsEditing(true);
			// Remove the edit parameter from URL
			setSearchParams(params => {
				params.delete('edit');
				return params;
			});
		}
	}, [searchParams, setSearchParams]);

	const loadMilestoneContent = async () => {
		if (!id) return;

		try {
			setIsLoading(true);
			// Find milestone from props
			const prefixedId = addMilestonePrefix(id);
			const milestone = milestones.find(m => m.id === prefixedId);

			// Always try to fetch the milestone from API, whether we found it in milestones or not
			// This ensures deep linking works even before the parent component loads the milestones array
			try {
				const fullMilestone = await apiClient.fetchMilestone(prefixedId);
				setContent(fullMilestone.rawContent || '');
				setOriginalContent(fullMilestone.rawContent || '');
				setMilestoneTitle(fullMilestone.title || '');
				setOriginalMilestoneTitle(fullMilestone.title || '');
				setMilestoneStatus(fullMilestone.status || 'planned');
				setOriginalMilestoneStatus(fullMilestone.status || 'planned');
				setMilestoneDueDate(fullMilestone.dueDate || '');
				setOriginalMilestoneDueDate(fullMilestone.dueDate || '');
				// Update milestone state with full data
				setMilestone(fullMilestone);
			} catch (fetchError) {
				// If fetch fails and we don't have the milestone in props, show error
				if (!milestone) {
					console.error('Failed to load milestone:', fetchError);
				} else {
					// We have basic info from props even if fetch failed
					setMilestone(milestone);
					setMilestoneTitle(milestone.title || '');
					setOriginalMilestoneTitle(milestone.title || '');
					setMilestoneStatus(milestone.status || 'planned');
					setOriginalMilestoneStatus(milestone.status || 'planned');
					setMilestoneDueDate(milestone.dueDate || '');
					setOriginalMilestoneDueDate(milestone.dueDate || '');
				}
			}
		} catch (error) {
			console.error('Failed to load milestone:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSave = async () => {
		if (!milestoneTitle.trim()) {
			console.error('Milestone title is required');
			return;
		}

		try {
			setIsSaving(true);

			if (isNewMilestone) {
				// Create new milestone
				const milestone = await apiClient.createMilestone({
					title: milestoneTitle,
					description: content,
					status: milestoneStatus,
					dueDate: milestoneDueDate || undefined,
				});
				// Refresh data and navigate to the new milestone
				await onRefreshData();
				// Show success toast
				setShowSaveSuccess(true);
				setTimeout(() => setShowSaveSuccess(false), 4000);
				// Exit edit mode and navigate to the new milestone
				setIsEditing(false);
				setIsNewMilestone(false);
				const newId = stripIdPrefix(milestone.id);
				navigate(`/milestones/${newId}/${sanitizeUrlTitle(milestoneTitle)}`);
			} else {
				// Update existing milestone
				if (!id) return;
				await apiClient.updateMilestone(addMilestonePrefix(id), {
					title: milestoneTitle,
					rawContent: content,
					status: milestoneStatus,
					dueDate: milestoneDueDate || undefined,
				});
				// Refresh data from parent
				await onRefreshData();
				// Show success toast
				setShowSaveSuccess(true);
				setTimeout(() => setShowSaveSuccess(false), 4000);
				// Exit edit mode and navigate to milestone detail page (this will load in preview mode)
				setIsEditing(false);
				navigate(`/milestones/${id}/${sanitizeUrlTitle(milestoneTitle)}`);
			}
		} catch (error) {
			console.error('Failed to save milestone:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleEdit = () => {
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		if (isNewMilestone) {
			// Navigate back for new milestones
			navigate('/milestones');
		} else {
			// Revert changes for existing milestones
			setContent(originalContent);
			setMilestoneTitle(originalMilestoneTitle);
			setMilestoneStatus(originalMilestoneStatus);
			setMilestoneDueDate(originalMilestoneDueDate);
			setIsEditing(false);
		}
	};

	const hasChanges = content !== originalContent ||
		milestoneTitle !== originalMilestoneTitle ||
		milestoneStatus !== originalMilestoneStatus ||
		milestoneDueDate !== originalMilestoneDueDate;

	const getStatusColor = (status: string) => {
		const colors = {
			'planned': 'bg-gray-50 text-gray-700 border-gray-200',
			'active': 'bg-blue-50 text-blue-700 border-blue-200',
			'completed': 'bg-green-50 text-green-700 border-green-200',
			'archived': 'bg-yellow-50 text-yellow-700 border-yellow-200',
		} as const;
		return colors[status.toLowerCase() as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200';
	};

	if (!id) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="text-center">
					<svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
					</svg>
					<h3 className="mt-2 text-sm font-medium text-gray-900">No milestone selected</h3>
					<p className="mt-1 text-sm text-gray-500">Select a milestone from the sidebar to view its content.</p>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-gray-500">Loading...</div>
			</div>
		);
	}

	return (
		<ErrorBoundary>
			<div className="h-full bg-white dark:bg-gray-900 flex flex-col transition-colors duration-200">
			{/* Header Section - Confluence/Linear Style */}
			<div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
				<div className="max-w-4xl mx-auto px-8 py-6">
					<div className="flex items-start justify-between mb-6">
						<div className="flex-1">
							{isEditing ? (
								<input
									type="text"
									value={milestoneTitle}
									onChange={(e) => setMilestoneTitle(e.target.value)}
									className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
									placeholder="Milestone title"
								/>
							) : (
								<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-200">
									{milestoneTitle || milestone?.title || (title ? decodeURIComponent(title) : `Milestone ${id}`)}
								</h1>
							)}
							<div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
								<div className="flex items-center space-x-2">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
									</svg>
									<span>ID: {milestone?.id}</span>
								</div>
								<div className="flex items-center space-x-2">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
									</svg>
									<span>Milestone</span>
								</div>
								{milestone?.createdDate && (
									<div className="flex items-center space-x-2">
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										<span>Created: {milestone.createdDate}</span>
									</div>
								)}
								{isEditing ? (
									<div className="flex items-center space-x-2">
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<select
											value={milestoneStatus}
											onChange={(e) => setMilestoneStatus(e.target.value as "planned" | "active" | "completed" | "archived")}
											className="text-xs font-medium border rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
										>
											<option value="planned">Planned</option>
											<option value="active">Active</option>
											<option value="completed">Completed</option>
											<option value="archived">Archived</option>
										</select>
									</div>
								) : (
									milestone?.status && (
										<div className="flex items-center space-x-2">
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											<span
												className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(milestone.status)}`}
											>
												{milestone.status.charAt(0).toUpperCase() + milestone.status.slice(1)}
											</span>
										</div>
									)
								)}
								{isEditing ? (
									<div className="flex items-center space-x-2">
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										<input
											type="date"
											value={milestoneDueDate}
											onChange={(e) => setMilestoneDueDate(e.target.value)}
											className="text-xs font-medium border rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
										/>
									</div>
								) : (
									milestoneDueDate && (
										<div className="flex items-center space-x-2">
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
											</svg>
											<span>Due: {milestoneDueDate}</span>
										</div>
									)
								)}
							</div>
						</div>
						<div className="flex items-center space-x-3 ml-6">
							{!isEditing ? (
								<button
									onClick={handleEdit}
									className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer"
								>
									<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
									Edit
								</button>
							) : (
								<div className="flex items-center space-x-2">
									<button
										onClick={handleCancelEdit}
										className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer"
									>
										Cancel
									</button>
									<button
										onClick={handleSave}
										disabled={!hasChanges || isSaving}
										className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 ${
											hasChanges && !isSaving
												? 'bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer'
												: 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
										}`}
									>
										<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
										{isSaving ? 'Saving...' : 'Save'}
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Content Section */}
			<div className="flex-1 bg-gray-50 dark:bg-gray-800 transition-colors duration-200 flex flex-col">
				<div className="flex-1 p-8 flex flex-col min-h-0">
					<MarkdownEditor
						value={content}
						onChange={(val) => setContent(val || '')}
						isEditing={isEditing}
					/>
				</div>
			</div>
			</div>

		{/* Save Success Toast */}
		{showSaveSuccess && (
			<SuccessToast
				message={`Milestone "${milestoneTitle}" saved successfully!`}
				onDismiss={() => setShowSaveSuccess(false)}
				icon={
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				}
			/>
		)}
		</ErrorBoundary>
	);
}
