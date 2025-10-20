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
	title?: string;
	filter?: {
		status?: string;
		assignee?: string;
		priority?: string;
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
}

type ViewResult = "switch" | "exit";

/**
 * Main unified view controller that handles Tab switching between views
 */
export async function runUnifiedView(options: UnifiedViewOptions): Promise<void> {
	try {
		const baseTasks = (options.tasks || options.preloadedKanbanData?.tasks || []).filter(
			(t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"),
		);
		const initialState: ViewState = {
			type: options.initialView,
			selectedTask: options.selectedTask,
			tasks: baseTasks,
			filter: options.filter,
			// Initialize kanban data if starting with kanban view
			kanbanData:
				options.initialView === "kanban"
					? options.preloadedKanbanData
						? {
								tasks: options.preloadedKanbanData.tasks.filter(
									(t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"),
								),
								statuses: options.preloadedKanbanData.statuses,
								isLoading: false, // Data is already loaded!
							}
						: {
								tasks: [],
								statuses: [],
								isLoading: true,
							}
					: undefined,
		};

		let isRunning = true;
		let viewSwitcher: ViewSwitcher | null = null;
		let currentView: ViewType = options.initialView;
		let selectedTask: Task | undefined = options.selectedTask;
		let tasks = baseTasks;
		let kanbanStatuses = options.preloadedKanbanData?.statuses ?? [];
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
			let kanbanTasks: Task[];
			let statuses: string[];

			if (options.preloadedKanbanData) {
				// Use preloaded data but filter for valid tasks
				kanbanTasks = options.preloadedKanbanData.tasks.filter(
					(t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"),
				);
				statuses = options.preloadedKanbanData.statuses;
			} else {
				// Fallback: use existing tasks or load from ViewSwitcher
				if (viewSwitcher) {
					// Check if data is ready for instant switching
					if (!viewSwitcher.isKanbanReady()) {
						// Show loading screen while fetching data
						const loadingScreen = await createLoadingScreen("Loading board");
						try {
							// Set progress callback to update loading screen BEFORE calling getKanbanData
							viewSwitcher.setProgressCallback((message) => {
								loadingScreen?.update(message);
							});
							const kanbanData = await viewSwitcher.getKanbanData();
							kanbanTasks = kanbanData.tasks;
							statuses = kanbanData.statuses;
						} catch (error) {
							console.error("Failed to load kanban data:", error);
							return "exit";
						} finally {
							await loadingScreen?.close();
						}
					} else {
						// Data is ready, get it without loading screen
						try {
							const kanbanData = await viewSwitcher.getKanbanData();
							kanbanTasks = kanbanData.tasks;
							statuses = kanbanData.statuses;
						} catch (error) {
							console.error("Failed to load kanban data:", error);
							return "exit";
						}
					}
				} else {
					kanbanTasks = options.tasks || [];
					const config = await options.core.filesystem.loadConfig();
					statuses = config?.statuses || [];
				}
			}

			kanbanStatuses = [...statuses];
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
		console.error("Error in unified view:", error);
		process.exit(1);
	}
}
