/* Task viewer with search/filter header UI */

import { stdout as output } from "node:process";
import type { BoxInterface, LineInterface, ScreenInterface, ScrollableTextInterface } from "neo-neo-bblessed";
import { box, line, scrollabletext } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import {
	buildAcceptanceCriteriaItems,
	buildDefinitionOfDoneItems,
	formatDateForDisplay,
	formatTaskPlainText,
} from "../formatters/task-plain-text.ts";
import type { Task, TaskSearchResult } from "../types/index.ts";
import { collectAvailableLabels } from "../utils/label-filter.ts";
import { hasAnyPrefix } from "../utils/prefix-config.ts";
import { createTaskSearchIndex } from "../utils/task-search.ts";
import { attachSubtaskSummaries } from "../utils/task-subtasks.ts";
import { formatChecklistItem } from "./checklist.ts";
import { transformCodePaths } from "./code-path.ts";
import { createFilterHeader, type FilterHeader, type FilterState } from "./components/filter-header.ts";
import { createGenericList, type GenericList } from "./components/generic-list.ts";
import { formatHeading } from "./heading.ts";
import { createLoadingScreen } from "./loading.ts";
import { formatStatusWithIcon, getStatusColor } from "./status-icon.ts";
import { createScreen } from "./tui.ts";

