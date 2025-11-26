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

		// Use ordinal for custom sorting if available
		const aOrd = a.ordinal;
		const bOrd = b.ordinal;

		// If both have ordinals, compare them
		if (typeof aOrd === "number" && typeof bOrd === "number") {
			if (aOrd !== bOrd) return aOrd - bOrd;
		} else if (typeof aOrd === "number") {
			// Only A has ordinal -> A comes first
			return -1;
		} else if (typeof bOrd === "number") {
			// Only B has ordinal -> B comes first
			return 1;
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

function formatTaskListItem(task: Task, isMoving = false): string {
	const assignee = task.assignee?.[0]
		? ` {cyan-fg}${task.assignee[0].startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
		: "";
	const labels = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";
	const branch = (task as Task & { branch?: string }).branch
		? ` {green-fg}(${(task as Task & { branch?: string }).branch}){/}`
		: "";
	const content = `{bold}${task.id}{/bold} - ${task.title}${assignee}${labels}${branch}`;
	return isMoving ? `{magenta-fg}► ${content}{/}` : content;
}

function formatColumnLabel(status: string, count: number): string {
	return `\u00A0${getStatusIcon(status)} ${status || "No Status"} (${count})\u00A0`;
}

function _arraysEqual(left: string[], right: string[]): boolean {
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
	initialTasks: Task[],
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
		console.log(generateKanbanBoardWithMetadata(initialTasks, statuses, "Project"));
		return;
	}

	const initialColumns = prepareBoardColumns(initialTasks, statuses);
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

		let currentTasks = initialTasks;
		let columns: ColumnView[] = [];
		let currentColumnsData = initialColumns;
		let currentStatuses = currentColumnsData.map((column) => column.status);
		let currentCol = 0;
		let popupOpen = false;

		// Move mode state
		type MoveOperation = {
			taskId: string;
			targetStatus: string;
			targetIndex: number;
		};
		let moveOp: MoveOperation | null = null;

		const footerBox = box({
			parent: screen,
			bottom: 0,
			left: 0,
			height: 1,
			width: "100%",
			tags: true,
			content:
				" {cyan-fg}[Tab]{/} Switch View | {cyan-fg}[←→]{/} Columns | {cyan-fg}[↑↓]{/} Tasks | {cyan-fg}[Enter]{/} View | {cyan-fg}[E]{/} Edit | {cyan-fg}[M]{/} Move | {cyan-fg}[q/Esc]{/} Quit",
		});

		const clearColumns = () => {
			for (const column of columns) {
				column.box.destroy();
			}
			columns = [];
		};

		const columnWidthFor = (count: number) => Math.max(1, Math.floor(100 / Math.max(1, count)));

		const getFormattedItems = (tasks: Task[]) => {
			return tasks.map((task) => formatTaskListItem(task, moveOp?.taskId === task.id));
		};

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

				taskList.setItems(getFormattedItems(columnData.tasks));
				columns.push({ status: columnData.status, tasks: columnData.tasks, list: taskList, box: columnBox });
			});
		};

		const setColumnActiveState = (column: ColumnView | undefined, active: boolean) => {
			if (!column) return;
			const listStyle = column.list.style as { selected?: { bg?: string } };
			// In move mode, use green highlight for the moving task
			if (listStyle.selected) listStyle.selected.bg = moveOp && active ? "green" : active ? "blue" : undefined;
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
				column.list.setItems(getFormattedItems(columnData.tasks));
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

		// Pure function to calculate the projected board state
		const getProjectedColumns = (allTasks: Task[], operation: MoveOperation | null): ColumnData[] => {
			if (!operation) {
				return prepareBoardColumns(allTasks, currentStatuses);
			}

			// 1. Filter out the moving task from the source
			const tasksWithoutMoving = allTasks.filter((t) => t.id !== operation.taskId);
			const movingTask = allTasks.find((t) => t.id === operation.taskId);

			if (!movingTask) {
				return prepareBoardColumns(allTasks, currentStatuses);
			}

			// 2. Prepare columns without the moving task
			const columns = prepareBoardColumns(tasksWithoutMoving, currentStatuses);

			// 3. Insert the moving task into the target column at the target index
			const targetColumn = columns.find((c) => c.status === operation.targetStatus);
			if (targetColumn) {
				// Create a "ghost" task with updated status
				const ghostTask = { ...movingTask, status: operation.targetStatus };

				// Clamp index to valid bounds
				const safeIndex = Math.max(0, Math.min(operation.targetIndex, targetColumn.tasks.length));
				targetColumn.tasks.splice(safeIndex, 0, ghostTask);
			}

			return columns;
		};

		const updateFooter = () => {
			if (moveOp) {
				footerBox.setContent(
					" {green-fg}MOVE MODE{/} | {cyan-fg}[←→]{/} Change Column | {cyan-fg}[↑↓]{/} Reorder | {cyan-fg}[Enter/M]{/} Confirm | {cyan-fg}[Esc]{/} Cancel",
				);
			} else {
				footerBox.setContent(
					" {cyan-fg}[Tab]{/} Switch View | {cyan-fg}[←→]{/} Columns | {cyan-fg}[↑↓]{/} Tasks | {cyan-fg}[Enter]{/} View | {cyan-fg}[E]{/} Edit | {cyan-fg}[M]{/} Move | {cyan-fg}[q/Esc]{/} Quit",
				);
			}
		};

		const renderView = () => {
			const projectedData = getProjectedColumns(currentTasks, moveOp);

			// If we are moving, we want to select the moving task
			const selectedId = moveOp ? moveOp.taskId : getSelectedTaskId();

			if (projectedData.length === 0) {
				const fallbackStatus = currentStatuses[0] ?? "No Status";
				rebuildColumns([{ status: fallbackStatus, tasks: [] }], selectedId);
			} else if (shouldRebuildColumns(currentColumnsData, projectedData)) {
				rebuildColumns(projectedData, selectedId);
			} else {
				applyColumnData(projectedData, selectedId);
			}

			updateFooter();
			screen.render();
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
			// Update source of truth
			currentTasks = nextTasks;
			// Only update statuses if they changed (rare in TUI)
			if (nextStatuses.length > 0) currentStatuses = nextStatuses;

			renderView();
		};

		options?.subscribeUpdates?.(updateBoard);

		screen.key(["left", "h"], () => {
			if (moveOp) {
				// Find current status index
				const currentStatusIndex = currentStatuses.indexOf(moveOp.targetStatus);
				if (currentStatusIndex > 0) {
					const prevStatus = currentStatuses[currentStatusIndex - 1];

					// We need to know how many items are in the target column to clamp the index
					// Note: This is an approximation since we don't have the projected column yet
					// But since we render immediately after, it visualizes correctly
					moveOp.targetStatus = prevStatus;

					// When switching columns, try to maintain relative vertical position but clamp to size
					// We can just let the next render clamp it, or reset to 0.
					// Let's keep current index, renderView will clamp it.
					renderView();
				}
			} else {
				focusColumn(currentCol - 1);
			}
		});

		screen.key(["right", "l"], () => {
			if (moveOp) {
				const currentStatusIndex = currentStatuses.indexOf(moveOp.targetStatus);
				if (currentStatusIndex < currentStatuses.length - 1) {
					const nextStatus = currentStatuses[currentStatusIndex + 1];
					moveOp.targetStatus = nextStatus;
					renderView();
				}
			} else {
				focusColumn(currentCol + 1);
			}
		});

		screen.key(["up", "k"], () => {
			if (popupOpen) return;

			if (moveOp) {
				if (moveOp.targetIndex > 0) {
					moveOp.targetIndex--;
					renderView();
				}
			} else {
				const column = columns[currentCol];
				if (!column) return;
				const listWidget = column.list;
				const selected = listWidget.selected ?? 0;
				const total = column.tasks.length;
				if (total === 0) return;
				const nextIndex = selected > 0 ? selected - 1 : total - 1;
				listWidget.select(nextIndex);
				screen.render();
			}
		});

		screen.key(["down", "j"], () => {
			if (popupOpen) return;

			if (moveOp) {
				const column = columns[currentCol];
				// We need to check the projected length to know if we can move down
				// The current rendered column has the correct length including the ghost task
				if (column && moveOp.targetIndex < column.tasks.length - 1) {
					moveOp.targetIndex++;
					renderView();
				}
			} else {
				const column = columns[currentCol];
				if (!column) return;
				const listWidget = column.list;
				const selected = listWidget.selected ?? 0;
				const total = column.tasks.length;
				if (total === 0) return;
				const nextIndex = selected < total - 1 ? selected + 1 : 0;
				listWidget.select(nextIndex);
				screen.render();
			}
		});

		screen.key(["enter"], async () => {
			if (popupOpen) return;

			// In move mode, Enter confirms the move
			if (moveOp) {
				await performTaskMove();
				return;
			}

			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			if (idx < 0 || idx >= column.tasks.length) return;
			const task = column.tasks[idx];
			if (!task) return;
			popupOpen = true;

			const popup = await createTaskPopup(screen, task);
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

		const performTaskMove = async () => {
			if (!moveOp) return;

			try {
				const core = new Core(process.cwd());
				const config = await core.fs.loadConfig();

				// Get the final state from the projection
				const projectedData = getProjectedColumns(currentTasks, moveOp);
				const targetColumn = projectedData.find((c) => c.status === moveOp?.targetStatus);

				if (!targetColumn) return;

				const orderedTaskIds = targetColumn.tasks.map((task) => task.id);

				// Persist the move using core API
				await core.reorderTask({
					taskId: moveOp.taskId,
					targetStatus: moveOp.targetStatus,
					orderedTaskIds,
					autoCommit: config?.autoCommit ?? false,
				});

				// Exit move mode
				moveOp = null;

				// Update UI
				renderView();

				// Refresh board data
				// We use loadBoardTasks instead of queryTasks to ensure consistency with the initial load,
				// specifically to include remote tasks and potentially completed tasks if they were loaded initially.
				// This prevents tasks from disappearing from the board after a move if they aren't in the local cache.
				const allTasks = await core.loadBoardTasks();
				updateBoard(allTasks, currentStatuses);
			} catch (error) {
				// Log error for debugging but prevent crash
				if (process.env.DEBUG) {
					console.error("Move failed:", error);
				}
			}
		};
		const cancelMove = () => {
			if (!moveOp) return;

			// Exit move mode - pure state reset
			moveOp = null;

			renderView();
		};

		screen.key(["m", "M"], async () => {
			if (popupOpen) return;

			if (!moveOp) {
				const column = columns[currentCol];
				if (!column) return;
				const taskIndex = column.list.selected ?? 0;
				const task = column.tasks[taskIndex];
				if (!task) return;

				// Enter move mode
				moveOp = {
					taskId: task.id,
					targetStatus: column.status,
					targetIndex: taskIndex,
				};

				renderView();
			} else {
				// Confirm move (same as Enter in move mode)
				await performTaskMove();
			}
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
			// In move mode, ESC cancels and restores original position
			if (moveOp) {
				cancelMove();
				return;
			}

			if (!popupOpen) {
				screen.destroy();
				resolve();
			}
		});

		screen.render();
	});
}
