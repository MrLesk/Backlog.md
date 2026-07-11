import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { initializeTestProject } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

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
		await initializeTestProject(core, "Test Project");
	});

	afterAll(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("should accept -p as shorthand for --parent", async () => {
		// Create parent task
		const createParent = await $`bun ${CLI_PATH} task create "Parent Task"`.cwd(testDir).quiet().nothrow();
		expect(createParent.exitCode).toBe(0);

		const createSubtaskShort = await $`bun ${CLI_PATH} task create -p task-1 "Subtask with -p"`
			.cwd(testDir)
			.quiet()
			.nothrow();
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

	it("should show -p in help text", async () => {
		const helpResult = await $`bun ${CLI_PATH} task create --help`.cwd(testDir).quiet().nothrow();

		expect(helpResult.exitCode).toBe(0);
		const stdout = helpResult.stdout.toString();
		expect(stdout).toContain("-p, --parent <taskId>");
		expect(stdout).toContain("specify existing parent task ID, not a");
		expect(stdout).toContain("milestone ID");
		expect(stdout).toContain("--dod <item>");
		expect(stdout).toContain("--no-dod-defaults");
	});
});
