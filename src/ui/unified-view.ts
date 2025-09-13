/**
 * Unified view manager that handles Tab switching between task views and kanban board
 */

import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { watchTasks } from "../utils/task-watcher.ts";
import { renderBoardTui } from "./board.ts";
import { createLoadingScreen } from "./loading.ts";
import { viewTaskEnhanced } from "./task-viewer.ts";
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
	};
	preloadedKanbanData?: {
		tasks: Task[];
		statuses: string[];
	};
	watchEnabled?: boolean;
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

		// Watch state management - default enabled in TTY unless explicitly disabled
		const shouldEnableWatch = options.watchEnabled !== false && process.stdout.isTTY;
		let watchEnabled = shouldEnableWatch;
		let watcher: { stop: () => void } | null = null;

		// Create view switcher (without problematic onViewChange callback)
		viewSwitcher = new ViewSwitcher({
			core: options.core,
			initialState,
		});

		// Function to start watching
		const startWatcher = () => {
			if (watcher) return; // Already watching
			try {
				watcher = watchTasks(options.core, {
					onTaskAdded(task) {
						tasks.push(task);
						const state = viewSwitcher?.getState();
						viewSwitcher?.updateState({
							tasks,
							kanbanData: state?.kanbanData ? { ...state.kanbanData, tasks } : undefined,
						});
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
					},
				});
				watchEnabled = true;
			} catch (_error) {
				// Graceful fallback - watching unavailable
				watchEnabled = false;
				watcher = null;
			}
		};

		// Function to stop watching
		const stopWatcher = () => {
			if (watcher) {
				watcher.stop();
				watcher = null;
			}
			watchEnabled = false;
		};

		// Function to get current watch state
		const getWatchState = () => watchEnabled;

		// Function to toggle watching
		const toggleWatch = () => {
			if (watchEnabled && watcher) {
				stopWatcher();
			} else {
				startWatcher();
			}
		};

		// Start watching if enabled
		if (shouldEnableWatch) {
			startWatcher();
		}

		process.on("exit", () => {
			if (watcher) {
				watcher.stop();
			}
		});

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

			// Load task content
			let content = "";
			try {
				const filePath = await getTaskPath(taskToView.id, options.core);
				if (filePath) {
					content = await Bun.file(filePath).text();
				}
			} catch {
				// Fallback to empty content
			}

			// Show enhanced task viewer with view switching support
			return new Promise<ViewResult>((resolve) => {
				let result: ViewResult = "exit"; // Default to exit

				const onTabPress = async () => {
					result = "switch";
				};

				viewTaskEnhanced(taskToView, content, {
					tasks: availableTasks,
					core: options.core,
					title: options.filter?.title,
					filterDescription: options.filter?.filterDescription,
					startWithDetailFocus: currentView === "task-detail",
					onTaskChange: (newTask) => {
						selectedTask = newTask;
						currentView = "task-detail";
					},
					onTabPress,
					getWatchState,
					onToggleWatch: toggleWatch,
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
					getWatchState,
					onToggleWatch: toggleWatch,
				}).then(() => {
					// If user wants to exit, do it immediately
					if (result === "exit") {
						process.exit(0);
					}
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
