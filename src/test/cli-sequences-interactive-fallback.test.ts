import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI sequences interactive fallback (headless)", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-seq-fallback");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Sequences Headless Test");

		await core.createTask(
			{
				id: "task-1",
				title: "A",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				rawContent: "Test",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-2",
				title: "B",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				rawContent: "Test",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-3",
				title: "C",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: ["task-1", "task-2"],
				rawContent: "Test",
			},
			false,
		);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	it("prints sequences text when not a TTY", async () => {
		// No --plain: interactive path should fallback to text in headless env
		const result = await $`bun ${cliPath} sequence list`.cwd(TEST_DIR).env({ BACKLOG_HEADLESS: "1" }).quiet();
		expect(result.exitCode).toBe(0);
		const out = result.stdout.toString();
		expect(out).toContain("Sequence 1:");
		expect(out).toContain("  task-1 - A");
		expect(out).toContain("  task-2 - B");
		expect(out).toContain("Sequence 2:");
		expect(out).toContain("  task-3 - C");
		// Ensure no blessed escape codes leak
		expect(out).not.toContain("[?1049h");
	});
});
