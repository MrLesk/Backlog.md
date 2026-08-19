/* Task viewer with search/filter header UI */

import { stdout as output } from "node:process";
import type { BoxInterface, LineInterface, ScreenInterface, ScrollableTextInterface } from "neo-neo-bblessed";
import { box, line, scrollabletext } from "neo-neo-bblessed";
import { type Core, createRuntimeCore } from "../core/backlog.ts";
import {
	buildAcceptanceCriteriaItems,
	buildDefinitionOfDoneItems,
	formatDateForDisplay,
	formatTaskPlainText,
} from "../formatters/task-plain-text.ts";
import type { Milestone, Task, TaskSearchResult } from "../types/index.ts";
import { copyToClipboard } from "../utils/clipboard.ts";
import { areLabelSelectionsEqual, collectAvailableLabels, labelsToLower } from "../utils/label-filter.ts";
import {
	createMilestoneFilterValueResolver,
	type MilestoneFilterValueResolver,
	NO_MILESTONE_FILTER_LABEL,
	NO_MILESTONE_FILTER_VALUE,
} from "../utils/milestone-filter.ts";
import { hasAnyPrefix } from "../utils/prefix-config.ts";
import { formatPriorityLabel, getPriorityOptions, normalizePriorityValue } from "../utils/priority-config.ts";
import {
	createReadinessGraph,
	formatReadinessBlockers,
	getTaskReadiness,
	type ReadinessGraph,
} from "../utils/readiness.ts";
import { canonicalTaskId, taskIdsEqual } from "../utils/task-id.ts";
import { applyTaskFilters, createTaskSearchIndex, type LabelMatchMode } from "../utils/task-search.ts";
import { attachSubtaskSummaries } from "../utils/task-subtasks.ts";
import { getTaskTypeValues, resolveTaskTypeValues } from "../utils/task-type-config.ts";
import { formatAcceptanceCriteriaProgress } from "./acceptance-criteria-progress.ts";
import { formatChecklistItem } from "./checklist.ts";
import { transformCodePaths } from "./code-path.ts";
import { openConfirmPopup } from "./components/confirm-popup.ts";
import {
	createFilterHeader,
	type FilterControlId,
	type FilterHeader,
	type FilterState,
} from "./components/filter-header.ts";
import { openMultiSelectFilterPopup, openSingleSelectFilterPopup } from "./components/filter-popup.ts";
import { type BoundaryNavigationKey, createGenericList, type GenericList } from "./components/generic-list.ts";
import { openHelpPopup } from "./components/help-popup.ts";
import { formatFooterContent, TASK_LIST_FOOTER_CONTENT } from "./footer-content.ts";
import { formatHeading } from "./heading.ts";
import { createLoadingScreen } from "./loading.ts";
import { formatStatusWithIcon, getStatusColor, getStatusIcon, wrapStatusColor } from "./status-icon.ts";
import { completeTaskFromTui, formatTaskCompletionBlockedMessage } from "./task-lifecycle.ts";
import { formatTaskTypeBadge } from "./task-type.ts";
import { addScrollKeys, createScreen, formatTuiTitle } from "./tui.ts";

function getPriorityDisplay(priority?: string): string {
	switch (normalizePriorityValue(priority)) {
		case "high":
			return " {red-fg}●{/}";
		case "medium":
			return " {yellow-fg}●{/}";
		case "low":
			return " {green-fg}●{/}";
		default:
			return "";
	}
}

