import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import {
	type Decision,
	type DecisionSearchResult,
	type DocsTreeNode,
	type Document,
	type DocumentSearchResult,
	type SearchResult,
	type SearchResultType,
	type Task,
	type TaskSearchResult,
	type WikiTreeNode,
	type WikiSearchResult,
} from '../../types';
import ErrorBoundary from './ErrorBoundary';
import Modal from './Modal';
import { SidebarSkeleton } from './LoadingSpinner';
import { sanitizeUrlTitle, encodeWikiPath } from '../utils/urlHelpers';
import { getWebVersion } from '../utils/version';
import { apiClient } from '../lib/api';
import { useI18n } from '../hooks/useI18n';
import { parseSearchCommandQuery } from '../utils/search-command-query';

// Utility functions for ID transformations
const stripIdPrefix = (id: string): string => {
	// Remove any prefix pattern: letters followed by dash (task-, doc-, decision-, JIRA-, etc.)
	return id.replace(/^[a-zA-Z]+-/, '');
};

const hasTaskSearchFilters = (parsedQuery: ReturnType<typeof parseSearchCommandQuery>): boolean => {
	return Boolean(
		parsedQuery.status ||
			parsedQuery.priority ||
			parsedQuery.assignee ||
			(parsedQuery.labels && parsedQuery.labels.length > 0) ||
			(parsedQuery.modifiedFiles && parsedQuery.modifiedFiles.length > 0),
	);
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
	WikiPage: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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
	Folder: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
		</svg>
	),
	File: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
	Gantt: () => (
		<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 1024 1024">
			<path d="M153.6 806.4a44.8 44.8 0 0 1 44.8-44.8h179.2v-44.8a44.8 44.8 0 0 1 44.8-44.8h313.6a44.8 44.8 0 0 1 44.8 44.8V896a44.8 44.8 0 0 1-44.8 44.8H422.4a44.8 44.8 0 0 1-44.8-44.8v-44.736L198.4 851.2a44.8 44.8 0 0 1-44.8-44.8z m313.6-44.8v89.6h224v-89.6H467.2zM243.2 403.2a44.8 44.8 0 0 1 44.8-44.8h582.4a44.8 44.8 0 0 1 44.8 44.8v44.864L960 448a44.8 44.8 0 0 1 0 89.6l-44.8 0.064V582.4a44.8 44.8 0 0 1-44.8 44.8H288a44.8 44.8 0 0 1-44.8-44.8V403.2z m89.6 44.8v89.6h492.8V448H332.8zM19.2 179.2a44.8 44.8 0 0 1 44.8-44.8l134.4 0.064V89.6a44.8 44.8 0 0 1 44.8-44.8h201.6a44.8 44.8 0 0 1 44.8 44.8v44.864L736 134.4a44.8 44.8 0 0 1 0 89.6H489.6v44.8a44.8 44.8 0 0 1-44.8 44.8H243.2a44.8 44.8 0 0 1-44.8-44.8v-44.8H64a44.8 44.8 0 0 1-44.8-44.8z m268.8-44.8v89.6h112V134.4H288z" />
		</svg>
	),
	Plus: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
		</svg>
	),
};

const countWikiFiles = (nodes: WikiTreeNode[]): number => {
	let count = 0;
	for (const node of nodes) {
		if (node.type === 'file' && node.name.endsWith('.md')) {
			count++;
		}
		if (node.children) {
			count += countWikiFiles(node.children);
		}
	}
	return count;
};

const countDocsFiles = (nodes: DocsTreeNode[]): number => {
	let count = 0;
	for (const node of nodes) {
		if (node.type === 'file') {
			count++;
		}
		if (node.children) {
			count += countDocsFiles(node.children);
		}
	}
	return count;
};

const WIKI_EXPANDED_PATHS_KEY = 'wikiExpandedPaths';
const DOCS_EXPANDED_PATHS_KEY = 'docsExpandedPaths';

const WikiActionDropdown = memo(function WikiActionDropdown({
	parentPath,
	nodeName,
	isFile,
	onCreateFile,
	onCreateFolder,
	onRename,
}: {
	parentPath: string;
	nodeName: string;
	isFile: boolean;
	onCreateFile: (parentPath: string) => void;
	onCreateFolder: (parentPath: string) => void;
	onRename?: (path: string, name: string) => void;
}) {
	const { t } = useI18n();
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	return (
		<div className="relative flex" ref={menuRef}>
			<button
				onClick={(e) => {
					e.stopPropagation();
					setIsOpen(!isOpen);
				}}
				className="p-1 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
				title={t.common.actions}
			>
				<Icons.Plus />
			</button>
			{isOpen && (
				<div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
					{!isFile && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setIsOpen(false);
								onCreateFile(parentPath);
							}}
							className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{t.nav.createFile}
						</button>
					)}
					{!isFile && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setIsOpen(false);
								onCreateFolder(parentPath);
							}}
							className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{t.nav.createFolder}
						</button>
					)}
					{onRename && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setIsOpen(false);
								onRename(parentPath, nodeName);
							}}
							className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{t.common.rename}
						</button>
					)}
				</div>
			)}
		</div>
	);
});

