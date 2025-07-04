import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../index.ts";

describe("CLI parent shorthand option", () => {
	let testDir: string;
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeAll(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-test-"));

		// Initialize git repository first to avoid interactive prompts
		await Bun.spawn(["git", "init", "-b", "main"], { cwd: testDir }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: testDir }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: testDir }).exited;

		// Initialize backlog project using Core (simulating CLI)
		const core = new Core(testDir);
		await core.initializeProject("Test Project");
	});

	afterAll(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("should accept -p as shorthand for --parent", async () => {
		// Create parent task
		const createParent = await Bun.spawn(["bun", "run", cliPath, "task", "create", "Parent Task"], { cwd: testDir })
			.exited;
		expect(createParent).toBe(0);

		// Create subtask using -p shorthand
		const createSubtaskShort = await Bun.spawn(
			["bun", "run", cliPath, "task", "create", "Subtask with -p", "-p", "task-1"],
			{ cwd: testDir },
		).exited;
		expect(createSubtaskShort).toBe(0);

		// Find the created subtask file
		const tasksDir = join(testDir, "backlog", "tasks");
		const files = await readdir(tasksDir);
		const subtaskFiles = files.filter((f) => f.startsWith("task-1.1 - ") && f.endsWith(".md"));
		expect(subtaskFiles.length).toBe(1);

		// Verify the subtask was created with correct parent
		if (subtaskFiles[0]) {
			const subtaskFile = await Bun.file(join(tasksDir, subtaskFiles[0])).text();
			expect(subtaskFile).toContain("parent_task_id: task-1");
		}
	});

	it("should work the same as --parent option", async () => {
		// Create subtask using --parent
		const createSubtaskLong = await Bun.spawn(
			["bun", "run", cliPath, "task", "create", "Subtask with --parent", "--parent", "task-1"],
			{ cwd: testDir },
		).exited;
		expect(createSubtaskLong).toBe(0);

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

			expect(subtask1).toContain("parent_task_id: task-1");
			expect(subtask2).toContain("parent_task_id: task-1");
		}
	});

	it("should show -p in help text", async () => {
		const helpProc = Bun.spawn(["bun", "run", cliPath, "task", "create", "--help"], { stdout: "pipe" });

		const output = await new Response(helpProc.stdout).text();
		expect(output).toContain("-p, --parent <taskId>");
		expect(output).toContain("specify parent task ID");
	});
});
