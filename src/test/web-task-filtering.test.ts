import { expect, test } from "bun:test";
import type { Task } from "../types";

// Mock tasks for testing
const mockTasks: Task[] = [
	{
		id: "task-1",
		title: "Implement user authentication",
		status: "To Do",
		priority: "high",
		description: "Add login and registration functionality",
		createdDate: "2024-01-01",
		assignee: ["@developer"],
		labels: ["backend", "auth"],
	},
	{
		id: "task-2",
		title: "Fix database connection bug",
		status: "In Progress",
		priority: "high",
		description: "Database timeout issues need fixing",
		createdDate: "2024-01-02",
		assignee: ["@developer"],
		labels: ["backend", "bugfix"],
	},
	{
		id: "task-3",
		title: "Update documentation",
		status: "Done",
		priority: "low",
		description: "Update API documentation with new endpoints",
		createdDate: "2024-01-03",
		assignee: ["@writer"],
		labels: ["docs"],
	},
	{
		id: "task-4",
		title: "Refactor user interface",
		status: "To Do",
		priority: "medium",
		description: "Improve UI components and styling",
		createdDate: "2024-01-04",
		assignee: ["@designer"],
		labels: ["frontend", "ui"],
	},
];

// Helper function to simulate the filtering logic from TaskList component
function filterTasks(
	tasks: Task[],
	filters: { status: string; priority: string; textSearch: string },
	showDoneTasks: boolean,
): Task[] {
	let filtered = [...tasks];

	// Apply status filter
	if (filters.status) {
		filtered = filtered.filter((task) => task.status.toLowerCase() === filters.status.toLowerCase());
	}

	// Apply priority filter
	if (filters.priority) {
		filtered = filtered.filter((task) => task.priority?.toLowerCase() === filters.priority.toLowerCase());
	}

	// Apply text search (title and description)
	if (filters.textSearch) {
		const searchTerm = filters.textSearch.toLowerCase();
		filtered = filtered.filter(
			(task) =>
				task.title.toLowerCase().includes(searchTerm) ||
				(task.description && task.description.toLowerCase().includes(searchTerm)),
		);
	}

	// Apply done tasks toggle
	if (!showDoneTasks) {
		filtered = filtered.filter((task) => task.status.toLowerCase() !== "done");
	}

	return filtered;
}

test("should filter tasks by status", () => {
	const filters = { status: "To Do", priority: "", textSearch: "" };
	const result = filterTasks(mockTasks, filters, true);

	expect(result).toHaveLength(2);
	expect(result.every((task) => task.status === "To Do")).toBe(true);
});

test("should filter tasks by priority", () => {
	const filters = { status: "", priority: "high", textSearch: "" };
	const result = filterTasks(mockTasks, filters, true);

	expect(result).toHaveLength(2);
	expect(result.every((task) => task.priority === "high")).toBe(true);
});

test("should filter tasks by text search in title", () => {
	const filters = { status: "", priority: "", textSearch: "authentication" };
	const result = filterTasks(mockTasks, filters, true);

	expect(result).toHaveLength(1);
	expect(result[0].title).toContain("authentication");
});

test("should filter tasks by text search in description", () => {
	const filters = { status: "", priority: "", textSearch: "database" };
	const result = filterTasks(mockTasks, filters, true);

	expect(result).toHaveLength(1);
	expect(result[0].description).toContain("Database");
});

test("should combine filters with AND logic", () => {
	const filters = { status: "To Do", priority: "high", textSearch: "" };
	const result = filterTasks(mockTasks, filters, true);

	expect(result).toHaveLength(1);
	expect(result[0].status).toBe("To Do");
	expect(result[0].priority).toBe("high");
});

test("should hide done tasks by default", () => {
	const filters = { status: "", priority: "", textSearch: "" };
	const result = filterTasks(mockTasks, filters, false); // showDoneTasks = false

	expect(result).toHaveLength(3); // Should exclude the "Done" task
	expect(result.every((task) => task.status !== "Done")).toBe(true);
});

test("should show done tasks when toggle is enabled", () => {
	const filters = { status: "", priority: "", textSearch: "" };
	const result = filterTasks(mockTasks, filters, true); // showDoneTasks = true

	expect(result).toHaveLength(4); // Should include all tasks
	expect(result.some((task) => task.status === "Done")).toBe(true);
});

test("should return empty array when no tasks match filters", () => {
	const filters = { status: "Nonexistent", priority: "", textSearch: "" };
	const result = filterTasks(mockTasks, filters, true);

	expect(result).toHaveLength(0);
});

test("should handle case-insensitive filtering", () => {
	const filters = { status: "in progress", priority: "", textSearch: "" };
	const result = filterTasks(mockTasks, filters, true);

	expect(result).toHaveLength(1);
	expect(result[0].status).toBe("In Progress");
});