const WikiTreeItem = memo(function WikiTreeItem({
	node,
	onCreateFile,
	onCreateFolder,
	onRename,
}: {
	node: WikiTreeNode;
	onCreateFile: (parentPath: string) => void;
	onCreateFolder: (parentPath: string) => void;
	onRename: (path: string, name: string) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(() => {
		if (typeof window === 'undefined') return false;
		try {
			const saved = localStorage.getItem(WIKI_EXPANDED_PATHS_KEY);
			const paths: string[] = saved ? JSON.parse(saved) : [];
			return paths.includes(node.path);
		} catch {
			return false;
		}
	});

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => {
			const next = !prev;
			try {
				const saved = localStorage.getItem(WIKI_EXPANDED_PATHS_KEY);
				const paths = new Set<string>(saved ? JSON.parse(saved) : []);
				if (next) {
					paths.add(node.path);
				} else {
					paths.delete(node.path);
				}
				localStorage.setItem(WIKI_EXPANDED_PATHS_KEY, JSON.stringify(Array.from(paths)));
			} catch {
				// Ignore localStorage errors
			}
			return next;
		});
	}, [node.path]);

	if (node.type === 'directory') {
		const fileCount = countWikiFiles(node.children || []);
		const hasChildren = (node.children || []).length > 0;

		return (
			<div className="group/directory">
				<button
					onClick={() => hasChildren && toggleExpanded()}
					className={`flex items-center space-x-2 w-full px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 ${!hasChildren ? 'cursor-default' : ''}`}
				>
					<span className="text-gray-400 dark:text-gray-500 w-4">
						{hasChildren ? (isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />) : null}
					</span>
					<span className="text-gray-400 dark:text-gray-500"><Icons.Folder /></span>
					<span className="truncate">{node.name}</span>
					{fileCount > 0 && (
						<span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({fileCount})</span>
					)}
					<div className="ml-auto opacity-0 group-hover/directory:opacity-100 group-hover/directory:pointer-events-auto pointer-events-none transition-opacity duration-150">
						<WikiActionDropdown
							parentPath={node.path}
							nodeName={node.name}
							isFile={false}
							onCreateFile={onCreateFile}
							onCreateFolder={onCreateFolder}
							onRename={onRename}
						/>
					</div>
				</button>
				{isExpanded && node.children && (
					<div className="ml-4 space-y-1">
						{node.children.map((child) => (
							<WikiTreeItem key={child.path} node={child} onCreateFile={onCreateFile} onCreateFolder={onCreateFolder} onRename={onRename} />
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="group/file relative flex items-center rounded-lg transition-colors duration-200">
			<NavLink
				to={`/wiki/${encodeWikiPath(node.path)}`}
				className={({ isActive }) =>
					`flex-1 flex items-center space-x-3 px-3 py-1.5 text-sm rounded-lg transition-colors duration-200 ${
						isActive
							? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
							: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
					}`
				}
			>
				<span className="text-gray-400 dark:text-gray-500"><Icons.File /></span>
				<span className="truncate">{node.name.replace(/\.md$/i, '')}</span>
			</NavLink>
			<div className="absolute right-1.5 opacity-0 group-hover/file:opacity-100 group-hover/file:pointer-events-auto pointer-events-none transition-opacity duration-150">
				<WikiActionDropdown
					parentPath={node.path}
					nodeName={node.name}
					isFile={true}
					onCreateFile={onCreateFile}
					onCreateFolder={onCreateFolder}
					onRename={onRename}
				/>
			</div>
		</div>
	);
});

const DocActionDropdown = memo(function DocActionDropdown({
	parentPath,
	isFile,
	onCreateFile,
	onCreateFolder,
}: {
	parentPath: string;
	isFile: boolean;
	onCreateFile: (parentPath: string) => void;
	onCreateFolder: (parentPath: string) => void;
}) {
	const { t } = useI18n();
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	return (
		<div className="relative flex" ref={menuRef}>
			<button
				onClick={(e) => {
					e.stopPropagation();
					setIsOpen(!isOpen);
				}}
				className="p-1 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
				title={t.common.actions}
			>
				<Icons.Plus />
			</button>
			{isOpen && (
				<div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
					{!isFile && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setIsOpen(false);
								onCreateFile(parentPath);
							}}
							className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{t.nav.createFile}
						</button>
					)}
					{!isFile && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								setIsOpen(false);
								onCreateFolder(parentPath);
							}}
							className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						>
							{t.nav.createFolder}
						</button>
					)}
				</div>
			)}
		</div>
	);
});

