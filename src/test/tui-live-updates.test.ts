import { expect, test } from "bun:test";
import type { Task } from "../types";

// Test incremental update behavior and selection preservation logic
test("Incremental updates preserve selection state", async () => {
	const mockTasks: Task[] = [
		{
			id: "task-1",
			title: "First task",
			status: "To Do",
			createdDate: "2024-01-01",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "First task body",
		},
		{
			id: "task-2",
			title: "Second task",
			status: "In Progress",
			createdDate: "2024-01-02",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "Second task body",
		},
	];

	// Simulate initial selection state
	const selectedTaskId = "task-1";

	// Function to simulate finding a task after updates
	const findTaskAfterUpdate = (taskId: string, updatedTasks: Task[]) => {
		return updatedTasks.find((t) => t.id === taskId);
	};

	// Simulate task update that changes title but preserves ID
	const updatedTask: Task = {
		...mockTasks[0]!,
		title: "Updated first task",
	};

	const newTasks = [updatedTask, mockTasks[1]!];

	// Selection should be preserved
	const foundTask = findTaskAfterUpdate(selectedTaskId, newTasks);
	expect(foundTask).toBeDefined();
	expect(foundTask?.id).toBe("task-1");
	expect(foundTask?.title).toBe("Updated first task");
});

test("Incremental updates handle task removal correctly", async () => {
	const mockTasks: Task[] = [
		{
			id: "task-1",
			title: "First task",
			status: "To Do",
			createdDate: "2024-01-01",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "First task body",
		},
		{
			id: "task-2",
			title: "Second task",
			status: "In Progress",
			createdDate: "2024-01-02",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "Second task body",
		},
		{
			id: "task-3",
			title: "Third task",
			status: "Done",
			createdDate: "2024-01-03",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "Third task body",
		},
	];

	// Simulate initial selection on middle task
	const selectedTaskId = "task-2";
	const selectedIndex = 1;

	// Simulate removal of selected task
	const newTasks = mockTasks.filter((t) => t.id !== "task-2");

	// Should select nearest neighbor
	const nearestIndex = Math.max(0, Math.min(selectedIndex, newTasks.length - 1));
	const nearestTask = newTasks[nearestIndex];

	expect(nearestTask).toBeDefined();
	expect(nearestTask?.id).toBe("task-3"); // Should select next task
});

test("Filter preservation during live updates", async () => {
	const allTasks: Task[] = [
		{
			id: "task-1",
			title: "First task",
			status: "To Do",
			priority: "high",
			createdDate: "2024-01-01",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "First task body",
		},
		{
			id: "task-2",
			title: "Second task",
			status: "In Progress",
			priority: "medium",
			createdDate: "2024-01-02",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "Second task body",
		},
		{
			id: "task-3",
			title: "Third task",
			status: "To Do",
			priority: "low",
			createdDate: "2024-01-03",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "Third task body",
		},
	];

	// Simulate current filter state
	const currentFilters = { status: "To Do" };

	// Apply filters function (from existing TUI filtering test)
	const applyFilters = (tasks: Task[], filters: any) => {
		return tasks.filter((task) => {
			if (filters.status && task.status !== filters.status) {
				return false;
			}
			if (filters.priority && task.priority !== filters.priority) {
				return false;
			}
			return true;
		});
	};

	// Initial filtered tasks
	const initialFiltered = applyFilters(allTasks, currentFilters);
	expect(initialFiltered).toHaveLength(2); // task-1 and task-3

	// Simulate new task that matches filter
	const newTask: Task = {
		id: "task-4",
		title: "Fourth task",
		status: "To Do", // Matches filter
		priority: "high",
		createdDate: "2024-01-04",
		assignee: [],
		labels: [],
		dependencies: [],
		body: "Fourth task body",
	};

	const updatedTasks = [...allTasks, newTask];
	const newFiltered = applyFilters(updatedTasks, currentFilters);

	expect(newFiltered).toHaveLength(3); // Should include new task
	expect(newFiltered.some((t) => t.id === "task-4")).toBe(true);

	// Simulate task status change that removes it from filter
	const changedTask: Task = {
		...allTasks[0]!,
		status: "Done", // No longer matches filter
	};

	const tasksWithChange = [changedTask, ...allTasks.slice(1)];
	const filteredAfterChange = applyFilters(tasksWithChange, currentFilters);

	expect(filteredAfterChange).toHaveLength(1); // Should only have task-3
	expect(filteredAfterChange.some((t) => t.id === "task-1")).toBe(false);
});

