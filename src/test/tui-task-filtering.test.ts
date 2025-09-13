import { expect, test } from "bun:test";
import type { Task } from "../types";

/**
 * Filter state interface for task list filters
 */
interface TaskFilters {
	status?: string;
	priority?: "high" | "medium" | "low";
}

/**
 * Apply filters to task list (extracted logic from task-viewer.ts)
 */
function applyFilters(allTasks: Task[], currentFilters: TaskFilters): Task[] {
	return allTasks.filter((task) => {
		// Status filter
		if (currentFilters.status && task.status !== currentFilters.status) {
			return false;
		}
		// Priority filter
		if (currentFilters.priority && task.priority !== currentFilters.priority) {
			return false;
		}
		return true;
	});
}

// Mock task data for testing
const mockTasks: Task[] = [
	{
		id: "task-1",
		title: "First task",
		status: "To Do",
		priority: "high",
		createdDate: "2024-01-01",
		assignee: ["@dev1"],
		labels: ["backend"],
		dependencies: [],
		body: "First task description",
	},
	{
		id: "task-2",
		title: "Second task",
		status: "In Progress",
		priority: "medium",
		createdDate: "2024-01-02",
		assignee: ["@dev2"],
		labels: ["frontend"],
		dependencies: [],
		body: "Second task description",
	},
	{
		id: "task-3",
		title: "Third task",
		status: "Done",
		priority: "low",
		createdDate: "2024-01-03",
		assignee: ["@dev1"],
		labels: ["docs"],
		dependencies: [],
		body: "Third task description",
	},
	{
		id: "task-4",
		title: "Fourth task",
		status: "To Do",
		priority: "high",
		createdDate: "2024-01-04",
		assignee: ["@dev3"],
		labels: ["testing"],
		dependencies: [],
		body: "Fourth task description",
	},
	{
		id: "task-5",
		title: "Fifth task",
		status: "In Progress",
		priority: undefined,
		createdDate: "2024-01-05",
		assignee: ["@dev2"],
		labels: ["backend"],
		dependencies: [],
		body: "Fifth task description",
	},
];

test("TUI filtering - no filters returns all tasks", () => {
	const filters: TaskFilters = {};
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(5);
	expect(result).toEqual(mockTasks);
});

test("TUI filtering - status filter works correctly", () => {
	const filters: TaskFilters = { status: "To Do" };
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(2);
	expect(result.every((task) => task.status === "To Do")).toBe(true);
	expect(result.map((t) => t.id)).toEqual(["task-1", "task-4"]);
});

test("TUI filtering - priority filter works correctly", () => {
	const filters: TaskFilters = { priority: "high" };
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(2);
	expect(result.every((task) => task.priority === "high")).toBe(true);
	expect(result.map((t) => t.id)).toEqual(["task-1", "task-4"]);
});

test("TUI filtering - combined status and priority filters", () => {
	const filters: TaskFilters = { status: "To Do", priority: "high" };
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(2);
	expect(result.every((task) => task.status === "To Do" && task.priority === "high")).toBe(true);
	expect(result.map((t) => t.id)).toEqual(["task-1", "task-4"]);
});

test("TUI filtering - filters with no matching tasks", () => {
	const filters: TaskFilters = { status: "Cancelled", priority: "high" };
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(0);
});

test("TUI filtering - priority filter handles undefined priority", () => {
	const filters: TaskFilters = { priority: "medium" };
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(1);
	expect(result[0]?.id).toBe("task-2");
	expect(result[0]?.priority).toBe("medium");
});

test("TUI filtering - tasks with no priority are excluded from priority filters", () => {
	const filters: TaskFilters = { priority: "low" };
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(1);
	expect(result[0]?.id).toBe("task-3");
	expect(result[0]?.priority).toBe("low");

	// Task 5 has no priority, so it shouldn't appear in any priority filter
	const highPriorityResult = applyFilters(mockTasks, { priority: "high" });
	expect(highPriorityResult.some((task) => task.id === "task-5")).toBe(false);
});

test("TUI filtering - status filter is case sensitive", () => {
	const filters: TaskFilters = { status: "to do" }; // lowercase
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(0); // Should not match "To Do"
});

test("TUI filtering - status filter with exact match", () => {
	const filters: TaskFilters = { status: "In Progress" };
	const result = applyFilters(mockTasks, filters);

	expect(result).toHaveLength(2);
	expect(result.every((task) => task.status === "In Progress")).toBe(true);
	expect(result.map((t) => t.id)).toEqual(["task-2", "task-5"]);
});
