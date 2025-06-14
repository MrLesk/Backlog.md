/* Kanban board renderer for the bblessed TUI. */

import { createRequire } from "node:module";
import { join } from "node:path";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdin as input, stdout as output } from "node:process";
import { type BoardLayout, compareIds, generateKanbanBoard } from "../board.ts";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { formatStatusWithIcon, getStatusColor, getStatusIcon } from "./status-icon.ts";
import { createTaskPopup } from "./task-viewer.ts";

// Load blessed dynamically
// biome-ignore lint/suspicious/noExplicitAny: blessed is dynamically loaded
async function loadBlessed(): Promise<any | null> {
	// Don't check TTY in Bun - let blessed handle it
	try {
		// Dynamic import works with both Node and Bun
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore — module may not exist at runtime.
		// biome-ignore lint/suspicious/noExplicitAny: blessed is dynamically loaded
		const mod: any = await import("blessed");
		return mod.default ?? mod;
	} catch {
		try {
			// Fallback to createRequire for older Node versions
			const require = createRequire(import.meta.url);
			const blessed = require("blessed");
			return blessed;
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

	// Filter out empty statuses
	const nonEmptyStatuses = statuses.filter((status) => {
		const tasks = tasksByStatus.get(status);
		return tasks && tasks.length > 0;
	});

	// If no columns have tasks, show a message
	if (nonEmptyStatuses.length === 0) {
		console.log("No tasks found in any status.");
		return;
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
		const columnCount = nonEmptyStatuses.length || 1;
		const columnWidth = Math.floor(100 / columnCount);

		// Create columns
		// biome-ignore lint/suspicious/noExplicitAny: blessed column structure
		const columns: any[] = [];

		nonEmptyStatuses.forEach((status, index) => {
			// Calculate exact position for each column
			const left = index * columnWidth;
			const isLast = index === nonEmptyStatuses.length - 1;

			// For the last column, extend to the right edge to avoid gaps
			const width = isLast ? `${100 - left}%` : `${columnWidth}%`;

			// Column container
			const column = blessed.box({
				parent: container,
				left: `${left}%`,
				top: 0,
				width,
				height: "100%-1", // Leave space for footer
				border: {
					type: "line",
				},
				style: {
					border: {
						fg: "gray",
					},
				},
				label: ` ${getStatusIcon(status)} ${status || "No Status"} (${tasksByStatus.get(status)?.length || 0}) `,
			});

			// Task list for this column
			const taskList = blessed.list({
				parent: column,
				top: 1, // Start below the border
				left: 1, // Start after the border
				width: "100%-4", // Account for borders and padding
				height: "100%-3", // Account for borders
				items: [],
				keys: false, // Disable built-in key handling
				vi: false,
				mouse: true,
				scrollable: true,
				alwaysScroll: false,
				selectedBg: undefined, // Don't show selection by default
				style: {
					selected: {
						bg: undefined, // Initially no background
						fg: "white",
					},
				},
				tags: true, // Enable tag parsing for colors
			});

			// Populate tasks with enhanced styling
			const tasksInStatus = (tasksByStatus.get(status) || []).sort(compareIds);
			const items = tasksInStatus.map((task) => {
				const assigneeText = task.assignee?.length
					? ` {cyan-fg}${task.assignee[0].startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
					: "";
				const labelsText = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";

				return `{bold}${task.id}{/bold} - ${task.title}${assigneeText}${labelsText}`;
			});
			taskList.setItems(items);

			// Store reference for navigation
			columns.push({ box: column, list: taskList, status, tasks: tasksInStatus });
		});

		// Current column index and popup state
		let currentColumn = 0;
		let isPopupOpen = false;

		if (columns.length > 0) {
			columns[currentColumn].list.focus();
			columns[currentColumn].list.select(0);
			// Only show selection on the active column
			columns[currentColumn].list.style.selected.bg = "blue";
		}

		// Helper function to switch columns
		const switchToColumn = (newColumn: number) => {
			// Don't allow navigation while popup is open
			if (isPopupOpen) return;

			if (newColumn >= 0 && newColumn < columns.length && newColumn !== currentColumn) {
				// Remember current selection index
				const currentIndex = columns[currentColumn].list.selected || 0;

				// Unfocus current column
				columns[currentColumn].list.style.selected.bg = undefined;
				columns[currentColumn].list.screen.render();

				// Focus new column
				currentColumn = newColumn;
				const newList = columns[currentColumn].list;
				newList.focus();
				newList.style.selected.bg = "blue";

				// Set selection to same index or last item if fewer items
				const newIndex = Math.min(currentIndex, newList.items.length - 1);
				newList.select(Math.max(0, newIndex));

				screen.render();
			}
		};

		// Navigation between columns
		screen.key(["left", "h"], () => {
			switchToColumn(currentColumn - 1);
		});

		screen.key(["right", "l"], () => {
			switchToColumn(currentColumn + 1);
		});

		// Up/down navigation within column
		screen.key(["up", "k"], () => {
			// Don't allow navigation while popup is open
			if (isPopupOpen) return;

			const list = columns[currentColumn].list;
			const selected = list.selected || 0;
			if (selected > 0) {
				list.select(selected - 1);
				screen.render();
			}
		});

		screen.key(["down", "j"], () => {
			// Don't allow navigation while popup is open
			if (isPopupOpen) return;

			const list = columns[currentColumn].list;
			const selected = list.selected || 0;
			if (selected < list.items.length - 1) {
				list.select(selected + 1);
				screen.render();
			}
		});

		// Show task details on enter
		screen.key(["enter"], async () => {
			// Don't allow opening multiple popups
			if (isPopupOpen) return;

			const column = columns[currentColumn];
			const selected = column.list.selected;
			if (selected >= 0 && selected < column.tasks.length) {
				const task = column.tasks[selected];
				isPopupOpen = true;

				// Load task content
				let content = "";
				try {
					const core = new Core(process.cwd());
					const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.tasksDir }));
					const taskFile = files.find((f) => f.startsWith(`${task.id} -`));
					if (taskFile) {
						const filePath = join(core.filesystem.tasksDir, taskFile);
						content = await Bun.file(filePath).text();
					}
				} catch (error) {
					// Use task data if file cannot be loaded
					content = "";
				}

				// Create enhanced popup
				const popupData = await createTaskPopup(screen, task, content);
				if (!popupData) {
					isPopupOpen = false;
					return;
				}

				const { popup, contentArea, close } = popupData;

				// Add escape handler directly to the focused content area
				contentArea.key(["escape", "q"], () => {
					isPopupOpen = false;
					close();
					columns[currentColumn].list.focus();
				});

				screen.render();
			}
		});

		// Footer hint line
		const helpText = blessed.box({
			parent: screen,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			border: "line",
			content: " ←/→ columns · ↑/↓ tasks · Enter view details · q/Esc quit ",
			style: {
				fg: "gray",
				border: { fg: "gray" },
			},
		});

		// Exit keys - only when no popup is active
		screen.key(["q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		// Global escape handler - only exit if no popup is active
		screen.key(["escape"], () => {
			// Check if any popup is currently displayed
			const hasPopup = screen.children.some(
				// biome-ignore lint/suspicious/noExplicitAny: blessed types are complex
				(child: any) => child !== container && child !== helpText && child.visible !== false,
			);
			if (!hasPopup) {
				screen.destroy();
				resolve();
			}
		});

		screen.render();
	});
}
