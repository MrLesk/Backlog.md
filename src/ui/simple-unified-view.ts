/**
 * Simplified unified view that manages a single screen for Tab switching
 */

import type { Core } from "../core/backlog.ts";
import type { TaskWithMetadata } from "../core/remote-tasks.ts";
import type { Task } from "../types/index.ts";
import { getTaskPath } from "../utils/task-path.ts";
import { renderBoardTui } from "./board.ts";
import { viewTaskEnhanced } from "./task-viewer.ts";
import type { ViewType } from "./view-switcher.ts";

export interface SimpleUnifiedViewOptions {
	core: Core;
	initialView: ViewType;
	selectedTask?: Task;
	tasks?: Task[];
	filter?: {
		status?: string;
		assignee?: string;
		priority?: string;
		sort?: string;
		title?: string;
		filterDescription?: string;
	};
	preloadedKanbanData?: {
		tasks: TaskWithMetadata[];
		statuses: string[];
	};
}

/**
 * Simple unified view that handles Tab switching without multiple screens
 */
export async function runSimpleUnifiedView(options: SimpleUnifiedViewOptions): Promise<void> {
	let currentView = options.initialView;
	let selectedTask = options.selectedTask;
	let isRunning = true;

	// Simple state management without complex ViewSwitcher
	const switchView = async (): Promise<void> => {
		if (!isRunning) return;

		switch (currentView) {
			case "task-list":
			case "task-detail":
				// Switch to kanban
				currentView = "kanban";
				await showKanbanBoard();
				break;
			case "kanban":
				// Always go to task-list view when switching from board, keeping selected task highlighted
				currentView = "task-list";
				await showTaskView();
				break;
		}
	};

	const showTaskView = async (): Promise<void> => {
		// Extra safeguard: filter out any tasks without proper IDs
		const validTasks = (options.tasks || []).filter((t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"));

		if (!validTasks || validTasks.length === 0) {
			console.log("No tasks available.");
			isRunning = false;
			return;
		}

		const taskToView = selectedTask || validTasks[0];
		if (!taskToView) {
			isRunning = false;
			return;
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

		// Show task viewer with simple view switching
		await viewTaskEnhanced(taskToView, content, {
			tasks: validTasks,
			core: options.core,
			title: options.filter?.title,
			filterDescription: options.filter?.filterDescription,
			startWithDetailFocus: currentView === "task-detail",
			// Use a simple callback instead of complex ViewSwitcher
			onTaskChange: (newTask) => {
				selectedTask = newTask;
				currentView = "task-detail";
			},
			// Custom Tab handler
			onTabPress: async () => {
				await switchView();
			},
		});

		isRunning = false;
	};

	const showKanbanBoard = async (): Promise<void> => {
		let kanbanTasks: TaskWithMetadata[];
		let statuses: string[];

		if (options.preloadedKanbanData) {
			// Use preloaded data but filter for valid tasks
			kanbanTasks = options.preloadedKanbanData.tasks.filter(
				(t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"),
			);
			statuses = options.preloadedKanbanData.statuses;
		} else {
			// This shouldn't happen in practice since CLI preloads, but fallback
			const validKanbanTasks = (options.tasks || []).filter(
				(t) => t.id && t.id.trim() !== "" && t.id.startsWith("task-"),
			);
			kanbanTasks = validKanbanTasks.map((t) => ({ ...t, source: "local" as const }));
			const config = await options.core.filesystem.loadConfig();
			statuses = config?.statuses || [];
		}

		const config = await options.core.filesystem.loadConfig();
		const layout = "horizontal" as const;
		const maxColumnWidth = config?.maxColumnWidth || 20;

		// Show kanban board with simple view switching
		await renderBoardTui(kanbanTasks, statuses, layout, maxColumnWidth, {
			onTaskSelect: (task) => {
				selectedTask = task;
			},
			// Custom Tab handler
			onTabPress: async () => {
				await switchView();
			},
		});

		isRunning = false;
	};

	// Start with the initial view
	switch (options.initialView) {
		case "task-list":
		case "task-detail":
			await showTaskView();
			break;
		case "kanban":
			await showKanbanBoard();
			break;
	}
}
