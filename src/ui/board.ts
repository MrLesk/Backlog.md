import type { BoxInterface, ListInterface } from "neo-neo-bblessed";
import { box, list } from "neo-neo-bblessed";
import {
	type BoardLayout,
	buildKanbanStatusGroups,
	generateKanbanBoardWithMetadata,
	generateMilestoneGroupedBoard,
} from "../board.ts";
import { Core } from "../core/backlog.ts";
import type { Milestone, Task } from "../types/index.ts";
import { collectAvailableLabels } from "../utils/label-filter.ts";
import { applySharedTaskFilters, createTaskSearchIndex } from "../utils/task-search.ts";
import { compareTaskIds } from "../utils/task-sorting.ts";
import { createFilterHeader, type FilterHeader, type FilterState } from "./components/filter-header.ts";
import { openMultiSelectFilterPopup, openSingleSelectFilterPopup } from "./components/filter-popup.ts";
import { formatFooterContent } from "./footer-content.ts";
import { getStatusIcon } from "./status-icon.ts";
import {
	createTaskPopup,
	resolveSearchExitTargetIndex,
	shouldMoveFromListBoundaryToSearch,
} from "./task-viewer-with-search.ts";
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

function formatTaskListItem(task: Task, isMoving = false): string {
	const assignee = task.assignee?.[0]
		? ` {cyan-fg}${task.assignee[0].startsWith("@") ? task.assignee[0] : `@${task.assignee[0]}`}{/}`
		: "";
	const labels = task.labels?.length ? ` {yellow-fg}[${task.labels.join(", ")}]{/}` : "";
	const isCrossBranch = Boolean((task as Task & { branch?: string }).branch);
	const branch = isCrossBranch ? ` {green-fg}(${(task as Task & { branch?: string }).branch}){/}` : "";

	// Cross-branch tasks are dimmed to indicate read-only status
	const content = `{bold}${task.id}{/bold} - ${task.title}${assignee}${labels}${branch}`;
	if (isMoving) {
		return `{magenta-fg}► ${content}{/}`;
	}
	if (isCrossBranch) {
		return `{gray-fg}${content}{/}`;
	}
	return content;
}

function formatColumnLabel(status: string, count: number): string {
	return `\u00A0${getStatusIcon(status)} ${status || "No Status"} (${count})\u00A0`;
}

