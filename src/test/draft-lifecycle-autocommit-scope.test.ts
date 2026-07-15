import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

/**
 * Regression coverage for TASK-62: the draft/task lifecycle auto-commits
 * (promote, demote, archive-draft — both single-shot and edit-with-updates
 * variants) must scope their commit to exactly the files they moved, never
 * sweeping in an unrelated staged deletion or a peer's untracked file that
 * happens to sit inside the backlog directory.
 */
describe("draft/task lifecycle auto-commit scoping", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-lifecycle-scope");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Test Draft Lifecycle Project", true);

		// Enable auto-commit for all lifecycle operations under test.
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.autoCommit = true;
			await core.filesystem.saveConfig(config);
		}
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	// Seed an unrelated staged deletion (outside the backlog dir) plus a peer's
	// untracked file (inside the backlog dir), on top of a clean committed baseline.
	// Returns nothing; asserts are done by the caller against the operation's commit.
	async function seedUnrelatedDirtyState(): Promise<void> {
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m baseline`.cwd(TEST_DIR).quiet();

		await Bun.write(join(TEST_DIR, "UNRELATED.txt"), "keep me\n");
		await $`git add UNRELATED.txt`.cwd(TEST_DIR).quiet();
		await $`git commit -m "add unrelated file"`.cwd(TEST_DIR).quiet();
		await $`git rm --quiet UNRELATED.txt`.cwd(TEST_DIR).quiet();

		const peerPlanPath = join(core.filesystem.backlogDir, "plans", "peer-plan.md");
		await Bun.write(peerPlanPath, "# Peer's in-progress plan\n");
	}

	async function committedFilesOfLastCommit(): Promise<string> {
		// --no-renames so a moved file shows as both its old (deleted) and new (added)
		// path, rather than git collapsing the pair into a single rename entry.
		const { stdout } = await $`git show --no-renames --name-only --pretty=format:`.cwd(TEST_DIR).quiet();
		return stdout.toString();
	}

	async function expectUnrelatedStateUntouched(committedFiles: string): Promise<void> {
		expect(committedFiles).not.toContain("UNRELATED.txt");
		expect(committedFiles).not.toContain("peer-plan.md");

		const status = await (await core.getGitOps()).getStatus();
		expect(status).toContain("D  UNRELATED.txt");
		expect(status).toContain("?? backlog/plans/");
	}

	it("promoteDraft (single-shot) does not sweep unrelated files", async () => {
		const { task: draft } = await core.createTaskFromInput(
			{ title: "Solo Promote", status: "Draft", description: "d" },
			true,
		);
		await seedUnrelatedDirtyState();

		const ok = await core.promoteDraft(draft.id, true);
		expect(ok).toBe(true);

		expect(await (await core.getGitOps()).getLastCommitMessage()).toContain("backlog: Promote draft");
		const committed = await committedFilesOfLastCommit();
		// Both the old draft path and the new task path are part of the commit.
		expect(committed).toContain("/drafts/");
		expect(committed).toContain("/tasks/");
		await expectUnrelatedStateUntouched(committed);
	});

	it("demoteTask (single-shot) does not sweep unrelated files", async () => {
		const { task } = await core.createTaskFromInput({ title: "Solo Demote", status: "To Do", description: "d" }, true);
		await seedUnrelatedDirtyState();

		const ok = await core.demoteTask(task.id, true);
		expect(ok).toBe(true);

		expect(await (await core.getGitOps()).getLastCommitMessage()).toContain("backlog: Demote task");
		const committed = await committedFilesOfLastCommit();
		expect(committed).toContain("/tasks/");
		expect(committed).toContain("/drafts/");
		await expectUnrelatedStateUntouched(committed);
	});

	it("archiveDraft does not sweep unrelated files", async () => {
		const { task: draft } = await core.createTaskFromInput(
			{ title: "Archive Me", status: "Draft", description: "d" },
			true,
		);
		await seedUnrelatedDirtyState();

		const ok = await core.archiveDraft(draft.id, true);
		expect(ok).toBe(true);

		expect(await (await core.getGitOps()).getLastCommitMessage()).toContain("backlog: Archive draft");
		const committed = await committedFilesOfLastCommit();
		// Old drafts/ path and new archive/drafts/ path both present.
		expect(committed).toContain("/drafts/");
		expect(committed).toContain("/archive/");
		await expectUnrelatedStateUntouched(committed);
	});

	it("promote via editTaskOrDraft (with updates) does not sweep unrelated files", async () => {
		const { task: draft } = await core.createTaskFromInput(
			{ title: "Edit Promote", status: "Draft", description: "d" },
			true,
		);
		await seedUnrelatedDirtyState();

		await core.editTaskOrDraft(draft.id, { status: "To Do" }, true);

		expect(await (await core.getGitOps()).getLastCommitMessage()).toContain("backlog: Promote draft");
		const committed = await committedFilesOfLastCommit();
		expect(committed).toContain("/drafts/");
		expect(committed).toContain("/tasks/");
		await expectUnrelatedStateUntouched(committed);
	});

	it("demote via editTaskOrDraft (with updates) does not sweep unrelated files", async () => {
		const { task } = await core.createTaskFromInput({ title: "Edit Demote", status: "To Do", description: "d" }, true);
		await seedUnrelatedDirtyState();

		await core.editTaskOrDraft(task.id, { status: "Draft" }, true);

		expect(await (await core.getGitOps()).getLastCommitMessage()).toContain("backlog: Demote task");
		const committed = await committedFilesOfLastCommit();
		expect(committed).toContain("/tasks/");
		expect(committed).toContain("/drafts/");
		await expectUnrelatedStateUntouched(committed);
	});
});
