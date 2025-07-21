import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Auto-commit configuration", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-auto-commit");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Configure git for tests
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await core.initializeProject("Test Auto-commit Project", true);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("Config migration", () => {
		it("should include autoCommit in default config with false value", async () => {
			const config = await core.filesystem.loadConfig();
			expect(config).toBeDefined();
			expect(config?.autoCommit).toBe(false);
		});

		it("should migrate existing config to include autoCommit", async () => {
			// Create config without autoCommit
			const oldConfig: BacklogConfig = {
				projectName: "Test Project",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
			};
			await core.filesystem.saveConfig(oldConfig);

			// Trigger migration
			await core.ensureConfigMigrated();

			const migratedConfig = await core.filesystem.loadConfig();
			expect(migratedConfig).toBeDefined();
			expect(migratedConfig?.autoCommit).toBe(false);
		});
	});

	describe("Core operations with autoCommit disabled", () => {
		beforeEach(async () => {
			// Set autoCommit to false
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.autoCommit = false;
				await core.filesystem.saveConfig(config);
			}
		});

		it("should not auto-commit when creating task with autoCommit disabled in config", async () => {
			const task: Task = {
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-07",
				labels: [],
				dependencies: [],
				body: "Test description",
			};

			await core.createTask(task);

			// Check that there are uncommitted changes
			const git = await core.getGitOps();
			const isClean = await git.isClean();
			expect(isClean).toBe(false);
		});

		it("should auto-commit when explicitly passing true to createTask", async () => {
			const task: Task = {
				id: "task-2",
				title: "Test Task 2",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-07",
				labels: [],
				dependencies: [],
				body: "Test description",
			};

			await core.createTask(task, true);

			// Check that working directory is clean (changes were committed)
			const git = await core.getGitOps();
			const isClean = await git.isClean();
			expect(isClean).toBe(true);
		});

		it("should not auto-commit when updating task with autoCommit disabled in config", async () => {
			// First create a task with explicit commit
			const task: Task = {
				id: "task-3",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-07",
				labels: [],
				dependencies: [],
				body: "Test description",
			};
			await core.createTask(task, true);

			// Update the task (should not auto-commit)
			task.title = "Updated Task";
			await core.updateTask(task);

			// Check that there are uncommitted changes
			const git = await core.getGitOps();
			const isClean = await git.isClean();
			expect(isClean).toBe(false);
		});

		it("should not auto-commit when archiving task with autoCommit disabled in config", async () => {
			// First create a task with explicit commit
			const task: Task = {
				id: "task-4",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-07",
				labels: [],
				dependencies: [],
				body: "Test description",
			};
			await core.createTask(task, true);

			// Archive the task (should not auto-commit)
			await core.archiveTask("task-4");

			// Check that there are uncommitted changes
			const git = await core.getGitOps();
			const isClean = await git.isClean();
			expect(isClean).toBe(false);
		});
	});

	describe("Core operations with autoCommit enabled", () => {
		beforeEach(async () => {
			// Set autoCommit to true
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.autoCommit = true;
				await core.filesystem.saveConfig(config);
			}

			// Commit the config change to start with a clean state
			const git = await core.getGitOps();
			await git.addFile(join(TEST_DIR, "backlog", "config.yml"));
			await git.commitChanges("Update autoCommit config for test");
		});

		it("should auto-commit when creating task with autoCommit enabled in config", async () => {
			const task: Task = {
				id: "task-5",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-07",
				labels: [],
				dependencies: [],
				body: "Test description",
			};

			await core.createTask(task);

			// Check that working directory is clean (changes were committed)
			const git = await core.getGitOps();
			const isClean = await git.isClean();
			expect(isClean).toBe(true);
		});

		it("should not auto-commit when explicitly passing false to createTask", async () => {
			const task: Task = {
				id: "task-6",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-07",
				labels: [],
				dependencies: [],
				body: "Test description",
			};

			await core.createTask(task, false);

			// Check that there are uncommitted changes
			const git = await core.getGitOps();
			const isClean = await git.isClean();
			expect(isClean).toBe(false);
		});
	});

	describe("Draft operations", () => {
		beforeEach(async () => {
			// Set autoCommit to false
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.autoCommit = false;
				await core.filesystem.saveConfig(config);
			}
		});

		it("should respect autoCommit config for draft operations", async () => {
			const task: Task = {
				id: "draft-1",
				title: "Test Draft",
				status: "Draft",
				assignee: [],
				createdDate: "2025-07-07",
				labels: [],
				dependencies: [],
				body: "Test description",
			};

			await core.createDraft(task);

			// Check that there are uncommitted changes
			const git = await core.getGitOps();
			const isClean = await git.isClean();
			expect(isClean).toBe(false);
		});

		it("should respect autoCommit config for promote draft operations", async () => {
			// First create a draft with explicit commit
			const task: Task = {
				id: "draft-2",
				title: "Test Draft",
				status: "Draft",
				assignee: [],
				createdDate: "2025-07-07",
				labels: [],
				dependencies: [],
				body: "Test description",
			};
			await core.createDraft(task, true);

			// Promote the draft (should not auto-commit)
			await core.promoteDraft("draft-2");

			// Check that there are uncommitted changes
			const git = await core.getGitOps();
			const isClean = await git.isClean();
			expect(isClean).toBe(false);
		});
	});
});
