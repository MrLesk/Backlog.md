import { describe, expect, it } from "bun:test";
import { reorderWithinSequence } from "../core/sequences.ts";
import type { Task } from "../types/index.ts";

function t(id: string, ordinal?: number): Task {
	return {
		id,
		title: id,
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		body: "Test",
		...(ordinal !== undefined ? { ordinal } : {}),
	};
}

describe("reorderWithinSequence", () => {
	it("reassigns ordinals within a sequence and leaves others untouched", () => {
		const tasks: Task[] = [
			t("task-1", 0),
			t("task-2", 1),
			t("task-3", 2),
			t("task-9"), // outside this sequence
		];
		const updated = reorderWithinSequence(tasks, ["task-1", "task-2", "task-3"], "task-3", 0);
		const byId = new Map(updated.map((x) => [x.id, x]));
		expect(byId.get("task-3")?.ordinal).toBe(0);
		expect(byId.get("task-1")?.ordinal).toBe(1);
		expect(byId.get("task-2")?.ordinal).toBe(2);
		expect(byId.get("task-9")?.ordinal).toBeUndefined();
	});

	it("clamps index and preserves dependencies", () => {
		const tasks: Task[] = [{ ...t("task-1", 0), dependencies: ["task-x"] }, t("task-2", 1)];
		const updated = reorderWithinSequence(tasks, ["task-1", "task-2"], "task-1", 10);
		const byId = new Map(updated.map((x) => [x.id, x]));
		expect(byId.get("task-1")?.ordinal).toBe(1);
		expect(byId.get("task-1")?.dependencies).toEqual(["task-x"]);
	});
});
