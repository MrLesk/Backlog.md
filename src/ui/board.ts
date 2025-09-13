import type { BoxInterface, ListInterface } from "neo-neo-bblessed";
import { box, list } from "neo-neo-bblessed";
import { type BoardLayout, generateKanbanBoardWithMetadata } from "../board.ts";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
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
		watchEnabled?: boolean;
		getWatchState?: () => boolean;
		onToggleWatch?: () => void;
	},
): Promise<void> {
	if (!process.stdout.isTTY) {
		console.log(generateKanbanBoardWithMetadata(tasks, statuses, "Project"));
		return;
	}

	/* ------------------------------------------------------------------
     Group tasks by status (case-insensitive), preserving configured casing
     ------------------------------------------------------------------ */
	const canonicalByLower = new Map<string, string>();
	for (const s of statuses) {
		if (!s) continue;
		canonicalByLower.set(s.toLowerCase(), s);
	}

	const tasksByStatus = new Map<string, Task[]>(); // key is display/canonical status label
	// Initialize configured statuses
	for (const s of statuses) tasksByStatus.set(s, []);

	for (const t of tasks) {
		const raw = (t.status || "").trim();
		if (!raw) continue;
		const canonical = canonicalByLower.get(raw.toLowerCase()) || raw;
		const list = tasksByStatus.get(canonical) || [];
		list.push(t);
		tasksByStatus.set(canonical, list);
	}

	// Determine displayed columns: configured statuses with tasks, then any unknown statuses with tasks
	const nonEmptyConfigured = statuses.filter((s) => (tasksByStatus.get(s) ?? []).length > 0);
	const unknownWithTasks = Array.from(tasksByStatus.keys()).filter(
		(s) => !statuses.includes(s) && (tasksByStatus.get(s) ?? []).length > 0,
	);
	const nonEmptyStatuses = [...nonEmptyConfigured, ...unknownWithTasks];

	if (nonEmptyStatuses.length === 0) {
		console.log("No tasks found in any status.");
		return;
	}

	/* ------------------------------------------------------------------
     Blessed screen + columns
     ------------------------------------------------------------------ */
	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: "Backlog Board" });

		const container = box({
			parent: screen,
			width: "100%",
			height: "100%",
		});

		const columnWidth = Math.floor(100 / nonEmptyStatuses.length);
		const columns: Array<{ list: ListInterface; tasks: Task[]; box: BoxInterface }> = [];

		nonEmptyStatuses.forEach((status, idx) => {
			const left = idx * columnWidth;
			const isLast = idx === nonEmptyStatuses.length - 1;
			const width = isLast ? `${100 - left}%` : `${columnWidth}%`;

			const column = box({
				parent: container,
				left: `${left}%`,
				top: 0,
				width,
				height: "100%-1",
				border: { type: "line" },
				style: { border: { fg: "gray" } },
				label: `\u00A0${getStatusIcon(status)} ${status || "No Status"} (${tasksByStatus.get(status)?.length ?? 0})\u00A0`,
			});

			const taskList = list({
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
			if (!prev) return;

			// Capture the previously selected row index to preserve row on horizontal move
			const prevSelectedIndex = typeof prev.list.selected === "number" ? prev.list.selected : 0;

			// Reset previous column styles
			const prevListStyle = prev.list.style as { selected?: { bg?: string } };
			if (prevListStyle.selected) prevListStyle.selected.bg = undefined;
			const prevBoxStyle = prev.box.style as { border?: { fg?: string } };
			if (prevBoxStyle.border) prevBoxStyle.border.fg = "gray";

			// Switch current column
			currentCol = idx;
			const curr = columns[currentCol];
			if (!curr) return;

			// Determine the target row index in the new column:
			// - If destination has at least as many tasks, keep the same row
			// - Otherwise clamp to last task in that column
			const destCount = curr.tasks.length;
			if (destCount > 0) {
				const targetIndex = prevSelectedIndex < destCount ? prevSelectedIndex : destCount - 1;
				curr.list.select(targetIndex);
			}

			// Focus and update styles for the current column
			curr.list.focus();
			const currListStyle = curr.list.style as { selected?: { bg?: string } };
			if (currListStyle.selected) currListStyle.selected.bg = "blue";
			const currBoxStyle = curr.box.style as { border?: { fg?: string } };
			if (currBoxStyle.border) currBoxStyle.border.fg = "yellow";
			screen.render();
		};

		if (columns.length) {
			columns[0]?.list.focus();
			columns[0]?.list.select(0);
			const firstListStyle = columns[0]?.list.style as { selected?: { bg?: string } } | undefined;
			if (firstListStyle?.selected) firstListStyle.selected.bg = "blue";
			const firstBoxStyle = columns[0]?.box.style as { border?: { fg?: string } } | undefined;
			if (firstBoxStyle?.border) firstBoxStyle.border.fg = "yellow";
		}

		screen.key(["left", "h"], () => focusColumn(currentCol - 1));
		screen.key(["right", "l"], () => focusColumn(currentCol + 1));

		screen.key(["up", "k"], () => {
			if (popupOpen) return;
			const list = columns[currentCol]?.list;
			if (!list) return;
			const total = list.items.length;
			if (total === 0) return;
			const sel = list.selected ?? 0;
			if (sel > 0) {
				list.select(sel - 1);
			} else {
				list.select(total - 1);
			}
			screen.render();
		});

		screen.key(["down", "j"], () => {
			if (popupOpen) return;
			const list = columns[currentCol]?.list;
			if (!list) return;
			const total = list.items.length;
			if (total === 0) return;
			const sel = list.selected ?? 0;
			if (sel < total - 1) {
				list.select(sel + 1);
			} else {
				list.select(0);
			}
			screen.render();
		});

		screen.key(["enter"], async () => {
			if (popupOpen) return;
			const col = columns[currentCol];
			if (!col) return;
			const { list, tasks } = col;
			const idx = list.selected ?? 0;
			if (idx < 0 || idx >= tasks.length) return;

			const task = tasks[idx];
			if (!task) return;
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
				columns[currentCol]?.list.focus();
			});

			// Add edit key handler for popup with proper TUI handoff
			contentArea.key(["e", "E"], async () => {
				try {
					const core = new Core(process.cwd());
					const filePath = await getTaskPath(task.id, core);
					if (!filePath) return;
					type ProgWithPause = { pause?: () => () => void };
					const scr = screen as unknown as { program?: ProgWithPause; leave?: () => void; enter?: () => void };
					const prog = scr.program;
					const resumeProgram = typeof prog?.pause === "function" ? prog.pause() : undefined;
					try {
						scr.leave?.();
					} catch {}
					try {
						await core.openEditor(filePath);
					} finally {
						try {
							scr.enter?.();
						} catch {}
						try {
							if (typeof resumeProgram === "function") resumeProgram();
						} catch {}
						screen.render();
					}
				} catch (_error) {
					// Silently handle errors
				}
			});

			screen.render();
		});

		screen.key(["e", "E"], async () => {
			if (popupOpen) return;
			const col = columns[currentCol];
			if (!col) return;
			const { list, tasks } = col;
			const idx = list.selected ?? 0;
			if (idx < 0 || idx >= tasks.length) return;

			const task = tasks[idx];
			if (!task) return;
			try {
				const core = new Core(process.cwd());
				const filePath = await getTaskPath(task.id, core);
				if (!filePath) return;
				type ProgWithPause = { pause?: () => () => void };
				const scr = screen as unknown as { program?: ProgWithPause; leave?: () => void; enter?: () => void };
				const prog = scr.program;
				const resumeProgram = typeof prog?.pause === "function" ? prog.pause() : undefined;
				try {
					scr.leave?.();
				} catch {}
				try {
					await core.openEditor(filePath);
				} finally {
					try {
						scr.enter?.();
					} catch {}
					try {
						if (typeof resumeProgram === "function") resumeProgram();
					} catch {}
					screen.render();
				}
			} catch (_error) {
				// Silently handle errors
			}
		});

		// Footer with watch status
		const footerContent = () => {
			const baseContent = " ←/→ columns · ↑/↓ tasks · Enter view · E edit · Tab tasks · q/Esc quit";

			const currentWatchState = options?.getWatchState?.() ?? options?.watchEnabled;
			if (typeof currentWatchState === "boolean") {
				const watchStatus = currentWatchState ? "Live: ON" : "Live: OFF";
				const watchToggle = options?.onToggleWatch ? " · W toggle watch" : "";
				return `${baseContent} · ${watchStatus}${watchToggle}`;
			}

			return baseContent;
		};

		const helpBar = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 1,
			width: "100%",
			content: footerContent(),
			style: { fg: "gray", bg: "black" },
		});

		// Tab key for view switching
		screen.key(["tab"], async () => {
			if (popupOpen) return;
			if (options?.onTabPress) {
				// Get currently selected task
				const col2 = columns[currentCol];
				if (!col2) return;
				const { list, tasks } = col2;
				const idx = list.selected ?? 0;
				if (idx >= 0 && idx < tasks.length) {
					const selectedTask = tasks[idx];
					if (!selectedTask) return;
					options.onTaskSelect?.(selectedTask);
				}

				// Use custom Tab handler - caller manages view switching
				screen.destroy();
				await options.onTabPress();
				resolve();
			} else if (options?.viewSwitcher) {
				// Get currently selected task
				const col3 = columns[currentCol];
				if (!col3) return;
				const { list, tasks } = col3;
				const idx = list.selected ?? 0;
				if (idx >= 0 && idx < tasks.length) {
					const selectedTask = tasks[idx];
					if (!selectedTask) return;
					options.onTaskSelect?.(selectedTask);
				}

				// Switch to task view
				screen.destroy();
				await options.viewSwitcher.switchView();
				resolve();
			}
		});

		// Watch toggle key
		screen.key(["w", "W"], () => {
			if (popupOpen) return;
			if (options?.onToggleWatch) {
				options.onToggleWatch();
				helpBar.setContent(footerContent());
				screen.render();
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
