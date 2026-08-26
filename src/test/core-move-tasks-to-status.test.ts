import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let core: Core;

const FIXED_DATE = "2025-01-01 00:00";

const buildTask = (id: string, status: string, ordinal?: number, overrides: Partial<Task> = {}): Task => ({
	id,
	title: `Task ${id}`,
	status,
	assignee: [],
	createdDate: FIXED_DATE,
	labels: [],
	dependencies: [],
	...(ordinal !== undefined ? { ordinal } : {}),
	...overrides,
});

const createTasks = async (tasks: Array<[string, string, number?]>) => {
	for (const [id, status, ordinal] of tasks) {
		await core.createTask(buildTask(id, status, ordinal), false);
	}
};

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("move-tasks-to-status");
	await mkdir(TEST_DIR, { recursive: true });
	await $`git init -b main`.cwd(TEST_DIR).quiet();
	core = new Core(TEST_DIR);
	await initializeTestProject(core, "Batch Move Test Project");
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
});

describe("Core.moveTasksToStatus", () => {
	it("moves every task to the target status", async () => {
		await createTasks([
			["task-1", "To Do", 1000],
			["task-2", "To Do", 2000],
			["task-3", "To Do", 3000],
		]);

		const result = await core.moveTasksToStatus({
			taskIds: ["task-1", "task-3"],
			targetStatus: "In Progress",
			autoCommit: false,
		});

		expect(result.failures).toHaveLength(0);
		expect(result.movedTasks.map((task) => task.id)).toEqual(["TASK-1", "TASK-3"]);
		expect((await core.filesystem.loadTask("task-1"))?.status).toBe("In Progress");
		expect((await core.filesystem.loadTask("task-3"))?.status).toBe("In Progress");
		expect((await core.filesystem.loadTask("task-2"))?.status).toBe("To Do");
	});

	it("appends the moved tasks after the tasks already in the target column", async () => {
		await createTasks([
			["task-1", "To Do", 1000],
			["task-2", "To Do", 2000],
			["task-3", "In Progress", 5000],
		]);

		await core.moveTasksToStatus({
			taskIds: ["task-2", "task-1"],
			targetStatus: "In Progress",
			autoCommit: false,
		});

		const existing = await core.filesystem.loadTask("task-3");
		const first = await core.filesystem.loadTask("task-2");
		const second = await core.filesystem.loadTask("task-1");

		expect(existing?.ordinal).toBe(5000);
		expect(first?.ordinal).toBeGreaterThan(5000);
		expect(second?.ordinal).toBeGreaterThan(first?.ordinal ?? 0);
	});

	it("moves the tasks that resolve and reports the ones that do not", async () => {
		await createTasks([["task-1", "To Do", 1000]]);

		const result = await core.moveTasksToStatus({
			taskIds: ["task-1", "task-404"],
			targetStatus: "Done",
			autoCommit: false,
		});

		expect(result.movedTasks.map((task) => task.id)).toEqual(["TASK-1"]);
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]?.taskId).toBe("task-404");
		expect((await core.filesystem.loadTask("task-1"))?.status).toBe("Done");
	});

	it("ignores a repeated task ID", async () => {
		await createTasks([["task-1", "To Do", 1000]]);

		const result = await core.moveTasksToStatus({
			taskIds: ["task-1", "TASK-1"],
			targetStatus: "Done",
			autoCommit: false,
		});

		expect(result.movedTasks).toHaveLength(1);
		expect(result.failures).toHaveLength(0);
	});

	it("leaves a task that is already in the target status untouched", async () => {
		await createTasks([["task-1", "Done", 1000]]);

		const result = await core.moveTasksToStatus({
			taskIds: ["task-1"],
			targetStatus: "Done",
			autoCommit: false,
		});

		expect(result.failures).toHaveLength(0);
		expect(result.changedTasks).toHaveLength(0);
		expect((await core.filesystem.loadTask("task-1"))?.ordinal).toBe(1000);
	});

	it("rejects an empty target status", async () => {
		await createTasks([["task-1", "To Do", 1000]]);

		await expect(
			core.moveTasksToStatus({ taskIds: ["task-1"], targetStatus: "  ", autoCommit: false }),
		).rejects.toThrow();
	});
});
