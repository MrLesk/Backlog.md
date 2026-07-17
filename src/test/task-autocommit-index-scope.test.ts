import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

/**
 * Regression coverage for TASK-91: the task create/update auto-commit must not
 * touch an index it did not stage. It previously ran an unscoped `git reset HEAD`
 * before staging its own file, which silently discarded a concurrent session's
 * staged work, and then committed the whole index rather than just the task file.
 */
describe("task create/update auto-commit index scoping", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-task-autocommit-index");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Test Task Autocommit Project", true);

		const config = await core.filesystem.loadConfig();
		if (config) {
			config.autoCommit = true;
			await core.filesystem.saveConfig(config);
		}
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	// Stand in for a concurrent session that has deliberately staged one file and
	// has not committed it yet, on top of a clean committed baseline.
	async function seedPeerStagedFile(): Promise<void> {
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m baseline`.cwd(TEST_DIR).quiet();

		await Bun.write(join(TEST_DIR, "PEER.txt"), "a peer's staged hunk\n");
		await $`git add PEER.txt`.cwd(TEST_DIR).quiet();
	}

	async function stagedPaths(): Promise<string> {
		const { stdout } = await $`git diff --cached --name-only`.cwd(TEST_DIR).quiet();
		return stdout.toString();
	}

	async function committedFilesOfLastCommit(): Promise<string> {
		const { stdout } = await $`git show --no-renames --name-only --pretty=format:`.cwd(TEST_DIR).quiet();
		return stdout.toString();
	}

	it("createTask leaves a peer's staged file staged, and out of its own commit", async () => {
		await seedPeerStagedFile();

		const { task } = await core.createTaskFromInput({ title: "Concurrent Create", status: "To Do" }, true);

		expect(await (await core.getGitOps()).getLastCommitMessage()).toContain(`Create task ${task.id}`);

		const committed = await committedFilesOfLastCommit();
		expect(committed).toContain("/tasks/");
		expect(committed).not.toContain("PEER.txt");

		// The peer's work must still be staged — an unscoped reset would have
		// demoted it to an untracked/unstaged file.
		expect(await stagedPaths()).toContain("PEER.txt");
	});

	it("editTask leaves a peer's staged file staged, and out of its own commit", async () => {
		const { task } = await core.createTaskFromInput({ title: "Concurrent Edit", status: "To Do" }, true);
		await seedPeerStagedFile();

		await core.editTaskOrDraft(task.id, { title: "Concurrent Edit (revised)" }, true);

		expect(await (await core.getGitOps()).getLastCommitMessage()).toContain(`Update task ${task.id}`);

		const committed = await committedFilesOfLastCommit();
		expect(committed).toContain("/tasks/");
		expect(committed).not.toContain("PEER.txt");

		expect(await stagedPaths()).toContain("PEER.txt");
	});
});
