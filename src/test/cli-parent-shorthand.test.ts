import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTaskPlatformAware, getCliHelpPlatformAware } from "./test-helpers.ts";

describe("CLI parent shorthand option", () => {
	let testDir: string;

	beforeAll(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-test-"));

		// Initialize git repository first to avoid interactive prompts
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		// Initialize backlog project using Core (simulating CLI)
		const core = new Core(testDir);
		await core.initializeProject("Test Project");
	});

	afterAll(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("should accept -p as shorthand for --parent", async () => {
		// Create parent task
		const createParent = await createTaskPlatformAware({ title: "Parent Task" }, testDir);
		expect(createParent.exitCode).toBe(0);

		// Create subtask using -p shorthand
		const createSubtaskShort = await createTaskPlatformAware({ title: "Subtask with -p", parent: "task-1" }, testDir);
		expect(createSubtaskShort.exitCode).toBe(0);

		// Find the created subtask file
		const tasksDir = join(testDir, "backlog", "tasks");
		const files = await readdir(tasksDir);
		const subtaskFiles = files.filter((f) => f.startsWith("task-1.1 - ") && f.endsWith(".md"));
		expect(subtaskFiles.length).toBe(1);

		// Verify the subtask was created with correct parent
		if (subtaskFiles[0]) {
			const subtaskFile = await Bun.file(join(tasksDir, subtaskFiles[0])).text();
			expect(subtaskFile).toContain("parent_task_id: TASK-1");
		}
	});

	it("should work the same as --parent option", async () => {
		// Create subtask using --parent
		const createSubtaskLong = await createTaskPlatformAware(
			{ title: "Subtask with --parent", parent: "task-1" },
			testDir,
		);
		expect(createSubtaskLong.exitCode).toBe(0);

		// Find both subtask files
		const tasksDir = join(testDir, "backlog", "tasks");
		const files = await readdir(tasksDir);
		const subtaskFiles1 = files.filter((f) => f.startsWith("task-1.1 - ") && f.endsWith(".md"));
		const subtaskFiles2 = files.filter((f) => f.startsWith("task-1.2 - ") && f.endsWith(".md"));

		expect(subtaskFiles1.length).toBe(1);
		expect(subtaskFiles2.length).toBe(1);

		// Verify both subtasks have the same parent
		if (subtaskFiles1[0] && subtaskFiles2[0]) {
			const subtask1 = await Bun.file(join(tasksDir, subtaskFiles1[0])).text();
			const subtask2 = await Bun.file(join(tasksDir, subtaskFiles2[0])).text();

			expect(subtask1).toContain("parent_task_id: TASK-1");
			expect(subtask2).toContain("parent_task_id: TASK-1");
		}
	});

	it("should show -p in help text", async () => {
		const helpResult = await getCliHelpPlatformAware(["task", "create", "--help"], testDir);

		expect(helpResult.stdout).toContain("-p, --parent <taskId>");
		expect(helpResult.stdout).toContain("specify parent task ID");
	});

	it("should show Definition of Done options in help text", async () => {
		const helpResult = await getCliHelpPlatformAware(["task", "create", "--help"], testDir);

		expect(helpResult.stdout).toContain("--dod <item>");
		expect(helpResult.stdout).toContain("--no-dod-defaults");
	});
});
