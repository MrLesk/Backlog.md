/**
 * Unified view manager that handles Tab switching between task views and kanban board
 */

import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { watchConfig } from "../utils/config-watcher.ts";
import { watchTasks } from "../utils/task-watcher.ts";
import { renderBoardTui } from "./board.ts";
import { createLoadingScreen } from "./loading.ts";
import { viewTaskEnhanced } from "./task-viewer-with-search.ts";
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
		priority?: string;
		labels?: string[];
		sort?: string;
		title?: string;
		filterDescription?: string;
		searchQuery?: string;
		parentTaskId?: string;
	};
	preloadedKanbanData?: {
		tasks: Task[];
		statuses: string[];
	};
	milestoneMode?: boolean;
	milestones?: string[];
}

type LoadingScreen = {
	update(message: string): void;
	close(): Promise<void> | void;
};

export interface UnifiedViewLoadResult {
	tasks: Task[];
	statuses: string[];
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

type ViewResult = "switch" | "exit";

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

		const baseTasks = (loadedTasks || []).filter((t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"));
		if (baseTasks.length === 0) {
			if (options.filter?.parentTaskId) {
				console.log(`No child tasks found for parent task ${options.filter.parentTaskId}.`);
			} else {
				console.log("No tasks found.");
			}
			return;
		}
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

		const getRenderableTasks = () =>
			tasks.filter((task) => task.id && task.id.trim() !== "" && task.id.startsWith("task-"));

		const emitBoardUpdate = () => {
			if (!boardUpdater) return;
			boardUpdater(getRenderableTasks(), kanbanStatuses);
		};
		let isInitialLoad = true; // Track if this is the first view load

		// Track current filter state
		const currentFilters = {
			searchQuery: options.filter?.searchQuery || "",
			statusFilter: options.filter?.status || "",
			priorityFilter: options.filter?.priority || "",
			labelFilter: options.filter?.labels || [],
		};

		// Create view switcher (without problematic onViewChange callback)
		viewSwitcher = new ViewSwitcher({
			core: options.core,
			initialState,
		});
		const watcher = watchTasks(options.core, {
			onTaskAdded(task) {
				tasks.push(task);
				const state = viewSwitcher?.getState();
				viewSwitcher?.updateState({
					tasks,
					kanbanData: state?.kanbanData ? { ...state.kanbanData, tasks } : undefined,
				});
				emitBoardUpdate();
			},
			onTaskChanged(task) {
				const idx = tasks.findIndex((t) => t.id === task.id);
				if (idx >= 0) {
					tasks[idx] = task;
				} else {
					tasks.push(task);
				}
				const state = viewSwitcher?.getState();
				viewSwitcher?.updateState({
					tasks,
					kanbanData: state?.kanbanData ? { ...state.kanbanData, tasks } : undefined,
				});
				emitBoardUpdate();
			},
			onTaskRemoved(taskId) {
				tasks = tasks.filter((t) => t.id !== taskId);
				if (selectedTask?.id === taskId) {
					selectedTask = tasks[0];
				}
				const state = viewSwitcher?.getState();
				viewSwitcher?.updateState({
					tasks,
					kanbanData: state?.kanbanData ? { ...state.kanbanData, tasks } : undefined,
				});
				emitBoardUpdate();
			},
		});
		process.on("exit", () => watcher.stop());

		const configWatcher = watchConfig(options.core, {
			onConfigChanged: (config) => {
				kanbanStatuses = config?.statuses ?? [];
				emitBoardUpdate();
			},
		});

		process.on("exit", () => configWatcher.stop());

		// Function to show task view
		const showTaskView = async (): Promise<ViewResult> => {
			const availableTasks = tasks.filter((t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"));

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
					priorityFilter: currentFilters.priorityFilter,
					labelFilter: currentFilters.labelFilter,
					startWithDetailFocus: currentView === "task-detail",
					startWithSearchFocus: shouldFocusSearch,
					onTaskChange: (newTask) => {
						selectedTask = newTask;
						currentView = "task-detail";
					},
					onFilterChange: (filters) => {
						currentFilters.searchQuery = filters.searchQuery;
						currentFilters.statusFilter = filters.statusFilter;
						currentFilters.priorityFilter = filters.priorityFilter;
						currentFilters.labelFilter = filters.labelFilter;
					},
					onTabPress,
				}).then(() => {
					// If user wants to exit, do it immediately
					if (result === "exit") {
						process.exit(0);
					}
					resolve(result);
				});
			});
		};

		// Function to show kanban view
		const showKanbanView = async (): Promise<ViewResult> => {
			// Use the already-loaded tasks - no need for separate kanban loading
			const kanbanTasks = getRenderableTasks();
			const statuses = kanbanStatuses;

			const config = await options.core.filesystem.loadConfig();
			const layout = "horizontal" as const;
			const maxColumnWidth = config?.maxColumnWidth || 20;

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
					subscribeUpdates: (updater) => {
						boardUpdater = updater;
						emitBoardUpdate();
					},
					milestoneMode: options.milestoneMode,
					milestones: options.milestones,
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
