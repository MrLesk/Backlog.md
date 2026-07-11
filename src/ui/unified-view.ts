/**
 * Unified view manager that handles Tab switching between task views and kanban board
 */

import type { Core } from "../core/backlog.ts";
import { findLocalDuplicateTaskIds } from "../core/duplicate-task-repair.ts";
import type { Milestone, Task, TaskCreateInput } from "../types/index.ts";
import { watchConfig } from "../utils/config-watcher.ts";
import { formatDuplicateTaskIdSummary } from "../utils/duplicate-detection.ts";
import { collectAvailableLabels } from "../utils/label-filter.ts";
import { hasAnyPrefix } from "../utils/prefix-config.ts";
import { applySharedTaskFilters, createTaskSearchIndex, type LabelMatchMode } from "../utils/task-search.ts";
import { type TaskWatcherCallbacks, watchTasks } from "../utils/task-watcher.ts";
import { renderBoardTui } from "./board.ts";
import { createLoadingScreen } from "./loading.ts";
import { buildTaskViewerMilestoneFilterModel, viewTaskEnhanced } from "./task-viewer-with-search.ts";
import { type ViewState, ViewSwitcher, type ViewType } from "./view-switcher.ts";

export interface UnifiedViewOptions {
	core: Core;
	initialView: ViewType;
	selectedTask?: Task;
	tasks?: Task[];
	tasksLoader?: (updateProgress: (message: string) => void) => Promise<{ tasks: Task[]; statuses: string[] }>;
	loadingScreenFactory?: (initialMessage: string) => Promise<LoadingScreen | null>;
	title?: string;
	filter?: {
		status?: string;
		assignee?: string;
		type?: string[];
		priority?: string;
		labels?: string[];
		labelMatch?: LabelMatchMode;
		milestone?: string;
		sort?: string;
		title?: string;
		filterDescription?: string;
		searchQuery?: string;
		excludeStatus?: string[];
		parentTaskId?: string;
		limit?: number;
	};
	preloadedKanbanData?: {
		tasks: Task[];
		statuses: string[];
	};
	milestoneMode?: boolean;
	milestoneEntities?: Milestone[];
}

type LoadingScreen = {
	update(message: string): void;
	close(): Promise<void> | void;
};

export interface UnifiedViewLoadResult {
	tasks: Task[];
	statuses: string[];
}

export type UnifiedTaskUpdate = { type: "upsert"; task: Task } | { type: "remove"; taskId: string };

export interface UnifiedTaskState {
	tasks: Task[];
	selectedTask?: Task;
}

export function applyUnifiedTaskUpdate(state: UnifiedTaskState, update: UnifiedTaskUpdate): UnifiedTaskState {
	if (update.type === "upsert") {
		const index = state.tasks.findIndex((task) => task.id === update.task.id);
		const tasks = [...state.tasks];
		if (index === -1) tasks.push(update.task);
		else tasks[index] = update.task;
		return {
			tasks,
			selectedTask: state.selectedTask?.id === update.task.id ? update.task : state.selectedTask,
		};
	}

	const removedIndex = state.tasks.findIndex((task) => task.id === update.taskId);
	if (removedIndex === -1) return state;
	const tasks = state.tasks.filter((task) => task.id !== update.taskId);
	const selectedTask =
		state.selectedTask?.id === update.taskId
			? tasks[Math.min(removedIndex, Math.max(tasks.length - 1, 0))]
			: state.selectedTask;
	return { tasks, selectedTask };
}

export function createUnifiedTaskUpdateCallbacks(
	getState: () => UnifiedTaskState,
	onStateChanged: (state: UnifiedTaskState) => void,
): TaskWatcherCallbacks {
	const publish = (update: UnifiedTaskUpdate) => onStateChanged(applyUnifiedTaskUpdate(getState(), update));
	return {
		onTaskAdded: (task) => publish({ type: "upsert", task }),
		onTaskChanged: (task) => publish({ type: "upsert", task }),
		onTaskRemoved: (taskId) => publish({ type: "remove", taskId }),
	};
}