const DocTreeItem = memo(function DocTreeItem({
	node,
	docs,
	onCreateFile,
	onCreateFolder,
}: {
	node: DocsTreeNode;
	docs: Document[];
	onCreateFile: (parentPath: string) => void;
	onCreateFolder: (parentPath: string) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(() => {
		if (typeof window === 'undefined') return false;
		try {
			const saved = localStorage.getItem(DOCS_EXPANDED_PATHS_KEY);
			const paths: string[] = saved ? JSON.parse(saved) : [];
			return paths.includes(node.path);
		} catch {
			return false;
		}
	});

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => {
			const next = !prev;
			try {
				const saved = localStorage.getItem(DOCS_EXPANDED_PATHS_KEY);
				const paths = new Set<string>(saved ? JSON.parse(saved) : []);
				if (next) {
					paths.add(node.path);
				} else {
					paths.delete(node.path);
				}
				localStorage.setItem(DOCS_EXPANDED_PATHS_KEY, JSON.stringify(Array.from(paths)));
			} catch {
				// Ignore localStorage errors
			}
			return next;
		});
	}, [node.path]);

	if (node.type === 'directory') {
		const fileCount = countDocsFiles(node.children || []);
		const hasChildren = (node.children || []).length > 0;

		return (
			<div className="group/directory">
				<button
					onClick={() => hasChildren && toggleExpanded()}
					className={`flex items-center space-x-2 w-full px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200 ${!hasChildren ? 'cursor-default' : ''}`}
				>
					<span className="text-gray-400 dark:text-gray-500 w-4">
						{hasChildren ? (isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />) : null}
					</span>
					<span className="text-gray-400 dark:text-gray-500"><Icons.Folder /></span>
					<span className="truncate">{node.name}</span>
					{fileCount > 0 && (
						<span className="text-xs text-gray-400 dark:text-gray-500 ml-1">({fileCount})</span>
					)}
					<div className="ml-auto opacity-0 group-hover/directory:opacity-100 group-hover/directory:pointer-events-auto pointer-events-none transition-opacity duration-150">
						<DocActionDropdown
							parentPath={node.path}
							isFile={false}
							onCreateFile={onCreateFile}
							onCreateFolder={onCreateFolder}
						/>
					</div>
				</button>
				{isExpanded && node.children && (
					<div className="ml-4 space-y-1">
						{node.children.map((child) => (
							<DocTreeItem key={child.path} node={child} docs={docs} onCreateFile={onCreateFile} onCreateFolder={onCreateFolder} />
						))}
					</div>
				)}
			</div>
		);
	}

	const doc = node.docId ? docs.find(d => d.id === node.docId) : undefined;
	const docTitle = doc?.title || node.name.replace(/\.md$/i, '');
	const docId = doc?.id || node.docId || '';

	return (
		<div className="group/file relative flex items-center rounded-lg transition-colors duration-200">
			<NavLink
				to={`/documentation/${stripIdPrefix(docId)}/${sanitizeUrlTitle(docTitle)}`}
				className={({ isActive }) =>
					`flex-1 flex items-center space-x-3 px-3 py-1.5 text-sm rounded-lg transition-colors duration-200 ${
						isActive
							? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
							: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
					}`
				}
			>
				<span className="text-gray-400 dark:text-gray-500"><Icons.DocumentPage /></span>
				<span className="truncate">{docTitle}</span>
			</NavLink>
		</div>
	);
});

interface SideNavigationProps {
	tasks: Task[];
	docs: Document[];
	docsTree: DocsTreeNode[];
	decisions: Decision[];
	wikiTree: WikiTreeNode[];
	isLoading: boolean;
	error?: Error | null;
	onRetry?: () => void;
	onRefreshData: () => Promise<void>;
}

