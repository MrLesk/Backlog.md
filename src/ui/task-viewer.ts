/* Enhanced task viewer for displaying task details in a structured format */

import { createRequire } from "node:module";
import { stdin as input, stdout as output } from "node:process";
import { Core } from "../core/backlog.ts";
import { parseMarkdown } from "../markdown/parser.ts";
import type { Task } from "../types/index.ts";
import { transformCodePaths, transformCodePathsPlain } from "./code-path.ts";
import { formatHeading } from "./heading.ts";
import { formatStatusWithIcon, getStatusColor, getStatusIcon } from "./status-icon.ts";
import { TaskList } from "./task-list.ts";

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
 * Display task details in a popup (for board view)
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
		height: "85%",
		border: "line",
		style: {
			border: { fg: "blue" },
		},
		keys: true,
		tags: true,
		label: ` {bold}{blue-fg}${task.id}{/blue-fg}{/bold} - ${task.title} `,
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

	// Create inner container for content
	const innerContainer = blessed.box({
		parent: popup,
		top: 0,
		left: 0,
		width: "100%-2",
		height: "100%-2",
		padding: 1,
	});

	// Status and assignee line
	const statusLine = blessed.box({
		parent: innerContainer,
		top: 0,
		left: 0,
		width: "100%",
		height: 1,
		tags: true,
		content: `{${getStatusColor(task.status)}-fg}${formatStatusWithIcon(task.status)}{/} ${task.assignee?.length ? `• {cyan-fg}${task.assignee.map((a) => (a.startsWith("@") ? a : `@${a}`)).join(", ")}{/}` : ""} • {gray-fg}${task.createdDate}{/}`,
		wrap: true,
	});

	// Labels in styled box
	const metadataLine = blessed.box({
		parent: innerContainer,
		top: 2,
		left: 0,
		width: "100%",
		height: 1,
		border: "line",
		style: {
			border: { fg: "gray" },
			fg: "magenta",
		},
		tags: true,
		content: task.labels?.length ? task.labels.map((l) => `[${l}]`).join(" ") : "{gray-fg}No labels{/}",
		wrap: true,
	});

	// Divider
	const divider = blessed.line({
		parent: innerContainer,
		top: 5,
		left: 0,
		width: "100%",
		orientation: "horizontal",
		style: {
			fg: "gray",
		},
	});

	// Content area
	const contentArea = blessed.box({
		parent: innerContainer,
		top: 6,
		left: 0,
		width: "100%",
		height: "100%-6",
		scrollable: true,
		alwaysScroll: true,
		keys: true,
		mouse: true,
		tags: true,
		content: formatTaskContent(task, content),
		wrap: true,
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

function formatTaskContent(task: Task, rawContent: string): string {
	const sections = [];

	if (task.description) {
		sections.push("");
		sections.push(formatHeading("Description", 2));
		sections.push(transformCodePaths(task.description));
		sections.push("");
	}

	if (task.acceptanceCriteria?.length) {
		sections.push("");
		sections.push(formatHeading("Acceptance Criteria", 2));
		for (const criterion of task.acceptanceCriteria) {
			sections.push(transformCodePaths(criterion));
		}
		sections.push("");
	}

	if (task.dependencies?.length) {
		sections.push("");
		sections.push(formatHeading("Dependencies", 2));
		sections.push(`  ${task.dependencies.join(", ")}`);
		sections.push("");
	}

	if (task.subtasks?.length) {
		sections.push("");
		sections.push(formatHeading("Subtasks", 2));
		for (const subtask of task.subtasks) {
			sections.push(`  • ${subtask}`);
		}
		sections.push("");
	}

	// No raw content needed - all information is already displayed

	return styleCodePaths(sections.join("\n"));
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
