import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import {
	type Decision,
	type DecisionSearchResult,
	type Document,
	type DocumentSearchResult,
	type SearchResult,
	type Task,
	type TaskSearchResult,
} from '../../types';
import ErrorBoundary from './ErrorBoundary';
import { SidebarSkeleton } from './LoadingSpinner';
import { sanitizeUrlTitle } from '../utils/urlHelpers';
import { getWebVersion } from '../utils/version';
import { apiClient } from '../lib/api';

// Utility functions for ID transformations
const stripIdPrefix = (id: string): string => {
	if (id.startsWith('doc-')) return id.replace('doc-', '');
	if (id.startsWith('decision-')) return id.replace('decision-', '');
	if (id.startsWith('task-')) return id.replace('task-', '');
	return id;
};

// Icon components for better semantics and performance
const Icons = {
	Tasks: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
		</svg>
	),
	Board: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
		</svg>
	),
	List: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
		</svg>
	),
	Draft: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
		</svg>
	),
	Document: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
		</svg>
	),
	DocumentPage: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
		</svg>
	),
	DocumentCode: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
		</svg>
	),
	DocumentBook: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
		</svg>
	),
	DocumentChart: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
		</svg>
	),
	DocumentSettings: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
	),
	DocumentInfo: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
	),
	Decision: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
		</svg>
	),
	DecisionPage: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
	),
	DecisionArchitecture: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
		</svg>
	),
	DecisionTech: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
		</svg>
	),
	DecisionProcess: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
		</svg>
	),
	DecisionBusiness: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2V6" />
		</svg>
	),
	Search: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
	),
	ChevronLeft: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
		</svg>
	),
	ChevronRight: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
		</svg>
	),
	ChevronDown: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	),
	Statistics: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
		</svg>
	),
	Milestone: () => (
		<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<circle cx="12" cy="12" r="9" strokeWidth={2} />
			<circle cx="12" cy="12" r="5" strokeWidth={2} />
			<circle cx="12" cy="12" r="1" strokeWidth={2} />
		</svg>
	),
};

interface SideNavigationProps {
	tasks: Task[];
	docs: Document[];
	decisions: Decision[];
	isLoading: boolean;
	error?: Error | null;
	onRetry?: () => void;
	onRefreshData: () => Promise<void>;
}

