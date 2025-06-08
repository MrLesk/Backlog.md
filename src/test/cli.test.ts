import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Core, isGitRepository } from "../index.ts";

const TEST_DIR = join(process.cwd(), "test-cli");

describe("CLI Integration", () => {
	beforeEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("backlog init command", () => {
		it("should initialize backlog project in existing git repo", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			// Initialize backlog project using Core (simulating CLI)
			const core = new Core(TEST_DIR);
			await core.initializeProject("CLI Test Project");

			// Verify directory structure was created
			const configExists = await Bun.file(join(TEST_DIR, ".backlog", "config.yml")).exists();
			expect(configExists).toBe(true);

			// Verify config content
			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("CLI Test Project");
			expect(config?.statuses).toEqual(["Draft", "To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("Draft");

			// Verify git commit was created
			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("Initialize backlog project: CLI Test Project");
		});

		it("should create all required directories", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("Directory Test");

			// Check all expected directories exist
			const expectedDirs = [
				".backlog",
				".backlog/tasks",
				".backlog/drafts",
				".backlog/archive",
				".backlog/archive/tasks",
				".backlog/archive/drafts",
				".backlog/docs",
				".backlog/decisions",
			];

			for (const dir of expectedDirs) {
				try {
					const stats = await stat(join(TEST_DIR, dir));
					expect(stats.isDirectory()).toBe(true);
				} catch {
					// If stat fails, directory doesn't exist
					expect(false).toBe(true);
				}
			}
		});

		it("should handle project names with special characters", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			const specialProjectName = "My-Project_2024 (v1.0)";
			await core.initializeProject(specialProjectName);

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe(specialProjectName);
		});

		it("should work when git repo exists", async () => {
			// Set up existing git repo
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const isRepo = await isGitRepository(TEST_DIR);
			expect(isRepo).toBe(true);

			const core = new Core(TEST_DIR);
			await core.initializeProject("Existing Repo Test");

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Existing Repo Test");
		});
	});

	describe("git integration", () => {
		beforeEach(async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;
		});

		it("should create initial commit with backlog structure", async () => {
			const core = new Core(TEST_DIR);
			await core.initializeProject("Git Integration Test");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toBe("backlog: Initialize backlog project: Git Integration Test");

			// Verify git status is clean after initialization
			const isClean = await core.gitOps.isClean();
			expect(isClean).toBe(true);
		});
	});

	describe("task archive and state transition commands", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("Archive Test Project");
		});

		it("should archive a task", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-1",
					title: "Archive Test Task",
					status: "Done",
					createdDate: "2025-06-08",
					labels: ["completed"],
					dependencies: [],
					description: "Task ready for archiving",
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
			const archiveFiles = await readdir(join(TEST_DIR, ".backlog", "archive", "tasks"));
			expect(archiveFiles.some((f) => f.startsWith("task-1"))).toBe(true);
		});

		it("should handle archiving non-existent task", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.archiveTask("task-999", false);
			expect(success).toBe(false);
		});

		it("should demote task to drafts", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-2",
					title: "Demote Test Task",
					status: "To Do",
					createdDate: "2025-06-08",
					labels: ["needs-revision"],
					dependencies: [],
					description: "Task that needs to go back to drafts",
				},
				false,
			);

			// Demote the task
			const success = await core.demoteTask("task-2", false);
			expect(success).toBe(true);

			// Verify task is no longer in tasks directory
			const task = await core.filesystem.loadTask("task-2");
			expect(task).toBeNull();

			// Verify task now exists as a draft
			const draft = await core.filesystem.loadDraft("task-2");
			expect(draft?.id).toBe("task-2");
			expect(draft?.title).toBe("Demote Test Task");
		});

		it("should promote draft to tasks", async () => {
			const core = new Core(TEST_DIR);

			// Create a test draft
			await core.createDraft(
				{
					id: "task-3",
					title: "Promote Test Draft",
					status: "Draft",
					createdDate: "2025-06-08",
					labels: ["ready"],
					dependencies: [],
					description: "Draft ready for promotion",
				},
				false,
			);

			// Promote the draft
			const success = await core.promoteDraft("task-3", false);
			expect(success).toBe(true);

			// Verify draft is no longer in drafts directory
			const draft = await core.filesystem.loadDraft("task-3");
			expect(draft).toBeNull();

			// Verify draft now exists as a task
			const task = await core.filesystem.loadTask("task-3");
			expect(task?.id).toBe("task-3");
			expect(task?.title).toBe("Promote Test Draft");
		});

		it("should archive a draft", async () => {
			const core = new Core(TEST_DIR);

			// Create a test draft
			await core.createDraft(
				{
					id: "task-4",
					title: "Archive Test Draft",
					status: "Draft",
					createdDate: "2025-06-08",
					labels: ["cancelled"],
					dependencies: [],
					description: "Draft that should be archived",
				},
				false,
			);

			// Archive the draft
			const success = await core.archiveDraft("task-4", false);
			expect(success).toBe(true);

			// Verify draft is no longer in drafts directory
			const draft = await core.filesystem.loadDraft("task-4");
			expect(draft).toBeNull();

			// Verify draft exists in archive
			const { readdir } = await import("node:fs/promises");
			const archiveFiles = await readdir(join(TEST_DIR, ".backlog", "archive", "drafts"));
			expect(archiveFiles.some((f) => f.startsWith("task-4"))).toBe(true);
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
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Testing auto-commit on archive",
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
				assignee: "testuser",
				createdDate: "2025-06-08",
				labels: ["important", "preservation-test"],
				dependencies: ["task-1", "task-2"],
				description: "This task has rich metadata that should be preserved through transitions",
			};

			await core.createTask(originalTask, false);

			// Demote to draft
			await core.demoteTask("task-6", false);
			const asDraft = await core.filesystem.loadDraft("task-6");

			expect(asDraft?.title).toBe(originalTask.title);
			expect(asDraft?.assignee).toBe(originalTask.assignee);
			expect(asDraft?.labels).toEqual(originalTask.labels);
			expect(asDraft?.dependencies).toEqual(originalTask.dependencies);
			expect(asDraft?.description).toBe(originalTask.description);

			// Promote back to task
			await core.promoteDraft("task-6", false);
			const backToTask = await core.filesystem.loadTask("task-6");

			expect(backToTask?.title).toBe(originalTask.title);
			expect(backToTask?.assignee).toBe(originalTask.assignee);
			expect(backToTask?.labels).toEqual(originalTask.labels);
			expect(backToTask?.dependencies).toEqual(originalTask.dependencies);
			expect(backToTask?.description).toBe(originalTask.description);
		});
	});
});
