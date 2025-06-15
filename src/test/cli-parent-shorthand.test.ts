import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("CLI parent shorthand option", () => {
	let testDir: string;
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeAll(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-test-"));
		// Initialize a test project using the CLI directly
		const initResult = await Bun.spawn(["bun", "run", cliPath, "init", "Test Project"], {
			cwd: testDir,
		}).exited;
		expect(initResult).toBe(0);
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

		// Verify the subtask was created with correct parent
		const subtaskFile = await Bun.file(join(testDir, ".backlog/tasks/task-1.1 - subtask-with-p.md")).text();
		expect(subtaskFile).toContain("parent_task_id: task-1");
	});

	it("should work the same as --parent option", async () => {
		// Create subtask using --parent
		const createSubtaskLong = await Bun.spawn(
			["bun", "run", cliPath, "task", "create", "Subtask with --parent", "--parent", "task-1"],
			{ cwd: testDir },
		).exited;
		expect(createSubtaskLong).toBe(0);

		// Verify both subtasks have the same parent
		const subtask1 = await Bun.file(join(testDir, ".backlog/tasks/task-1.1 - subtask-with-p.md")).text();
		const subtask2 = await Bun.file(join(testDir, ".backlog/tasks/task-1.2 - subtask-with-parent.md")).text();

		expect(subtask1).toContain("parent_task_id: task-1");
		expect(subtask2).toContain("parent_task_id: task-1");
	});

	it("should show -p in help text", async () => {
		const helpProc = Bun.spawn(["bun", "run", cliPath, "task", "create", "--help"], { stdout: "pipe" });

		const output = await new Response(helpProc.stdout).text();
		expect(output).toContain("-p, --parent <taskId>");
		expect(output).toContain("specify parent task ID");
	});
});
