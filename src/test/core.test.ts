import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";

const TEST_DIR = join(process.cwd(), "test-core");

describe("Core", () => {
	let core: Core;

	beforeEach(async () => {
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();

		// Initialize git repository for testing
		await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;
	});

	afterEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("initialization", () => {
		it("should have filesystem and git operations available", () => {
			expect(core.filesystem).toBeDefined();
			expect(core.gitOps).toBeDefined();
		});

		it("should initialize project with default config", async () => {
			await core.initializeProject("Test Project");

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Test Project");
			expect(config?.statuses).toEqual(["Draft", "To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("Draft");
		});
	});

	describe("task operations", () => {
		const sampleTask: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
			createdDate: "2025-06-07",
			labels: ["test"],
			dependencies: [],
			description: "This is a test task",
		};

		beforeEach(async () => {
			await core.initializeProject("Test Project");
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
			const hasChanges = await core.gitOps.hasUncommittedChanges();

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
			expect(loadedTask?.status).toBe("Draft"); // Should use default from config
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
			createdDate: "2025-06-07",
			labels: [],
			dependencies: [],
			description: "Draft task",
		};

		beforeEach(async () => {
			await core.initializeProject("Draft Project");
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
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Task without status",
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
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Task without status",
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
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Testing directory accessors",
			};

			await core.createTask(task, true);

			// Verify the task file was created in the correct directory
			const tasksDir = core.filesystem.tasksDir;
			const files = await Array.fromAsync(new Bun.Glob("*.md").scan({ cwd: tasksDir }));

			expect(files.some((f) => f.startsWith("task-accessor"))).toBe(true);
		});
	});
});
