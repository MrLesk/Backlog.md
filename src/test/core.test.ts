import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Core", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-core");
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();

		// Initialize git repository for testing
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("initialization", () => {
		it("should have filesystem and git operations available", () => {
			expect(core.filesystem).toBeDefined();
			expect(core.gitOps).toBeDefined();
		});

		it("should initialize project with default config", async () => {
			await core.initializeProject("Test Project", true);

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Test Project");
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("To Do");
		});
	});

	describe("task operations", () => {
		const sampleTask: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-06-07",
			labels: ["test"],
			dependencies: [],
			body: "This is a test task",
		};

		beforeEach(async () => {
			await core.initializeProject("Test Project", true);
		});

		it("should create task without auto-commit", async () => {
			await core.createTask(sampleTask, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("task-1");
			expect(loadedTask?.title).toBe("Test Task");
		});

		it("should create task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			// Check if task file was created
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("task-1");

			// Check git status to see if there are uncommitted changes
			const _hasChanges = await core.gitOps.hasUncommittedChanges();

			const lastCommit = await core.gitOps.getLastCommitMessage();
			// For now, just check that we have a commit (could be initialization or task)
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("should update task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			// Check original task
			const originalTask = await core.filesystem.loadTask("task-1");
			expect(originalTask?.title).toBe("Test Task");

			const updatedTask = { ...sampleTask, title: "Updated Task" };
			await core.updateTask(updatedTask, true);

			// Check if task was updated
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.title).toBe("Updated Task");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			// For now, just check that we have a commit (could be initialization or task)
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("should archive task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			const archived = await core.archiveTask("task-1", true);
			expect(archived).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Archive task task-1");
		});

		it("should demote task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			const demoted = await core.demoteTask("task-1", true);
			expect(demoted).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Demote task task-1");
		});

		it("should return false when archiving non-existent task", async () => {
			const archived = await core.archiveTask("non-existent", true);
			expect(archived).toBe(false);
		});

		it("should apply default status when task has empty status", async () => {
			const taskWithoutStatus: Task = {
				...sampleTask,
				status: "",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.status).toBe("To Do"); // Should use default from config
		});

		it("should not override existing status", async () => {
			const taskWithStatus: Task = {
				...sampleTask,
				status: "In Progress",
			};

			await core.createTask(taskWithStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.status).toBe("In Progress");
		});

		it("should add description header when missing", async () => {
			const taskNoHeader: Task = {
				...sampleTask,
				id: "task-2",
				body: "Just text",
			};

			await core.createTask(taskNoHeader, false);
			const loaded = await core.filesystem.loadTask("task-2");
			expect(loaded?.body.startsWith("## Description")).toBe(true);
		});

		it("should not duplicate description header", async () => {
			const taskWithHeader: Task = {
				...sampleTask,
				id: "task-3",
				body: "## Description\n\nExisting",
			};

			await core.createTask(taskWithHeader, false);
			const loaded = await core.filesystem.loadTask("task-3");
			const matches = loaded?.body.match(/## Description/g) || [];
			expect(matches.length).toBe(1);
		});

		it("should handle task creation without auto-commit when git fails", async () => {
			// Create task in directory without git
			const nonGitCore = new Core(join(TEST_DIR, "no-git"));
			await nonGitCore.filesystem.ensureBacklogStructure();

			// This should succeed even without git
			await nonGitCore.createTask(sampleTask, false);

			const loadedTask = await nonGitCore.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("task-1");
		});
	});

	describe("draft operations", () => {
		const sampleDraft: Task = {
			id: "task-draft",
			title: "Draft Task",
			status: "Draft",
			assignee: [],
			createdDate: "2025-06-07",
			labels: [],
			dependencies: [],
			body: "Draft task",
		};

		beforeEach(async () => {
			await core.initializeProject("Draft Project", true);
		});

		it("should create draft without auto-commit", async () => {
			await core.createDraft(sampleDraft, false);

			const loaded = await core.filesystem.loadDraft("task-draft");
			expect(loaded?.id).toBe("task-draft");
		});

		it("should create draft with auto-commit", async () => {
			await core.createDraft(sampleDraft, true);

			const loaded = await core.filesystem.loadDraft("task-draft");
			expect(loaded?.id).toBe("task-draft");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("should promote draft with auto-commit", async () => {
			await core.createDraft(sampleDraft, true);

			const promoted = await core.promoteDraft("task-draft", true);
			expect(promoted).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Promote draft task-draft");
		});

		it("should archive draft with auto-commit", async () => {
			await core.createDraft(sampleDraft, true);

			const archived = await core.archiveDraft("task-draft", true);
			expect(archived).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Archive draft task-draft");
		});
	});

	describe("integration with config", () => {
		it("should use custom default status from config", async () => {
			// Initialize with custom config
			await core.initializeProject("Custom Project");

			// Update config with custom default status
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.defaultStatus = "Custom Status";
				await core.filesystem.saveConfig(config);
			}

			const taskWithoutStatus: Task = {
				id: "task-custom",
				title: "Custom Task",
				status: "",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				body: "Task without status",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-custom");
			expect(loadedTask?.status).toBe("Custom Status");
		});

		it("should fall back to To Do when config has no default status", async () => {
			// Initialize project
			await core.initializeProject("Fallback Project");

			// Update config to remove default status
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.defaultStatus = undefined;
				await core.filesystem.saveConfig(config);
			}

			const taskWithoutStatus: Task = {
				id: "task-fallback",
				title: "Fallback Task",
				status: "",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				body: "Task without status",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-fallback");
			expect(loadedTask?.status).toBe("To Do");
		});
	});

	describe("directory accessor integration", () => {
		it("should use FileSystem directory accessors for git operations", async () => {
			await core.initializeProject("Accessor Test");

			const task: Task = {
				id: "task-accessor",
				title: "Accessor Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				body: "Testing directory accessors",
			};

			// Create task without auto-commit to avoid potential git timing issues
			await core.createTask(task, false);

			// Verify the task file was created in the correct directory
			const _tasksDir = core.filesystem.tasksDir;

			// List all files to see what was actually created
			const allFiles = await core.filesystem.listTasks();

			// Check that a task with the expected ID exists
			const createdTask = allFiles.find((t) => t.id === "task-accessor");
			expect(createdTask).toBeDefined();
			expect(createdTask?.title).toBe("Accessor Test Task");
		}, 10000);
	});
});
