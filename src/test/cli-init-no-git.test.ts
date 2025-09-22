import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src/cli.ts");

let TEST_DIR: string;

describe("CLI init --no-git (filesystem-only mode)", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-init-no-git");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	test("initializes without git and creates tasks", async () => {
		// Initialize without a git repo present
		const initResult = await $`bun ${CLI_PATH} init "NoGit Project" --no-git --defaults`.cwd(TEST_DIR).quiet();
		expect(initResult.exitCode).toBe(0);

		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		expect(config).toBeTruthy();
		expect(config?.checkActiveBranches).toBe(false);
		expect(config?.remoteOperations).toBe(false);
		expect(config?.autoCommit).toBe(false);

		// Create a task to ensure core operations work without git
		const createResult = await $`bun ${CLI_PATH} task create "Hello"`.cwd(TEST_DIR).quiet();
		expect(createResult.exitCode).toBe(0);
		expect(createResult.stdout.toString()).toContain("Created task task-1");

		// Verify the task file exists
		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const files = await readdir(tasksDir);
		const hasTask = files.some((f) => /task-1\b/.test(f));
		expect(hasTask).toBe(true);
	});
});
