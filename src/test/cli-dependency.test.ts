import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

// Helper function to run CLI commands with async API to avoid OOM issues
async function runCLI(args: string[], cwd: string) {
	const childProcess = Bun.spawn(["bun", join(process.cwd(), "src", "cli.ts"), ...args], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await childProcess.exited;
	const stdout = await new Response(childProcess.stdout).text();
	const stderr = await new Response(childProcess.stderr).text();

	return { exitCode, stdout, stderr };
}

describe("CLI Dependency Support", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-dependency");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repository first using the same pattern as other tests
		await Bun.spawn(["git", "init", "-b", "main"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

		core = new Core(TEST_DIR);
		await core.initializeProject("test-project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	test("should create task with single dependency using --dep", async () => {
		// Create base task first
		const result1 = await runCLI(["task", "create", "Base Task"], TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await runCLI(["task", "create", "Dependent Task", "--dep", "task-1"], TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task task-2");

		// Verify dependency was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should create task with single dependency using --depends-on", async () => {
		// Create base task first
		const result1 = await runCLI(["task", "create", "Base Task"], TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await runCLI(["task", "create", "Dependent Task", "--depends-on", "task-1"], TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task task-2");

		// Verify dependency was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should create task with multiple dependencies (comma-separated)", async () => {
		// Create base tasks first
		const result1 = await runCLI(["task", "create", "Base Task 1"], TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await runCLI(["task", "create", "Base Task 2"], TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// Create task with multiple dependencies
		const result3 = await runCLI(["task", "create", "Dependent Task", "--dep", "task-1,task-2"], TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Created task task-3");

		// Verify dependencies were set
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should create task with multiple dependencies (multiple flags)", async () => {
		// Create base tasks first
		const result1 = await runCLI(["task", "create", "Base Task 1"], TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await runCLI(["task", "create", "Base Task 2"], TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// Create task with multiple dependencies using multiple flags
		const result3 = await runCLI(["task", "create", "Dependent Task", "--dep", "task-1", "--dep", "task-2"], TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Created task task-3");

		// Verify dependencies were set
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should normalize task IDs in dependencies", async () => {
		// Create base task first
		const result1 = await runCLI(["task", "create", "Base Task"], TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency using numeric ID (should be normalized to task-X)
		const result2 = await runCLI(["task", "create", "Dependent Task", "--dep", "1"], TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task task-2");

		// Verify dependency was normalized
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should fail when dependency task does not exist", async () => {
		// Try to create task with non-existent dependency
		const result = await runCLI(["task", "create", "Dependent Task", "--dep", "task-999"], TEST_DIR);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("The following dependencies do not exist: task-999");
	});

	test("should edit task to add dependencies", async () => {
		// Create base tasks first
		const result1 = await runCLI(["task", "create", "Base Task 1"], TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await runCLI(["task", "create", "Base Task 2"], TEST_DIR);
		expect(result2.exitCode).toBe(0);
		const result3 = await runCLI(["task", "create", "Task to Edit"], TEST_DIR);
		expect(result3.exitCode).toBe(0);

		// Edit task to add dependencies
		const result4 = await runCLI(["task", "edit", "task-3", "--dep", "task-1,task-2"], TEST_DIR);
		expect(result4.exitCode).toBe(0);
		expect(result4.stdout).toContain("Updated task task-3");

		// Verify dependencies were added
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should edit task to update dependencies", async () => {
		// Create base tasks
		const result1 = await runCLI(["task", "create", "Base Task 1"], TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await runCLI(["task", "create", "Base Task 2"], TEST_DIR);
		expect(result2.exitCode).toBe(0);
		const result3 = await runCLI(["task", "create", "Base Task 3"], TEST_DIR);
		expect(result3.exitCode).toBe(0);

		// Create task with initial dependency
		const result4 = await runCLI(["task", "create", "Task with Dependency", "--dep", "task-1"], TEST_DIR);
		expect(result4.exitCode).toBe(0);

		// Edit task to change dependencies
		const result5 = await runCLI(["task", "edit", "task-4", "--dep", "task-2,task-3"], TEST_DIR);
		expect(result5.exitCode).toBe(0);

		// Verify dependencies were updated (should replace, not append)
		const task = await core.filesystem.loadTask("task-4");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-2", "task-3"]);
	});

	test("should handle dependencies on draft tasks", async () => {
		// Create draft task first
		const result1 = await runCLI(["task", "create", "Draft Task", "--draft"], TEST_DIR);
		expect(result1.exitCode).toBe(0);
		expect(result1.stdout).toContain("Created draft task-1");

		// Create task that depends on draft
		const result2 = await runCLI(["task", "create", "Task depending on draft", "--dep", "task-1"], TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// Verify dependency on draft was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should display dependencies in plain text view", async () => {
		// Create base task
		const result1 = await runCLI(["task", "create", "Base Task"], TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await runCLI(["task", "create", "Dependent Task", "--dep", "task-1"], TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// View task in plain text mode
		const result3 = await runCLI(["task", "task-2", "--plain"], TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Dependencies: task-1");
	});
});
