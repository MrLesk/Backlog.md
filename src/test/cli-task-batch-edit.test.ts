import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

async function createTask(core: Core, id: string, title: string) {
	await core.createTask(
		{
			id,
			title,
			status: "To Do",
			assignee: [],
			createdDate: "2025-06-08",
			labels: [],
			dependencies: [],
			rawContent: title,
		},
		false,
	);
}

describe("task edit with several task IDs", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-batch-edit");
		await mkdir(TEST_DIR, { recursive: true });
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Batch Edit Project");
		await createTask(core, "task-1", "First");
		await createTask(core, "task-2", "Second");
		await createTask(core, "task-3", "Third");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("moves every listed task to the target status", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 task-2 task-3 -s "In Progress"`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();

		expect(result.exitCode).toBe(0);

		const core = new Core(TEST_DIR);
		for (const id of ["task-1", "task-2", "task-3"]) {
			const task = await core.filesystem.loadTask(id);
			expect(task?.status).toBe("In Progress");
		}
	});

	it("moves the tasks that succeed and names the ones that fail", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 task-999 task-3 -s "In Progress"`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();

		expect(result.exitCode).not.toBe(0);
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(output).toContain("task-999");

		const core = new Core(TEST_DIR);
		expect((await core.filesystem.loadTask("task-1"))?.status).toBe("In Progress");
		expect((await core.filesystem.loadTask("task-3"))?.status).toBe("In Progress");
		expect((await core.filesystem.loadTask("task-2"))?.status).toBe("To Do");
	});

	it("rejects a per-task flag when the user passes more than one ID", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 task-2 -t "New title"`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).not.toBe(0);
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(output).toContain("--title");

		const core = new Core(TEST_DIR);
		expect((await core.filesystem.loadTask("task-1"))?.title).toBe("First");
		expect((await core.filesystem.loadTask("task-2"))?.title).toBe("Second");
	});

	it("keeps the shared flags available for a batch", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 task-2 --priority high --add-label triage`
			.cwd(TEST_DIR)
			.nothrow()
			.quiet();

		expect(result.exitCode).toBe(0);

		const core = new Core(TEST_DIR);
		for (const id of ["task-1", "task-2"]) {
			const task = await core.filesystem.loadTask(id);
			expect(task?.priority).toBe("high");
			expect(task?.labels).toContain("triage");
		}
	});

	it("prints one outcome line per task with --plain", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 task-2 -s Done --plain`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).toBe(0);
		const lines = result.stdout
			.toString()
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
		expect(lines).toHaveLength(2);
		expect(lines[0]).toContain("TASK-1");
		expect(lines[1]).toContain("TASK-2");
	});

	it("keeps the single-ID output unchanged", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 -s Done`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Updated task TASK-1");
	});

	it("refuses several IDs with no field flag instead of editing only the first", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 task-2 task-3`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).not.toBe(0);
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(output).toContain("Cannot edit 3 tasks without any field flag");
		expect(output).toContain("--status");

		// The wizard would have edited task-1 alone and dropped the rest; nothing may change here.
		const core = new Core(TEST_DIR);
		for (const id of ["task-1", "task-2", "task-3"]) {
			expect((await core.filesystem.loadTask(id))?.status).toBe("To Do");
		}
	});

	it("treats --plain alone as an output choice, not a change to apply to the batch", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 task-2 --plain`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).not.toBe(0);
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(output).toContain("Cannot edit 2 tasks without any field flag");
	});

	it("fails an ambiguous ID closed and still edits the rest of the batch", async () => {
		const core = new Core(TEST_DIR);
		// A zero-padded second file makes TASK-1 match two files, so no lookup may pick a winner.
		await Bun.write(
			join(core.filesystem.tasksDir, "task-01 - Padded-duplicate.md"),
			serializeTask({
				id: "TASK-01",
				title: "Padded duplicate",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-08",
				labels: [],
				dependencies: [],
				rawContent: "Padded duplicate",
			}),
		);

		const result = await $`bun ${CLI_PATH} task edit task-1 task-2 -s Done`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).not.toBe(0);
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(output.toLowerCase()).toContain("ambiguous");
		expect((await core.filesystem.loadTask("task-2"))?.status).toBe("Done");
	});

	it("counts a repeated ID once", async () => {
		const result = await $`bun ${CLI_PATH} task edit task-1 TASK-1 -s Done`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).toBe(0);
		const lines = result.stdout
			.toString()
			.split("\n")
			.filter((line) => line.includes("Updated task"));
		expect(lines).toHaveLength(1);
		expect((await new Core(TEST_DIR).filesystem.loadTask("task-1"))?.status).toBe("Done");
	});

	it("keeps a bare number and an explicitly prefixed ID distinct", async () => {
		// A bare "1" means TASK-1, so it must not swallow JIRA-1 (or the other way round): the
		// prefixed ID stays in the batch and reports its own failure.
		const result = await $`bun ${CLI_PATH} task edit 1 JIRA-1 -s Done`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).not.toBe(0);
		const output = `${result.stdout.toString()}${result.stderr.toString()}`;
		expect(output).toContain("JIRA-1");
		expect((await new Core(TEST_DIR).filesystem.loadTask("task-1"))?.status).toBe("Done");
	});
});
