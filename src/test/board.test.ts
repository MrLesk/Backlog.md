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
		expect(initial).toContain("task-1");
		expect(initial).toContain("# Kanban Board Export (powered by Backlog.md)");
		expect(initial).toContain("Project: TestProject");

		await exportKanbanBoardToFile(tasks, ["To Do"], file, "TestProject");
		const second = await Bun.file(file).text();
		const occurrences = second.split("task-1").length - 1;
		expect(occurrences).toBe(1); // Should overwrite, not append

		await rm(dir, { recursive: true, force: true });
	});

	it("sorts Done column by updatedDate, other columns by ID", async () => {
		const dir = await mkdtemp(join(tmpdir(), "board-export-"));
		const file = join(dir, "README.md");
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "First",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-3",
				title: "Third",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-03",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-2",
				title: "Second",
				status: "Done",
				assignee: [],
				createdDate: "2025-01-02",
				updatedDate: "2025-01-10 12:00",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-4",
				title: "Fourth",
				status: "Done",
				assignee: [],
				createdDate: "2025-01-04",
				updatedDate: "2025-01-05 10:00",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-5",
				title: "Fifth",
				status: "Done",
				assignee: [],
				createdDate: "2025-01-05",
				updatedDate: "2025-01-10 14:00",
				labels: [],
				dependencies: [],
				body: "",
			},
		];

		await exportKanbanBoardToFile(tasks, ["To Do", "Done"], file, "TestProject");
		const content = await Bun.file(file).text();

		// Split content into lines for easier testing
		const lines = content.split("\n");

		// Find rows containing our tasks
		const task1Row = lines.find((line) => line.includes("task-1"));
		const task3Row = lines.find((line) => line.includes("task-3"));
		const task2Row = lines.find((line) => line.includes("task-2"));
		const task4Row = lines.find((line) => line.includes("task-4"));
		const task5Row = lines.find((line) => line.includes("task-5"));

		// Check that task-3 appears before task-1 in To Do column
		const task3Index = lines.indexOf(task3Row!);
		const task1Index = lines.indexOf(task1Row!);
		expect(task3Index).toBeLessThan(task1Index);

		// Check that Done tasks are ordered by updatedDate
		const task5Index = lines.indexOf(task5Row!);
		const task2Index = lines.indexOf(task2Row!);
		const task4Index = lines.indexOf(task4Row!);
		expect(task5Index).toBeLessThan(task2Index); // task-5 before task-2
		expect(task2Index).toBeLessThan(task4Index); // task-2 before task-4

		await rm(dir, { recursive: true, force: true });
	});
});
