/* Task viewer with search/filter header UI */

import { stdout as output } from "node:process";
import type {
	BoxInterface,
	LineInterface,
	ListInterface,
	ScreenInterface,
	ScrollableTextInterface,
} from "neo-neo-bblessed";
import { box, line, list, scrollabletext, textbox } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import {
	buildAcceptanceCriteriaItems,
	formatDateForDisplay,
	formatTaskPlainText,
} from "../formatters/task-plain-text.ts";
import type { Task, TaskSearchResult } from "../types/index.ts";
import { formatChecklistItem } from "./checklist.ts";
import { transformCodePaths } from "./code-path.ts";
import { createGenericList, type GenericList } from "./components/generic-list.ts";
import { formatHeading } from "./heading.ts";
import { formatStatusWithIcon, getStatusColor } from "./status-icon.ts";
import { createScreen } from "./tui.ts";

type SelectedStyle = { bg?: string; fg?: string };

type SelectableList = Pick<ListInterface, "style">;

interface KeypressEvent {
	name?: string;
}

function resolveListIndex(args: unknown[]): number {
	if (typeof args[1] === "number") {
		return args[1];
	}
	if (typeof args[0] === "number") {
		return args[0];
	}
	return 0;
}

function setSelectedColors(list: SelectableList, colors: SelectedStyle): void {
	const style = list.style as StyleWithSelected;
	style.selected = { ...(style.selected ?? {}), ...colors };
}

interface StyleWithSelected {
	selected?: SelectedStyle;
	[key: string]: unknown;
}

type BorderCapable = Pick<BoxInterface, "style">;

