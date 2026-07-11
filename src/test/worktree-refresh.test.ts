import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let WORKTREE_DIR: string;
let mainCore: Core | undefined;
let featureCore: Core | undefined;
let worktreeAdded = false;

describe("worktree task refresh", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-worktree-refresh");
		WORKTREE_DIR = `${TEST_DIR}-feature`;
		worktreeAdded = false;
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	});

	afterEach(async () => {
		mainCore?.disposeContentStore();
		featureCore?.disposeContentStore();
		mainCore = undefined;
		featureCore = undefined;

		const cleanupErrors: unknown[] = [];
		if (worktreeAdded) {
			try {
				await $`git worktree remove --force ${WORKTREE_DIR}`.cwd(TEST_DIR).quiet();
			} catch (error) {
				cleanupErrors.push(error);
			}
			worktreeAdded = false;
		}
		for (const directory of [WORKTREE_DIR, TEST_DIR]) {
			try {
				await safeCleanup(directory);
			} catch (error) {
				cleanupErrors.push(error);
			}
		}
		if (cleanupErrors.length === 1) {
			throw cleanupErrors[0];
		}
		if (cleanupErrors.length > 1) {
			throw new AggregateError(cleanupErrors, "Worktree teardown failed");
		}
	});

	it("refreshes tasks committed in another worktree after startup when active branch checks are enabled", async () => {
		const setupCore = new Core(TEST_DIR);
		await initializeTestProject(setupCore, "Worktree Refresh", true);
		const config = await setupCore.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected initialized config");
		}
		await setupCore.filesystem.saveConfig({
			...config,
			checkActiveBranches: true,
			remoteOperations: false,
		});
		await $`git add backlog/config.yml`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Configure active branch scanning"`.cwd(TEST_DIR).quiet();

		mainCore = new Core(TEST_DIR, { enableWatchers: true });
		expect(await mainCore.queryTasks()).toEqual([]);
		expect(await mainCore.queryTasks({ query: "Created elsewhere" })).toEqual([]);

		await $`git worktree add ${WORKTREE_DIR} -b feature`.cwd(TEST_DIR).quiet();
		worktreeAdded = true;
		featureCore = new Core(WORKTREE_DIR);
		const worktreeTask: Task = {
			id: "task-1",
			title: "Created elsewhere",
			status: "To Do",
			assignee: [],
			createdDate: "2026-07-01",
			labels: [],
			dependencies: [],
			rawContent: "## Description\nCreated after the main Core initialized.",
		};
		await featureCore.createTask(worktreeTask, true);

		const searchResults = await mainCore.queryTasks({ query: "Created elsewhere" });
		expect(searchResults.map((task) => task.id)).toContain("TASK-1");

		const listedTasks = await mainCore.queryTasks();
		expect(listedTasks.map((task) => task.id)).toContain("TASK-1");
	});
});