const DEFAULT_FOOTER_CONTENT =
	" {cyan-fg}[Tab]{/} Switch View | {cyan-fg}[/]{/} Search | {cyan-fg}[P]{/} Priority | {cyan-fg}[F]{/} Labels | {cyan-fg}[I]{/} Milestone | {cyan-fg}[←→]{/} Columns | {cyan-fg}[↑↓]{/} Tasks | {cyan-fg}[Enter]{/} View | {cyan-fg}[E]{/} Edit | {cyan-fg}[M]{/} Move | {cyan-fg}[q/Esc]{/} Quit";

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
		filters?: {
			searchQuery: string;
			priorityFilter: string;
			labelFilter: string[];
			milestoneFilter: string;
		};
		availableLabels?: string[];
		availableMilestones?: string[];
		onFilterChange?: (filters: {
			searchQuery: string;
			priorityFilter: string;
			labelFilter: string[];
			milestoneFilter: string;
		}) => void;
		milestoneMode?: boolean;
		milestoneEntities?: Milestone[];
	},
): Promise<void> {
	if (!process.stdout.isTTY) {
		if (options?.milestoneMode) {
			console.log(generateMilestoneGroupedBoard(initialTasks, statuses, options.milestoneEntities ?? [], "Project"));
		} else {
			console.log(generateKanbanBoardWithMetadata(initialTasks, statuses, "Project"));
		}
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
		const boardArea = box({
			parent: container,
			top: 0,
			left: 0,
			width: "100%",
			height: "100%-1",
		});

		let currentTasks = initialTasks;
		let columns: ColumnView[] = [];
		let currentColumnsData = initialColumns;
		let currentStatuses = currentColumnsData.map((column) => column.status);
		let currentCol = 0;
		let popupOpen = false;
		let currentFocus: "board" | "filters" = "board";
		let filterPopupOpen = false;
		let pendingSearchWrap: "to-first" | "to-last" | null = null;
		const sharedFilters = {
			searchQuery: options?.filters?.searchQuery ?? "",
			priorityFilter: options?.filters?.priorityFilter ?? "",
			labelFilter: [...(options?.filters?.labelFilter ?? [])],
			milestoneFilter: options?.filters?.milestoneFilter ?? "",
		};
		let configuredLabels = collectAvailableLabels(initialTasks, options?.availableLabels ?? []);
		let availableMilestones = [...(options?.availableMilestones ?? [])];
		const milestoneLabelByKey = new Map<string, string>();
		for (const milestone of options?.milestoneEntities ?? []) {
			const normalizedId = milestone.id.trim();
			const normalizedTitle = milestone.title.trim();
			if (!normalizedId || !normalizedTitle) continue;
			milestoneLabelByKey.set(normalizedId.toLowerCase(), normalizedTitle);
			const idMatch = normalizedId.match(/^m-(\d+)$/i);
			if (idMatch?.[1]) {
				const numericAlias = String(Number.parseInt(idMatch[1], 10));
				milestoneLabelByKey.set(`m-${numericAlias}`, normalizedTitle);
				milestoneLabelByKey.set(numericAlias, normalizedTitle);
			}
			milestoneLabelByKey.set(normalizedTitle.toLowerCase(), normalizedTitle);
		}
		const resolveMilestoneLabel = (milestone: string) => {
			const normalized = milestone.trim();
			if (!normalized) return milestone;
			return milestoneLabelByKey.get(normalized.toLowerCase()) ?? milestone;
		};
		availableMilestones = Array.from(
			new Set([
				...availableMilestones,
				...initialTasks
					.map((task) => task.milestone?.trim())
					.filter((milestone): milestone is string => Boolean(milestone && milestone.length > 0))
					.map((milestone) => resolveMilestoneLabel(milestone)),
			]),
		).sort((a, b) => a.localeCompare(b));

		let filterHeader: FilterHeader | null = null;
		const hasActiveSharedFilters = () =>
			Boolean(
				sharedFilters.searchQuery.trim() ||
					sharedFilters.priorityFilter ||
					sharedFilters.labelFilter.length > 0 ||
					sharedFilters.milestoneFilter,
			);
		const emitFilterChange = () => {
			options?.onFilterChange?.({
				searchQuery: sharedFilters.searchQuery,
				priorityFilter: sharedFilters.priorityFilter,
				labelFilter: [...sharedFilters.labelFilter],
				milestoneFilter: sharedFilters.milestoneFilter,
			});
		};
		const getFilteredTasks = (): Task[] => {
			if (!hasActiveSharedFilters()) {
				return [...currentTasks];
			}
			const searchIndex = createTaskSearchIndex(currentTasks);
			return applySharedTaskFilters(
				currentTasks,
				{
					query: sharedFilters.searchQuery,
					priority: sharedFilters.priorityFilter as "high" | "medium" | "low" | undefined,
					labels: sharedFilters.labelFilter,
					milestone: sharedFilters.milestoneFilter || undefined,
					resolveMilestoneLabel,
				},
				searchIndex,
			);
		};

		// Move mode state
		type MoveOperation = {
			taskId: string;
			originalStatus: string;
			originalIndex: number;
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
			wrap: true,
			content: "",
		});
		let transientFooterContent: string | null = null;
		let footerRestoreTimer: ReturnType<typeof setTimeout> | null = null;
		const clearFooterTimer = () => {
			if (!footerRestoreTimer) return;
			clearTimeout(footerRestoreTimer);
			footerRestoreTimer = null;
		};
		const getTerminalWidth = () => (typeof screen.width === "number" ? screen.width : 80);
		const getFooterHeight = () => (typeof footerBox.height === "number" ? footerBox.height : 1);
		const setFooterContent = (content: string) => {
			const formatted = formatFooterContent(content, getTerminalWidth());
			footerBox.height = formatted.height;
			footerBox.setContent(formatted.content);
		};

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
					parent: boardArea,
					left: `${left}%`,
					top: 0,
					width,
					height: "100%",
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

		const focusColumn = (idx: number, preferredRow?: number, activate = true) => {
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

			if (activate) {
				current.list.focus();
				setColumnActiveState(current, true);
				currentFocus = "board";
			} else {
				setColumnActiveState(current, false);
			}
			screen.render();
		};

		const restoreSelection = (taskId?: string) => {
			const activate = currentFocus !== "filters";
			if (columns.length === 0) return;
			if (taskId) {
				for (let colIdx = 0; colIdx < columns.length; colIdx += 1) {
					const column = columns[colIdx];
					if (!column) continue;
					const taskIndex = column.tasks.findIndex((task) => task.id === taskId);
					if (taskIndex !== -1) {
						focusColumn(colIdx, taskIndex, activate);
						return;
					}
				}
			}
			const safeIndex = Math.min(columns.length - 1, Math.max(0, currentCol));
			focusColumn(safeIndex, undefined, activate);
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

		const focusFilterControl = (filterId: "search" | "priority" | "milestone" | "labels") => {
			if (!filterHeader) return;
			switch (filterId) {
				case "search":
					filterHeader.focusSearch();
					break;
				case "priority":
					filterHeader.focusPriority();
					break;
				case "milestone":
					filterHeader.focusMilestone();
					break;
				case "labels":
					filterHeader.focusLabels();
					break;
			}
		};

		const openFilterPicker = async (filterId: "priority" | "milestone" | "labels") => {
			if (filterPopupOpen || moveOp || !filterHeader) {
				return;
			}
			filterPopupOpen = true;
			try {
				if (filterId === "labels") {
					const nextLabels = await openMultiSelectFilterPopup({
						screen,
						title: "Label Filter",
						items: [...configuredLabels].sort((a, b) => a.localeCompare(b)),
						selectedItems: sharedFilters.labelFilter,
					});
					if (nextLabels !== null) {
						sharedFilters.labelFilter = nextLabels;
						filterHeader.setFilters({ labels: nextLabels });
						emitFilterChange();
						renderView();
					}
					return;
				}

				if (filterId === "priority") {
					const priorities = ["high", "medium", "low"];
					const selected = await openSingleSelectFilterPopup({
						screen,
						title: "Priority Filter",
						selectedValue: sharedFilters.priorityFilter,
						choices: [
							{ label: "All", value: "" },
							...priorities.map((priority) => ({ label: priority, value: priority })),
						],
					});
					if (selected !== null) {
						sharedFilters.priorityFilter = selected;
						filterHeader.setFilters({ priority: selected });
						emitFilterChange();
						renderView();
					}
					return;
				}

				const selected = await openSingleSelectFilterPopup({
					screen,
					title: "Milestone Filter",
					selectedValue: sharedFilters.milestoneFilter,
					choices: [{ label: "All", value: "" }, ...availableMilestones.map((value) => ({ label: value, value }))],
				});
				if (selected !== null) {
					sharedFilters.milestoneFilter = selected;
					filterHeader.setFilters({ milestone: selected });
					emitFilterChange();
					renderView();
				}
			} finally {
				filterPopupOpen = false;
				focusFilterControl(filterId);
				screen.render();
			}
		};

		filterHeader = createFilterHeader({
			parent: container,
			statuses: [],
			availableLabels: configuredLabels,
			availableMilestones,
			visibleFilters: ["search", "priority", "milestone", "labels"],
			initialFilters: {
				search: sharedFilters.searchQuery,
				priority: sharedFilters.priorityFilter,
				labels: sharedFilters.labelFilter,
				milestone: sharedFilters.milestoneFilter,
			},
			onFilterChange: (filters: FilterState) => {
				sharedFilters.searchQuery = filters.search;
				sharedFilters.priorityFilter = filters.priority;
				sharedFilters.labelFilter = filters.labels;
				sharedFilters.milestoneFilter = filters.milestone;
				emitFilterChange();
				renderView();
			},
			onFilterPickerOpen: (filterId) => {
				if (filterId === "status") {
					return;
				}
				void openFilterPicker(filterId);
			},
		});
		filterHeader.setFocusChangeHandler((focus) => {
			if (focus !== null) {
				currentFocus = "filters";
				setColumnActiveState(columns[currentCol], false);
				updateFooter();
				screen.render();
			}
		});
		filterHeader.setExitRequestHandler((direction) => {
			const currentColumn = columns[currentCol];
			const selected = currentColumn?.list.selected;
			const currentIndex = typeof selected === "number" ? selected : undefined;
			const totalTasks = currentColumn?.tasks.length ?? 0;
			const targetIndex = resolveSearchExitTargetIndex(direction, pendingSearchWrap, totalTasks, currentIndex);
			pendingSearchWrap = null;
			focusColumn(currentCol, targetIndex);
			updateFooter();
		});
		const syncBoardAreaLayout = () => {
			const headerHeight = filterHeader?.getHeight() ?? 0;
			boardArea.top = headerHeight;
			boardArea.height = `100%-${headerHeight + getFooterHeight()}`;
		};
		syncBoardAreaLayout();

		const updateFooter = () => {
			if (transientFooterContent) {
				setFooterContent(transientFooterContent);
				syncBoardAreaLayout();
				return;
			}
			if (currentFocus === "filters") {
				const filterFocus = filterHeader?.getCurrentFocus();
				if (filterFocus === "search") {
					setFooterContent(
						" {cyan-fg}[←/→]{/} Cursor (edge=Prev/Next) | {cyan-fg}[↑/↓]{/} Back to Board | {cyan-fg}[Esc]{/} Cancel | {gray-fg}(Live search){/}",
					);
					syncBoardAreaLayout();
					return;
				}
				setFooterContent(
					" {cyan-fg}[Enter/Space]{/} Open Picker | {cyan-fg}[←/→]{/} Prev/Next | {cyan-fg}[Esc]{/} Back",
				);
				syncBoardAreaLayout();
				return;
			}
			if (moveOp) {
				setFooterContent(
					" {green-fg}MOVE MODE{/} | {cyan-fg}[←→]{/} Change Column | {cyan-fg}[↑↓]{/} Reorder | {cyan-fg}[Enter/M]{/} Confirm | {cyan-fg}[Esc]{/} Cancel",
				);
			} else {
				const base = DEFAULT_FOOTER_CONTENT;
				setFooterContent(hasActiveSharedFilters() ? `${base} | {yellow-fg}Filtered{/}` : base);
			}
			syncBoardAreaLayout();
		};

		const showTransientFooter = (message: string, durationMs = 3000) => {
			transientFooterContent = message;
			clearFooterTimer();
			updateFooter();
			screen.render();
			footerRestoreTimer = setTimeout(() => {
				transientFooterContent = null;
				footerRestoreTimer = null;
				updateFooter();
				screen.render();
			}, durationMs);
		};

		const renderView = () => {
			const projectedData = getProjectedColumns(getFilteredTasks(), moveOp);

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
			configuredLabels = collectAvailableLabels(currentTasks, options?.availableLabels ?? []);
			availableMilestones = Array.from(
				new Set([
					...(options?.availableMilestones ?? []),
					...currentTasks
						.map((task) => task.milestone?.trim())
						.filter((milestone): milestone is string => Boolean(milestone && milestone.length > 0))
						.map((milestone) => resolveMilestoneLabel(milestone)),
				]),
			).sort((a, b) => a.localeCompare(b));

			renderView();
		};

		options?.subscribeUpdates?.(updateBoard);

		screen.on("resize", () => {
			filterHeader?.rebuild();
			syncBoardAreaLayout();
			renderView();
		});

		// Helper to get target column size (excluding the moving task if it's currently there)
		const getTargetColumnSize = (status: string): number => {
			const columnData = currentColumnsData.find((c) => c.status === status);
			if (!columnData) return 0;
			// If the moving task is currently in this column, we need to account for it
			if (moveOp && moveOp.targetStatus === status) {
				// The task is already "in" this column in the projected view
				return columnData.tasks.length;
			}
			// Otherwise, the task will be added to this column
			return columnData.tasks.length;
		};

		screen.key(["/", "C-f"], () => {
			if (popupOpen || filterPopupOpen || moveOp) return;
			pendingSearchWrap = null;
			focusFilterControl("search");
			updateFooter();
		});

		screen.key(["p", "P"], () => {
			if (popupOpen || filterPopupOpen || moveOp) return;
			void openFilterPicker("priority");
		});

		screen.key(["f", "F"], () => {
			if (popupOpen || filterPopupOpen || moveOp) return;
			void openFilterPicker("labels");
		});

		screen.key(["i", "I"], () => {
			if (popupOpen || filterPopupOpen || moveOp) return;
			void openFilterPicker("milestone");
		});

		screen.key(["left", "h"], () => {
			if (popupOpen || filterPopupOpen || currentFocus === "filters") return;
			if (moveOp) {
				const currentStatusIndex = currentStatuses.indexOf(moveOp.targetStatus);
				if (currentStatusIndex > 0) {
					const prevStatus = currentStatuses[currentStatusIndex - 1];
					if (prevStatus) {
						const prevColumnSize = getTargetColumnSize(prevStatus);
						moveOp.targetStatus = prevStatus;
						// Clamp index to valid range for new column (0 to size, where size means append at end)
						moveOp.targetIndex = Math.min(moveOp.targetIndex, prevColumnSize);
						renderView();
					}
				}
			} else {
				focusColumn(currentCol - 1);
			}
		});

		screen.key(["right", "l"], () => {
			if (popupOpen || filterPopupOpen || currentFocus === "filters") return;
			if (moveOp) {
				const currentStatusIndex = currentStatuses.indexOf(moveOp.targetStatus);
				if (currentStatusIndex < currentStatuses.length - 1) {
					const nextStatus = currentStatuses[currentStatusIndex + 1];
					if (nextStatus) {
						const nextColumnSize = getTargetColumnSize(nextStatus);
						moveOp.targetStatus = nextStatus;
						// Clamp index to valid range for new column
						moveOp.targetIndex = Math.min(moveOp.targetIndex, nextColumnSize);
						renderView();
					}
				}
			} else {
				focusColumn(currentCol + 1);
			}
		});

		screen.key(["up", "k"], () => {
			if (popupOpen || filterPopupOpen || currentFocus === "filters") return;

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
				if (total === 0) {
					pendingSearchWrap = null;
					focusFilterControl("search");
					updateFooter();
					screen.render();
					return;
				}
				if (shouldMoveFromListBoundaryToSearch("up", selected, total)) {
					pendingSearchWrap = "to-last";
					focusFilterControl("search");
					updateFooter();
					screen.render();
					return;
				}
				const nextIndex = selected - 1;
				listWidget.select(nextIndex);
				screen.render();
			}
		});

		screen.key(["down", "j"], () => {
			if (popupOpen || filterPopupOpen || currentFocus === "filters") return;

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
				if (total === 0) {
					pendingSearchWrap = null;
					focusFilterControl("search");
					updateFooter();
					screen.render();
					return;
				}
				if (shouldMoveFromListBoundaryToSearch("down", selected, total)) {
					pendingSearchWrap = "to-first";
					focusFilterControl("search");
					updateFooter();
					screen.render();
					return;
				}
				const nextIndex = selected + 1;
				listWidget.select(nextIndex);
				screen.render();
			}
		});

		const openTaskEditor = async (task: Task) => {
			try {
				const core = new Core(process.cwd(), { enableWatchers: true });
				const result = await core.editTaskInTui(task.id, screen, task);
				if (result.reason === "read_only") {
					const branchInfo = result.task?.branch ? ` from branch "${result.task.branch}"` : "";
					showTransientFooter(` {red-fg}Cannot edit task${branchInfo}.{/}`);
					return;
				}
				if (result.reason === "editor_failed") {
					showTransientFooter(" {red-fg}Editor exited with an error; task was not modified.{/}");
					return;
				}
				if (result.reason === "not_found") {
					showTransientFooter(` {red-fg}Task ${task.id} not found on this branch.{/}`);
					return;
				}

				if (result.task) {
					currentTasks = currentTasks.map((existingTask) =>
						existingTask.id === task.id ? result.task || existingTask : existingTask,
					);
				}

				if (result.changed) {
					renderView();
					showTransientFooter(` {green-fg}Task ${result.task?.id ?? task.id} marked modified.{/}`);
					return;
				}

				renderView();
				showTransientFooter(` {gray-fg}No changes detected for ${result.task?.id ?? task.id}.{/}`);
			} catch (_error) {
				showTransientFooter(" {red-fg}Failed to open editor.{/}");
			}
		};

		screen.key(["enter"], async () => {
			if (popupOpen || filterPopupOpen || currentFocus === "filters") return;

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

			const popup = await createTaskPopup(screen, task, resolveMilestoneLabel);
			if (!popup) {
				popupOpen = false;
				return;
			}

			const { contentArea, close } = popup;
			contentArea.key(["escape", "q"], () => {
				popupOpen = false;
				close();
				focusColumn(currentCol);
			});

			contentArea.key(["e", "E", "S-e"], async () => {
				await openTaskEditor(task);
			});

			screen.render();
		});

		screen.key(["e", "E", "S-e"], async () => {
			if (popupOpen || filterPopupOpen || currentFocus === "filters") return;
			const column = columns[currentCol];
			if (!column) return;
			const idx = column.list.selected ?? 0;
			if (idx < 0 || idx >= column.tasks.length) return;
			const task = column.tasks[idx];
			if (!task) return;
			await openTaskEditor(task);
		});

		const performTaskMove = async () => {
			if (!moveOp) return;

			// Check if any actual change occurred
			const noChange = moveOp.targetStatus === moveOp.originalStatus && moveOp.targetIndex === moveOp.originalIndex;

			if (noChange) {
				// No change, just exit move mode
				moveOp = null;
				renderView();
				return;
			}

			try {
				const core = new Core(process.cwd(), { enableWatchers: true });
				const config = await core.fs.loadConfig();

				// Get the final state from the projection
				const projectedData = getProjectedColumns(currentTasks, moveOp);
				const targetColumn = projectedData.find((c) => c.status === moveOp?.targetStatus);

				if (!targetColumn) {
					moveOp = null;
					renderView();
					return;
				}

				const orderedTaskIds = targetColumn.tasks.map((task) => task.id);

				// Persist the move using core API
				const { updatedTask, changedTasks } = await core.reorderTask({
					taskId: moveOp.taskId,
					targetStatus: moveOp.targetStatus,
					orderedTaskIds,
					autoCommit: config?.autoCommit ?? false,
				});

				// Update local state with all changed tasks (includes ordinal updates)
				const changedTasksMap = new Map(changedTasks.map((t) => [t.id, t]));
				changedTasksMap.set(updatedTask.id, updatedTask);
				currentTasks = currentTasks.map((t) => changedTasksMap.get(t.id) ?? t);

				// Exit move mode
				moveOp = null;

				// Render with updated local state
				renderView();
			} catch (error) {
				// On error, cancel the move and restore original position
				if (process.env.DEBUG) {
					console.error("Move failed:", error);
				}
				moveOp = null;
				renderView();
			}
		};
		const cancelMove = () => {
			if (!moveOp) return;

			// Exit move mode - pure state reset
			moveOp = null;

			renderView();
		};

		screen.key(["m", "M", "S-m"], async () => {
			if (popupOpen || filterPopupOpen || currentFocus === "filters") return;
			if (hasActiveSharedFilters()) {
				showTransientFooter(" {yellow-fg}Clear filters before moving tasks.{/}");
				return;
			}

			if (!moveOp) {
				const column = columns[currentCol];
				if (!column) return;
				const taskIndex = column.list.selected ?? 0;
				const task = column.tasks[taskIndex];
				if (!task) return;

				// Prevent move mode for cross-branch tasks
				if (task.branch) {
					showTransientFooter(` {red-fg}Cannot move task from branch "${task.branch}".{/}`);
					return;
				}

				// Enter move mode - store original position for cancel
				moveOp = {
					taskId: task.id,
					originalStatus: column.status,
					originalIndex: taskIndex,
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
			if (popupOpen || filterPopupOpen || currentFocus === "filters") return;
			const column = columns[currentCol];
			if (column) {
				const idx = column.list.selected ?? 0;
				if (idx >= 0 && idx < column.tasks.length) {
					const task = column.tasks[idx];
					if (task) options?.onTaskSelect?.(task);
				}
			}

			if (options?.onTabPress) {
				clearFooterTimer();
				screen.destroy();
				await options.onTabPress();
				resolve();
				return;
			}

			if (options?.viewSwitcher) {
				clearFooterTimer();
				screen.destroy();
				await options.viewSwitcher.switchView();
				resolve();
			}
		});

		screen.key(["q", "C-c"], () => {
			if (popupOpen || filterPopupOpen) return;
			clearFooterTimer();
			screen.destroy();
			resolve();
		});

		screen.key(["escape"], () => {
			if (popupOpen || filterPopupOpen) return;
			if (currentFocus === "filters") {
				focusColumn(currentCol);
				updateFooter();
				return;
			}
			// In move mode, ESC cancels and restores original position
			if (moveOp) {
				cancelMove();
				return;
			}

			if (!popupOpen) {
				clearFooterTimer();
				screen.destroy();
				resolve();
			}
		});

		screen.render();
	});
}
