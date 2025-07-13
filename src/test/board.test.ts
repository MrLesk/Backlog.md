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
});