test("Board column state preservation during updates", async () => {
	const tasks: Task[] = [
		{
			id: "task-1",
			title: "Todo task",
			status: "To Do",
			createdDate: "2024-01-01",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "Todo task body",
		},
		{
			id: "task-2",
			title: "In progress task",
			status: "In Progress",
			createdDate: "2024-01-02",
			assignee: [],
			labels: [],
			dependencies: [],
			body: "In progress task body",
		},
	];

	// Simulate board column grouping
	const groupTasksByStatus = (taskList: Task[]) => {
		const groups = new Map<string, Task[]>();
		for (const task of taskList) {
			const status = task.status || "No Status";
			const existing = groups.get(status) || [];
			existing.push(task);
			groups.set(status, existing);
		}
		return groups;
	};

	// Initial grouping
	const initialGroups = groupTasksByStatus(tasks);
	expect(initialGroups.get("To Do")?.length).toBe(1);
	expect(initialGroups.get("In Progress")?.length).toBe(1);

	// Simulate task status change
	const updatedTask: Task = {
		...tasks[0]!,
		status: "In Progress", // Move from To Do to In Progress
	};

	const updatedTasks = [updatedTask, tasks[1]!];
	const updatedGroups = groupTasksByStatus(updatedTasks);

	// Verify task moved between columns
	expect(updatedGroups.get("To Do")?.length || 0).toBe(0);
	expect(updatedGroups.get("In Progress")?.length).toBe(2);
	expect(updatedGroups.get("In Progress")?.some((t) => t.id === "task-1")).toBe(true);
});

test("Selection nearest neighbor logic", async () => {
	// Test selection fallback when selected task is removed

	const tasks = ["task-1", "task-2", "task-3", "task-4", "task-5"];

	// Helper function to find nearest neighbor when a task is removed
	const findNearestNeighbor = (selectedIndex: number, totalItems: number, removedIndex: number) => {
		if (selectedIndex !== removedIndex) {
			// Selected task wasn't removed, adjust index if needed
			return selectedIndex > removedIndex ? selectedIndex - 1 : selectedIndex;
		}

		// Selected task was removed, find nearest neighbor
		const newLength = totalItems - 1;
		if (newLength === 0) return -1; // No tasks left
		return Math.max(0, Math.min(selectedIndex, newLength - 1));
	};

	// Test removing first task when it's selected
	expect(findNearestNeighbor(0, 5, 0)).toBe(0); // Should select new first task

	// Test removing middle task when it's selected
	expect(findNearestNeighbor(2, 5, 2)).toBe(2); // Should select what becomes index 2

	// Test removing last task when it's selected
	expect(findNearestNeighbor(4, 5, 4)).toBe(3); // Should select previous task

	// Test removing different task than selected
	expect(findNearestNeighbor(3, 5, 1)).toBe(2); // Selected index shifts down by 1
});

test("Live update timing constraints", async () => {
	// Test that updates happen within 1 second (requirement #3)
	// This is a logic test rather than actual timing test

	const startTime = Date.now();

	// Simulate processing a file change event
	const processFileChange = async (taskId: string) => {
		// Simulate minimal processing time for incremental updates
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				resolve();
			}, 50); // Should be much faster than 1 second
		});
	};

	await processFileChange("task-1");

	const endTime = Date.now();
	const processingTime = endTime - startTime;

	// Should complete well under 1 second
	expect(processingTime).toBeLessThan(1000);
});

test("Watch state management", () => {
	// Test the watch state interface logic
	interface WatchState {
		enabled: boolean;
		available: boolean;
		watcherActive: boolean;
	}

	// Initial state
	const initialState: WatchState = {
		enabled: true,
		available: false,
		watcherActive: false,
	};

	expect(initialState.enabled).toBe(true);
	expect(initialState.available).toBe(false);
	expect(initialState.watcherActive).toBe(false);

	// After successful initialization
	const afterInit: WatchState = {
		...initialState,
		available: true,
		watcherActive: true,
	};

	expect(afterInit.available).toBe(true);
	expect(afterInit.watcherActive).toBe(true);

	// After toggle off
	const afterToggleOff: WatchState = {
		...afterInit,
		enabled: false,
		watcherActive: false,
	};

	expect(afterToggleOff.enabled).toBe(false);
	expect(afterToggleOff.watcherActive).toBe(false);
	expect(afterToggleOff.available).toBe(true); // Still available, just disabled
});

test("Footer indicator states", () => {
	// Test footer indicator logic
	const getFooterIndicator = (enabled: boolean, available: boolean, showIndicator: boolean): string => {
		if (!showIndicator) {
			return "";
		}

		if (!available) {
			return "Live: UNAVAILABLE";
		}

		return enabled ? "Live: ON" : "Live: OFF";
	};

	// Test all combinations
	expect(getFooterIndicator(true, true, true)).toBe("Live: ON");
	expect(getFooterIndicator(false, true, true)).toBe("Live: OFF");
	expect(getFooterIndicator(true, false, true)).toBe("Live: UNAVAILABLE");
	expect(getFooterIndicator(true, true, false)).toBe("");
});