const SideNavigation = memo(function SideNavigation({
	tasks,
	docs,
	docsTree,
	decisions,
	wikiTree,
	isLoading,
	error,
	onRetry,
	onRefreshData,
}: SideNavigationProps) {
	const { t } = useI18n();
	const [isCollapsed, setIsCollapsed] = useState(() => {
		const saved = localStorage.getItem('sideNavCollapsed');
		return saved ? JSON.parse(saved) : false;
	});
	const [sidebarWidth, setSidebarWidth] = useState(() => {
		const saved = localStorage.getItem('sideNavWidth');
		return saved ? Number.parseInt(saved, 10) : 320;
	});
	const [isResizing, setIsResizing] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null);
	const [searchType, setSearchType] = useState<SearchResultType | 'all'>('all');
	const [searchTypeDropdownOpen, setSearchTypeDropdownOpen] = useState(false);
	const searchTypeDropdownRef = useRef<HTMLDivElement>(null);
	const sidebarRef = useRef<HTMLDivElement>(null);
	const resizeGhostRef = useRef<HTMLDivElement>(null);
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
	const [isWikiCollapsed, setIsWikiCollapsed] = useState(() => {
		const saved = localStorage.getItem('wikiCollapsed');
		if (saved !== null) {
			return JSON.parse(saved);
		}
		return false;
	});
	const [version, setVersion] = useState<string>('');
	const location = useLocation();
	const navigate = useNavigate();

	// Wiki create modal state
	const [showCreateWikiModal, setShowCreateWikiModal] = useState(false);
	const [createWikiParentPath, setCreateWikiParentPath] = useState('');
	const [createWikiIsFolder, setCreateWikiIsFolder] = useState(false);
	const [newWikiName, setNewWikiName] = useState('');
	const [isCreatingWiki, setIsCreatingWiki] = useState(false);
	const [createWikiError, setCreateWikiError] = useState<string | null>(null);

	// Wiki rename modal state
	const [showRenameWikiModal, setShowRenameWikiModal] = useState(false);
	const [renameWikiOldPath, setRenameWikiOldPath] = useState('');
	const [renameWikiOldName, setRenameWikiOldName] = useState('');
	const [renameWikiNewName, setRenameWikiNewName] = useState('');
	const [isRenamingWiki, setIsRenamingWiki] = useState(false);
	const [renameWikiError, setRenameWikiError] = useState<string | null>(null);

	// Docs folder modal state
	const [showCreateDocsFolderModal, setShowCreateDocsFolderModal] = useState(false);
	const [createDocsFolderParentPath, setCreateDocsFolderParentPath] = useState('');
	const [newDocsFolderName, setNewDocsFolderName] = useState('');
	const [isCreatingDocsFolder, setIsCreatingDocsFolder] = useState(false);
	const [createDocsFolderError, setCreateDocsFolderError] = useState<string | null>(null);

	const handleCreateDocFile = useCallback((parentPath: string) => {
		const query = parentPath ? `?path=${encodeURIComponent(parentPath)}` : '';
		navigate(`/documentation/new${query}`);
	}, [navigate]);

	const handleCreateDocFolder = useCallback((parentPath: string) => {
		setCreateDocsFolderParentPath(parentPath);
		setNewDocsFolderName('');
		setCreateDocsFolderError(null);
		setShowCreateDocsFolderModal(true);
	}, []);

	const executeCreateDocsFolder = useCallback(async () => {
		if (!newDocsFolderName.trim()) return;
		try {
			setIsCreatingDocsFolder(true);
			setCreateDocsFolderError(null);
			const name = newDocsFolderName.trim();
			const fullPath = createDocsFolderParentPath ? `${createDocsFolderParentPath}/${name}` : name;
			await apiClient.createDocsFolder(fullPath);
			setShowCreateDocsFolderModal(false);
			await onRefreshData();
		} catch (err) {
			setCreateDocsFolderError(err instanceof Error ? err.message : t.nav.failedToCreate);
		} finally {
			setIsCreatingDocsFolder(false);
		}
	}, [newDocsFolderName, createDocsFolderParentPath, onRefreshData, t.nav.failedToCreate]);

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

	// Save wiki collapse state to localStorage
	useEffect(() => {
		localStorage.setItem('wikiCollapsed', JSON.stringify(isWikiCollapsed));
	}, [isWikiCollapsed]);

	const handleCreateWikiFile = useCallback((parentPath: string) => {
		setCreateWikiParentPath(parentPath);
		setCreateWikiIsFolder(false);
		setNewWikiName('');
		setCreateWikiError(null);
		setShowCreateWikiModal(true);
	}, []);

	const handleCreateWikiFolder = useCallback((parentPath: string) => {
		setCreateWikiParentPath(parentPath);
		setCreateWikiIsFolder(true);
		setNewWikiName('');
		setCreateWikiError(null);
		setShowCreateWikiModal(true);
	}, []);

	const executeCreateWiki = useCallback(async () => {
		if (!newWikiName.trim()) return;
		try {
			setIsCreatingWiki(true);
			setCreateWikiError(null);

			const name = newWikiName.trim().replace(/\.md$/i, '');
			const fullPath = createWikiParentPath ? `${createWikiParentPath}/${name}` : name;

			if (createWikiIsFolder) {
				await apiClient.createWikiFolder(fullPath);
			} else {
				await apiClient.createWikiPage(fullPath);
			}
			setShowCreateWikiModal(false);
			await onRefreshData();
			if (!createWikiIsFolder) {
				navigate(`/wiki/${encodeWikiPath(fullPath)}`);
			}
		} catch (err) {
			setCreateWikiError(err instanceof Error ? err.message : t.nav.failedToCreate);
		} finally {
			setIsCreatingWiki(false);
		}
	}, [newWikiName, createWikiParentPath, createWikiIsFolder, onRefreshData, navigate]);

	const handleRenameWiki = useCallback((oldPath: string, oldName: string) => {
		setRenameWikiOldPath(oldPath);
		setRenameWikiOldName(oldName);
		setRenameWikiNewName(oldName.replace(/\.md$/i, ''));
		setRenameWikiError(null);
		setShowRenameWikiModal(true);
	}, []);

	const executeRenameWiki = useCallback(async () => {
		if (!renameWikiNewName.trim() || renameWikiNewName.trim() === renameWikiOldName.replace(/\.md$/i, '')) {
			setShowRenameWikiModal(false);
			return;
		}
		try {
			setIsRenamingWiki(true);
			setRenameWikiError(null);

			const parentPath = renameWikiOldPath.includes('/') ? renameWikiOldPath.slice(0, renameWikiOldPath.lastIndexOf('/')) : '';
			const newName = renameWikiNewName.trim();
			const isFile = renameWikiOldName.endsWith('.md');
			const newFileName = isFile && !newName.endsWith('.md') ? `${newName}.md` : newName;
			const newPath = parentPath ? `${parentPath}/${newFileName}` : newFileName;

			await apiClient.renameWikiItem(renameWikiOldPath, newPath);
			setShowRenameWikiModal(false);
			await onRefreshData();
			// If the currently viewed wiki page was renamed, navigate to the new path
			if (location.pathname.startsWith(`/wiki/${encodeWikiPath(renameWikiOldPath)}`)) {
				navigate(`/wiki/${encodeWikiPath(newPath)}`);
			}
		} catch (err) {
			setRenameWikiError(err instanceof Error ? err.message : t.nav.failedToRename);
		} finally {
			setIsRenamingWiki(false);
		}
	}, [renameWikiNewName, renameWikiOldPath, renameWikiOldName, onRefreshData, navigate, location.pathname]);

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

	useEffect(() => {
		const savedWikiCollapsed = localStorage.getItem('wikiCollapsed');
		if (savedWikiCollapsed === null && wikiTree.length > 6) {
			setIsWikiCollapsed(true);
		}
	}, [wikiTree.length]);

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
				const parsedQuery = parseSearchCommandQuery(query);
				let types: SearchResultType[] | undefined;
				if (searchType !== 'all') {
					types = [searchType];
				} else {
					types = parsedQuery.types ?? (hasTaskSearchFilters(parsedQuery) ? ['task'] : undefined);
				}
				const results = await apiClient.search({ ...parsedQuery, types, limit: 15 });
				if (!cancelled) {
					setSearchResults(results);
				}
			} catch (err) {
				console.error('Sidebar search failed:', err);
				if (!cancelled) {
					setSearchResults([]);
					setSearchError(t.nav.searchFailed);
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
	}, [searchQuery, searchType]);

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
	const filteredDecisions = decisions;

	const toggleCollapse = useCallback(() => {
		setIsCollapsed((prev: any) => !prev);
	}, []);

	// Sidebar resize handlers — mutate DOM directly during drag for smoothness
	const handleResizeStart = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setIsResizing(true);
	}, []);

	const handleResizeMove = useCallback((e: MouseEvent) => {
		if (!isResizing || !resizeGhostRef.current || !sidebarRef.current) return;
		const sidebarRect = sidebarRef.current.getBoundingClientRect();
		const newWidth = Math.max(200, Math.min(500, e.clientX - sidebarRect.left));
		resizeGhostRef.current.style.left = `${newWidth}px`;
	}, [isResizing]);

	const handleResizeEnd = useCallback(() => {
		if (isResizing && resizeGhostRef.current) {
			const finalWidth = Math.max(200, Math.min(500, resizeGhostRef.current.offsetLeft));
			setSidebarWidth(finalWidth);
			localStorage.setItem('sideNavWidth', String(finalWidth));
			setIsResizing(false);
		}
	}, [isResizing]);

	useEffect(() => {
		if (isResizing) {
			document.addEventListener('mousemove', handleResizeMove);
			document.addEventListener('mouseup', handleResizeEnd);
			document.body.style.cursor = 'col-resize';
			document.body.style.userSelect = 'none';
		} else {
			document.removeEventListener('mousemove', handleResizeMove);
			document.removeEventListener('mouseup', handleResizeEnd);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		}
		return () => {
			document.removeEventListener('mousemove', handleResizeMove);
			document.removeEventListener('mouseup', handleResizeEnd);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};
	}, [isResizing, handleResizeMove, handleResizeEnd]);

	// Close search type dropdown on click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (searchTypeDropdownRef.current && !searchTypeDropdownRef.current.contains(e.target as Node)) {
				setSearchTypeDropdownOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	return (
		<ErrorBoundary>
			<div
				ref={sidebarRef}
				className={`relative bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-full z-10 ${isCollapsed ? 'w-16 transition-all duration-300' : 'transition-all duration-300'}`}
				style={isCollapsed ? undefined : { width: sidebarWidth }}
			>
				{/* Resize Handle */}
				{!isCollapsed && !isResizing && (
					<div
						className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400/50 z-20 transition-colors"
						onMouseDown={handleResizeStart}
						title="Drag to resize sidebar"
					/>
				)}
				{/* Resize Ghost Bar */}
				{isResizing && (
					<div
						ref={resizeGhostRef}
						className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-50 pointer-events-none shadow-lg"
						style={{ left: sidebarWidth }}
					/>
				)}
			{/* Search Bar */}
			<div className={`${isCollapsed ? 'px-2' : 'px-4'} border-b border-gray-200 dark:border-gray-700 h-18 flex items-center relative`}>
				{/* Collapse Toggle Button - Always positioned on the border */}
				<button
					onClick={toggleCollapse}
					className="absolute -right-3 top-1/2 transform -translate-y-1/2 z-30 flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-circle shadow-sm hover:shadow-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200"
					aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					title={isCollapsed ? t.nav.expandSidebar : t.nav.collapseSidebar}
				>
					{isCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronLeft />}
				</button>
				
				{!isCollapsed ? (
					<div className="flex items-center w-full">
						<div className="relative flex-1" ref={searchTypeDropdownRef}>
							<button
								onClick={() => setSearchTypeDropdownOpen(!searchTypeDropdownOpen)}
								className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
								title="Search type"
							>
								{searchType === 'all' ? <Icons.Search /> :
								 searchType === 'task' ? <Icons.Tasks /> :
								 searchType === 'document' ? <Icons.Document /> :
								 searchType === 'decision' ? <Icons.Decision /> :
								 <Icons.DocumentBook />}
							</button>
							{searchTypeDropdownOpen && (
								<div className="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 py-1">
									<button
										onClick={() => { setSearchType('all'); setSearchTypeDropdownOpen(false); }}
										className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${searchType === 'all' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
									>
										<Icons.Search />
										{t.common.all}
									</button>
									<button
										onClick={() => { setSearchType('task'); setSearchTypeDropdownOpen(false); }}
										className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${searchType === 'task' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
									>
										<Icons.Tasks />
										{t.common.task}
									</button>
									<button
										onClick={() => { setSearchType('document'); setSearchTypeDropdownOpen(false); }}
										className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${searchType === 'document' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
									>
										<Icons.Document />
										{t.common.document}
									</button>
									<button
										onClick={() => { setSearchType('decision'); setSearchTypeDropdownOpen(false); }}
										className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${searchType === 'decision' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
									>
										<Icons.Decision />
										{t.common.decision}
									</button>
									<button
										onClick={() => { setSearchType('wiki'); setSearchTypeDropdownOpen(false); }}
										className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${searchType === 'wiki' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
									>
										<Icons.DocumentBook />
										{t.nav.wiki}
									</button>
								</div>
							)}
							<input
								ref={setSearchInputRef}
								type="text"
								placeholder={t.nav.searchPlaceholder}
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
								title={t.nav.search}
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
						<h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.nav.searchResults}</h3>
						{isSearching && (
							<span className="text-xs text-gray-500 dark:text-gray-400">{t.nav.searching}</span>
						)}
					</div>
					<div className="space-y-1">
								{unifiedSearchResults.map((result, index) => {
									const getResultLink = () => {
										if (result.type === 'document') {
											const doc = (result as DocumentSearchResult).document;
											return `/documentation/${stripIdPrefix(doc.id)}/${sanitizeUrlTitle(doc.title)}`;
										}
										if (result.type === 'decision') {
											const dec = (result as DecisionSearchResult).decision;
											return `/decisions/${stripIdPrefix(dec.id)}/${sanitizeUrlTitle(dec.title)}`;
										}
										if (result.type === 'wiki') {
											return `/wiki/${encodeWikiPath((result as WikiSearchResult).wiki.path)}`;
										}
										const task = (result as TaskSearchResult).task;
										return `/?highlight=${encodeURIComponent(task.id)}`;
									};

									const getResultIcon = () => {
										if (result.type === 'document') return <span className="text-green-500"><Icons.DocumentPage /></span>;
										if (result.type === 'decision') return <span className="text-stone-500"><Icons.DecisionPage /></span>;
										if (result.type === 'wiki') return <span className="text-blue-500"><Icons.WikiPage /></span>;
										return <span className="text-purple-500"><Icons.Tasks /></span>;
									};

									const getResultMeta = () => {
										if (result.type === 'document') {
											const doc = (result as DocumentSearchResult).document;
											return { title: doc.title, id: doc.id, label: t.common.document };
										}
										if (result.type === 'decision') {
											const dec = (result as DecisionSearchResult).decision;
											return { title: dec.title, id: dec.id, label: t.common.decision };
										}
										if (result.type === 'wiki') {
											const wiki = (result as WikiSearchResult).wiki;
											const title = typeof wiki.frontmatter.title === 'string' ? wiki.frontmatter.title : wiki.path.replace(/\.md$/i, '').split('/').pop() ?? wiki.path;
											return { title, id: wiki.path, label: t.nav.wiki };
										}
										const task = (result as TaskSearchResult).task;
										return { title: task.title, id: task.id, label: t.common.task };
									};

									const meta = getResultMeta();

									return (
										<NavLink
											key={`${result.type}-${meta.id}-${index}`}
											to={getResultLink()}
											className="flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100"
										>
											{getResultIcon()}
											<div className="flex-1 min-w-0">
												<div className="font-medium truncate">
													{meta.title}
												</div>
												<div className="text-xs text-gray-500 dark:text-gray-400 truncate">
													{meta.label} • {meta.id}
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
					{t.nav.noSearchResults}
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
							<p className="text-sm text-red-700 dark:text-red-400 mb-2">{t.nav.failedToLoadNav}</p>
								{onRetry && (
									<button
										onClick={onRetry}
										className="text-xs px-3 py-1 bg-red-600 dark:bg-red-700 text-white rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors duration-200"
									>
										{t.common.retry}
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
							<span className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.nav.tasks} ({tasks.length})</span>
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
							<span className="ml-3 text-sm font-medium">{t.nav.board}</span>
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
							<span className="ml-3 text-sm font-medium">{t.nav.tasks}</span>
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
							<span className="ml-3 text-sm font-medium">{t.nav.milestones}</span>
						</NavLink>

						{/* Gantt Navigation */}
						<NavLink
							to="/gantt"
							className={({ isActive }) =>
								`flex items-center px-3 py-2 rounded-lg transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium'
										: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
									}`
							}
						>
							<Icons.Gantt />
							<span className="ml-3 text-sm font-medium">{t.nav.gantt}</span>
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
							<span className="ml-3 text-sm font-medium">{t.nav.drafts}</span>
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
							<span className="ml-3 text-sm font-medium">{t.nav.statistics}</span>
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
											title={isDocsCollapsed ? t.nav.expandDocuments : t.nav.collapseDocuments}
										>
											{isDocsCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
									</button>
									<span className="text-gray-500 dark:text-gray-400"><Icons.Document /></span>
									<span className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.nav.documents} ({docs.length})</span>
								</div>
								<DocActionDropdown
									parentPath=""
									isFile={false}
									onCreateFile={handleCreateDocFile}
									onCreateFolder={handleCreateDocFolder}
								/>
							</div>
							
							{/* Document Tree */}
							{!isDocsCollapsed && (
								<div className="space-y-1">
									{docsTree.length === 0 ? (
										<p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t.nav.noDocuments}</p>
									) : (
										docsTree.map((node) => (
											<DocTreeItem key={node.path} node={node} docs={docs} onCreateFile={handleCreateDocFile} onCreateFolder={handleCreateDocFolder} />
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
											title={isDecisionsCollapsed ? t.nav.expandDecisions : t.nav.collapseDecisions}
										>
											{isDecisionsCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
									</button>
									<span className="text-gray-500 dark:text-gray-400"><Icons.Decision /></span>
									<span className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.nav.decisions} ({decisions.length})</span>
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
										<p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t.nav.noDecisions}</p>
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

						{/* Divider between Decisions and Wiki */}
						<div className="mx-4 my-2 border-t border-gray-200 dark:border-gray-700"></div>

						{/* Wiki Section */}
						<div className="px-4 py-4">
							<div className="flex items-center justify-between mb-4">
								<div className="flex items-center space-x-3">
									<button
										onClick={() => setIsWikiCollapsed(!isWikiCollapsed)}
										className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors duration-200"
										title={isWikiCollapsed ? t.nav.expandWiki : t.nav.collapseWiki}
									>
										{isWikiCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
									</button>
									<span className="text-gray-500 dark:text-gray-400"><Icons.DocumentBook /></span>
									<span className="text-sm font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 whitespace-nowrap">{t.nav.wiki} ({countWikiFiles(wikiTree)})</span>
								</div>
								<WikiActionDropdown
									nodeName=""
									isFile={false}
									parentPath=""
									onCreateFile={handleCreateWikiFile}
									onCreateFolder={handleCreateWikiFolder}
								/>
							</div>

							{/* Wiki Tree */}
							{!isWikiCollapsed && (
								<div className="space-y-1">
									{wikiTree.length === 0 ? (
										<p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t.nav.noWikiPages}</p>
									) : (
										wikiTree.map((node) => (
											<WikiTreeItem key={node.path} node={node} onCreateFile={handleCreateWikiFile} onCreateFolder={handleCreateWikiFolder} onRename={handleRenameWiki} />
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
							data-tooltip-content={t.nav.board}
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
							data-tooltip-content={t.nav.tasks}
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
							data-tooltip-content={t.nav.drafts}
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
							data-tooltip-content={t.nav.milestones}
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
						{/* Gantt Navigation */}
						<NavLink
							to="/gantt"
							data-tooltip-id="sidebar-tooltip"
							data-tooltip-content={t.nav.gantt}
							className={({ isActive }) =>
								`flex items-center justify-center p-3 rounded-md transition-colors duration-200 ${
									isActive
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`
							}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.Gantt />
							</div>
						</NavLink>
						{/* Statistics Navigation */}
						<NavLink
							to="/statistics"
							data-tooltip-id="sidebar-tooltip"
							data-tooltip-content={t.nav.statistics}
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
								data-tooltip-content={t.nav.documents}
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
								data-tooltip-content={t.nav.decisions}
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
						<button
							onClick={() => {
								setIsCollapsed(false);
								setIsWikiCollapsed(false);
							}}
								data-tooltip-id="sidebar-tooltip"
								data-tooltip-content={t.nav.wiki}
								className={`flex items-center justify-center p-3 rounded-md transition-colors duration-200 w-full ${
									location.pathname.startsWith('/wiki')
										? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-400'
										: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
								}`}
						>
							<div className="w-6 h-6 flex items-center justify-center">
								<Icons.DocumentBook />
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
						<span className="ml-3 text-sm font-medium">{t.nav.settings}</span>
						{version && (
							<span className="ml-auto text-xs text-gray-500 dark:text-gray-400">Backlog.md - v{version}</span>
						)}
					</NavLink>
				) : (
					<NavLink
						to="/settings"
						data-tooltip-id="sidebar-tooltip"
						data-tooltip-content={t.nav.settings}
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
			
				{showCreateWikiModal && (
					<Modal
						isOpen={true}
						onClose={() => setShowCreateWikiModal(false)}
						title={createWikiIsFolder ? (createWikiParentPath ? t.nav.createFolderIn(createWikiParentPath) : t.nav.createFolder) : (createWikiParentPath ? t.nav.createPageIn(createWikiParentPath) : t.nav.createPage)}
					>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									{createWikiIsFolder ? t.nav.folderName : t.nav.fileName}
								</label>
								<input
									type="text"
									value={newWikiName}
									onChange={(e) => setNewWikiName(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && executeCreateWiki()}
									placeholder={createWikiIsFolder ? t.nav.folderNamePlaceholder : t.nav.fileNamePlaceholder}
									className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
									autoFocus
								/>
								{!createWikiIsFolder && (
									<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
										{t.nav.mdExtensionHint}
									</p>
								)}
							</div>

							{createWikiError && (
								<div className="text-sm text-red-600 dark:text-red-400">{createWikiError}</div>
							)}

							<div className="flex justify-end space-x-3">
								<button
									onClick={() => setShowCreateWikiModal(false)}
									className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
								>
									{t.common.cancel}
								</button>
								<button
									onClick={executeCreateWiki}
									disabled={isCreatingWiki || !newWikiName.trim()}
									className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{isCreatingWiki ? t.common.creating : t.common.create}
								</button>
							</div>
						</div>
					</Modal>
				)}

					{showRenameWikiModal && (
						<Modal
							isOpen={true}
							onClose={() => setShowRenameWikiModal(false)}
							title={`${t.common.rename} ${renameWikiOldName}`}
						>
							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										{t.common.newName}
									</label>
									<input
										type="text"
										value={renameWikiNewName}
										onChange={(e) => setRenameWikiNewName(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && executeRenameWiki()}
										className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
										autoFocus
									/>
								</div>

								{renameWikiError && (
									<div className="text-sm text-red-600 dark:text-red-400">{renameWikiError}</div>
								)}

								<div className="flex justify-end space-x-3">
									<button
										onClick={() => setShowRenameWikiModal(false)}
										className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
									>
										{t.common.cancel}
									</button>
									<button
										onClick={executeRenameWiki}
										disabled={isRenamingWiki || !renameWikiNewName.trim()}
										className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									>
										{isRenamingWiki ? t.common.renaming : t.common.rename}
									</button>
								</div>
							</div>
						</Modal>
					)}

					{showCreateDocsFolderModal && (
						<Modal
							isOpen={true}
							onClose={() => setShowCreateDocsFolderModal(false)}
							title={createDocsFolderParentPath ? t.nav.createFolderIn(createDocsFolderParentPath) : t.nav.createFolder}
						>
							<div className="space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
										{t.nav.folderName}
									</label>
									<input
										type="text"
										value={newDocsFolderName}
										onChange={(e) => setNewDocsFolderName(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && executeCreateDocsFolder()}
										placeholder={t.nav.folderNamePlaceholder}
										className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
										autoFocus
									/>
								</div>

								{createDocsFolderError && (
									<div className="text-sm text-red-600 dark:text-red-400">{createDocsFolderError}</div>
								)}

								<div className="flex justify-end space-x-3">
									<button
										onClick={() => setShowCreateDocsFolderModal(false)}
										className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
									>
										{t.common.cancel}
									</button>
									<button
										onClick={executeCreateDocsFolder}
										disabled={isCreatingDocsFolder || !newDocsFolderName.trim()}
										className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									>
										{isCreatingDocsFolder ? t.common.creating : t.common.create}
									</button>
								</div>
							</div>
						</Modal>
					)}
			<Tooltip id="sidebar-tooltip" place="right" />
			</div>
		</ErrorBoundary>
	);
});

export default SideNavigation;
