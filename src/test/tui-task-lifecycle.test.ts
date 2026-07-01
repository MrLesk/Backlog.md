import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { completeTaskFromTui, formatTaskCompletionBlockedMessage } from "../ui/task-lifecycle.ts";
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
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "TUI Task Lifecycle Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("does not move non-terminal tasks to completed", async () => {
		await createTask({ id: "task-1", title: "Open task", status: "To Do" });
		const task = await core.filesystem.loadTask("task-1");
		expect(task).not.toBeNull();

		const result = await completeTaskFromTui(core, task as Task);

		expect(result).toEqual({ success: false, reason: "not-terminal", terminalStatus: "Done" });
		expect(formatTaskCompletionBlockedMessage("TASK-1", "Done")).toBe(
			'Task TASK-1 is not Done. Set status to "Done" before completing it.',
		);
		expect((await core.filesystem.loadTask("task-1"))?.status).toBe("To Do");
		expect(await core.filesystem.listCompletedTasks()).toHaveLength(0);
	});

	it("moves terminal tasks to completed", async () => {
		await createTask({ id: "task-1", title: "Done task", status: "Done" });
		const task = await core.filesystem.loadTask("task-1");
		expect(task).not.toBeNull();

		const result = await completeTaskFromTui(core, task as Task);

		expect(result).toEqual({ success: true });
		expect(await core.filesystem.loadTask("task-1")).toBeNull();
		const completedTasks = await core.filesystem.listCompletedTasks();
		expect(completedTasks).toHaveLength(1);
		expect(completedTasks[0]?.status).toBe("Done");
	});

	it("uses the configured terminal status", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected test project config to exist");
		}
		await core.filesystem.saveConfig({
			...config,
			statuses: ["To Do", "Review", "Closed"],
			defaultStatus: "To Do",
		});

		await createTask({ id: "task-1", title: "Review task", status: "Review" });
		const reviewTask = await core.filesystem.loadTask("task-1");
		expect(reviewTask).not.toBeNull();
		expect(await completeTaskFromTui(core, reviewTask as Task)).toEqual({
			success: false,
			reason: "not-terminal",
			terminalStatus: "Closed",
		});

		await createTask({ id: "task-2", title: "Closed task", status: "Closed" });
		const closedTask = await core.filesystem.loadTask("task-2");
		expect(closedTask).not.toBeNull();
		expect(await completeTaskFromTui(core, closedTask as Task)).toEqual({ success: true });
		expect((await core.filesystem.listCompletedTasks()).map((task) => task.id)).toEqual(["TASK-2"]);
	});
});
