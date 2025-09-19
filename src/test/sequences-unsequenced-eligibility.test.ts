import { describe, expect, it } from "bun:test";
import { canMoveToUnsequenced } from "../core/sequences.ts";
import type { Task } from "../types/index.ts";

function t(id: string, deps: string[] = [], extra: Partial<Task> = {}): Task {
	return {
		id,
		title: id,
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: deps,
		rawContent: "Test",
		...extra,
	};
}

describe("canMoveToUnsequenced", () => {
	it("returns true for isolated tasks (no deps, no dependents)", () => {
		const tasks = [t("task-1"), t("task-2")];
		expect(canMoveToUnsequenced(tasks, "task-2")).toBe(true);
	});

	it("returns false when task has dependencies", () => {
		const tasks = [t("task-1"), t("task-2", ["task-1"])];
		expect(canMoveToUnsequenced(tasks, "task-2")).toBe(false);
	});

	it("returns false when task has dependents", () => {
		const tasks = [t("task-1"), t("task-2", ["task-1"])];
		expect(canMoveToUnsequenced(tasks, "task-1")).toBe(false);
	});
});
