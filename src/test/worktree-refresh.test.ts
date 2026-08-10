import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
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

	it("reconciles missed working-copy changes on warm list and search reads", async () => {
		mainCore = new Core(TEST_DIR, { enableWatchers: true });
		await initializeTestProject(mainCore, "Missed Working Copy Refresh", true);
		const config = await mainCore.filesystem.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		await mainCore.filesystem.saveConfig({
			...config,
			checkActiveBranches: true,
			remoteOperations: false,
		});

		expect(await mainCore.queryTasks({ includeCrossBranch: true })).toEqual([]);
		const store = await mainCore.getContentStore();
		const fullRefreshSpy = spyOn(store, "refreshTasks");
		let localTasks: Task[] = [
			{
				id: "TASK-1",
				title: "Recovered by list",
				status: "To Do",
				assignee: [],
				createdDate: "2026-08-10",
				labels: [],
				dependencies: [],
			},
		];
		mainCore.fs.listTasks = async () => localTasks.map((task) => ({ ...task }));

		expect((await mainCore.queryTasks({ includeCrossBranch: true })).map((task) => task.title)).toEqual([
			"Recovered by list",
		]);

		const listedTask = localTasks[0];
		if (!listedTask) throw new Error("Expected the list task");
		localTasks = [{ ...listedTask, title: "Recovered by search" }];
		expect(
			(await mainCore.queryTasks({ query: "Recovered by search", includeCrossBranch: true })).map((task) => task.title),
		).toEqual(["Recovered by search"]);

		const searchService = await mainCore.getSearchService();
		localTasks = [{ ...listedTask, title: "Recovered by direct refresh" }];
		expect(await mainCore.refreshTasksForTaskRead()).toBe(false);
		expect(
			searchService
				.search({ query: "Recovered by direct refresh", types: ["task"] })
				.flatMap((result) => (result.type === "task" ? [result.task.title] : [])),
		).toEqual(["Recovered by direct refresh"]);
		expect(fullRefreshSpy).toHaveBeenCalledTimes(0);
	});

	it("serves repeated cross-branch reads from an unchanged watcher-backed corpus", async () => {
		mainCore = new Core(TEST_DIR, { enableWatchers: true });
		await initializeTestProject(mainCore, "Stable Browser Reads", true);
		const config = await mainCore.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected initialized config");
		}
		await mainCore.filesystem.saveConfig({
			...config,
			checkActiveBranches: false,
			remoteOperations: false,
		});

		await mainCore.queryTasks({ includeCrossBranch: true });
		const store = await mainCore.getContentStore();
		const refreshSpy = spyOn(store, "refreshTasks");
		const taskEvents: string[] = [];
		const unsubscribe = store.subscribe((event) => {
			if (event.type === "tasks") taskEvents.push(event.type);
		});

		await mainCore.queryTasks({ includeCrossBranch: true });
		await mainCore.queryTasks({ query: "missing", includeCrossBranch: true });
		await mainCore.previewDuplicateTaskIdRepair();

		expect(refreshSpy).toHaveBeenCalledTimes(0);
		expect(taskEvents).toEqual([]);
		unsubscribe();
	});

	it("does not rebuild the task corpus when only the current branch commit changes", async () => {
		mainCore = new Core(TEST_DIR, { enableWatchers: true });
		await initializeTestProject(mainCore, "Current Branch Commit", true);
		const config = await mainCore.filesystem.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		await mainCore.filesystem.saveConfig({
			...config,
			checkActiveBranches: true,
			remoteOperations: false,
		});
		await $`git add backlog/config.yml`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Configure branch loading"`.cwd(TEST_DIR).quiet();

		expect(await mainCore.queryTasks({ includeCrossBranch: true })).toEqual([]);
		const store = await mainCore.getContentStore();
		const refreshSpy = spyOn(store, "refreshTasks");

		await Bun.write(`${TEST_DIR}/README.md`, "Unrelated current-branch change\n");
		await $`git add README.md`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Update readme"`.cwd(TEST_DIR).quiet();

		expect(await mainCore.queryTasks({ includeCrossBranch: true })).toEqual([]);
		expect(refreshSpy).toHaveBeenCalledTimes(0);
	});

	it("refreshes remote refs once when the browser read lease expires", async () => {
		mainCore = new Core(TEST_DIR, { enableWatchers: true });
		await initializeTestProject(mainCore, "Remote Ref Refresh", true);
		const config = await mainCore.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected initialized config");
		}
		await mainCore.filesystem.saveConfig({
			...config,
			checkActiveBranches: true,
			remoteOperations: true,
		});

		await mainCore.queryTasks({ includeCrossBranch: true });
		const fetchSpy = spyOn(mainCore.gitOps, "fetch");
		const refreshSpy = spyOn(await mainCore.getContentStore(), "refreshTasks");
		(mainCore as unknown as { lastRemoteRefRefreshAt: number }).lastRemoteRefRefreshAt = 0;

		await mainCore.queryTasks({ includeCrossBranch: true });
		await mainCore.queryTasks({ includeCrossBranch: true });

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(refreshSpy).toHaveBeenCalledTimes(0);
	});

	it("keeps browser reads available when a leased remote refresh fails", async () => {
		mainCore = new Core(TEST_DIR, { enableWatchers: true });
		await initializeTestProject(mainCore, "Remote Ref Failure", true);
		const config = await mainCore.filesystem.loadConfig();
		if (!config) {
			throw new Error("Expected initialized config");
		}
		await mainCore.filesystem.saveConfig({
			...config,
			checkActiveBranches: true,
			remoteOperations: true,
		});

		await mainCore.queryTasks({ includeCrossBranch: true });
		const fetchSpy = spyOn(mainCore.gitOps, "fetch").mockRejectedValue(new Error("remote unavailable"));
		const errorSpy = spyOn(console, "error").mockImplementation(() => {});
		(mainCore as unknown as { lastRemoteRefRefreshAt: number }).lastRemoteRefRefreshAt = 0;

		await expect(mainCore.queryTasks({ includeCrossBranch: true })).resolves.toBeArray();
		await expect(mainCore.queryTasks({ includeCrossBranch: true })).resolves.toBeArray();

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledWith("Failed to refresh remote refs:", expect.any(Error));
	});
});
