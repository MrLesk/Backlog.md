import type { BoxInterface, ListInterface } from "neo-neo-bblessed";
import { box, list } from "neo-neo-bblessed";
import { type BoardLayout, buildKanbanStatusGroups, generateKanbanBoardWithMetadata } from "../board.ts";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { compareTaskIds } from "../utils/task-sorting.ts";
import { getStatusIcon } from "./status-icon.ts";
import { createTaskPopup } from "./task-viewer-with-search.ts";
import { createScreen } from "./tui.ts";

export type ColumnData = {
	status: string;
	tasks: Task[];
};

type ColumnView = {
	status: string;
	tasks: Task[];
	list: ListInterface;
	box: BoxInterface;
};

function isDoneStatus(status: string): boolean {
	const normalized = status.trim().toLowerCase();
	return normalized === "done" || normalized === "completed" || normalized === "complete";
}

function buildColumnTasks(status: string, items: Task[], byId: Map<string, Task>): Task[] {
	const topLevel: Task[] = [];
	const childrenByParent = new Map<string, Task[]>();
	const sorted = items.slice().sort((a, b) => {
		const columnIsDone = isDoneStatus(status);
		if (columnIsDone) {
			return compareTaskIds(b.id, a.id);
		}
		return compareTaskIds(a.id, b.id);
	});

	for (const task of sorted) {
		const parent = task.parentTaskId ? byId.get(task.parentTaskId) : undefined;
		if (parent && parent.status === task.status) {
			const existing = childrenByParent.get(parent.id) ?? [];
			existing.push(task);
			childrenByParent.set(parent.id, existing);
			continue;
		}
		topLevel.push(task);
	}

	const ordered: Task[] = [];
	for (const task of topLevel) {
		ordered.push(task);
		const subs = childrenByParent.get(task.id) ?? [];
		subs.sort((a, b) => compareTaskIds(a.id, b.id));
		ordered.push(...subs);
	}

	return ordered;
}

function prepareBoardColumns(tasks: Task[], statuses: string[]): ColumnData[] {
	const { orderedStatuses, groupedTasks } = buildKanbanStatusGroups(tasks, statuses);
	const byId = new Map<string, Task>(tasks.map((task) => [task.id, task]));

	return orderedStatuses.map((status) => {
		const items = groupedTasks.get(status) ?? [];
		const orderedTasks = buildColumnTasks(status, items, byId);
		return { status, tasks: orderedTasks };
	});
}

