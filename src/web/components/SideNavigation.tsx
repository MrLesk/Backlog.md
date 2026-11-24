import { useState, useEffect, useMemo, useCallback, useRef, memo, type ComponentType, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Tooltip } from 'react-tooltip';
import {
	type Decision,
	type DecisionSearchResult,
	type Document,
	type DocumentSearchResult,
	type SearchResult,
	type SearchResultType,
	type TaskSearchResult,
} from '../../types';
import { useBrowserAccess } from '../contexts/BrowserAccessContext';
import ErrorBoundary from './ErrorBoundary';
import { createRecordUrlPath, createUrlPath } from '../utils/urlHelpers';
import { getWebVersion } from '../utils/version';
import { apiClient } from '../lib/api';
import { parseSearchCommandQuery } from '../utils/search-command-query';
import { buildDocsTree, type DocsTreeNode } from '../lib/docs-tree';
import { readRememberedTaskLayout, TASK_LAYOUT_PATHS, taskLayoutOfPath } from '../lib/task-view';

const hasTaskSearchFilters = (parsedQuery: ReturnType<typeof parseSearchCommandQuery>): boolean => {
	return Boolean(
		parsedQuery.status ||
			parsedQuery.priority ||
			parsedQuery.assignee ||
			(parsedQuery.labels && parsedQuery.labels.length > 0) ||
			(parsedQuery.modifiedFiles && parsedQuery.modifiedFiles.length > 0),
	);
};

const LoadingPhase = ({ className }: { className: string }) => (
	<p className={className} role="status">
		<span
			className="inline-block h-3 w-32 animate-pulse rounded bg-line"
			aria-label="Loading content"
		/>
	</p>
);

const NavigationCount = ({
	count,
	isLoading,
	error,
	label,
}: {
	count: number;
	isLoading: boolean;
	error?: Error | null;
	label: string;
}) => {
	if (isLoading) {
		return (
			<span
				className="inline-block h-3 w-5 animate-pulse rounded bg-line align-middle"
				aria-label={`Loading ${label} count`}
			/>
		);
	}
	return error ? <span aria-label={`${label} count unavailable`}>—</span> : <span className="font-mono">{count}</span>;
};

// Icon components for better semantics and performance
const Icons = {
	Tasks: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
		</svg>
	),
	Draft: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
	Folder: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
		</svg>
	),
	Statistics: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
		</svg>
	),
	Milestone: () => (
		<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<circle cx="12" cy="12" r="9" strokeWidth={2} />
			<circle cx="12" cy="12" r="5" strokeWidth={2} />
			<circle cx="12" cy="12" r="1" strokeWidth={2} />
		</svg>
	),
};

// The icon in front of each sidebar search result.
const SEARCH_RESULT_ICONS = {
	task: Icons.Tasks,
	document: Icons.DocumentPage,
	decision: Icons.DecisionPage,
} satisfies Record<SearchResultType, ComponentType>;

// The Backlog.md logo: the document outline takes the text color, the three bars the logo teal.
const BrandMark = () => (
	<div className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
		<svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M5.5 3.5h8.6L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
			<path d="M13.8 3.8v4.5h4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
			<rect className="fill-accent" x="8.2" y="10.6" width="1.9" height="7" rx=".5" />
			<rect className="fill-accent" x="11.1" y="10.6" width="1.9" height="5.2" rx=".5" />
			<rect className="fill-accent" x="14" y="10.6" width="1.9" height="3.4" rx=".5" />
		</svg>
		<span className="truncate">
			Backlog<span className="text-accent-text">.md</span>
		</span>
	</div>
);

// The look of a sidebar row: its shape, its keyboard focus ring and whether it is the current page, which
// is the only row in medium weight. Page links, documents, folders, decisions and Settings all use it, so a
// row cannot miss the focus ring; call sites add only their layout.
const navItemClass = (isActive: boolean) =>
	`rounded-control transition-colors duration-200 focus-ring ${
		isActive ? 'bg-surface font-medium text-ink ring-1 ring-line' : 'text-ink-2 hover:bg-hover hover:text-ink'
	}`;

// The Documents and Decisions captions also link to their pages: a full row in the drawer, a caption on wide screens.
const SECTION_LINK_CLASS =
	'flex min-h-11 flex-1 items-center gap-3 whitespace-nowrap px-3 text-sm text-ink-2 hover:text-ink hover:underline focus-ring lg:min-h-0 lg:pr-0 lg:section-caption';