export interface UnifiedViewFilters {
	searchQuery: string;
	statusFilter: string;
	excludeStatus: string[];
	typeFilter: string[];
	priorityFilter: string;
	labelFilter: string[];
	labelMatch?: LabelMatchMode;
	milestoneFilter: string;
	limit?: number;
}

type UnifiedViewFilterUpdate = Omit<UnifiedViewFilters, "excludeStatus" | "typeFilter"> &
	Partial<Pick<UnifiedViewFilters, "excludeStatus" | "typeFilter">>;

export interface KanbanSharedFilters {
	searchQuery: string;
	excludeStatus: string[];
	typeFilter?: string[];
	priorityFilter: string;
	labelFilter: string[];
	labelMatch?: LabelMatchMode;
	milestoneFilter: string;
	limit?: number;
}

export function createKanbanSharedFilters(filters: UnifiedViewFilters): KanbanSharedFilters {
	return {
		searchQuery: filters.searchQuery,
		excludeStatus: [...filters.excludeStatus],
		typeFilter: [...filters.typeFilter],
		priorityFilter: filters.priorityFilter,
		labelFilter: [...filters.labelFilter],
		labelMatch: filters.labelMatch,
		milestoneFilter: filters.milestoneFilter,
		limit: filters.limit,
	};
}

export function filterTasksForKanban(
	tasks: Task[],
	filters: KanbanSharedFilters,
	resolveMilestoneLabel?: (milestone: string) => string,
): Task[] {
	if (
		!filters.searchQuery.trim() &&
		filters.excludeStatus.length === 0 &&
		(filters.typeFilter?.length ?? 0) === 0 &&
		!filters.priorityFilter &&
		filters.labelFilter.length === 0 &&
		!filters.milestoneFilter
	) {
		return filters.limit !== undefined ? tasks.slice(0, filters.limit) : [...tasks];
	}

	const searchIndex = createTaskSearchIndex(tasks);
	const filteredTasks = applySharedTaskFilters(
		tasks,
		{
			query: filters.searchQuery,
			excludeStatus: filters.excludeStatus,
			type: filters.typeFilter,
			priority: filters.priorityFilter || undefined,
			labels: filters.labelFilter,
			labelMatch: filters.labelMatch ?? "any",
			milestone: filters.milestoneFilter || undefined,
			resolveMilestoneLabel,
		},
		searchIndex,
	);
	return filters.limit !== undefined ? filteredTasks.slice(0, filters.limit) : filteredTasks;
}

export function createUnifiedViewFilters(filter: UnifiedViewOptions["filter"] | undefined): UnifiedViewFilters {
	return {
		searchQuery: filter?.searchQuery || "",
		statusFilter: filter?.status || "",
		excludeStatus: [...(filter?.excludeStatus || [])],
		typeFilter: [...(filter?.type || [])],
		priorityFilter: filter?.priority || "",
		labelFilter: [...(filter?.labels || [])],
		labelMatch: filter?.labelMatch ?? "any",
		milestoneFilter: filter?.milestone || "",
		limit: filter?.limit,
	};
}

export function mergeUnifiedViewFilters(
	current: UnifiedViewFilters,
	update: UnifiedViewFilterUpdate,
): UnifiedViewFilters {
	return {
		...current,
		searchQuery: update.searchQuery,
		statusFilter: update.statusFilter,
		excludeStatus: [...(update.excludeStatus ?? current.excludeStatus)],
		typeFilter: [...(update.typeFilter ?? current.typeFilter)],
		priorityFilter: update.priorityFilter,
		labelFilter: [...update.labelFilter],
		labelMatch: update.labelMatch ?? current.labelMatch ?? "any",
		milestoneFilter: update.milestoneFilter,
		limit: update.limit ?? current.limit,
	};
}

