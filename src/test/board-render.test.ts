import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { type ColumnData, shouldRebuildColumns } from "../ui/board.ts";

function createTask(id: string, status: string): Task {
	return {
		id,
		title: `Title for ${id}`,
		status,
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description: "",
	};
}

function makeColumns(taskIds: string[][], status: string): ColumnData[] {
	return taskIds.map((ids) => ({
		status,
		tasks: ids.map((id) => createTask(id, status)),
	}));
}

describe("shouldRebuildColumns", () => {
	it("returns false when columns and task ordering are unchanged", () => {
		const previous = makeColumns([["task-1", "task-2"]], "In Progress");
		const next = makeColumns([["task-1", "task-2"]], "In Progress");

		expect(shouldRebuildColumns(previous, next)).toBe(false);
	});

	it("returns true when a column loses items", () => {
		const previous = makeColumns([["task-1", "task-2"]], "In Progress");
		const next = makeColumns([["task-1"]], "In Progress");

		expect(shouldRebuildColumns(previous, next)).toBe(true);
	});

	it("returns true when column task ordering changes", () => {
		const previous = makeColumns([["task-1", "task-2"]], "In Progress");
		const next = makeColumns([["task-2", "task-1"]], "In Progress");

		expect(shouldRebuildColumns(previous, next)).toBe(true);
	});

	it("returns true when number of columns changes", () => {
		const previous = makeColumns([["task-1"]], "In Progress");
		const next = makeColumns([["task-1"], ["task-2"]], "In Progress");

		expect(shouldRebuildColumns(previous, next)).toBe(true);
	});
});
