import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("CLI task wizard integration compatibility", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-task-wizard");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("CLI Wizard Compatibility");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors in tests
		}
	});

	it("preserves non-interactive missing title error for task create", async () => {
		const result = await $`bun ${CLI_PATH} task create`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toString()).toContain("error: missing required argument 'title'");
	});

	it("preserves non-interactive missing taskId error for task edit", async () => {
		const result = await $`bun ${CLI_PATH} task edit`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toString()).toContain("error: missing required argument 'taskId'");
	});

	it("keeps legacy non-interactive edit behavior when taskId is provided", async () => {
		await $`bun ${CLI_PATH} task create "Edit target" --desc "Before edit"`.cwd(TEST_DIR).quiet();
		const result = await $`bun ${CLI_PATH} task edit 1`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Updated task");
	});
});
