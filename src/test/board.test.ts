import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildKanbanStatusGroups, exportKanbanBoardToFile, generateMilestoneGroupedBoard } from "../board.ts";
import type { Milestone, Task } from "../types/index.ts";

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

	it("sorts all columns by updatedDate descending, then by ID", async () => {
		const dir = await mkdtemp(join(tmpdir(), "board-export-"));
		const file = join(dir, "README.md");
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "First",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01",
				updatedDate: "2025-01-08 10:00",
				labels: [],
				dependencies: [],
			},
			{
				id: "task-3",
				title: "Third",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-03",
				updatedDate: "2025-01-09 10:00",
				labels: [],
				dependencies: [],
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
			},
		];

		await exportKanbanBoardToFile(tasks, ["To Do", "Done"], file, "TestProject");
		const content = await Bun.file(file).text();

		// Split content into lines for easier testing
		const lines = content.split("\n");

		// Find rows containing our tasks (updated to match uppercase format)
		const task1Row = lines.find((line) => line.includes("TASK-1"));
		const task3Row = lines.find((line) => line.includes("TASK-3"));
		const task2Row = lines.find((line) => line.includes("TASK-2"));
		const task4Row = lines.find((line) => line.includes("TASK-4"));
		const task5Row = lines.find((line) => line.includes("TASK-5"));

		if (!task1Row || !task2Row || !task3Row || !task4Row || !task5Row) {
			throw new Error("Expected task rows not found in exported board content");
		}

		// Check that To Do tasks are ordered by updatedDate (task-3 has newer date than task-1)
		const task3Index = lines.indexOf(task3Row);
		const task1Index = lines.indexOf(task1Row);
		expect(task3Index).toBeLessThan(task1Index);

		// Check that Done tasks are ordered by updatedDate
		const task5Index = lines.indexOf(task5Row);
		const task2Index = lines.indexOf(task2Row);
		const task4Index = lines.indexOf(task4Row);
		expect(task5Index).toBeLessThan(task2Index); // task-5 before task-2
		expect(task2Index).toBeLessThan(task4Index); // task-2 before task-4

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
			},
			{
				id: "task-205",
				title: "Subtask Example",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-02",
				labels: [],
				dependencies: [],
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

	it("handles assignees with existing @ symbols correctly", async () => {
		const dir = await mkdtemp(join(tmpdir(), "board-export-"));
		const file = join(dir, "README.md");
		const tasks: Task[] = [
			{
				id: "task-100",
				title: "Test @ Handling",
				status: "To Do",
				assignee: ["@claude", "alice", "@bob"],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
			},
		];

		await exportKanbanBoardToFile(tasks, ["To Do"], file, "TestProject");
		const content = await Bun.file(file).text();

		// Check that we don't get double @ symbols
		expect(content).toContain("[@claude, @alice, @bob]");
		expect(content).not.toContain("@@claude");
		expect(content).not.toContain("@@bob");

		await rm(dir, { recursive: true, force: true });
	});
});

describe("buildKanbanStatusGroups", () => {
	it("returns configured statuses even when there are no tasks", () => {
		const { orderedStatuses, groupedTasks } = buildKanbanStatusGroups([], ["To Do", "In Progress", "Done"]);
		expect(orderedStatuses).toEqual(["To Do", "In Progress", "Done"]);
		expect(groupedTasks.get("To Do")).toEqual([]);
		expect(groupedTasks.get("In Progress")).toEqual([]);
		expect(groupedTasks.get("Done")).toEqual([]);
	});

	it("appends unknown statuses from tasks after configured ones", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Blocked Task",
				status: "Blocked",
				assignee: [],
				createdDate: "2025-01-02",
				labels: [],
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Lowercase todo",
				status: "to do",
				assignee: [],
				createdDate: "2025-01-03",
				labels: [],
				dependencies: [],
			},
		];

		const { orderedStatuses, groupedTasks } = buildKanbanStatusGroups(tasks, ["To Do"]);
		expect(orderedStatuses).toEqual(["To Do", "Blocked"]);
		expect(groupedTasks.get("To Do")?.map((t) => t.id)).toEqual(["task-2"]);
		expect(groupedTasks.get("Blocked")?.map((t) => t.id)).toEqual(["task-1"]);
	});
});

describe("generateMilestoneGroupedBoard", () => {
	it("groups milestone ID and title aliases into one section using file title", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "By ID",
				status: "To Do",
				assignee: [],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				milestone: "m-0",
			},
			{
				id: "task-2",
				title: "By title",
				status: "To Do",
				assignee: [],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				milestone: "Release 1.0",
			},
		];
		const milestones: Milestone[] = [
			{
				id: "m-0",
				title: "Release 1.0",
				description: "Milestone: Release 1.0",
				rawContent: "## Description\n\nMilestone: Release 1.0",
			},
		];

		const board = generateMilestoneGroupedBoard(tasks, ["To Do"], milestones, "Test Project");
		expect(board.match(/## Release 1\.0 \(\d+ tasks\)/g)?.length).toBe(1);
		expect(board).toContain("**TASK-1** - By ID");
		expect(board).toContain("**TASK-2** - By title");
	});

	it("keeps ambiguous reused milestone titles as separate sections", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Active by ID",
				status: "To Do",
				assignee: [],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				milestone: "m-2",
			},
			{
				id: "task-2",
				title: "Title alias",
				status: "To Do",
				assignee: [],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				milestone: "Shared",
			},
		];
		const milestones: Milestone[] = [
			{
				id: "m-2",
				title: "Shared",
				description: "Milestone: Shared",
				rawContent: "## Description\n\nMilestone: Shared",
			},
			{
				id: "m-0",
				title: "Shared",
				description: "Milestone: Shared (archived)",
				rawContent: "## Description\n\nMilestone: Shared (archived)",
			},
		];

		const board = generateMilestoneGroupedBoard(tasks, ["To Do"], milestones, "Test Project");
		expect(board.match(/## Shared \(\d+ tasks\)/g)?.length).toBe(2);
	});
});
