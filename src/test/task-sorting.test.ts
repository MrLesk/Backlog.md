import { describe, expect, test } from "bun:test";
import { compareTaskIds, parseTaskId, sortByTaskId } from "../utils/task-sorting.ts";

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
		expect(parseTaskId("task-1.abc.2")).toEqual([1, 0, 2]);
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
