import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core, formatCleanupResult } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

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
		rawContent: "Test task description",
	};

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cleanup");
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo
		await $`git init -b main`.cwd(TEST_DIR).quiet();

		// Initialize backlog project
		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Cleanup Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("Core functionality", () => {
		it("creates the archive folder, and no completed folder, in the backlog structure", async () => {
			await core.filesystem.ensureBacklogStructure();
			expect(core.filesystem.archiveTasksDir).toBe(join(TEST_DIR, "backlog", "archive", "tasks"));
			expect((await stat(core.filesystem.archiveTasksDir)).isDirectory()).toBe(true);
			expect(await stat(join(TEST_DIR, "backlog", "completed")).catch(() => null)).toBeNull();
		});

		it("should move a Done task into the archive", async () => {
			// Create a task
			await core.createTask(sampleTask, false);

			// Verify task exists in active tasks
			const activeTasks = await core.filesystem.listTasks();
			expect(activeTasks).toHaveLength(1);
			expect(activeTasks[0]?.id).toBe("TASK-1");

			const success = await core.archiveTask("task-1", false);
			expect(success).toBe(true);

			// Verify task is no longer in active tasks
			const activeTasksAfter = await core.filesystem.listTasks();
			expect(activeTasksAfter).toHaveLength(0);

			// Verify task is in the archive, with its ID
			const archivedTasks = await core.filesystem.listArchivedTasks();
			expect(archivedTasks).toHaveLength(1);
			expect(archivedTasks[0]?.id).toBe("TASK-1");
			expect(archivedTasks[0]?.title).toBe("Test Task");
		});

		it("archives a task that is not in the final status", async () => {
			await core.createTask(
				{
					...sampleTask,
					id: "task-2",
					title: "Not Done Task",
					status: "Not Done",
				},
				false,
			);

			const success = await core.archiveTask("task-2", false);
			expect(success).toBe(true);
			expect(await core.filesystem.loadTask("task-2")).toBeNull();

			const archivedTasks = await core.filesystem.listArchivedTasks();
			expect(archivedTasks).toHaveLength(1);
			expect(archivedTasks[0]?.id).toBe("TASK-2");
			expect(archivedTasks[0]?.status).toBe("Not Done");
		});
	});

	describe("getTerminalStatusTasksByAge", () => {
		it("should filter Done tasks by age", async () => {
			// Create old Done task (7 days ago)
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 7);
			const oldTask: Task = {
				...sampleTask,
				title: "Old Done Task",
				createdDate: oldDate.toISOString().split("T")[0] as string,
				updatedDate: oldDate.toISOString().split("T")[0] as string,
				rawContent: "Old task description",
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
				rawContent: "Recent task description",
			};
			await core.createTask(recentTask, false);

			// Create In Progress task
			const activeTask: Task = {
				...sampleTask,
				id: "task-3",
				title: "Active Task",
				status: "In Progress",
				createdDate: oldDate.toISOString().split("T")[0] as string,
				rawContent: "Active task description",
			};
			await core.createTask(activeTask, false);

			// Get tasks older than 3 days
			const oldTasks = await core.getTerminalStatusTasksByAge(3);
			expect(oldTasks).toHaveLength(1);
			expect(oldTasks[0]?.id).toBe("TASK-1");

			// Get tasks older than 0 days (should include recent task too)
			const allDoneTasks = await core.getTerminalStatusTasksByAge(0);
			expect(allDoneTasks).toHaveLength(2);
		});

		it("uses the final configured status as the cleanup status", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected test project config to exist");
			}
			await core.filesystem.saveConfig({
				...config,
				statuses: ["To Do", "Review", "Closed"],
				defaultStatus: "To Do",
			});

			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 7);
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 1);
			const oldDateValue = oldDate.toISOString().split("T")[0] as string;
			const recentDateValue = recentDate.toISOString().split("T")[0] as string;

			await core.createTask(
				{
					...sampleTask,
					id: "task-1",
					title: "Old Closed Task",
					status: "Closed",
					createdDate: oldDateValue,
					updatedDate: oldDateValue,
				},
				false,
			);
			await core.createTask(
				{
					...sampleTask,
					id: "task-2",
					title: "Recent Closed Task",
					status: "Closed",
					createdDate: recentDateValue,
					updatedDate: recentDateValue,
				},
				false,
			);
			await core.createTask(
				{
					...sampleTask,
					id: "task-3",
					title: "Old Review Task",
					status: "Review",
					createdDate: oldDateValue,
					updatedDate: oldDateValue,
				},
				false,
			);
			await core.createTask(
				{
					...sampleTask,
					id: "task-4",
					title: "Old Literal Done Task",
					status: "Done",
					createdDate: oldDateValue,
					updatedDate: oldDateValue,
				},
				false,
			);

			const oldTasks = await core.getTerminalStatusTasksByAge(3);
			expect(oldTasks.map((task) => task.id)).toEqual(["TASK-1"]);

			const allTerminalTasks = await core.getTerminalStatusTasksByAge(0);
			expect(allTerminalTasks.map((task) => task.id).sort()).toEqual(["TASK-1", "TASK-2"]);
		});

		it("does not collapse internal spaces when matching the cleanup status", async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected test project config to exist");
			}
			await core.filesystem.saveConfig({
				...config,
				statuses: ["To Do", "In Progress", "InProgress"],
				defaultStatus: "To Do",
			});

			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 7);
			const oldDateValue = oldDate.toISOString().split("T")[0] as string;

			await core.createTask(
				{
					...sampleTask,
					id: "task-1",
					title: "Old Terminal Task",
					status: "InProgress",
					createdDate: oldDateValue,
					updatedDate: oldDateValue,
				},
				false,
			);
			await core.createTask(
				{
					...sampleTask,
					id: "task-2",
					title: "Old Non-Terminal Task",
					status: "In Progress",
					createdDate: oldDateValue,
					updatedDate: oldDateValue,
				},
				false,
			);

			const oldTasks = await core.getTerminalStatusTasksByAge(3);
			expect(oldTasks.map((task) => task.id)).toEqual(["TASK-1"]);
		});

		it("should handle tasks without dates", async () => {
			const task: Task = {
				...sampleTask,
				title: "Task Without Date",
				createdDate: "",
				rawContent: "Task description",
			};
			await core.createTask(task, false);

			const oldTasks = await core.getTerminalStatusTasksByAge(1);
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
				rawContent: "Task description",
			};
			await core.createTask(task, false);

			// Should use updatedDate (recent) not createdDate (old)
			const oldTasks = await core.getTerminalStatusTasksByAge(5);
			expect(oldTasks).toHaveLength(0); // updatedDate is recent, so not old enough

			const recentTasks = await core.getTerminalStatusTasksByAge(0);
			expect(recentTasks).toHaveLength(1); // updatedDate makes it recent
		});
	});

	describe("archiveTerminalStatusTasks", () => {
		const daysAgo = (days: number): string => {
			const date = new Date();
			date.setDate(date.getDate() - days);
			return date.toISOString().split("T")[0] as string;
		};
		const finished = (id: string, title: string, days: number): Task => ({
			...sampleTask,
			id,
			title,
			createdDate: daysAgo(days),
			updatedDate: daysAgo(days),
		});
		/** What a caller shows the user before it asks for confirmation. */
		const selectOlderThan = async (days: number) =>
			(await core.getTerminalStatusTasksByAge(days)).map((task) => task.id);
		const boardIds = async () => (await core.filesystem.listTasks()).map((task) => task.id);
		const archivedIds = async () => (await core.filesystem.listArchivedTasks()).map((task) => task.id);

		it("archives the selected tasks and leaves the rest on the board", async () => {
			await core.createTask(finished("task-1", "Old finished", 7), false);
			await core.createTask(finished("task-2", "Recent finished", 1), false);
			await core.createTask({ ...finished("task-3", "Old unfinished", 7), status: "In Progress" }, false);

			const result = await core.archiveTerminalStatusTasks(await selectOlderThan(3));

			expect(result).toEqual({ archivedTaskIds: ["TASK-1"], skipped: [], failures: [] });
			expect(await boardIds()).toEqual(["TASK-2", "TASK-3"]);
			expect(await archivedIds()).toEqual(["TASK-1"]);
		});

		it("does not archive a task that became eligible after the selection", async () => {
			await core.createTask(finished("task-1", "Shown and confirmed", 7), false);
			const selected = await selectOlderThan(3);
			// A second finished task of the same age appears while the confirmation is open.
			await core.createTask(finished("task-2", "Appeared later", 7), false);
			expect(await selectOlderThan(3)).toEqual(["TASK-1", "TASK-2"]);

			const result = await core.archiveTerminalStatusTasks(selected);

			expect(result).toEqual({ archivedTaskIds: ["TASK-1"], skipped: [], failures: [] });
			expect(await boardIds()).toEqual(["TASK-2"]);
			expect(await archivedIds()).toEqual(["TASK-1"]);
		});

		it("skips a selected task that has left the final status or the board, with the reason", async () => {
			await core.createTask(finished("task-1", "Reopened", 7), false);
			await core.createTask(finished("task-2", "Archived meanwhile", 7), false);
			await core.createTask(finished("task-3", "Still finished", 7), false);
			const selected = await selectOlderThan(3);
			await core.updateTaskFromInput("task-1", { status: "In Progress" }, false);
			await core.archiveTask("task-2", false);

			const result = await core.archiveTerminalStatusTasks(selected);

			expect(result).toEqual({
				archivedTaskIds: ["TASK-3"],
				skipped: [
					{ taskId: "TASK-1", reason: "its status is now In Progress" },
					{ taskId: "TASK-2", reason: "it is no longer on the board" },
				],
				failures: [],
			});
			expect(await boardIds()).toEqual(["TASK-1"]);
			expect(await archivedIds()).toEqual(["TASK-2", "TASK-3"]);
		});

		it("reports a task that cannot be archived with the reason and still archives the others", async () => {
			await core.createTask(finished("task-1", "Contested", 7), false);
			await core.createTask(finished("task-2", "Old finished", 7), false);
			const selected = await selectOlderThan(3);
			// A second record claims TASK-1, so archiving it fails closed.
			await Bun.write(
				join(core.filesystem.archiveTasksDir, "task-01 - Other claimant.md"),
				serializeTask({ ...finished("TASK-01", "Other claimant", 30) }),
			);

			const result = await core.archiveTerminalStatusTasks(selected);

			expect(result.archivedTaskIds).toEqual(["TASK-2"]);
			expect(result.skipped).toEqual([]);
			expect(result.failures.map((failure) => failure.taskId)).toEqual(["TASK-1"]);
			expect(result.failures[0]?.reason).toContain("ambiguous");
			expect(await boardIds()).toEqual(["TASK-1"]);
		});

		it("words the result in the lines `backlog cleanup` and the browser both show", () => {
			const lines = formatCleanupResult(
				{
					archivedTaskIds: ["TASK-3"],
					skipped: [{ taskId: "TASK-1", reason: "its status is now In Progress" }],
					failures: [{ taskId: "TASK-2", reason: "permission denied" }],
				},
				3,
			);

			expect(lines).toEqual({
				skipped: ["Skipped task TASK-1: its status is now In Progress"],
				failed: ["Failed to archive task TASK-2: permission denied"],
				summary: "Successfully archived 1 of 3 tasks.",
			});
		});
	});

	describe("Error handling", () => {
		it("should handle non-existent task gracefully", async () => {
			const success = await core.archiveTask("non-existent", false);
			expect(success).toBe(false);
		});

		it("should return empty array for listArchivedTasks when no archived tasks exist", async () => {
			const archivedTasks = await core.filesystem.listArchivedTasks();
			expect(archivedTasks).toHaveLength(0);
		});
	});
});