// The chevron after each of those captions that shows or hides its list.
const SECTION_TOGGLE_CLASS =
	'inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink transition-colors duration-200 focus-ring lg:size-auto lg:p-1';

// Shared render path for sidebar document links (search results, folder tree, and flat list).
const DocLink = ({ doc, depth = 0 }: { doc: Document; depth?: number }) => (
	<NavLink
		to={createRecordUrlPath('/documentation', doc)}
		className={({ isActive }) =>
			`flex items-center space-x-3 px-3 py-2 text-sm ${navItemClass(isActive)}`
		}
		style={depth > 0 ? { paddingLeft: `${12 + depth * 12}px` } : undefined}
	>
		<span className="text-ink-3"><Icons.DocumentPage /></span>
		<span className="truncate">{doc.title}</span>
	</NavLink>
);

interface FolderNodeProps {
	node: DocsTreeNode;
	depth: number;
	folderExpanded: Record<string, boolean>;
	onToggleFolder: (path: string) => void;
}

const FolderNode = memo(function FolderNode({ node, depth, folderExpanded, onToggleFolder }: FolderNodeProps) {
	const isExpanded = folderExpanded[node.path] ?? true;

	return (
		<div>
			<button
				onClick={() => onToggleFolder(node.path)}
				aria-label={`${node.name} folder`}
				aria-expanded={isExpanded}
				title={node.name}
				className={`flex w-full items-center px-3 py-2 text-sm ${navItemClass(false)}`}
				style={{ paddingLeft: `${12 + depth * 12}px` }}
			>
				<span className="shrink-0">{isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}</span>
				<span className="text-ink-3 ml-1 shrink-0"><Icons.Folder /></span>
				<span className="ml-2 truncate">{node.name}</span>
			</button>
			{isExpanded && (
				<div>
					{node.children.map(child => (
						<FolderNode
							key={child.path}
							node={child}
							depth={depth + 1}
							folderExpanded={folderExpanded}
							onToggleFolder={onToggleFolder}
						/>
					))}
					{node.docs.map(doc => (
						<DocLink key={doc.id} doc={doc} depth={depth + 1} />
					))}
				</div>
			)}
		</div>
	);
});

// The drawer starts with destinations. The desktop tree remembers the reader's choice.
function useSectionCollapse(key: string, count: number, inDrawer: boolean) {
	const [preference, setPreference] = useState<boolean | null>(() => {
		const saved = inDrawer ? null : localStorage.getItem(key);
		return saved === null ? null : JSON.parse(saved);
	});
	const collapsed = preference ?? (inDrawer || count > 6);
	const setCollapsed = (next: boolean) => {
		setPreference(next);
		if (!inDrawer) localStorage.setItem(key, JSON.stringify(next));
	};
	return [collapsed, setCollapsed] as const;
}

interface SideNavigationProps {
	taskCount: number;
	docs: Document[];
	decisions: Decision[];
	isLoading: boolean;
	error?: Error | null;
	onRetry?: () => void;
	onRefreshData: () => Promise<void>;
	onOpenDrawer?: () => void;
	onCloseDrawer?: () => void;
}

