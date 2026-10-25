import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdir, rename, stat, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { $ } from "bun";
import { Core, formatCleanupResult } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { pinTimeZone } from "./pin-timezone.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

pinTimeZone("Asia/Taipei");

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
		mock.restore();
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
		it("uses the same cleanup age for legacy and explicit UTC updates", async () => {
			const recent = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString().slice(0, 16);
			for (const [index, updatedDate] of [recent.replace("T", " "), `${recent}:00Z`].entries()) {
				await core.createTask({ ...sampleTask, id: `task-${index + 1}`, updatedDate }, false);
			}
			expect(await core.getTerminalStatusTasksByAge(1)).toEqual([]);
		});
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

		it("reads the board and archive a bounded number of times for a batch", async () => {
			const ids = Array.from({ length: 25 }, (_, index) => `TASK-${index + 1}`);
			for (const id of ids) await core.filesystem.saveTask(finished(id, id, 7));
			const boardReads = spyOn(core.filesystem, "listTasks");
			const archiveReads = spyOn(core.filesystem, "listArchivedTasks");

			const result = await core.archiveTerminalStatusTasks(ids);

			expect(result).toEqual({ archivedTaskIds: ids, skipped: [], failures: [] });
			expect(boardReads.mock.calls.length).toBeLessThanOrEqual(3);
			expect(archiveReads.mock.calls.length).toBeLessThanOrEqual(3);
		});

		it("skips a task reopened between the first read and acquiring its lock", async () => {
			await core.createTask(finished("TASK-1", "Reopened while starting cleanup", 7), false);
			const lock = core.filesystem.withTaskLock.bind(core.filesystem);
			let reopened = false;
			spyOn(core.filesystem, "withTaskLock").mockImplementation(async (task, operation) => {
				if (!reopened) {
					reopened = true;
					const current = await core.filesystem.loadTask(task.id);
					if (!current) throw new Error("Expected selected task");
					await core.filesystem.saveTask({ ...current, status: "In Progress" });
				}
				return await lock(task, operation);
			});

			const result = await core.archiveTerminalStatusTasks(["TASK-1"]);

			expect(result).toEqual({
				archivedTaskIds: [],
				skipped: [{ taskId: "TASK-1", reason: "its status is now In Progress" }],
				failures: [],
			});
			expect(await boardIds()).toEqual(["TASK-1"]);
		});

		it("reports a busy task and still archives the other selected tasks", async () => {
			await core.createTask(finished("TASK-1", "Busy", 7), false);
			await core.createTask(finished("TASK-2", "Available", 7), false);
			const busy = await core.filesystem.loadTask("TASK-1");
			if (!busy) throw new Error("Expected busy task");
			const result = await core.filesystem.withTaskLock(busy, () =>
				core.archiveTerminalStatusTasks(["TASK-1", "TASK-2"]),
			);

			expect(result.archivedTaskIds).toEqual(["TASK-2"]);
			expect(result.skipped).toEqual([]);
			expect(result.failures).toHaveLength(1);
			expect(result.failures[0]?.taskId).toBe("TASK-1");
			expect(await boardIds()).toEqual(["TASK-1"]);
		});

		it("fails closed if a second identity appears before the cleanup locks are acquired", async () => {
			await core.createTask(finished("TASK-1", "Contested while starting cleanup", 7), false);
			await core.createTask(finished("TASK-2", "Uncontested", 7), false);
			const lock = core.filesystem.withTaskLock.bind(core.filesystem);
			let added = false;
			spyOn(core.filesystem, "withTaskLock").mockImplementation(async (task, operation) => {
				if (!added) {
					added = true;
					await Bun.write(
						join(core.filesystem.archiveTasksDir, "task-01 - New claimant.md"),
						serializeTask(finished("TASK-01", "New claimant", 30)),
					);
				}
				return await lock(task, operation);
			});

			const result = await core.archiveTerminalStatusTasks(["TASK-1", "TASK-2"]);

			expect(result.archivedTaskIds).toEqual(["TASK-2"]);
			expect(result.failures[0]?.reason).toContain("ambiguous");
			expect(await boardIds()).toEqual(["TASK-1"]);
		});

		it("does not archive the same file twice through equivalent IDs", async () => {
			await core.createTask(finished("TASK-1", "One file", 7), false);

			const result = await core.archiveTerminalStatusTasks(["TASK-1", "TASK-01"]);

			expect(result).toEqual({
				archivedTaskIds: ["TASK-1"],
				skipped: [{ taskId: "TASK-01", reason: "it is no longer on the board" }],
				failures: [],
			});
		});

		it("skips equivalent IDs after a move when a busy task forces individual processing", async () => {
			await core.createTask(finished("TASK-1", "Available", 7), false);
			await core.createTask(finished("TASK-2", "Busy", 7), false);
			const busy = await core.filesystem.loadTask("TASK-2");
			if (!busy) throw new Error("Expected busy task");

			const result = await core.filesystem.withTaskLock(busy, () =>
				core.archiveTerminalStatusTasks(["TASK-1", "TASK-01", "TASK-2"]),
			);

			expect(result.archivedTaskIds).toEqual(["TASK-1"]);
			expect(result.skipped).toEqual([{ taskId: "TASK-01", reason: "it is no longer on the board" }]);
			expect(result.failures.map((failure) => failure.taskId)).toEqual(["TASK-2"]);
		});

		it("skips a task archived by another writer before the batch can lock it", async () => {
			await core.createTask(finished("TASK-1", "Available", 7), false);
			await core.createTask(finished("TASK-2", "Archived meanwhile", 7), false);
			const moved = await core.filesystem.loadTask("TASK-2");
			if (!moved?.filePath) throw new Error("Expected task file");
			const movedPath = moved.filePath;
			const lock = core.filesystem.withTaskLock.bind(core.filesystem);
			let archived = false;
			spyOn(core.filesystem, "withTaskLock").mockImplementation(async (task, operation) => {
				if (!archived) {
					archived = true;
					await rename(movedPath, join(core.filesystem.archiveTasksDir, basename(movedPath)));
				}
				return await lock(task, operation);
			});

			const result = await core.archiveTerminalStatusTasks(["TASK-1", "TASK-2"]);

			expect(result).toEqual({
				archivedTaskIds: ["TASK-1"],
				skipped: [{ taskId: "TASK-2", reason: "it is no longer on the board" }],
				failures: [],
			});
		});

		it("refuses a cross-branch identity conflict and still archives unrelated selected work", async () => {
			await core.createTask(finished("TASK-1", "Local identity", 7), false);
			await core.createTask(finished("TASK-2", "Uncontested", 7), false);
			const original = await core.filesystem.loadTask("TASK-1");
			if (!original?.filePath) throw new Error("Expected local file");
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m seed`.cwd(TEST_DIR).quiet();
			await $`git switch -c conflicting-identity`.cwd(TEST_DIR).quiet();
			await unlink(original.filePath);
			await Bun.write(
				join(core.filesystem.tasksDir, "task-1 - Different-identity.md"),
				serializeTask(finished("TASK-1", "Different identity", 7)),
			);
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m conflict`.cwd(TEST_DIR).quiet();
			await $`git switch main`.cwd(TEST_DIR).quiet();

			const result = await core.archiveTerminalStatusTasks(["TASK-1", "TASK-2"]);

			expect(result.archivedTaskIds).toEqual(["TASK-2"]);
			expect(result.failures).toHaveLength(1);
			expect(result.failures[0]?.reason).toContain("ambiguous");
			expect(await boardIds()).toEqual(["TASK-1"]);
		});

		it.each([false, true])("retries a file moved during metadata loading (selected: %s)", async (selectMoved) => {
			await core.createTask(finished("TASK-1", "Still selected", 7), false);
			await core.createTask(finished("TASK-2", "Moved during metadata read", 7), false);
			const moving = await core.filesystem.loadTask("TASK-2");
			if (!moving?.filePath) throw new Error("Expected task file");
			const movingPath = moving.filePath;
			const list = core.filesystem.listTasks.bind(core.filesystem);
			let moved = false;
			spyOn(core.filesystem, "listTasks").mockImplementation(async (...args) => {
				const tasks = await list(...args);
				if (!moved) {
					moved = true;
					await rename(movingPath, join(core.filesystem.archiveTasksDir, basename(movingPath)));
				}
				return tasks;
			});

			const result = await core.archiveTerminalStatusTasks(selectMoved ? ["TASK-1", "TASK-2"] : ["TASK-1"]);

			expect(result).toEqual({
				archivedTaskIds: ["TASK-1"],
				skipped: selectMoved ? [{ taskId: "TASK-2", reason: "it is no longer on the board" }] : [],
				failures: [],
			});
		});

		it("stops retrying a snapshot that keeps losing files", async () => {
			const missing = Object.assign(new Error("Task disappeared"), { code: "ENOENT" });
			const list = spyOn(core.filesystem, "listTasks").mockRejectedValue(missing);

			await expect(core.archiveTerminalStatusTasks(["TASK-1"])).rejects.toBe(missing);

			expect(list).toHaveBeenCalledTimes(3);
		});

		it("reports a failed commit after the move and continues with other tasks", async () => {
			await core.createTask(finished("TASK-1", "Commit fails", 7), false);
			await core.createTask(finished("TASK-2", "Commit succeeds", 7), false);
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected config");
			await core.filesystem.saveConfig({ ...config, autoCommit: true });
			const commit = spyOn(core.gitOps, "commitFiles")
				.mockRejectedValueOnce(new Error("Commit failed"))
				.mockResolvedValueOnce();

			const result = await core.archiveTerminalStatusTasks(["TASK-1", "TASK-01", "TASK-2"]);

			expect(result.archivedTaskIds).toEqual(["TASK-2"]);
			expect(result.skipped).toEqual([{ taskId: "TASK-01", reason: "it is no longer on the board" }]);
			expect(result.failures).toHaveLength(1);
			expect(result.failures[0]?.reason).toContain("was archived");
			expect(commit).toHaveBeenCalledTimes(2);
			expect(await boardIds()).toEqual([]);
			expect(await archivedIds()).toEqual(["TASK-1", "TASK-2"]);
		});

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