export async function loadTasksForUnifiedView(
	core: Core,
	options: Pick<UnifiedViewOptions, "tasks" | "tasksLoader" | "loadingScreenFactory">,
): Promise<UnifiedViewLoadResult> {
	if (options.tasks && options.tasks.length > 0) {
		const config = await core.filesystem.loadConfig();
		return {
			tasks: options.tasks,
			statuses: config?.statuses || ["To Do", "In Progress", "Done"],
		};
	}

	const loader =
		options.tasksLoader ||
		(async (updateProgress: (message: string) => void): Promise<{ tasks: Task[]; statuses: string[] }> => {
			const tasks = await core.loadTasks(updateProgress);
			const config = await core.filesystem.loadConfig();
			return {
				tasks,
				statuses: config?.statuses || ["To Do", "In Progress", "Done"],
			};
		});

	const loadingScreenFactory = options.loadingScreenFactory || createLoadingScreen;
	const loadingScreen = await loadingScreenFactory("Loading tasks");

	try {
		const result = await loader((message) => {
			loadingScreen?.update(message);
		});

		return {
			tasks: result.tasks,
			statuses: result.statuses,
		};
	} finally {
		await loadingScreen?.close();
	}
}

export async function getDuplicateTaskStartupWarning(core: Core): Promise<string | undefined> {
	const groups = await findLocalDuplicateTaskIds(core);
	return groups.length > 0 ? formatDuplicateTaskIdSummary(groups) : undefined;
}

type ViewResult = "switch" | "exit";

export function getEmptyUnifiedViewMessage(initialView: ViewType, parentTaskId?: string): string | null {
	if (parentTaskId) return `No child tasks found for parent task ${parentTaskId}.`;
	return initialView === "kanban" ? null : "No tasks found.";
}

export async function createTaskFromBoard(
	core: Core,
	input: TaskCreateInput,
	onCreated?: (task: Task) => Promise<void> | void,
): Promise<Task> {
	const config = await core.filesystem.loadConfig();
	const task = (await core.createTaskFromInput(input, config?.autoCommit ?? false)).task;
	if (task.status.trim().toLowerCase() !== "draft") await onCreated?.(task);
	return task;
}

/**
 * Main unified view controller that handles Tab switching between views
 */
