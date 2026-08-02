import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

/** Regression coverage for BACK-563 auto-commit entry points not exercised by the
 * task, document, and draft-lifecycle suites. */
describe("core auto-commit scoping", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-core-autocommit-scope");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Core Auto-commit Scope", true);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	async function seedUnrelatedDirtyState(): Promise<void> {
		await Bun.write(join(TEST_DIR, "BASELINE.txt"), "baseline\n");
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m baseline`.cwd(TEST_DIR).quiet();
		await Bun.write(join(TEST_DIR, "UNRELATED.txt"), "baseline\n");
		await $`git add UNRELATED.txt`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add unrelated file"`.cwd(TEST_DIR).quiet();
		await $`git rm --quiet UNRELATED.txt`.cwd(TEST_DIR).quiet();
		await Bun.write(join(core.filesystem.backlogDir, "plans", "peer-plan.md"), "# Peer plan\n");
	}

	async function expectOwnedCommit(...expectedPaths: string[]): Promise<void> {
		const committed = await $`git show --no-renames --name-only --pretty=format:`.cwd(TEST_DIR).text();
		for (const expectedPath of expectedPaths) expect(committed).toContain(expectedPath);
		expect(committed).not.toContain("UNRELATED.txt");
		expect(committed).not.toContain("peer-plan.md");

		const status = await core.gitOps.getStatus();
		expect(status).toContain("D  UNRELATED.txt");
		expect(status).toContain("?? backlog/plans/");
	}

	it("decision creation commits only its decision file", async () => {
		await seedUnrelatedDirtyState();

		await core.createDecision(
			{
				id: "decision-1",
				title: "Scoped decision",
				date: "2026-08-02 00:00",
				status: "proposed",
				context: "Context",
				decision: "Decision",
				consequences: "Consequences",
				rawContent: "",
			},
			true,
		);

		await expectOwnedCommit("backlog/decisions/");
	});

	it("bulk task updates commit only the updated task files", async () => {
		const { task } = await core.createTaskFromInput({ title: "Bulk update", status: "To Do", description: "d" }, true);
		await seedUnrelatedDirtyState();
		const current = await core.filesystem.loadTask(task.id);
		if (!current) throw new Error("Expected task to exist");

		await core.updateTasksBulk([{ ...current, ordinal: 2000 }], "Scoped bulk update", true);

		await expectOwnedCommit("backlog/tasks/");
	});

	it("bulk task updates commit through the exact saved legacy path", async () => {
		const { task } = await core.createTaskFromInput({ title: "Legacy bulk update", status: "To Do" }, false);
		if (!task.filePath) throw new Error("Expected the created task path");
		const legacyPath = join(core.filesystem.tasksDir, "task-999 - Legacy.md");
		await rename(task.filePath, legacyPath);
		await $`git add .`.cwd(TEST_DIR).quiet();
		await $`git commit -m baseline`.cwd(TEST_DIR).quiet();
		const current = (await core.filesystem.listTasks()).find((candidate) => candidate.id === task.id);
		if (!current) throw new Error("Expected the legacy task to exist");

		await core.updateTasksBulk([{ ...current, ordinal: 2000 }], "Legacy bulk update", true);

		expect(await core.gitOps.getLastCommitMessage()).toContain("Legacy bulk update");
		expect(await $`git show --name-only --pretty=format:`.cwd(TEST_DIR).text()).toContain(
			"backlog/tasks/task-999 - Legacy.md",
		);
		expect((await $`git status --short`.cwd(TEST_DIR).text()).trim()).toBe("");
	});

	it("task archive commits both sides of its move and nothing else", async () => {
		const { task } = await core.createTaskFromInput({ title: "Archive task", status: "To Do", description: "d" }, true);
		await seedUnrelatedDirtyState();

		expect(await core.archiveTask(task.id, true)).toBe(true);

		await expectOwnedCommit("backlog/tasks/", "backlog/archive/tasks/");
	});

	it("task completion commits both sides of its move and nothing else", async () => {
		const { task } = await core.createTaskFromInput({ title: "Complete task", status: "Done", description: "d" }, true);
		await seedUnrelatedDirtyState();

		expect(await core.completeTask(task.id, true)).toBe(true);

		await expectOwnedCommit("backlog/tasks/", "backlog/completed/");
	});
});
