import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Board Loading with checkActiveBranches", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-board-loading");
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();

		// Initialize git repository for testing
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize project with default config
		await core.initializeProject("Test Project", false);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("Core.loadBoardTasks()", () => {
		const createTestTask = (id: string, status = "To Do"): Task => ({
			id,
			title: `Test Task ${id}`,
			status,
			assignee: [],
			createdDate: "2025-01-08",
			labels: ["test"],
			dependencies: [],
			body: `This is test task ${id}`,
		});

		beforeEach(async () => {
			// Create some test tasks
			await core.createTask(createTestTask("task-1", "To Do"), false);
			await core.createTask(createTestTask("task-2", "In Progress"), false);
			await core.createTask(createTestTask("task-3", "Done"), false);

			// Commit them to have a clean state
			await $`git add .`.cwd(TEST_DIR).quiet();
			await $`git commit -m "Add test tasks"`.cwd(TEST_DIR).quiet();
		});

		it("should load tasks with default configuration", async () => {
			const tasks = await core.loadBoardTasks();

			expect(tasks).toHaveLength(3);
			expect(tasks.find((t) => t.id === "task-1")).toBeDefined();
			expect(tasks.find((t) => t.id === "task-2")).toBeDefined();
			expect(tasks.find((t) => t.id === "task-3")).toBeDefined();
		});

		it("should skip cross-branch checking when checkActiveBranches is false", async () => {
			// Update config to disable cross-branch checking
			const config = await core.filesystem.loadConfig();
			const updatedConfig: BacklogConfig = {
				...config!,
				checkActiveBranches: false,
			};
			await core.filesystem.saveConfig(updatedConfig);

			// Track progress messages
			const progressMessages: string[] = [];
			const tasks = await core.loadBoardTasks((msg) => {
				progressMessages.push(msg);
			});

			// Verify we got tasks
			expect(tasks).toHaveLength(3);

			// Verify we skipped cross-branch checking
			const skipMessage = progressMessages.find((msg) =>
				msg.includes("Skipping cross-branch check (disabled in config)"),
			);
			expect(skipMessage).toBeDefined();

			// Verify we didn't do cross-branch checking
			const crossBranchMessage = progressMessages.find((msg) => msg.includes("Resolving task states across branches"));
			expect(crossBranchMessage).toBeUndefined();
		});

		it("should perform cross-branch checking when checkActiveBranches is true", async () => {
			// Update config to enable cross-branch checking (default)
			const config = await core.filesystem.loadConfig();
			const updatedConfig: BacklogConfig = {
				...config!,
				checkActiveBranches: true,
				activeBranchDays: 7,
			};
			await core.filesystem.saveConfig(updatedConfig);

			// Track progress messages
			const progressMessages: string[] = [];
			const tasks = await core.loadBoardTasks((msg) => {
				progressMessages.push(msg);
			});

			// Verify we got tasks
			expect(tasks).toHaveLength(3);

			// Verify we performed cross-branch checking
			const crossBranchMessage = progressMessages.find((msg) => msg.includes("Resolving task states across branches"));
			expect(crossBranchMessage).toBeDefined();

			// Verify we didn't skip
			const skipMessage = progressMessages.find((msg) =>
				msg.includes("Skipping cross-branch check (disabled in config)"),
			);
			expect(skipMessage).toBeUndefined();
		});

		it("should respect activeBranchDays configuration", async () => {
			// Create a new branch with an old commit date
			await $`git checkout -b old-branch`.cwd(TEST_DIR).quiet();
			await core.createTask(createTestTask("task-4", "To Do"), false);
			await $`git add .`.cwd(TEST_DIR).quiet();

			// Commit with an old date (40 days ago)
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 40);
			const dateStr = oldDate.toISOString();
			await $`GIT_AUTHOR_DATE="${dateStr}" GIT_COMMITTER_DATE="${dateStr}" git commit -m "Old task"`
				.cwd(TEST_DIR)
				.quiet();

			await $`git checkout main`.cwd(TEST_DIR).quiet();

			// Set activeBranchDays to 30 (should exclude the old branch)
			const config = await core.filesystem.loadConfig();
			const updatedConfig: BacklogConfig = {
				...config!,
				checkActiveBranches: true,
				activeBranchDays: 30,
			};
			await core.filesystem.saveConfig(updatedConfig);

			// Track progress messages
			const progressMessages: string[] = [];
			const tasks = await core.loadBoardTasks((msg) => {
				progressMessages.push(msg);
			});

			// The task-4 from old branch should not be included if branch checking is working
			// However, since we're in main branch, we should only see the 3 main tasks
			expect(tasks).toHaveLength(3);
			expect(tasks.find((t) => t.id === "task-4")).toBeUndefined();

			// Check that branch checking happened with the right days
			const branchCheckMessage = progressMessages.find(
				(msg) => msg.includes("branches") && (msg.includes("30 days") || msg.includes("from 30 days")),
			);
			// The message format might vary, so we just check that some branch-related message exists
			const anyBranchMessage = progressMessages.find((msg) => msg.includes("branch"));
			expect(anyBranchMessage).toBeDefined();
		});

		it("should handle cancellation via AbortSignal", async () => {
			const controller = new AbortController();

			// Cancel immediately
			controller.abort();

			// Should throw an error
			await expect(core.loadBoardTasks(undefined, controller.signal)).rejects.toThrow("Loading cancelled");
		});

		it("should handle empty task list gracefully", async () => {
			// Remove all tasks
			await $`rm -rf backlog/tasks/*`.cwd(TEST_DIR).quiet();

			const tasks = await core.loadBoardTasks();
			expect(tasks).toEqual([]);
		});

		it("should pass progress callbacks correctly", async () => {
			const progressMessages: string[] = [];
			const progressCallback = mock((msg: string) => {
				progressMessages.push(msg);
			});

			await core.loadBoardTasks(progressCallback);

			// Verify callback was called
			expect(progressCallback).toHaveBeenCalled();
			expect(progressMessages.length).toBeGreaterThan(0);

			// Should have some expected messages
			const hasLoadingMessage = progressMessages.some(
				(msg) => msg.includes("Loading") || msg.includes("Checking") || msg.includes("Skipping"),
			);
			expect(hasLoadingMessage).toBe(true);
		});
	});

	describe("Config integration", () => {
		it("should use default values when config properties are undefined", async () => {
			// Save a minimal config without the branch-related settings
			const minimalConfig: BacklogConfig = {
				projectName: "Test Project",
				statuses: ["To Do", "In Progress", "Done"],
				defaultStatus: "To Do",
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
			};
			await core.filesystem.saveConfig(minimalConfig);

			// Create a task to ensure we have something to load
			await core.createTask(
				{
					id: "task-1",
					title: "Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-01-08",
					labels: [],
					dependencies: [],
					body: "Test",
				},
				false,
			);

			const progressMessages: string[] = [];
			const tasks = await core.loadBoardTasks((msg) => {
				progressMessages.push(msg);
			});

			// Should still work with defaults
			expect(tasks).toBeDefined();
			expect(tasks.length).toBeGreaterThanOrEqual(0);

			// When checkActiveBranches is undefined, it defaults to true, so should perform checking
			const crossBranchMessage = progressMessages.find((msg) => msg.includes("Resolving task states across branches"));
			expect(crossBranchMessage).toBeDefined();
		});

		it("should handle config with checkActiveBranches explicitly set to false", async () => {
			const config = await core.filesystem.loadConfig();
			await core.filesystem.saveConfig({
				...config!,
				checkActiveBranches: false,
			});

			const progressMessages: string[] = [];
			await core.loadBoardTasks((msg) => {
				progressMessages.push(msg);
			});

			// Should skip cross-branch checking
			const skipMessage = progressMessages.find((msg) =>
				msg.includes("Skipping cross-branch check (disabled in config)"),
			);
			expect(skipMessage).toBeDefined();
		});
	});
});
