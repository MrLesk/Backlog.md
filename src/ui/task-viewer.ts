/* Enhanced task viewer for displaying task details in a structured format */

import { stdout as output } from "node:process";
import type { BoxInterface, LineInterface, ScreenInterface, ScrollableTextInterface } from "neo-neo-bblessed";
import { box, line, scrollabletext } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { formatChecklistItem, parseCheckboxLine } from "./checklist.ts";
import { transformCodePaths, transformCodePathsPlain } from "./code-path.ts";
import { createGenericList } from "./components/generic-list.ts";
import { formatHeading } from "./heading.ts";
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
 * Format date for display, showing time only when present
 */
function formatDateForDisplay(dateStr: string): string {
	// Check if the date string includes time
	const hasTime = dateStr.includes(" ") || dateStr.includes("T");

	if (hasTime) {
		// Return the datetime as-is, it's already in a readable format
		return dateStr;
	}
	// Return date-only format
	return dateStr;
}

/**
 * Extract checkbox lines from Acceptance Criteria section for display
 */
function extractAcceptanceCriteriaWithCheckboxes(content: string): string[] {
	if (!content) return [];

	// Look for ## Acceptance Criteria section
	const regex = /## Acceptance Criteria\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = content.match(regex);
	if (!match || !match[1]) return [];

	return match[1]
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("- [ ]") || line.startsWith("- [x]"));
}

/**
 * Display task details in a split-pane UI with task list on left and detail on right
 */