export async function runUnifiedView(options: UnifiedViewOptions): Promise<void> {
	try {
		const { tasks: loadedTasks, statuses: loadedStatuses } = await loadTasksForUnifiedView(options.core, {
			tasks: options.tasks,
			tasksLoader: options.tasksLoader,
			loadingScreenFactory: options.loadingScreenFactory,
		});

		const startupWarning = await getDuplicateTaskStartupWarning(options.core);

		const baseTasks = (loadedTasks || []).filter((t) => t.id && t.id.trim() !== "" && hasAnyPrefix(t.id));
		if (baseTasks.length === 0) {
			const emptyMessage = getEmptyUnifiedViewMessage(options.initialView, options.filter?.parentTaskId);
			if (emptyMessage) {
				console.log(emptyMessage);
				return;
			}
		}
		const initialConfig = await options.core.filesystem.loadConfig();
		let configuredLabels = initialConfig?.labels ?? [];
		let milestoneEntities = await options.core.filesystem.listMilestones();
		let milestoneFilterModel = buildTaskViewerMilestoneFilterModel(milestoneEntities);
		let currentFilters = createUnifiedViewFilters(options.filter);
		const initialState: ViewState = {
			type: options.initialView,
			selectedTask: options.selectedTask,
			tasks: baseTasks,
			filter: options.filter,
			// Initialize kanban data if starting with kanban view
			kanbanData:
				options.initialView === "kanban"
					? {
							tasks: baseTasks,
							statuses: loadedStatuses,
							isLoading: false,
						}
					: undefined,
		};

		let isRunning = true;
		let viewSwitcher: ViewSwitcher | null = null;
		let currentView: ViewType = options.initialView;
		let selectedTask: Task | undefined = options.selectedTask;
		let tasks = baseTasks;
		let kanbanStatuses = loadedStatuses ?? [];
		let boardUpdater: ((nextTasks: Task[], nextStatuses: string[]) => void) | null = null;
		let taskListUpdater:
			| ((nextTasks: Task[], nextStatuses: string[], nextLabels: string[], nextSelectedTask?: Task) => void)
			| null = null;

		const getRenderableTasks = () => tasks.filter((task) => task.id && task.id.trim() !== "" && hasAnyPrefix(task.id));
		const getBoardAvailableLabels = () => collectAvailableLabels(getRenderableTasks(), configuredLabels);
		const getBoardAvailableMilestones = () => [...milestoneFilterModel.availableMilestoneTitles];

		const emitBoardUpdate = () => {
			if (!boardUpdater) return;
			boardUpdater(getRenderableTasks(), kanbanStatuses);
		};
		const emitTaskListUpdate = () => {
			if (!taskListUpdater) return;
			taskListUpdater(getRenderableTasks(), kanbanStatuses, configuredLabels, selectedTask);
		};
		const taskUpdateCallbacks = createUnifiedTaskUpdateCallbacks(
			() => ({ tasks, selectedTask }),
			(next) => {
				tasks = next.tasks;
				selectedTask = next.selectedTask;
				const state = viewSwitcher?.getState();
				viewSwitcher?.updateState({
					tasks,
					selectedTask,
					kanbanData: state?.kanbanData ? { ...state.kanbanData, tasks } : undefined,
				});
				emitBoardUpdate();
				emitTaskListUpdate();
			},
		);
		let isInitialLoad = true; // Track if this is the first view load

		// Create view switcher (without problematic onViewChange callback)
		viewSwitcher = new ViewSwitcher({
			core: options.core,
			initialState,
		});
		const watcher = watchTasks(options.core, taskUpdateCallbacks, baseTasks);
		process.on("exit", () => watcher.stop());

		const configWatcher = watchConfig(options.core, {
			onConfigChanged: (config) => {
				kanbanStatuses = config?.statuses ?? [];
				configuredLabels = config?.labels ?? [];
				emitBoardUpdate();
				emitTaskListUpdate();
			},
		});

		process.on("exit", () => configWatcher.stop());

		// Function to show task view
		const showTaskView = async (): Promise<ViewResult> => {
			const availableTasks = tasks.filter((t) => t.id && t.id.trim() !== "" && hasAnyPrefix(t.id));

			if (availableTasks.length === 0) {
				console.log("No tasks available.");
				return "exit";
			}

			// Find the task to view - if selectedTask has an ID, find it in available tasks
			let taskToView: Task | undefined;
			if (selectedTask?.id) {
				const foundTask = availableTasks.find((t) => t.id === selectedTask?.id);
				taskToView = foundTask || availableTasks[0];
			} else {
				taskToView = availableTasks[0];
			}

			if (!taskToView) {
				console.log("No task selected.");
				return "exit";
			}

			// Show enhanced task viewer with view switching support
			return new Promise<ViewResult>((resolve) => {
				let result: ViewResult = "exit"; // Default to exit

				const onTabPress = async () => {
					result = "switch";
				};

				// Determine initial focus based on where we're coming from
				// - If we have a search query on initial load, focus search
				// - If currentView is task-detail, focus detail
				// - Otherwise (including when coming from kanban), focus task list
				const hasSearchQuery = options.filter ? "searchQuery" in options.filter : false;
				const shouldFocusSearch = isInitialLoad && hasSearchQuery;

				viewTaskEnhanced(taskToView, {
					tasks: availableTasks,
					core: options.core,
					title: options.filter?.title,
					filterDescription: options.filter?.filterDescription,
					searchQuery: currentFilters.searchQuery,
					statusFilter: currentFilters.statusFilter,
					excludeStatus: currentFilters.excludeStatus,
					typeFilter: currentFilters.typeFilter,
					priorityFilter: currentFilters.priorityFilter,
					labelFilter: currentFilters.labelFilter,
					labelMatch: currentFilters.labelMatch,
					milestoneFilter: currentFilters.milestoneFilter,
					limit: currentFilters.limit,
					startWithDetailFocus: currentView === "task-detail",
					startWithSearchFocus: shouldFocusSearch,
					startupWarning,
					subscribeUpdates: (updater) => {
						taskListUpdater = updater;
						emitTaskListUpdate();
					},
					onTaskChange: (newTask) => {
						selectedTask = newTask;
						currentView = "task-detail";
					},
					onFilterChange: (filters) => {
						currentFilters = mergeUnifiedViewFilters(currentFilters, filters);
					},
					onTabPress,
				}).then(() => {
					// If user wants to exit, do it immediately
					if (result === "exit") {
						process.exit(0);
					}
					taskListUpdater = null;
					resolve(result);
				});
			});
		};

		// Function to show kanban view
		const showKanbanView = async (): Promise<ViewResult> => {
			const config = await options.core.filesystem.loadConfig();
			configuredLabels = config?.labels ?? configuredLabels;
			const layout = "horizontal" as const;
			const maxColumnWidth = config?.maxColumnWidth || 20;
			milestoneEntities = await options.core.filesystem.listMilestones();
			milestoneFilterModel = buildTaskViewerMilestoneFilterModel(milestoneEntities);
			const kanbanTasks = getRenderableTasks();
			const statuses = kanbanStatuses;

			// Show kanban board with view switching support
			return new Promise<ViewResult>((resolve) => {
				let result: ViewResult = "exit"; // Default to exit

				const onTabPress = async () => {
					result = "switch";
				};

				renderBoardTui(kanbanTasks, statuses, layout, maxColumnWidth, {
					onTaskSelect: (task) => {
						selectedTask = task;
					},
					onTabPress,
					filters: createKanbanSharedFilters(currentFilters),
					availableLabels: getBoardAvailableLabels(),
					availableMilestones: getBoardAvailableMilestones(),
					onFilterChange: (filters) => {
						currentFilters = mergeUnifiedViewFilters(currentFilters, {
							searchQuery: filters.searchQuery,
							statusFilter: currentFilters.statusFilter,
							excludeStatus: filters.excludeStatus,
							typeFilter: [...filters.typeFilter],
							priorityFilter: filters.priorityFilter,
							labelFilter: [...filters.labelFilter],
							labelMatch: filters.labelMatch ?? currentFilters.labelMatch ?? "any",
							milestoneFilter: filters.milestoneFilter,
							limit: filters.limit,
						});
					},
					subscribeUpdates: (updater) => {
						boardUpdater = updater;
						emitBoardUpdate();
					},
					milestoneMode: options.milestoneMode,
					milestoneEntities,
					startupWarning,
					dateFormat: config?.dateFormat,
					wrapNavigationToSearch: config?.wrapNavigationToSearch,
					priorities: config?.priorities,
					types: config?.types,
					createTask: async (input) => createTaskFromBoard(options.core, input, taskUpdateCallbacks.onTaskAdded),
				}).then(() => {
					// If user wants to exit, do it immediately
					if (result === "exit") {
						process.exit(0);
					}
					boardUpdater = null;
					resolve(result);
				});
			});
		};

		// Main view loop
		while (isRunning) {
			// Show the current view and get the result
			let result: ViewResult;
			switch (currentView) {
				case "task-list":
				case "task-detail":
					result = await showTaskView();
					break;
				case "kanban":
					result = await showKanbanView();
					break;
				default:
					result = "exit";
			}

			// After the first view, we're no longer on initial load
			isInitialLoad = false;

			// Handle the result
			if (result === "switch") {
				// User pressed Tab, switch to the next view
				switch (currentView) {
					case "task-list":
					case "task-detail":
						currentView = "kanban";
						break;
					case "kanban":
						// Always go to task-list view when switching from board, keeping selected task highlighted
						currentView = "task-list";
						break;
				}
			} else {
				// User pressed q/Esc, exit the loop
				isRunning = false;
			}
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
