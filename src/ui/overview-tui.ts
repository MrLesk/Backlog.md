import blessed from "blessed";
import type { TaskStatistics } from "../core/statistics.ts";
import { createScreen } from "./tui.ts";
import { getStatusIcon } from "./status-icon.ts";

/**
 * Render the project overview in an interactive TUI
 */
export async function renderOverviewTui(statistics: TaskStatistics, projectName: string): Promise<void> {
	// If not in TTY, fall back to plain text output
	if (!process.stdout.isTTY) {
		renderPlainTextOverview(statistics, projectName);
		return;
	}

	return new Promise<void>((resolve) => {
		const screen = createScreen({ title: `${projectName} - Overview` });

		// Main container
		const container = blessed.box({
			parent: screen,
			width: "100%",
			height: "100%",
		});

		// Title
		const titleBox = blessed.box({
			parent: container,
			top: 0,
			left: "center",
			width: "shrink",
			height: 3,
			content: `{center}{bold}${projectName} - Project Overview{/bold}{/center}`,
			tags: true,
			style: {
				fg: "white",
			},
		});

		// Create sections
		const sections = [];
		let currentSection = 0;

		// Status Overview Section (Top Left)
		const statusBox = blessed.box({
			parent: container,
			top: 3,
			left: 0,
			width: "50%",
			height: "40%",
			border: { type: "line" },
			label: " Status Overview ",
			style: {
				border: { fg: "yellow" },
			},
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			mouse: true,
		});

		let statusContent = "";
		for (const [status, count] of statistics.statusCounts) {
			const icon = getStatusIcon(status);
			const percentage = statistics.totalTasks > 0 ? Math.round((count / statistics.totalTasks) * 100) : 0;
			statusContent += `  ${icon} {bold}${status}:{/bold} ${count} tasks (${percentage}%)\n`;
		}
		statusContent += `\n  {cyan-fg}Total Tasks:{/cyan-fg} ${statistics.totalTasks}\n`;
		statusContent += `  {green-fg}Completion:{/green-fg} ${statistics.completionPercentage}%\n`;
		if (statistics.draftCount > 0) {
			statusContent += `  {yellow-fg}Drafts:{/yellow-fg} ${statistics.draftCount}\n`;
		}
		statusBox.setContent(statusContent);
		sections.push(statusBox);

		// Priority Breakdown Section (Top Right)
		const priorityBox = blessed.box({
			parent: container,
			top: 3,
			left: "50%",
			width: "50%",
			height: "40%",
			border: { type: "line" },
			label: " Priority Breakdown ",
			style: {
				border: { fg: "gray" },
			},
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			mouse: true,
		});

		let priorityContent = "";
		const priorityColors = {
			high: "red",
			medium: "yellow",
			low: "green",
			none: "gray",
		};
		for (const [priority, count] of statistics.priorityCounts) {
			if (count > 0) {
				const color = priorityColors[priority as keyof typeof priorityColors] || "white";
				const percentage = statistics.totalTasks > 0 ? Math.round((count / statistics.totalTasks) * 100) : 0;
				const displayPriority =
					priority === "none" ? "No Priority" : priority.charAt(0).toUpperCase() + priority.slice(1);
				priorityContent += `  {${color}-fg}${displayPriority}:{/${color}-fg} ${count} tasks (${percentage}%)\n`;
			}
		}
		priorityBox.setContent(priorityContent);
		sections.push(priorityBox);

		// Recent Activity Section (Bottom Left)
		const activityBox = blessed.box({
			parent: container,
			top: "43%",
			left: 0,
			width: "50%",
			height: "28%",
			border: { type: "line" },
			label: " Recent Activity ",
			style: {
				border: { fg: "gray" },
			},
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			mouse: true,
		});

		let activityContent = "{bold}Recently Created:{/bold}\n";
		if (statistics.recentActivity.created.length > 0) {
			for (const task of statistics.recentActivity.created) {
				activityContent += `  ${task.id} - ${task.title.substring(0, 40)}${task.title.length > 40 ? "..." : ""}\n`;
			}
		} else {
			activityContent += "  {gray-fg}No tasks created in the last 7 days{/gray-fg}\n";
		}

		activityContent += "\n{bold}Recently Updated:{/bold}\n";
		if (statistics.recentActivity.updated.length > 0) {
			for (const task of statistics.recentActivity.updated) {
				activityContent += `  ${task.id} - ${task.title.substring(0, 40)}${task.title.length > 40 ? "..." : ""}\n`;
			}
		} else {
			activityContent += "  {gray-fg}No tasks updated in the last 7 days{/gray-fg}\n";
		}
		activityBox.setContent(activityContent);
		sections.push(activityBox);

		// Project Health Section (Bottom Right)
		const healthBox = blessed.box({
			parent: container,
			top: "43%",
			left: "50%",
			width: "50%",
			height: "28%",
			border: { type: "line" },
			label: " Project Health ",
			style: {
				border: { fg: "gray" },
			},
			tags: true,
			scrollable: true,
			alwaysScroll: true,
			keys: true,
			vi: true,
			mouse: true,
		});

		let healthContent = `{bold}Average Task Age:{/bold} ${statistics.projectHealth.averageTaskAge} days\n\n`;

		healthContent += "{bold}Stale Tasks:{/bold}\n";
		if (statistics.projectHealth.staleTasks.length > 0) {
			for (const task of statistics.projectHealth.staleTasks) {
				healthContent += `  {yellow-fg}${task.id}{/yellow-fg} - ${task.title.substring(0, 35)}${task.title.length > 35 ? "..." : ""}\n`;
			}
		} else {
			healthContent += "  {green-fg}No stale tasks{/green-fg}\n";
		}

		healthContent += "\n{bold}Blocked Tasks:{/bold}\n";
		if (statistics.projectHealth.blockedTasks.length > 0) {
			for (const task of statistics.projectHealth.blockedTasks) {
				healthContent += `  {red-fg}${task.id}{/red-fg} - ${task.title.substring(0, 35)}${task.title.length > 35 ? "..." : ""}\n`;
			}
		} else {
			healthContent += "  {green-fg}No blocked tasks{/green-fg}\n";
		}
		healthBox.setContent(healthContent);
		sections.push(healthBox);

		// Help section at bottom
		const helpBox = blessed.box({
			parent: container,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 3,
			content: "{center}Tab: Next Section | Shift+Tab: Previous | q: Quit | h: Help{/center}",
			tags: true,
			style: {
				fg: "gray",
			},
		});

		// Navigation functions
		const focusSection = (index: number) => {
			if (index < 0 || index >= sections.length) return;

			// Remove highlight from current section
			sections[currentSection].style.border.fg = "gray";

			// Highlight new section
			currentSection = index;
			sections[currentSection].style.border.fg = "yellow";
			sections[currentSection].focus();
			screen.render();
		};

		// Initial focus
		focusSection(0);

		// Keyboard navigation
		screen.key(["tab"], () => {
			focusSection((currentSection + 1) % sections.length);
		});

		screen.key(["S-tab"], () => {
			focusSection((currentSection - 1 + sections.length) % sections.length);
		});

		screen.key(["1"], () => focusSection(0));
		screen.key(["2"], () => focusSection(1));
		screen.key(["3"], () => focusSection(2));
		screen.key(["4"], () => focusSection(3));

		// Help dialog
		screen.key(["h", "?"], () => {
			const helpDialog = blessed.box({
				parent: screen,
				top: "center",
				left: "center",
				width: "60%",
				height: "60%",
				border: { type: "line" },
				label: " Help ",
				content: `
  {bold}Keyboard Shortcuts:{/bold}

  Tab         - Next section
  Shift+Tab   - Previous section
  1-4         - Jump to section
  Up/Down     - Scroll in current section
  h, ?        - Show this help
  q, Esc      - Quit

  {bold}Sections:{/bold}
  1. Status Overview - Task counts by status
  2. Priority Breakdown - Task distribution by priority
  3. Recent Activity - Recently created/updated tasks
  4. Project Health - Stale and blocked tasks

  Press any key to close this help...`,
				tags: true,
				keys: true,
				style: {
					border: { fg: "cyan" },
					bg: "black",
				},
			});

			helpDialog.focus();
			helpDialog.key(["escape", "q", "h", "?", "enter", "space"], () => {
				helpDialog.destroy();
				focusSection(currentSection);
			});

			screen.render();
		});

		// Exit handlers
		screen.key(["escape", "q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		screen.render();
	});
}

/**
 * Render plain text overview for non-TTY environments
 */
function renderPlainTextOverview(statistics: TaskStatistics, projectName: string): void {
	console.log(`\n${projectName} - Project Overview\n${"=".repeat(40)}\n`);

	console.log("Status Overview:");
	for (const [status, count] of statistics.statusCounts) {
		const percentage = statistics.totalTasks > 0 ? Math.round((count / statistics.totalTasks) * 100) : 0;
		console.log(`  ${status}: ${count} tasks (${percentage}%)`);
	}
	console.log(`\n  Total Tasks: ${statistics.totalTasks}`);
	console.log(`  Completion: ${statistics.completionPercentage}%`);
	if (statistics.draftCount > 0) {
		console.log(`  Drafts: ${statistics.draftCount}`);
	}

	console.log("\nPriority Breakdown:");
	for (const [priority, count] of statistics.priorityCounts) {
		if (count > 0) {
			const percentage = statistics.totalTasks > 0 ? Math.round((count / statistics.totalTasks) * 100) : 0;
			const displayPriority =
				priority === "none" ? "No Priority" : priority.charAt(0).toUpperCase() + priority.slice(1);
			console.log(`  ${displayPriority}: ${count} tasks (${percentage}%)`);
		}
	}

	console.log("\nRecent Activity:");
	console.log("  Recently Created:");
	if (statistics.recentActivity.created.length > 0) {
		for (const task of statistics.recentActivity.created) {
			console.log(`    ${task.id} - ${task.title}`);
		}
	} else {
		console.log("    No tasks created in the last 7 days");
	}

	console.log("\n  Recently Updated:");
	if (statistics.recentActivity.updated.length > 0) {
		for (const task of statistics.recentActivity.updated) {
			console.log(`    ${task.id} - ${task.title}`);
		}
	} else {
		console.log("    No tasks updated in the last 7 days");
	}

	console.log("\nProject Health:");
	console.log(`  Average Task Age: ${statistics.projectHealth.averageTaskAge} days`);

	console.log("\n  Stale Tasks:");
	if (statistics.projectHealth.staleTasks.length > 0) {
		for (const task of statistics.projectHealth.staleTasks) {
			console.log(`    ${task.id} - ${task.title}`);
		}
	} else {
		console.log("    No stale tasks");
	}

	console.log("\n  Blocked Tasks:");
	if (statistics.projectHealth.blockedTasks.length > 0) {
		for (const task of statistics.projectHealth.blockedTasks) {
			console.log(`    ${task.id} - ${task.title}`);
		}
	} else {
		console.log("    No blocked tasks");
	}
	console.log("");
}
