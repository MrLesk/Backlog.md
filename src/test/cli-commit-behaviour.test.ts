import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { GitOperations } from "../git/operations.ts";

const CLI_PATH = join(process.cwd(), "src/cli.ts");

async function getCommitCountInTest(dir: string): Promise<number> {
	const result = await $`git rev-list --all --count`.cwd(dir).quiet();
	return Number.parseInt(result.stdout.toString().trim(), 10);
}

describe("CLI Auto-Commit Behavior with autoCommit: false", () => {
	let testDir: string;
	let git: GitOperations;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-test-"));

		// Initialize git repository first to avoid interactive prompts and ensure consistency
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		const core = new Core(testDir);
		git = new GitOperations(testDir);

		await core.initializeProject("Commit Behavior Test", true); // auto-commit the initialization

		const config = await core.filesystem.loadConfig();
		if (config) {
			config.autoCommit = false;
			await core.filesystem.saveConfig(config);
			// Commit the config change to have a clean state for tests
			const configPath = join(testDir, "backlog", "config.yml");
			await git.addFile(configPath);
			// Only commit if there are actual changes staged, to avoid errors on empty commits.
			const diffProc = await $`git diff --staged --quiet`.cwd(testDir).nothrow().quiet();
			if (diffProc.exitCode === 1) {
				await git.commitChanges("test: set autoCommit to false");
			}
		}
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("should not commit when creating a task if autoCommit is false", async () => {
		const initialCommitCount = await getCommitCountInTest(testDir);

		const result = await $`bun ${CLI_PATH} task create "No-commit Task"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(testDir);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount);
		expect(isClean).toBe(false);
	});

	test("should not commit when creating a document if autoCommit is false", async () => {
		const initialCommitCount = await getCommitCountInTest(testDir);

		const result = await $`bun ${CLI_PATH} doc create "No-commit Doc"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(testDir);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount);
		expect(isClean).toBe(false);
	});

	test("should not commit when creating a decision if autoCommit is false", async () => {
		const initialCommitCount = await getCommitCountInTest(testDir);

		const result = await $`bun ${CLI_PATH} decision create "No-commit Decision"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(testDir);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount);
		expect(isClean).toBe(false);
	});
});

describe("CLI Auto-Commit Behavior with autoCommit: true", () => {
	let testDir: string;
	let git: GitOperations;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-autocommit-true-"));

		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		const core = new Core(testDir);
		git = new GitOperations(testDir);

		await core.initializeProject("Commit Behavior Test", true);

		const config = await core.filesystem.loadConfig();
		if (config) {
			config.autoCommit = true; // Enable auto-commit for this test suite
			await core.filesystem.saveConfig(config);
			const configPath = join(testDir, "backlog", "config.yml");
			await git.addFile(configPath);
			// Only commit if there are actual changes staged, to avoid errors on empty commits.
			const diffProc = await $`git diff --staged --quiet`.cwd(testDir).nothrow().quiet();
			if (diffProc.exitCode === 1) {
				await git.commitChanges("test: set autoCommit to true");
			}
		}
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("should commit when creating a task if autoCommit is true", async () => {
		const initialCommitCount = await getCommitCountInTest(testDir);

		const result = await $`bun ${CLI_PATH} task create "Auto-commit Task"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		// Note: isClean() is omitted as createTask's commit strategy can leave the repo dirty.
		const finalCommitCount = await getCommitCountInTest(testDir);
		expect(finalCommitCount).toBe(initialCommitCount + 1);
	});

	test("should commit when creating a document if autoCommit is true", async () => {
		const initialCommitCount = await getCommitCountInTest(testDir);

		const result = await $`bun ${CLI_PATH} doc create "Auto-commit Doc"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(testDir);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount + 1);
		expect(isClean).toBe(true);
	});

	test("should commit when creating a decision if autoCommit is true", async () => {
		const initialCommitCount = await getCommitCountInTest(testDir);

		const result = await $`bun ${CLI_PATH} decision create "Auto-commit Decision"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const finalCommitCount = await getCommitCountInTest(testDir);
		const isClean = await git.isClean();

		expect(finalCommitCount).toBe(initialCommitCount + 1);
		expect(isClean).toBe(true);
	});
});
