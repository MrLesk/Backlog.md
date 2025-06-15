import { join } from "node:path";
import blessed from "blessed";
import { type BoardLayout, compareIds, generateKanbanBoard } from "../board.ts";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
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
	layout: BoardLayout,
	maxColumnWidth: number,
): Promise<void> {
	if (!process.stdout.isTTY) {
		console.log(generateKanbanBoard(tasks, statuses, layout, maxColumnWidth));
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
				label: ` ${getStatusIcon(status)} ${status || "No Status"} (${tasksByStatus.get(status)?.length ?? 0}) `,
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

			const items = [...(tasksByStatus.get(status) ?? [])].sort(compareIds).map((task) => {
				const assignee = task.assignee?.[0]
					? ` {cyan-fg}${task.assignee[0].startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
					: "";
				const labels = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";
				return `{bold}${task.id}{/bold} - ${task.title}${assignee}${labels}`;
			});

			taskList.setItems(items);
			columns.push({ list: taskList, tasks: tasksByStatus.get(status) ?? [] });
		});

		/* -------------------- navigation & interactions -------------------- */
		let currentCol = 0;
		let popupOpen = false;

		const focusColumn = (idx: number) => {
			if (popupOpen || idx === currentCol || idx < 0 || idx >= columns.length) return;
			const prev = columns[currentCol].list;
			prev.style.selected.bg = undefined;

			currentCol = idx;
			const curr = columns[currentCol].list;
			curr.focus();
			curr.style.selected.bg = "blue";
			screen.render();
		};

		if (columns.length) {
			columns[0].list.focus();
			columns[0].list.select(0);
			columns[0].list.style.selected.bg = "blue";
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
				const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: core.filesystem.tasksDir }));
				const md = files.find((f) => f.startsWith(`${task.id} -`));
				if (md) {
					content = await Bun.file(join(core.filesystem.tasksDir, md)).text();
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

		blessed.box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 1,
			width: "100%",
			content: " ←/→ columns · ↑/↓ tasks · Enter view · q/Esc quit ",
			style: { fg: "gray", bg: "black" },
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
