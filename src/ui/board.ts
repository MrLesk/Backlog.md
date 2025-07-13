import blessed from "blessed";
import { type BoardLayout, generateKanbanBoardWithMetadata } from "../board.ts";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { openInEditor } from "../utils/editor.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { compareTaskIds } from "../utils/task-sorting.ts";
import { getStatusIcon } from "./status-icon.ts";
import { createTaskPopup } from "./task-viewer.ts";
import { createScreen } from "./tui.ts";

/**
 * Render tasks in an interactive TUI when stdout is a TTY.
 * Falls back to plain-text board when not in a terminal
 * (e.g. piping output to a file or running in CI).
 */
export async function renderBoardTui(
	tasks: Task[],
	statuses: string[],
	_layout: BoardLayout,
	_maxColumnWidth: number,
	options?: {
		viewSwitcher?: import("./view-switcher.ts").ViewSwitcher;
		onTaskSelect?: (task: Task) => void;
		onTabPress?: () => Promise<void>;
	},
): Promise<void> {
	if (!process.stdout.isTTY) {
		console.log(generateKanbanBoardWithMetadata(tasks, statuses, "Project"));
		return;
	}

	/* ------------------------------------------------------------------
     Group tasks by status
     ------------------------------------------------------------------ */
	const tasksByStatus = new Map<string, Task[]>();
	for (const s of statuses) tasksByStatus.set(s, []);
	for (const t of tasks) (tasksByStatus.get(t.status || "") ?? []).push(t);

	const nonEmptyStatuses = statuses.filter((s) => (tasksByStatus.get(s) ?? []).length > 0);

	if (nonEmptyStatuses.length === 0) {
		console.log("No tasks found in any status.");
		return;
	}

	/* ------------------------------------------------------------------
     Blessed screen + columns
     ------------------------------------------------------------------ */
	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: "Backlog Board" });

		const container = blessed.box({
			parent: screen,
			width: "100%",
			height: "100%",
		});

		const columnWidth = Math.floor(100 / nonEmptyStatuses.length);
		// biome-ignore lint/suspicious/noExplicitAny: blessed types are lax
		const columns: any[] = [];

		nonEmptyStatuses.forEach((status, idx) => {
			const left = idx * columnWidth;
			const isLast = idx === nonEmptyStatuses.length - 1;
			const width = isLast ? `${100 - left}%` : `${columnWidth}%`;

			const column = blessed.box({
				parent: container,
				left: `${left}%`,
				top: 0,
				width,
				height: "100%-1",
				border: { type: "line" },
				style: { border: { fg: "gray" } },
				label: `\u00A0${getStatusIcon(status)} ${status || "No Status"} (${tasksByStatus.get(status)?.length ?? 0})\u00A0`,
			});

			const taskList = blessed.list({
				parent: column,
				top: 1,
				left: 1,
				width: "100%-4",
				height: "100%-3",
				keys: false,
				mouse: true,
				scrollable: true,
				tags: true,
				style: { selected: { fg: "white" } },
			});

			const sortedTasks = [...(tasksByStatus.get(status) ?? [])].sort((a, b) => {
				if (status === "Done") {
					return compareTaskIds(b.id, a.id); // Descending for Done
				}
				return compareTaskIds(a.id, b.id); // Ascending for others
			});
			const items = sortedTasks.map((task) => {
				const assignee = task.assignee?.[0]
					? ` {cyan-fg}${task.assignee[0].startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
					: "";
				const labels = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";
				const branch = (task as Task & { branch?: string }).branch
					? ` {green-fg}(${(task as Task & { branch?: string }).branch}){/}`
					: "";
				return `{bold}${task.id}{/bold} - ${task.title}${assignee}${labels}${branch}`;
			});

			taskList.setItems(items);
			columns.push({ list: taskList, tasks: sortedTasks, box: column });
		});

		/* -------------------- navigation & interactions -------------------- */
		let currentCol = 0;
		let popupOpen = false;

		const focusColumn = (idx: number) => {
			if (popupOpen || idx === currentCol || idx < 0 || idx >= columns.length) return;
			const prev = columns[currentCol];
			prev.list.style.selected.bg = undefined;
			prev.box.style.border.fg = "gray";

			currentCol = idx;
			const curr = columns[currentCol];
			curr.list.focus();
			curr.list.style.selected.bg = "blue";
			curr.box.style.border.fg = "yellow";
			screen.render();
		};

		if (columns.length) {
			columns[0].list.focus();
			columns[0].list.select(0);
			columns[0].list.style.selected.bg = "blue";
			columns[0].box.style.border.fg = "yellow";
		}

		screen.key(["left", "h"], () => focusColumn(currentCol - 1));
		screen.key(["right", "l"], () => focusColumn(currentCol + 1));

		screen.key(["up", "k"], () => {
			if (popupOpen) return;
			const list = columns[currentCol].list;
			const sel = list.selected ?? 0;
			if (sel > 0) list.select(sel - 1);
			screen.render();
		});

		screen.key(["down", "j"], () => {
			if (popupOpen) return;
			const list = columns[currentCol].list;
			const sel = list.selected ?? 0;
			if (sel < list.items.length - 1) list.select(sel + 1);
			screen.render();
		});

		screen.key(["enter"], async () => {
			if (popupOpen) return;
			const { list, tasks } = columns[currentCol];
			const idx = list.selected ?? 0;
			if (idx < 0 || idx >= tasks.length) return;

			const task = tasks[idx];
			popupOpen = true;

			let content = "";
			try {
				const core = new Core(process.cwd());
				const filePath = await getTaskPath(task.id, core);
				if (filePath) {
					content = await Bun.file(filePath).text();
				}
			} catch {
				/* fallback to empty content */
			}

			const popup = await createTaskPopup(screen, task, content);
			if (!popup) {
				popupOpen = false;
				return;
			}

			const { contentArea, close } = popup;
			contentArea.key(["escape", "q"], () => {
				popupOpen = false;
				close();
				columns[currentCol].list.focus();
			});

			screen.render();
		});

		screen.key(["e", "E"], async () => {
			if (popupOpen) return;
			const { list, tasks } = columns[currentCol];
			const idx = list.selected ?? 0;
			if (idx < 0 || idx >= tasks.length) return;

			const task = tasks[idx];
			try {
				const core = new Core(process.cwd());
				const config = await core.filesystem.loadConfig();
				const filePath = await getTaskPath(task.id, core);
				if (filePath) {
					await openInEditor(filePath, config);
				}
			} catch (_error) {
				// Silently handle errors - user will see editor didn't open
			}
		});

		blessed.box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 1,
			width: "100%",
			content: " ←/→ columns · ↑/↓ tasks · Enter view · E edit · Tab tasks · q/Esc quit ",
			style: { fg: "gray", bg: "black" },
		});

		// Tab key for view switching
		screen.key(["tab"], async () => {
			if (popupOpen) return;
			if (options?.onTabPress) {
				// Get currently selected task
				const { list, tasks } = columns[currentCol];
				const idx = list.selected ?? 0;
				if (idx >= 0 && idx < tasks.length) {
					const selectedTask = tasks[idx];
					options.onTaskSelect?.(selectedTask);
				}

				// Use custom Tab handler - caller manages view switching
				screen.destroy();
				await options.onTabPress();
				resolve();
			} else if (options?.viewSwitcher) {
				// Get currently selected task
				const { list, tasks } = columns[currentCol];
				const idx = list.selected ?? 0;
				if (idx >= 0 && idx < tasks.length) {
					const selectedTask = tasks[idx];
					options.onTaskSelect?.(selectedTask);
				}

				// Switch to task view
				screen.destroy();
				await options.viewSwitcher.switchView();
				resolve();
			}
		});

		screen.key(["q", "C-c"], () => {
			screen.destroy();
			resolve();
		});

		screen.key(["escape"], () => {
			if (!popupOpen) {
				screen.destroy();
				resolve();
			}
		});

		screen.render();
	});
}