function setBorderColor(element: BorderCapable, color: string): void {
	const style = element.style as { border?: { fg?: string } };
	style.border = { ...(style.border ?? {}), fg: color };
}

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
		startWithDetailFocus?: boolean;
		startWithSearchFocus?: boolean;
		viewSwitcher?: import("./view-switcher.ts").ViewSwitcher;
		onTaskChange?: (task: Task) => void;
		onTabPress?: () => Promise<void>;
		onFilterChange?: (filters: { searchQuery: string; statusFilter: string; priorityFilter: string }) => void;
	} = {},
): Promise<void> {
	if (output.isTTY === false) {
		console.log(formatTaskPlainText(task));
		return;
	}

	// Get project root and setup services
	const cwd = process.cwd();
	const core = options.core || new Core(cwd, { enableWatchers: true });
	const searchService = await core.getSearchService();
	const contentStore = await core.getContentStore();
	const config = await core.filesystem.loadConfig();
	const statuses = config?.statuses || ["To Do", "In Progress", "Done"];
	const priorities = ["high", "medium", "low"];

	// Initialize with all tasks
	const allTasks = (options.tasks || (await core.queryTasks())).filter(
		(t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"),
	);

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
	let filteredTasks = [...allTasks];
	const filtersActive = Boolean(searchQuery || statusFilter || priorityFilter);
	let requireInitialFilterSelection = filtersActive;

	// Find the initial selected task
	let currentSelectedTask = task;
	let selectionRequestId = 0;
	let noResultsMessage: string | null = null;

	const screen = createScreen({ title: options.title || "Backlog Tasks" });

	// Main container
	const container = box({
		parent: screen,
		width: "100%",
		height: "100%",
	});

	// Create header box for search/filter controls - takes up top 3 lines
	const headerBox = box({
		parent: container,
		top: 0,
		left: 0,
		width: "100%",
		height: 3,
		border: {
			type: "line",
		},
		style: {
			border: { fg: "cyan" },
		},
		label: "\u00A0Search & Filters\u00A0",
	});

	// Search label
	box({
		parent: headerBox,
		content: "Search:",
		top: 0,
		left: 1,
		width: 7,
		height: 1,
		tags: true,
	});

	// Search input textbox - use inputOnFocus for automatic input mode
	const searchInput = textbox({
		parent: headerBox,
		value: searchQuery,
		top: 0,
		left: 9,
		width: "30%",
		height: 1,
		inputOnFocus: true, // Automatically enter input mode on focus
		mouse: true,
		keys: true,
		ignoreKeys: ["tab"], // Ignore tab key to allow navigation
		style: {
			fg: "white",
			bg: "black",
			focus: {
				fg: "black",
				bg: "cyan",
				bold: true,
			},
		},
	});

	// Status filter label
	box({
		parent: headerBox,
		content: "Status:",
		top: 0,
		left: "42%",
		width: 7,
		height: 1,
		tags: true,
	});

	// Status selector with dropdown arrow
	// Calculate initial selected index for status filter
	const initialStatusIndex = statusFilter ? statuses.indexOf(statusFilter) + 1 : 0;

	const statusSelector = list({
		parent: headerBox,
		items: ["All ▼", ...statuses.map((s) => `${s} `)],
		selected: initialStatusIndex >= 0 ? initialStatusIndex : 0,
		top: 0,
		left: "50%",
		width: 15,
		height: 1,
		mouse: true,
		keys: true,
		interactive: true,
		style: {
			fg: "white",
			bg: "black",
			selected: {
				bg: "black", // Default to no highlight
				fg: "white",
			},
			item: {
				hover: {
					bg: "blue",
				},
			},
		},
	});

	// Priority filter label
	box({
		parent: headerBox,
		content: "Priority:",
		top: 0,
		left: "67%",
		width: 9,
		height: 1,
		tags: true,
	});

	// Priority selector with dropdown arrow
	// Calculate initial selected index for priority filter
	const initialPriorityIndex = priorityFilter ? priorities.indexOf(priorityFilter) + 1 : 0;

	const prioritySelector = list({
		parent: headerBox,
		items: ["All ▼", "high ", "medium ", "low "],
		selected: initialPriorityIndex >= 0 ? initialPriorityIndex : 0,
		top: 0,
		left: "77%",
		width: 10,
		height: 1,
		mouse: true,
		keys: true,
		interactive: true,
		style: {
			fg: "white",
			bg: "black",
			selected: {
				bg: "black", // Default to no highlight
				fg: "white",
			},
			item: {
				hover: {
					bg: "blue",
				},
			},
		},
	});

	// Set initial selections
	statusSelector.select(statusFilter ? statuses.indexOf(statusFilter) + 1 : 0);
	prioritySelector.select(priorityFilter ? priorities.indexOf(priorityFilter) + 1 : 0);

	// Task list pane (left 40%)
	const taskListPane = box({
		parent: container,
		top: 3,
		left: 0,
		width: "40%",
		height: "100%-4", // Account for header and help bar
		border: {
			type: "line",
		},
		style: {
			border: { fg: "gray" },
		},
		label: `\u00A0Tasks (${filteredTasks.length})\u00A0`,
	});

	// Detail pane - use right: 0 to ensure it extends to window edge like the header
	const detailPane = box({
		parent: container,
		top: 3,
		left: "40%",
		right: 0, // Extend to right edge instead of calculating width
		height: "100%-4",
		border: {
			type: "line",
		},
		style: {
			border: { fg: "gray" },
		},
		label: "\u00A0Details\u00A0",
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
			});
		}
	}

	// Function to apply filters and refresh the task list
	function applyFilters() {
		// Use search service for comprehensive filtering
		// Check for non-empty search query or active filters
		if (searchQuery.trim() || statusFilter || priorityFilter) {
			const searchResults = searchService.search({
				query: searchQuery,
				filters: {
					status: statusFilter || undefined,
					priority: priorityFilter as "high" | "medium" | "low" | undefined,
				},
				types: ["task"],
			});

			// Extract tasks from search results
			filteredTasks = searchResults.filter((r): r is TaskSearchResult => r.type === "task").map((r) => r.task);
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
			if (activeFilters.length > 0) {
				noResultsMessage = `{bold}No tasks match your current filters{/bold}\n${activeFilters.map((f) => ` • ${f}`).join("\n")}\n\n{gray-fg}Try adjusting the search or clearing filters.{/}`;
			} else {
				noResultsMessage =
					"{bold}No tasks available{/bold}\n{gray-fg}Create a task with {cyan-fg}backlog task create{/cyan-fg}.{/}";
			}
			refreshDetailPane();
			screen.render();
			return;
		}

		noResultsMessage = null;

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

		screen.render();
	}

	// Task list component
	let taskList: GenericList<Task> | null = null;

	async function applySelection(selectedTask: Task | null) {
		if (!selectedTask) return;
		if (currentSelectedTask && selectedTask.id === currentSelectedTask.id) {
			return;
		}
		currentSelectedTask = selectedTask;
		options.onTaskChange?.(selectedTask);
		const requestId = ++selectionRequestId;
		refreshDetailPane();
		screen.render();
		const refreshed = await core.getTask(selectedTask.id);
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

				return `{${statusColor}-fg}${statusIcon}{/} {bold}${task.id}{/bold} - ${task.title}${priorityText}${assigneeText}${labelsText}`;
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
		});

		divider = line({
			parent: detailPane,
			top: typeof headerDetailBox.bottom === "number" ? headerDetailBox.bottom : 0,
			left: 1,
			right: 1,
			orientation: "horizontal",
			style: {
				fg: "gray",
			},
		});

		const bodyContainer = scrollabletext({
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
		});

		const detailContent = generateDetailContent(currentSelectedTask);
		headerDetailBox.setContent(detailContent.headerContent.join("\n"));
		bodyContainer.setContent(detailContent.bodyContent.join("\n"));
		configureDetailBox(bodyContainer);
	}

	// State for tracking focus
	let currentFocus: "search" | "status" | "priority" | "list" | "detail" = "list";

	// Event handlers for search and filters
	searchInput.on("submit", (value: unknown) => {
		searchQuery = String(value || "");
		applyFilters();
		notifyFilterChange();
		// Don't change focus - keep search input active for continued editing
		searchInput.focus();
	});

	// Live search as user types - monitor value changes
	let searchCheckInterval: Timer | null = null;

	const startSearchMonitoring = () => {
		if (!searchCheckInterval) {
			searchCheckInterval = setInterval(() => {
				if (currentFocus === "search" && searchInput.getValue) {
					const newValue = searchInput.getValue();
					if (newValue !== searchQuery) {
						searchQuery = String(newValue);
						applyFilters();
						notifyFilterChange();
					}
				}
			}, 100); // Check every 100ms for changes
		}
	};

	const stopSearchMonitoring = () => {
		if (searchCheckInterval) {
			clearInterval(searchCheckInterval);
			searchCheckInterval = null;
		}
	};

	searchInput.on("cancel", () => {
		// On Escape, move focus to task list
		if (taskList) {
			focusTaskList();
		}
	});

	// Handle status selector changes with immediate filtering
	statusSelector.on("select", (...args: unknown[]) => {
		const index = resolveListIndex(args);
		statusFilter = index === 0 ? "" : statuses[index - 1] || "";
		applyFilters();
		notifyFilterChange();
		if (taskList) {
			focusTaskList();
		}
	});

	// Live status filter on arrow navigation (no Enter needed)
	statusSelector.on("select item", (...args: unknown[]) => {
		const index = resolveListIndex(args);
		statusFilter = index === 0 ? "" : statuses[index - 1] || "";
		applyFilters();
		notifyFilterChange();
	});

	// Also update on keypress for immediate feedback
	statusSelector.on("keypress", (_ch: string, key: KeypressEvent) => {
		if (key?.name === "up" || key?.name === "down") {
			setImmediate(() => {
				const idx = statusSelector.selected;
				statusFilter = idx !== undefined && idx === 0 ? "" : statuses[(idx ?? 0) - 1] || "";
				applyFilters();
				notifyFilterChange();
			});
		}
	});

	// Handle priority selector changes with immediate filtering
	prioritySelector.on("select", (...args: unknown[]) => {
		const index = resolveListIndex(args);
		priorityFilter = index === 0 ? "" : priorities[index - 1] || "";
		applyFilters();
		notifyFilterChange();
		if (taskList) {
			focusTaskList();
		}
	});

	// Live priority filter on arrow navigation (no Enter needed)
	prioritySelector.on("select item", (...args: unknown[]) => {
		const index = resolveListIndex(args);
		priorityFilter = index === 0 ? "" : priorities[index - 1] || "";
		applyFilters();
		notifyFilterChange();
	});

	// Also update on keypress for immediate feedback
	prioritySelector.on("keypress", (_ch: string, key: KeypressEvent) => {
		if (key?.name === "up" || key?.name === "down") {
			setImmediate(() => {
				const idx = prioritySelector.selected;
				priorityFilter = idx !== undefined && idx === 0 ? "" : priorities[(idx ?? 0) - 1] || "";
				applyFilters();
				notifyFilterChange();
			});
		}
	});

	// Handle tab navigation from search input
	searchInput.key(["tab"], () => {
		// Save current value
		const currentValue = searchInput.getValue ? searchInput.getValue() : searchInput.value;
		searchQuery = String(currentValue || "");
		// Apply any pending search
		applyFilters();
		// Cancel edit mode
		searchInput.cancel();
		// Switch focus
		currentFocus = "status";
		statusSelector.focus();
		updateHelpBar();
		// Prevent event from bubbling
		return false;
	});

	// Handle down arrow from search input
	searchInput.key(["down"], () => {
		// Save current value
		const currentValue = searchInput.getValue ? searchInput.getValue() : searchInput.value;
		searchQuery = String(currentValue || "");
		// Apply any pending search
		applyFilters();
		// Cancel edit mode
		searchInput.cancel();
		// Switch to task list
		if (taskList) {
			focusTaskList();
		}
		// Prevent event from bubbling
		return false;
	});

	// Focus handlers for filters
	searchInput.on("focus", () => {
		currentFocus = "search";
		// Highlight header box when filter is active
		setBorderColor(headerBox, "yellow");
		setActivePane("none");
		screen.render();
		updateHelpBar();
		startSearchMonitoring();
		// No need to call readInput - inputOnFocus handles it automatically
	});

	searchInput.on("blur", () => {
		stopSearchMonitoring();
		// Reset header box border
		if (currentFocus !== "status" && currentFocus !== "priority") {
			setBorderColor(headerBox, "cyan");
		}
		setActivePane(currentFocus === "detail" ? "detail" : currentFocus === "list" ? "list" : "none");
		screen.render();
	});

	statusSelector.on("focus", () => {
		currentFocus = "status";
		// Highlight header box when filter is active
		setBorderColor(headerBox, "yellow");
		setActivePane("none");
		// Update style to show blue highlight when focused
		setSelectedColors(statusSelector, { bg: "blue", fg: "white" });
		screen.render();
		updateHelpBar();
	});

	statusSelector.on("blur", () => {
		// Remove blue highlight when not focused
		setSelectedColors(statusSelector, { bg: "black", fg: "white" });
		// Reset header box border
		setBorderColor(headerBox, "cyan");
		setActivePane(currentFocus === "detail" ? "detail" : currentFocus === "list" ? "list" : "none");
		screen.render();
	});

	prioritySelector.on("focus", () => {
		currentFocus = "priority";
		// Highlight header box when filter is active
		setBorderColor(headerBox, "yellow");
		setActivePane("none");
		// Update style to show blue highlight when focused
		setSelectedColors(prioritySelector, { bg: "blue", fg: "white" });
		screen.render();
		updateHelpBar();
	});

	prioritySelector.on("blur", () => {
		// Remove blue highlight when not focused
		setSelectedColors(prioritySelector, { bg: "black", fg: "white" });
		// Reset header box border
		setBorderColor(headerBox, "cyan");
		setActivePane(currentFocus === "detail" ? "detail" : currentFocus === "list" ? "list" : "none");
		screen.render();
	});

	// Tab navigation between search and filters
	function cycleFilter(reverse = false) {
		// Stop monitoring when leaving search
		if (currentFocus === "search") {
			stopSearchMonitoring();
		}

		if (reverse) {
			switch (currentFocus) {
				case "search":
					currentFocus = "priority";
					prioritySelector.focus();
					break;
				case "status":
					currentFocus = "search";
					searchInput.focus();
					// readInput is called in the focus handler
					break;
				case "priority":
					currentFocus = "status";
					statusSelector.focus();
					break;
				default:
					currentFocus = "search";
					searchInput.focus();
				// readInput is called in the focus handler
			}
		} else {
			switch (currentFocus) {
				case "search":
					currentFocus = "status";
					statusSelector.focus();
					break;
				case "status":
					currentFocus = "priority";
					prioritySelector.focus();
					break;
				case "priority":
					currentFocus = "search";
					searchInput.focus();
					// readInput is called in the focus handler
					break;
				default:
					currentFocus = "search";
					searchInput.focus();
				// readInput is called in the focus handler
			}
		}
		updateHelpBar();
	}

	// Tab key handling within filters
	// Note: searchInput tab/down are handled in the _listener override above

	statusSelector.key(["tab"], () => {
		cycleFilter();
	});

	prioritySelector.key(["tab"], () => {
		cycleFilter();
	});

	statusSelector.key(["S-tab"], () => {
		cycleFilter(true);
	});

	prioritySelector.key(["S-tab"], () => {
		cycleFilter(true);
	});

	// Keyboard shortcuts - use "/" as primary (standard), Ctrl+F as secondary
	screen.key(["/"], () => {
		// Just focus the search input - the focus handler will do the rest
		searchInput.focus();
	});

	// Also support Ctrl+F as an alternative (common in modern apps)
	screen.key(["C-f"], () => {
		// Just focus the search input - the focus handler will do the rest
		searchInput.focus();
	});

	// Quick access to status filter
	screen.key(["s", "S"], () => {
		// Just focus the status selector - the focus handler will do the rest
		statusSelector.focus();
	});

	// Quick access to priority filter
	screen.key(["p", "P"], () => {
		// Just focus the priority selector - the focus handler will do the rest
		prioritySelector.focus();
	});

	screen.key(["escape"], () => {
		// If in search/filter mode, go back to task list
		if (currentFocus !== "list") {
			if (searchInput.getValue && searchInput.getValue() !== searchQuery) {
				searchInput.setValue(searchQuery);
			}
			if (taskList) {
				focusTaskList();
			}
		} else {
			// If already in task list, quit
			stopSearchMonitoring();
			searchService.dispose();
			contentStore.dispose();
			screen.destroy();
			process.exit(0);
		}
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

	// Dynamic help bar content
	function updateHelpBar() {
		let content = "";

		if (currentFocus === "search") {
			// Search-specific help - filters apply live as you type
			content =
				" {cyan-fg}[Tab]{/} Next Filter | {cyan-fg}[↓]{/} Task List | {cyan-fg}[Esc]{/} Cancel | {gray-fg}(Live search){/}";
		} else if (currentFocus === "status" || currentFocus === "priority") {
			// Status/Priority filter help - changes apply immediately
			content =
				" {cyan-fg}[Tab]{/} Next Filter | {cyan-fg}[Shift+Tab]{/} Prev Filter | {cyan-fg}[↑↓]{/} Select | {cyan-fg}[Esc]{/} Back to Tasks | {gray-fg}(Live filter){/}";
		} else if (currentFocus === "detail") {
			content = " {cyan-fg}[←]{/} Task List | {cyan-fg}[↑↓]{/} Scroll | {cyan-fg}[q/Esc]{/} Quit";
		} else {
			// Task list help - show all available shortcuts
			content =
				" {cyan-fg}[Tab]{/} Switch View | {cyan-fg}[/]{/} Search | {cyan-fg}[s]{/} Status | {cyan-fg}[p]{/} Priority | {cyan-fg}[↑↓]{/} Navigate | {cyan-fg}[q/Esc]{/} Quit";
		}

		helpBar.setContent(content);
		screen.render();
	}

	// Initial help bar content
	updateHelpBar();

	// Tab key handling for view switching - only when in task list
	if (options.onTabPress) {
		screen.key(["tab"], async () => {
			// Only switch views if we're in the task list, not in filters
			if (currentFocus === "list") {
				// Cleanup before switching
				searchService.dispose();
				contentStore.dispose();
				screen.destroy();
				await options.onTabPress?.();
			}
			// If in filters, Tab is handled by cycleFilter
		});
	}

	// Quit handlers
	screen.key(["q", "C-c"], () => {
		stopSearchMonitoring();
		searchService.dispose();
		contentStore.dispose();
		screen.destroy();
		process.exit(0);
	});

	// Initial setup
	// Apply filters first if any are set
	if (filtersActive) {
		applyFilters();
	} else {
		taskList = createTaskList();
	}
	refreshDetailPane();

	if (options.startWithSearchFocus) {
		// Start with search input focused - the focus handler will set everything up
		searchInput.focus();
	} else if (options.startWithDetailFocus) {
		if (descriptionBox) {
			focusDetailPane();
		}
	} else {
		// Focus the task list initially and highlight it
		const list = taskList as GenericList<Task> | null;
		if (list) {
			focusTaskList();
		}
	}

	screen.render();

	// Wait for screen to close
	return new Promise<void>((resolve) => {
		screen.on("destroy", () => {
			stopSearchMonitoring();
			searchService.dispose();
			contentStore.dispose();
			resolve();
		});
	});
}

function generateDetailContent(task: Task): { headerContent: string[]; bodyContent: string[] } {
	const headerContent = [
		` {${getStatusColor(task.status)}-fg}${formatStatusWithIcon(task.status)}{/} {bold}{blue-fg}${task.id}{/blue-fg}{/bold} - ${task.title}`,
	];

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
		metadata.push(`{bold}Parent:{/bold} {blue-fg}${task.parentTaskId}{/}`);
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

	const headerBox = box({
		parent: popup,
		top: 0,
		left: 1,
		right: 1,
		height: "shrink",
		tags: true,
		wrap: true,
		scrollable: false,
		padding: { left: 1, right: 1 },
		content: headerContent.join("\n"),
	});

	line({
		parent: popup,
		top: headerBox.bottom,
		left: 1,
		right: 1,
		orientation: "horizontal",
		style: {
			fg: "gray",
		},
	});

	box({
		parent: popup,
		content: " Esc ",
		top: -1,
		right: 1,
		width: 5,
		height: 1,
		style: {
			fg: "white",
			bg: "blue",
		},
	});

	const contentArea = scrollabletext({
		parent: popup,
		top: (typeof headerBox.bottom === "number" ? headerBox.bottom : 0) + 1,
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