export function formatTaskViewerListItem(task: Task, availableWidth = Number.POSITIVE_INFINITY): string {
	const progress = formatAcceptanceCriteriaProgress(task, availableWidth);
	// The compact status icon keeps task identity visible beside the progress indicator. Its
	// shape still distinguishes active work from the terminal-status checkmark.
	const status = progress ? getStatusIcon(task.status) : formatStatusWithIcon(task.status);
	const statusColor = getStatusColor(task.status);
	const assigneeText = task.assignee?.length
		? ` {cyan-fg}${task.assignee[0]?.startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
		: "";
	const labelsText = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";
	const typeBadge = formatTaskTypeBadge(task.type);
	const typeText = typeBadge ? ` ${typeBadge}` : "";
	const priorityText = getPriorityDisplay(task.priority);
	const isCrossBranch = Boolean((task as Task & { branch?: string }).branch);
	const branchText = isCrossBranch ? ` {green-fg}(${(task as Task & { branch?: string }).branch}){/}` : "";
	const progressText = progress ? ` ${progress}` : "";

	const content = `${wrapStatusColor(status, statusColor)}${progressText} {bold}${task.id}{/bold}${typeText} - ${task.title}${priorityText}${assigneeText}${labelsText}${branchText}`;
	return isCrossBranch ? `{gray-fg}${content}{/}` : content;
}

export function buildTaskViewerMilestoneFilterModel(
	activeMilestones: Milestone[],
	archivedMilestones: Milestone[] = [],
): {
	availableMilestoneTitles: string[];
	resolveMilestoneLabel: MilestoneFilterValueResolver;
} {
	return {
		availableMilestoneTitles: activeMilestones.map((milestone) => milestone.title),
		resolveMilestoneLabel: createMilestoneFilterValueResolver([...activeMilestones, ...archivedMilestones]),
	};
}

export type TaskListBoundaryDirection = "up" | "down";
export type PendingSearchWrap = "to-first" | "to-last" | null;
type PaneFocus = "list" | "detail";

/** What vertical navigation should do next: keep moving, hand focus to search, or stay put. */
export type ListBoundaryNavigation = "move" | "search" | "stay";

/**
 * Resolves vertical navigation in the task list and in board columns. Arrow keys hand focus
 * to the search input at a boundary (and from an empty list), while vim keys stay inside the
 * list so j/k never leave it.
 */
export function resolveListBoundaryNavigation(
	direction: TaskListBoundaryDirection,
	selectedIndex: number,
	totalTasks: number,
	key: BoundaryNavigationKey,
): ListBoundaryNavigation {
	const atBoundary = totalTasks <= 0 || (direction === "up" ? selectedIndex <= 0 : selectedIndex >= totalTasks - 1);
	if (!atBoundary) {
		return "move";
	}
	return key === "arrow" ? "search" : "stay";
}

/** The detail pane hands focus back to search only when the up arrow is pressed at the top. */
export function shouldMoveFromDetailBoundaryToSearch(scrollOffset: number, key: BoundaryNavigationKey): boolean {
	return key === "arrow" && scrollOffset <= 0;
}

export function resolveSearchExitTargetIndex(
	direction: "up" | "down" | "escape",
	pendingWrap: PendingSearchWrap,
	totalTasks: number,
	currentIndex: number | undefined,
): number | undefined {
	if (totalTasks <= 0) {
		return undefined;
	}
	if (direction === "up" && pendingWrap === "to-last") {
		return totalTasks - 1;
	}
	if (direction === "down" && pendingWrap === "to-first") {
		return 0;
	}
	return currentIndex;
}

export function resolveFilterExitPane(
	preferredPane: PaneFocus,
	hasTaskList: boolean,
	hasDetailPane: boolean,
): PaneFocus | null {
	if (preferredPane === "detail" && hasDetailPane) {
		return "detail";
	}
	if (hasTaskList) {
		return "list";
	}
	if (hasDetailPane) {
		return "detail";
	}
	return null;
}

export function resolveTaskListSelection<T>(
	items: readonly T[],
	selectedIndex: number | number[] | undefined,
	fallback: T | null = null,
): T | null {
	const index = Array.isArray(selectedIndex) ? selectedIndex[0] : selectedIndex;
	if (typeof index !== "number") {
		return fallback;
	}
	return items[index] ?? fallback;
}

/**
 * Display task details with search/filter header UI
 */
/**
 * Persistent one-line warning bar rendered above the help bar. Used for
 * data-integrity alerts (e.g. duplicate task IDs) that must stay visible
 * instead of expiring like transient help messages.
 */
export function createStartupWarningBar(parent: BoxInterface, message: string): BoxInterface {
	return box({
		parent,
		bottom: 1,
		left: 0,
		width: "100%",
		height: 1,
		tags: true,
		wrap: false,
		content: ` {yellow-fg}${message}{/}`,
	});
}

export async function viewTaskEnhanced(
	task: Task,
	options: {
		tasks?: Task[];
		core?: Core;
		title?: string;
		filterDescription?: string;
		searchQuery?: string;
		statusFilter?: string;
		excludeStatus?: string[];
		typeFilter?: string[];
		priorityFilter?: string;
		milestoneFilter?: string;
		labelFilter?: string[];
		labelMatch?: LabelMatchMode;
		readyFilter?: boolean;
		/** Unfiltered corpus for dependency readiness; defaults to the tasks being displayed. */
		readinessTasks?: Task[];
		limit?: number;
		startWithDetailFocus?: boolean;
		startWithSearchFocus?: boolean;
		startupWarning?: string;
		viewSwitcher?: import("./view-switcher.ts").ViewSwitcher;
		subscribeUpdates?: (
			update: (nextTasks: Task[], nextStatuses: string[], nextLabels: string[], nextSelectedTask?: Task) => void,
		) => void;
		onTaskChange?: (task: Task) => void;
		onTabPress?: () => Promise<void>;
		onFilterChange?: (filters: {
			searchQuery: string;
			statusFilter: string;
			excludeStatus: string[];
			typeFilter: string[];
			priorityFilter: string;
			labelFilter: string[];
			labelMatch?: LabelMatchMode;
			milestoneFilter: string;
		}) => void;
	} = {},
): Promise<void> {
	if (output.isTTY === false) {
		console.log(formatTaskPlainText(task));
		return;
	}

	// Reuse the caller's Core so every surface reads the same project root.
	const core = options.core || (await createRuntimeCore({ enableWatchers: true }));

	// Show loading screen while loading tasks (can be slow with cross-branch loading)
	let allTasks: Task[];
	let statuses: string[];
	let labels: string[];
	let priorityOptions = getPriorityOptions();
	let configuredTaskTypes = getTaskTypeValues();
	let availableLabels: string[] = [];
	// When tasks are provided, use in-memory search; otherwise use ContentStore-backed search
	let taskSearchIndex: ReturnType<typeof createTaskSearchIndex> | null = null;
	let searchService: Awaited<ReturnType<typeof core.getSearchService>> | null = null;
	let contentStore: Awaited<ReturnType<typeof core.getContentStore>> | null = null;
	// Completed tasks are loaded alongside the milestone metadata so dependency readiness can
	// resolve dependencies that already left the active corpus, without a second full task load.
	const [milestoneEntities, archivedMilestones, completedTasks] = await Promise.all([
		core.filesystem.listMilestones(),
		core.filesystem.listArchivedMilestones(),
		core.filesystem.listCompletedTasks(),
	]);
	const { availableMilestoneTitles, resolveMilestoneLabel } = buildTaskViewerMilestoneFilterModel(
		milestoneEntities,
		archivedMilestones,
	);

	let dateFormat: string | undefined;
	let projectName: string | undefined;

	if (options.tasks) {
		// Tasks already provided - use in-memory search (no ContentStore loading)
		allTasks = options.tasks.filter((t) => t.id && t.id.trim() !== "" && hasAnyPrefix(t.id));
		const config = await core.filesystem.loadConfig();
		statuses = config?.statuses || ["To Do", "In Progress", "Done"];
		labels = config?.labels || [];
		priorityOptions = getPriorityOptions(config);
		configuredTaskTypes = getTaskTypeValues(config);
		dateFormat = config?.dateFormat;
		projectName = config?.projectName;
		taskSearchIndex = createTaskSearchIndex(allTasks);
	} else {
		// Need to load tasks - show loading screen
		const loadingScreen = await createLoadingScreen("Loading tasks");
		try {
			loadingScreen?.update("Loading configuration...");
			const config = await core.filesystem.loadConfig();
			statuses = config?.statuses || ["To Do", "In Progress", "Done"];
			labels = config?.labels || [];
			priorityOptions = getPriorityOptions(config);
			configuredTaskTypes = getTaskTypeValues(config);
			dateFormat = config?.dateFormat;
			projectName = config?.projectName;

			loadingScreen?.update("Loading tasks from branches...");
			contentStore = await core.getContentStore();
			searchService = await core.getSearchService();

			loadingScreen?.update("Preparing task list...");
			const tasks = await core.queryTasks();
			allTasks = tasks.filter((t) => t.id && t.id.trim() !== "" && hasAnyPrefix(t.id));
		} finally {
			await loadingScreen?.close();
		}
	}

	// Collect available labels from config, tasks, and CLI-provided filters.
	availableLabels = collectAvailableLabels(allTasks, [...labels, ...(options.labelFilter ?? [])]);

	// Dependency readiness must resolve against the whole corpus, not the filtered display list, so
	// it uses the unfiltered snapshot when the caller narrowed what is shown. Both sides stay
	// mutable because completing a task from this view moves it between them.
	let readinessSnapshot = options.readinessTasks ? [...options.readinessTasks] : null;
	const readinessCompletedTasks = [...completedTasks];
	const buildReadinessGraph = () => {
		let tasks = allTasks;
		if (readinessSnapshot) {
			// Live display copies win over the snapshot so status edits in this session count.
			const byId = new Map(readinessSnapshot.map((task) => [canonicalTaskId(task.id), task]));
			for (const task of allTasks) byId.set(canonicalTaskId(task.id), task);
			tasks = [...byId.values()];
		}
		return createReadinessGraph({ tasks, completedTasks: readinessCompletedTasks, statuses });
	};

	// State for filtering - normalize filters to match configured values
	let searchQuery = options.searchQuery || "";

	// Find the canonical status value from configured statuses (case-insensitive)
	let statusFilter = "";
	if (options.statusFilter) {
		const lowerFilter = options.statusFilter.toLowerCase();
		const matchedStatus = statuses.find((s) => s.toLowerCase() === lowerFilter);
		statusFilter = matchedStatus || "";
	}
	const excludeStatusFilter = [...(options.excludeStatus ?? [])];

	let taskTypeFilter = resolveTaskTypeValues(options.typeFilter ?? [], configuredTaskTypes).values;
	let priorityFilter = normalizePriorityValue(options.priorityFilter) || "";
	let labelFilter: string[] = [];
	let milestoneFilter = options.milestoneFilter || "";
	let labelMatch: LabelMatchMode = options.labelMatch ?? "any";
	const taskLimit = options.limit;
	let filteredTasks = [...allTasks];

	if (options.labelFilter && options.labelFilter.length > 0) {
		const availableSet = new Set(availableLabels.map((label) => label.toLowerCase()));
		labelFilter = options.labelFilter.filter((label) => availableSet.has(label.toLowerCase()));
	}

	// Decides whether the first render goes through applyFilters(). Every filter that narrows the
	// list has to be listed here, or the flag that set it silently does nothing until something
	// else triggers a refilter.
	const filtersActive = Boolean(
		searchQuery ||
			statusFilter ||
			excludeStatusFilter.length > 0 ||
			taskTypeFilter.length > 0 ||
			priorityFilter ||
			labelFilter.length > 0 ||
			milestoneFilter ||
			options.readyFilter ||
			taskLimit !== undefined,
	);
	let requireInitialFilterSelection = filtersActive;

	const enrichTask = (candidate: Task | null): Task | null => {
		if (!candidate) return null;
		return attachSubtaskSummaries(candidate, allTasks);
	};

	// Find the initial selected task
	let currentSelectedTask = enrichTask(task) ?? task;
	let selectionRequestId = 0;
	let noResultsMessage: string | null = null;

	const screenTitle = formatTuiTitle(options.title || "Tasks", projectName);
	const screen = createScreen({ title: screenTitle });

	// Main container
	const container = box({
		parent: screen,
		width: "100%",
		height: "100%",
	});

	// State for tracking focus
	let currentFocus: "filters" | "list" | "detail" = "list";
	let filterPopupOpen = false;
	let modalOpen = false;
	let pendingSearchWrap: PendingSearchWrap = null;
	let filterExitPane: PaneFocus = "list";

	// Create filter header component
	let filterHeader: FilterHeader;

	const focusFilterControl = (filterId: FilterControlId) => {
		switch (filterId) {
			case "search":
				filterHeader.focusSearch();
				break;
			case "status":
				filterHeader.focusStatus();
				break;
			case "type":
				filterHeader.focusType();
				break;
			case "priority":
				filterHeader.focusPriority();
				break;
			case "milestone":
				filterHeader.focusMilestone();
				break;
			case "labels":
				filterHeader.focusLabels();
				break;
		}
	};

	const openFilterPicker = async (filterId: Exclude<FilterControlId, "search">) => {
		if (filterPopupOpen) {
			return;
		}
		filterPopupOpen = true;

		try {
			if (filterId === "type") {
				const nextTypes = await openMultiSelectFilterPopup({
					screen,
					title: "Task Type Filter",
					items: configuredTaskTypes,
					selectedItems: taskTypeFilter,
				});
				if (nextTypes !== null) {
					taskTypeFilter = nextTypes;
					filterHeader.setFilters({ taskTypes: nextTypes });
					applyFilters();
					notifyFilterChange();
				}
				return;
			}

			if (filterId === "labels") {
				const nextLabels = await openMultiSelectFilterPopup({
					screen,
					title: "Label Filter",
					items: [...availableLabels].sort((a, b) => a.localeCompare(b)),
					selectedItems: labelFilter,
				});
				if (nextLabels !== null) {
					labelFilter = nextLabels;
					labelMatch = "any";
					filterHeader.setFilters({ labels: nextLabels });
					applyFilters();
					notifyFilterChange();
				}
				return;
			}

			if (filterId === "status") {
				const selected = await openSingleSelectFilterPopup({
					screen,
					title: "Status Filter",
					selectedValue: statusFilter,
					choices: [{ label: "All", value: "" }, ...statuses.map((status) => ({ label: status, value: status }))],
				});
				if (selected !== null) {
					statusFilter = selected;
					filterHeader.setFilters({ status: selected });
					applyFilters();
					notifyFilterChange();
				}
				return;
			}

			if (filterId === "priority") {
				const selected = await openSingleSelectFilterPopup({
					screen,
					title: "Priority Filter",
					selectedValue: priorityFilter,
					choices: [
						{ label: "All", value: "" },
						...priorityOptions.map((priority) => ({ label: priority.label, value: priority.value })),
					],
				});
				if (selected !== null) {
					priorityFilter = selected;
					filterHeader.setFilters({ priority: selected });
					applyFilters();
					notifyFilterChange();
				}
				return;
			}

			const selected = await openSingleSelectFilterPopup({
				screen,
				title: "Milestone Filter",
				selectedValue: milestoneFilter,
				choices: [
					{ label: "All", value: "" },
					{ label: NO_MILESTONE_FILTER_LABEL, value: NO_MILESTONE_FILTER_VALUE },
					...availableMilestoneTitles.map((milestone) => ({ label: milestone, value: milestone })),
				],
			});
			if (selected !== null) {
				milestoneFilter = selected;
				filterHeader.setFilters({ milestone: selected });
				applyFilters();
				notifyFilterChange();
			}
		} finally {
			filterPopupOpen = false;
			focusFilterControl(filterId);
			screen.render();
		}
	};

	filterHeader = createFilterHeader({
		parent: container,
		statuses,
		availableLabels,
		availableMilestones: availableMilestoneTitles,
		initialFilters: {
			search: searchQuery,
			status: statusFilter,
			taskTypes: taskTypeFilter,
			priority: priorityFilter,
			labels: labelFilter,
			milestone: milestoneFilter,
		},
		onFilterChange: (filters: FilterState) => {
			const labelsChanged = !areLabelSelectionsEqual(labelFilter, filters.labels);
			searchQuery = filters.search;
			statusFilter = filters.status;
			taskTypeFilter = filters.taskTypes;
			priorityFilter = filters.priority;
			labelFilter = filters.labels;
			if (labelsChanged) {
				labelMatch = "any";
			}
			milestoneFilter = filters.milestone;
			applyFilters();
			notifyFilterChange();
		},
		onFilterPickerOpen: (filterId) => {
			void openFilterPicker(filterId);
		},
	});

	// Handle focus changes from filter header
	filterHeader.setFocusChangeHandler((focus) => {
		if (focus !== null) {
			if (currentFocus !== "filters") {
				filterExitPane = currentFocus === "detail" ? "detail" : "list";
			}
			currentFocus = "filters";
			setActivePane("none");
			updateHelpBar();
		}
	});
	filterHeader.setExitRequestHandler((direction) => {
		filterHeader.setBorderColor("cyan");
		const targetPane = resolveFilterExitPane(filterExitPane, Boolean(taskList), Boolean(descriptionBox));
		if (targetPane === "list" && taskList) {
			const selected = taskList.getSelectedIndex();
			const currentIndex = Array.isArray(selected) ? selected[0] : selected;
			const targetIndex = resolveSearchExitTargetIndex(
				direction,
				pendingSearchWrap,
				filteredTasks.length,
				currentIndex,
			);
			focusTaskList(targetIndex);
		} else if (targetPane === "detail" && descriptionBox) {
			focusDetailPane();
		}
		pendingSearchWrap = null;
	});

	// Get dynamic header height
	const getHeaderHeight = () => filterHeader.getHeight();

	// Task list pane (left 40%)
	const taskListPane = box({
		parent: container,
		top: getHeaderHeight(),
		left: 0,
		width: "40%",
		height: `100%-${getHeaderHeight() + 1}`,
		border: { type: "line" },
		style: { border: { fg: "gray" } },
		label: `\u00A0Tasks (${filteredTasks.length})\u00A0`,
	});

	// Detail pane - use right: 0 to ensure it extends to window edge
	const detailPane = box({
		parent: container,
		top: getHeaderHeight(),
		left: "40%",
		right: 0,
		height: `100%-${getHeaderHeight() + 1}`,
		border: { type: "line" },
		style: { border: { fg: "gray" } },
		label: "\u00A0Details\u00A0",
	});

	// Help bar at bottom
	const helpBar = box({
		parent: container,
		bottom: 0,
		left: 0,
		width: "100%",
		height: 1,
		tags: true,
		wrap: true,
		content: "",
	});
	const warningBar = options.startupWarning ? createStartupWarningBar(container, options.startupWarning) : null;
	let transientHelpContent: string | null = null;
	let helpRestoreTimer: ReturnType<typeof setTimeout> | null = null;

	function showTransientHelp(message: string, durationMs = 3000) {
		transientHelpContent = message;
		if (helpRestoreTimer) {
			clearTimeout(helpRestoreTimer);
			helpRestoreTimer = null;
		}
		updateHelpBar();
		helpRestoreTimer = setTimeout(() => {
			transientHelpContent = null;
			helpRestoreTimer = null;
			updateHelpBar();
		}, durationMs);
	}

	function getTerminalWidth(): number {
		return typeof screen.width === "number" ? screen.width : 80;
	}

	function getTaskListSummaryWidth(): number {
		return Math.max(1, Math.floor(getTerminalWidth() * 0.4) - 4);
	}

	function syncPaneLayout() {
		const headerHeight = filterHeader.getHeight();
		const helpHeight = typeof helpBar.height === "number" ? helpBar.height : 1;
		let footerHeight = helpHeight;
		if (warningBar) {
			warningBar.bottom = helpHeight;
			footerHeight += 1;
		}
		taskListPane.top = headerHeight;
		taskListPane.height = `100%-${headerHeight + footerHeight}`;
		detailPane.top = headerHeight;
		detailPane.height = `100%-${headerHeight + footerHeight}`;
	}

	function setHelpBarContent(content: string) {
		const formatted = formatFooterContent(content, getTerminalWidth());
		helpBar.height = formatted.height;
		helpBar.setContent(formatted.content);
		syncPaneLayout();
	}

	function setActivePane(active: "list" | "detail" | "none") {
		const listBorder = taskListPane.style as { border?: { fg?: string } };
		const detailBorder = detailPane.style as { border?: { fg?: string } };
		if (listBorder.border) listBorder.border.fg = active === "list" ? "yellow" : "gray";
		if (detailBorder.border) detailBorder.border.fg = active === "detail" ? "yellow" : "gray";
	}

	function focusTaskList(targetIndex?: number): void {
		if (!taskList) {
			if (descriptionBox) {
				currentFocus = "detail";
				setActivePane("detail");
				descriptionBox.focus();
				updateHelpBar();
				screen.render();
			}
			return;
		}
		currentFocus = "list";
		setActivePane("list");
		if (typeof targetIndex === "number") {
			taskList.setSelectedIndex(targetIndex);
		}
		taskList.focus();
		updateHelpBar();
		screen.render();
	}

	function focusDetailPane(): void {
		if (!descriptionBox) return;
		currentFocus = "detail";
		setActivePane("detail");
		descriptionBox.focus();
		updateHelpBar();
		screen.render();
	}

	// Helper to notify filter changes
	function notifyFilterChange() {
		if (options.onFilterChange) {
			options.onFilterChange({
				searchQuery,
				statusFilter,
				excludeStatus: excludeStatusFilter,
				typeFilter: taskTypeFilter,
				priorityFilter,
				labelFilter,
				labelMatch,
				milestoneFilter,
			});
		}
	}

	// Function to apply filters and refresh the task list
	function applyFilters() {
		const hasActiveFilters = Boolean(
			searchQuery.trim() ||
				statusFilter ||
				excludeStatusFilter.length > 0 ||
				taskTypeFilter.length > 0 ||
				priorityFilter ||
				labelFilter.length > 0 ||
				milestoneFilter ||
				options.readyFilter,
		);
		let nextFilteredTasks: Task[];
		if (!hasActiveFilters) {
			nextFilteredTasks = [...allTasks];
		} else if (taskSearchIndex) {
			nextFilteredTasks = applyTaskFilters(
				allTasks,
				{
					query: searchQuery,
					status: statusFilter || undefined,
					excludeStatus: excludeStatusFilter,
					type: taskTypeFilter,
					priority: priorityFilter || undefined,
					labels: labelFilter,
					labelMatch,
					milestone: milestoneFilter || undefined,
					resolveMilestoneLabel,
					ready: options.readyFilter ? buildReadinessGraph() : undefined,
				},
				taskSearchIndex,
			);
		} else if (searchService) {
			const searchResults = searchService.search({
				query: searchQuery,
				filters: {
					status: statusFilter || undefined,
					excludeStatus: excludeStatusFilter,
					type: taskTypeFilter,
					priority: priorityFilter || undefined,
					labels: labelFilter.length > 0 ? labelFilter : undefined,
				},
				types: ["task"],
			});
			nextFilteredTasks = searchResults.filter((r): r is TaskSearchResult => r.type === "task").map((r) => r.task);
			if (milestoneFilter) {
				nextFilteredTasks = nextFilteredTasks.filter((task) => {
					if (milestoneFilter === NO_MILESTONE_FILTER_VALUE) {
						return !task.milestone?.trim();
					}
					if (!task.milestone) return false;
					const taskMilestoneTitle = resolveMilestoneLabel(task.milestone);
					return taskMilestoneTitle.toLowerCase() === milestoneFilter.toLowerCase();
				});
			}
			if (labelMatch === "all" && labelFilter.length > 0) {
				const requiredLabels = labelsToLower(labelFilter);
				nextFilteredTasks = nextFilteredTasks.filter((task) => {
					const taskLabels = new Set(labelsToLower(task.labels ?? []));
					return requiredLabels.every((label) => taskLabels.has(label));
				});
			}
			if (options.readyFilter) {
				const graph = buildReadinessGraph();
				nextFilteredTasks = nextFilteredTasks.filter((task) => getTaskReadiness(task, graph).isReady);
			}
		} else {
			nextFilteredTasks = [...allTasks];
		}
		filteredTasks = taskLimit !== undefined ? nextFilteredTasks.slice(0, taskLimit) : nextFilteredTasks;

		// Update the task list label
		if (taskListPane.setLabel) {
			taskListPane.setLabel(`\u00A0Tasks (${filteredTasks.length})\u00A0`);
		}

		if (filteredTasks.length === 0) {
			if (taskList) {
				taskList.destroy();
				taskList = null;
			}
			const activeFilters: string[] = [];
			const trimmedQuery = searchQuery.trim();
			if (trimmedQuery) {
				activeFilters.push(`Search: {cyan-fg}${trimmedQuery}{/}`);
			}
			if (statusFilter) {
				activeFilters.push(`Status: {cyan-fg}${statusFilter}{/}`);
			}
			if (excludeStatusFilter.length > 0) {
				activeFilters.push(`Exclude status: {cyan-fg}${excludeStatusFilter.join(", ")}{/}`);
			}
			if (taskTypeFilter.length > 0) {
				activeFilters.push(`Type: {magenta-fg}${taskTypeFilter.join(", ")}{/}`);
			}
			if (priorityFilter) {
				activeFilters.push(`Priority: {cyan-fg}${priorityFilter}{/}`);
			}
			if (labelFilter.length > 0) {
				activeFilters.push(`Labels: {yellow-fg}${labelFilter.join(", ")}{/}`);
			}
			if (milestoneFilter) {
				const milestoneFilterLabel =
					milestoneFilter === NO_MILESTONE_FILTER_VALUE ? NO_MILESTONE_FILTER_LABEL : milestoneFilter;
				activeFilters.push(`Milestone: {magenta-fg}${milestoneFilterLabel}{/}`);
			}
			let listPaneMessage: string;
			if (activeFilters.length > 0) {
				noResultsMessage = `{bold}No tasks match your current filters{/bold}\n${activeFilters.map((f) => ` • ${f}`).join("\n")}\n\n{gray-fg}Try adjusting the search or clearing filters.{/}`;
				listPaneMessage = `{bold}No matching tasks{/bold}\n\n${activeFilters.map((f) => ` • ${f}`).join("\n")}`;
			} else {
				noResultsMessage =
					"{bold}No tasks available{/bold}\n{gray-fg}Create a task with {cyan-fg}backlog task create{/cyan-fg}.{/}";
				listPaneMessage = "{bold}No tasks available{/bold}";
			}
			showListEmptyState(listPaneMessage);
			refreshDetailPane();
			screen.render();
			return;
		}

		noResultsMessage = null;
		hideListEmptyState();

		if (taskList) {
			taskList.destroy();
			taskList = null;
		}
		const listController = createTaskList();
		taskList = listController;
		if (listController) {
			const forceFirst = requireInitialFilterSelection;
			let desiredIndex = filteredTasks.findIndex((t) => t.id === currentSelectedTask.id);
			if (forceFirst || desiredIndex < 0) {
				desiredIndex = 0;
			}
			const desiredTask = filteredTasks[desiredIndex];
			if (desiredTask && desiredTask.id !== currentSelectedTask.id) {
				currentSelectedTask = enrichTask(desiredTask) ?? desiredTask;
				options.onTaskChange?.(currentSelectedTask);
			}
			const currentIndexRaw = listController.getSelectedIndex();
			const currentIndex = Array.isArray(currentIndexRaw) ? (currentIndexRaw[0] ?? 0) : currentIndexRaw;
			if (forceFirst || currentIndex !== desiredIndex) {
				listController.setSelectedIndex(desiredIndex);
			}
			requireInitialFilterSelection = false;
		}

		// Ensure detail pane is refreshed when transitioning from no-results to results
		refreshDetailPane();
		screen.render();
	}

	// Task list component
	let taskList: GenericList<Task> | null = null;
	let listEmptyStateBox: BoxInterface | null = null;

	function showListEmptyState(message: string) {
		if (listEmptyStateBox) {
			listEmptyStateBox.destroy();
		}
		listEmptyStateBox = box({
			parent: taskListPane,
			top: 1,
			left: 1,
			width: "100%-4",
			height: "100%-3",
			content: message,
			tags: true,
			style: { fg: "gray" },
		});
	}

	function hideListEmptyState() {
		if (listEmptyStateBox) {
			listEmptyStateBox.destroy();
			listEmptyStateBox = null;
		}
	}

	async function applySelection(selectedTask: Task | null) {
		if (!selectedTask) return;
		if (currentSelectedTask && selectedTask.id === currentSelectedTask.id) {
			return;
		}
		const enriched = enrichTask(selectedTask);
		currentSelectedTask = enriched ?? selectedTask;
		options.onTaskChange?.(currentSelectedTask);
		const requestId = ++selectionRequestId;
		refreshDetailPane();
		screen.render();
		const refreshed = await core.getTaskWithSubtasks(selectedTask.id, allTasks);
		if (requestId !== selectionRequestId) {
			return;
		}
		if (refreshed) {
			currentSelectedTask = refreshed;
			options.onTaskChange?.(refreshed);
		}
		refreshDetailPane();
		screen.render();
	}

	function createTaskList(): GenericList<Task> | null {
		const initialIndex = Math.max(
			0,
			filteredTasks.findIndex((t) => t.id === currentSelectedTask.id),
		);

		taskList = createGenericList<Task>({
			parent: taskListPane,
			title: "",
			items: filteredTasks,
			selectedIndex: initialIndex,
			border: false,
			scrollbar: false,
			top: 1,
			left: 1,
			width: "100%-4",
			height: "100%-3",
			itemRenderer: (task: Task) => formatTaskViewerListItem(task, getTaskListSummaryWidth()),
			onSelect: (selected: Task | Task[]) => {
				const selectedTask = Array.isArray(selected) ? selected[0] : selected;
				void applySelection(selectedTask || null);
			},
			onHighlight: (selected: Task | null) => {
				void applySelection(selected);
			},
			onBoundaryNavigation: (direction, selectedIndex, total, key) => {
				const navigation = resolveListBoundaryNavigation(direction, selectedIndex, total, key);
				if (navigation === "move") {
					return false;
				}
				if (navigation === "search") {
					pendingSearchWrap = direction === "up" ? "to-last" : "to-first";
					filterHeader.focusSearch();
				}
				// "stay" consumes the key so vim navigation neither wraps nor leaves the list.
				return true;
			},
			showHelp: false,
		});

		// Focus handler for task list
		if (taskList) {
			const listBox = taskList.getListBox();
			listBox.on("focus", () => {
				currentFocus = "list";
				setActivePane("list");
				screen.render();
				updateHelpBar();
			});
			listBox.on("blur", () => {
				setActivePane("none");
				screen.render();
			});
			listBox.key(["right", "l"], () => {
				focusDetailPane();
				return false;
			});
		}

		return taskList;
	}

	// Detail pane refresh function
	let headerDetailBox: BoxInterface | undefined;
	let divider: LineInterface | undefined;
	let descriptionBox: ScrollableTextInterface | undefined;

	function refreshDetailPane() {
		if (headerDetailBox) headerDetailBox.destroy();
		if (divider) divider.destroy();
		if (descriptionBox) descriptionBox.destroy();

		const configureDetailBox = (boxInstance: ScrollableTextInterface) => {
			descriptionBox = boxInstance;
			const scrollable = boxInstance as unknown as {
				scroll?: (offset: number) => void;
				setScroll?: (offset: number) => void;
				setScrollPerc?: (perc: number) => void;
				getScroll?: () => number;
			};

			const pageAmount = () => {
				const height = typeof boxInstance.height === "number" ? boxInstance.height : 0;
				return height > 0 ? Math.max(1, height - 3) : 0;
			};

			// Returning true leaves the key to the built-in scroll handling, which is clamped at the top.
			const moveUpFromDetail = (key: BoundaryNavigationKey) => {
				if (!shouldMoveFromDetailBoundaryToSearch(scrollable.getScroll?.() ?? 0, key)) {
					return true;
				}
				pendingSearchWrap = null;
				filterHeader.focusSearch();
				return false;
			};

			boxInstance.key(["up"], () => moveUpFromDetail("arrow"));
			boxInstance.key(["k"], () => moveUpFromDetail("vim"));

			boxInstance.key(["pageup", "b"], () => {
				const delta = pageAmount();
				if (delta > 0) {
					scrollable.scroll?.(-delta);
					screen.render();
				}
				return false;
			});
			boxInstance.key(["pagedown", "space"], () => {
				const delta = pageAmount();
				if (delta > 0) {
					scrollable.scroll?.(delta);
					screen.render();
				}
				return false;
			});
			boxInstance.key(["home", "g"], () => {
				scrollable.setScroll?.(0);
				screen.render();
				return false;
			});
			boxInstance.key(["end", "G"], () => {
				scrollable.setScrollPerc?.(100);
				screen.render();
				return false;
			});
			boxInstance.on("focus", () => {
				currentFocus = "detail";
				setActivePane("detail");
				updateHelpBar();
				screen.render();
			});
			boxInstance.on("blur", () => {
				if (currentFocus !== "detail") {
					setActivePane(currentFocus === "list" ? "list" : "none");
					screen.render();
				}
			});
			boxInstance.key(["left", "h"], () => {
				focusTaskList();
				return false;
			});
			boxInstance.key(["escape"], () => {
				focusTaskList();
				return false;
			});
			if (currentFocus === "detail") {
				setImmediate(() => boxInstance.focus());
			}
		};

		if (noResultsMessage) {
			screen.title = screenTitle;

			headerDetailBox = box({
				parent: detailPane,
				top: 0,
				left: 1,
				right: 1,
				height: "shrink",
				tags: true,
				wrap: true,
				scrollable: false,
				padding: { left: 1, right: 1 },
				content: "{bold}No tasks to display{/bold}",
			});

			descriptionBox = undefined;
			divider = undefined;
			const messageBox = scrollabletext({
				parent: detailPane,
				top: (typeof headerDetailBox.bottom === "number" ? headerDetailBox.bottom : 0) + 1,
				left: 1,
				right: 1,
				bottom: 1,
				keys: true,
				vi: true,
				mouse: true,
				tags: true,
				wrap: true,
				padding: { left: 1, right: 1, top: 0, bottom: 0 },
				content: noResultsMessage,
			});

			configureDetailBox(messageBox);
			screen.render();
			return;
		}

		screen.title = formatTuiTitle(`Task ${currentSelectedTask.id} - ${currentSelectedTask.title}`, projectName);

		const detailContent = generateDetailContent(
			currentSelectedTask,
			resolveMilestoneLabel,
			dateFormat,
			buildReadinessGraph(),
		);

		// Calculate header height based on content and available width
		const detailPaneWidth = typeof detailPane.width === "number" ? detailPane.width : 60;
		const availableWidth = detailPaneWidth - 6; // 2 for border, 2 for box padding, 2 for header padding

		let headerLineCount = 0;
		for (const detailLine of detailContent.headerContent) {
			const plainText = detailLine.replace(/\{[^}]+\}/g, "");
			const lineCount = Math.max(1, Math.ceil(plainText.length / availableWidth));
			headerLineCount += lineCount;
		}

		headerDetailBox = box({
			parent: detailPane,
			top: 0,
			left: 1,
			right: 1,
			height: headerLineCount,
			tags: true,
			wrap: true,
			scrollable: false,
			padding: { left: 1, right: 1 },
			content: detailContent.headerContent.join("\n"),
		});

		divider = line({
			parent: detailPane,
			top: headerLineCount,
			left: 1,
			right: 1,
			orientation: "horizontal",
			style: { fg: "gray" },
		});

		const bodyContainer = scrollabletext({
			parent: detailPane,
			top: headerLineCount + 1,
			left: 1,
			right: 1,
			bottom: 1,
			keys: true,
			vi: true,
			mouse: true,
			tags: true,
			wrap: true,
			padding: { left: 1, right: 1, top: 0, bottom: 0 },
			content: detailContent.bodyContent.join("\n"),
			scrollbar: { ch: " ", inverse: true },
			style: { scrollbar: { bg: "gray" } },
		});

		configureDetailBox(bodyContainer);
	}

	// Dynamic help bar content
	function updateHelpBar() {
		if (transientHelpContent) {
			setHelpBarContent(transientHelpContent);
			screen.render();
			return;
		}

		let content = "";

		const filterFocus = filterHeader.getCurrentFocus();
		if (currentFocus === "filters" && filterFocus) {
			if (filterFocus === "search") {
				content =
					" {cyan-fg}[←/→]{/} Cursor (edge=Prev/Next) | {cyan-fg}[↑/↓]{/} Back to Tasks | {cyan-fg}[Esc]{/} Cancel | {gray-fg}(Live search){/}";
			} else {
				content = " {cyan-fg}[Enter/Space]{/} Open Picker | {cyan-fg}[←/→]{/} Prev/Next | {cyan-fg}[Esc]{/} Back";
			}
		} else if (currentFocus === "detail") {
			content =
				" {cyan-fg}[Tab]{/} View | {cyan-fg}[←]{/} List | {cyan-fg}[↑↓]{/} Scroll | {cyan-fg}[E]{/} Edit | {cyan-fg}[Y]{/} Yank | {cyan-fg}[?]{/} Help | {cyan-fg}[q]{/} Quit";
		} else {
			// Task list help
			content = TASK_LIST_FOOTER_CONTENT;
		}

		setHelpBarContent(content);
		screen.render();
	}

	const openCurrentTaskInEditor = async () => {
		if (filterPopupOpen || currentFocus === "filters" || noResultsMessage) {
			return;
		}
		const selectedTask = currentSelectedTask;

		try {
			const result = await core.editTaskInTui(selectedTask.id, screen, selectedTask);
			if (result.reason === "read_only") {
				const branchInfo = result.task?.branch ? ` in branch ${result.task.branch}` : "";
				showTransientHelp(` {red-fg}Task is read-only${branchInfo}.{/}`);
				return;
			}
			if (result.reason === "editor_failed") {
				showTransientHelp(" {red-fg}Editor exited with an error; task was not modified.{/}");
				return;
			}
			if (result.reason === "not_found") {
				showTransientHelp(` {red-fg}Task ${selectedTask.id} was not found on this branch.{/}`);
				return;
			}

			if (result.task) {
				const index = allTasks.findIndex((taskItem) => taskItem.id === selectedTask.id);
				if (index >= 0) {
					allTasks[index] = result.task;
				}
				const enhancedTask = enrichTask(result.task) ?? result.task;
				currentSelectedTask = enhancedTask;
				options.onTaskChange?.(enhancedTask);
				if (taskSearchIndex) {
					taskSearchIndex = createTaskSearchIndex(allTasks);
				}
			}

			applyFilters();
			if (result.changed) {
				showTransientHelp(` {green-fg}Task ${result.task?.id ?? selectedTask.id} marked modified.{/}`);
				return;
			}
			showTransientHelp(` {gray-fg}No changes detected for ${result.task?.id ?? selectedTask.id}.{/}`);
		} catch (_error) {
			showTransientHelp(" {red-fg}Failed to open editor.{/}");
		}
	};

	const getCurrentShortcutTask = (): Task | null => {
		if (noResultsMessage) {
			return null;
		}
		return resolveTaskListSelection(filteredTasks, taskList?.getSelectedIndex(), currentSelectedTask);
	};

	const removeTaskFromCurrentView = (taskId: string) => {
		const currentIndex = filteredTasks.findIndex((taskItem) => taskItem.id === taskId);
		const remainingFilteredTasks = filteredTasks.filter((taskItem) => taskItem.id !== taskId);
		const nextIndex = Math.min(Math.max(currentIndex, 0), remainingFilteredTasks.length - 1);
		const nextTask = remainingFilteredTasks[nextIndex] ?? null;

		allTasks = allTasks.filter((taskItem) => taskItem.id !== taskId);
		if (taskSearchIndex) {
			taskSearchIndex = createTaskSearchIndex(allTasks);
		}
		if (nextTask) {
			currentSelectedTask = enrichTask(nextTask) ?? nextTask;
			options.onTaskChange?.(currentSelectedTask);
		}
		applyFilters();
	};

	const runWithModalGuard = async <T>(operation: () => Promise<T>): Promise<T> => {
		modalOpen = true;
		try {
			return await operation();
		} finally {
			modalOpen = false;
		}
	};

	const applyTaskLifecycleShortcut = async (task: Task, action: "complete" | "archive") => {
		if (task.branch) {
			const verb = action === "complete" ? "complete" : "archive";
			showTransientHelp(` {red-fg}Cannot ${verb} task from branch "${task.branch}".{/}`);
			return;
		}

		const confirmed = await runWithModalGuard(() =>
			openConfirmPopup({
				screen,
				title: action === "complete" ? "Complete Task" : "Archive Task",
				message:
					action === "complete"
						? `Mark task {bold}${task.id}{/bold} as completed?\n{gray-fg}${task.title}{/}`
						: `Archive task {bold}${task.id}{/bold}?\n{gray-fg}${task.title}{/}`,
			}),
		);

		if (!confirmed) {
			return;
		}

		try {
			const config = action === "archive" ? await core.fs.loadConfig() : null;
			const result =
				action === "complete"
					? await completeTaskFromTui(core, task)
					: {
							success: await core.archiveTask(task.id, config?.autoCommit ?? false),
							reason: "failed" as const,
						};

			if (result.success) {
				// The record just left the active corpus, so drop it from the readiness graph. A
				// completed one is re-added as completion evidence; an archived one is simply gone, and
				// its dependents honestly report it as an unresolvable dependency from now on.
				readinessSnapshot = readinessSnapshot?.filter((candidate) => !taskIdsEqual(candidate.id, task.id)) ?? null;
				if (action === "complete") {
					readinessCompletedTasks.push(task);
				}
				removeTaskFromCurrentView(task.id);
				const label = action === "complete" ? "Completed" : "Archived";
				showTransientHelp(` {green-fg}${label} ${task.id}{/}`);
			} else if (action === "complete" && result.reason === "not-terminal") {
				showTransientHelp(` {red-fg}${formatTaskCompletionBlockedMessage(task.id, result.terminalStatus)}{/}`);
			} else {
				const verb = action === "complete" ? "complete" : "archive";
				showTransientHelp(` {red-fg}Failed to ${verb} ${task.id}{/}`);
			}
		} catch (error) {
			const verb = action === "complete" ? "completing" : "archiving";
			showTransientHelp(` {red-fg}Error ${verb} task: ${error instanceof Error ? error.message : "Unknown error"}{/}`);
		}
	};

	// Handle resize
	screen.on("resize", () => {
		filterHeader.rebuild();
		taskList?.updateItems(filteredTasks);
		updateHelpBar();
	});

	// Keyboard shortcuts
	screen.key(["/"], () => {
		if (modalOpen) return;
		pendingSearchWrap = null;
		filterHeader.focusSearch();
	});

	screen.key(["C-f"], () => {
		if (modalOpen) return;
		pendingSearchWrap = null;
		filterHeader.focusSearch();
	});

	screen.key(["s", "S"], () => {
		if (modalOpen) return;
		void openFilterPicker("status");
	});

	screen.key(["t", "T"], () => {
		if (modalOpen || filterPopupOpen) return;
		void openFilterPicker("type");
	});

	screen.key(["p", "P"], () => {
		if (modalOpen) return;
		void openFilterPicker("priority");
	});

	screen.key(["l", "L"], () => {
		if (modalOpen) return;
		void openFilterPicker("labels");
	});

	screen.key(["i", "I"], () => {
		if (modalOpen) return;
		void openFilterPicker("milestone");
	});

	screen.key(["e", "E", "S-e"], () => {
		if (modalOpen) return;
		void openCurrentTaskInEditor();
	});

	screen.key(["y", "Y"], async () => {
		if (modalOpen || filterPopupOpen || currentFocus === "filters") return;
		const task = getCurrentShortcutTask();
		if (!task) return;
		const success = await copyToClipboard(task.id);
		if (success) {
			showTransientHelp(` {green-fg}Copied ${task.id} to clipboard{/}`);
		} else {
			showTransientHelp(" {red-fg}Failed to copy to clipboard{/}");
		}
	});

	screen.key(["c", "C"], async () => {
		if (modalOpen || filterPopupOpen || currentFocus === "filters") return;
		const task = getCurrentShortcutTask();
		if (!task) return;
		await applyTaskLifecycleShortcut(task, "complete");
	});

	screen.key(["a", "A"], async () => {
		if (modalOpen || filterPopupOpen || currentFocus === "filters") return;
		const task = getCurrentShortcutTask();
		if (!task) return;
		await applyTaskLifecycleShortcut(task, "archive");
	});

	screen.key(["?"], async () => {
		if (modalOpen || filterPopupOpen) return;
		await runWithModalGuard(() => openHelpPopup(screen, "task-list"));
	});

	screen.key(["escape"], () => {
		if (modalOpen || filterPopupOpen) {
			return;
		}
		if (currentFocus === "filters") {
			filterHeader.setBorderColor("cyan");
			const targetPane = resolveFilterExitPane(filterExitPane, Boolean(taskList), Boolean(descriptionBox));
			if (targetPane === "list" && taskList) {
				focusTaskList();
			} else if (targetPane === "detail" && descriptionBox) {
				focusDetailPane();
			}
		} else if (currentFocus !== "list") {
			if (taskList) {
				focusTaskList();
			}
		} else {
			// If already in task list, quit
			searchService?.dispose();
			contentStore?.dispose();
			filterHeader.destroy();
			screen.destroy();
			process.exit(0);
		}
	});

	// Tab key handling for view switching - only when in task list
	if (options.onTabPress) {
		screen.key(["tab"], async () => {
			// Keep tab as filter-navigation while filters are focused.
			if (modalOpen || filterPopupOpen || currentFocus === "filters") {
				return;
			}
			if (currentFocus === "list" || currentFocus === "detail") {
				// Cleanup before switching
				searchService?.dispose();
				contentStore?.dispose();
				filterHeader.destroy();
				screen.destroy();
				await options.onTabPress?.();
			}
		});
	}

	// Quit handlers
	screen.key(["q", "C-c"], () => {
		if (modalOpen || filterPopupOpen) {
			return;
		}
		searchService?.dispose();
		contentStore?.dispose();
		filterHeader.destroy();
		screen.destroy();
		process.exit(0);
	});

	// Initial setup
	updateHelpBar();

	// Apply filters first if any are set
	if (filtersActive) {
		applyFilters();
	} else {
		taskList = createTaskList();
	}
	options.subscribeUpdates?.((nextTasks, nextStatuses, nextLabels, nextSelectedTask) => {
		allTasks = nextTasks;
		statuses = nextStatuses;
		labels = nextLabels;
		availableLabels = collectAvailableLabels(allTasks, labels);
		if (taskSearchIndex) taskSearchIndex = createTaskSearchIndex(allTasks);

		const previousTaskId = currentSelectedTask.id;
		const currentTask =
			allTasks.find((candidate) => candidate.id === nextSelectedTask?.id) ??
			allTasks.find((candidate) => candidate.id === currentSelectedTask.id) ??
			allTasks[0];
		if (currentTask) {
			currentSelectedTask = enrichTask(currentTask) ?? currentTask;
			if (currentSelectedTask.id !== previousTaskId) options.onTaskChange?.(currentSelectedTask);
		}
		applyFilters();
	});
	refreshDetailPane();

	if (options.startWithSearchFocus) {
		filterHeader.focusSearch();
	} else if (options.startWithDetailFocus) {
		if (descriptionBox) {
			focusDetailPane();
		}
	} else {
		// Focus the task list initially and highlight it
		if (taskList) {
			focusTaskList();
		}
	}

	screen.render();

	// Wait for screen to close
	return new Promise<void>((resolve) => {
		screen.on("destroy", () => {
			if (helpRestoreTimer) {
				clearTimeout(helpRestoreTimer);
				helpRestoreTimer = null;
			}
			searchService?.dispose();
			contentStore?.dispose();
			resolve();
		});
	});
}

export function generateDetailContent(
	task: Task,
	resolveMilestoneLabel?: (milestone: string) => string,
	dateFormat?: string,
	// Readiness is rendered only when the caller can supply the task graph to resolve dependencies
	// against. Callers without one (the board quick-look popup) get no readiness line rather than a
	// wrong one derived from an empty graph.
	readinessGraph?: ReadinessGraph,
): { headerContent: string[]; bodyContent: string[] } {
	const headerContent = [
		` ${wrapStatusColor(formatStatusWithIcon(task.status), getStatusColor(task.status))} {bold}{blue-fg}${task.id}{/blue-fg}{/bold} - ${task.title}`,
	];

	// Add cross-branch indicator if task is from another branch
	const isCrossBranch = Boolean((task as Task & { branch?: string }).branch);
	if (isCrossBranch) {
		const branchName = (task as Task & { branch?: string }).branch;
		headerContent.push(
			` {yellow-fg}⚠ Read-only:{/} This task exists in branch {green-fg}${branchName}{/}. Switch to that branch to edit it.`,
		);
	}

	const bodyContent: string[] = [];
	bodyContent.push(formatHeading("Details", 2));

	const metadata: string[] = [];
	metadata.push(`{bold}Created:{/bold} ${formatDateForDisplay(task.createdDate, { dateFormat })}`);
	if (task.updatedDate && task.updatedDate !== task.createdDate) {
		metadata.push(`{bold}Updated:{/bold} ${formatDateForDisplay(task.updatedDate, { dateFormat })}`);
	}
	if (task.priority) {
		const priorityDisplay = getPriorityDisplay(task.priority);
		const priorityText = formatPriorityLabel(task.priority);
		metadata.push(`{bold}Priority:{/bold} ${priorityText}${priorityDisplay}`);
	}
	if (task.type) {
		metadata.push(`{bold}Type:{/bold} ${formatTaskTypeBadge(task.type)}`);
	}
	if (task.assignee?.length) {
		const assigneeList = task.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ");
		metadata.push(`{bold}Assignee:{/bold} {cyan-fg}${assigneeList}{/}`);
	}
	if (task.labels?.length) {
		metadata.push(`{bold}Labels:{/bold} ${task.labels.map((l) => `{yellow-fg}[${l}]{/}`).join(" ")}`);
	}
	if (task.reporter) {
		const reporterText = task.reporter.startsWith("@") ? task.reporter : `@${task.reporter}`;
		metadata.push(`{bold}Reporter:{/bold} {cyan-fg}${reporterText}{/}`);
	}
	if (task.milestone) {
		const milestoneLabel = resolveMilestoneLabel ? resolveMilestoneLabel(task.milestone) : task.milestone;
		metadata.push(`{bold}Milestone:{/bold} {magenta-fg}${milestoneLabel}{/}`);
	}
	if (task.parentTaskId) {
		const parentLabel = task.parentTaskTitle ? `${task.parentTaskId} - ${task.parentTaskTitle}` : task.parentTaskId;
		metadata.push(`{bold}Parent:{/bold} {blue-fg}${parentLabel}{/}`);
	}
	if (task.subtasks?.length) {
		metadata.push(`{bold}Subtasks:{/bold} ${task.subtasks.length} task${task.subtasks.length > 1 ? "s" : ""}`);
	}
	if (task.dependencies?.length) {
		metadata.push(`{bold}Dependencies:{/bold} ${task.dependencies.join(", ")}`);
		// Readiness only earns a line when dependencies exist; otherwise the status already says it.
		if (readinessGraph) {
			const readiness = getTaskReadiness(task, readinessGraph);
			if (readiness.isReady) {
				metadata.push("{bold}Readiness:{/bold} {green-fg}✓ Ready to start{/}");
			} else if (readiness.isBlocked) {
				// Single-width glyphs only: blessed miscounts East Asian Wide characters and leaves
				// stale cells behind when the detail pane re-renders a shorter line.
				metadata.push(`{bold}Readiness:{/bold} {yellow-fg}● ${formatReadinessBlockers(readiness)}{/}`);
			}
		}
	}
	if (task.modifiedFiles?.length) {
		metadata.push(`{bold}Modified files:{/bold} ${task.modifiedFiles.join(", ")}`);
	}

	bodyContent.push(metadata.join("\n"));
	bodyContent.push("");

	bodyContent.push(formatHeading("Description", 2));
	const descriptionText = task.description?.trim();
	const descriptionContent = descriptionText
		? transformCodePaths(descriptionText)
		: "{gray-fg}No description provided{/}";
	bodyContent.push(descriptionContent);
	bodyContent.push("");

	if (task.references?.length) {
		bodyContent.push(formatHeading("References", 2));
		const formattedRefs = task.references.map((ref) => {
			// Color URLs differently from file paths
			if (ref.startsWith("http://") || ref.startsWith("https://")) {
				return `  {cyan-fg}${ref}{/}`;
			}
			return `  {yellow-fg}${ref}{/}`;
		});
		bodyContent.push(formattedRefs.join("\n"));
		bodyContent.push("");
	}

	if (task.documentation?.length) {
		bodyContent.push(formatHeading("Documentation", 2));
		const formattedDocs = task.documentation.map((doc) => {
			if (doc.startsWith("http://") || doc.startsWith("https://")) {
				return `  {cyan-fg}${doc}{/}`;
			}
			return `  {yellow-fg}${doc}{/}`;
		});
		bodyContent.push(formattedDocs.join("\n"));
		bodyContent.push("");
	}

	bodyContent.push(formatHeading("Acceptance Criteria", 2));
	const checklistItems = buildAcceptanceCriteriaItems(task);
	if (checklistItems.length > 0) {
		const formattedCriteria = checklistItems.map((item) =>
			formatChecklistItem(
				{
					text: transformCodePaths(item.text),
					checked: item.checked,
				},
				{
					padding: " ",
					checkedSymbol: "{green-fg}✓{/}",
					uncheckedSymbol: "{gray-fg}○{/}",
				},
			),
		);
		bodyContent.push(formattedCriteria.join("\n"));
	} else {
		bodyContent.push("{gray-fg}No acceptance criteria defined{/}");
	}
	bodyContent.push("");

	bodyContent.push(formatHeading("Definition of Done", 2));
	const definitionItems = buildDefinitionOfDoneItems(task);
	if (definitionItems.length > 0) {
		const formattedDefinition = definitionItems.map((item) =>
			formatChecklistItem(
				{
					text: transformCodePaths(item.text),
					checked: item.checked,
				},
				{
					padding: " ",
					checkedSymbol: "{green-fg}✓{/}",
					uncheckedSymbol: "{gray-fg}○{/}",
				},
			),
		);
		bodyContent.push(formattedDefinition.join("\n"));
	} else {
		bodyContent.push("{gray-fg}No Definition of Done items defined{/}");
	}
	bodyContent.push("");

	const implementationPlan = task.implementationPlan?.trim();
	if (implementationPlan) {
		bodyContent.push(formatHeading("Implementation Plan", 2));
		bodyContent.push(transformCodePaths(implementationPlan));
		bodyContent.push("");
	}

	const implementationNotes = task.implementationNotes?.trim();
	if (implementationNotes) {
		bodyContent.push(formatHeading("Implementation Notes", 2));
		bodyContent.push(transformCodePaths(implementationNotes));
		bodyContent.push("");
	}

	const comments = (task.comments ?? []).filter((comment) => comment.body.trim().length > 0);
	if (comments.length > 0) {
		bodyContent.push(formatHeading("Comments", 2));
		for (const comment of comments) {
			const parts = [`#${comment.index}`];
			if (comment.author) parts.push(comment.author);
			if (comment.createdDate) parts.push(formatDateForDisplay(comment.createdDate, { dateFormat }));
			bodyContent.push(`{bold}${parts.join(" - ")}{/bold}`);
			bodyContent.push(transformCodePaths(comment.body.trim()));
			bodyContent.push("");
		}
	}

	const finalSummary = task.finalSummary?.trim();
	if (finalSummary) {
		bodyContent.push(formatHeading("Final Summary", 2));
		bodyContent.push(transformCodePaths(finalSummary));
		bodyContent.push("");
	}

	return { headerContent, bodyContent };
}

