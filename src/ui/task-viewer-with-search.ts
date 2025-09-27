/* Task viewer with search/filter header UI */

import { stdout as output } from "node:process";
import type { BoxInterface, LineInterface, ListInterface, ScrollableTextInterface } from "neo-neo-bblessed";
import { box, line, list, scrollabletext, textbox } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task, TaskSearchResult } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { formatChecklistItem, parseCheckboxLine } from "./checklist.ts";
import { createGenericList, type GenericList } from "./components/generic-list.ts";
import { formatHeading } from "./heading.ts";
import { formatStatusWithIcon, getStatusColor } from "./status-icon.ts";
import { createScreen } from "./tui.ts";

type BorderStyle = { fg?: string; bg?: string };
type SelectedStyle = { bg?: string; fg?: string };

type BorderCapable = Pick<BoxInterface, "style">;
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

function setBorderColor(element: BorderCapable, color: string): void {
	const style = element.style as StyleWithBorder;
	style.border = { ...(style.border ?? {}), fg: color };
}

function setSelectedColors(list: SelectableList, colors: SelectedStyle): void {
	const style = list.style as StyleWithSelected;
	style.selected = { ...(style.selected ?? {}), ...colors };
}

interface StyleWithBorder {
	border?: BorderStyle;
	[key: string]: unknown;
}

interface StyleWithSelected {
	selected?: SelectedStyle;
	[key: string]: unknown;
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

function formatDateForDisplay(dateStr: string): string {
	const hasTime = dateStr.includes(" ") || dateStr.includes("T");
	if (hasTime) {
		return dateStr;
	}
	return dateStr;
}

function extractAcceptanceCriteriaWithCheckboxes(content: string): string[] {
	if (!content) return [];
	const regex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = content.match(regex);
	if (!match || !match[1]) return [];
	return match[1]
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("- [ ]") || line.startsWith("- [x]"));
}

/**
 * Display task details with search/filter header UI
 */
