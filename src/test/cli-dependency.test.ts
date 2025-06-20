import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";

// Helper function to run CLI commands
function runCLI(args: string[], cwd: string) {
	return spawnSync("bun", ["run", join(__dirname, "../cli.ts"), ...args], {
		cwd,
		encoding: "utf-8",
	});
}

describe("CLI Dependency Support", () => {
	let tempDir: string;
	let core: Core;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "backlog-cli-dependency-test-"));

		// Initialize git repository first using the same pattern as other tests
		await Bun.spawn(["git", "init"], { cwd: tempDir }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: tempDir }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: tempDir }).exited;

		core = new Core(tempDir);
		await core.initializeProject("test-project");
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch (error) {
			console.warn(`Failed to clean up temp directory: ${error}`);
		}
	});

	test("should create task with single dependency using --dep", async () => {
		// Create base task first
		const result1 = runCLI(["task", "create", "Base Task"], tempDir);
		expect(result1.status).toBe(0);

		// Create task with dependency
		const result2 = runCLI(["task", "create", "Dependent Task", "--dep", "task-1"], tempDir);
		expect(result2.status).toBe(0);
		expect(result2.stdout).toContain("Created task task-2");

		// Verify dependency was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should create task with single dependency using --depends-on", async () => {
		// Create base task first
		const result1 = runCLI(["task", "create", "Base Task"], tempDir);
		expect(result1.status).toBe(0);

		// Create task with dependency
		const result2 = runCLI(["task", "create", "Dependent Task", "--depends-on", "task-1"], tempDir);
		expect(result2.status).toBe(0);
		expect(result2.stdout).toContain("Created task task-2");

		// Verify dependency was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should create task with multiple dependencies (comma-separated)", async () => {
		// Create base tasks first
		const result1 = runCLI(["task", "create", "Base Task 1"], tempDir);
		expect(result1.status).toBe(0);
		const result2 = runCLI(["task", "create", "Base Task 2"], tempDir);
		expect(result2.status).toBe(0);

		// Create task with multiple dependencies
		const result3 = runCLI(["task", "create", "Dependent Task", "--dep", "task-1,task-2"], tempDir);
		expect(result3.status).toBe(0);
		expect(result3.stdout).toContain("Created task task-3");

		// Verify dependencies were set
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should create task with multiple dependencies (multiple flags)", async () => {
		// Create base tasks first
		const result1 = runCLI(["task", "create", "Base Task 1"], tempDir);
		expect(result1.status).toBe(0);
		const result2 = runCLI(["task", "create", "Base Task 2"], tempDir);
		expect(result2.status).toBe(0);

		// Create task with multiple dependencies using multiple flags
		const result3 = runCLI(["task", "create", "Dependent Task", "--dep", "task-1", "--dep", "task-2"], tempDir);
		expect(result3.status).toBe(0);
		expect(result3.stdout).toContain("Created task task-3");

		// Verify dependencies were set
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should normalize task IDs in dependencies", async () => {
		// Create base task first
		const result1 = runCLI(["task", "create", "Base Task"], tempDir);
		expect(result1.status).toBe(0);

		// Create task with dependency using numeric ID (should be normalized to task-X)
		const result2 = runCLI(["task", "create", "Dependent Task", "--dep", "1"], tempDir);
		expect(result2.status).toBe(0);

		// Verify dependency was normalized
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should fail when dependency task does not exist", async () => {
		// Try to create task with non-existent dependency
		const result = runCLI(["task", "create", "Dependent Task", "--dep", "task-999"], tempDir);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("The following dependencies do not exist: task-999");
	});

	test("should edit task to add dependencies", async () => {
		// Create base tasks first
		const result1 = runCLI(["task", "create", "Base Task 1"], tempDir);
		expect(result1.status).toBe(0);
		const result2 = runCLI(["task", "create", "Base Task 2"], tempDir);
		expect(result2.status).toBe(0);
		const result3 = runCLI(["task", "create", "Task to Edit"], tempDir);
		expect(result3.status).toBe(0);

		// Edit task to add dependencies
		const result4 = runCLI(["task", "edit", "task-3", "--dep", "task-1,task-2"], tempDir);
		expect(result4.status).toBe(0);
		expect(result4.stdout).toContain("Updated task task-3");

		// Verify dependencies were added
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should edit task to update dependencies", async () => {
		// Create base tasks
		const result1 = runCLI(["task", "create", "Base Task 1"], tempDir);
		expect(result1.status).toBe(0);
		const result2 = runCLI(["task", "create", "Base Task 2"], tempDir);
		expect(result2.status).toBe(0);
		const result3 = runCLI(["task", "create", "Base Task 3"], tempDir);
		expect(result3.status).toBe(0);

		// Create task with initial dependency
		const result4 = runCLI(["task", "create", "Task with Dependency", "--dep", "task-1"], tempDir);
		expect(result4.status).toBe(0);

		// Edit task to change dependencies
		const result5 = runCLI(["task", "edit", "task-4", "--dep", "task-2,task-3"], tempDir);
		expect(result5.status).toBe(0);

		// Verify dependencies were updated (should replace, not append)
		const task = await core.filesystem.loadTask("task-4");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-2", "task-3"]);
	});

	test("should handle dependencies on draft tasks", async () => {
		// Create draft task first
		const result1 = runCLI(["task", "create", "Draft Task", "--draft"], tempDir);
		expect(result1.status).toBe(0);
		expect(result1.stdout).toContain("Created draft task-1");

		// Create task that depends on draft
		const result2 = runCLI(["task", "create", "Task depending on draft", "--dep", "task-1"], tempDir);
		expect(result2.status).toBe(0);

		// Verify dependency on draft was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should display dependencies in plain text view", async () => {
		// Create base task
		const result1 = runCLI(["task", "create", "Base Task"], tempDir);
		expect(result1.status).toBe(0);

		// Create task with dependency
		const result2 = runCLI(["task", "create", "Dependent Task", "--dep", "task-1"], tempDir);
		expect(result2.status).toBe(0);

		// View task in plain text mode
		const result3 = runCLI(["task", "task-2", "--plain"], tempDir);
		expect(result3.status).toBe(0);
		expect(result3.stdout).toContain("Dependencies: task-1");
	});
});