export async function viewTaskEnhanced(
	task: Task,
	content: string,
	options: {
		tasks?: Task[];
		core?: Core;
		title?: string;
		filterDescription?: string;
		startWithDetailFocus?: boolean;
		viewSwitcher?: import("./view-switcher.ts").ViewSwitcher;
		onTaskChange?: (task: Task) => void;
		onTabPress?: () => Promise<void>;
	} = {},
): Promise<void> {
	if (output.isTTY === false) {
		console.log(formatTaskPlainText(task, content));
		return;
	}

	// Get project root and load tasks
	const cwd = process.cwd();
	const core = options.core || new Core(cwd);
	const allTasks = (options.tasks || (await core.filesystem.listTasks()))
		// Extra safeguard: filter out any tasks without proper IDs
		.filter((t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"));

	// Find the initial selected task index
	const initialIndex = allTasks.findIndex((t) => t.id === task.id);
	let currentSelectedTask = task;
	let currentSelectedContent = content;

	const screen = createScreen({ title: options.title || "Backlog Tasks" });

	// Main container using grid layout
	const container = box({
		parent: screen,
		width: "100%",
		height: "100%",
		autoPadding: true,
	});

	// Task list pane (left 40%) with border
	const taskListPane = box({
		parent: container,
		top: 0,
		left: 0,
		width: "40%",
		height: "100%-1", // Leave space for help bar
		border: {
			type: "line",
		},
		style: {
			border: { fg: "gray" },
		},
		label: `\u00A0${options.title || "Tasks"}\u00A0`,
	});

	// Detail pane (right 60%) with border
	const detailPane = box({
		parent: container,
		top: 0,
		left: "40%",
		width: "60%",
		height: "100%-1", // Leave space for help bar
		border: {
			type: "line",
		},
		style: {
			border: { fg: "gray" },
		},
		label: "\u00A0Details\u00A0",
	});

	// Create task list using generic list component
	async function applySelection(selectedTask: Task | null) {
		if (!selectedTask) return;
		if (currentSelectedTask && selectedTask.id === currentSelectedTask.id) return;
		currentSelectedTask = selectedTask;
		// Notify view switcher of task change
		options.onTaskChange?.(selectedTask);
		try {
			const filePath = await getTaskPath(selectedTask.id, core);
			if (filePath) {
				currentSelectedContent = await Bun.file(filePath).text();
			} else {
				currentSelectedContent = "";
			}
		} catch {
			currentSelectedContent = "";
		}
		refreshDetailPane();
	}
	const taskList = createGenericList<Task>({
		parent: taskListPane,
		title: "", // Empty title since pane has label
		items: allTasks,
		selectedIndex: Math.max(0, initialIndex),
		border: false, // Disable border since pane has one
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
		showHelp: false, // We'll show help in the footer
	});

	// Shift+Arrow reordering within the same status using ordinal
	async function reorderSelected(delta: -1 | 1) {
		try {
			const listBox = taskList.getListBox();
			const selIndex = listBox.selected ?? 0;
			const selected = allTasks[selIndex] || currentSelectedTask;
			if (!selected) return;
			const status = (selected.status || "").trim();
			// Build sibling list in current in-memory order
			const siblings = allTasks.filter((t) => (t.status || "").trim() === status);
			if (siblings.length <= 1) return; // nothing to reorder

			const idxInSiblings = siblings.findIndex((t) => t.id === selected.id);
			if (idxInSiblings < 0) return;
			const target = idxInSiblings + delta;
			if (target < 0 || target >= siblings.length) return; // keep within bounds

			// Compute new order
			const newOrder = [...siblings];
			const [moved] = newOrder.splice(idxInSiblings, 1);
			if (!moved) return; // type guard, should not happen due to bounds checks
			newOrder.splice(target, 0, moved);

			// Reassign ordinals in steps to avoid collisions
			let ordinal = 1000;
			const toUpdate: Task[] = [];
			for (const t of newOrder) {
				if ((t.ordinal ?? -1) !== ordinal) {
					toUpdate.push({ ...t, ordinal });
				}
				ordinal += 1000;
			}

			if (toUpdate.length > 0) {
				await (options.core || new Core(process.cwd())).updateTasksBulk(toUpdate, `Reorder within status ${status}`);
				// Refresh in-memory tasks so UI stays consistent
				const updated = await (options.core || new Core(process.cwd())).filesystem.listTasks();
				// Preserve filtering used for initial list if any
				allTasks.splice(0, allTasks.length, ...updated);
				// Maintain selection on the moved task
				const newIndex = allTasks.findIndex((t) => t.id === selected.id);
				if (newIndex >= 0) listBox.select(newIndex);
				screen.render();
			}
		} catch {
			// ignore
		}
	}

	// Bind Shift+Arrow keys for moving and manage Move Mode indicator
	const lb = taskList.getListBox();
	let moveMode = false;
	let moveModeTimer: ReturnType<typeof setTimeout> | null = null;
	// Help bar updater placeholder; will be initialized once help bar is created
	let updateHelpBar: () => void = () => {};

	function setMoveMode(on: boolean, transientMs?: number) {
		moveMode = on;
		updateHelpBar();
		if (moveModeTimer) {
			clearTimeout(moveModeTimer);
			moveModeTimer = null;
		}
		if (on && transientMs && transientMs > 0) {
			moveModeTimer = setTimeout(() => {
				moveMode = false;
				updateHelpBar();
				screen.render();
			}, transientMs);
		}
	}

	lb.key(["S-up" as unknown as string], () => {
		setMoveMode(true, 1500);
		void reorderSelected(-1);
	});
	lb.key(["S-down" as unknown as string], () => {
		setMoveMode(true, 1500);
		void reorderSelected(1);
	});

	// Allow manual toggle to keep the indicator visible
	lb.key(["m", "M"], () => setMoveMode(!moveMode));

	// Detail pane components
	let headerBox: BoxInterface | undefined;
	let divider: LineInterface | undefined;
	let descriptionBox: ScrollableTextInterface | undefined;

	function refreshDetailPane() {
		// Clear existing detail pane content
		if (headerBox) headerBox.destroy();
		if (divider) divider.destroy();
		if (descriptionBox) descriptionBox.destroy();

		// Update screen title
		screen.title = `Task ${currentSelectedTask.id} - ${currentSelectedTask.title}`;

		// Header section with task ID, title, and status
		headerBox = box({
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

		// Format header content - just status and title
		const headerContent = `{${getStatusColor(currentSelectedTask.status)}-fg}${formatStatusWithIcon(currentSelectedTask.status)}{/} {bold}{blue-fg}${currentSelectedTask.id}{/blue-fg}{/bold} - ${currentSelectedTask.title}`;

		headerBox.setContent(headerContent);

		// Create a divider line
		divider = line({
			parent: detailPane,
			top: typeof headerBox.bottom === "number" ? headerBox.bottom : 0,
			left: 1,
			right: 1,
			orientation: "horizontal",
			style: {
				fg: "gray",
			},
		});

		// Scrollable body container beneath the header
		const bodyContainer = scrollabletext({
			parent: detailPane,
			top: (typeof headerBox.bottom === "number" ? headerBox.bottom : 0) + 1,
			left: 1,
			right: 1,
			bottom: 1, // Leave space for bottom border
			keys: true,
			vi: true,
			mouse: true,
			tags: true,
			wrap: true,
			padding: { left: 1, right: 1, top: 0, bottom: 0 },
		});

		// Build the scrollable body content
		const bodyContent = [];

		// Add details section with all metadata
		bodyContent.push(formatHeading("Details", 2));

		const metadata = [];

		// Always show created date
		metadata.push(`{bold}Created:{/bold} ${formatDateForDisplay(currentSelectedTask.createdDate)}`);

		// Show updated date if different from created
		if (currentSelectedTask.updatedDate && currentSelectedTask.updatedDate !== currentSelectedTask.createdDate) {
			metadata.push(`{bold}Updated:{/bold} ${formatDateForDisplay(currentSelectedTask.updatedDate)}`);
		}

		// Priority
		if (currentSelectedTask.priority) {
			const priorityDisplay = getPriorityDisplay(currentSelectedTask.priority);
			const priorityText = currentSelectedTask.priority.charAt(0).toUpperCase() + currentSelectedTask.priority.slice(1);
			metadata.push(`{bold}Priority:{/bold} ${priorityText}${priorityDisplay}`);
		}

		// Assignee
		if (currentSelectedTask.assignee?.length) {
			const assigneeList = currentSelectedTask.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ");
			metadata.push(`{bold}Assignee:{/bold} {cyan-fg}${assigneeList}{/}`);
		}

		// Labels
		if (currentSelectedTask.labels?.length) {
			metadata.push(`{bold}Labels:{/bold} ${currentSelectedTask.labels.map((l) => `{yellow-fg}[${l}]{/}`).join(" ")}`);
		}

		// Reporter
		if (currentSelectedTask.reporter) {
			const reporterText = currentSelectedTask.reporter.startsWith("@")
				? currentSelectedTask.reporter
				: `@${currentSelectedTask.reporter}`;
			metadata.push(`{bold}Reporter:{/bold} {cyan-fg}${reporterText}{/}`);
		}

		// Milestone
		if (currentSelectedTask.milestone) {
			metadata.push(`{bold}Milestone:{/bold} {magenta-fg}${currentSelectedTask.milestone}{/}`);
		}

		// Parent task
		if (currentSelectedTask.parentTaskId) {
			metadata.push(`{bold}Parent:{/bold} {blue-fg}${currentSelectedTask.parentTaskId}{/}`);
		}

		// Subtasks
		if (currentSelectedTask.subtasks?.length) {
			metadata.push(
				`{bold}Subtasks:{/bold} ${currentSelectedTask.subtasks.length} task${currentSelectedTask.subtasks.length > 1 ? "s" : ""}`,
			);
		}

		// Dependencies
		if (currentSelectedTask.dependencies?.length) {
			metadata.push(`{bold}Dependencies:{/bold} ${currentSelectedTask.dependencies.join(", ")}`);
		}

		bodyContent.push(metadata.join("\n"));
		bodyContent.push("");

		// Description section
		bodyContent.push(formatHeading("Description", 2));
		const descriptionText = currentSelectedTask.description?.trim();
		const descriptionContent = descriptionText
			? transformCodePaths(descriptionText)
			: "{gray-fg}No description provided{/}";
		bodyContent.push(descriptionContent);
		bodyContent.push("");

		// Acceptance criteria section
		bodyContent.push(formatHeading("Acceptance Criteria", 2));
		// Extract checkbox lines from raw content to preserve checkbox state
		const checkboxLines = extractAcceptanceCriteriaWithCheckboxes(currentSelectedContent);
		if (checkboxLines.length > 0) {
			const formattedCriteria = checkboxLines.map((line) => {
				const checkboxItem = parseCheckboxLine(line);
				if (checkboxItem) {
					// Use nice Unicode symbols for checkboxes in TUI
					return formatChecklistItem(checkboxItem, {
						padding: " ",
						checkedSymbol: "{green-fg}✓{/}",
						uncheckedSymbol: "{gray-fg}○{/}",
					});
				}
				// Handle non-checkbox lines
				return ` ${line}`;
			});
			const criteriaContent = styleCodePaths(formattedCriteria.join("\n"));
			bodyContent.push(criteriaContent);
		} else if (currentSelectedTask.acceptanceCriteriaItems?.length) {
			// Fallback to structured criteria if no checkboxes found in raw content
			const criteriaContent = styleCodePaths(
				currentSelectedTask.acceptanceCriteriaItems.map((item) => ` • ${item.text}`).join("\n"),
			);
			bodyContent.push(criteriaContent);
		} else {
			bodyContent.push("{gray-fg}No acceptance criteria defined{/}");
		}
		bodyContent.push("");

		// Implementation Plan section
		const implementationPlan = currentSelectedTask.implementationPlan?.trim();
		if (implementationPlan) {
			bodyContent.push(formatHeading("Implementation Plan", 2));
			bodyContent.push(transformCodePaths(implementationPlan));
			bodyContent.push("");
		}

		// Implementation Notes section
		const implementationNotes = currentSelectedTask.implementationNotes?.trim();
		if (implementationNotes) {
			bodyContent.push(formatHeading("Implementation Notes", 2));
			bodyContent.push(transformCodePaths(implementationNotes));
			bodyContent.push("");
		}

		// Set the complete body content
		bodyContainer.setContent(bodyContent.join("\n"));

		// Reset scroll position to top
		bodyContainer.setScrollPerc?.(0);

		// Store reference to body container for focus management
		descriptionBox = bodyContainer;

		screen.render();
	}

	// Generic list is already created and initialized above

	// Initial render of detail pane
	refreshDetailPane();

	return new Promise<void>((resolve) => {
		// Footer hint line
		const helpBar = box({
			parent: screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			content: "",
			style: {
				fg: "gray",
				bg: "black",
			},
		});

		// Initialize help bar updater now that help bar exists
		updateHelpBar = function updateHelpBar() {
			// Minimal footer: hide filter/move badges and extra controls
			helpBar.setContent(" ↑/↓ navigate · ← task list · → detail · E edit · q/Esc quit ");
		};

		updateHelpBar();

		// Focus management
		let focusIndex = 0; // 0 = task list, 1 = detail pane

		const updateFocus = (newIndex: number) => {
			if (newIndex < 0 || newIndex > 1) return;

			focusIndex = newIndex;

			// Get the task list's actual list box
			const listBox = taskList.getListBox();

			// Update border colors
			if (focusIndex === 0) {
				(taskListPane.style as { border: { fg?: string } }).border.fg = "yellow";
				(detailPane.style as { border: { fg?: string } }).border.fg = "gray";
				listBox.focus();
			} else {
				(taskListPane.style as { border: { fg?: string } }).border.fg = "gray";
				(detailPane.style as { border: { fg?: string } }).border.fg = "yellow";
				descriptionBox?.focus();
				// Ensure we start at the top when focusing detail pane
				descriptionBox?.setScrollPerc?.(0);
			}

			screen.render();
		};

		// Initialize focus based on whether we're viewing a specific task or list
		const initialFocus = options.startWithDetailFocus === true ? 1 : 0;

		// Ensure the screen is rendered before setting initial focus
		process.nextTick(() => {
			updateFocus(initialFocus);
		});

		// Navigation between panes or view switching
		screen.key(["tab"], async () => {
			if (options.onTabPress) {
				// Use custom Tab handler - caller manages view switching
				screen.destroy();
				await options.onTabPress();
				resolve();
			} else if (options.viewSwitcher) {
				// Use view switcher to switch to kanban
				screen.destroy();
				await options.viewSwitcher.switchView();
				resolve();
			} else {
				// Fall back to old behavior - toggle between panes
				updateFocus(focusIndex === 0 ? 1 : 0);
			}
		});

		screen.key(["S-tab"], () => {
			// Shift+Tab always toggles between panes (internal navigation)
			updateFocus(focusIndex === 0 ? 1 : 0);
		});

		// Direct pane navigation
		screen.key(["left", "h"], () => {
			updateFocus(0); // Always go to task list
		});

		screen.key(["right", "l"], () => {
			updateFocus(1); // Always go to detail pane
		});

		// Edit in external editor with proper TUI handoff
		screen.key(["e", "E"], async () => {
			if (!currentSelectedTask) return;
			try {
				const filePath = await getTaskPath(currentSelectedTask.id, core);
				if (!filePath) return;

				type ProgWithPause = { pause?: () => () => void };
				const scr = screen as unknown as { program?: ProgWithPause; leave?: () => void; enter?: () => void };
				const prog = scr.program;
				const resumeProgram = typeof prog?.pause === "function" ? prog.pause() : undefined;
				try {
					scr.leave?.();
				} catch {}
				try {
					await core.openEditor(filePath);
				} finally {
					try {
						scr.enter?.();
					} catch {}
					try {
						if (typeof resumeProgram === "function") resumeProgram();
					} catch {}
					screen.render();
				}
			} catch {
				// Silently handle errors
			}
		});

		// Exit keys
		screen.key(["escape", "q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		screen.render();
	});
}

/**
 * Generate enhanced detail content structure (reusable)
 */
function generateDetailContent(task: Task, rawContent = ""): { headerContent: string[]; bodyContent: string[] } {
	// Format header content - just status and title
	const headerContent = [
		` {${getStatusColor(task.status)}-fg}${formatStatusWithIcon(task.status)}{/} {bold}{blue-fg}${task.id}{/blue-fg}{/bold} - ${task.title}`,
	];

	// Build the scrollable body content
	const bodyContent = [];

	// Add details section with all metadata
	bodyContent.push(formatHeading("Details", 2));

	const metadata = [];

	// Always show created date
	metadata.push(`{bold}Created:{/bold} ${formatDateForDisplay(task.createdDate)}`);

	// Show updated date if different from created
	if (task.updatedDate && task.updatedDate !== task.createdDate) {
		metadata.push(`{bold}Updated:{/bold} ${formatDateForDisplay(task.updatedDate)}`);
	}

	// Priority
	if (task.priority) {
		const priorityDisplay = getPriorityDisplay(task.priority);
		const priorityText = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
		metadata.push(`{bold}Priority:{/bold} ${priorityText}${priorityDisplay}`);
	}

	// Assignee
	if (task.assignee?.length) {
		const assigneeList = task.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ");
		metadata.push(`{bold}Assignee:{/bold} {cyan-fg}${assigneeList}{/}`);
	}

	// Labels
	if (task.labels?.length) {
		metadata.push(`{bold}Labels:{/bold} ${task.labels.map((l) => `{yellow-fg}[${l}]{/}`).join(" ")}`);
	}

	// Reporter
	if (task.reporter) {
		const reporterText = task.reporter.startsWith("@") ? task.reporter : `@${task.reporter}`;
		metadata.push(`{bold}Reporter:{/bold} {cyan-fg}${reporterText}{/}`);
	}

	// Milestone
	if (task.milestone) {
		metadata.push(`{bold}Milestone:{/bold} {magenta-fg}${task.milestone}{/}`);
	}

	// Parent task
	if (task.parentTaskId) {
		metadata.push(`{bold}Parent:{/bold} {blue-fg}${task.parentTaskId}{/}`);
	}

	// Subtasks
	if (task.subtasks?.length) {
		metadata.push(`{bold}Subtasks:{/bold} ${task.subtasks.length} task${task.subtasks.length > 1 ? "s" : ""}`);
	}

	// Dependencies
	if (task.dependencies?.length) {
		metadata.push(`{bold}Dependencies:{/bold} ${task.dependencies.join(", ")}`);
	}

	bodyContent.push(metadata.join("\n"));
	bodyContent.push("");

	// Description section
	bodyContent.push(formatHeading("Description", 2));
	const descriptionText = task.description?.trim();
	const descriptionContent = descriptionText
		? transformCodePaths(descriptionText)
		: "{gray-fg}No description provided{/}";
	bodyContent.push(descriptionContent);
	bodyContent.push("");

	// Acceptance criteria section
	bodyContent.push(formatHeading("Acceptance Criteria", 2));
	// Extract checkbox lines from raw content to preserve checkbox state
	const checkboxLines = extractAcceptanceCriteriaWithCheckboxes(rawContent);
	if (checkboxLines.length > 0) {
		const formattedCriteria = checkboxLines.map((line) => {
			const checkboxItem = parseCheckboxLine(line);
			if (checkboxItem) {
				// Use nice Unicode symbols for checkboxes in TUI
				return formatChecklistItem(checkboxItem, {
					padding: " ",
					checkedSymbol: "{green-fg}✓{/}",
					uncheckedSymbol: "{gray-fg}○{/}",
				});
			}
			// Handle non-checkbox lines
			return ` ${line}`;
		});
		const criteriaContent = styleCodePaths(formattedCriteria.join("\n"));
		bodyContent.push(criteriaContent);
	} else if (task.acceptanceCriteriaItems?.length) {
		// Prefer structured criteria if available
		const criteriaContent = styleCodePaths(task.acceptanceCriteriaItems.map((c) => ` • ${c.text}`).join("\n"));
		bodyContent.push(criteriaContent);
	} else {
		bodyContent.push("{gray-fg}No acceptance criteria defined{/}");
	}
	bodyContent.push("");

	// Implementation Plan section
	const implementationPlan = task.implementationPlan?.trim();
	if (implementationPlan) {
		bodyContent.push(formatHeading("Implementation Plan", 2));
		bodyContent.push(transformCodePaths(implementationPlan));
		bodyContent.push("");
	}

	// Implementation Notes section
	const implementationNotes = task.implementationNotes?.trim();
	if (implementationNotes) {
		bodyContent.push(formatHeading("Implementation Notes", 2));
		bodyContent.push(transformCodePaths(implementationNotes));
		bodyContent.push("");
	}

	return { headerContent, bodyContent };
}

/**
 * Display task details in a popup (for board view) using enhanced detail structure
 */
export async function createTaskPopup(
	screen: ScreenInterface,
	task: Task,
	content: string,
): Promise<{
	background: BoxInterface;
	popup: BoxInterface;
	contentArea: ScrollableTextInterface;
	close: () => void;
} | null> {
	if (output.isTTY === false) return null;

	// Create main popup first
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

	// Create background overlay positioned relative to popup
	// Using offset positioning: -2 chars left/right, -1 char top/bottom
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

	// Move popup to front
	popup.setFront?.();

	// Generate enhanced detail content
	const { headerContent, bodyContent } = generateDetailContent(task, content);

	// Header section with task info
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

	// Divider line
	const _dividerLine = line({
		parent: popup,
		top: headerBox.bottom,
		left: 1,
		right: 1,
		orientation: "horizontal",
		style: {
			fg: "gray",
		},
	});

	// Escape indicator
	const _escIndicator = box({
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

	// Scrollable body container beneath the header
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

	// Set up close handler
	const closePopup = () => {
		background.destroy();
		popup.destroy();
		screen.render();
	};

	// Focus content area for scrolling
	contentArea.focus();

	return {
		background,
		popup,
		contentArea,
		close: closePopup,
	};
}

export function formatTaskPlainText(task: Task, content: string, filePath?: string): string {
	const lines = [];

	// Add file path as first line if provided
	if (filePath) {
		lines.push(`File: ${filePath}`);
		lines.push("");
	}

	lines.push(`Task ${task.id} - ${task.title}`);
	lines.push("=".repeat(50));
	lines.push("");
	lines.push(`Status: ${formatStatusWithIcon(task.status)}`);
	if (task.priority) lines.push(`Priority: ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`);
	if (task.assignee?.length)
		lines.push(`Assignee: ${task.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ")}`);
	if (task.reporter) lines.push(`Reporter: ${task.reporter.startsWith("@") ? task.reporter : `@${task.reporter}`}`);
	lines.push(`Created: ${formatDateForDisplay(task.createdDate)}`);
	if (task.updatedDate) lines.push(`Updated: ${formatDateForDisplay(task.updatedDate)}`);
	if (task.labels?.length) lines.push(`Labels: ${task.labels.join(", ")}`);
	if (task.milestone) lines.push(`Milestone: ${task.milestone}`);
	if (task.parentTaskId) lines.push(`Parent: ${task.parentTaskId}`);
	if (task.subtasks?.length) lines.push(`Subtasks: ${task.subtasks.length}`);
	if (task.dependencies?.length) lines.push(`Dependencies: ${task.dependencies.join(", ")}`);
	lines.push("");

	// Description section
	lines.push("Description:");
	lines.push("-".repeat(50));
	const description = task.description?.trim();
	lines.push(transformCodePathsPlain(description && description.length > 0 ? description : "No description provided"));
	lines.push("");

	// Acceptance Criteria section with checkboxes
	lines.push("Acceptance Criteria:");
	lines.push("-".repeat(50));
	const checkboxLines = extractAcceptanceCriteriaWithCheckboxes(content);
	if (checkboxLines.length > 0) {
		for (const line of checkboxLines) {
			lines.push(line);
		}
	} else if (task.acceptanceCriteriaItems?.length) {
		// Prefer structured criteria if available
		for (const c of task.acceptanceCriteriaItems) {
			lines.push(`• ${transformCodePathsPlain(c.text)}`);
		}
	} else {
		lines.push("No acceptance criteria defined");
	}
	lines.push("");

	// Implementation Plan section
	const implementationPlan = task.implementationPlan?.trim();
	if (implementationPlan) {
		lines.push("Implementation Plan:");
		lines.push("-".repeat(50));
		lines.push(transformCodePathsPlain(implementationPlan));
		lines.push("");
	}

	// Implementation Notes section
	const implementationNotes = task.implementationNotes?.trim();
	if (implementationNotes) {
		lines.push("Implementation Notes:");
		lines.push("-".repeat(50));
		lines.push(transformCodePathsPlain(implementationNotes));
		lines.push("");
	}

	return lines.join("\n");
}

function styleCodePaths(content: string): string {
	return transformCodePaths(content);
}
