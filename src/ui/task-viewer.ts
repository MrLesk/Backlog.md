/* Enhanced task viewer for displaying task details in a structured format */

import { createRequire } from "node:module";
import { stdin as input, stdout as output } from "node:process";
import { parseMarkdown } from "../markdown/parser.ts";
import type { Task } from "../types/index.ts";
import { formatHeading } from "./heading.ts";
import { formatStatusWithIcon, getStatusColor, getStatusIcon } from "./status-icon.ts";

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
 * Display task details in an enhanced UI with structured sections
 */
export async function viewTaskEnhanced(task: Task, content: string): Promise<void> {
	const blessed = await loadBlessed();
	if (!blessed) {
		// Fallback to formatted plain text
		console.log(formatTaskPlainText(task, content));
		return;
	}

	return new Promise<void>((resolve) => {
		const screen = blessed.screen({
			smartCSR: true,
			title: `Task ${task.id} - ${task.title}`,
		});

		// Main container
		const container = blessed.box({
			parent: screen,
			width: "100%",
			height: "100%",
		});

		// Header section with task ID and title
		const header = blessed.box({
			parent: container,
			top: 0,
			left: 0,
			width: "100%",
			height: 3,
			border: "line",
			style: {
				border: { fg: "blue" },
			},
			content: ` {bold}{blue-fg}${task.id}{/blue-fg}{/bold} - ${task.title}`,
			tags: true,
			wrap: true,
		});

		// Fixed tag box
		const tagBox = blessed.box({
			parent: container,
			top: 3,
			left: 0,
			width: "100%",
			height: 1,
			border: "line",
			style: {
				border: { fg: "gray" },
				fg: "magenta",
			},
			content: task.labels?.length ? task.labels.map((l) => `[${l}]`).join(" ") : "{gray-fg}No labels{/}",
			tags: true,
			wrap: true,
		});

		// Metadata box (left side)
		const metadataBox = blessed.box({
			parent: container,
			top: 4,
			left: 0,
			width: "40%",
			height: "50%-4",
			border: "line",
			label: ` ${formatHeading("Details", 3)} `,
			tags: true,
			padding: { left: 1, right: 1, top: 1 },
			wrap: true,
		});

		// Format metadata
		const metadata = [];
		metadata.push(`{bold}Status:{/bold} {${getStatusColor(task.status)}-fg}${formatStatusWithIcon(task.status)}{/}`);

		if (task.assignee?.length) {
			metadata.push(`{bold}Assignee:{/bold} ${task.assignee.map((a) => `{cyan-fg}@${a}{/}`).join(", ")}`);
		}

		if (task.reporter) {
			metadata.push(`{bold}Reporter:{/bold} {cyan-fg}@${task.reporter}{/}`);
		}

		metadata.push(`{bold}Created:{/bold} ${task.createdDate}`);

		if (task.updatedDate) {
			metadata.push(`{bold}Updated:{/bold} ${task.updatedDate}`);
		}

		if (task.labels?.length) {
			metadata.push(`{bold}Labels:{/bold} ${task.labels.map((l) => `{yellow-fg}[${l}]{/}`).join(" ")}`);
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

		metadataBox.setContent(metadata.join("\n"));

		// Description box (right side)
		const descriptionBox = blessed.box({
			parent: container,
			top: 4,
			left: "40%",
			width: "60%",
			height: "50%-4",
			border: "line",
			label: ` ${formatHeading("Description", 3)} `,
			tags: true,
			padding: { left: 1, right: 1, top: 1 },
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			mouse: true,
			wrap: true,
		});

		descriptionBox.setContent(task.description || "{gray-fg}No description provided{/}");

		// Acceptance criteria box (bottom)
		const bottomBox = blessed.box({
			parent: container,
			top: "50%",
			left: 0,
			width: "100%",
			height: "50%-1",
			border: "line",
			label: ` ${formatHeading("Acceptance Criteria", 3)} `,
			tags: true,
			padding: { left: 1, right: 1, top: 1 },
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			mouse: true,
			wrap: true,
		});

		// Parse the markdown content to extract sections
		if (task.acceptanceCriteria?.length) {
			const criteriaContent = task.acceptanceCriteria.join("\n");
			bottomBox.setContent(criteriaContent);
		} else {
			bottomBox.setContent("{gray-fg}No acceptance criteria defined{/}");
		}

		// Help bar at bottom
		const helpBar = blessed.box({
			parent: screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			content: " ↑/↓: Scroll | Tab: Switch section | q/Esc: Exit ",
			style: {
				fg: "white",
				bg: "blue",
			},
		});

		// Focus management
		const focusableElements = [descriptionBox, bottomBox];
		let focusIndex = 1; // Start with bottom box
		focusableElements[focusIndex].focus();

		// Tab navigation
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
		content: `{${getStatusColor(task.status)}-fg}${formatStatusWithIcon(task.status)}{/} ${task.assignee?.length ? `• {cyan-fg}@${task.assignee.join(", @")}{/}` : ""} • {gray-fg}${task.createdDate}{/}`,
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
		sections.push(task.description);
		sections.push("");
	}

	if (task.acceptanceCriteria?.length) {
		sections.push("");
		sections.push(formatHeading("Acceptance Criteria", 2));
		for (const criterion of task.acceptanceCriteria) {
			sections.push(criterion);
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

	return sections.join("\n");
}

function formatTaskPlainText(task: Task, content: string): string {
	const lines = [];
	lines.push(`Task ${task.id} - ${task.title}`);
	lines.push("=".repeat(50));
	lines.push("");
	lines.push(`Status: ${formatStatusWithIcon(task.status)}`);
	if (task.assignee?.length) lines.push(`Assignee: @${task.assignee.join(", @")}`);
	if (task.reporter) lines.push(`Reporter: @${task.reporter}`);
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
	lines.push(task.description || "No description provided");
	lines.push("");
	if (task.acceptanceCriteria?.length) {
		lines.push("Acceptance Criteria:");
		lines.push("-".repeat(50));
		for (const c of task.acceptanceCriteria) {
			lines.push(c);
		}
		lines.push("");
	}
	lines.push("Content:");
	lines.push("-".repeat(50));
	lines.push(content);
	return lines.join("\n");
}
