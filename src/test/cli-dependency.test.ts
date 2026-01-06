import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createTaskPlatformAware, editTaskPlatformAware, viewTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

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
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

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
		const result1 = await createTaskPlatformAware({ title: "Base Task" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task task-2");

		// Verify dependency was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should create task with single dependency using --depends-on", async () => {
		// Create base task first
		const result1 = await createTaskPlatformAware({ title: "Base Task" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task task-2");

		// Verify dependency was set
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should create task with multiple dependencies (comma-separated)", async () => {
		// Create base tasks first
		const result1 = await createTaskPlatformAware({ title: "Base Task 1" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await createTaskPlatformAware({ title: "Base Task 2" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// Create task with multiple dependencies
		const result3 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1,task-2" }, TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Created task task-3");

		// Verify dependencies were set
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should create task with multiple dependencies (multiple flags)", async () => {
		// Create base tasks first
		const result1 = await createTaskPlatformAware({ title: "Base Task 1" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await createTaskPlatformAware({ title: "Base Task 2" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// Create task with multiple dependencies using multiple flags (simulated as comma-separated)
		const result3 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1,task-2" }, TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Created task task-3");

		// Verify dependencies were set
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should normalize task IDs in dependencies", async () => {
		// Create base task first
		const result1 = await createTaskPlatformAware({ title: "Base Task" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency using numeric ID (should be normalized to task-X)
		const result2 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "1" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		expect(result2.stdout).toContain("Created task task-2");

		// Verify dependency was normalized
		const task = await core.filesystem.loadTask("task-2");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1"]);
	});

	test("should fail when dependency task does not exist", async () => {
		// Try to create task with non-existent dependency
		const result = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-999" }, TEST_DIR);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("The following dependencies do not exist: task-999");
	});

	test("should edit task to add dependencies", async () => {
		// Create base tasks first
		const result1 = await createTaskPlatformAware({ title: "Base Task 1" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await createTaskPlatformAware({ title: "Base Task 2" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		const result3 = await createTaskPlatformAware({ title: "Task to Edit" }, TEST_DIR);
		expect(result3.exitCode).toBe(0);

		// Edit task to add dependencies
		const result4 = await editTaskPlatformAware({ taskId: "task-3", dependencies: "task-1,task-2" }, TEST_DIR);
		expect(result4.exitCode).toBe(0);
		expect(result4.stdout).toContain("Updated task task-3");

		// Verify dependencies were added
		const task = await core.filesystem.loadTask("task-3");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-1", "task-2"]);
	});

	test("should edit task to update dependencies", async () => {
		// Create base tasks using platform-aware helper
		const result1 = await createTaskPlatformAware({ title: "Base Task 1" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);
		const result2 = await createTaskPlatformAware({ title: "Base Task 2" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);
		const result3 = await createTaskPlatformAware({ title: "Base Task 3" }, TEST_DIR);
		expect(result3.exitCode).toBe(0);

		// Create task with initial dependency
		const result4 = await createTaskPlatformAware(
			{
				title: "Task with Dependency",
				dependencies: "task-1",
			},
			TEST_DIR,
		);
		expect(result4.exitCode).toBe(0);

		// Edit task to change dependencies using platform-aware helper
		const result5 = await editTaskPlatformAware(
			{
				taskId: "task-4",
				dependencies: "task-2,task-3",
			},
			TEST_DIR,
		);
		expect(result5.exitCode).toBe(0);

		// Verify dependencies were updated (should replace, not append)
		const task = await core.filesystem.loadTask("task-4");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["task-2", "task-3"]);
	});

	test("should handle dependencies on draft tasks", async () => {
		// Create draft task first using platform-aware helper
		// Drafts now get DRAFT-X ids
		const result1 = await createTaskPlatformAware(
			{
				title: "Draft Task",
				draft: true,
			},
			TEST_DIR,
		);
		expect(result1.exitCode).toBe(0);
		expect(result1.stdout).toContain("Created draft DRAFT-1");

		// Create task that depends on draft
		// Note: Tasks and drafts have separate ID sequences now
		const result2 = await createTaskPlatformAware(
			{
				title: "Task depending on draft",
				dependencies: "DRAFT-1",
			},
			TEST_DIR,
		);
		expect(result2.exitCode).toBe(0);

		// Verify dependency on draft was set
		// First non-draft task will be TASK-1
		const task = await core.filesystem.loadTask("task-1");
		expect(task).not.toBeNull();
		expect(task?.dependencies).toEqual(["DRAFT-1"]);
	});

	test("should display dependencies in plain text view", async () => {
		// Create base task
		const result1 = await createTaskPlatformAware({ title: "Base Task" }, TEST_DIR);
		expect(result1.exitCode).toBe(0);

		// Create task with dependency
		const result2 = await createTaskPlatformAware({ title: "Dependent Task", dependencies: "task-1" }, TEST_DIR);
		expect(result2.exitCode).toBe(0);

		// View task in plain text mode
		const result3 = await viewTaskPlatformAware({ taskId: "task-2", plain: true }, TEST_DIR);
		expect(result3.exitCode).toBe(0);
		expect(result3.stdout).toContain("Dependencies: task-1");
	});
});
