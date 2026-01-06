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

	it("should reuse IDs from archived tasks (soft delete behavior)", async () => {
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

		// Create new task - should be TASK-1 (archived IDs can be reused)
		const result = await core.createTaskFromInput({ title: "Task After Archive" }, false);
		expect(result.task.id).toBe("TASK-1");

		// Verify the task was created with correct ID
		const newTask = await core.getTask("task-1");
		expect(newTask).not.toBeNull();
		expect(newTask?.title).toBe("Task After Archive");
	});

	it("should consider completed tasks but not archived tasks for ID generation", async () => {
		// Create tasks 1-3
		await core.createTaskFromInput({ title: "Task 1", status: "Todo" }, false);
		await core.createTaskFromInput({ title: "Task 2", status: "Todo" }, false);
		await core.createTaskFromInput({ title: "Task 3", status: "Todo" }, false);

		// Archive task-1 (its ID can be reused)
		await core.archiveTask("task-1", false);

		// Complete task-2 (moves to completed directory, ID cannot be reused)
		await core.completeTask("task-2", false);

		// Keep task-3 active
		const activeTasks = await core.fs.listTasks();
		expect(activeTasks.length).toBe(1);
		expect(activeTasks[0]?.id).toBe("TASK-3");

		// Create new task - should be TASK-4 (max of active 3 + completed 2 is 3, so next is 4)
		// Note: archived TASK-1 is NOT considered, so its ID could be reused if 2 and 3 weren't taken
		const result = await core.createTaskFromInput({ title: "Task 4" }, false);
		expect(result.task.id).toBe("TASK-4");

		// Verify archived task still exists
		const archivedTasks = await core.fs.listArchivedTasks();
		expect(archivedTasks.some((t) => t.id === "TASK-1")).toBe(true);

		// Verify completed task still exists
		const completedTasks = await core.fs.listCompletedTasks();
		expect(completedTasks.some((t) => t.id === "TASK-2")).toBe(true);
	});

	it("should handle subtasks correctly with archived parents", async () => {
		// Create parent task-1
		await core.createTaskFromInput({ title: "Parent Task" }, false);

		// Create subtasks
		const subtask1 = await core.createTaskFromInput({ title: "Subtask 1", parentTaskId: "task-1" }, false);
		const subtask2 = await core.createTaskFromInput({ title: "Subtask 2", parentTaskId: "task-1" }, false);

		expect(subtask1.task.id).toBe("TASK-1.1");
		expect(subtask2.task.id).toBe("TASK-1.2");

		// Archive parent and all subtasks
		await core.archiveTask("task-1", false);
		await core.archiveTask("task-1.1", false);
		await core.archiveTask("task-1.2", false);

		// Create new parent task - should be TASK-1 (reusing archived parent ID)
		const newParent = await core.createTaskFromInput({ title: "New Parent" }, false);
		expect(newParent.task.id).toBe("TASK-1");

		// Create subtask of new parent (TASK-1) - should be TASK-1.1 (reusing archived subtask ID)
		const newSubtask = await core.createTaskFromInput({ title: "New Subtask", parentTaskId: "task-1" }, false);
		expect(newSubtask.task.id).toBe("TASK-1.1");
	});

	it("should work with zero-padded IDs and reuse archived IDs", async () => {
		// Update config to use zero-padded IDs
		const config = await core.fs.loadConfig();
		if (config) {
			config.zeroPaddedIds = 3;
			await core.fs.saveConfig(config);
		}

		// Create and archive tasks with padding
		await core.createTaskFromInput({ title: "Task 1" }, false);
		const task1 = await core.getTask("task-001");
		expect(task1?.id).toBe("TASK-001");

		await core.archiveTask("task-001", false);

		// Create new task - should reuse archived ID (TASK-001)
		const result = await core.createTaskFromInput({ title: "Task 2" }, false);
		expect(result.task.id).toBe("TASK-001");
	});
});