function getPriorityDisplay(priority?: "high" | "medium" | "low"): string {
	switch (priority) {
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

/**
 * Display task details with search/filter header UI
 */
export async function viewTaskEnhanced(
	task: Task,
	options: {
		tasks?: Task[];
		core?: Core;
		title?: string;
		filterDescription?: string;
		searchQuery?: string;
		statusFilter?: string;
		priorityFilter?: string;
		labelFilter?: string[];
		startWithDetailFocus?: boolean;
		startWithSearchFocus?: boolean;
		viewSwitcher?: import("./view-switcher.ts").ViewSwitcher;
		onTaskChange?: (task: Task) => void;
		onTabPress?: () => Promise<void>;
		onFilterChange?: (filters: {
			searchQuery: string;
			statusFilter: string;
			priorityFilter: string;
			labelFilter: string[];
		}) => void;
	} = {},
): Promise<void> {
	if (output.isTTY === false) {
		console.log(formatTaskPlainText(task));
		return;
	}

	// Get project root and setup services
	const cwd = process.cwd();
	const core = options.core || new Core(cwd, { enableWatchers: true });

	// Show loading screen while loading tasks (can be slow with cross-branch loading)
	let allTasks: Task[];
	let statuses: string[];
	let labels: string[];
	let availableLabels: string[] = [];
	// When tasks are provided, use in-memory search; otherwise use ContentStore-backed search
	let taskSearchIndex: ReturnType<typeof createTaskSearchIndex> | null = null;
	let searchService: Awaited<ReturnType<typeof core.getSearchService>> | null = null;
	let contentStore: Awaited<ReturnType<typeof core.getContentStore>> | null = null;

	if (options.tasks) {
		// Tasks already provided - use in-memory search (no ContentStore loading)
		allTasks = options.tasks.filter((t) => t.id && t.id.trim() !== "" && hasAnyPrefix(t.id));
		const config = await core.filesystem.loadConfig();
		statuses = config?.statuses || ["To Do", "In Progress", "Done"];
		labels = config?.labels || [];
		taskSearchIndex = createTaskSearchIndex(allTasks);
	} else {
		// Need to load tasks - show loading screen
		const loadingScreen = await createLoadingScreen("Loading tasks");
		try {
			loadingScreen?.update("Loading configuration...");
			const config = await core.filesystem.loadConfig();
			statuses = config?.statuses || ["To Do", "In Progress", "Done"];
			labels = config?.labels || [];

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

	// Collect available labels from config and tasks
	availableLabels = collectAvailableLabels(allTasks, labels);

	// State for filtering - normalize filters to match configured values
	let searchQuery = options.searchQuery || "";

	// Find the canonical status value from configured statuses (case-insensitive)
	let statusFilter = "";
	if (options.statusFilter) {
		const lowerFilter = options.statusFilter.toLowerCase();
		const matchedStatus = statuses.find((s) => s.toLowerCase() === lowerFilter);
		statusFilter = matchedStatus || "";
	}

	// Priority is already lowercase
	let priorityFilter = options.priorityFilter || "";
	let labelFilter: string[] = [];
	let filteredTasks = [...allTasks];

	if (options.labelFilter && options.labelFilter.length > 0) {
		const availableSet = new Set(availableLabels.map((label) => label.toLowerCase()));
		labelFilter = options.labelFilter.filter((label) => availableSet.has(label.toLowerCase()));
	}

	const filtersActive = Boolean(searchQuery || statusFilter || priorityFilter || labelFilter.length > 0);
	let requireInitialFilterSelection = filtersActive;

	const enrichTask = (candidate: Task | null): Task | null => {
		if (!candidate) return null;
		return attachSubtaskSummaries(candidate, allTasks);
	};

	// Find the initial selected task
	let currentSelectedTask = enrichTask(task) ?? task;
	let selectionRequestId = 0;
	let noResultsMessage: string | null = null;

	const screen = createScreen({ title: options.title || "Backlog Tasks" });

	// Main container
	const container = box({
		parent: screen,
		width: "100%",
		height: "100%",
	});

	// State for tracking focus
	let currentFocus: "filters" | "list" | "detail" = "list";
	let labelPickerOpen = false;

	// Create filter header component
	let filterHeader: FilterHeader;

	const openLabelPicker = () => {
		if (labelPickerOpen || availableLabels.length === 0) return;

		labelPickerOpen = true;

		// Create popup first to get dimensions for backdrop
		const popup = box({
			parent: screen,
			top: "center",
			left: "center",
			width: "50%",
			height: "70%",
			border: { type: "line" },
			style: {
				border: { fg: "yellow" },
			},
			label: "\u00A0Label Filter\u00A0",
			tags: true,
		});

		const resolveDimension = (value: number | string | undefined, total: number): number => {
			if (typeof value === "number") return value;
			if (typeof value === "string") {
				if (value.endsWith("%")) {
					const pct = Number.parseFloat(value);
					return Number.isFinite(pct) ? Math.floor((pct / 100) * total) : 0;
				}
			}
			return 0;
		};

		const resolvePosition = (value: number | string | undefined, total: number, size: number): number => {
			if (typeof value === "number") return value;
			if (value === "center") return Math.max(0, Math.floor((total - size) / 2));
			if (typeof value === "string" && value.endsWith("%")) {
				const pct = Number.parseFloat(value);
				if (Number.isFinite(pct)) {
					return Math.floor((pct / 100) * total);
				}
			}
			return 0;
		};

		const screenWidth = screen.width ?? 0;
		const screenHeight = screen.height ?? 0;
		const popupWidth = resolveDimension(popup.width ?? "50%", screenWidth);
		const popupHeight = resolveDimension(popup.height ?? "70%", screenHeight);
		const popupTop = resolvePosition(popup.top ?? "center", screenHeight, popupHeight);
		const popupLeft = resolvePosition(popup.left ?? "center", screenWidth, popupWidth);

		// Create backdrop behind the popup
		const backdrop = box({
			parent: screen,
			top: Math.max(0, popupTop - 1),
			left: Math.max(0, popupLeft - 2),
			width: Math.min(screenWidth, popupWidth + 4),
			height: Math.min(screenHeight, popupHeight + 2),
			style: {
				bg: "black",
			},
		});

		// Bring popup to front
		popup.setFront?.();

		// Help text at bottom of popup
		const helpBox = box({
			parent: popup,
			bottom: 0,
			left: 1,
			right: 1,
			height: 1,
			tags: true,
			content: "{gray-fg}↑/↓ navigate · Space toggle · Enter confirm · Esc cancel{/}",
		});

		const labelItems = [...availableLabels]
			.map((label) => label.trim())
			.filter((label) => label.length > 0)
			.sort((a, b) => a.localeCompare(b))
			.map((label) => ({ id: label }));

		const selectedLabelSet = new Set(labelFilter.map((label) => label.toLowerCase()));
		const selectedIndices = labelItems
			.map((item, index) => (selectedLabelSet.has(item.id.toLowerCase()) ? index : -1))
			.filter((index) => index >= 0);

		type LabelItem = { id: string };

		const picker = createGenericList<LabelItem>({
			parent: popup,
			items: labelItems,
			multiSelect: true,
			selectedIndices,
			border: false,
			showHelp: false,
			top: 0,
			left: 1,
			width: "100%-4",
			height: "100%-3",
			keys: { cancel: ["C-c"] },
			style: {
				selected: { fg: "white", bg: "blue" },
				item: { fg: "white" },
			},
			itemRenderer: (item) => item.id,
			onSelect: (selected) => {
				const nextLabels = (Array.isArray(selected) ? selected : []).map((item) => item.id);
				applyLabelSelection(nextLabels);
			},
		});

		const pickerBox = picker.getListBox();

		const closePicker = (restoreFocus: boolean) => {
			labelPickerOpen = false;
			picker.destroy();
			helpBox.destroy();
			popup.destroy();
			backdrop.destroy();
			filterHeader.setBorderColor("cyan");
			screen.render();
			if (restoreFocus && taskList) {
				focusTaskList();
			}
		};

		const applyLabelSelection = (nextLabels: string[]) => {
			labelFilter = nextLabels;
			filterHeader.setLabels(nextLabels);
			applyFilters();
			notifyFilterChange();
			closePicker(true);
		};

		pickerBox.key(["escape", "q"], () => {
			closePicker(true);
			return false;
		});

		setImmediate(() => {
			picker.focus();
			screen.render();
		});
		screen.render();
	};

	filterHeader = createFilterHeader({
		parent: container,
		statuses,
		availableLabels,
		initialFilters: {
			search: searchQuery,
			status: statusFilter,
			priority: priorityFilter,
			labels: labelFilter,
		},
		onFilterChange: (filters: FilterState) => {
			searchQuery = filters.search;
			statusFilter = filters.status;
			priorityFilter = filters.priority;
			labelFilter = filters.labels;
			applyFilters();
			notifyFilterChange();
		},
		onLabelPickerOpen: openLabelPicker,
	});

	// Handle focus changes from filter header
	filterHeader.setFocusChangeHandler((focus) => {
		if (focus === null) {
			// User wants to leave filters
			filterHeader.setBorderColor("cyan");
			if (taskList) {
				focusTaskList();
			} else if (descriptionBox) {
				focusDetailPane();
			}
		} else {
			currentFocus = "filters";
			setActivePane("none");
			updateHelpBar();
		}
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
		content: "",
	});

	function setActivePane(active: "list" | "detail" | "none") {
		const listBorder = taskListPane.style as { border?: { fg?: string } };
		const detailBorder = detailPane.style as { border?: { fg?: string } };
		if (listBorder.border) listBorder.border.fg = active === "list" ? "yellow" : "gray";
		if (detailBorder.border) detailBorder.border.fg = active === "detail" ? "yellow" : "gray";
	}

	function focusTaskList(): void {
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
				priorityFilter,
				labelFilter,
			});
		}
	}

	// Function to apply filters and refresh the task list
	function applyFilters() {
		// Check for non-empty search query or active filters
		if (searchQuery.trim() || statusFilter || priorityFilter || labelFilter.length > 0) {
			// Use in-memory search if available, otherwise use ContentStore-backed search
			if (taskSearchIndex) {
				filteredTasks = taskSearchIndex.search({
					query: searchQuery,
					status: statusFilter || undefined,
					priority: priorityFilter as "high" | "medium" | "low" | undefined,
					labels: labelFilter,
				});
			} else if (searchService) {
				const searchResults = searchService.search({
					query: searchQuery,
					filters: {
						status: statusFilter || undefined,
						priority: priorityFilter as "high" | "medium" | "low" | undefined,
						labels: labelFilter.length > 0 ? labelFilter : undefined,
					},
					types: ["task"],
				});
				filteredTasks = searchResults.filter((r): r is TaskSearchResult => r.type === "task").map((r) => r.task);
			} else {
				filteredTasks = [...allTasks];
			}
		} else {
			// No filters, show all tasks
			filteredTasks = [...allTasks];
		}

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
			if (priorityFilter) {
				activeFilters.push(`Priority: {cyan-fg}${priorityFilter}{/}`);
			}
			if (labelFilter.length > 0) {
				activeFilters.push(`Labels: {yellow-fg}${labelFilter.join(", ")}{/}`);
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
			top: 1,
			left: 1,
			width: "100%-4",
			height: "100%-3",
			itemRenderer: (task: Task) => {
				const statusIcon = formatStatusWithIcon(task.status);
				const statusColor = getStatusColor(task.status);
				const assigneeText = task.assignee?.length
					? ` {cyan-fg}${task.assignee[0]?.startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
					: "";
				const labelsText = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";
				const priorityText = getPriorityDisplay(task.priority);
				const isCrossBranch = Boolean((task as Task & { branch?: string }).branch);
				const branchText = isCrossBranch ? ` {green-fg}(${(task as Task & { branch?: string }).branch}){/}` : "";

				const content = `{${statusColor}-fg}${statusIcon}{/} {bold}${task.id}{/bold} - ${task.title}${priorityText}${assigneeText}${labelsText}${branchText}`;
				// Dim cross-branch tasks to indicate read-only status
				return isCrossBranch ? `{gray-fg}${content}{/}` : content;
			},
			onSelect: (selected: Task | Task[]) => {
				const selectedTask = Array.isArray(selected) ? selected[0] : selected;
				void applySelection(selectedTask || null);
			},
			onHighlight: (selected: Task | null) => {
				void applySelection(selected);
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
			};

			const pageAmount = () => {
				const height = typeof boxInstance.height === "number" ? boxInstance.height : 0;
				return height > 0 ? Math.max(1, height - 3) : 0;
			};

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
			screen.title = options.title || "Backlog Tasks";

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

		screen.title = `Task ${currentSelectedTask.id} - ${currentSelectedTask.title}`;

		const detailContent = generateDetailContent(currentSelectedTask);

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
		});

		configureDetailBox(bodyContainer);
	}

	// Dynamic help bar content
	function updateHelpBar() {
		let content = "";

		const filterFocus = filterHeader.getCurrentFocus();
		if (currentFocus === "filters" && filterFocus) {
			if (filterFocus === "search") {
				content =
					" {cyan-fg}[Tab]{/} Next Filter | {cyan-fg}[↓]{/} Task List | {cyan-fg}[Esc]{/} Cancel | {gray-fg}(Live search){/}";
			} else if (filterFocus === "labels") {
				content = " {cyan-fg}[Enter/Space]{/} Open Picker | {cyan-fg}[Tab]{/} Next | {cyan-fg}[Esc]{/} Back to Tasks";
			} else {
				content =
					" {cyan-fg}[Tab]{/} Next Filter | {cyan-fg}[Shift+Tab]{/} Prev | {cyan-fg}[↑↓]{/} Select | {cyan-fg}[Esc]{/} Back | {gray-fg}(Live filter){/}";
			}
		} else if (currentFocus === "detail") {
			content = " {cyan-fg}[←]{/} Task List | {cyan-fg}[↑↓]{/} Scroll | {cyan-fg}[q/Esc]{/} Quit";
		} else {
			// Task list help
			content =
				" {cyan-fg}[Tab]{/} Switch View | {cyan-fg}[/]{/} Search | {cyan-fg}[s]{/} Status | {cyan-fg}[p]{/} Priority | {cyan-fg}[l]{/} Labels | {cyan-fg}[↑↓]{/} Navigate | {cyan-fg}[q/Esc]{/} Quit";
		}

		helpBar.setContent(content);
		screen.render();
	}

	// Handle resize
	screen.on("resize", () => {
		filterHeader.rebuild();
		const headerHeight = filterHeader.getHeight();

		// Update pane positions
		taskListPane.top = headerHeight;
		taskListPane.height = `100%-${headerHeight + 1}`;
		detailPane.top = headerHeight;
		detailPane.height = `100%-${headerHeight + 1}`;

		screen.render();
	});

	// Keyboard shortcuts
	screen.key(["/"], () => {
		filterHeader.focusSearch();
	});

	screen.key(["C-f"], () => {
		filterHeader.focusSearch();
	});

	screen.key(["s", "S"], () => {
		filterHeader.focusStatus();
	});

	screen.key(["p", "P"], () => {
		filterHeader.focusPriority();
	});

	screen.key(["l", "L"], () => {
		openLabelPicker();
	});

	screen.key(["escape"], () => {
		if (currentFocus === "filters") {
			filterHeader.setBorderColor("cyan");
			if (taskList) {
				focusTaskList();
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
			// Only switch views if we're in the task list, not in filters
			if (currentFocus === "list") {
				// Cleanup before switching
				searchService?.dispose();
				contentStore?.dispose();
				filterHeader.destroy();
				screen.destroy();
				await options.onTabPress?.();
			}
			// If in filters, Tab is handled by FilterHeader
		});
	}

	// Quit handlers
	screen.key(["q", "C-c"], () => {
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
			searchService?.dispose();
			contentStore?.dispose();
			resolve();
		});
	});
}

function generateDetailContent(task: Task): { headerContent: string[]; bodyContent: string[] } {
	const headerContent = [
		` {${getStatusColor(task.status)}-fg}${formatStatusWithIcon(task.status)}{/} {bold}{blue-fg}${task.id}{/blue-fg}{/bold} - ${task.title}`,
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
	metadata.push(`{bold}Created:{/bold} ${formatDateForDisplay(task.createdDate)}`);
	if (task.updatedDate && task.updatedDate !== task.createdDate) {
		metadata.push(`{bold}Updated:{/bold} ${formatDateForDisplay(task.updatedDate)}`);
	}
	if (task.priority) {
		const priorityDisplay = getPriorityDisplay(task.priority);
		const priorityText = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
		metadata.push(`{bold}Priority:{/bold} ${priorityText}${priorityDisplay}`);
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
		metadata.push(`{bold}Milestone:{/bold} {magenta-fg}${task.milestone}{/}`);
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

	const { headerContent, bodyContent } = generateDetailContent(task);

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
		style: { fg: "white", bg: "blue" },
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
	});

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
