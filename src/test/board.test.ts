import { describe, expect, it } from "bun:test";
import { generateKanbanBoard } from "../board.ts";
import type { Task } from "../types/index.ts";

describe("generateKanbanBoard", () => {
	it("creates board layout with statuses", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "First",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-2",
				title: "Second",
				status: "In Progress",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-3",
				title: "Third",
				status: "Done",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do", "In Progress", "Done"]);
		const lines = board.split("\n");
		expect(lines[0]).toContain("To Do");
		expect(lines[0]).toContain("In Progress");
		expect(lines[0]).toContain("Done");
		expect(board).toContain("task-1 - First");
		expect(board).toContain("task-2 - Second");
		expect(board).toContain("task-3 - Third");
	});
});