function formatTaskListItem(task: Task): string {
	const assignee = task.assignee?.[0]
		? ` {cyan-fg}${task.assignee[0].startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
		: "";
	const labels = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";
	const branch = (task as Task & { branch?: string }).branch
		? ` {green-fg}(${(task as Task & { branch?: string }).branch}){/}`
		: "";
	return `{bold}${task.id}{/bold} - ${task.title}${assignee}${labels}${branch}`;
}

function formatColumnLabel(status: string, count: number): string {
	return `\u00A0${getStatusIcon(status)} ${status || "No Status"} (${count})\u00A0`;
}

function arraysEqual(left: string[], right: string[]): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return false;
	}
	return true;
}

export function shouldRebuildColumns(current: ColumnData[], next: ColumnData[]): boolean {
	if (current.length !== next.length) {
		return true;
	}
	for (let index = 0; index < next.length; index += 1) {
		const nextColumn = next[index];
		if (!nextColumn) return true;
		const prevColumn = current[index];
		if (!prevColumn) return true;
		if (prevColumn.status !== nextColumn.status) return true;
		if (prevColumn.tasks.length !== nextColumn.tasks.length) return true;
		for (let taskIdx = 0; taskIdx < nextColumn.tasks.length; taskIdx += 1) {
			const prevTask = prevColumn.tasks[taskIdx];
			const nextTask = nextColumn.tasks[taskIdx];
			if (!prevTask || !nextTask) {
				return true;
			}
			if (prevTask.id !== nextTask.id) {
				return true;
			}
		}
	}
	return false;
}

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
		subscribeUpdates?: (update: (nextTasks: Task[], nextStatuses: string[]) => void) => void;
	},
): Promise<void> {
	if (!process.stdout.isTTY) {
		console.log(generateKanbanBoardWithMetadata(tasks, statuses, "Project"));
		return;
	}

	const initialColumns = prepareBoardColumns(tasks, statuses);
	if (initialColumns.length === 0) {
		console.log("No tasks available for the Kanban board.");
		return;
	}

	await new Promise<void>((resolve) => {
		const screen = createScreen({ title: "Backlog Board" });
		const container = box({
			parent: screen,
			width: "100%",
			height: "100%",
		});

		let columns: ColumnView[] = [];
		let currentColumnsData = initialColumns;
		let currentStatuses = currentColumnsData.map((column) => column.status);
		let currentCol = 0;
		let popupOpen = false;

		const clearColumns = () => {
			for (const column of columns) {
				column.box.destroy();
			}
			columns = [];
		};

		const columnWidthFor = (count: number) => Math.max(1, Math.floor(100 / Math.max(1, count)));

		const createColumnViews = (data: ColumnData[]) => {
			clearColumns();
			const widthPercent = columnWidthFor(data.length);
			data.forEach((columnData, idx) => {
				const left = idx * widthPercent;
				const isLast = idx === data.length - 1;
				const width = isLast ? `${Math.max(0, 100 - left)}%` : `${widthPercent}%`;
				const columnBox = box({
					parent: container,
					left: `${left}%`,
					top: 0,
					width,
					height: "100%-1",
					border: { type: "line" },
					style: { border: { fg: "gray" } },
					label: formatColumnLabel(columnData.status, columnData.tasks.length),
				});

				const taskList = list({
					parent: columnBox,
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

				taskList.setItems(columnData.tasks.map(formatTaskListItem));
				columns.push({ status: columnData.status, tasks: columnData.tasks, list: taskList, box: columnBox });
			});
		};

		const setColumnActiveState = (column: ColumnView | undefined, active: boolean) => {
			if (!column) return;
			const listStyle = column.list.style as { selected?: { bg?: string } };
			if (listStyle.selected) listStyle.selected.bg = active ? "blue" : undefined;
			const boxStyle = column.box.style as { border?: { fg?: string } };
			if (boxStyle.border) boxStyle.border.fg = active ? "yellow" : "gray";
		};

		const getSelectedTaskId = (): string | undefined => {
			const column = columns[currentCol];
			if (!column) return undefined;
			const selectedIndex = column.list.selected ?? 0;
			return column.tasks[selectedIndex]?.id;
		};

		const focusColumn = (idx: number, preferredRow?: number) => {
			if (popupOpen) return;
			if (idx < 0 || idx >= columns.length) return;
			const previous = columns[currentCol];
			setColumnActiveState(previous, false);

			currentCol = idx;
			const current = columns[currentCol];
			if (!current) return;

			const total = current.tasks.length;
			if (total > 0) {
				const previousSelected = typeof previous?.list.selected === "number" ? previous.list.selected : 0;
				const target = preferredRow !== undefined ? preferredRow : Math.min(previousSelected, total - 1);
				current.list.select(Math.max(0, target));
			}

			current.list.focus();
			setColumnActiveState(current, true);
			screen.render();
		};

		const restoreSelection = (taskId?: string) => {
			if (columns.length === 0) return;
			if (taskId) {
				for (let colIdx = 0; colIdx < columns.length; colIdx += 1) {
					const column = columns[colIdx];
					if (!column) continue;
					const taskIndex = column.tasks.findIndex((task) => task.id === taskId);
					if (taskIndex !== -1) {
						focusColumn(colIdx, taskIndex);
						return;
					}
				}
			}
			const safeIndex = Math.min(columns.length - 1, Math.max(0, currentCol));
			focusColumn(safeIndex);
		};

		const applyColumnData = (data: ColumnData[], selectedTaskId?: string) => {
			currentColumnsData = data;
			data.forEach((columnData, idx) => {
				const column = columns[idx];
				if (!column) return;
				column.status = columnData.status;
				column.tasks = columnData.tasks;
				column.list.setItems(columnData.tasks.map(formatTaskListItem));
				column.box.setLabel?.(formatColumnLabel(columnData.status, columnData.tasks.length));
			});
			restoreSelection(selectedTaskId);
		};

		const rebuildColumns = (data: ColumnData[], selectedTaskId?: string) => {
			currentColumnsData = data;
			currentStatuses = data.map((column) => column.status);
			createColumnViews(data);
			restoreSelection(selectedTaskId);
		};

		rebuildColumns(initialColumns);
		const firstColumn = columns[0];
		if (firstColumn) {
			currentCol = 0;
			setColumnActiveState(firstColumn, true);
			if (firstColumn.tasks.length > 0) {
				firstColumn.list.select(0);
			}
			firstColumn.list.focus();
		}

		const updateBoard = (nextTasks: Task[], nextStatuses: string[]) => {
			const nextData = prepareBoardColumns(nextTasks, nextStatuses);
			const selectedTaskId = getSelectedTaskId();
			if (nextData.length === 0) {
				const fallbackStatus = nextStatuses[0] ?? "No Status";
				rebuildColumns([{ status: fallbackStatus, tasks: [] }], selectedTaskId);
				screen.render();
				return;
			}

			const nextStatusOrder = nextData.map((column) => column.status);
			if (!arraysEqual(currentStatuses, nextStatusOrder) || shouldRebuildColumns(currentColumnsData, nextData)) {
				rebuildColumns(nextData, selectedTaskId);
			} else {
				applyColumnData(nextData, selectedTaskId);
			}
			screen.render();
		};

		options?.subscribeUpdates?.(updateBoard);

		screen.key(["left", "h"], () => focusColumn(currentCol - 1));
		screen.key(["right", "l"], () => focusColumn(currentCol + 1));

		screen.key(["up", "k"], () => {
			if (popupOpen) return;
			const column = columns[currentCol];
			if (!column) return;
			const total = column.tasks.length;
			if (total === 0) return;
			const listWidget = column.list;
			const selected = listWidget.selected ?? 0;
			const nextIndex = selected > 0 ? selected - 1 : total - 1;
			listWidget.select(nextIndex);
			screen.render();
		});

		screen.key(["down", "j"], () => {
			if (popupOpen) return;
			const column = columns[currentCol];
			if (!column) return;
			const total = column.tasks.length;
			if (total === 0) return;
			const listWidget = column.list;
			const selected = listWidget.selected ?? 0;
			const nextIndex = selected < total - 1 ? selected + 1 : 0;
			listWidget.select(nextIndex);
			screen.render();
		});

		screen.key(["enter"], async () => {
			if (popupOpen) return;
			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			if (idx < 0 || idx >= column.tasks.length) return;
			const task = column.tasks[idx];
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
				// Ignore read errors and fall back to empty content
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
			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			if (idx < 0 || idx >= column.tasks.length) return;
			const task = column.tasks[idx];
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

		box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 1,
			width: "100%",
			tags: true,
			content:
				" {cyan-fg}[Tab]{/} Switch View | {cyan-fg}[←→]{/} Columns | {cyan-fg}[↑↓]{/} Tasks | {cyan-fg}[Enter]{/} View | {cyan-fg}[E]{/} Edit | {cyan-fg}[q/Esc]{/} Quit",
		});

		screen.key(["tab"], async () => {
			if (popupOpen) return;
			const column = columns[currentCol];
			if (column) {
				const idx = column.list.selected ?? 0;
				if (idx >= 0 && idx < column.tasks.length) {
					const task = column.tasks[idx];
					if (task) options?.onTaskSelect?.(task);
				}
			}

			if (options?.onTabPress) {
				screen.destroy();
				await options.onTabPress();
				resolve();
				return;
			}

			if (options?.viewSwitcher) {
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