const SideNavigation = memo(function SideNavigation({ 
	taskCount,
	docs, 
	decisions, 
	isLoading,
	error,
	onRetry,
	onOpenDrawer,
	onCloseDrawer,
}: SideNavigationProps) {
	const { canWrite, sections } = useBrowserAccess();
	const canSearch = sections.tasks || sections.docs || sections.decisions;
	const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
		const saved = localStorage.getItem('sideNavCollapsed');
		return saved ? JSON.parse(saved) : false;
	});
	const isCollapsed = !onCloseDrawer && desktopCollapsed;
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [searchError, setSearchError] = useState<string | null>(null);
	const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null);
	const focusSearchOnExpandRef = useRef(false);
	const expandAndFocusSearch = useCallback(() => {
		focusSearchOnExpandRef.current = true;
		setDesktopCollapsed(false);
	}, []);
	const [isDocsCollapsed, setIsDocsCollapsed] = useSectionCollapse('docsCollapsed', docs.length, Boolean(onCloseDrawer));
	const [folderExpanded, setFolderExpanded] = useState<Record<string, boolean>>(() => {
		const saved = localStorage.getItem('docsFolderExpanded');
		return saved ? JSON.parse(saved) : {};
	});
	const [isDecisionsCollapsed, setIsDecisionsCollapsed] = useSectionCollapse('decisionsCollapsed', decisions.length, Boolean(onCloseDrawer));
	const [version, setVersion] = useState<string>('');
	const location = useLocation();
	const navigate = useNavigate();

	// Create handlers - just navigate to new pages
	const handleCreateDocument = useCallback(() => {
		navigate('/documentation/new');
	}, [navigate]);

	useEffect(() => {
		localStorage.setItem('sideNavCollapsed', JSON.stringify(desktopCollapsed));
	}, [desktopCollapsed]);

	// Fetch version on mount
	useEffect(() => {
		getWebVersion().then(setVersion).catch(() => setVersion(''));
	}, []);

	useEffect(() => {
		localStorage.setItem('docsFolderExpanded', JSON.stringify(folderExpanded));
	}, [folderExpanded]);

	// Add keyboard shortcut for search
	useEffect(() => {
		if (!canSearch) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				onOpenDrawer?.();
				if (isCollapsed) {
					expandAndFocusSearch();
				} else if (searchInputRef) {
					searchInputRef.focus();
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [canSearch, expandAndFocusSearch, searchInputRef, isCollapsed, onOpenDrawer]);

	// Auto-focus search only after an explicit collapsed-to-expanded transition.
	useEffect(() => {
		if (!isCollapsed && searchInputRef && focusSearchOnExpandRef.current) {
			focusSearchOnExpandRef.current = false;
			searchInputRef.focus();
		}
	}, [isCollapsed, searchInputRef]);

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
				const types: SearchResultType[] | undefined =
					parsedQuery.types ?? (hasTaskSearchFilters(parsedQuery) ? ['task'] : undefined);
				const results = await apiClient.search({ ...parsedQuery, types, limit: 15 });
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
		// No extra score cutoff: Fuse blends several weighted keys (title,
		// bodyText, id, ...) into one score, so a result that matches well on
		// one key but poorly on others can score well above any small constant
		// even for an exact substring hit in the title - on a large,
		// text-heavy project this hid most real matches. The server's own
		// Fuse threshold already decided these are matches by returning them
		// at all; sorting + slicing to 5 is enough to keep the dropdown short.
		const sorted = [...searchResults].sort((a, b) => {
			const scoreA = a.score ?? Number.POSITIVE_INFINITY;
			const scoreB = b.score ?? Number.POSITIVE_INFINITY;
			return scoreA - scoreB;
		});

		return sorted.slice(0, 5);
	}, [searchQuery, searchResults]);

	// Always show full lists in their sections, search results are separate
	const filteredDocs = docs;
	const filteredDecisions = decisions;

	const { tree, ungroupedDocs } = useMemo(() => buildDocsTree(filteredDocs), [filteredDocs]);

	const toggleFolder = useCallback((path: string) => {
		setFolderExpanded(prev => ({ ...prev, [path]: !(prev[path] ?? true) }));
	}, []);

	const toggleCollapse = useCallback(() => {
		if (isCollapsed) {
			expandAndFocusSearch();
			return;
		}
		setDesktopCollapsed(true);
	}, [expandAndFocusSearch, isCollapsed]);

	const milestoneLink = { path: '/milestones', label: 'Milestones', Icon: Icons.Milestone, visible: sections.milestones };
	const draftLink = { path: '/drafts', label: 'Drafts', Icon: Icons.Draft, visible: canWrite };
	// On the Tasks page the entry keeps the layout on screen; elsewhere it opens the layout this browser used last.
	// Its count is the only part that waits for the tasks to load, so the entry itself never moves.
	const tasksPath = TASK_LAYOUT_PATHS[taskLayoutOfPath(location.pathname) ?? readRememberedTaskLayout()];
	const taskCountBadge = <NavigationCount count={taskCount} isLoading={isLoading} error={error} label="task" />;
	const pageLinks: Array<{ path: string; label: string; Icon: ComponentType; visible: boolean; count?: ReactNode }> = [
		{ path: tasksPath, label: 'Tasks', Icon: Icons.Tasks, visible: sections.tasks, count: taskCountBadge },
		...(isCollapsed ? [draftLink, milestoneLink] : [milestoneLink, draftLink]),
		{ path: '/statistics', label: 'Statistics', Icon: Icons.Statistics, visible: sections.tasks },
	].filter(({ visible }) => visible);

	const desktopSidebarSize = isCollapsed ? 'w-16' : 'w-80 min-w-80';
	const sidebarSize = onCloseDrawer ? 'h-full w-full' : `min-h-full transition-all duration-300 ${desktopSidebarSize}`;

	return (
		<ErrorBoundary>
			<div className={`flex flex-col ${sidebarSize}`}>
			{/* Brand row: the logo, and the control that collapses the sidebar or closes the drawer. */}
			<div className={`flex h-14 shrink-0 items-center gap-2 lg:h-12 ${isCollapsed ? 'justify-center px-2' : 'pl-4 pr-2'}`}>
				{!isCollapsed && <BrandMark />}
				{onCloseDrawer ? (
					<button
						type="button"
						onClick={onCloseDrawer}
						className="flex size-11 shrink-0 items-center justify-center rounded-control text-xl text-ink-2 hover:bg-hover hover:text-ink focus-ring"
						aria-label="Close navigation menu"
					>
						×
					</button>
				) : (
					<button
						onClick={toggleCollapse}
						className="flex size-8 shrink-0 items-center justify-center rounded-control text-ink-3 hover:bg-hover hover:text-ink transition-colors duration-200 focus-ring"
						aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
						title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
					>
						{isCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronLeft />}
					</button>
				)}
			</div>

			{/* Search Bar */}
			{canSearch && (!isCollapsed ? (
				<div className="shrink-0 px-4 pb-3">
					<div className="relative">
						<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-3">
							<Icons.Search />
						</div>
						<input
							ref={setSearchInputRef}
							type="text"
							aria-label="Search project"
							placeholder={onCloseDrawer ? "Search" : "Search (⌘K)..."}
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-10 pr-8 py-2 border border-line rounded-control bg-surface text-base lg:text-sm text-ink placeholder:text-ink-3 focus-ring transition-colors duration-200"
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery('')}
								aria-label="Clear search"
								className="absolute inset-y-0 right-0 pr-3 flex items-center rounded-control text-ink-3 hover:text-ink transition-colors duration-200 focus-ring"
							>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						)}
					</div>
				</div>
			) : (
				<div className="flex shrink-0 justify-center px-2 pb-2">
					<button
						onClick={expandAndFocusSearch}
						className="flex items-center justify-center p-2 text-ink-2 hover:bg-hover hover:text-ink rounded-control transition-colors duration-200 focus-ring"
						title="Search (⌘K)"
					>
						<Icons.Search />
					</button>
				</div>
			))}

			{/* Unified Search Results */}
			{!isCollapsed && searchQuery.trim() && unifiedSearchResults.length > 0 && (
				<div className="mx-4 py-4 border-b border-line">
					<div className="flex items-center justify-between mb-3">
						<h3 className="section-caption px-3">Search Results</h3>
						{isSearching && (
							<span className="text-xs text-ink-3">Searching…</span>
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
									return createRecordUrlPath('/documentation', item);
								}
								if (result.type === 'decision') {
									return createRecordUrlPath('/decisions', item);
								}
								const taskPath = createUrlPath('/board', item.id, item.title);
								const isBoardLocation = location.pathname === '/board' || location.pathname.startsWith('/board/');
								return isBoardLocation ? `${taskPath}${location.search}` : taskPath;
							};

							const ResultIcon = SEARCH_RESULT_ICONS[result.type];

							return (
								<NavLink
									key={`${result.type}-${item.id}-${index}`}
									to={getResultLink()}
									state={
										result.type === 'task'
											? { taskModalFrom: `${location.pathname}${location.search}` }
											: undefined
									}
									className="flex items-center space-x-3 px-3 py-2 text-sm rounded-control transition-colors duration-200 hover:bg-hover text-ink focus-ring"
								>
									<span className="text-ink-3"><ResultIcon /></span>
									<div className="flex-1 min-w-0">
										<div className="font-medium truncate">
											{item.title}
										</div>
										<div className="text-xs text-ink-3 truncate">
											{result.type.charAt(0).toUpperCase() + result.type.slice(1)} • <span className="font-mono">{item.id}</span>
										</div>
									</div>
									{result.score !== null && (
										<div className="font-mono text-xs text-ink-3">
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
				<div className="mx-4 px-3 py-2 text-sm text-ink-2 border-b border-line">
					No matching results
				</div>
			)}

			{!isCollapsed && searchQuery.trim() && searchError && (
				<div className="mx-4 px-3 py-2 text-sm text-red-700 dark:text-red-400 border-b border-line">
					{searchError}
				</div>
			)}


			<nav className="flex-1 overflow-y-auto">
				{/* Error State */}
				{error && isCollapsed && onRetry && (
					<div className="px-2 py-3" role="alert">
						<button
							type="button"
							onClick={onRetry}
							className="flex w-full items-center justify-center rounded-control bg-red-50 p-3 font-bold text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 focus-ring"
							aria-label="Failed to load navigation. Retry"
							title="Failed to load navigation. Retry"
						>
							<span aria-hidden="true">!</span>
							<span className="sr-only">Retry</span>
						</button>
					</div>
				)}
				{error && !isCollapsed && (
					<div className="px-4 py-4">
						<div className="text-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-control">
							<p className="text-sm text-red-700 dark:text-red-400 mb-2">Failed to load navigation</p>
								{onRetry && (
									<button
										onClick={onRetry}
										className="text-xs px-3 py-1 bg-red-600 dark:bg-red-700 text-white rounded-control hover:bg-red-700 dark:hover:bg-red-600 transition-colors duration-200 focus-ring"
									>
										Retry
									</button>
							)}
						</div>
					</div>
				)}
				
				<div className={isCollapsed ? 'px-2 py-2 space-y-2' : 'px-4 space-y-1'}>
					{pageLinks.map(({ path, label, Icon, count }) => (
						<NavLink
							key={path}
							to={path}
							aria-label={isCollapsed ? label : undefined}
							data-tooltip-id={isCollapsed ? 'sidebar-tooltip' : undefined}
							data-tooltip-content={isCollapsed ? label : undefined}
							className={({ isActive }) => [
								'flex items-center',
								isCollapsed ? 'justify-center p-3' : 'min-h-11 px-3 py-2 lg:min-h-0',
								navItemClass(isActive),
							].join(' ')}
						>
							{isCollapsed ? (
								<div className="w-6 h-6 flex items-center justify-center"><Icon /></div>
							) : (
								<>
									<Icon />
									<span className="ml-3 text-sm">{label}</span>
									{count && <span className="ml-auto text-xs text-ink-3">{count}</span>}
								</>
							)}
						</NavLink>
					))}
				</div>

				{!isCollapsed && sections.docs && (
					<>
						{pageLinks.length > 0 && <div className="mx-4 my-2 border-t border-line" />}
						
						{/* Documents Section */}
						<div className="px-4 pt-1">
							<div className="flex items-center justify-between lg:mb-1">
								<div className="flex flex-1 items-center gap-2 lg:flex-initial lg:gap-3">
									<NavLink
										to="/documentation"
										end
										className={SECTION_LINK_CLASS}
									>
										<span className="text-ink-3"><Icons.Document /></span>
										<span>Documents (<NavigationCount count={docs.length} isLoading={isLoading} error={error} label="document" />)</span>
									</NavLink>
									<button
										onClick={() => setIsDocsCollapsed(!isDocsCollapsed)}
										className={SECTION_TOGGLE_CLASS}
										aria-expanded={!isDocsCollapsed}
										title={isDocsCollapsed ? "Expand documents" : "Collapse documents"}
									>
										{isDocsCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
									</button>
								</div>
									{canWrite && (
										<button
											onClick={handleCreateDocument}
											className="rounded-control p-1 text-ink-3 hover:bg-hover hover:text-ink transition-colors duration-200 focus-ring"
											title="Create new document"
										>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
											<circle cx="12" cy="12" r="10" />
										</svg>
									</button>
									)}
							</div>
							
							{/* Document List */}
							{!isDocsCollapsed && (
								<div className="space-y-1">
									{isLoading ? (
										<LoadingPhase className="px-3 py-2 text-sm text-ink-3" />
									) : error ? (
										<p className="px-3 py-2 text-sm text-ink-3">Documents unavailable</p>
									) : filteredDocs.length === 0 ? (
										<p className="px-3 py-2 text-sm text-ink-3">No documents</p>
									) : searchQuery.trim() ? (
										// Search results stay flat, bypassing folder grouping
										filteredDocs.map(doc => (
											<DocLink key={doc.id} doc={doc} />
										))
									) : (
										<>
											{tree.map(node => (
												<FolderNode
													key={node.path}
													node={node}
													depth={0}
													folderExpanded={folderExpanded}
													onToggleFolder={toggleFolder}
												/>
											))}
											{ungroupedDocs.map(doc => (
												<DocLink key={doc.id} doc={doc} />
											))}
										</>
									)}
								</div>
							)}
						</div>
					</>
				)}

				{!isCollapsed && sections.decisions && (
					<>
						{(pageLinks.length > 0 || sections.docs) && (
							<div className="mx-4 my-2 border-t border-line" />
						)}

						{/* Decisions Section */}
						<div className="px-4 pt-1">
							<div className="flex items-center justify-between lg:mb-1">
								<div className="flex flex-1 items-center gap-2 lg:flex-initial lg:gap-3">
									<NavLink
										to="/decisions"
										end
										className={SECTION_LINK_CLASS}
									>
										<span className="text-ink-3"><Icons.Decision /></span>
										<span>Decisions (<NavigationCount count={decisions.length} isLoading={isLoading} error={error} label="decision" />)</span>
									</NavLink>
									<button
										onClick={() => setIsDecisionsCollapsed(!isDecisionsCollapsed)}
										className={SECTION_TOGGLE_CLASS}
										aria-expanded={!isDecisionsCollapsed}
										title={isDecisionsCollapsed ? "Expand decisions" : "Collapse decisions"}
									>
										{isDecisionsCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronDown />}
									</button>
								</div>
							</div>
							
							{/* Decision List */}
							{!isDecisionsCollapsed && (
								<div className="space-y-1">
									{isLoading ? (
										<LoadingPhase className="px-3 py-2 text-sm text-ink-3" />
									) : error ? (
										<p className="px-3 py-2 text-sm text-ink-3">Decisions unavailable</p>
									) : filteredDecisions.length === 0 ? (
										<p className="px-3 py-2 text-sm text-ink-3">No decisions</p>
									) : (
										filteredDecisions.map((decision) => (
											<NavLink
												key={decision.id}
												to={createRecordUrlPath('/decisions', decision)}
												className={({ isActive }) =>
													`flex items-center space-x-3 px-3 py-2 text-sm ${navItemClass(isActive)}`
												}
											>
												<span className="text-ink-3"><Icons.DecisionPage /></span>
												<span className="truncate">{decision.title}</span>
											</NavLink>
										))
									)}
								</div>
							)}
						</div>
					</>
				)}

				{isCollapsed && (sections.docs || sections.decisions) && (
					<div className="px-2 space-y-2">
						{sections.docs && (
							<button
								onClick={() => {
									setDesktopCollapsed(false);
									setIsDocsCollapsed(false);
								}}
									data-tooltip-id="sidebar-tooltip"
									aria-label="Documentation"
								data-tooltip-content="Documentation"
									className={`flex w-full items-center justify-center p-3 ${navItemClass(location.pathname.startsWith('/documentation'))}`}
							>
								<div className="w-6 h-6 flex items-center justify-center">
									<Icons.Document />
								</div>
							</button>
						)}
						{sections.decisions && (
							<button
								onClick={() => {
									setDesktopCollapsed(false);
									setIsDecisionsCollapsed(false);
								}}
									data-tooltip-id="sidebar-tooltip"
									aria-label="Decisions"
								data-tooltip-content="Decisions"
									className={`flex w-full items-center justify-center p-3 ${navItemClass(location.pathname.startsWith('/decisions'))}`}
							>
								<div className="w-6 h-6 flex items-center justify-center">
									<Icons.Decision />
								</div>
							</button>
						)}
					</div>
				)}
			</nav>
			
			{/* Settings Button - Bottom Left */}
			<div className={`border-t border-line py-2 ${isCollapsed ? 'mx-2' : 'mx-4'}`}>
				{!isCollapsed ? (
					<NavLink
						to="/settings"
						className={({ isActive }) =>
							`flex min-h-11 items-center px-3 py-2 lg:min-h-0 ${navItemClass(isActive)}`
						}
					>
						<Icons.DocumentSettings />
						<span className="ml-3 text-sm">Settings</span>
						{version && (
							<span className="ml-auto font-mono text-xs text-ink-3">v{version}</span>
						)}
					</NavLink>
				) : (
					<NavLink
						to="/settings"
						data-tooltip-id="sidebar-tooltip"
						aria-label="Settings"
						data-tooltip-content="Settings"
						className={({ isActive }) =>
							`flex items-center justify-center p-3 ${navItemClass(isActive)}`
						}
					>
						<div className="w-6 h-6 flex items-center justify-center">
							<Icons.DocumentSettings />
						</div>
					</NavLink>
				)}
			</div>
			
			{/* The labels of the collapsed sidebar; z-20 keeps them above the content panel. */}
			<Tooltip id="sidebar-tooltip" place="right" className="z-20" />
			</div>
		</ErrorBoundary>
	);
});

export default SideNavigation;
