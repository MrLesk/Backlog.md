import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { $ } from "bun";
import { addAgentInstructions } from "../agent-instructions.ts";
import { Core } from "../core/backlog.ts";
import type { Decision, Document, Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

function repoPath(root: string, path: string): string {
	return relative(root, path).replace(/\\/g, "/");
}

async function latestCommitPaths(root: string): Promise<string[]> {
	const output = await $`git diff-tree --root --no-commit-id --name-only -r --no-renames HEAD`.cwd(root).text();
	return output
		.split("\n")
		.map((path) => path.trim())
		.filter(Boolean)
		.sort();
}

async function expectLatestCommitPaths(root: string, paths: string[]): Promise<void> {
	expect(await latestCommitPaths(root)).toEqual([...paths].sort());
}

async function initializeGitProject(root: string, backlogDirectory?: string): Promise<Core> {
	await mkdir(root, { recursive: true });
	await $`git init -q -b main`.cwd(root);
	await $`git config user.email test@example.com`.cwd(root);
	await $`git config user.name "Test User"`.cwd(root);
	const core = new Core(root);
	await initializeTestProject(core, "Selected paths", false, backlogDirectory);
	const config = await core.filesystem.loadConfig();
	if (!config) throw new Error("Expected test config");
	config.autoCommit = true;
	config.checkActiveBranches = false;
	await core.filesystem.saveConfig(config);
	const configPath = core.filesystem.configFilePath;
	const repoRoot = await core.gitOps.stageFiles([configPath]);
	await core.gitOps.commitFiles("test: enable auto commit", [configPath], repoRoot);
	return core;
}

async function stageUnrelatedState(root: string): Promise<void> {
	await Bun.write(join(root, "unrelated-staged.txt"), "staged\n");
	await Bun.write(join(root, "unrelated-unstaged.txt"), "unstaged\n");
	await $`git add unrelated-staged.txt`.cwd(root);
}

async function expectUnrelatedStatePreserved(root: string): Promise<void> {
	expect(await $`git show :unrelated-staged.txt`.cwd(root).text()).toBe("staged\n");
	expect(await Bun.file(join(root, "unrelated-unstaged.txt")).text()).toBe("unstaged\n");
	expect((await $`git cat-file -e HEAD:unrelated-staged.txt`.cwd(root).nothrow().quiet()).exitCode).not.toBe(0);
	expect((await $`git cat-file -e HEAD:unrelated-unstaged.txt`.cwd(root).nothrow().quiet()).exitCode).not.toBe(0);
}

function task(id: string, title: string): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2026-07-28 00:00",
		labels: [],
		dependencies: [],
		description: title,
	};
}

