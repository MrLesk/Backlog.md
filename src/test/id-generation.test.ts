import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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
		await initializeFilesystemTestProject(core, "Test Project");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("keeps the IDs of archived tasks reserved", async () => {
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

		// The board is empty, yet every archived task still holds its ID.
		const result = await core.createTaskFromInput({ title: "Task After Archive" }, false);
		expect(result.task.id).toBe("TASK-6");

		// The archived task is still the one its ID names.
		const archivedTask = await core.getTask("task-1");
		expect(archivedTask?.title).toBe("Task 1");
		expect(archivedTask?.source).toBe("archived");
	});

	it("reserves an archived ID whatever status the task was archived in", async () => {
		await core.createTaskFromInput({ title: "Task 1", status: "To Do" }, false);
		await core.createTaskFromInput({ title: "Task 2", status: "In Progress" }, false);
		await core.createTaskFromInput({ title: "Task 3", status: "Done" }, false);

		// Archive from the top down, so each archived task is the highest ID when it leaves the board.
		for (const id of ["task-3", "task-2", "task-1"]) {
			expect(await core.archiveTask(id, false)).toBe(true);
		}

		const result = await core.createTaskFromInput({ title: "Task 4" }, false);
		expect(result.task.id).toBe("TASK-4");

		const archivedTasks = await core.fs.listArchivedTasks();
		expect(archivedTasks.map((task) => [task.id, task.status])).toEqual([
			["TASK-1", "To Do"],
			["TASK-2", "In Progress"],
			["TASK-3", "Done"],
		]);
	});

	it("reserves the IDs of archived tasks stored in a completed folder", async () => {
		const leftoverDirectory = join(core.fs.backlogDir, "completed");
		await mkdir(leftoverDirectory, { recursive: true });
		const leftoverTask: Task = {
			id: "TASK-7",
			title: "Finished before the archive folder held finished work",
			status: "Done",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
		};
		await Bun.write(join(leftoverDirectory, "task-7 - Finished-earlier.md"), serializeTask(leftoverTask));

		const result = await core.createTaskFromInput({ title: "New task" }, false);
		expect(result.task.id).toBe("TASK-8");
		expect((await core.getTask("task-7"))?.source).toBe("archived");
	});

	it("reserves the number in an archived file's name when the file cannot be read as a task", async () => {
		// This project is outside a Git repository, so no worktree list leads to these files.
		await mkdir(core.fs.archiveTasksDir, { recursive: true });
		await Bun.write(join(core.fs.archiveTasksDir, "task-5 - Damaged.md"), "not a task file");

		const afterArchiveFolder = await core.createTaskFromInput({ title: "After the archive folder" }, false);
		expect(afterArchiveFolder.task.id).toBe("TASK-6");

		const leftoverDirectory = join(core.fs.backlogDir, "completed");
		await mkdir(leftoverDirectory, { recursive: true });
		await Bun.write(join(leftoverDirectory, "task-9 - Damaged.md"), "not a task file");

		const afterLeftoverFolder = await core.createTaskFromInput({ title: "After the completed folder" }, false);
		expect(afterLeftoverFolder.task.id).toBe("TASK-10");
	});

	it("keeps archived parent and subtask IDs reserved", async () => {
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

		// A new parent gets the next top-level ID.
		const newParent = await core.createTaskFromInput({ title: "New Parent" }, false);
		expect(newParent.task.id).toBe("TASK-2");

		// A new subtask of the archived parent continues after its archived subtasks.
		const newSubtask = await core.createTaskFromInput({ title: "New Subtask", parentTaskId: "task-1" }, false);
		expect(newSubtask.task.id).toBe("TASK-1.3");
	});

	it("keeps zero-padded archived IDs reserved", async () => {
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

import { initializeFilesystemTestProject } from "./test-utils.ts";
