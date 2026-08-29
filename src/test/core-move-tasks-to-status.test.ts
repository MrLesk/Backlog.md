import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
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

	describe("milestone lanes", () => {
		it("applies the lane milestone the same way a single-task reorder does", async () => {
			await createTasks([
				["task-1", "To Do", 1000],
				["task-2", "To Do", 2000],
				["task-3", "To Do", 3000],
			]);

			const batch = await core.moveTasksToStatus({
				taskIds: ["task-1", "task-2"],
				targetStatus: "In Progress",
				targetMilestone: "  Release 1  ",
				autoCommit: false,
			});
			expect(batch.failures).toHaveLength(0);

			// The same drop made one card at a time must land on the same milestone.
			await core.reorderTask({
				taskId: "task-3",
				targetStatus: "In Progress",
				orderedTaskIds: ["task-3"],
				targetMilestone: "  Release 1  ",
				autoCommit: false,
			});

			for (const id of ["task-1", "task-2", "task-3"]) {
				const task = await core.filesystem.loadTask(id);
				expect(task?.status).toBe("In Progress");
				expect(task?.milestone).toBe("Release 1");
			}
		});

		it("clears the milestone when the batch lands in the no-milestone lane", async () => {
			await createTasks([["task-1", "To Do", 1000]]);
			await core.moveTasksToStatus({
				taskIds: ["task-1"],
				targetStatus: "To Do",
				targetMilestone: "Release 1",
				autoCommit: false,
			});
			expect((await core.filesystem.loadTask("task-1"))?.milestone).toBe("Release 1");

			await core.moveTasksToStatus({
				taskIds: ["task-1"],
				targetStatus: "In Progress",
				targetMilestone: null,
				autoCommit: false,
			});

			expect((await core.filesystem.loadTask("task-1"))?.milestone).toBeUndefined();
		});

		it("leaves the milestone alone when the caller names no lane", async () => {
			await createTasks([["task-1", "To Do", 1000]]);
			await core.moveTasksToStatus({
				taskIds: ["task-1"],
				targetStatus: "To Do",
				targetMilestone: "Release 1",
				autoCommit: false,
			});

			await core.moveTasksToStatus({ taskIds: ["task-1"], targetStatus: "Done", autoCommit: false });

			const task = await core.filesystem.loadTask("task-1");
			expect(task?.status).toBe("Done");
			expect(task?.milestone).toBe("Release 1");
		});
	});

	// Both paths run through Core's shared board-move resolution, so the same requested ID resolves
	// to the same task on either path.
	describe("shared id resolution with reorderTask", () => {
		it("resolves an untrimmed, lower-case ID on both paths", async () => {
			await createTasks([
				["task-1", "To Do", 1000],
				["task-2", "To Do", 2000],
			]);

			const batch = await core.moveTasksToStatus({
				taskIds: ["  task-1  "],
				targetStatus: "In Progress",
				autoCommit: false,
			});
			expect(batch.failures).toHaveLength(0);
			expect(batch.movedTasks.map((task) => task.id)).toEqual(["TASK-1"]);

			const reordered = await core.reorderTask({
				taskId: "  task-2  ",
				targetStatus: "In Progress",
				orderedTaskIds: ["  task-2  "],
				autoCommit: false,
			});
			expect(reordered.updatedTask.id).toBe("TASK-2");
		});

		it("fails an ambiguous ID closed on both paths and moves nothing for it", async () => {
			await createTasks([
				["task-1", "To Do", 1000],
				["task-2", "To Do", 2000],
			]);
			// A zero-padded second file makes TASK-1 match two files, so no lookup may pick a winner.
			await Bun.write(
				join(core.filesystem.tasksDir, "task-01 - Padded-duplicate.md"),
				serializeTask(buildTask("TASK-01", "To Do", 1500, { title: "Padded duplicate" })),
			);

			const batch = await core.moveTasksToStatus({
				taskIds: ["task-1", "task-2"],
				targetStatus: "Done",
				autoCommit: false,
			});

			// The ambiguous ID is reported on its own; the unambiguous one still moves.
			expect(batch.movedTasks.map((task) => task.id)).toEqual(["TASK-2"]);
			expect(batch.failures.map((failure) => failure.taskId)).toEqual(["task-1"]);
			expect(batch.failures[0]?.reason).toContain("ambiguous");
			expect((await core.filesystem.loadTask("task-2"))?.status).toBe("Done");

			await expect(
				core.reorderTask({
					taskId: "task-1",
					targetStatus: "Done",
					orderedTaskIds: ["task-1"],
					autoCommit: false,
				}),
			).rejects.toThrow(/ambiguous/i);
		});

		it("still rejects a repeated id in an ordering while the batch collapses it", async () => {
			await createTasks([["task-1", "To Do", 1000]]);

			await expect(
				core.reorderTask({
					taskId: "task-1",
					targetStatus: "Done",
					orderedTaskIds: ["task-1", "TASK-1"],
					autoCommit: false,
				}),
			).rejects.toThrow("Duplicate task id");

			const batch = await core.moveTasksToStatus({
				taskIds: ["task-1", "TASK-1"],
				targetStatus: "Done",
				autoCommit: false,
			});
			expect(batch.movedTasks).toHaveLength(1);
			expect(batch.failures).toHaveLength(0);
		});
	});
});
