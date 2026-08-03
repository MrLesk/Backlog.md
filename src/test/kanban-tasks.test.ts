import { describe, expect, it } from "bun:test";
import type { Task } from "../types";
import { filterKanbanTasks } from "../web/utils/kanban-tasks";

const task = (id: string, status: string, source?: Task["source"]): Task => ({
	id,
	title: id,
	status,
	assignee: [],
	createdDate: "2026-08-03",
	labels: [],
	dependencies: [],
	source,
});

describe("Kanban task presentation", () => {
	it("keeps active Done tasks while excluding completed corpus entries", () => {
		const tasks = [
			task("BACK-1", "To Do", "local"),
			task("BACK-2", "Done", "local"),
			task("BACK-3", "Done", "completed"),
		];

		expect(filterKanbanTasks(tasks).map((candidate) => candidate.id)).toEqual(["BACK-1", "BACK-2"]);
	});
});
