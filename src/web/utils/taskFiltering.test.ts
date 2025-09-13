import { expect, test, describe } from "bun:test";
import type { Task } from "../../types";
import { filterTasks, getUniqueAssignees, getFilteredTaskCounts } from "./taskFiltering";

const mockTasks: Task[] = [
	{
		id: "task-1",
		title: "Fix login bug",
		status: "To Do",
		assignee: ["@john", "@alice"],
		createdDate: "2023-01-01",
		labels: ["bug", "frontend"],
		dependencies: [],
		body: "Fix the login bug in the authentication system",
		description: "Login form is not working properly",
		priority: "high",
	},
	{
		id: "task-2",
		title: "Add search feature",
		status: "In Progress",
		assignee: ["@alice"],
		createdDate: "2023-01-02",
		labels: ["feature"],
		dependencies: [],
		body: "Add search functionality to the app",
		description: "Implement search functionality for tasks",
		priority: "medium",
	},
	{
		id: "task-3",
		title: "Update documentation",
		status: "Done",
		assignee: ["@bob"],
		createdDate: "2023-01-03",
		labels: ["docs"],
		dependencies: [],
		body: "Update project documentation",
		description: "Update API documentation with new endpoints",
		priority: "low",
	},
];

describe("filterTasks", () => {
	test("should return all tasks when no filters are applied", () => {
		const result = filterTasks(mockTasks, {});
		expect(result).toEqual(mockTasks);
	});

	test("should filter by status", () => {
		const result = filterTasks(mockTasks, { status: "In Progress" });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("task-2");
	});

	test("should filter by priority", () => {
		const result = filterTasks(mockTasks, { priority: "high" });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("task-1");
	});

	test("should filter by assignee", () => {
		const result = filterTasks(mockTasks, { assignee: "@alice" });
		expect(result).toHaveLength(2);
		expect(result.map(t => t.id)).toEqual(["task-1", "task-2"]);
	});

	test("should filter by partial assignee match", () => {
		const result = filterTasks(mockTasks, { assignee: "alice" });
		expect(result).toHaveLength(2);
		expect(result.map(t => t.id)).toEqual(["task-1", "task-2"]);
	});

	test("should filter by search term in title", () => {
		const result = filterTasks(mockTasks, { search: "login" });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("task-1");
	});

	test("should filter by search term in description", () => {
		const result = filterTasks(mockTasks, { search: "functionality" });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("task-2");
	});

	test("should combine multiple filters with AND semantics", () => {
		const result = filterTasks(mockTasks, {
			status: "In Progress",
			assignee: "@alice",
			priority: "medium",
		});
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("task-2");
	});

	test("should return empty array when no tasks match all filters", () => {
		const result = filterTasks(mockTasks, {
			status: "Done",
			assignee: "@alice",
		});
		expect(result).toHaveLength(0);
	});

	test("should be case insensitive for filters", () => {
		const result = filterTasks(mockTasks, {
			status: "to do",
			priority: "HIGH",
			search: "LOGIN",
		});
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("task-1");
	});
});

describe("getUniqueAssignees", () => {
	test("should return unique assignees from tasks", () => {
		const result = getUniqueAssignees(mockTasks);
		expect(result).toEqual(["@alice", "@bob", "@john"]);
	});

	test("should return empty array when no tasks", () => {
		const result = getUniqueAssignees([]);
		expect(result).toEqual([]);
	});
});

describe("getFilteredTaskCounts", () => {
	test("should return correct counts for filtered tasks", () => {
		const result = getFilteredTaskCounts(mockTasks, {});
		expect(result.total).toBe(3);
		expect(result.byStatus).toEqual({
			"To Do": 1,
			"In Progress": 1,
			"Done": 1,
		});
		expect(result.byPriority).toEqual({
			high: 1,
			medium: 1,
			low: 1,
		});
	});

	test("should return correct counts for status filter", () => {
		const result = getFilteredTaskCounts(mockTasks, { status: "To Do" });
		expect(result.total).toBe(1);
		expect(result.byStatus).toEqual({
			"To Do": 1,
		});
	});

	test("should handle tasks without priority", () => {
		const tasksWithoutPriority: Task[] = [{
			...mockTasks[0],
			priority: undefined,
		}];
		const result = getFilteredTaskCounts(tasksWithoutPriority, {});
		expect(result.byPriority).toEqual({
			unset: 1,
		});
	});
});
