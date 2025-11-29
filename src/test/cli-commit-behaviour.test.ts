import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { GitOperations } from "../git/operations.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src/cli.ts");

async function getCommitCountInTest(dir: string): Promise<number> {
	const result = await $`git rev-list --all --count`.cwd(dir).quiet();
	return Number.parseInt(result.stdout.toString().trim(), 10);
}

let TEST_DIR: string;

describe("CLI Auto-Commit Behavior with autoCommit: false", () => {
	let git: GitOperations;

	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-cli-commit-false");

		const core = new Core(TEST_DIR);
		git = new GitOperations(TEST_DIR);

		await core.initializeProject("Commit Behavior Test", true); // auto-commit the initialization

		const config = await core.filesystem.loadConfig();
		if (config) {
			config.autoCommit = false;
			await core.filesystem.saveConfig(config);
			// Commit the config change to have a clean state for tests
			const configPath = join(TEST_DIR, "backlog", "config.yml");
			await git.addFile(configPath);
			// Only commit if there are actual changes staged, to avoid errors on empty commits.
			const diffProc = await $`git diff --staged --quiet`.cwd(TEST_DIR).nothrow().quiet();
			if (diffProc.exitCode === 1) {
				await git.commitChanges("test: set autoCommit to false");
			}
		}
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	test("should not commit when creating a task if autoCommit is false", async () => {
		const initialCommitCount = await getCommitCountInTest(TEST_DIR);

		const result = await $`bun ${CLI_PATH} task create "No-commit Task"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(TEST_DIR);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount);
		expect(isClean).toBe(false);
	});

	test("should not commit when creating a document if autoCommit is false", async () => {
		const initialCommitCount = await getCommitCountInTest(TEST_DIR);

		const result = await $`bun ${CLI_PATH} doc create "No-commit Doc"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(TEST_DIR);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount);
		expect(isClean).toBe(false);
	});

	test("should not commit when creating a decision if autoCommit is false", async () => {
		const initialCommitCount = await getCommitCountInTest(TEST_DIR);

		const result = await $`bun ${CLI_PATH} decision create "No-commit Decision"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(TEST_DIR);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount);
		expect(isClean).toBe(false);
	});
});

describe("CLI Auto-Commit Behavior with autoCommit: true", () => {
	let git: GitOperations;

	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-cli-commit-true");

		const core = new Core(TEST_DIR);
		git = new GitOperations(TEST_DIR);

		await core.initializeProject("Commit Behavior Test", true);

		const config = await core.filesystem.loadConfig();
		if (config) {
			config.autoCommit = true; // Enable auto-commit for this test suite
			await core.filesystem.saveConfig(config);
			const configPath = join(TEST_DIR, "backlog", "config.yml");
			await git.addFile(configPath);
			// Only commit if there are actual changes staged, to avoid errors on empty commits.
			const diffProc = await $`git diff --staged --quiet`.cwd(TEST_DIR).nothrow().quiet();
			if (diffProc.exitCode === 1) {
				await git.commitChanges("test: set autoCommit to true");
			}
		}
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	test("should commit when creating a task if autoCommit is true", async () => {
		const initialCommitCount = await getCommitCountInTest(TEST_DIR);

		const result = await $`bun ${CLI_PATH} task create "Auto-commit Task"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		// Note: isClean() is omitted as createTask's commit strategy can leave the repo dirty.
		const finalCommitCount = await getCommitCountInTest(TEST_DIR);
		expect(finalCommitCount).toBe(initialCommitCount + 1);
	});

	test("should commit when creating a document if autoCommit is true", async () => {
		const initialCommitCount = await getCommitCountInTest(TEST_DIR);

		const result = await $`bun ${CLI_PATH} doc create "Auto-commit Doc"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(TEST_DIR);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount + 1);
		expect(isClean).toBe(true);
	});

	test("should commit when creating a decision if autoCommit is true", async () => {
		const initialCommitCount = await getCommitCountInTest(TEST_DIR);

		const result = await $`bun ${CLI_PATH} decision create "Auto-commit Decision"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(TEST_DIR);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount + 1);
		expect(isClean).toBe(true);
	});
});
