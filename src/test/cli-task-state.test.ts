import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

describe("CLI Integration", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("task archive and state transition commands", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog

			const core = new Core(TEST_DIR);
			await initializeFilesystemTestProject(core, "Archive Test Project");
		});

		it("should archive a task", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-1",
					title: "Archive Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["canceled"],
					dependencies: [],
					rawContent: "Task ready for archiving",
				},
				false,
			);

			// Archive the task
			expect(await core.archiveTask("task-1", false)).toBe(true);

			// Verify task is no longer in tasks directory
			const task = await core.filesystem.loadTask("task-1");
			expect(task).toBeNull();

			// Verify task exists in archive
			const { readdir } = await import("node:fs/promises");
			const archiveFiles = await readdir(join(TEST_DIR, "backlog", "archive", "tasks"));
			expect(archiveFiles.some((f) => f.startsWith("task-1"))).toBe(true);
		});

		it("should handle archiving non-existent task", async () => {
			const core = new Core(TEST_DIR);

			expect(await core.archiveTask("task-999", false)).toBe(false);
		});

		it("archives a Done task through the CLI and keeps its ID reserved", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-5",
					title: "Done CLI Archive Test Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["archive"],
					dependencies: [],
					rawContent: "Finished work leaves the board through archive",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task archive task-5`.cwd(TEST_DIR).nothrow().quiet();
			const output = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(0);
			expect(output).toContain("Archived task TASK-5");
			expect(await core.filesystem.loadTask("task-5")).toBeNull();

			const archivedTasks = await core.filesystem.listArchivedTasks();
			expect(archivedTasks.map((task) => [task.id, task.status])).toEqual([["TASK-5", "Done"]]);

			const view = await $`bun ${CLI_PATH} task view task-5 --plain`.cwd(TEST_DIR).nothrow().quiet();
			expect(view.exitCode).toBe(0);
			expect(view.stdout.toString()).toContain(join("backlog", "archive", "tasks"));
			expect(view.stdout.toString()).toContain("Status: ✔ Done (archived)");

			const created = await $`bun ${CLI_PATH} task create "After archive" --plain`.cwd(TEST_DIR).nothrow().quiet();
			expect(created.exitCode).toBe(0);
			expect(created.stdout.toString()).toContain("Task TASK-6 - After archive");
		});

		it("answers the removed complete command with one line that names archive, and changes nothing", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-3",
					title: "Finished CLI Test Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["cleanup"],
					dependencies: [],
					rawContent: "A finished task on the board",
				},
				false,
			);
			const before = await Bun.file((await core.filesystem.loadTask("task-3"))?.filePath ?? "").text();

			// Whatever follows the name, the answer is the notice: it is not a command with arguments.
			for (const args of [["task-3"], [], ["task-3", "--plain"], ["--help"]]) {
				const result = await $`bun ${[CLI_PATH, "task", "complete", ...args]}`.cwd(TEST_DIR).nothrow().quiet();

				expect(result.exitCode).toBe(1);
				expect(result.stderr.toString()).toBe("backlog task complete was removed. Use backlog task archive <id>.\n");
				expect(result.stdout.toString()).toBe("");
			}
			const task = await core.filesystem.loadTask("task-3");
			expect(task?.status).toBe("Done");
			expect(await Bun.file(task?.filePath ?? "").text()).toBe(before);
			expect(await core.filesystem.listArchivedTasks()).toEqual([]);

			const help = await $`bun ${CLI_PATH} task --help`.cwd(TEST_DIR).nothrow().quiet();
			expect(help.stdout.toString()).toContain("archive <taskId>");
			expect(help.stdout.toString()).not.toContain("complete");
		});

		it("refuses to change an archived task and says that it is archived", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-4",
					title: "Archived CLI Test Task",
					status: "Not Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["cleanup"],
					dependencies: [],
					rawContent: "Work that was set aside",
				},
				false,
			);
			expect(await core.archiveTask("task-4", false)).toBe(true);
			const archivedPath = (await core.filesystem.listArchivedTasks())[0]?.filePath ?? "";
			const before = await Bun.file(archivedPath).text();

			for (const command of [
				["task", "edit", "task-4", "--append-notes", "late note"],
				["task", "edit", "task-4", "-s", "Done"],
				["task", "archive", "task-4"],
				["task", "demote", "task-4"],
			]) {
				const result = await $`bun ${CLI_PATH} ${command}`.cwd(TEST_DIR).nothrow().quiet();
				const output = result.stdout.toString() + result.stderr.toString();

				expect(result.exitCode).not.toBe(0);
				expect(output).toContain("Task TASK-4 is archived. Archived tasks are read-only.");
				expect(output).not.toContain("not found");
			}
			expect(await Bun.file(archivedPath).text()).toBe(before);
		});

		it("should demote task to drafts", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-2",
					title: "Demote Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["needs-revision"],
					dependencies: [],
					rawContent: "Task that needs to go back to drafts",
				},
				false,
			);

			// Demote the task
			const { success } = await core.demoteTask("task-2", false);
			expect(success).toBe(true);

			// Verify task is no longer in tasks directory
			const task = await core.filesystem.loadTask("task-2");
			expect(task).toBeNull();

			// Verify demoted draft has new draft- ID
			const { readdir } = await import("node:fs/promises");
			const draftsFiles = await readdir(join(TEST_DIR, "backlog", "drafts"));
			expect(draftsFiles.some((f) => f.startsWith("draft-"))).toBe(true);

			// Verify draft can be loaded with draft- ID
			const demotedDraft = await core.filesystem.loadDraft("draft-1");
			expect(demotedDraft?.title).toBe("Demote Test Task");
		});

		it("should promote draft to tasks", async () => {
			const core = new Core(TEST_DIR);

			// Create a test draft through the canonical create path
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Promote Test Draft",
					status: "Draft",
					labels: ["ready"],
					rawContent: "Draft ready for promotion",
				},
				false,
			);

			// Promote the draft
			const success = await core.promoteDraft(draft.id, false);
			expect(success).toBe(true);

			// Verify draft is no longer in drafts directory
			const loadedDraft = await core.filesystem.loadDraft(draft.id);
			expect(loadedDraft).toBeNull();

			// Verify promoted task has new task- ID
			const { readdir } = await import("node:fs/promises");
			const tasksFiles = await readdir(join(TEST_DIR, "backlog", "tasks"));
			expect(tasksFiles.some((f) => f.startsWith("task-"))).toBe(true);

			// Verify task can be loaded with task- ID
			const promotedTask = await core.filesystem.loadTask("task-1");
			expect(promotedTask?.title).toBe("Promote Test Draft");
		});

		it("should archive a draft", async () => {
			const core = new Core(TEST_DIR);

			// Create a test draft through the canonical create path
			const { task: draft } = await core.createTaskFromInput(
				{
					title: "Archive Test Draft",
					status: "Draft",
					labels: ["cancelled"],
					rawContent: "Draft that should be archived",
				},
				false,
			);

			// Archive the draft
			const success = await core.archiveDraft(draft.id, false);
			expect(success).toBe(true);

			// Verify draft is no longer in drafts directory
			const loadedDraft = await core.filesystem.loadDraft(draft.id);
			expect(loadedDraft).toBeNull();

			// Verify draft exists in archive
			const { readdir } = await import("node:fs/promises");
			const archiveFiles = await readdir(join(TEST_DIR, "backlog", "archive", "drafts"));
			expect(archiveFiles.some((f) => f.startsWith(draft.id.toLowerCase()))).toBe(true);
		});

		it("should handle promoting non-existent draft", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.promoteDraft("task-999", false);
			expect(success).toBe(false);
		});

		it("should handle demoting non-existent task", async () => {
			const core = new Core(TEST_DIR);

			const { success } = await core.demoteTask("task-999", false);
			expect(success).toBe(false);
		});

		it("should handle archiving non-existent draft", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.archiveDraft("task-999", false);
			expect(success).toBe(false);
		});

		it("should commit archive operations automatically", async () => {
			const core = new Core(TEST_DIR);

			// Create and archive a task with auto-commit
			await core.createTask(
				{
					id: "task-5",
					title: "Commit Archive Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Testing auto-commit on archive",
				},
				false,
			);

			expect(await core.archiveTask("task-5", true)).toBe(true); // autoCommit = true

			// Verify operation completed successfully
			const task = await core.filesystem.loadTask("task-5");
			expect(task).toBeNull();
		});

		it("should preserve task content through state transitions", async () => {
			const core = new Core(TEST_DIR);

			// Create a task with rich content
			const originalTask = {
				id: "task-6",
				title: "Content Preservation Test",
				status: "In Progress",
				assignee: ["testuser"],
				createdDate: "2025-06-08",
				labels: ["important", "preservation-test"],
				dependencies: ["task-1", "task-2"],
				rawContent: "This task has rich metadata that should be preserved through transitions",
			};

			await core.createTask(originalTask, false);

			// Demote to draft - note: this generates a new draft ID
			await core.demoteTask("task-6", false);

			// Find the demoted draft (it will have a new draft- ID)
			const drafts = await core.filesystem.listDrafts();
			const asDraft = drafts.find((d) => d.title === originalTask.title);

			expect(asDraft?.title).toBe(originalTask.title);
			expect(asDraft?.assignee).toEqual(originalTask.assignee);
			expect(asDraft?.labels).toEqual(originalTask.labels);
			expect(asDraft?.dependencies).toEqual(originalTask.dependencies);
			expect(asDraft?.rawContent).toContain(originalTask.rawContent);

			// Promote back to task - use the draft's new ID
			expect(asDraft).toBeDefined();
			if (!asDraft) {
				throw new Error("Expected demoted draft to exist");
			}
			await core.promoteDraft(asDraft.id, false);

			// Find the promoted task (it will have a new task- ID)
			const tasks = await core.filesystem.listTasks();
			const backToTask = tasks.find((t) => t.title === originalTask.title);

			expect(backToTask?.title).toBe(originalTask.title);
			expect(backToTask?.assignee).toEqual(originalTask.assignee);
			expect(backToTask?.labels).toEqual(originalTask.labels);
			expect(backToTask?.dependencies).toEqual(originalTask.dependencies);
			expect(backToTask?.rawContent).toContain(originalTask.rawContent);
		});
	});
});
