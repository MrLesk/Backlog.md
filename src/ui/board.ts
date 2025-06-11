/* Kanban board renderer for the bblessed TUI. */

import { createRequire } from "node:module";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdin as input, stdout as output } from "node:process";
import { type BoardLayout, generateKanbanBoard } from "../board.ts";
import type { Task } from "../types/index.ts";

// Load blessed dynamically
// biome-ignore lint/suspicious/noExplicitAny: blessed is dynamically loaded
async function loadBlessed(): Promise<any | null> {
	// Don't check TTY in Bun - let blessed handle it
	try {
		// Try using createRequire for better compatibility
		const require = createRequire(import.meta.url);
		const blessed = require("blessed");
		return blessed;
	} catch {
		try {
			// Fallback to dynamic import
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore — module may not exist at runtime.
			const mod = await import("blessed");
			return mod.default ?? mod;
		} catch {
			// Blessed may not work in bundled executables
			return null;
		}
	}
}

/**
 * Render the provided tasks in a TUI.  Falls back to plain text when the
 * terminal UI cannot be initialized.
 */
export async function renderBoardTui(
	tasks: Task[],
	statuses: string[],
	layout: BoardLayout,
	maxColumnWidth: number,
): Promise<void> {
	const blessed = await loadBlessed();
	if (!blessed) {
		// Fallback to ASCII board
		const boardStr = generateKanbanBoard(tasks, statuses, layout, maxColumnWidth);
		console.log(boardStr);
		return;
	}

	// Group tasks by status
	const tasksByStatus = new Map<string, Task[]>();
	for (const status of statuses) {
		tasksByStatus.set(status, []);
	}
	for (const task of tasks) {
		const status = task.status || "";
		if (!tasksByStatus.has(status)) {
			tasksByStatus.set(status, []);
		}
		const statusTasks = tasksByStatus.get(status);
		if (statusTasks) {
			statusTasks.push(task);
		}
	}

	return new Promise<void>((resolve) => {
		const screen = blessed.screen({
			smartCSR: true,
			title: "Backlog Board View",
		});

		// Create container for the board
		const container = blessed.box({
			parent: screen,
			width: "100%",
			height: "100%",
		});

		// Calculate column dimensions
		const columnCount = statuses.length || 1;
		const columnWidth = Math.floor(100 / columnCount);

		// Create columns
		// biome-ignore lint/suspicious/noExplicitAny: blessed column structure
		const columns: any[] = [];
		let leftOffset = 0;

		statuses.forEach((status, index) => {
			const isLast = index === statuses.length - 1;
			const width = isLast ? `${100 - leftOffset}%` : `${columnWidth}%`;

			// Column container
			const column = blessed.box({
				parent: container,
				left: `${leftOffset}%`,
				top: 0,
				width,
				height: "100%",
				border: "line",
				label: ` ${status || "No Status"} (${tasksByStatus.get(status)?.length || 0}) `,
				padding: { left: 1, right: 1, top: 1 },
			});

			// Task list for this column
			const taskList = blessed.list({
				parent: column,
				top: 0,
				left: 0,
				width: "100%-2",
				height: "100%-2",
				items: [],
				keys: true,
				vi: true,
				mouse: true,
				scrollable: true,
				alwaysScroll: true,
				style: {
					selected: {
						bg: "blue",
						fg: "white",
					},
				},
			});

			// Populate tasks
			const tasksInStatus = tasksByStatus.get(status) || [];
			const items = tasksInStatus.map((task) => {
				const assignee = task.assignee?.length ? ` @${task.assignee[0]}` : "";
				return `${task.id} - ${task.title}${assignee}`;
			});
			taskList.setItems(items);

			// Store reference for navigation
			columns.push({ box: column, list: taskList, status, tasks: tasksInStatus });
			leftOffset += columnWidth;
		});

		// Current column index
		let currentColumn = 0;
		if (columns.length > 0) {
			columns[currentColumn].list.focus();
		}

		// Navigation between columns
		screen.key(["left", "h"], () => {
			if (currentColumn > 0) {
				currentColumn--;
				columns[currentColumn].list.focus();
				screen.render();
			}
		});

		screen.key(["right", "l"], () => {
			if (currentColumn < columns.length - 1) {
				currentColumn++;
				columns[currentColumn].list.focus();
				screen.render();
			}
		});

		// Show task details on enter
		screen.key(["enter"], () => {
			const column = columns[currentColumn];
			const selected = column.list.selected;
			if (selected >= 0 && selected < column.tasks.length) {
				const task = column.tasks[selected];

				// Create detail popup
				const popup = blessed.box({
					parent: screen,
					top: "center",
					left: "center",
					width: "80%",
					height: "80%",
					border: "line",
					label: ` ${task.id} - ${task.title} `,
					padding: 1,
					scrollable: true,
					alwaysScroll: true,
					keys: true,
					vi: true,
					mouse: true,
				});

				const content = [
					`ID: ${task.id}`,
					`Title: ${task.title}`,
					`Status: ${task.status || "No status"}`,
					`Assignee: ${task.assignee?.join(", ") || "Unassigned"}`,
					`Created: ${task.createdDate}`,
					task.labels?.length ? `Labels: ${task.labels.join(", ")}` : "",
					task.parentTaskId ? `Parent: ${task.parentTaskId}` : "",
					"",
					"Description:",
					task.description || "No description",
				]
					.filter(Boolean)
					.join("\n");

				popup.setContent(content);
				popup.focus();

				popup.key(["escape", "q"], () => {
					popup.destroy();
					columns[currentColumn].list.focus();
					screen.render();
				});

				screen.render();
			}
		});

		// Help text at bottom
		const helpText = blessed.box({
			parent: screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			content: " ←/→: Navigate columns | ↑/↓: Navigate tasks | Enter: View details | q/Esc: Exit ",
			style: {
				fg: "white",
				bg: "blue",
			},
		});

		// Exit keys
		screen.key(["escape", "q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		screen.render();
	});
}
