import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";

const TEST_DIR = join(tmpdir(), "backlog-id-gen-test");

describe("Task ID Generation with Archives", () => {
	let core: Core;
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(TEST_DIR);
		core = new Core(testDir);
		await initializeTestProject(core, "Test Project", false);
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("should NOT reuse IDs from archived tasks (IDs are permanent)", async () => {
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

		// Archiving does not return IDs 1-5 to the pool, so the next ID is TASK-6.
		const result = await core.createTaskFromInput({ title: "Task After Archive" }, false);
		expect(result.task.id).toBe("TASK-6");

		// Verify the task was created with correct ID
		const newTask = await core.getTask("task-6");
		expect(newTask).not.toBeNull();
		expect(newTask?.title).toBe("Task After Archive");
	});

	it("should consider completed AND archived tasks for ID generation", async () => {
		// Create tasks 1-3
		await core.createTaskFromInput({ title: "Task 1", status: "Todo" }, false);
		await core.createTaskFromInput({ title: "Task 2", status: "Done" }, false);
		await core.createTaskFromInput({ title: "Task 3", status: "Todo" }, false);

		// Archive task-1 (its ID stays reserved)
		await core.archiveTask("task-1", false);

		// Complete task-2 (moves to completed directory, ID stays reserved)
		await core.completeTask("task-2", false);

		// Keep task-3 active
		const activeTasks = await core.fs.listTasks();
		expect(activeTasks.length).toBe(1);
		expect(activeTasks[0]?.id).toBe("TASK-3");

		// Max across active (3), completed (2) and archived (1) is 3, so the next ID is 4.
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

		// The archived parent keeps TASK-1, so the new parent is TASK-2.
		const newParent = await core.createTaskFromInput({ title: "New Parent" }, false);
		expect(newParent.task.id).toBe("TASK-2");

		// Subtasks of the new parent are numbered under it.
		const newSubtask = await core.createTaskFromInput({ title: "New Subtask", parentTaskId: "task-2" }, false);
		expect(newSubtask.task.id).toBe("TASK-2.1");
	});

	it("should work with zero-padded IDs and never reuse archived IDs", async () => {
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

		// TASK-001 stays reserved even though it is archived, so the next ID is TASK-002.
		const result = await core.createTaskFromInput({ title: "Task 2" }, false);
		expect(result.task.id).toBe("TASK-002");
	});

	it("should detect existing subtasks with different casing (legacy data)", async () => {
		// Create parent task via Core (will be uppercase TASK-1)
		await core.createTaskFromInput({ title: "Parent Task" }, false);

		// Simulate legacy lowercase subtask by directly writing to filesystem
		// This represents a file created before the uppercase ID change
		const tasksDir = core.fs.tasksDir;
		const legacySubtask: Task = {
			id: "task-1.1", // Lowercase - legacy format
			title: "Legacy Subtask",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			parentTaskId: "task-1",
		};
		const content = serializeTask(legacySubtask);
		await Bun.write(join(tasksDir, "task-1.1 - Legacy Subtask.md"), content);

		// Create new subtask via Core - should detect the legacy subtask and get TASK-1.2
		// BUG: Currently returns TASK-1.1 due to case-sensitive startsWith() check
		const newSubtask = await core.createTaskFromInput({ title: "New Subtask", parentTaskId: "task-1" }, false);
		expect(newSubtask.task.id).toBe("TASK-1.2");
	});
});

import { initializeTestProject } from "./test-utils.ts";