const SideNavigation = memo(function SideNavigation({ 
	tasks, 
	docs, 
	decisions, 
	isLoading, 
	error, 
	onRetry
}: SideNavigationProps) {
	const [isCollapsed, setIsCollapsed] = useState(() => {
		const saved = localStorage.getItem('sideNavCollapsed');
		return saved ? JSON.parse(saved) : false;
	});
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null);
	const [isDocsCollapsed, setIsDocsCollapsed] = useState(() => {
		const saved = localStorage.getItem('docsCollapsed');
		if (saved !== null) {
			return JSON.parse(saved);
		}
		// Auto-collapse if more than 6 documents
		return docs.length > 6;
	});
	const [isDecisionsCollapsed, setIsDecisionsCollapsed] = useState(() => {
		const saved = localStorage.getItem('decisionsCollapsed');
		if (saved !== null) {
			return JSON.parse(saved);
		}
		// Auto-collapse if more than 6 decisions
		return decisions.length > 6;
	});
	const [version, setVersion] = useState<string>('');
	const location = useLocation();
	const navigate = useNavigate();

	// Create handlers - just navigate to new pages
	const handleCreateDocument = useCallback(() => {
		navigate('/documentation/new');
	}, [navigate]);

	useCallback(() => {
		navigate('/decisions/new');
	}, [navigate]);

	useEffect(() => {
		localStorage.setItem('sideNavCollapsed', JSON.stringify(isCollapsed));
	}, [isCollapsed]);

	// Fetch version on mount
	useEffect(() => {
		getWebVersion().then(setVersion).catch(() => setVersion(''));
	}, []);

	// Save docs collapse state to localStorage
	useEffect(() => {
		localStorage.setItem('docsCollapsed', JSON.stringify(isDocsCollapsed));
	}, [isDocsCollapsed]);

	// Save decisions collapse state to localStorage
	useEffect(() => {
		localStorage.setItem('decisionsCollapsed', JSON.stringify(isDecisionsCollapsed));
	}, [isDecisionsCollapsed]);

	// Auto-collapse when data loads/changes if no saved preference exists
	useEffect(() => {
		const savedDocsCollapsed = localStorage.getItem('docsCollapsed');
		if (savedDocsCollapsed === null && docs.length > 6) {
			setIsDocsCollapsed(true);
		}
	}, [docs.length]);

	useEffect(() => {
		const savedDecisionsCollapsed = localStorage.getItem('decisionsCollapsed');
		if (savedDecisionsCollapsed === null && decisions.length > 6) {
			setIsDecisionsCollapsed(true);
		}
	}, [decisions.length]);

	// Add keyboard shortcut for search
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				if (isCollapsed) {
					// Expand sidebar first, then focus will happen on next render
					setIsCollapsed(false);
				} else if (searchInputRef) {
					searchInputRef.focus();
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [searchInputRef, isCollapsed]);

	// Auto-focus search input when sidebar expands
	useEffect(() => {
		if (!isCollapsed && searchInputRef) {
			// Small delay to ensure the input is rendered
			const timer = setTimeout(() => {
				searchInputRef.focus();
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [isCollapsed, searchInputRef]);

	location.pathname.startsWith('/documentation');
	location.pathname.startsWith('/decisions');


	// Perform unified search via centralized API (debounced)
	useEffect(() => {
		const query = searchQuery.trim();
		if (query === '') {
			setSearchResults([]);
			setSearchError(null);
			setIsSearching(false);
			return;
		}

		let cancelled = false;
		setIsSearching(true);
		setSearchError(null);
		const timeout = setTimeout(async () => {
			try {
				const results = await apiClient.search({ query, limit: 15 });
				if (!cancelled) {
					setSearchResults(results);
				}
			} catch (err) {
				console.error('Sidebar search failed:', err);
				if (!cancelled) {
					setSearchResults([]);
					setSearchError('Search failed');
				}
			} finally {
				if (!cancelled) {
					setIsSearching(false);
				}
			}
		}, 200);

		return () => {
			cancelled = true;
			clearTimeout(timeout);
		};
	}, [searchQuery]);

	const unifiedSearchResults = useMemo(() => {
		if (!searchQuery.trim()) {
			return [];
		}
		const filtered = searchResults
			.filter((result) => result.score === null || result.score <= 0.45)
			.sort((a, b) => {
				const scoreA = a.score ?? Number.POSITIVE_INFINITY;
				const scoreB = b.score ?? Number.POSITIVE_INFINITY;
				return scoreA - scoreB;
			});

		return filtered.slice(0, 5);
	}, [searchQuery, searchResults]);

	// Always show full lists in their sections, search results are separate
	const filteredDocs = docs;
	const filteredDecisions = decisions;

	const toggleCollapse = useCallback(() => {
		setIsCollapsed((prev: any) => !prev);
	}, []);

	return (
		<ErrorBoundary>
			<div className={`relative bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col min-h-full z-10 ${isCollapsed ? 'w-16' : 'w-80 min-w-80'}`}>
			{/* Search Bar */}
			<div className={`${isCollapsed ? 'px-2' : 'px-4'} border-b border-gray-200 dark:border-gray-700 h-18 flex items-center relative`}>
				{/* Collapse Toggle Button - Always positioned on the border */}
				<button
					onClick={toggleCollapse}
					className="absolute -right-3 top-1/2 transform -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-circle shadow-sm hover:shadow-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200"
					aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					{isCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronLeft />}
				</button>
				
				{!isCollapsed ? (
					<div className="flex items-center w-full">
						<div className="relative flex-1">
							<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
								<Icons.Search />
							</div>
							<input
								ref={setSearchInputRef}
								type="text"
								placeholder="Search (⌘K)..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-stone-500 dark:focus:ring-stone-400 focus:border-transparent transition-colors duration-200"
							/>
								{searchQuery && (
									<button
										onClick={() => setSearchQuery('')}
										className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
									>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							)}
						</div>
					</div>
				) : (
						<div className="flex items-center justify-center">
							<button
								onClick={() => setIsCollapsed(false)}
								className="flex items-center justify-center p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
								title="Search (⌘K)"
							>
								<Icons.Search />
						</button>
					</div>
				)}
			</div>

			{/* Unified Search Results */}
			{!isCollapsed && searchQuery.trim() && unifiedSearchResults.length > 0 && (
				<div className="p-4 border-b border-gray-200 dark:border-gray-700">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Search Results</h3>
						{isSearching && (
							<span className="text-xs text-gray-500 dark:text-gray-400">Searching…</span>
						)}
					</div>
					<div className="space-y-1">
						{unifiedSearchResults.map((result, index) => {
							const item = result.type === 'task'
								? (result as TaskSearchResult).task
								: result.type === 'document'
									? (result as DocumentSearchResult).document
									: (result as DecisionSearchResult).decision;
							const getResultLink = () => {
								if (result.type === 'document') {
									return `/documentation/${stripIdPrefix(item.id)}/${sanitizeUrlTitle(item.title)}`;
								}
								if (result.type === 'decision') {
									return `/decisions/${stripIdPrefix(item.id)}/${sanitizeUrlTitle(item.title)}`;
								}
								return `/?highlight=${encodeURIComponent(item.id)}`;
							};

							const getResultIcon = () => {
								if (result.type === 'document') return <span className="text-green-500"><Icons.DocumentPage /></span>;
								if (result.type === 'decision') return <span className="text-stone-500"><Icons.DecisionPage /></span>;
								return <span className="text-purple-500"><Icons.Tasks /></span>;
							};

							return (
								<NavLink
									key={`${result.type}-${item.id}-${index}`}
									to={getResultLink()}
									className="flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
								>
									{getResultIcon()}
									<div className="flex-1 min-w-0">
										<div className="font-medium truncate">
											{item.title}
										</div>
										<div className="text-xs text-gray-500 dark:text-gray-400 truncate">
											{result.type.charAt(0).toUpperCase() + result.type.slice(1)} • {item.id}
										</div>
									</div>
									{result.score !== null && (
										<div className="text-xs text-gray-400 dark:text-gray-500">
											{`${Math.round((1 - result.score) * 100)}%`}
										</div>
									)}
								</NavLink>
							);
						})}
					</div>
				</div>
			)}

			{!isCollapsed && searchQuery.trim() && unifiedSearchResults.length === 0 && !isSearching && !searchError && (
				<div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
					No matching results
				</div>
			)}

			{!isCollapsed && searchQuery.trim() && searchError && (
				<div className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border-b border-gray-200 dark:border-gray-700">
					{searchError}
				</div>
			)}


			<nav className="flex-1 overflow-y-auto">
				{/* Loading Indicator - only show when expanded since collapsed nav is static */}
				{isLoading && !isCollapsed && (
					<SidebarSkeleton isCollapsed={false} />
				)}

				{/* Error State */}
				{error && !isLoading && !isCollapsed && (
					<div className="px-4 py-4">
						<div className="text-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
							<p className="text-sm text-red-700 dark:text-red-400 mb-2">Failed to load navigation</p>
								{onRetry && (
									<button
										onClick={onRetry}
										className="text-xs px-3 py-1 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors duration-200"
									>
										Retry
									</button>
							)}
						</div>
					</div>
				)}
				
				{/* Tasks Section - Hidden in collapsed state and when loading */}
				{!isCollapsed && !isLoading && (
					<div className="px-4 py-4">
						<div className="flex items-center space-x-3 text-gray-700 dark:text-gray-300">
							<span className="text-gray-500 dark:text-gray-400"><Icons.Tasks /></span>
							<span className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap">Tasks ({tasks.length})</span>
						</div>
					</div>
				)}

				{/* Navigation items only show when expanded and not loading */}
				{!isCollapsed && !isLoading && (
					<div className="px-4 space-y-1">
						{/* Board Navigation */}
						<NavLink
							to="/"
							className={({ isActive }) =>
								`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
										: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<Icons.Board />
							<span className="ml-3 text-sm font-medium">Kanban Board</span>
						</NavLink>

						{/* Tasks Navigation */}
						<NavLink
							to="/tasks"
							className={({ isActive }) =>
								`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
										: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<Icons.List />
							<span className="ml-3 text-sm font-medium">All Tasks</span>
						</NavLink>

						{/* Milestones Navigation */}
						<NavLink
							to="/milestones"
							className={({ isActive }) =>
								`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
										: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<Icons.Milestone />
							<span className="ml-3 text-sm font-medium">Milestones</span>
						</NavLink>

						{/* Drafts Navigation */}
						<NavLink
							to="/drafts"
							className={({ isActive }) =>
								`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
										: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<Icons.Draft />
							<span className="ml-3 text-sm font-medium">Drafts</span>
						</NavLink>

						{/* Statistics Navigation */}
						<NavLink
							to="/statistics"
							className={({ isActive }) =>
								`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
										: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<Icons.Statistics />
							<span className="ml-3 text-sm font-medium">Statistics</span>
						</NavLink>
					</div>
				)}

				{!isCollapsed && !isLoading && (
					<>
						{/* Divider between Tasks and Documents */}
						<div className="mx-4 my-2 border-t border-gray-200 dark:border-gray-700"></div>
						
						{/* Documents Section */}
						<div className="px-4 py-4">
							<div className="flex items-center justify-between mb-4">
									<div className="flex items-center space-x-3">
										<button
											onClick={() => setIsDocsCollapsed(!isDocsCollapsed)}
											className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors duration-200"
											title={isDocsCollapsed ? "Expand documents" : "Collapse documents"}
										>
											{isDocsCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
									</button>
									<span className="text-gray-500 dark:text-gray-400"><Icons.Document /></span>
									<span className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap">Documents ({docs.length})</span>
								</div>
									<button
										onClick={handleCreateDocument}
										className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors duration-200"
										title="Create new document"
									>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
										<circle cx="12" cy="12" r="10" />
									</svg>
								</button>
							</div>
							
							{/* Document List */}
							{!isDocsCollapsed && (
								<div className="space-y-1">
									{filteredDocs.length === 0 ? (
										<p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No documents</p>
									) : (
										filteredDocs.map((doc) => (
											<NavLink
												key={doc.id}
												to={`/documentation/${stripIdPrefix(doc.id)}/${sanitizeUrlTitle(doc.title)}`}
												className={({ isActive }) =>
													`flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
														isActive
															? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
															: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
													}`
												}
											>
												<span className="text-gray-400 dark:text-gray-500"><Icons.DocumentPage /></span>
												<span className="truncate">{doc.title}</span>
											</NavLink>
										))
									)}
								</div>
							)}
						</div>

						{/* Divider between Documents and Decisions */}
						<div className="mx-4 my-2 border-t border-gray-200 dark:border-gray-700"></div>

						{/* Decisions Section */}
						<div className="px-4 py-4">
							<div className="flex items-center justify-between mb-4">
									<div className="flex items-center space-x-3">
										<button
											onClick={() => setIsDecisionsCollapsed(!isDecisionsCollapsed)}
											className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors duration-200"
											title={isDecisionsCollapsed ? "Expand decisions" : "Collapse decisions"}
										>
											{isDecisionsCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
									</button>
									<span className="text-gray-500 dark:text-gray-400"><Icons.Decision /></span>
									<span className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap">Decisions ({decisions.length})</span>
								</div>
								{/* Temporarily hidden - decisions editing not ready */}
								{/*{false && (*/}
								{/*	<button*/}
								{/*		onClick={handleCreateDecision}*/}
								{/*		className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"*/}
								{/*		title="Create new decision"*/}
								{/*	>*/}
								{/*		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">*/}
								{/*			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />*/}
								{/*			<circle cx="12" cy="12" r="10" />*/}
								{/*		</svg>*/}
								{/*	</button>*/}
								{/*)}*/}
							</div>
							
							{/* Decision List */}
							{!isDecisionsCollapsed && (
								<div className="space-y-1">
									{filteredDecisions.length === 0 ? (
										<p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No decisions</p>
									) : (
										filteredDecisions.map((decision) => (
											<NavLink
												key={decision.id}
												to={`/decisions/${stripIdPrefix(decision.id)}/${sanitizeUrlTitle(decision.title)}`}
												className={({ isActive }) =>
													`flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
														isActive
															? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
															: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
													}`
												}
											>
												<span className="text-gray-400 dark:text-gray-500"><Icons.DecisionPage /></span>
												<span className="truncate">{decision.title}</span>
											</NavLink>
										))
									)}
								</div>
							)}
						</div>
					</>
				)}

				{isCollapsed && (
					<div className="px-2 py-2 space-y-2">
						<NavLink
							to="/"
							data-tooltip-id="sidebar-tooltip"
							data-tooltip-content="Kanban Board"
							className={({ isActive }) =>
								`flex items-center justify-center p-3 rounded-md transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.Board />
							</div>
						</NavLink>
						<NavLink
							to="/tasks"
							data-tooltip-id="sidebar-tooltip"
							data-tooltip-content="All Tasks"
							className={({ isActive }) =>
								`flex items-center justify-center p-3 rounded-md transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.List />
							</div>
						</NavLink>
						{/* Drafts Navigation */}
						<NavLink
							to="/drafts"
							data-tooltip-id="sidebar-tooltip"
							data-tooltip-content="Drafts"
							className={({ isActive }) =>
								`flex items-center justify-center p-3 rounded-md transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.Draft />
							</div>
						</NavLink>
						{/* Milestones Navigation */}
						<NavLink
							to="/milestones"
							data-tooltip-id="sidebar-tooltip"
							data-tooltip-content="Milestones"
							className={({ isActive }) =>
								`flex items-center justify-center p-3 rounded-md transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.Milestone />
							</div>
						</NavLink>
						{/* Statistics Navigation */}
						<NavLink
							to="/statistics"
							data-tooltip-id="sidebar-tooltip"
							data-tooltip-content="Statistics"
							className={({ isActive }) =>
								`flex items-center justify-center p-3 rounded-md transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.Statistics />
							</div>
						</NavLink>
						<button
							onClick={() => {
								setIsCollapsed(false);
								setIsDocsCollapsed(false);
							}}
								data-tooltip-id="sidebar-tooltip"
								data-tooltip-content="Documentation"
								className={`flex items-center justify-center p-3 rounded-md transition-colors duration-200 w-full ${
									location.pathname.startsWith('/documentation')
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.Document />
							</div>
						</button>
						<button
							onClick={() => {
								setIsCollapsed(false);
								setIsDecisionsCollapsed(false);
							}}
								data-tooltip-id="sidebar-tooltip"
								data-tooltip-content="Decisions"
								className={`flex items-center justify-center p-3 rounded-md transition-colors duration-200 w-full ${
									location.pathname.startsWith('/decisions')
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.Decision />
							</div>
						</button>
					</div>
				)}
			</nav>
			
			{/* Settings Button - Bottom Left */}
			<div className={`border-t border-gray-200 dark:border-gray-700 ${isCollapsed ? 'px-2 py-2' : 'px-4 py-4'}`}>
				{!isCollapsed ? (
					<NavLink
						to="/settings"
						className={({ isActive }) =>
							`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
								isActive
									? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
									: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
							}`
						}
					>
						<Icons.DocumentSettings />
						<span className="ml-3 text-sm font-medium">Settings</span>
						{version && (
							<span className="ml-auto text-xs text-gray-500 dark:text-gray-400">Backlog.md - v{version}</span>
						)}
					</NavLink>
				) : (
					<NavLink
						to="/settings"
						data-tooltip-id="sidebar-tooltip"
						data-tooltip-content="Settings"
						className={({ isActive }) =>
							`flex items-center justify-center p-3 rounded-md transition-colors duration-200 ${
								isActive
									? 'bg-stone-50 dark:bg-stone-900/30 text-stone-700 dark:text-stone-400'
									: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
							}`
						}
					>
						<div className="w-6 h-6 flex items-center justify-center">
							<Icons.DocumentSettings />
						</div>
					</NavLink>
				)}
			</div>
			
			<Tooltip id="sidebar-tooltip" place="right" />
			</div>
		</ErrorBoundary>
	);
});

export default SideNavigation;
