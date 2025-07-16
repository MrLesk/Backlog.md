import React, { useState, useEffect, memo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import MDEditor from '@uiw/react-md-editor';
import { type Decision } from '../../types';
import ErrorBoundary from '../components/ErrorBoundary';
import { SuccessToast } from './SuccessToast';
import { useTheme } from '../contexts/ThemeContext';
import { sanitizeUrlTitle } from '../utils/urlHelpers';

// Utility function for ID transformations
const stripIdPrefix = (id: string): string => {
	if (id.startsWith('decision-')) return id.replace('decision-', '');
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
			<div className="prose prose-sm max-w-none w-full p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" data-color-mode={theme}>
				<MDEditor.Markdown source={value} />
			</div>
		);
	}

	// Edit mode - show full editor that fills the available space
	return (
		<div className="h-full w-full flex flex-col doc-editor-container">
			<div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
				<MDEditor
					value={value}
					onChange={onChange}
					preview="edit"
					height="100%"
					hideToolbar={false}
					data-color-mode={theme}
					textareaProps={{
						placeholder: 'Write your decision documentation here...',
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

// Utility function to add decision prefix for API calls
const addDecisionPrefix = (id: string): string => {
	return id.startsWith('decision-') ? id : `decision-${id}`;
};

interface DecisionDetailProps {
	decisions: Decision[];
	onRefreshData: () => Promise<void>;
}

export default function DecisionDetail({ decisions, onRefreshData }: DecisionDetailProps) {
	const { id, title } = useParams<{ id: string; title: string }>();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [decision, setDecision] = useState<Decision | null>(null);
	const [content, setContent] = useState<string>('');
	const [originalContent, setOriginalContent] = useState<string>('');
	const [decisionTitle, setDecisionTitle] = useState<string>('');
	const [originalDecisionTitle, setOriginalDecisionTitle] = useState<string>('');
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	
	
	const [isNewDecision, setIsNewDecision] = useState(false);
	const [showSaveSuccess, setShowSaveSuccess] = useState(false);

	useEffect(() => {
		if (id === 'new') {
			// Handle new decision creation
			setIsNewDecision(true);
			setIsEditing(true);
			setIsLoading(false);
			setDecisionTitle('');
			setOriginalDecisionTitle('');
			setContent('');
			setOriginalContent('');
		} else if (id) {
			setIsNewDecision(false);
			setIsEditing(false); // Ensure we start in preview mode for existing decisions
			loadDecisionContent();
		}
	}, [id, decisions]);

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

	const loadDecisionContent = async () => {
		if (!id) return;
		
		try {
			setIsLoading(true);
			// Find decision from props
			const prefixedId = addDecisionPrefix(id);
			const decision = decisions.find(d => d.id === prefixedId);
			
			// Always try to fetch the decision from API, whether we found it in decisions or not
			// This ensures deep linking works even before the parent component loads the decisions array
			try {
				const fullDecision = await apiClient.fetchDecision(prefixedId);
				setContent(fullDecision.body || '');
				setOriginalContent(fullDecision.body || '');
				setDecisionTitle(fullDecision.title || '');
				setOriginalDecisionTitle(fullDecision.title || '');
				// Update decision state with full data
				setDecision(fullDecision);
			} catch (fetchError) {
				// If fetch fails and we don't have the decision in props, show error
				if (!decision) {
					console.error('Failed to load decision:', fetchError);
				} else {
					// We have basic info from props even if fetch failed
					setDecision(decision);
					setDecisionTitle(decision.title || '');
					setOriginalDecisionTitle(decision.title || '');
				}
			}
		} catch (error) {
			console.error('Failed to load decision:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const handleSave = async () => {
		if (!decisionTitle.trim()) {
			console.error('Decision title is required');
			return;
		}

		try {
			setIsSaving(true);
			
			if (isNewDecision) {
				// Create new decision
				const decision = await apiClient.createDecision(decisionTitle);
				// Refresh data and navigate to the new decision
				await onRefreshData();
				// Show success toast
				setShowSaveSuccess(true);
				setTimeout(() => setShowSaveSuccess(false), 4000);
				// Exit edit mode and navigate to the new decision
				setIsEditing(false);
				setIsNewDecision(false);
				const newId = stripIdPrefix(decision.id);
				navigate(`/decisions/${newId}/${sanitizeUrlTitle(decisionTitle)}`);
			} else {
				// Update existing decision
				if (!id) return;
				await apiClient.updateDecision(addDecisionPrefix(id), content);
				// Refresh data from parent
				await onRefreshData();
				// Show success toast
				setShowSaveSuccess(true);
				setTimeout(() => setShowSaveSuccess(false), 4000);
				// Exit edit mode and navigate to decision detail page (this will load in preview mode)
				setIsEditing(false);
				navigate(`/decisions/${id}/${sanitizeUrlTitle(decisionTitle)}`);
			}
		} catch (error) {
			console.error('Failed to save decision:', error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleEdit = () => {
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		if (isNewDecision) {
			// Navigate back for new decisions
			navigate('/decisions');
		} else {
			// Revert changes for existing decisions
			setContent(originalContent);
			setDecisionTitle(originalDecisionTitle);
			setIsEditing(false);
		}
	};

	const hasChanges = content !== originalContent || decisionTitle !== originalDecisionTitle;

	const getStatusColor = (status: string) => {
		const colors = {
			'proposed': 'bg-yellow-50 text-yellow-700 border-yellow-200',
			'accepted': 'bg-green-50 text-green-700 border-green-200',
			'rejected': 'bg-red-50 text-red-700 border-red-200',
			'superseded': 'bg-gray-50 text-gray-700 border-gray-200',
		} as const;
		return colors[status.toLowerCase() as keyof typeof colors] || 'bg-gray-50 text-gray-700 border-gray-200';
	};

	if (!id) {
		return (
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="text-center">
					<svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
					</svg>
					<h3 className="mt-2 text-sm font-medium text-gray-900">No decision selected</h3>
					<p className="mt-1 text-sm text-gray-500">Select a decision from the sidebar to view its content.</p>
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
									value={decisionTitle}
									onChange={(e) => setDecisionTitle(e.target.value)}
									className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
									placeholder="Decision title"
								/>
							) : (
								<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-200">
									{decisionTitle || decision?.title || (title ? decodeURIComponent(title) : `Decision ${id}`)}
								</h1>
							)}
							<div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
								<div className="flex items-center space-x-2">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z" />
									</svg>
									<span>ID: {decision?.id}</span>
								</div>
								<div className="flex items-center space-x-2">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
									</svg>
									<span>Decision</span>
								</div>
								{decision?.date && (
									<div className="flex items-center space-x-2">
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										<span>Date: {decision.date}</span>
									</div>
								)}
								{decision?.status && (
									<div className="flex items-center space-x-2">
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<span 
											className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusColor(decision.status)}`}
										>
											{decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
										</span>
									</div>
								)}
							</div>
						</div>
						<div className="flex items-center space-x-3 ml-6">
							{/* Temporarily hidden - decisions editing not ready */}
							{false ? (
								<button
									onClick={handleEdit}
									className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer"
								>
									<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
									</svg>
									Edit
								</button>
							) : null}
							{isEditing && (
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
				message={`Decision "${decisionTitle}" saved successfully!`}
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