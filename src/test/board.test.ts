import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportKanbanBoardToFile } from "../board.ts";
import type { Task } from "../types/index.ts";

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
		expect(initial).toContain("TASK-1");
		expect(initial).toContain("# Kanban Board Export (powered by Backlog.md)");
		expect(initial).toContain("Project: TestProject");

		await exportKanbanBoardToFile(tasks, ["To Do"], file, "TestProject");
		const second = await Bun.file(file).text();
		const occurrences = second.split("TASK-1").length - 1;
		expect(occurrences).toBe(1); // Should overwrite, not append

		await rm(dir, { recursive: true, force: true });
	});

	it("formats tasks with new styling rules", async () => {
		const dir = await mkdtemp(join(tmpdir(), "board-export-"));
		const file = join(dir, "README.md");
		const tasks: Task[] = [
			{
				id: "task-204",
				title: "Test Task",
				status: "To Do",
				assignee: ["alice", "bob"],
				createdDate: "2025-01-01",
				labels: ["enhancement", "ui"],
				dependencies: [],
				body: "",
			},
			{
				id: "task-205",
				title: "Subtask Example",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-02",
				labels: [],
				dependencies: [],
				body: "",
				parentTaskId: "task-204",
			},
		];

		await exportKanbanBoardToFile(tasks, ["To Do"], file, "TestProject");
		const content = await Bun.file(file).text();

		// Check uppercase task IDs
		expect(content).toContain("**TASK-204**");
		expect(content).toContain("└─ **TASK-205**");

		// Check assignee formatting with @ prefix
		expect(content).toContain("[@alice, @bob]");

		// Check label formatting with # prefix and italics
		expect(content).toContain("*#enhancement #ui*");

		// Check that tasks without assignees/labels don't have empty brackets
		expect(content).not.toContain("[]");
		expect(content).not.toContain("**TASK-205** - Subtask Example<br>");

		await rm(dir, { recursive: true, force: true });
	});
});
