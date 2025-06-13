/* Enhanced task viewer for displaying task details in a structured format */

import { createRequire } from "node:module";
import { stdin as input, stdout as output } from "node:process";
import { Core } from "../core/backlog.ts";
import { parseMarkdown } from "../markdown/parser.ts";
import type { Task } from "../types/index.ts";
import { formatChecklistItem, parseCheckboxLine } from "./checklist.ts";
import { transformCodePaths, transformCodePathsPlain } from "./code-path.ts";
import { formatHeading } from "./heading.ts";
import { formatStatusWithIcon, getStatusColor, getStatusIcon } from "./status-icon.ts";
import { TaskList } from "./task-list.ts";

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
	if (!match) return [];

	return match[1]
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("- [ ]") || line.startsWith("- [x]"));
}

// Load blessed dynamically
// biome-ignore lint/suspicious/noExplicitAny: blessed is dynamically loaded
async function loadBlessed(): Promise<any | null> {
	if (output.isTTY === false) return null;
	try {
		const require = createRequire(import.meta.url);
		const blessed = require("blessed");
		return blessed;
	} catch {
		try {
			// biome-ignore lint/suspicious/noExplicitAny: dynamic import
			const mod = (await import("blessed")) as any;
			return mod.default ?? mod;
		} catch {
			return null;
		}
	}
}

/**
 * Display task details in a split-pane UI with task list on left and detail on right
 */
