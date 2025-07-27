import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { computeSequences } from "./sequences.ts";

// Helper function to create a test task
function createTask(id: string, dependencies: string[] = []): Task {
	return {
		id,
		title: `Task ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies,
		body: "",
		acceptanceCriteria: [],
	};
}

describe("computeSequences", () => {
	it("should return empty array for empty task list", () => {
		const result = computeSequences([]);
		expect(result).toEqual([]);
	});

	it("should put all tasks with no dependencies in sequence 1", () => {
		const tasks = [createTask("task-1"), createTask("task-2"), createTask("task-3")];

		const result = computeSequences(tasks);

		expect(result).toHaveLength(1);
		expect(result[0]?.number).toBe(1);
		expect(result[0]?.tasks).toHaveLength(3);
		expect(result[0]?.tasks.map((t) => t.id).sort()).toEqual(["task-1", "task-2", "task-3"]);
	});

	it("should handle simple linear chain (A→B→C)", () => {
		const tasks = [createTask("task-1"), createTask("task-2", ["task-1"]), createTask("task-3", ["task-2"])];

		const result = computeSequences(tasks);

		expect(result).toHaveLength(3);

		expect(result[0]?.number).toBe(1);
		expect(result[0]?.tasks).toHaveLength(1);
		expect(result[0]?.tasks[0]?.id).toBe("task-1");

		expect(result[1]?.number).toBe(2);
		expect(result[1]?.tasks).toHaveLength(1);
		expect(result[1]?.tasks[0]?.id).toBe("task-2");

		expect(result[2]?.number).toBe(3);
		expect(result[2]?.tasks).toHaveLength(1);
		expect(result[2]?.tasks[0]?.id).toBe("task-3");
	});

	it("should handle parallel branches (A→B, A→C)", () => {
		const tasks = [createTask("task-1"), createTask("task-2", ["task-1"]), createTask("task-3", ["task-1"])];

		const result = computeSequences(tasks);

		expect(result).toHaveLength(2);

		const firstSeq = result[0];
		expect(firstSeq?.number).toBe(1);
		expect(firstSeq?.tasks).toHaveLength(1);
		expect(firstSeq?.tasks[0]?.id).toBe("task-1");

		const secondSeq = result[1];
		expect(secondSeq?.number).toBe(2);
		expect(secondSeq?.tasks).toHaveLength(2);
		expect(secondSeq?.tasks.map((t) => t.id).sort()).toEqual(["task-2", "task-3"]);
	});

	it("should handle diamond dependency (A→B, A→C, B→D, C→D)", () => {
		const tasks = [
			createTask("task-1"),
			createTask("task-2", ["task-1"]),
			createTask("task-3", ["task-1"]),
			createTask("task-4", ["task-2", "task-3"]),
		];

		const result = computeSequences(tasks);

		expect(result).toHaveLength(3);

		const seq1 = result[0];
		expect(seq1?.number).toBe(1);
		expect(seq1?.tasks).toHaveLength(1);
		expect(seq1?.tasks[0]?.id).toBe("task-1");

		const seq2 = result[1];
		expect(seq2?.number).toBe(2);
		expect(seq2?.tasks).toHaveLength(2);
		expect(seq2?.tasks.map((t) => t.id).sort()).toEqual(["task-2", "task-3"]);

		const seq3 = result[2];
		expect(seq3?.number).toBe(3);
		expect(seq3?.tasks).toHaveLength(1);
		expect(seq3?.tasks[0]?.id).toBe("task-4");
	});

	it("should handle complex dependency graph", () => {
		const tasks = [
			createTask("task-1"),
			createTask("task-2"),
			createTask("task-3", ["task-1"]),
			createTask("task-4", ["task-1", "task-2"]),
			createTask("task-5", ["task-3"]),
			createTask("task-6", ["task-4"]),
			createTask("task-7", ["task-5", "task-6"]),
		];

		const result = computeSequences(tasks);

		expect(result).toHaveLength(4);

		// Sequence 1: task-1, task-2 (no dependencies)
		const r0 = result[0];
		expect(r0?.number).toBe(1);
		expect(r0?.tasks.map((t) => t.id).sort()).toEqual(["task-1", "task-2"]);

		// Sequence 2: task-3, task-4 (depend on sequence 1)
		const r1 = result[1];
		expect(r1?.number).toBe(2);
		expect(r1?.tasks.map((t) => t.id).sort()).toEqual(["task-3", "task-4"]);

		// Sequence 3: task-5, task-6 (depend on sequence 2)
		const r2 = result[2];
		expect(r2?.number).toBe(3);
		expect(r2?.tasks.map((t) => t.id).sort()).toEqual(["task-5", "task-6"]);

		// Sequence 4: task-7 (depends on sequence 3)
		const r3 = result[3];
		expect(r3?.number).toBe(4);
		expect(r3?.tasks.map((t) => t.id)).toEqual(["task-7"]);
	});

	it("should detect circular dependencies", () => {
		const tasks = [
			createTask("task-1", ["task-3"]),
			createTask("task-2", ["task-1"]),
			createTask("task-3", ["task-2"]),
		];

		expect(() => computeSequences(tasks)).toThrow("Circular dependencies detected");
	});

	it("should ignore dependencies on non-existent tasks", () => {
		const tasks = [
			createTask("task-1"),
			createTask("task-2", ["task-1", "task-999"]), // task-999 doesn't exist
		];

		const result = computeSequences(tasks);

		expect(result).toHaveLength(2);

		const res0 = result[0];
		const res1 = result[1];
		expect(res0?.number).toBe(1);
		expect(res0?.tasks[0]?.id).toBe("task-1");

		expect(res1?.number).toBe(2);
		expect(res1?.tasks[0]?.id).toBe("task-2");
	});

	it("should handle self-dependencies gracefully", () => {
		const tasks = [
			createTask("task-1"),
			createTask("task-2", ["task-2"]), // Self-dependency (circular)
		];

		expect(() => computeSequences(tasks)).toThrow("Circular dependencies detected");
	});

	it("should maintain consistent task ordering within sequences", () => {
		const tasks = [createTask("task-3"), createTask("task-1"), createTask("task-2")];

		const result = computeSequences(tasks);

		expect(result).toHaveLength(1);
		expect(result[0]?.tasks.map((t) => t.id)).toEqual(["task-1", "task-2", "task-3"]);
	});

	it("should handle tasks with multiple dependencies at different levels", () => {
		const tasks = [
			createTask("task-1"),
			createTask("task-2", ["task-1"]),
			createTask("task-3", ["task-1"]),
			createTask("task-4", ["task-2"]),
			createTask("task-5", ["task-1", "task-4"]), // Dependencies from level 1 and 3
		];

		const result = computeSequences(tasks);

		// task-5 should be at level 4 (max dependency level + 1)
		const task5Sequence = result.find((seq) => seq.tasks.some((t) => t.id === "task-5"));
		expect(task5Sequence?.number).toBe(4);
	});
});
