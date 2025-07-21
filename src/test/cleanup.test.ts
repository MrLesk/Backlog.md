import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Cleanup functionality", () => {
	let core: Core;

	// Sample data
	const sampleTask: Task = {
		id: "task-1",
		title: "Test Task",
		status: "Done",
		assignee: [],
		createdDate: "2025-07-21",
		labels: [],
		dependencies: [],
		body: "Test task description",
	};

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cleanup");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize backlog project
		core = new Core(TEST_DIR);
		await core.initializeProject("Cleanup Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("Core functionality", () => {
		it("should create completed directory in backlog structure", async () => {
			await core.filesystem.ensureBacklogStructure();
			expect(core.filesystem.completedDir).toBe(join(TEST_DIR, "backlog", "completed"));
		});

		it("should move Done task to completed folder", async () => {
			// Create a task
			await core.createTask(sampleTask, false);

			// Verify task exists in active tasks
			const activeTasks = await core.filesystem.listTasks();
			expect(activeTasks).toHaveLength(1);
			expect(activeTasks[0]?.id).toBe("task-1");

			// Move to completed
			const success = await core.completeTask("task-1", false);
			expect(success).toBe(true);

			// Verify task is no longer in active tasks
			const activeTasksAfter = await core.filesystem.listTasks();
			expect(activeTasksAfter).toHaveLength(0);

			// Verify task is in completed tasks
			const completedTasks = await core.filesystem.listCompletedTasks();
			expect(completedTasks).toHaveLength(1);
			expect(completedTasks[0]?.id).toBe("task-1");
			expect(completedTasks[0]?.title).toBe("Test Task");
		});
	});

	describe("getDoneTasksByAge", () => {
		it("should filter Done tasks by age", async () => {
			// Create old Done task (7 days ago)
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 7);
			const oldTask: Task = {
				...sampleTask,
				title: "Old Done Task",
				createdDate: oldDate.toISOString().split("T")[0] as string,
				updatedDate: oldDate.toISOString().split("T")[0] as string,
				body: "Old task description",
			};
			await core.createTask(oldTask, false);

			// Create recent Done task (1 day ago)
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 1);
			const recentTask: Task = {
				...sampleTask,
				id: "task-2",
				title: "Recent Done Task",
				createdDate: recentDate.toISOString().split("T")[0] as string,
				updatedDate: recentDate.toISOString().split("T")[0] as string,
				body: "Recent task description",
			};
			await core.createTask(recentTask, false);

			// Create In Progress task
			const activeTask: Task = {
				...sampleTask,
				id: "task-3",
				title: "Active Task",
				status: "In Progress",
				createdDate: oldDate.toISOString().split("T")[0] as string,
				body: "Active task description",
			};
			await core.createTask(activeTask, false);

			// Get tasks older than 3 days
			const oldTasks = await core.getDoneTasksByAge(3);
			expect(oldTasks).toHaveLength(1);
			expect(oldTasks[0]?.id).toBe("task-1");

			// Get tasks older than 0 days (should include recent task too)
			const allDoneTasks = await core.getDoneTasksByAge(0);
			expect(allDoneTasks).toHaveLength(2);
		});

		it("should handle tasks without dates", async () => {
			const task: Task = {
				...sampleTask,
				title: "Task Without Date",
				createdDate: "",
				body: "Task description",
			};
			await core.createTask(task, false);

			const oldTasks = await core.getDoneTasksByAge(1);
			expect(oldTasks).toHaveLength(0); // Should not include tasks without valid dates
		});

		it("should use updatedDate over createdDate when available", async () => {
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 10);
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 1);

			const task: Task = {
				id: "task-1",
				title: "Task with Both Dates",
				status: "Done",
				assignee: [],
				createdDate: oldDate.toISOString().split("T")[0] as string,
				updatedDate: recentDate.toISOString().split("T")[0] as string,
				labels: [],
				dependencies: [],
				body: "Task description",
			};
			await core.createTask(task, false);

			// Should use updatedDate (recent) not createdDate (old)
			const oldTasks = await core.getDoneTasksByAge(5);
			expect(oldTasks).toHaveLength(0); // updatedDate is recent, so not old enough

			const recentTasks = await core.getDoneTasksByAge(0);
			expect(recentTasks).toHaveLength(1); // updatedDate makes it recent
		});
	});

	describe("Error handling", () => {
		it("should handle non-existent task gracefully", async () => {
			const success = await core.completeTask("non-existent", false);
			expect(success).toBe(false);
		});

		it("should return empty array for listCompletedTasks when no completed tasks exist", async () => {
			const completedTasks = await core.filesystem.listCompletedTasks();
			expect(completedTasks).toHaveLength(0);
		});
	});
});
