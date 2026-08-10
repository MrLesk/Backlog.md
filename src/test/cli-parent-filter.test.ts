import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { LOCAL_TASK_LOOKUP_HINT } from "../utils/task-path.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI parent task filtering", () => {
	const cliPath = getTestCliPath();

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-parent-filter");
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first using shell API (same pattern as other tests)

		// Initialize backlog project using Core (same pattern as other tests)
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Parent Filter Test Project");

		// Create a parent task
		await core.createTask(
			{
				id: "task-1",
				title: "Parent task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Parent task description",
			},
			false,
		);

		// Create child tasks
		await core.createTask(
			{
				id: "task-1.1",
				title: "Child task 1",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Child task 1 description",
				parentTaskId: "task-1",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-1.2",
				title: "Child task 2",
				status: "In Progress",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Child task 2 description",
				parentTaskId: "task-1",
			},
			false,
		);

		// Create another standalone task
		await core.createTask(
			{
				id: "task-2",
				title: "Standalone task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Standalone task description",
			},
			false,
		);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("should filter tasks by parent with full task ID", async () => {
		const result = await $`bun ${cliPath} task list --parent task-1 --plain`.cwd(TEST_DIR).quiet();

		const exitCode = result.exitCode;

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(exitCode).toBe(0);
		// Should contain only child tasks
		expect(result.stdout.toString()).toContain("TASK-1.1 - Child task 1");
		expect(result.stdout.toString()).toContain("TASK-1.2 - Child task 2");
		// Should not contain parent or standalone tasks
		expect(result.stdout.toString()).not.toContain("TASK-1 - Parent task");
		expect(result.stdout.toString()).not.toContain("TASK-2 - Standalone task");
	});

	it("should filter tasks by parent with short task ID", async () => {
		const result = await $`bun ${cliPath} task list --parent 1 --plain`.cwd(TEST_DIR).quiet();

		const exitCode = result.exitCode;

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(exitCode).toBe(0);
		// Should contain only child tasks
		expect(result.stdout.toString()).toContain("TASK-1.1 - Child task 1");
		expect(result.stdout.toString()).toContain("TASK-1.2 - Child task 2");
		// Should not contain parent or standalone tasks
		expect(result.stdout.toString()).not.toContain("TASK-1 - Parent task");
		expect(result.stdout.toString()).not.toContain("TASK-2 - Standalone task");
	});

	// One ID must not be a filterable parent for one command and a missing task for another, so the
	// filter resolves the parent through the same working-copy lookup as task view and task create.
	it("keeps the parent filter, task view, and create --parent in agreement about a completed parent", async () => {
		const core = new Core(TEST_DIR);
		await core.editTask("task-1", { status: "Done" }, false);
		expect(await core.completeTask("task-1", false)).toBe(true);

		const view = await $`bun ${cliPath} task view 1 --plain`.cwd(TEST_DIR).nothrow().quiet();
		expect(view.exitCode).toBe(0);
		expect(view.stdout.toString()).toContain("Parent task");

		const filtered = await $`bun ${cliPath} task list --parent 1 --plain`.cwd(TEST_DIR).nothrow().quiet();
		expect(filtered.exitCode).toBe(0);
		expect(filtered.stdout.toString()).toContain("TASK-1.1 - Child task 1");
		expect(filtered.stdout.toString()).toContain("TASK-1.2 - Child task 2");
		expect(filtered.stdout.toString()).not.toContain("TASK-2 - Standalone task");

		const created = await $`bun ${cliPath} task create ${"Late child"} --parent 1`.cwd(TEST_DIR).nothrow().quiet();
		expect(created.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("task-1.3"))?.parentTaskId).toBe("TASK-1");
	});

	it("fails closed when the parent filter names more than one working-copy file", async () => {
		const core = new Core(TEST_DIR);
		const tasksDir = core.filesystem.tasksDir;
		await Bun.write(
			join(tasksDir, "task-01 - Duplicate-parent.md"),
			await Bun.file(join(tasksDir, "task-1 - Parent-task.md")).text(),
		);

		const result = await $`bun ${cliPath} task list --parent 1 --plain`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).not.toBe(0);
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(output).toContain("is ambiguous");
		expect(output).toContain("task-01 - Duplicate-parent.md");
		expect(result.stdout.toString()).not.toContain("TASK-1.1 - Child task 1");
	});

	it("should show error for non-existent parent task", async () => {
		const result = await $`bun ${cliPath} task list --parent task-999 --plain`.cwd(TEST_DIR).nothrow().quiet();

		const exitCode = result.exitCode;

		expect(exitCode).toBe(1); // CLI exits with error for non-existent parent
		expect(result.stderr.toString()).toContain("Parent task TASK-999 not found.");
		expect(result.stderr.toString()).toContain(LOCAL_TASK_LOOKUP_HINT);
	});

	it("should show message when parent has no children", async () => {
		const result = await $`bun ${cliPath} task list --parent task-2 --plain`.cwd(TEST_DIR).quiet();

		const exitCode = result.exitCode;

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("No child tasks found for parent task TASK-2.");
	});

	it("should work with -p shorthand flag", async () => {
		const result = await $`bun ${cliPath} task list -p task-1 --plain`.cwd(TEST_DIR).quiet();

		const exitCode = result.exitCode;

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(exitCode).toBe(0);
		// Should contain only child tasks
		expect(result.stdout.toString()).toContain("TASK-1.1 - Child task 1");
		expect(result.stdout.toString()).toContain("TASK-1.2 - Child task 2");
	});

	it("should combine parent filter with status filter", async () => {
		const result = await $`bun ${cliPath} task list --parent task-1 --status "To Do" --plain`.cwd(TEST_DIR).quiet();

		const exitCode = result.exitCode;

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(exitCode).toBe(0);
		// Should contain only child task with "To Do" status
		expect(result.stdout.toString()).toContain("TASK-1.1 - Child task 1");
		// Should not contain child task with "In Progress" status
		expect(result.stdout.toString()).not.toContain("TASK-1.2 - Child task 2");
	});
});
