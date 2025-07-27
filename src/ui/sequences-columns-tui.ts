import blessed from "blessed";
import type { Sequence } from "../types/index.ts";
import { openInEditor } from "../utils/editor.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { createScreen } from "./tui.ts";

// Options interface for integration with view switcher
interface SequenceColumnsOptions {
	viewSwitcher?: import("./view-switcher.ts").ViewSwitcher;
	onTaskSelect?: (task: import("../types/index.ts").Task) => void;
	onTabPress?: () => Promise<void>;
}

/**
 * Display sequences in a column-based TUI layout similar to a Kanban board
 */
export async function viewSequencesColumnsTUI(sequences: Sequence[], options?: SequenceColumnsOptions): Promise<void> {
	if (!process.stdout.isTTY) {
		// Fallback to plain text output
		console.log("Task Sequences:");
		for (const sequence of sequences) {
			console.log(`\nSequence ${sequence.number}:`);
			for (const task of sequence.tasks) {
				console.log(`  ${task.id} - ${task.title}`);
			}
		}
		return;
	}

	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: "Task Sequences - Column View" });

		// Main container
		const container = blessed.box({
			parent: screen,
			width: "100%",
			height: "100%",
			style: {
				fg: "white",
				bg: "black",
			},
		});

		// Title
		const _title = blessed.text({
			parent: container,
			top: 0,
			left: "center",
			content: "{cyan-fg}{bold}Task Sequences - Column View{/bold}{/cyan-fg}",
			tags: true,
			height: 1,
		});

		// Instructions footer
		const _footer = blessed.box({
			parent: container,
			bottom: 0,
			left: 0,
			width: "100%",
			height: 1,
			content: " ←/→: Navigate columns | ↑/↓: Navigate tasks | Enter: Edit task | Tab: Switch views | q: Quit",
			style: {
				fg: "gray",
				bg: "black",
			},
		});

		// Calculate column dimensions
		const columnsContainer = blessed.box({
			parent: container,
			top: 2,
			left: 0,
			width: "100%",
			height: "100%-3",
		});

		// Limit to reasonable number of columns that fit on screen
		const maxColumns = Math.min(sequences.length, 6);
		const displaySequences = sequences.slice(0, maxColumns);
		const columnWidth = Math.floor(100 / Math.max(displaySequences.length, 1));

		// Track current selection
		let currentColumn = 0;
		let currentRow = 0;
		const columnLists: any[] = [];
		const tasksByColumn: Array<Array<{ task: (typeof sequences)[0]["tasks"][0]; sequenceNum: number }>> = [];

		// Create columns for each sequence
		displaySequences.forEach((sequence, colIdx) => {
			const left = colIdx * columnWidth;
			const isLast = colIdx === displaySequences.length - 1;
			const width = isLast ? `${100 - left}%` : `${columnWidth}%`;

			// Column container
			const column = blessed.box({
				parent: columnsContainer,
				left: `${left}%`,
				top: 0,
				width,
				height: "100%",
				border: { type: "line" },
				style: {
					border: { fg: currentColumn === colIdx ? "cyan" : "gray" },
				},
				label: ` Sequence ${sequence.number} (${sequence.tasks.length} tasks) `,
			});

			// Task list within column
			const taskList = blessed.list({
				parent: column,
				top: 0,
				left: 0,
				width: "100%-2",
				height: "100%-2",
				keys: false,
				mouse: true,
				scrollable: true,
				alwaysScroll: true,
				tags: true,
				style: {
					selected: {
						fg: "black",
						bg: "cyan",
						bold: true,
					},
					item: {
						fg: "white",
					},
				},
				scrollbar: {
					ch: " ",
					track: {
						bg: "gray",
					},
					style: {
						inverse: true,
					},
				},
			});

			// Populate task list
			const items = sequence.tasks.map((task) => {
				const priorityColor =
					task.priority === "high"
						? "red"
						: task.priority === "medium"
							? "yellow"
							: task.priority === "low"
								? "green"
								: "white";
				const priorityIndicator = task.priority
					? `{${priorityColor}-fg}[${task.priority.charAt(0).toUpperCase()}]{/${priorityColor}-fg} `
					: "";

				const statusColor = task.status === "Done" ? "green" : task.status === "In Progress" ? "yellow" : "white";
				const truncatedTitle = task.title.length > 25 ? `${task.title.substring(0, 22)}...` : task.title;

				return `${priorityIndicator}{${statusColor}-fg}${task.id}{/${statusColor}-fg}\n{gray-fg}${truncatedTitle}{/gray-fg}`;
			});

			taskList.setItems(items);
			columnLists.push(taskList);
			tasksByColumn.push(sequence.tasks.map((task) => ({ task, sequenceNum: sequence.number })));
		});

		// Update column borders based on selection
		function updateColumnBorders() {
			displaySequences.forEach((_, colIdx) => {
				const column = columnsContainer.children[colIdx] as any;
				column.style.border = { fg: currentColumn === colIdx ? "cyan" : "gray" };
			});
			screen.render();
		}

		// Focus management
		function focusColumn(colIndex: number) {
			if (colIndex >= 0 && colIndex < columnLists.length) {
				currentColumn = colIndex;
				const list = columnLists[colIndex];
				if (list) {
					list.focus();
					// Ensure we have a valid selection
					if (currentRow >= list.items.length) {
						currentRow = Math.max(0, list.items.length - 1);
					}
					list.select(currentRow);
					updateColumnBorders();
				}
			}
		}

		// Navigation handlers
		screen.key(["left", "h"], () => {
			if (currentColumn > 0) {
				focusColumn(currentColumn - 1);
			}
		});

		screen.key(["right", "l"], () => {
			if (currentColumn < columnLists.length - 1) {
				focusColumn(currentColumn + 1);
			}
		});

		screen.key(["up", "k"], () => {
			const list = columnLists[currentColumn];
			if (list && currentRow > 0) {
				currentRow--;
				list.up(1);
			}
		});

		screen.key(["down", "j"], () => {
			const list = columnLists[currentColumn];
			if (list && currentRow < list.items.length - 1) {
				currentRow++;
				list.down(1);
			}
		});

		// Page navigation
		screen.key(["pageup"], () => {
			const list = columnLists[currentColumn];
			if (list) {
				const pageSize = Math.floor((list.height as number) / 2);
				for (let i = 0; i < pageSize && currentRow > 0; i++) {
					currentRow--;
					list.up(1);
				}
			}
		});

		screen.key(["pagedown"], () => {
			const list = columnLists[currentColumn];
			if (list) {
				const pageSize = Math.floor((list.height as number) / 2);
				for (let i = 0; i < pageSize && currentRow < list.items.length - 1; i++) {
					currentRow++;
					list.down(1);
				}
			}
		});

		// Home/End navigation
		screen.key(["home"], () => {
			currentRow = 0;
			const list = columnLists[currentColumn];
			if (list) {
				list.select(0);
				screen.render();
			}
		});

		screen.key(["end"], () => {
			const list = columnLists[currentColumn];
			if (list && list.items.length > 0) {
				currentRow = list.items.length - 1;
				list.select(currentRow);
				screen.render();
			}
		});

		// Number key shortcuts for sequences
		for (let i = 1; i <= 9 && i <= displaySequences.length; i++) {
			screen.key([i.toString()], () => {
				focusColumn(i - 1);
			});
		}

		// Task interaction
		screen.key(["enter", "e"], async () => {
			const tasks = tasksByColumn[currentColumn];
			const taskData = tasks?.[currentRow];
			if (taskData) {
				const { task } = taskData;
				const cwd = process.cwd();
				const core = new (await import("../core/backlog.ts")).Core(cwd);
				const taskPath = await getTaskPath(task.id, core);

				if (taskPath) {
					screen.destroy();
					await openInEditor(taskPath);
					resolve();
				}
			}
		});

		// Tab support for view switching
		screen.key(["tab"], async () => {
			if (options?.onTabPress) {
				await options.onTabPress();
			}
		});

		// Show more sequences info
		screen.key(["i", "?"], () => {
			const popup = blessed.box({
				parent: screen,
				top: "center",
				left: "center",
				width: "80%",
				height: "80%",
				border: { type: "line" },
				style: {
					fg: "white",
					bg: "black",
					border: { fg: "cyan" },
				},
				label: " Sequences Information ",
				scrollable: true,
				alwaysScroll: true,
				keys: true,
				vi: true,
				tags: true,
			});

			let content = "{bold}Task Sequences Overview{/bold}\n\n";
			content += `Total sequences: ${sequences.length}\n`;
			content += `Displaying: ${displaySequences.length} sequences\n\n`;

			for (const sequence of sequences) {
				content += `{cyan-fg}{bold}Sequence ${sequence.number}{/bold}{/cyan-fg}\n`;
				content += `Tasks: ${sequence.tasks.length}\n`;
				const taskList = sequence.tasks.map((t) => `  - ${t.id}: ${t.title}`).join("\n");
				content += `${taskList}\n\n`;
			}

			content += "\n{gray-fg}Press ESC or q to close{/gray-fg}";
			popup.setContent(content);

			popup.key(["escape", "q"], () => {
				popup.destroy();
				screen.render();
			});

			popup.focus();
			screen.render();
		});

		// Quit handlers
		screen.key(["q", "escape", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		// Initial focus
		if (columnLists.length > 0) {
			focusColumn(0);
		}

		screen.render();
	});
}
