import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportKanbanBoardToFile, generateKanbanBoard } from "../board.ts";
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
				body: "",
			},
			{
				id: "task-2",
				title: "Second",
				status: "In Progress",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-3",
				title: "Third",
				status: "Done",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do", "In Progress", "Done"]);
		const lines = board.split("\n");
		expect(lines[0]).toContain("To Do");
		expect(lines[0]).toContain("In Progress");
		expect(lines[0]).toContain("Done");
		// Tasks are now on separate lines: ID first, then title
		expect(board).toContain("task-1");
		expect(board).toContain("First");
		expect(board).toContain("task-2");
		expect(board).toContain("Second");
		expect(board).toContain("task-3");
		expect(board).toContain("Third");
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
				body: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do", "In Progress", "Done"]);
		expect(board).toContain("No Status");
		expect(board).toContain("task-1");
		expect(board).toContain("No Status Task");
	});

	it("omits 'No Status' column when all tasks have status", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Status Task",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do", "In Progress", "Done"]);
		expect(board).not.toContain("No Status");
	});

	it("handles empty task list", () => {
		const board = generateKanbanBoard([], ["To Do", "In Progress", "Done"]);
		expect(board).toBe(""); // No columns when no tasks
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
				body: "",
			},
			{
				id: "task-2",
				title: "Second",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
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

	it("handles long task titles by wrapping text within max column width", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "This is a very long task title that should expand the column width significantly",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do"]);
		const lines = board.split("\n");
		const header = lines[0];
		const taskIdLine = lines[2]; // First task line (ID)
		const firstTitleLine = lines[3]; // First wrapped title line
		// Column width should be constrained by default maxColumnWidth (20)
		expect(header.length).toBe(20);
		expect(taskIdLine).toContain("task-1");
		expect(firstTitleLine).toContain("This is a very long");
		// Should have multiple lines for the wrapped title
		expect(lines.length).toBeGreaterThan(4);
	});

	it("nests subtasks under their parent when statuses match", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Parent",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-1.1",
				title: "Child",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
				parentTaskId: "task-1",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do"]);
		expect(board).toContain("  └─ task-1.1");
		expect(board).toContain("     Child");

		const lines = board.split("\n");
		const parentIdx = lines.findIndex((l) => l.includes("task-1") && !l.includes("task-1.1"));
		const childIdx = lines.findIndex((l) => l.includes("  └─ task-1.1"));
		expect(parentIdx).toBeGreaterThan(-1);
		expect(childIdx).toBeGreaterThan(parentIdx);
	});

	it("sorts tasks by numeric id within each status", () => {
		const tasks: Task[] = [
			{
				id: "task-10",
				title: "T10",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-2",
				title: "T2",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do"]);
		const lines = board.split("\n");
		const firstIdLine = lines[2];
		const secondIdLine = lines[5];
		expect(firstIdLine.trim().startsWith("task-2")).toBe(true);
		expect(secondIdLine.trim().startsWith("task-10")).toBe(true);
	});

	it("creates vertical board layout", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "First",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-2",
				title: "Second",
				status: "In Progress",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];

		const board = generateKanbanBoard(tasks, ["To Do", "In Progress", "Done"], "vertical");
		const lines = board.split("\n");
		expect(lines[0]).toBe("To Do");
		expect(lines).toContain("In Progress");
		expect(board).toContain("task-1");
		expect(board).toContain("First");
		expect(board).toContain("task-2");
		expect(board).toContain("Second");
	});
});

describe("exportKanbanBoardToFile", () => {
	it("creates file and overwrites board content", async () => {
		const dir = await mkdtemp(join(tmpdir(), "board-export-"));
		const file = join(dir, "README.md");
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "First",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];

		await exportKanbanBoardToFile(tasks, ["To Do"], file, "TestProject");
		const initial = await Bun.file(file).text();
		expect(initial).toContain("task-1");
		expect(initial).toContain("# Kanban Board Export (powered by Backlog.md)");
		expect(initial).toContain("Project: TestProject");

		await exportKanbanBoardToFile(tasks, ["To Do"], file, "TestProject");
		const second = await Bun.file(file).text();
		const occurrences = second.split("task-1").length - 1;
		expect(occurrences).toBe(1); // Should overwrite, not append

		await rm(dir, { recursive: true, force: true });
	});
});
