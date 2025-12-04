import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";

const TEST_DIR = join(tmpdir(), "backlog-id-gen-test");

describe("Task ID Generation with Archives", () => {
	let core: Core;
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(TEST_DIR);
		core = new Core(testDir);
		await core.initializeProject("Test Project", false);
	});

	afterEach(async () => {
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	it("should continue numbering after all tasks are archived", async () => {
		// Create tasks 1-5
		await core.createTaskFromInput({ title: "Task 1" }, false);
		await core.createTaskFromInput({ title: "Task 2" }, false);
		await core.createTaskFromInput({ title: "Task 3" }, false);
		await core.createTaskFromInput({ title: "Task 4" }, false);
		await core.createTaskFromInput({ title: "Task 5" }, false);

		// Archive all tasks
		await core.archiveTask("task-1", false);
		await core.archiveTask("task-2", false);
		await core.archiveTask("task-3", false);
		await core.archiveTask("task-4", false);
		await core.archiveTask("task-5", false);

		// Verify tasks directory has no active tasks
		const activeTasks = await core.fs.listTasks();
		expect(activeTasks.length).toBe(0);

		// Create new task - should be task-6, NOT task-1
		const result = await core.createTaskFromInput({ title: "Task After Archive" }, false);
		expect(result.task.id).toBe("task-6");

		// Verify the task was created with correct ID
		const newTask = await core.getTask("task-6");
		expect(newTask).not.toBeNull();
		expect(newTask?.title).toBe("Task After Archive");
	});

	it("should consider both archived and completed tasks", async () => {
		// Create tasks 1-3
		await core.createTaskFromInput({ title: "Task 1", status: "Todo" }, false);
		await core.createTaskFromInput({ title: "Task 2", status: "Todo" }, false);
		await core.createTaskFromInput({ title: "Task 3", status: "Todo" }, false);

		// Archive task-1
		await core.archiveTask("task-1", false);

		// Complete task-2 (moves to completed directory)
		await core.completeTask("task-2", false);

		// Keep task-3 active
		const activeTasks = await core.fs.listTasks();
		expect(activeTasks.length).toBe(1);
		expect(activeTasks[0]?.id).toBe("task-3");

		// Create new task - should be task-4
		const result = await core.createTaskFromInput({ title: "Task 4" }, false);
		expect(result.task.id).toBe("task-4");

		// Verify archived task still exists
		const archivedTasks = await core.fs.listArchivedTasks();
		expect(archivedTasks.some((t) => t.id === "task-1")).toBe(true);

		// Verify completed task still exists
		const completedTasks = await core.fs.listCompletedTasks();
		expect(completedTasks.some((t) => t.id === "task-2")).toBe(true);
	});

	it("should handle subtasks correctly with archived parents", async () => {
		// Create parent task-1
		await core.createTaskFromInput({ title: "Parent Task" }, false);

		// Create subtasks
		const subtask1 = await core.createTaskFromInput({ title: "Subtask 1", parentTaskId: "task-1" }, false);
		const subtask2 = await core.createTaskFromInput({ title: "Subtask 2", parentTaskId: "task-1" }, false);

		expect(subtask1.task.id).toBe("task-1.1");
		expect(subtask2.task.id).toBe("task-1.2");

		// Archive parent and all subtasks
		await core.archiveTask("task-1", false);
		await core.archiveTask("task-1.1", false);
		await core.archiveTask("task-1.2", false);

		// Create new parent task - should be task-2, NOT task-1
		const newParent = await core.createTaskFromInput({ title: "New Parent" }, false);
		expect(newParent.task.id).toBe("task-2");

		// Create subtask of archived parent - should be task-1.3
		const newSubtask = await core.createTaskFromInput({ title: "New Subtask", parentTaskId: "task-1" }, false);
		expect(newSubtask.task.id).toBe("task-1.3");
	});

	it("should work with zero-padded IDs", async () => {
		// Update config to use zero-padded IDs
		const config = await core.fs.loadConfig();
		if (config) {
			config.zeroPaddedIds = 3;
			await core.fs.saveConfig(config);
		}

		// Create and archive tasks with padding
		await core.createTaskFromInput({ title: "Task 1" }, false);
		const task1 = await core.getTask("task-001");
		expect(task1?.id).toBe("task-001");

		await core.archiveTask("task-001", false);

		// Create new task - should respect padding and continue from archived max
		const result = await core.createTaskFromInput({ title: "Task 2" }, false);
		expect(result.task.id).toBe("task-002");
	});
});
