import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI exclude-status filtering", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("cli-exclude-status");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Exclude Status Project");

		await core.createTask(
			{
				id: "task-1",
				title: "Todo visible",
				status: "To Do",
				assignee: ["@codex"],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				description: "visible work",
				rawContent: "visible work",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-2",
				title: "Progress visible",
				status: "In Progress",
				assignee: ["@codex"],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				description: "visible work",
				rawContent: "visible work",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-3",
				title: "Done visible",
				status: "Done",
				assignee: ["@codex"],
				createdDate: "2026-01-01",
				labels: [],
				dependencies: [],
				description: "visible work",
				rawContent: "visible work",
			},
			false,
		);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("excludes configured statuses from task list output", async () => {
		const result = await $`bun ${cliPath} task list --exclude-status Done --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-1 - Todo visible");
		expect(stdout).toContain("TASK-2 - Progress visible");
		expect(stdout).not.toContain("TASK-3 - Done visible");
	});

	it("combines excluded statuses with included status filters case-insensitively", async () => {
		const result = await $`bun ${cliPath} task list --status "In Progress" --exclude-status done --plain`
			.cwd(TEST_DIR)
			.quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-2 - Progress visible");
		expect(stdout).not.toContain("TASK-1 - Todo visible");
		expect(stdout).not.toContain("TASK-3 - Done visible");
	});

	it("excludes configured statuses from task search output", async () => {
		const result = await $`bun ${cliPath} search visible --type task --exclude-status Done --plain`
			.cwd(TEST_DIR)
			.quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-1 - Todo visible");
		expect(stdout).toContain("TASK-2 - Progress visible");
		expect(stdout).not.toContain("TASK-3 - Done visible");
	});

	it("falls back to default statuses when configured statuses are empty", async () => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (!config) {
			throw new Error("Config not loaded");
		}
		await core.filesystem.saveConfig({ ...config, statuses: [] });

		const result = await $`bun ${cliPath} task list --exclude-status Done --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("TASK-1 - Todo visible");
		expect(stdout).toContain("TASK-2 - Progress visible");
		expect(stdout).not.toContain("TASK-3 - Done visible");
	});

	it("rejects invalid excluded statuses", async () => {
		const result = await $`bun ${cliPath} task list --exclude-status Blocked --plain`.cwd(TEST_DIR).nothrow().quiet();
		const output = result.stdout.toString() + result.stderr.toString();

		expect(result.exitCode).toBe(1);
		expect(output).toContain("Invalid exclude-status: Blocked. Valid statuses are: To Do, In Progress, Done");
	});
});