export async function createTaskPopup(
	screen: ScreenInterface,
	task: Task,
	resolveMilestoneLabel?: (milestone: string) => string,
	dateFormat?: string,
): Promise<{
	background: BoxInterface;
	popup: BoxInterface;
	contentArea: ScrollableTextInterface;
	close: () => void;
} | null> {
	if (output.isTTY === false) return null;

	const popup = box({
		parent: screen,
		top: "center",
		left: "center",
		width: "85%",
		height: "80%",
		border: "line",
		style: {
			border: { fg: "gray" },
		},
		keys: true,
		tags: true,
		autoPadding: true,
	});

	const background = box({
		parent: screen,
		top: Number(popup.top ?? 0) - 1,
		left: Number(popup.left ?? 0) - 2,
		width: Number(popup.width ?? 0) + 4,
		height: Number(popup.height ?? 0) + 2,
		style: {
			bg: "black",
		},
	});

	popup.setFront?.();

	const { headerContent, bodyContent } = generateDetailContent(task, resolveMilestoneLabel, dateFormat);

	// Calculate header height based on content and available width
	const popupWidth = typeof popup.width === "number" ? popup.width : 80;
	const availableWidth = popupWidth - 6;

	let headerLineCount = 0;
	for (const headerLine of headerContent) {
		const plainText = headerLine.replace(/\{[^}]+\}/g, "");
		const lineCount = Math.max(1, Math.ceil(plainText.length / availableWidth));
		headerLineCount += lineCount;
	}

	box({
		parent: popup,
		top: 0,
		left: 1,
		right: 1,
		height: headerLineCount,
		tags: true,
		wrap: true,
		scrollable: false,
		padding: { left: 1, right: 1 },
		content: headerContent.join("\n"),
	});

	line({
		parent: popup,
		top: headerLineCount,
		left: 1,
		right: 1,
		orientation: "horizontal",
		style: { fg: "gray" },
	});

	box({
		parent: popup,
		content: " Esc ",
		top: -1,
		right: 1,
		width: 5,
		height: 1,
		style: { inverse: true, bold: true },
	});

	const contentArea = scrollabletext({
		parent: popup,
		top: headerLineCount + 1,
		left: 1,
		right: 1,
		bottom: 1,
		keys: true,
		vi: true,
		mouse: true,
		tags: true,
		wrap: true,
		padding: { left: 1, right: 1, top: 0, bottom: 0 },
		content: bodyContent.join("\n"),
		scrollbar: { ch: " ", inverse: true },
		style: { scrollbar: { bg: "gray" } },
	});

	addScrollKeys(contentArea, screen);

	const closePopup = () => {
		popup.destroy();
		background.destroy();
		screen.render();
	};

	popup.key(["escape", "q", "C-c"], () => {
		closePopup();
		return false;
	});

	contentArea.on("focus", () => {
		const popupStyle = popup.style as { border?: { fg?: string } };
		popupStyle.border = { ...(popupStyle.border ?? {}), fg: "yellow" };
		screen.render();
	});

	contentArea.on("blur", () => {
		const popupStyle = popup.style as { border?: { fg?: string } };
		popupStyle.border = { ...(popupStyle.border ?? {}), fg: "gray" };
		screen.render();
	});

	contentArea.key(["escape"], () => {
		closePopup();
		return false;
	});

	setImmediate(() => {
		contentArea.focus();
	});

	return {
		background,
		popup,
		contentArea,
		close: closePopup,
	};
}