export async function viewTaskEnhanced(
	task: Task,
	content: string,
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
		console.log(formatTaskPlainText(task, content));
		return;
	}

	// Get project root and setup services
	const cwd = process.cwd();
	const core = options.core || new Core(cwd);
	const searchService = await core.getSearchService();
	const contentStore = await core.getContentStore();
	const config = await core.filesystem.loadConfig();
	const statuses = config?.statuses || ["To Do", "In Progress", "Done"];
	const priorities = ["high", "medium", "low"];

	// Initialize with all tasks
	const allTasks = (options.tasks || (await core.filesystem.listTasks())).filter(
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
	let currentSelectedContent = content;
	let detailLoading = false;
	let selectionRequestId = 0;

	async function readTaskContent(taskId: string): Promise<string> {
		try {
			const filePath = await getTaskPath(taskId, core);
			if (filePath) {
				return await Bun.file(filePath).text();
			}
		} catch {
			// Ignore read errors to keep the UI responsive
		}
		return "";
	}

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

		// Recreate the task list with filtered items
		if (taskList) {
			taskList.destroy();
			taskList = null;
		}
		const listController = createTaskList();
		taskList = listController;
		if (filteredTasks.length > 0 && listController) {
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
		if (currentSelectedTask && selectedTask.id === currentSelectedTask.id && detailLoading === false) {
			return;
		}
		currentSelectedTask = selectedTask;
		options.onTaskChange?.(selectedTask);
		detailLoading = true;
		const requestId = ++selectionRequestId;
		refreshDetailPane();
		const contentText = await readTaskContent(selectedTask.id);
		if (requestId !== selectionRequestId) {
			return;
		}
		currentSelectedContent = contentText;
		detailLoading = false;
		refreshDetailPane();
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
				// Highlight task list pane when focused
				setBorderColor(taskListPane, "yellow");
				setBorderColor(headerBox, "cyan");
				screen.render();
				updateHelpBar();
			});
			listBox.on("blur", () => {
				// Reset task list pane border when not focused
				setBorderColor(taskListPane, "gray");
				screen.render();
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

		const headerContent = `{${getStatusColor(currentSelectedTask.status)}-fg}${formatStatusWithIcon(currentSelectedTask.status)}{/} {bold}{blue-fg}${currentSelectedTask.id}{/blue-fg}{/bold} - ${currentSelectedTask.title}`;
		headerDetailBox.setContent(headerContent);

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

		const bodyContent = [];
		bodyContent.push(formatHeading("Details", 2));

		const metadata = [];
		metadata.push(`{bold}Created:{/bold} ${formatDateForDisplay(currentSelectedTask.createdDate)}`);
		if (currentSelectedTask.updatedDate && currentSelectedTask.updatedDate !== currentSelectedTask.createdDate) {
			metadata.push(`{bold}Updated:{/bold} ${formatDateForDisplay(currentSelectedTask.updatedDate)}`);
		}
		if (currentSelectedTask.priority) {
			const priorityDisplay = getPriorityDisplay(currentSelectedTask.priority);
			const priorityText = currentSelectedTask.priority.charAt(0).toUpperCase() + currentSelectedTask.priority.slice(1);
			metadata.push(`{bold}Priority:{/bold} ${priorityText}${priorityDisplay}`);
		}

		bodyContent.push(...metadata);
		bodyContent.push("");

		if (detailLoading) {
			bodyContent.push("{gray-fg}Loading task content…{/}");
			bodyContent.push("");
		}

		if (currentSelectedTask.description) {
			bodyContent.push(formatHeading("Description", 2));
			bodyContent.push(currentSelectedTask.description);
		}

		if (detailLoading) {
			bodyContent.push("");
			bodyContent.push(formatHeading("Acceptance Criteria", 2));
			bodyContent.push("{gray-fg}Loading acceptance criteria…{/}");
		} else {
			const acceptanceCriteria = extractAcceptanceCriteriaWithCheckboxes(currentSelectedContent);
			if (acceptanceCriteria.length > 0) {
				bodyContent.push("");
				bodyContent.push(formatHeading("Acceptance Criteria", 2));
				for (const criterion of acceptanceCriteria) {
					const parsed = parseCheckboxLine(criterion);
					if (parsed) {
						bodyContent.push(formatChecklistItem(parsed));
					}
				}
			}
		}

		bodyContainer.setContent(bodyContent.join("\n"));
		descriptionBox = bodyContainer;
	}

	// State for tracking focus
	let currentFocus: "search" | "status" | "priority" | "list" = "list";

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
			taskList.focus();
		}
	});

	// Handle status selector changes with immediate filtering
	statusSelector.on("select", (...args: unknown[]) => {
		const index = resolveListIndex(args);
		statusFilter = index === 0 ? "" : statuses[index - 1] || "";
		applyFilters();
		notifyFilterChange();
		if (taskList) {
			taskList.focus();
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
			taskList.focus();
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
			currentFocus = "list";
			setBorderColor(taskListPane, "yellow");
			setBorderColor(headerBox, "cyan");
			taskList.focus();
			screen.render();
			updateHelpBar();
		}
		// Prevent event from bubbling
		return false;
	});

	// Focus handlers for filters
	searchInput.on("focus", () => {
		currentFocus = "search";
		// Highlight header box when filter is active
		setBorderColor(headerBox, "yellow");
		setBorderColor(taskListPane, "gray"); // Reset task list pane
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
		screen.render();
	});

	statusSelector.on("focus", () => {
		currentFocus = "status";
		// Highlight header box when filter is active
		setBorderColor(headerBox, "yellow");
		setBorderColor(taskListPane, "gray"); // Reset task list pane
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
		screen.render();
	});

	prioritySelector.on("focus", () => {
		currentFocus = "priority";
		// Highlight header box when filter is active
		setBorderColor(headerBox, "yellow");
		setBorderColor(taskListPane, "gray"); // Reset task list pane
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
				currentFocus = "list";
				setBorderColor(taskListPane, "yellow");
				setBorderColor(headerBox, "cyan");
				taskList.focus();
				screen.render();
				updateHelpBar();
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
			descriptionBox.focus();
		}
	} else {
		// Focus the task list initially and highlight it
		const list = taskList as GenericList<Task> | null;
		if (list) {
			currentFocus = "list";
			setBorderColor(taskListPane, "yellow");
			list.focus();
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

// Helper function for plain text output
function formatTaskPlainText(task: Task, content: string): string {
	const lines: string[] = [];

	lines.push(`Task: ${task.id} - ${task.title}`);
	lines.push(`Status: ${task.status}`);

	if (task.assignee?.length) {
		lines.push(`Assignee: ${task.assignee.join(", ")}`);
	}

	if (task.labels?.length) {
		lines.push(`Labels: ${task.labels.join(", ")}`);
	}

	if (task.priority) {
		lines.push(`Priority: ${task.priority}`);
	}

	lines.push("");
	lines.push("Description:");
	lines.push(task.description || "No description");

	const acceptanceCriteria = extractAcceptanceCriteriaWithCheckboxes(content);
	if (acceptanceCriteria.length > 0) {
		lines.push("");
		lines.push("Acceptance Criteria:");
		for (const criterion of acceptanceCriteria) {
			lines.push(criterion);
		}
	}

	lines.push("");
	lines.push("Content:");
	lines.push(content);

	return lines.join("\n");
}
