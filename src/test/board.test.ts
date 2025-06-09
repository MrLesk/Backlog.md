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

	it("handles tasks with no status", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "No Status Task",
				status: "",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do", "In Progress", "Done"]);
		expect(board).toContain("No Status");
		expect(board).toContain("task-1 - No Status Task");
	});

	it("handles empty task list", () => {
		const board = generateKanbanBoard([], ["To Do", "In Progress", "Done"]);
		const lines = board.split("\n");
		expect(lines[0]).toContain("To Do");
		expect(lines[0]).toContain("In Progress");
		expect(lines[0]).toContain("Done");
		expect(lines.length).toBe(2); // header + separator only
	});

	it("respects status order from config", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "First",
				status: "Done",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-2",
				title: "Second",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do", "In Progress", "Done"]);
		const lines = board.split("\n");
		// Status order should be preserved even if tasks exist in different order
		const header = lines[0];
		const todoIndex = header.indexOf("To Do");
		const doneIndex = header.indexOf("Done");
		expect(todoIndex).toBeLessThan(doneIndex);
	});

	it("handles long task titles by adjusting column width", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "This is a very long task title that should expand the column width significantly",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do"]);
		const lines = board.split("\n");
		const header = lines[0];
		const taskLine = lines[2];
		// Column should be wide enough for both header and task
		expect(header.length).toBeGreaterThan("To Do".length);
		expect(taskLine).toContain("This is a very long task title");
	});
});
