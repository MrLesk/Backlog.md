import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { archiveTaskFromTui, formatArchiveConfirmation } from "../ui/task-lifecycle.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;

const createTask = async (task: Pick<Task, "id" | "title" | "status">) => {
	await core.createTask(
		{
			...task,
			assignee: [],
			createdDate: "2026-07-01",
			labels: [],
			dependencies: [],
			rawContent: "Test task",
		},
		false,
	);
};

describe("TUI task lifecycle", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("tui-task-lifecycle");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "TUI Task Lifecycle Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("archives a task in any status and keeps its ID and status", async () => {
		await createTask({ id: "task-1", title: "Open task", status: "To Do" });
		await createTask({ id: "task-2", title: "Done task", status: "Done" });

		for (const id of ["task-1", "task-2"]) {
			const task = await core.filesystem.loadTask(id);
			expect(task).not.toBeNull();
			expect(await archiveTaskFromTui(core, task as Task)).toBe(true);
			expect(await core.filesystem.loadTask(id)).toBeNull();
		}

		const archivedTasks = await core.filesystem.listArchivedTasks();
		expect(archivedTasks.map((task) => [task.id, task.status])).toEqual([
			["TASK-1", "To Do"],
			["TASK-2", "Done"],
		]);
	});

	it("asks one three-line question that fits the confirm popup", () => {
		const lines = formatArchiveConfirmation("TASK-1").split("\n");

		expect(lines).toEqual([
			"Archive {bold}TASK-1{/bold}?",
			"Moves it off the board and keeps",
			"its ID, record, and links.",
		]);
		expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(37);
	});
});
