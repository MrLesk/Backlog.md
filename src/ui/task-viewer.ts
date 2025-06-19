/* Enhanced task viewer for displaying task details in a structured format */

import { stdout as output } from "node:process";
import blessed from "blessed";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { formatChecklistItem, parseCheckboxLine } from "./checklist.ts";
import { transformCodePaths, transformCodePathsPlain } from "./code-path.ts";
import { createGenericList } from "./components/generic-list.ts";
import { formatHeading } from "./heading.ts";
import { formatStatusWithIcon, getStatusColor } from "./status-icon.ts";
import { createScreen } from "./tui.ts";

/**
 * Extract only the Description section content from markdown, avoiding duplication
 */
function extractDescriptionSection(content: string): string | null {
	if (!content) return null;

	// Look for ## Description section
	const regex = /## Description\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = content.match(regex);
	return match?.[1]?.trim() || null;
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
 * Extract Implementation Plan section content from markdown
 */
function extractImplementationPlanSection(content: string): string | null {
	if (!content) return null;

	// Look for ## Implementation Plan section
	const regex = /## Implementation Plan\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = content.match(regex);
	return match?.[1]?.trim() || null;
}

/**
 * Extract Implementation Notes section content from markdown
 */
function extractImplementationNotesSection(content: string): string | null {
	if (!content) return null;

	// Look for ## Implementation Notes section
	const regex = /## Implementation Notes\s*\n([\s\S]*?)(?=\n## |$)/i;
	const match = content.match(regex);
	return match?.[1]?.trim() || null;
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
	} = {},
): Promise<void> {
	if (output.isTTY === false) {
		console.log(formatTaskPlainText(task, content));
		return;
	}

	// Get project root and load tasks
	const cwd = process.cwd();
	const core = options.core || new Core(cwd);
	const allTasks = options.tasks || (await core.filesystem.listTasks());

	// Find the initial selected task index
	const initialIndex = allTasks.findIndex((t) => t.id === task.id);
	let currentSelectedTask = task;
	let currentSelectedContent = content;

	const screen = createScreen({ title: options.title || "Backlog Tasks" });

	// Main container using grid layout
	const container = blessed.box({
		parent: screen,
		width: "100%",
		height: "100%",
		autoPadding: true,
	});

	// Task list pane (left 40%) with border
	const taskListPane = blessed.box({
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
		label: ` ${options.title || "Tasks"} `,
	});

	// Detail pane (right 60%) with border
	const detailPane = blessed.box({
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
		label: " Details ",
	});

	// Create task list using generic list component
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

			return `{${statusColor}-fg}${statusIcon}{/} {bold}${task.id}{/bold} - ${task.title}${assigneeText}${labelsText}`;
		},
		onSelect: (selected: Task | Task[]) => {
			const selectedTask = Array.isArray(selected) ? selected[0] : selected;
			if (!selectedTask) return;
			currentSelectedTask = selectedTask;
			// Load the content for the selected task asynchronously
			(async () => {
				try {
					const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.tasksDir }));
					const normalizedId = selectedTask.id.startsWith("task-") ? selectedTask.id : `task-${selectedTask.id}`;
					const taskFile = files.find((f) => f.startsWith(`${normalizedId} -`));

					if (taskFile) {
						const filePath = `${core.filesystem.tasksDir}/${taskFile}`;
						currentSelectedContent = await Bun.file(filePath).text();
					} else {
						currentSelectedContent = "";
					}
				} catch (error) {
					currentSelectedContent = "";
				}

				// Refresh the detail pane
				refreshDetailPane();
			})();
		},
		showHelp: false, // We'll show help in the footer
	});

	// Detail pane components
	// biome-ignore lint/suspicious/noExplicitAny: blessed components don't have proper types
	let headerBox: any;
	// biome-ignore lint/suspicious/noExplicitAny: blessed components don't have proper types
	let divider: any;
	// biome-ignore lint/suspicious/noExplicitAny: blessed components don't have proper types
	let descriptionBox: any;

	function refreshDetailPane() {
		// Clear existing detail pane content
		if (headerBox) headerBox.destroy();
		if (divider) divider.destroy();
		if (descriptionBox) descriptionBox.destroy();

		// Update screen title
		screen.title = `Task ${currentSelectedTask.id} - ${currentSelectedTask.title}`;

		// Header section with task ID, title, and status
		headerBox = blessed.box({
			parent: detailPane,
			top: 0,
			left: 0,
			width: "100%-2", // Account for left and right borders
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
		divider = blessed.line({
			parent: detailPane,
			top: headerBox.bottom,
			left: 0,
			width: "100%-2", // Account for left and right borders
			orientation: "horizontal",
			style: {
				fg: "gray",
			},
		});

		// Scrollable body container beneath the header
		const bodyContainer = blessed.box({
			parent: detailPane,
			top: headerBox.bottom + 1,
			left: 0,
			width: "100%-2", // Account for left and right borders
			bottom: 1, // Leave space for bottom border
			scrollable: true,
			alwaysScroll: true,
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
		metadata.push(`{bold}Created:{/bold} ${currentSelectedTask.createdDate}`);

		// Show updated date if different from created
		if (currentSelectedTask.updatedDate && currentSelectedTask.updatedDate !== currentSelectedTask.createdDate) {
			metadata.push(`{bold}Updated:{/bold} ${currentSelectedTask.updatedDate}`);
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
		// Extract only the Description section content, not the full markdown
		const extractedDescription = extractDescriptionSection(currentSelectedTask.description);
		const descriptionContent = extractedDescription
			? transformCodePaths(extractedDescription)
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
		} else if (currentSelectedTask.acceptanceCriteria?.length) {
			// Fallback to parsed criteria if no checkboxes found in raw content
			const criteriaContent = styleCodePaths(
				currentSelectedTask.acceptanceCriteria.map((text) => ` • ${text}`).join("\n"),
			);
			bodyContent.push(criteriaContent);
		} else {
			bodyContent.push("{gray-fg}No acceptance criteria defined{/}");
		}
		bodyContent.push("");

		// Implementation Plan section
		const implementationPlan = extractImplementationPlanSection(currentSelectedContent);
		if (implementationPlan) {
			bodyContent.push(formatHeading("Implementation Plan", 2));
			bodyContent.push(transformCodePaths(implementationPlan));
			bodyContent.push("");
		}

		// Implementation Notes section
		const implementationNotes = extractImplementationNotesSection(currentSelectedContent);
		if (implementationNotes) {
			bodyContent.push(formatHeading("Implementation Notes", 2));
			bodyContent.push(transformCodePaths(implementationNotes));
			bodyContent.push("");
		}

		// Set the complete body content
		bodyContainer.setContent(bodyContent.join("\n"));

		// Reset scroll position to top
		bodyContainer.setScrollPerc(0);

		// Store reference to body container for focus management
		descriptionBox = bodyContainer;

		screen.render();
	}

	// Generic list is already created and initialized above

	// Initial render of detail pane
	refreshDetailPane();

	return new Promise<void>((resolve) => {
		// Footer hint line
		const helpBar = blessed.box({
			parent: screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			content: options.filterDescription
				? ` Filter: ${options.filterDescription} · ↑/↓ navigate · ← task list · → detail · Tab toggle · q/Esc quit `
				: " ↑/↓ navigate · ← task list · → detail · Tab toggle · q/Esc quit ",
			style: {
				fg: "gray",
				bg: "black",
			},
		});

		// Focus management
		let focusIndex = 0; // 0 = task list, 1 = detail pane

		const updateFocus = (newIndex: number) => {
			if (newIndex < 0 || newIndex > 1) return;

			focusIndex = newIndex;

			// Get the task list's actual list box
			const listBox = taskList.getListBox();

			// Update border colors
			if (focusIndex === 0) {
				taskListPane.style.border.fg = "yellow";
				detailPane.style.border.fg = "gray";
				listBox.focus();
			} else {
				taskListPane.style.border.fg = "gray";
				detailPane.style.border.fg = "yellow";
				descriptionBox.focus();
				// Ensure we start at the top when focusing detail pane
				descriptionBox.setScrollPerc(0);
			}

			screen.render();
		};

		// Initialize focus based on whether we're viewing a specific task or list
		const initialFocus = options.startWithDetailFocus === true ? 1 : 0;

		// Ensure the screen is rendered before setting initial focus
		process.nextTick(() => {
			updateFocus(initialFocus);
		});

		// Navigation between panes
		screen.key(["tab"], () => {
			updateFocus(focusIndex === 0 ? 1 : 0);
		});

		screen.key(["S-tab"], () => {
			updateFocus(focusIndex === 0 ? 1 : 0);
		});

		// Direct pane navigation
		screen.key(["left", "h"], () => {
			updateFocus(0); // Always go to task list
		});

		screen.key(["right", "l"], () => {
			updateFocus(1); // Always go to detail pane
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
	metadata.push(`{bold}Created:{/bold} ${task.createdDate}`);

	// Show updated date if different from created
	if (task.updatedDate && task.updatedDate !== task.createdDate) {
		metadata.push(`{bold}Updated:{/bold} ${task.updatedDate}`);
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
	// Extract only the Description section content, not the full markdown
	const extractedDescription = extractDescriptionSection(task.description);
	const descriptionContent = extractedDescription
		? transformCodePaths(extractedDescription)
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
	} else if (task.acceptanceCriteria?.length) {
		// Fallback to parsed criteria if no checkboxes found in raw content
		const criteriaContent = styleCodePaths(task.acceptanceCriteria.map((text) => ` • ${text}`).join("\n"));
		bodyContent.push(criteriaContent);
	} else {
		bodyContent.push("{gray-fg}No acceptance criteria defined{/}");
	}
	bodyContent.push("");

	// Implementation Plan section
	const implementationPlan = extractImplementationPlanSection(rawContent);
	if (implementationPlan) {
		bodyContent.push(formatHeading("Implementation Plan", 2));
		bodyContent.push(transformCodePaths(implementationPlan));
		bodyContent.push("");
	}

	// Implementation Notes section
	const implementationNotes = extractImplementationNotesSection(rawContent);
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
// biome-ignore lint/suspicious/noExplicitAny: blessed types
export async function createTaskPopup(screen: any, task: Task, content: string): Promise<any> {
	if (output.isTTY === false) return null;

	// Create main popup first
	const popup = blessed.box({
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
	const background = blessed.box({
		parent: screen,
		top: popup.top - 1,
		left: popup.left - 2,
		width: popup.width + 4,
		height: popup.height + 2,
		style: {
			bg: "black",
		},
	});

	// Move popup to front
	popup.setFront();

	// Generate enhanced detail content
	const { headerContent, bodyContent } = generateDetailContent(task, content);

	// Header section with task info
	const headerBox = blessed.box({
		parent: popup,
		top: 0,
		left: 0,
		width: "100%",
		height: "shrink",
		tags: true,
		wrap: true,
		scrollable: false,
		padding: { left: 1, right: 1 },
		content: headerContent.join("\n"),
	});

	// Divider line
	const dividerLine = blessed.line({
		parent: popup,
		top: headerBox.bottom,
		left: 0,
		width: "100%",
		orientation: "horizontal",
		style: {
			fg: "gray",
		},
	});

	// Escape indicator
	const escIndicator = blessed.box({
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
	const contentArea = blessed.box({
		parent: popup,
		top: headerBox.bottom + 1,
		left: 0,
		width: "100%",
		bottom: 0,
		scrollable: true,
		alwaysScroll: true,
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

export function formatTaskPlainText(task: Task, content: string): string {
	const lines = [];
	lines.push(`Task ${task.id} - ${task.title}`);
	lines.push("=".repeat(50));
	lines.push("");
	lines.push(`Status: ${formatStatusWithIcon(task.status)}`);
	if (task.assignee?.length)
		lines.push(`Assignee: ${task.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ")}`);
	if (task.reporter) lines.push(`Reporter: ${task.reporter.startsWith("@") ? task.reporter : `@${task.reporter}`}`);
	lines.push(`Created: ${task.createdDate}`);
	if (task.updatedDate) lines.push(`Updated: ${task.updatedDate}`);
	if (task.labels?.length) lines.push(`Labels: ${task.labels.join(", ")}`);
	if (task.milestone) lines.push(`Milestone: ${task.milestone}`);
	if (task.parentTaskId) lines.push(`Parent: ${task.parentTaskId}`);
	if (task.subtasks?.length) lines.push(`Subtasks: ${task.subtasks.length}`);
	if (task.dependencies?.length) lines.push(`Dependencies: ${task.dependencies.join(", ")}`);
	lines.push("");

	// Description section
	lines.push("Description:");
	lines.push("-".repeat(50));
	const description = extractDescriptionSection(content);
	lines.push(transformCodePathsPlain(description || "No description provided"));
	lines.push("");

	// Acceptance Criteria section with checkboxes
	lines.push("Acceptance Criteria:");
	lines.push("-".repeat(50));
	const checkboxLines = extractAcceptanceCriteriaWithCheckboxes(content);
	if (checkboxLines.length > 0) {
		for (const line of checkboxLines) {
			lines.push(line);
		}
	} else if (task.acceptanceCriteria?.length) {
		// Fallback to parsed criteria if no checkboxes found
		for (const c of task.acceptanceCriteria) {
			lines.push(`• ${transformCodePathsPlain(c)}`);
		}
	} else {
		lines.push("No acceptance criteria defined");
	}
	lines.push("");

	// Implementation Plan section
	const implementationPlan = extractImplementationPlanSection(content);
	if (implementationPlan) {
		lines.push("Implementation Plan:");
		lines.push("-".repeat(50));
		lines.push(transformCodePathsPlain(implementationPlan));
		lines.push("");
	}

	// Implementation Notes section
	const implementationNotes = extractImplementationNotesSection(content);
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
