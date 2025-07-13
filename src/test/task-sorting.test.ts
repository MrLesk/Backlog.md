import { describe, expect, test } from "bun:test";
import { compareTaskIds, parseTaskId, sortByPriority, sortByTaskId, sortTasks } from "../utils/task-sorting.ts";

describe("parseTaskId", () => {
	test("parses simple task IDs", () => {
		expect(parseTaskId("task-1")).toEqual([1]);
		expect(parseTaskId("task-10")).toEqual([10]);
		expect(parseTaskId("task-100")).toEqual([100]);
	});

	test("parses decimal task IDs", () => {
		expect(parseTaskId("task-1.1")).toEqual([1, 1]);
		expect(parseTaskId("task-1.2.3")).toEqual([1, 2, 3]);
		expect(parseTaskId("task-10.20.30")).toEqual([10, 20, 30]);
	});

	test("handles IDs without task- prefix", () => {
		expect(parseTaskId("5")).toEqual([5]);
		expect(parseTaskId("5.1")).toEqual([5, 1]);
	});

	test("handles invalid numeric parts", () => {
		expect(parseTaskId("task-abc")).toEqual([0]);
		expect(parseTaskId("task-1.abc.2")).toEqual([2]); // Mixed numeric/non-numeric extracts trailing number
	});

	test("handles IDs with trailing numbers", () => {
		expect(parseTaskId("task-draft")).toEqual([0]);
		expect(parseTaskId("task-draft2")).toEqual([2]);
		expect(parseTaskId("task-draft10")).toEqual([10]);
		expect(parseTaskId("draft2")).toEqual([2]);
		expect(parseTaskId("abc123")).toEqual([123]);
	});
});

describe("compareTaskIds", () => {
	test("sorts simple task IDs numerically", () => {
		expect(compareTaskIds("task-2", "task-10")).toBeLessThan(0);
		expect(compareTaskIds("task-10", "task-2")).toBeGreaterThan(0);
		expect(compareTaskIds("task-5", "task-5")).toBe(0);
	});

	test("sorts decimal task IDs correctly", () => {
		expect(compareTaskIds("task-2.1", "task-2.2")).toBeLessThan(0);
		expect(compareTaskIds("task-2.2", "task-2.10")).toBeLessThan(0);
		expect(compareTaskIds("task-2.10", "task-2.2")).toBeGreaterThan(0);
	});

	test("parent tasks come before subtasks", () => {
		expect(compareTaskIds("task-2", "task-2.1")).toBeLessThan(0);
		expect(compareTaskIds("task-2.1", "task-2")).toBeGreaterThan(0);
	});

	test("handles different depth levels", () => {
		expect(compareTaskIds("task-1.1.1", "task-1.2")).toBeLessThan(0);
		expect(compareTaskIds("task-1.2", "task-1.1.1")).toBeGreaterThan(0);
	});

	test("sorts IDs with trailing numbers", () => {
		expect(compareTaskIds("task-draft", "task-draft2")).toBeLessThan(0);
		expect(compareTaskIds("task-draft2", "task-draft10")).toBeLessThan(0);
		expect(compareTaskIds("task-draft10", "task-draft2")).toBeGreaterThan(0);
	});
});

describe("sortByTaskId", () => {
	test("sorts array of tasks by ID numerically", () => {
		const tasks = [
			{ id: "task-10", title: "Task 10" },
			{ id: "task-2", title: "Task 2" },
			{ id: "task-1", title: "Task 1" },
			{ id: "task-20", title: "Task 20" },
			{ id: "task-3", title: "Task 3" },
		];

		const sorted = sortByTaskId(tasks);
		expect(sorted.map((t) => t.id)).toEqual(["task-1", "task-2", "task-3", "task-10", "task-20"]);
	});

	test("sorts tasks with decimal IDs correctly", () => {
		const tasks = [
			{ id: "task-2.10", title: "Subtask 2.10" },
			{ id: "task-2.2", title: "Subtask 2.2" },
			{ id: "task-2", title: "Task 2" },
			{ id: "task-1", title: "Task 1" },
			{ id: "task-2.1", title: "Subtask 2.1" },
		];

		const sorted = sortByTaskId(tasks);
		expect(sorted.map((t) => t.id)).toEqual(["task-1", "task-2", "task-2.1", "task-2.2", "task-2.10"]);
	});

	test("handles mixed simple and decimal IDs", () => {
		const tasks = [
			{ id: "task-10", title: "Task 10" },
			{ id: "task-2.1", title: "Subtask 2.1" },
			{ id: "task-2", title: "Task 2" },
			{ id: "task-1", title: "Task 1" },
			{ id: "task-10.1", title: "Subtask 10.1" },
			{ id: "task-3", title: "Task 3" },
		];

		const sorted = sortByTaskId(tasks);
		expect(sorted.map((t) => t.id)).toEqual(["task-1", "task-2", "task-2.1", "task-3", "task-10", "task-10.1"]);
	});

	test("preserves original array", () => {
		const tasks = [
			{ id: "task-3", title: "Task 3" },
			{ id: "task-1", title: "Task 1" },
			{ id: "task-2", title: "Task 2" },
		];

		const original = [...tasks];
		sortByTaskId(tasks);

		// Original array order should be preserved
		expect(tasks).toEqual(original);
	});
});

