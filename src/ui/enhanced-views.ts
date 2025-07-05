/**
 * Enhanced views with Tab key switching between task views and kanban board
 */

import type { Core } from "../core/backlog.ts";
import type { TaskWithMetadata } from "../core/remote-tasks.ts";
import type { Task } from "../types/index.ts";
import { renderBoardTui } from "./board.ts";
import { createLoadingScreen } from "./loading.ts";
import { viewTaskEnhanced } from "./task-viewer.ts";
import { type ViewState, ViewSwitcher, type ViewType } from "./view-switcher.ts";

export interface EnhancedViewOptions {
	core: Core;
	initialView: ViewType;
	selectedTask?: Task;
	tasks?: Task[];
	filter?: {
		status?: string;
		assignee?: string;
		title?: string;
		filterDescription?: string;
	};
}

/**
 * Main enhanced view controller that handles Tab switching between views
 */
export async function runEnhancedViews(options: EnhancedViewOptions): Promise<void> {
	const initialState: ViewState = {
		type: options.initialView,
		selectedTask: options.selectedTask,
		tasks: options.tasks,
		filter: options.filter,
	};

	const currentView: (() => Promise<void>) | null = null;
	let viewSwitcher: ViewSwitcher | null = null;

	// Create view switcher with state change handler
	viewSwitcher = new ViewSwitcher({
		core: options.core,
		initialState,
		onViewChange: async (newState) => {
			// Handle view changes triggered by the switcher
			await switchToView(newState);
		},
	});

	// Function to switch to a specific view
	const switchToView = async (state: ViewState): Promise<void> => {
		switch (state.type) {
			case "task-list":
			case "task-detail":
				await switchToTaskView(state);
				break;
			case "kanban":
				await switchToKanbanView(state);
				break;
		}
	};

	// Function to handle switching to task view
	const switchToTaskView = async (state: ViewState): Promise<void> => {
		if (!state.tasks || state.tasks.length === 0) {
			console.log("No tasks available.");
			return;
		}

		const taskToView = state.selectedTask || state.tasks[0];
		if (!taskToView) return;

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

		// Create enhanced task viewer with Tab switching
		await viewTaskEnhancedWithSwitching(taskToView, content, {
			tasks: state.tasks,
			core: options.core,
			title: state.filter?.title,
			filterDescription: state.filter?.filterDescription,
			startWithDetailFocus: state.type === "task-detail",
			viewSwitcher,
			onTaskChange: (newTask) => {
				// Update state when user navigates to different task
				viewSwitcher?.updateState({
					selectedTask: newTask,
					type: newTask ? "task-detail" : "task-list",
				});
			},
		});
	};

	// Function to handle switching to kanban view
	const switchToKanbanView = async (state: ViewState): Promise<void> => {
		if (!state.kanbanData) return;

		if (state.kanbanData.isLoading) {
			// Show loading screen while waiting for data
			const loadingScreen = await createLoadingScreen("Loading kanban board");

			try {
				// Wait for kanban data to load
				const { tasks, statuses } = await viewSwitcher!.getKanbanData();
				loadingScreen?.close();

				// Now show the kanban board
				await renderBoardTuiWithSwitching(tasks, statuses, {
					viewSwitcher,
					onTaskSelect: (task) => {
						// When user selects a task in kanban, prepare for potential switch back
						viewSwitcher?.updateState({
							selectedTask: task,
						});
					},
				});
			} catch (error) {
				loadingScreen?.close();
				console.error("Failed to load kanban data:", error);
			}
		} else if (state.kanbanData.loadError) {
			console.error("Error loading kanban board:", state.kanbanData.loadError);
		} else {
			// Data is ready, show kanban board immediately
			await renderBoardTuiWithSwitching(state.kanbanData.tasks, state.kanbanData.statuses, {
				viewSwitcher,
				onTaskSelect: (task) => {
					viewSwitcher?.updateState({
						selectedTask: task,
					});
				},
			});
		}
	};

	// Start with the initial view
	await switchToView(initialState);
}

/**
 * Enhanced task viewer that supports view switching
 */
async function viewTaskEnhancedWithSwitching(
	task: Task,
	content: string,
	options: {
		tasks?: Task[];
		core: Core;
		title?: string;
		filterDescription?: string;
		startWithDetailFocus?: boolean;
		viewSwitcher?: ViewSwitcher;
		onTaskChange?: (task: Task) => void;
	},
): Promise<void> {
	// Import the original viewTaskEnhanced function
	const { viewTaskEnhanced } = await import("./task-viewer.ts");

	// For now, use the original function but we'll need to modify it to support Tab switching
	// This is a placeholder - we'll need to modify the actual task-viewer.ts
	return viewTaskEnhanced(task, content, {
		tasks: options.tasks,
		core: options.core,
		title: options.title,
		filterDescription: options.filterDescription,
		startWithDetailFocus: options.startWithDetailFocus,
		// Add view switcher support
		viewSwitcher: options.viewSwitcher,
		onTaskChange: options.onTaskChange,
	});
}

/**
 * Enhanced kanban board that supports view switching
 */
async function renderBoardTuiWithSwitching(
	tasks: TaskWithMetadata[],
	statuses: string[],
	options: {
		viewSwitcher?: ViewSwitcher;
		onTaskSelect?: (task: Task) => void;
	},
): Promise<void> {
	// Get config for layout and column width
	const core = new (await import("../core/backlog.ts")).Core(process.cwd());
	const config = await core.filesystem.loadConfig();
	const layout = "horizontal" as const; // Default layout
	const maxColumnWidth = config?.maxColumnWidth || 20;

	// For now, use the original function but we'll need to modify it to support Tab switching
	// This is a placeholder - we'll need to modify the actual board.ts
	return renderBoardTui(tasks, statuses, layout, maxColumnWidth);
}

// Re-export for convenience
export { type ViewState, ViewSwitcher, type ViewType } from "./view-switcher.ts";

// Helper function import
import { getTaskPath } from "../utils/task-path.ts";