describe("selected-path automatic commits", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("selected-path-auto-commit");
		core = await initializeGitProject(testDir);
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("limits bulk and lifecycle commits to every source, target, and updated task path", async () => {
		await core.createTask(task("task-1", "First"), true);
		await core.createTask(task("task-2", "Second"), true);
		await stageUnrelatedState(testDir);

		const first = await core.filesystem.loadTask("task-1");
		const second = await core.filesystem.loadTask("task-2");
		if (!first?.filePath || !second?.filePath) throw new Error("Expected task paths");
		first.ordinal = 1000;
		second.ordinal = 2000;
		await core.updateTasksBulk([first, second], "Update 2 tasks", true);
		await expectLatestCommitPaths(testDir, [repoPath(testDir, first.filePath), repoPath(testDir, second.filePath)]);
		await expectUnrelatedStatePreserved(testDir);

		const archivedSource = first.filePath;
		const archivedTarget = join(core.filesystem.archiveTasksDir, archivedSource.split("/").pop() ?? "");
		expect(await core.archiveTask(first.id, true)).toBe(true);
		await expectLatestCommitPaths(testDir, [repoPath(testDir, archivedSource), repoPath(testDir, archivedTarget)]);
		await expectUnrelatedStatePreserved(testDir);

		const completedSource = second.filePath;
		const completedTarget = join(core.filesystem.completedDir, completedSource.split("/").pop() ?? "");
		expect(await core.completeTask(second.id, true)).toBe(true);
		await expectLatestCommitPaths(testDir, [repoPath(testDir, completedSource), repoPath(testDir, completedTarget)]);
		await expectUnrelatedStatePreserved(testDir);

		const { task: promotedDraft } = await core.createTaskFromInput({ title: "Promote", status: "Draft" }, true);
		const promotedSource = promotedDraft.filePath;
		if (!promotedSource) throw new Error("Expected draft path");
		expect(await core.promoteDraft(promotedDraft.id, true)).toBe(true);
		const promotedTask = (await core.filesystem.listTasks()).find((entry) => entry.title === "Promote");
		if (!promotedTask?.filePath) throw new Error("Expected promoted task path");
		await expectLatestCommitPaths(testDir, [
			repoPath(testDir, promotedSource),
			repoPath(testDir, promotedTask.filePath),
		]);

		expect(await core.demoteTask(promotedTask.id, true)).toBe(true);
		const demotedDraft = (await core.filesystem.listDrafts()).find((entry) => entry.title === "Promote");
		if (!demotedDraft?.filePath) throw new Error("Expected demoted draft path");
		await expectLatestCommitPaths(testDir, [
			repoPath(testDir, promotedTask.filePath),
			repoPath(testDir, demotedDraft.filePath),
		]);

		const archivedDraftSource = demotedDraft.filePath;
		const archivedDraftTarget = join(
			core.filesystem.backlogDir,
			"archive",
			"drafts",
			archivedDraftSource.split("/").pop() ?? "",
		);
		expect(await core.archiveDraft(demotedDraft.id, true)).toBe(true);
		await expectLatestCommitPaths(testDir, [
			repoPath(testDir, archivedDraftSource),
			repoPath(testDir, archivedDraftTarget),
		]);
		await expectUnrelatedStatePreserved(testDir);
	}, 30_000);

	it("limits decision, document, and agent-instruction commits to their outputs", async () => {
		await stageUnrelatedState(testDir);
		const decision: Decision = {
			id: "1",
			title: "Choose one",
			date: "2026-07-28",
			status: "proposed",
			context: "Context",
			decision: "Decision",
			consequences: "Consequences",
			rawContent: "",
		};
		await core.createDecision(decision, true);
		await expectLatestCommitPaths(testDir, ["backlog/decisions/decision-1 - Choose-one.md"]);

		decision.title = "Choose two";
		await core.createDecision(decision, true);
		await expectLatestCommitPaths(testDir, [
			"backlog/decisions/decision-1 - Choose-one.md",
			"backlog/decisions/decision-1 - Choose-two.md",
		]);

		const document: Document = {
			id: "doc-1",
			title: "Guide one",
			type: "guide",
			createdDate: "2026-07-28",
			rawContent: "Guide",
		};
		await core.createDocument(document, true);
		await expectLatestCommitPaths(testDir, ["backlog/docs/doc-1 - Guide-one.md"]);
		document.title = "Guide two";
		await core.createDocument(document, true);
		await expectLatestCommitPaths(testDir, ["backlog/docs/doc-1 - Guide-one.md", "backlog/docs/doc-1 - Guide-two.md"]);

		await addAgentInstructions(testDir, core.gitOps, ["GEMINI.md"], true);
		await expectLatestCommitPaths(testDir, ["GEMINI.md"]);
		await expectUnrelatedStatePreserved(testDir);
	}, 30_000);

	it("isolates pre and message hook staging while preserving post-hook index mutations", async () => {
		await core.createTask(task("task-1", "Hook target"), true);
		await stageUnrelatedState(testDir);
		const configuredHooksDir = (await $`git rev-parse --git-path hooks`.cwd(testDir).text()).trim();
		const hooksDir = isAbsolute(configuredHooksDir) ? configuredHooksDir : join(testDir, configuredHooksDir);
		const hooks = {
			"pre-commit": "printf 'pre\\n' > pre-hook.txt\ngit add pre-hook.txt",
			"prepare-commit-msg": "printf 'prepare\\n' > prepare-hook.txt\ngit add prepare-hook.txt",
			"commit-msg": "printf 'message\\n' > message-hook.txt\ngit add message-hook.txt",
			"post-commit": "printf 'post\\n' > post-hook.txt\ngit add post-hook.txt",
		};
		for (const [name, body] of Object.entries(hooks)) {
			const path = join(hooksDir, name);
			await Bun.write(path, `#!/bin/sh\n${body}\n`);
			await chmod(path, 0o755);
		}

		const source = (await core.filesystem.loadTask("task-1"))?.filePath;
		if (!source) throw new Error("Expected source task");
		const target = join(core.filesystem.archiveTasksDir, source.split("/").pop() ?? "");
		expect(await core.archiveTask("task-1", true)).toBe(true);
		await expectLatestCommitPaths(testDir, [repoPath(testDir, source), repoPath(testDir, target)]);
		for (const path of ["pre-hook.txt", "prepare-hook.txt", "message-hook.txt"]) {
			expect((await $`git show :${path}`.cwd(testDir).nothrow().quiet()).exitCode).not.toBe(0);
			expect((await $`git cat-file -e HEAD:${path}`.cwd(testDir).nothrow().quiet()).exitCode).not.toBe(0);
		}
		expect(await $`git show :post-hook.txt`.cwd(testDir).text()).toBe("post\n");
		expect((await $`git cat-file -e HEAD:post-hook.txt`.cwd(testDir).nothrow().quiet()).exitCode).not.toBe(0);
		await expectUnrelatedStatePreserved(testDir);
	}, 30_000);

	it("supports selected lifecycle commits in custom roots and linked worktrees", async () => {
		const customRoot = createUniqueTestDir("selected-path-custom-root");
		const linkedRoot = createUniqueTestDir("selected-path-linked-worktree");
		try {
			const customCore = await initializeGitProject(customRoot, "work/items");
			await customCore.createTask(task("task-1", "Custom root"), true);
			await stageUnrelatedState(customRoot);
			const customSource = (await customCore.filesystem.loadTask("task-1"))?.filePath;
			if (!customSource) throw new Error("Expected custom-root task");
			const customTarget = join(customCore.filesystem.archiveTasksDir, customSource.split("/").pop() ?? "");
			expect(await customCore.archiveTask("task-1", true)).toBe(true);
			await expectLatestCommitPaths(customRoot, [
				repoPath(customRoot, customSource),
				repoPath(customRoot, customTarget),
			]);
			await expectUnrelatedStatePreserved(customRoot);

			await $`git worktree add -q -b linked-selected ${linkedRoot}`.cwd(customRoot);
			const linkedCore = new Core(linkedRoot);
			await linkedCore.createTask(task("task-2", "Linked"), true);
			await stageUnrelatedState(linkedRoot);
			const linkedSource = (await linkedCore.filesystem.loadTask("task-2"))?.filePath;
			if (!linkedSource) throw new Error("Expected linked-worktree task");
			const linkedTarget = join(linkedCore.filesystem.completedDir, linkedSource.split("/").pop() ?? "");
			expect(await linkedCore.completeTask("task-2", true)).toBe(true);
			await expectLatestCommitPaths(linkedRoot, [
				repoPath(linkedRoot, linkedSource),
				repoPath(linkedRoot, linkedTarget),
			]);
			await expectUnrelatedStatePreserved(linkedRoot);
		} finally {
			await $`git worktree remove --force ${linkedRoot}`.cwd(customRoot).nothrow().quiet();
			await safeCleanup(linkedRoot);
			await safeCleanup(customRoot);
		}
	}, 30_000);

	it("treats automatic selected-path commits as no-ops without Git", async () => {
		const noGitRoot = await mkdtemp(join(tmpdir(), "selected-path-no-git-"));
		try {
			await mkdir(noGitRoot, { recursive: true });
			const noGitCore = new Core(noGitRoot);
			await initializeTestProject(noGitCore, "No Git");
			const config = await noGitCore.filesystem.loadConfig();
			if (!config) throw new Error("Expected no-Git config");
			config.autoCommit = true;
			await noGitCore.filesystem.saveConfig(config);
			await noGitCore.createDecision(
				{
					id: "1",
					title: "No Git decision",
					date: "2026-07-28",
					status: "proposed",
					context: "Context",
					decision: "Decision",
					consequences: "Consequences",
					rawContent: "",
				},
				true,
			);
			const { task: draft } = await noGitCore.createTaskFromInput({ title: "No Git draft", status: "Draft" }, true);
			expect(await noGitCore.promoteDraft(draft.id, true)).toBe(true);
			expect(await noGitCore.gitOps.isRepository()).toBe(false);
		} finally {
			await safeCleanup(noGitRoot);
		}
	}, 30_000);
});
