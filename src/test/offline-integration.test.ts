import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig } from "../types/index.ts";

describe("Offline Integration Tests", () => {
	let tempDir: string;
	let core: Core;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "backlog-offline-integration-"));

		// Initialize a git repo without remote
		await $`git init`.cwd(tempDir).quiet();
		await $`git config user.email test@example.com`.cwd(tempDir).quiet();
		await $`git config user.name "Test User"`.cwd(tempDir).quiet();

		// Create initial commit
		await writeFile(join(tempDir, "README.md"), "# Test Project");
		await $`git add README.md`.cwd(tempDir).quiet();
		await $`git commit -m "Initial commit"`.cwd(tempDir).quiet();

		// Create basic backlog structure
		const backlogDir = join(tempDir, "backlog");
		await mkdir(backlogDir, { recursive: true });
		await mkdir(join(backlogDir, "tasks"), { recursive: true });
		await mkdir(join(backlogDir, "drafts"), { recursive: true });

		// Create config with remote operations disabled
		const config: BacklogConfig = {
			projectName: "Offline Test Project",
			statuses: ["To Do", "In Progress", "Done"],
			labels: ["bug", "feature"],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		};

		await writeFile(
			join(backlogDir, "config.yml"),
			`project_name: "${config.projectName}"
statuses: ["To Do", "In Progress", "Done"]
labels: ["bug", "feature"]
milestones: []
date_format: YYYY-MM-DD
backlog_directory: "backlog"
remote_operations: false
`,
		);

		core = new Core(tempDir);
	});

	afterEach(async () => {
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("should work in offline mode without remote", async () => {
		// Ensure config migration works with remoteOperations
		await core.ensureConfigMigrated();
		const config = await core.filesystem.loadConfig();
		expect(config?.remoteOperations).toBe(false);

		// Create a task - this should work without any remote operations
		const task = {
			id: "task-1",
			title: "Test task in offline mode",
			body: "This task should be created without remote operations",
			status: "To Do",
			assignee: [],
			createdDate: new Date().toISOString().split("T")[0] ?? "",
			updatedDate: new Date().toISOString().split("T")[0] ?? "",
			labels: ["feature"],
			dependencies: [],
			priority: "medium" as const,
		};

		const filepath = await core.createTask(task);
		expect(filepath).toContain("task-1");

		// List tasks should work without remote operations
		const tasks = await core.listTasksWithMetadata();
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.id).toBe("task-1");
		expect(tasks[0]?.title).toBe("Test task in offline mode");
	});

	it("should handle task ID generation in offline mode", async () => {
		// Create multiple tasks to test ID generation
		const task1 = {
			id: "task-1",
			title: "First task",
			body: "First task description",
			status: "To Do",
			assignee: [],
			createdDate: new Date().toISOString().split("T")[0] ?? "",
			updatedDate: new Date().toISOString().split("T")[0] ?? "",
			labels: [],
			dependencies: [],
			priority: "medium" as const,
		};

		const task2 = {
			id: "task-2",
			title: "Second task",
			body: "Second task description",
			status: "In Progress",
			assignee: [],
			createdDate: new Date().toISOString().split("T")[0] ?? "",
			updatedDate: new Date().toISOString().split("T")[0] ?? "",
			labels: [],
			dependencies: [],
			priority: "high" as const,
		};

		await core.createTask(task1);
		await core.createTask(task2);

		const tasks = await core.listTasksWithMetadata();
		expect(tasks).toHaveLength(2);

		const taskIds = tasks.map((t) => t.id);
		expect(taskIds).toContain("task-1");
		expect(taskIds).toContain("task-2");
	});

	it("should handle repository without remote origin gracefully", async () => {
		// Try to verify that git operations don't fail when there's no remote
		// This simulates a local-only git repository

		// Get git operations instance
		const gitOps = await core.getGitOps();

		// These operations should not fail even without remote
		try {
			await gitOps.fetch();
			// Should complete without error due to remoteOperations: false
		} catch (error) {
			// If it does error, it should be handled gracefully
			expect(error).toBeUndefined();
		}

		// Verify that we can still work with local git operations
		const lastCommit = await gitOps.getLastCommitMessage();
		// Should be empty or the initial commit
		expect(typeof lastCommit).toBe("string");
	});

	it("should work with config command to set remoteOperations", async () => {
		// Load initial config
		const initialConfig = await core.filesystem.loadConfig();
		expect(initialConfig?.remoteOperations).toBe(false);

		// Simulate config set command
		const updatedConfig = { ...initialConfig, remoteOperations: true };
		await core.filesystem.saveConfig(updatedConfig as any);

		// Verify config was updated
		const newConfig = await core.filesystem.loadConfig();
		expect(newConfig?.remoteOperations).toBe(true);

		// Test changing it back
		const finalConfig = { ...newConfig, remoteOperations: false };
		await core.filesystem.saveConfig(finalConfig as any);

		const verifyConfig = await core.filesystem.loadConfig();
		expect(verifyConfig?.remoteOperations).toBe(false);
	});

	it("should migrate existing configs to include remoteOperations", async () => {
		// Create a config without remoteOperations field
		const backlogDir = join(tempDir, "backlog");
		await writeFile(
			join(backlogDir, "config.yml"),
			`project_name: "Legacy Project"
statuses: ["To Do", "Done"]
labels: []
milestones: []
date_format: YYYY-MM-DD
backlog_directory: "backlog"
`,
		);

		// Create new Core instance to trigger migration
		const legacyCore = new Core(tempDir);
		await legacyCore.ensureConfigMigrated();

		// Verify that remoteOperations was added with default value
		const migratedConfig = await legacyCore.filesystem.loadConfig();
		expect(migratedConfig?.remoteOperations).toBe(true); // Default should be true
		expect(migratedConfig?.projectName).toBe("Legacy Project");
	});

	it("should handle loadRemoteTasks in offline mode", async () => {
		const config = await core.filesystem.loadConfig();
		expect(config?.remoteOperations).toBe(false);

		// Import loadRemoteTasks
		const { loadRemoteTasks } = await import("../core/remote-tasks.ts");

		const progressMessages: string[] = [];
		const remoteTasks = await loadRemoteTasks(core.gitOps, core.filesystem, config, (msg) =>
			progressMessages.push(msg),
		);

		// Should return empty array and skip remote operations
		expect(remoteTasks).toEqual([]);
		expect(progressMessages).toContain("Remote operations disabled - skipping remote tasks");
	});
});
