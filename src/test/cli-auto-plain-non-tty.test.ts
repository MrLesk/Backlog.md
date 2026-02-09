import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;
let core: Core;

describe("CLI auto-plain behavior in non-TTY runs", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-auto-plain-non-tty");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await core.initializeProject("Auto Plain Non-TTY Test");

		const seedTask: Task = {
			id: "task-1",
			title: "First Task",
			status: "To Do",
			assignee: [],
			createdDate: "2026-01-01 00:00",
			labels: [],
			dependencies: [],
			description: "Seed task description",
		};
		await core.createTask(seedTask, false);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	test("task list falls back to plain output without --plain", async () => {
		const result = await $`bun ${CLI_PATH} task list`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const out = result.stdout.toString();
		expect(out).toContain("To Do:");
		expect(out.toLowerCase()).toContain("task-1 - first task");
		expect(out).not.toContain("\x1b");
	});

	test("task view falls back to plain output without --plain", async () => {
		const result = await $`bun ${CLI_PATH} task view 1`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const out = result.stdout.toString();
		expect(out).toContain("Task TASK-1 - First Task");
		expect(out).toContain("Description:");
		expect(out).toContain("Seed task description");
		expect(out).not.toContain("\x1b");
	});

	test("task create preserves legacy concise output without --plain", async () => {
		const result = await $`bun ${CLI_PATH} task create "Second Task"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const out = result.stdout.toString();
		expect(out).toContain("Created task TASK-2");
		expect(out).toContain("File: ");
		expect(out).not.toContain("Task TASK-2 - Second Task");
	});

	test("task edit preserves legacy concise output without --plain", async () => {
		const result = await $`bun ${CLI_PATH} task edit 1 -s "In Progress"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Updated task TASK-1");
	});
});
