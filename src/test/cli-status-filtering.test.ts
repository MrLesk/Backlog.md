import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

const task = (id: string, title: string, status: string) => ({
	id,
	title,
	status,
	assignee: [],
	createdDate: "2026-01-01",
	labels: [],
	dependencies: [],
	description: "work",
	rawContent: "work",
});

describe("CLI status filtering", () => {
	const cliPath = getTestCliPath();

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("cli-status");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Status Project");

		await core.createTask(task("task-1", "Todo one", "To Do"), false);
		await core.createTask(task("task-2", "Progress one", "In Progress"), false);
		await core.createTask(task("task-3", "Done one", "Done"), false);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("filters by a single status", async () => {
		const result = await $`bun ${cliPath} task list --status "To Do" --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-1 - Todo one");
		expect(stdout).not.toContain("TASK-2 - Progress one");
		expect(stdout).not.toContain("TASK-3 - Done one");
	});

	// Repeating the flag used to overwrite rather than accumulate, so asking for everything
	// unfinished returned only whatever matched the last status — and silently, since an empty
	// list looks exactly like having no such tasks.
	it("returns tasks matching any status when the flag is repeated", async () => {
		const result = await $`bun ${cliPath} task list --status "To Do" --status "In Progress" --plain`
			.cwd(TEST_DIR)
			.quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-1 - Todo one");
		expect(stdout).toContain("TASK-2 - Progress one");
		expect(stdout).not.toContain("TASK-3 - Done one");
	});

	it("accepts several statuses separated by commas", async () => {
		const result = await $`bun ${cliPath} task list --status "To Do,Done" --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-1 - Todo one");
		expect(stdout).toContain("TASK-3 - Done one");
		expect(stdout).not.toContain("TASK-2 - Progress one");
	});

	it("matches statuses case-insensitively when several are given", async () => {
		const result = await $`bun ${cliPath} task list --status "to do" --status "DONE" --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-1 - Todo one");
		expect(stdout).toContain("TASK-3 - Done one");
	});

	it("still honours exclude-status alongside several included statuses", async () => {
		const result = await $`bun ${cliPath} task list --status "To Do" --status "Done" --exclude-status Done --plain`
			.cwd(TEST_DIR)
			.quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-1 - Todo one");
		expect(stdout).not.toContain("TASK-3 - Done one");
	});
});
