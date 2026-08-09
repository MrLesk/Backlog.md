import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { type ColumnData, filterVisibleColumns } from "../ui/board.ts";

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

function makeColumns(entries: Array<[string, string[]]>): ColumnData[] {
	return entries.map(([status, ids]) => ({
		status,
		tasks: ids.map((id) => createTask(id, status)),
	}));
}

describe("filterVisibleColumns", () => {
	it("hides empty columns when enabled and not moving", () => {
		const data = makeColumns([
			["To Do", ["task-1"]],
			["In Progress", []],
			["Done", ["task-2"]],
		]);

		const result = filterVisibleColumns(data, true, false);

		expect(result.map((column) => column.status)).toEqual(["To Do", "Done"]);
	});

	it("keeps all columns when moving, even if hideEmptyColumns is enabled", () => {
		const data = makeColumns([
			["To Do", ["task-1"]],
			["In Progress", []],
			["Done", ["task-2"]],
		]);

		const result = filterVisibleColumns(data, true, true);

		expect(result).toBe(data);
	});

	it("keeps all columns when hideEmptyColumns is disabled", () => {
		const data = makeColumns([
			["To Do", ["task-1"]],
			["In Progress", []],
			["Done", ["task-2"]],
		]);

		const result = filterVisibleColumns(data, false, false);

		expect(result).toBe(data);
	});

	it("falls back to the unfiltered list when every column is empty", () => {
		const data = makeColumns([
			["To Do", []],
			["In Progress", []],
		]);

		const result = filterVisibleColumns(data, true, false);

		expect(result).toBe(data);
	});
});