export async function viewTaskEnhanced(task: Task, content: string): Promise<void> {
	const blessed = await loadBlessed();
	if (!blessed) {
		// Fallback to formatted plain text
		console.log(formatTaskPlainText(task, content));
		return;
	}

	// Get project root and load all tasks
	const cwd = process.cwd();
	const core = new Core(cwd);
	const allTasks = await core.filesystem.listTasks();

	// Find the initial selected task index
	const initialIndex = allTasks.findIndex((t) => t.id === task.id);
	let currentSelectedTask = task;
	let currentSelectedContent = content;

	const screen = blessed.screen({
		smartCSR: true,
		title: "Backlog Tasks",
	});

	// Main container using grid layout
	const container = blessed.box({
		parent: screen,
		width: "100%",
		height: "100%",
		autoPadding: true,
	});

	// Task list pane (left 40%)
	const taskListPane = blessed.box({
		parent: container,
		top: 0,
		left: 0,
		width: "40%",
		height: "100%-1", // Leave space for help bar
	});

	// Detail pane (right 60%) with border and padding
	const detailPane = blessed.box({
		parent: container,
		top: 0,
		left: "40%",
		// left: taskListPane.width,
		// left : "0%",
		width: "60%",
		height: "100%-1", // Leave space for help bar
		// border: {
		// 	type: "line",
		// },
		// padding: {
		// 	left: 1,
		// },
		// style: {
		// 	border: { fg: "gray" },
		// },
	});

	// Create task list
	const taskList = new TaskList({
		parent: taskListPane,
		tasks: allTasks,
		selectedIndex: Math.max(0, initialIndex),
		onSelect: (selectedTask: Task, index: number) => {
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
	});

	// Detail pane components
	// biome-ignore lint/suspicious/noExplicitAny: blessed components don't have proper types
	let headerBox: any;
	// biome-ignore lint/suspicious/noExplicitAny: blessed components don't have proper types
	let metadataBox: any;
	// biome-ignore lint/suspicious/noExplicitAny: blessed components don't have proper types
	let descriptionBox: any;
	// biome-ignore lint/suspicious/noExplicitAny: blessed components don't have proper types
	let bottomBox: any;

	function refreshDetailPane() {
		// Clear existing detail pane content
		if (headerBox) headerBox.destroy();
		if (metadataBox) metadataBox.destroy();
		if (descriptionBox) descriptionBox.destroy();
		if (bottomBox) bottomBox.destroy();

		// Update screen title
		screen.title = `Task ${currentSelectedTask.id} - ${currentSelectedTask.title}`;

		// Fixed header section with task ID, title, status, date, and tags
		headerBox = blessed.box({
			parent: detailPane,
			top: 0,
			left: 0,
			width: "100%-2", // Account for border
			height: 3,
			border: "line",
			style: {
				border: { fg: "blue" },
			},
			tags: true,
			wrap: true,
			scrollable: false, // Header should never scroll
		});

		// Format header content with key metadata
		const headerContent = [];
		headerContent.push(` {bold}{blue-fg}${currentSelectedTask.id}{/blue-fg}{/bold} - ${currentSelectedTask.title}`);

		// Second line with status, date, and assignee
		const statusLine = [];
		statusLine.push(
			`{${getStatusColor(currentSelectedTask.status)}-fg}${formatStatusWithIcon(currentSelectedTask.status)}{/}`,
		);
		statusLine.push(`{gray-fg}${currentSelectedTask.createdDate}{/}`);

		if (currentSelectedTask.assignee?.length) {
			const assigneeList = currentSelectedTask.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ");
			statusLine.push(`{cyan-fg}${assigneeList}{/}`);
		}

		// Add labels to header if they exist
		if (currentSelectedTask.labels?.length) {
			statusLine.push(`${currentSelectedTask.labels.map((l) => `{yellow-fg}[${l}]{/}`).join(" ")}`);
		}

		headerContent.push(` ${statusLine.join(" • ")}`);

		headerBox.setContent(headerContent.join("\n"));

		// Scrollable body container beneath the header
		const bodyContainer = blessed.box({
			parent: detailPane,
			top: 3, // Start below the fixed header
			left: 0,
			width: "100%-2", // Account for border
			height: "100%-4", // Fill remaining space below header
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			mouse: true,
			tags: true,
			wrap: true,
			padding: { left: 1, right: 1, top: 1 },
		});

		// Build the scrollable body content
		const bodyContent = [];

		// Add additional metadata section
		if (
			currentSelectedTask.reporter ||
			currentSelectedTask.updatedDate ||
			currentSelectedTask.milestone ||
			currentSelectedTask.parentTaskId ||
			currentSelectedTask.subtasks?.length ||
			currentSelectedTask.dependencies?.length
		) {
			bodyContent.push(formatHeading("Details", 2));

			const metadata = [];
			if (currentSelectedTask.reporter) {
				const reporterText = currentSelectedTask.reporter.startsWith("@")
					? currentSelectedTask.reporter
					: `@${currentSelectedTask.reporter}`;
				metadata.push(`{bold}Reporter:{/bold} {cyan-fg}${reporterText}{/}`);
			}

			if (currentSelectedTask.updatedDate) {
				metadata.push(`{bold}Updated:{/bold} ${currentSelectedTask.updatedDate}`);
			}

			if (currentSelectedTask.milestone) {
				metadata.push(`{bold}Milestone:{/bold} {magenta-fg}${currentSelectedTask.milestone}{/}`);
			}

			if (currentSelectedTask.parentTaskId) {
				metadata.push(`{bold}Parent:{/bold} {blue-fg}${currentSelectedTask.parentTaskId}{/}`);
			}

			if (currentSelectedTask.subtasks?.length) {
				metadata.push(
					`{bold}Subtasks:{/bold} ${currentSelectedTask.subtasks.length} task${currentSelectedTask.subtasks.length > 1 ? "s" : ""}`,
				);
			}

			if (currentSelectedTask.dependencies?.length) {
				metadata.push(`{bold}Dependencies:{/bold} ${currentSelectedTask.dependencies.join(", ")}`);
			}

			bodyContent.push(metadata.join("\n"));
			bodyContent.push("");
		}

		// Description section
		bodyContent.push(formatHeading("Description", 2));
		const descriptionContent = currentSelectedTask.description
			? transformCodePaths(currentSelectedTask.description)
			: "{gray-fg}No description provided{/}";
		bodyContent.push(descriptionContent);
		bodyContent.push("");

		// Acceptance criteria section
		bodyContent.push(formatHeading("Acceptance Criteria", 2));
		if (currentSelectedTask.acceptanceCriteria?.length) {
			const criteriaContent = styleCodePaths(currentSelectedTask.acceptanceCriteria.join("\n"));
			bodyContent.push(criteriaContent);
		} else {
			bodyContent.push("{gray-fg}No acceptance criteria defined{/}");
		}

		// Set the complete body content
		bodyContainer.setContent(bodyContent.join("\n"));

		// Store reference to body container for focus management
		descriptionBox = bodyContainer;

		screen.render();
	}

	await taskList.create({
		parent: taskListPane,
		tasks: allTasks,
		selectedIndex: Math.max(0, initialIndex),
		width: "100%",
		height: "100%",
	});

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
			border: "line",
			content: " ↑/↓ navigate · Tab switch pane · ←/→ scroll · q/Esc quit ",
			style: {
				fg: "gray",
				border: { fg: "gray" },
			},
		});

		// Focus management
		const focusableElements = [taskList.getListBox(), descriptionBox];
		let focusIndex = 0; // Start with task list
		focusableElements[focusIndex].focus();

		// Tab navigation between panes
		screen.key(["tab"], () => {
			focusIndex = (focusIndex + 1) % focusableElements.length;
			focusableElements[focusIndex].focus();
			screen.render();
		});

		screen.key(["S-tab"], () => {
			focusIndex = (focusIndex - 1 + focusableElements.length) % focusableElements.length;
			focusableElements[focusIndex].focus();
			screen.render();
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
	// Format header content with key metadata
	const headerContent = [];
	headerContent.push(` {bold}{blue-fg}${task.id}{/blue-fg}{/bold} - ${task.title}`);

	// Second line with status, date, and assignee
	const statusLine = [];
	statusLine.push(`{${getStatusColor(task.status)}-fg}${formatStatusWithIcon(task.status)}{/}`);
	statusLine.push(`{gray-fg}${task.createdDate}{/}`);

	if (task.assignee?.length) {
		const assigneeList = task.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ");
		statusLine.push(`{cyan-fg}${assigneeList}{/}`);
	}

	// Add labels to header if they exist
	if (task.labels?.length) {
		statusLine.push(`${task.labels.map((l) => `{yellow-fg}[${l}]{/}`).join(" ")}`);
	}

	headerContent.push(` ${statusLine.join(" • ")}`);

	// Build the scrollable body content
	const bodyContent = [];

	// Add additional metadata section
	if (
		task.reporter ||
		task.updatedDate ||
		task.milestone ||
		task.parentTaskId ||
		task.subtasks?.length ||
		task.dependencies?.length
	) {
		bodyContent.push(formatHeading("Details", 2));

		const metadata = [];
		if (task.reporter) {
			const reporterText = task.reporter.startsWith("@") ? task.reporter : `@${task.reporter}`;
			metadata.push(`{bold}Reporter:{/bold} {cyan-fg}${reporterText}{/}`);
		}

		if (task.updatedDate) {
			metadata.push(`{bold}Updated:{/bold} ${task.updatedDate}`);
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
	}

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

	return { headerContent, bodyContent };
}

/**
 * Display task details in a popup (for board view) using enhanced detail structure
 */
// biome-ignore lint/suspicious/noExplicitAny: blessed types
export async function createTaskPopup(screen: any, task: Task, content: string): Promise<any> {
	const blessed = await loadBlessed();
	if (!blessed) return null;

	// Create background overlay
	const background = blessed.box({
		parent: screen,
		top: "center",
		left: "center",
		width: "88%",
		height: "88%",
		style: {
			bg: "black",
		},
	});

	// Create main popup
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

	// Generate enhanced detail content
	const { headerContent, bodyContent } = generateDetailContent(task, content);

	// Fixed header section with task ID, title, status, date, and tags
	const headerBox = blessed.box({
		parent: popup,
		top: 0,
		left: 0,
		width: "100%-2", // Account for border
		height: 3,
		border: "line",
		style: {
			border: { fg: "blue" },
		},
		tags: true,
		wrap: true,
		scrollable: false, // Header should never scroll
		content: headerContent.join("\n"),
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
		top: 3, // Start below the fixed header
		left: 0,
		width: "100%-2", // Account for border
		height: "100%-4", // Reset to normal height since popup is smaller
		scrollable: true,
		alwaysScroll: false,
		keys: true,
		mouse: true,
		tags: true,
		wrap: true,
		padding: { left: 1, right: 1, top: 1 },
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

function formatTaskPlainText(task: Task, content: string): string {
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
	lines.push("Description:");
	lines.push("-".repeat(50));
	lines.push(transformCodePathsPlain(task.description || "No description provided"));
	lines.push("");
	if (task.acceptanceCriteria?.length) {
		lines.push("Acceptance Criteria:");
		lines.push("-".repeat(50));
		for (const c of task.acceptanceCriteria) {
			lines.push(transformCodePathsPlain(c));
		}
		lines.push("");
	}
	lines.push("Content:");
	lines.push("-".repeat(50));
	lines.push(transformCodePathsPlain(content));
	return lines.join("\n");
}

function styleCodePaths(content: string): string {
	return transformCodePaths(content);
}
