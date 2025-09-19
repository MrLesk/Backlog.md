import { describe, expect, it } from "bun:test";
import { computeSequences } from "../core/sequences.ts";
import type { Task } from "../types/index.ts";

function task(id: string, deps: string[] = []): Task {
	return {
		id,
		title: id,
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: deps,
		rawContent: "## Description\n\nTest",
	};
}

describe("computeSequences (with Unsequenced)", () => {
	function mustGet<T>(arr: T[], idx: number): T {
		const v = arr[idx];
		if (v === undefined) throw new Error(`expected element at index ${idx}`);
		return v;
	}
	it("puts isolated tasks into Unsequenced bucket", () => {
		const tasks = [task("task-1"), task("task-2"), task("task-3")];
		const res = computeSequences(tasks);
		expect(res.sequences.length).toBe(0);
		expect(res.unsequenced.map((t) => t.id)).toEqual(["task-1", "task-2", "task-3"]);
	});

	it("handles a simple chain A -> B -> C", () => {
		const tasks = [task("task-1"), task("task-2", ["task-1"]), task("task-3", ["task-2"])];
		const res = computeSequences(tasks);
		expect(res.sequences.length).toBe(3);
		expect(mustGet(res.sequences, 0).tasks.map((t) => t.id)).toEqual(["task-1"]);
		expect(mustGet(res.sequences, 1).tasks.map((t) => t.id)).toEqual(["task-2"]);
		expect(mustGet(res.sequences, 2).tasks.map((t) => t.id)).toEqual(["task-3"]);
	});

	it("groups parallel branches (A -> C, B -> C) into same sequence", () => {
		const tasks = [task("task-1"), task("task-2"), task("task-3", ["task-1", "task-2"])];
		const res = computeSequences(tasks);
		expect(res.sequences.length).toBe(2);
		// First layer contains 1 and 2 in id order
		expect(mustGet(res.sequences, 0).tasks.map((t) => t.id)).toEqual(["task-1", "task-2"]);
		// Second layer contains 3
		expect(mustGet(res.sequences, 1).tasks.map((t) => t.id)).toEqual(["task-3"]);
	});

	it("handles a more complex graph", () => {
		// 1,2 -> 4 ; 3 -> 5 -> 6
		const tasks = [
			task("task-1"),
			task("task-2"),
			task("task-3"),
			task("task-4", ["task-1", "task-2"]),
			task("task-5", ["task-3"]),
			task("task-6", ["task-5"]),
		];
		const res = computeSequences(tasks);
		expect(res.sequences.length).toBe(3);
		expect(mustGet(res.sequences, 0).tasks.map((t) => t.id)).toEqual(["task-1", "task-2", "task-3"]);
		// Second layer should include 4 and 5 (order by id)
		expect(mustGet(res.sequences, 1).tasks.map((t) => t.id)).toEqual(["task-4", "task-5"]);
		// Final layer 6
		expect(mustGet(res.sequences, 2).tasks.map((t) => t.id)).toEqual(["task-6"]);
	});

	it("ignores external dependencies not present in the task set", () => {
		const tasks = [task("task-1", ["task-999"])];
		const res = computeSequences(tasks);
		expect(res.sequences.length).toBe(1);
		expect(mustGet(res.sequences, 0).tasks.map((t) => t.id)).toEqual(["task-1"]);
	});
});
