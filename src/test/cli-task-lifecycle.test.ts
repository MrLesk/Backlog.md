import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

beforeEach(async () => {
	TEST_DIR = createUniqueTestDir("test-cli-task-lifecycle");
	await mkdir(TEST_DIR, { recursive: true });
	// Set up a git repository and initialize backlog
	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

	const core = new Core(TEST_DIR);
	await initializeTestProject(core, "Archive Test Project");
});

afterEach(async () => {
	try {
		await safeCleanup(TEST_DIR);
	} catch {
		// Ignore cleanup errors
	}
});

describe("task archive and state transition commands", () => {
	it("should archive a task", async () => {
		const core = new Core(TEST_DIR);

		// Create a test task
		await core.createTask(
			{
				id: "task-1",
				title: "Archive Test Task",
				status: "Done",
				assignee: [],
				createdDate: "2025-06-08",
				labels: ["completed"],
				dependencies: [],
				rawContent: "Task ready for archiving",
			},
			false,
		);

		// Archive the task
		const success = await core.archiveTask("task-1", false);
		expect(success).toBe(true);

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

		const success = await core.archiveTask("task-999", false);
		expect(success).toBe(false);
	});

	it("refuses to archive a Done task through the CLI archive command", async () => {
		// CLI-CONTRACT
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
				rawContent: "Terminal-status task should be completed, not archived",
			},
			false,
		);

		// CLI-CONTRACT: verifies 'task archive' on a Done task exits non-zero with specific error and redirects to 'task complete'
		const result = await $`bun ${CLI_PATH} task archive task-5`.cwd(TEST_DIR).nothrow().quiet();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).not.toBe(0);
		expect(output).toContain("Task TASK-5 is Done.");
		expect(output).toContain("Use: backlog task complete TASK-5");
		expect(await core.filesystem.loadTask("task-5")).not.toBeNull();

		const archivedTasks = await core.filesystem.listArchivedTasks();
		expect(archivedTasks.some((task) => task.id === "TASK-5")).toBe(false);
	});

	it("completes a Done task through the CLI cleanup command", async () => {
		// CLI-CONTRACT
		const core = new Core(TEST_DIR);

		await core.createTask(
			{
				id: "task-3",
				title: "Complete CLI Test Task",
				status: "Done",
				assignee: [],
				createdDate: "2025-06-08",
				labels: ["cleanup"],
				dependencies: [],
				rawContent: "Task ready for cleanup completion",
			},
			false,
		);

		// CLI-CONTRACT: verifies 'task complete' on a Done task exits 0, prints "Completed task TASK-3." with path, and moves file to completed/
		const result = await $`bun ${CLI_PATH} task complete task-3`.cwd(TEST_DIR).nothrow().quiet();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).toBe(0);
		expect(output).toContain("Completed task TASK-3.");
		expect(output).toContain(join(TEST_DIR, "backlog", "completed"));
		expect(await core.filesystem.loadTask("task-3")).toBeNull();

		const completedTasks = await core.filesystem.listCompletedTasks();
		expect(completedTasks.some((task) => task.id === "TASK-3")).toBe(true);
	});

	it("refuses to complete a non-Done task through the CLI cleanup command", async () => {
		// CLI-CONTRACT
		const core = new Core(TEST_DIR);

		await core.createTask(
			{
				id: "task-4",
				title: "Not Done CLI Test Task",
				status: "Not Done",
				assignee: [],
				createdDate: "2025-06-08",
				labels: ["cleanup"],
				dependencies: [],
				rawContent: "Task not ready for cleanup completion",
			},
			false,
		);

		// CLI-CONTRACT: verifies 'task complete' on a non-Done task exits non-zero with "Task TASK-4 is not Done." and edit suggestion
		const result = await $`bun ${CLI_PATH} task complete task-4`.cwd(TEST_DIR).nothrow().quiet();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).not.toBe(0);
		expect(output).toContain("Task TASK-4 is not Done.");
		expect(output).toContain('backlog task edit TASK-4 -s "Done"');
		expect(output).toContain("before cleanup");
		expect((await core.filesystem.loadTask("task-4"))?.status).toBe("Not Done");

		const completedTasks = await core.filesystem.listCompletedTasks();
		expect(completedTasks.some((task) => task.id === "TASK-4")).toBe(false);
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
		const success = await core.demoteTask("task-2", false);
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

		const success = await core.demoteTask("task-999", false);
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
				status: "Done",
				assignee: [],
				createdDate: "2025-06-08",
				labels: [],
				dependencies: [],
				rawContent: "Testing auto-commit on archive",
			},
			false,
		);

		const success = await core.archiveTask("task-5", true); // autoCommit = true
		expect(success).toBe(true);

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