describe("sortByPriority", () => {
	test("sorts tasks by priority order: high > medium > low > undefined", () => {
		const tasks = [
			{ id: "task-1", priority: "low" as const },
			{ id: "task-2", priority: "high" as const },
			{ id: "task-3" }, // no priority
			{ id: "task-4", priority: "medium" as const },
			{ id: "task-5", priority: "high" as const },
		];

		const sorted = sortByPriority(tasks);
		expect(sorted.map((t) => ({ id: t.id, priority: t.priority }))).toEqual([
			{ id: "task-2", priority: "high" },
			{ id: "task-5", priority: "high" },
			{ id: "task-4", priority: "medium" },
			{ id: "task-1", priority: "low" },
			{ id: "task-3", priority: undefined },
		]);
	});

	test("sorts tasks with same priority by task ID", () => {
		const tasks = [
			{ id: "task-10", priority: "high" as const },
			{ id: "task-2", priority: "high" as const },
			{ id: "task-20", priority: "medium" as const },
			{ id: "task-1", priority: "medium" as const },
		];

		const sorted = sortByPriority(tasks);
		expect(sorted.map((t) => t.id)).toEqual(["task-2", "task-10", "task-1", "task-20"]);
	});

	test("handles all undefined priorities", () => {
		const tasks = [{ id: "task-3" }, { id: "task-1" }, { id: "task-2" }];

		const sorted = sortByPriority(tasks);
		expect(sorted.map((t) => t.id)).toEqual(["task-1", "task-2", "task-3"]);
	});

	test("preserves original array", () => {
		const tasks = [
			{ id: "task-1", priority: "low" as const },
			{ id: "task-2", priority: "high" as const },
		];

		const original = [...tasks];
		sortByPriority(tasks);

		// Original array order should be preserved
		expect(tasks).toEqual(original);
	});
});

describe("sortTasks", () => {
	test("sorts by priority when field is 'priority'", () => {
		const tasks = [
			{ id: "task-1", priority: "low" as const },
			{ id: "task-2", priority: "high" as const },
			{ id: "task-3", priority: "medium" as const },
		];

		const sorted = sortTasks(tasks, "priority");
		expect(sorted.map((t) => t.priority)).toEqual(["high", "medium", "low"]);
	});

	test("sorts by ID when field is 'id'", () => {
		const tasks = [
			{ id: "task-10", priority: "high" as const },
			{ id: "task-2", priority: "high" as const },
			{ id: "task-1", priority: "high" as const },
		];

		const sorted = sortTasks(tasks, "id");
		expect(sorted.map((t) => t.id)).toEqual(["task-1", "task-2", "task-10"]);
	});

	test("handles case-insensitive field names", () => {
		const tasks = [
			{ id: "task-1", priority: "low" as const },
			{ id: "task-2", priority: "high" as const },
		];

		const sorted = sortTasks(tasks, "PRIORITY");
		expect(sorted.map((t) => t.priority)).toEqual(["high", "low"]);
	});

	test("defaults to ID sorting for unknown fields", () => {
		const tasks = [{ id: "task-10" }, { id: "task-2" }, { id: "task-1" }];

		const sorted = sortTasks(tasks, "unknown");
		expect(sorted.map((t) => t.id)).toEqual(["task-1", "task-2", "task-10"]);
	});

	test("defaults to ID sorting for empty field", () => {
		const tasks = [{ id: "task-10" }, { id: "task-2" }];

		const sorted = sortTasks(tasks, "");
		expect(sorted.map((t) => t.id)).toEqual(["task-2", "task-10"]);
	});
});
