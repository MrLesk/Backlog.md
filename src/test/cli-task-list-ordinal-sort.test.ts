import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

const cliPath = join(process.cwd(), "src", "cli.ts");

const createTask = (overrides: Partial<Task>): Task => ({
	id: "task-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

const expectInOrder = (output: string, ids: string[]) => {
	let previousPosition = -1;
	for (const id of ids) {
		const position = output.indexOf(id);
		expect(position).toBeGreaterThanOrEqual(0);
		expect(position).toBeGreaterThan(previousPosition);
		previousPosition = position;
	}
};

describe("CLI task list ordinal sorting", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-task-list-ordinal-sort");
		await rm(TEST_DIR, { recursive: true, force: true });
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Task List Ordinal Sort Test");

		await core.createTask(createTask({ id: "task-1", title: "No ordinal" }), false);
		await core.createTask(createTask({ id: "task-2", title: "Second ordinal", ordinal: 20 }), false);
		await core.createTask(createTask({ id: "task-3", title: "First ordinal", ordinal: 10 }), false);
		await core.createTask(createTask({ id: "task-4", title: "Tied ordinal", ordinal: 20 }), false);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("orders tasks by ordinal before task ID and leaves missing ordinals last", async () => {
		const result = await $`bun ${cliPath} task list --sort ordinal --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		expectInOrder(result.stdout.toString(), ["TASK-3", "TASK-2", "TASK-4", "TASK-1"]);
	});

	it("shows ordinal in the invalid sort field message", async () => {
		const result = await $`bun ${cliPath} task list --sort invalid --plain`.cwd(TEST_DIR).nothrow().quiet();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Invalid sort field: invalid");
		expect(result.stderr.toString()).toContain("Valid values are: priority, id, ordinal");
	});
});
