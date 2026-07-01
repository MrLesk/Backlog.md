import { afterEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

async function createRepository(testDir: string, projectName: string): Promise<string> {
	const mainRepo = join(testDir, "repo");
	await mkdir(mainRepo, { recursive: true });
	await $`git init -b main`.cwd(mainRepo).quiet();
	await $`git config user.name "Test User"`.cwd(mainRepo).quiet();
	await $`git config user.email test@example.com`.cwd(mainRepo).quiet();

	const core = new Core(mainRepo);
	await initializeTestProject(core, projectName, true);
	return mainRepo;
}

async function addWorktree(mainRepo: string, testDir: string, branch: string): Promise<string> {
	const worktree = join(testDir, "worktrees", branch);
	await $`git worktree add ${worktree} -b ${branch}`.cwd(mainRepo).quiet();
	return worktree;
}

describe("task ID allocation across git worktrees", () => {
	let testDir: string;

	afterEach(async () => {
		if (testDir) {
			await safeCleanup(testDir);
		}
	});

	it("allocates after an uncommitted task in a sibling worktree", async () => {
		testDir = createUniqueTestDir("worktree-task-id");
		const mainRepo = await createRepository(testDir, "Worktree Task ID Test");
		const sibling = await addWorktree(mainRepo, testDir, "feature-task");

		const siblingCore = new Core(sibling);
		const siblingTask = await siblingCore.createTaskFromInput({ title: "Sibling task" }, false);
		expect(siblingTask.task.id).toBe("TASK-1");

		const mainCore = new Core(mainRepo);
		const mainTask = await mainCore.createTaskFromInput({ title: "Main task" }, false);

		expect(mainTask.task.id).toBe("TASK-2");
		expect(await mainCore.fs.loadTask("task-2")).not.toBeNull();
	});

	it("allocates promoted draft task IDs after uncommitted sibling worktree tasks", async () => {
		testDir = createUniqueTestDir("worktree-promote-id");
		const mainRepo = await createRepository(testDir, "Worktree Promote ID Test");
		const sibling = await addWorktree(mainRepo, testDir, "feature-promote");

		const siblingCore = new Core(sibling);
		await siblingCore.createTaskFromInput({ title: "Sibling task" }, false);

		const mainCore = new Core(mainRepo);
		await mainCore.createTaskFromInput({ title: "Draft to promote", status: "Draft" }, false);
		const promoted = await mainCore.promoteDraft("draft-1", false);

		expect(promoted).toBe(true);
		const promotedTask = await mainCore.fs.loadTask("task-2");
		expect(promotedTask?.title).toBe("Draft to promote");
	});

	it("uses the same create lock for concurrent task creation in sibling worktrees", async () => {
		testDir = createUniqueTestDir("worktree-create-lock");
		const mainRepo = await createRepository(testDir, "Worktree Create Lock Test");
		const sibling = await addWorktree(mainRepo, testDir, "feature-lock");

		const first = new Core(mainRepo);
		const second = new Core(sibling);
		const firstEnteredSave = createDeferred<void>();
		const releaseFirstSave = createDeferred<void>();
		let saveEntries = 0;

		const patchSaveTask = (core: Core) => {
			const original = core.fs.saveTask.bind(core.fs);
			core.fs.saveTask = (async (task: Task): Promise<string> => {
				saveEntries += 1;
				if (task.title === "Alpha") {
					firstEnteredSave.resolve();
					await releaseFirstSave.promise;
				}
				return await original(task);
			}) as typeof core.fs.saveTask;
		};

		patchSaveTask(first);
		patchSaveTask(second);

		const firstCreate = first.createTaskFromInput({ title: "Alpha" }, false);
		await firstEnteredSave.promise;

		const secondCreate = second.createTaskFromInput({ title: "Beta" }, false);
		await Promise.resolve();
		await Promise.resolve();
		expect(saveEntries).toBe(1);

		releaseFirstSave.resolve();
		const [createdA, createdB] = await Promise.all([firstCreate, secondCreate]);

		expect(new Set([createdA.task.id, createdB.task.id]).size).toBe(2);
		expect([createdA.task.id, createdB.task.id].sort()).toEqual(["TASK-1", "TASK-2"]);
	});

	it("preserves custom task prefixes when scanning sibling worktrees", async () => {
		testDir = createUniqueTestDir("worktree-prefix-id");
		const mainRepo = await createRepository(testDir, "Worktree Prefix ID Test");
		const mainCore = new Core(mainRepo);
		const config = await mainCore.fs.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		config.prefixes = { task: "OPS" };
		await mainCore.fs.saveConfig(config);
		const repoRoot = await mainCore.gitOps.stageBacklogDirectory(mainCore.filesystem.backlogDirName);
		await mainCore.gitOps.commitChanges("test: set custom task prefix", repoRoot);

		const sibling = await addWorktree(mainRepo, testDir, "feature-prefix");
		const siblingCore = new Core(sibling);
		const siblingTask = await siblingCore.createTaskFromInput({ title: "Sibling task" }, false);
		expect(siblingTask.task.id).toBe("OPS-1");

		const mainTask = await mainCore.createTaskFromInput({ title: "Main task" }, false);
		expect(mainTask.task.id).toBe("OPS-2");
	});
});
