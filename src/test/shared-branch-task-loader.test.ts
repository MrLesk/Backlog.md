import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { BranchTaskLoader } from "../core/task-loader.ts";
import type { GitBranchTip, GitOperations } from "../git/operations.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const config: BacklogConfig = {
	projectName: "Loader test",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	milestones: [],
	dateFormat: "YYYY-MM-DD",
	checkActiveBranches: true,
	activeBranchDays: 30,
	remoteOperations: true,
	prefixes: { task: "task" },
};

function taskMarkdown(id: string, title: string): string {
	return `---
id: ${id}
title: ${title}
status: To Do
assignee: []
created_date: 2026-08-10
labels: []
dependencies: []
---

## Description

Cached branch task`;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve = () => {};
	const promise = new Promise<void>((accept) => {
		resolve = accept;
	});
	return { promise, resolve };
}

describe("shared immutable branch task loading", () => {
	it("builds the Git-free working-copy corpus through lifecycle identity resolution", async () => {
		const core = new Core("/tmp/working-copy-task-corpus-test");
		const active: Task = {
			id: "TASK-1",
			title: "Active lifecycle",
			status: "To Do",
			assignee: [],
			createdDate: "2026-08-10",
			labels: [],
			dependencies: [],
			filePath: "/tmp/working-copy-task-corpus-test/backlog/tasks/task-1 - Shared.md",
		};
		const completed: Task = {
			...active,
			id: "TASK-001",
			title: "Completed lifecycle",
			status: "Done",
			filePath: "/tmp/working-copy-task-corpus-test/backlog/completed/task-1 - Shared.md",
		};
		core.fs.listTasks = async () => [active];
		core.fs.listCompletedTasks = async () => [completed];
		core.fs.loadConfig = async () => config;

		expect((await core.loadWorkingCopyTasks(true)).map((task) => task.title)).toEqual(["Active lifecycle"]);
	});

	it("deduplicates same-SHA refs and reuses unchanged tree, history, and task reads", async () => {
		const sharedCommit = "1".repeat(40);
		const changedCommit = "2".repeat(40);
		const sharedPath = "backlog/tasks/task-1 - Shared.md";
		const changedPath = "backlog/tasks/task-2 - Changed.md";
		const treeCalls = new Map<string, number>();
		const historyCalls = new Map<string, number>();
		const showCalls = new Map<string, number>();
		const git = {
			listFilesInTree: async (commit: string) => {
				treeCalls.set(commit, (treeCalls.get(commit) ?? 0) + 1);
				return commit === sharedCommit ? [sharedPath] : [changedPath];
			},
			getBranchLastModifiedMap: async (commit: string) => {
				historyCalls.set(commit, (historyCalls.get(commit) ?? 0) + 1);
				const path = commit === sharedCommit ? sharedPath : changedPath;
				return new Map([[path, new Date("2026-08-10T00:00:00Z")]]);
			},
			showFile: async (commit: string) => {
				showCalls.set(commit, (showCalls.get(commit) ?? 0) + 1);
				return commit === sharedCommit ? taskMarkdown("TASK-1", "Shared task") : taskMarkdown("TASK-2", "Changed task");
			},
		} as unknown as GitOperations;
		const loader = new BranchTaskLoader(git);
		const currentTip: GitBranchTip = { name: "main", commit: "0".repeat(40), current: true };
		const localTip: GitBranchTip = { name: "feature/shared", commit: sharedCommit, current: false };
		const firstTips: GitBranchTip[] = [
			currentTip,
			localTip,
			{ name: "origin/feature/shared", commit: sharedCommit, current: false },
		];

		const { entries: first } = await loader.load(firstTips, config, [], false);
		const firstTasks = first.flatMap((entry) => (entry.task ? [entry.task] : []));
		expect(treeCalls).toEqual(new Map([[sharedCommit, 1]]));
		expect(historyCalls).toEqual(new Map([[sharedCommit, 1]]));
		expect(showCalls).toEqual(new Map([[sharedCommit, 1]]));
		expect(first.map((entry) => entry.branch).sort()).toEqual(["feature/shared", "origin/feature/shared"]);
		expect(firstTasks.map((task) => task.source).sort()).toEqual(["local-branch", "remote"]);

		const mutableResult = firstTasks[0];
		if (!mutableResult) throw new Error("Expected the shared task to be hydrated");
		mutableResult.title = "Mutated result";
		const { entries: second } = await loader.load(firstTips, config, [], false);
		expect(second.flatMap((entry) => (entry.task ? [entry.task.title] : []))).toEqual(["Shared task", "Shared task"]);
		expect(treeCalls).toEqual(new Map([[sharedCommit, 1]]));
		expect(historyCalls).toEqual(new Map([[sharedCommit, 1]]));
		expect(showCalls).toEqual(new Map([[sharedCommit, 1]]));

		const changedTips: GitBranchTip[] = [
			currentTip,
			localTip,
			{ name: "origin/feature/shared", commit: changedCommit, current: false },
		];
		const { entries: changed } = await loader.load(changedTips, config, [], false);
		expect(changed.flatMap((entry) => (entry.task ? [entry.task.title] : [])).sort()).toEqual([
			"Changed task",
			"Shared task",
		]);
		expect(treeCalls).toEqual(
			new Map([
				[sharedCommit, 1],
				[changedCommit, 1],
			]),
		);
		expect(historyCalls).toEqual(treeCalls);
		expect(showCalls).toEqual(treeCalls);
	});

	it("hydrates a cached branch fallback when a warm public read sees its local identity removed", async () => {
		const projectRoot = createUniqueTestDir("working-copy-branch-fallback");
		const core = new Core(projectRoot, { enableWatchers: true });
		const branchCommit = "9".repeat(40);
		const branchPath = "backlog/tasks/task-1 - Shared.md";
		const localTask: Task = {
			id: "TASK-1",
			title: "Working copy",
			status: "To Do",
			assignee: [],
			createdDate: "2026-08-10",
			updatedDate: "2026-08-11",
			labels: [],
			dependencies: [],
			filePath: join(projectRoot, branchPath),
		};
		let workingCopyTasks = [localTask];
		let treeCalls = 0;
		let historyCalls = 0;
		let hydrationCalls = 0;

		try {
			await initializeFilesystemTestProject(core, "Working-copy branch fallback");
			core.fs.loadConfig = async () => ({ ...config, remoteOperations: false });
			core.fs.listTasks = async () => workingCopyTasks;
			core.fs.listCompletedTasks = async () => [];
			core.listTasksWithMetadata = async () => workingCopyTasks;
			core.git.listRecentBranchTips = async () => [
				{ name: "main", commit: "0".repeat(40), current: true },
				{ name: "feature/fallback", commit: branchCommit, current: false },
			];
			core.git.listFilesInTree = async () => {
				treeCalls += 1;
				return [branchPath];
			};
			core.git.getBranchLastModifiedMap = async () => {
				historyCalls += 1;
				return new Map([[branchPath, new Date("2026-08-10T00:00:00Z")]]);
			};
			core.git.showFile = async () => {
				hydrationCalls += 1;
				return taskMarkdown("TASK-1", "Branch fallback");
			};
			core.git.getRepositoryRoot = async () => null;

			expect((await core.queryTasks()).map((task) => task.title)).toEqual(["Working copy"]);
			expect({ treeCalls, historyCalls, hydrationCalls }).toEqual({
				treeCalls: 1,
				historyCalls: 1,
				hydrationCalls: 0,
			});

			workingCopyTasks = [];
			expect((await core.queryTasks()).map((task) => task.title)).toEqual(["Branch fallback"]);
			expect({ treeCalls, historyCalls, hydrationCalls }).toEqual({
				treeCalls: 1,
				historyCalls: 1,
				hydrationCalls: 1,
			});
		} finally {
			core.disposeContentStore();
			await safeCleanup(projectRoot);
		}
	});

	it("retries an incomplete stable branch generation on the next warm public read", async () => {
		const projectRoot = createUniqueTestDir("incomplete-branch-generation-retry");
		const core = new Core(projectRoot, { enableWatchers: true });
		const goodCommit = "a".repeat(40);
		const flakyCommit = "b".repeat(40);
		const goodPath = "backlog/tasks/task-1 - Healthy.md";
		const flakyPath = "backlog/tasks/task-2 - Recovered.md";
		const treeCalls = new Map<string, number>();
		const historyCalls = new Map<string, number>();
		const hydrationCalls = new Map<string, number>();
		let flakyFailures = 1;

		try {
			await initializeFilesystemTestProject(core, "Incomplete branch generation retry");
			core.fs.loadConfig = async () => ({ ...config, remoteOperations: false });
			core.fs.listTasks = async () => [];
			core.fs.listCompletedTasks = async () => [];
			core.listTasksWithMetadata = async () => [];
			core.git.listRecentBranchTips = async () => [
				{ name: "main", commit: "0".repeat(40), current: true },
				{ name: "feature/good", commit: goodCommit, current: false },
				{ name: "feature/flaky", commit: flakyCommit, current: false },
			];
			core.git.listFilesInTree = async (commit) => {
				treeCalls.set(commit, (treeCalls.get(commit) ?? 0) + 1);
				if (commit === flakyCommit && flakyFailures-- > 0) throw new Error("tree temporarily unavailable");
				return [commit === goodCommit ? goodPath : flakyPath];
			};
			core.git.getBranchLastModifiedMap = async (commit) => {
				historyCalls.set(commit, (historyCalls.get(commit) ?? 0) + 1);
				const path = commit === goodCommit ? goodPath : flakyPath;
				return new Map([[path, new Date("2026-08-10T00:00:00Z")]]);
			};
			core.git.showFile = async (commit) => {
				hydrationCalls.set(commit, (hydrationCalls.get(commit) ?? 0) + 1);
				return commit === goodCommit
					? taskMarkdown("TASK-1", "Healthy task")
					: taskMarkdown("TASK-2", "Recovered task");
			};
			core.git.getRepositoryRoot = async () => null;

			expect((await core.queryTasks()).map((task) => task.title)).toEqual(["Healthy task"]);
			expect({
				goodTrees: treeCalls.get(goodCommit),
				flakyTrees: treeCalls.get(flakyCommit),
				goodHistory: historyCalls.get(goodCommit),
				flakyHistory: historyCalls.get(flakyCommit),
				goodHydrations: hydrationCalls.get(goodCommit),
				flakyHydrations: hydrationCalls.get(flakyCommit),
			}).toEqual({
				goodTrees: 1,
				flakyTrees: 1,
				goodHistory: 1,
				flakyHistory: undefined,
				goodHydrations: 1,
				flakyHydrations: undefined,
			});

			const recoveredTitles = (await core.queryTasks()).map((task) => task.title);
			expect(recoveredTitles).toEqual(["Healthy task", "Recovered task"]);
			expect({
				goodTrees: treeCalls.get(goodCommit),
				flakyTrees: treeCalls.get(flakyCommit),
				goodHistory: historyCalls.get(goodCommit),
				flakyHistory: historyCalls.get(flakyCommit),
				goodHydrations: hydrationCalls.get(goodCommit),
				flakyHydrations: hydrationCalls.get(flakyCommit),
			}).toEqual({
				goodTrees: 1,
				flakyTrees: 2,
				goodHistory: 1,
				flakyHistory: 1,
				goodHydrations: 1,
				flakyHydrations: 1,
			});
			expect((await core.queryTasks()).map((task) => task.title)).toEqual(recoveredTitles);
			expect(treeCalls.get(flakyCommit)).toBe(2);
		} finally {
			core.disposeContentStore();
			await safeCleanup(projectRoot);
		}
	});

	it("does not repeat the stable ref snapshot after a cold list or task read", async () => {
		for (const read of ["list", "view"] as const) {
			const projectRoot = createUniqueTestDir(`cold-${read}-task-corpus`);
			const core = new Core(projectRoot, { enableWatchers: true });
			try {
				await initializeFilesystemTestProject(core, `Cold ${read} task corpus`);
				const savedConfig = await core.fs.loadConfig();
				if (!savedConfig) throw new Error("Expected test config");
				await core.fs.saveConfig({
					...savedConfig,
					filesystemOnly: false,
					checkActiveBranches: true,
					remoteOperations: false,
				});
				await core.fs.saveTask({
					id: "TASK-1",
					title: "Local task",
					status: "To Do",
					assignee: [],
					createdDate: "2026-08-10",
					labels: [],
					dependencies: [],
				});

				let tipCalls = 0;
				core.git.listRecentBranchTips = async () => {
					tipCalls += 1;
					return [{ name: "main", commit: "0".repeat(40), current: true }];
				};
				core.git.getRepositoryRoot = async () => null;

				if (read === "list") {
					const results = await Promise.all([core.queryTasks(), core.queryTasks()]);
					expect(results.map((tasks) => tasks.map((task) => task.id))).toEqual([["TASK-1"], ["TASK-1"]]);
				} else {
					const results = await Promise.all([core.getTask("TASK-1"), core.getTask("TASK-1")]);
					expect(results.map((task) => task?.title)).toEqual(["Local task", "Local task"]);
				}
				expect(tipCalls).toBe(2);
			} finally {
				core.disposeContentStore();
				await safeCleanup(projectRoot);
			}
		}
	});

	it("keeps immutable history cache results independent of the moving active-window cutoff", async () => {
		const branchCommit = "6".repeat(40);
		const path = "backlog/tasks/task-1 - Cached.md";
		const fileModified = new Date("2026-07-12T00:00:00Z");
		const originalNow = Date.now;
		let logicalNow = new Date("2026-08-10T12:00:00Z").getTime();
		Date.now = () => logicalNow;
		let warmHistoryCalls = 0;
		const createGit = (onHistory?: () => void) =>
			({
				getCurrentBranch: async () => "main",
				listFilesInTree: async () => [path],
				getBranchLastModifiedMap: async (_commit: string, _dir: string, since?: number | Date) => {
					onHistory?.();
					return since instanceof Date && fileModified < since ? new Map() : new Map([[path, fileModified]]);
				},
				showFile: async () => taskMarkdown("TASK-1", "Cached task"),
			}) as unknown as GitOperations;
		const tips: GitBranchTip[] = [
			{ name: "main", commit: "0".repeat(40), current: true },
			{ name: "feature/cached", commit: branchCommit, current: false },
		];
		const warmLoader = new BranchTaskLoader(
			createGit(() => {
				warmHistoryCalls += 1;
			}),
		);

		try {
			await warmLoader.load(tips, config, [], false);
			logicalNow = new Date("2026-08-12T12:00:00Z").getTime();
			const { entries: warm } = await warmLoader.load(tips, config, [], false);
			const { entries: cold } = await new BranchTaskLoader(createGit()).load(tips, config, [], false);

			expect(warmHistoryCalls).toBe(2);
			expect(warm.map((entry) => entry.lastModified.toISOString())).toEqual(
				cold.map((entry) => entry.lastModified.toISOString()),
			);
		} finally {
			Date.now = originalNow;
		}
	});

	it("uses the unborn branch name when no ref is marked current", async () => {
		const featureCommit = "7".repeat(40);
		const path = "backlog/tasks/task-1 - Feature.md";
		const git = {
			getCurrentBranch: async () => "blank",
			listFilesInTree: async () => [path],
			getBranchLastModifiedMap: async () => new Map([[path, new Date("2026-08-10T00:00:00Z")]]),
			showFile: async () => taskMarkdown("TASK-1", "Feature task"),
		} as unknown as GitOperations;
		const loader = new BranchTaskLoader(git);

		const { entries: loaded } = await loader.load(
			[{ name: "feature/task", commit: featureCommit, current: false }],
			{ ...config, remoteOperations: false },
			[],
			false,
		);

		expect(loaded.map((entry) => entry.branch)).toEqual(["feature/task"]);
		expect(loaded.flatMap((entry) => (entry.task ? [entry.task.title] : []))).toEqual(["Feature task"]);
	});

	it("does not treat local refs as other branches while HEAD is detached", async () => {
		const git = {
			getCurrentBranch: async () => "",
		} as unknown as GitOperations;
		const loader = new BranchTaskLoader(git);

		expect(
			(
				await loader.load(
					[{ name: "feature/task", commit: "8".repeat(40), current: false }],
					{ ...config, remoteOperations: false },
					[],
					false,
				)
			).entries,
		).toEqual([]);
	});

	it("refreshes a warm corpus when an unborn branch becomes detached", async () => {
		const projectRoot = createUniqueTestDir("orphan-detached-task-corpus");
		const core = new Core(projectRoot, { enableWatchers: true });
		try {
			await initializeFilesystemTestProject(core, "Orphan detached task corpus");
			const savedConfig = await core.fs.loadConfig();
			if (!savedConfig) throw new Error("Expected test config");
			await core.fs.saveConfig({
				...savedConfig,
				filesystemOnly: false,
				checkActiveBranches: true,
				remoteOperations: false,
			});
			const featureCommit = "9".repeat(40);
			const path = "backlog/tasks/task-1 - Feature.md";
			let currentBranch = "blank";
			core.git.listRecentBranchTips = async () => [{ name: "feature/task", commit: featureCommit, current: false }];
			core.git.getCurrentBranch = async () => currentBranch;
			core.git.listFilesInTree = async () => [path];
			core.git.getBranchLastModifiedMap = async () => new Map([[path, new Date("2026-08-10T00:00:00Z")]]);
			core.git.showFile = async () => taskMarkdown("TASK-1", "Feature task");
			core.git.getRepositoryRoot = async () => null;

			expect((await core.queryTasks()).map((task) => task.title)).toEqual(["Feature task"]);
			currentBranch = "";
			expect(await core.queryTasks()).toEqual([]);
		} finally {
			core.disposeContentStore();
			await safeCleanup(projectRoot);
		}
	});

	it("refreshes a warm corpus when its absolute history cutoff rolls forward", async () => {
		const projectRoot = createUniqueTestDir("history-cutoff-task-corpus");
		const core = new Core(projectRoot, { enableWatchers: true });
		const originalNow = Date.now;
		let logicalNow = new Date("2026-08-10T12:00:00Z").getTime();
		Date.now = () => logicalNow;
		try {
			await initializeFilesystemTestProject(core, "History cutoff task corpus");
			const savedConfig = await core.fs.loadConfig();
			if (!savedConfig) throw new Error("Expected test config");
			await core.fs.saveConfig({
				...savedConfig,
				filesystemOnly: false,
				checkActiveBranches: true,
				activeBranchDays: 30,
				remoteOperations: false,
			});
			const featureCommit = "a".repeat(40);
			const path = "backlog/tasks/task-1 - Feature.md";
			const fileModified = new Date("2026-07-11T12:00:00Z");
			let historyCalls = 0;
			core.git.listRecentBranchTips = async () => [
				{ name: "main", commit: "0".repeat(40), current: true },
				{ name: "feature/task", commit: featureCommit, current: false },
			];
			core.git.listFilesInTree = async () => [path];
			core.git.getBranchLastModifiedMap = async (_commit, _dir, since) => {
				historyCalls += 1;
				return since instanceof Date && fileModified < since ? new Map() : new Map([[path, fileModified]]);
			};
			core.git.showFile = async () => taskMarkdown("TASK-1", "Feature task");
			core.git.getRepositoryRoot = async () => null;

			expect((await core.queryTasks()).map((task) => task.title)).toEqual(["Feature task"]);
			logicalNow = new Date("2026-08-11T12:00:00Z").getTime();
			expect((await core.queryTasks()).map((task) => task.title)).toEqual(["Feature task"]);
			expect(historyCalls).toBe(2);
		} finally {
			Date.now = originalNow;
			core.disposeContentStore();
			await safeCleanup(projectRoot);
		}
	});

	it("retries a cold load when the current branch advances after local tasks are read", async () => {
		const core = new Core("/tmp/current-tip-stability-test");
		const oldTask: Task = {
			id: "TASK-1",
			title: "Old working copy",
			status: "To Do",
			assignee: [],
			createdDate: "2026-08-10",
			labels: [],
			dependencies: [],
		};
		const newTask = { ...oldTask, title: "New working copy" };
		let localLoads = 0;
		let tipCalls = 0;
		core.fs.loadConfig = async () => ({ ...config, remoteOperations: false });
		core.fs.listCompletedTasks = async () => [];
		core.listTasksWithMetadata = async () => (localLoads++ === 0 ? [oldTask] : [newTask]);
		core.git.listRecentBranchTips = async () => {
			tipCalls += 1;
			return [
				{
					name: "main",
					commit: (tipCalls === 1 ? "b" : "c").repeat(40),
					current: true,
				},
			];
		};
		core.git.getRepositoryRoot = async () => null;

		expect((await core.loadTasks()).map((task) => task.title)).toEqual(["New working copy"]);
		expect(localLoads).toBe(2);
		expect(tipCalls).toBe(3);
	});

	it("returns statistics metadata from the same stable config generation as its tasks", async () => {
		const core = new Core("/tmp/statistics-config-generation-test");
		const oldConfig = {
			...config,
			checkActiveBranches: false,
			statuses: ["Old", "Done"],
			priorities: ["Low"],
		};
		const newConfig = {
			...oldConfig,
			statuses: ["Queued", "Done"],
			priorities: ["Urgent"],
		};
		let configLoads = 0;
		core.fs.loadConfig = async () => (configLoads++ === 0 ? oldConfig : newConfig);
		core.fs.listCompletedTasks = async () => [];
		core.fs.listDrafts = async () => [];
		core.listTasksWithMetadata = async () => [];
		core.git.getRepositoryRoot = async () => null;

		const statistics = await core.loadAllTasksForStatistics();

		expect(statistics.statuses).toEqual(["Queued", "Done"]);
		expect(statistics.priorities).toEqual(["Urgent"]);
	});

	it("does not let an old-root fetch lease suppress the new root", async () => {
		const core = new Core("/tmp/old-fetch-root");
		const oldFetchStarted = new Promise<void>((resolve) => {
			core.git.fetch = async () => {
				resolve();
				await oldFetchGate;
			};
		});
		let releaseOldFetch: () => void = () => {};
		const oldFetchGate = new Promise<void>((resolve) => {
			releaseOldFetch = resolve;
		});
		const internals = core as unknown as {
			refreshRemoteRefsForTaskRead: (loadedConfig: BacklogConfig) => Promise<void>;
		};
		const loadedConfig = { ...config, checkActiveBranches: true, remoteOperations: true };
		const oldRefresh = internals.refreshRemoteRefsForTaskRead(loadedConfig);
		await oldFetchStarted;

		core.reinitializeProjectRoot("/tmp/new-fetch-root");
		let newFetches = 0;
		core.git.fetch = async () => {
			newFetches += 1;
		};
		releaseOldFetch();
		await oldRefresh;
		await internals.refreshRemoteRefsForTaskRead(loadedConfig);

		expect(newFetches).toBe(1);
	});

	it("retries a working-copy task snapshot after the project root changes", async () => {
		const core = new Core("/tmp/working-copy-root-a");
		const oldFilesystem = core.fs;
		let releaseOldTasks: () => void = () => {};
		let markOldTasksStarted: () => void = () => {};
		const oldTasksStarted = new Promise<void>((resolve) => {
			markOldTasksStarted = resolve;
		});
		const oldTasksGate = new Promise<void>((resolve) => {
			releaseOldTasks = resolve;
		});
		oldFilesystem.listTasks = async () => {
			markOldTasksStarted();
			await oldTasksGate;
			return [
				{
					id: "TASK-1",
					title: "Old root task",
					status: "To Do",
					assignee: [],
					createdDate: "2026-08-10",
					labels: [],
					dependencies: [],
				},
			];
		};
		oldFilesystem.listCompletedTasks = async () => [];
		oldFilesystem.loadConfig = async () => ({ ...config, checkActiveBranches: false });
		const loading = core.loadWorkingCopyTasks(true);
		await oldTasksStarted;

		core.reinitializeProjectRoot("/tmp/working-copy-root-b");
		core.fs.listTasks = async () => [
			{
				id: "TASK-2",
				title: "New root task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-08-10",
				labels: [],
				dependencies: [],
			},
		];
		core.fs.listCompletedTasks = async () => [];
		core.fs.loadConfig = async () => ({ ...config, checkActiveBranches: false });
		releaseOldTasks();

		expect((await loading).map((task) => task.title)).toEqual(["New root task"]);
	});

	it("retries local reads when the selected backlog directory changes on the same filesystem", async () => {
		for (const read of ["working-copy", "query"] as const) {
			const core = new Core(`/tmp/logical-root-${read}`);
			const filesystem = core.fs;
			filesystem.setBacklogDirectory("root-a");
			const oldTask: Task = {
				id: "TASK-1",
				title: "Root A task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-08-10",
				labels: [],
				dependencies: [],
				filePath: `/tmp/logical-root-${read}/root-a/tasks/task-1.md`,
			};
			const newTask: Task = {
				...oldTask,
				title: "Root B task",
				filePath: `/tmp/logical-root-${read}/root-b/tasks/task-1.md`,
			};
			const firstLoad = deferred();
			const releaseFirstLoad = deferred();
			let loads = 0;
			filesystem.listTasks = async () => {
				loads += 1;
				if (loads === 1) {
					firstLoad.resolve();
					await releaseFirstLoad.promise;
					return [oldTask];
				}
				return [newTask];
			};
			filesystem.listCompletedTasks = async () => [];
			filesystem.loadConfig = async () => ({ ...config, checkActiveBranches: false });

			const loading =
				read === "working-copy" ? core.loadWorkingCopyTasks(true) : core.queryTasks({ includeCrossBranch: false });
			await firstLoad.promise;
			filesystem.setBacklogDirectory("root-b");
			releaseFirstLoad.resolve();

			expect((await loading).map((task) => task.title)).toEqual(["Root B task"]);
			expect(loads).toBe(2);
		}
	});

	it("rechecks a newer branch snapshot after joining an older refresh", async () => {
		const core = new Core("/tmp/coalesced-branch-refresh");
		core.fs.loadConfig = async () => ({ ...config, remoteOperations: false });
		const refreshStarted = deferred();
		const releaseFirstRefresh = deferred();
		const internals = core as unknown as {
			activeBranchFingerprint: string | null;
			contentStore?: Awaited<ReturnType<Core["getContentStore"]>>;
			getActiveBranchSnapshot: () => Promise<{
				branchTips: GitBranchTip[];
				currentBranch: string;
				fingerprint: string;
				stabilityFingerprint: string;
				settingsKey: string;
			}>;
		};
		let snapshotCalls = 0;
		internals.getActiveBranchSnapshot = async () => {
			const fingerprint = snapshotCalls++ === 0 ? "snapshot-a" : "snapshot-b";
			return {
				branchTips: [],
				currentBranch: "main",
				fingerprint,
				stabilityFingerprint: fingerprint,
				settingsKey: "settings",
			};
		};
		let refreshCalls = 0;
		const store = {
			dispose() {},
			ensureInitialized: async () => {},
			isInitialized: () => true,
			refreshTasks: async () => {
				refreshCalls += 1;
				if (refreshCalls === 1) {
					refreshStarted.resolve();
					await releaseFirstRefresh.promise;
					internals.activeBranchFingerprint = "snapshot-a";
					return;
				}
				internals.activeBranchFingerprint = "snapshot-b";
			},
		} as unknown as Awaited<ReturnType<Core["getContentStore"]>>;
		internals.contentStore = store;
		internals.activeBranchFingerprint = "stale";

		const first = core.refreshTasksForTaskRead();
		await refreshStarted.promise;
		const second = core.refreshTasksForTaskRead();
		releaseFirstRefresh.resolve();
		expect(await Promise.all([first, second])).toEqual([true, true]);
		expect(refreshCalls).toBe(2);
		expect(internals.activeBranchFingerprint).toBe("snapshot-b");
	});

	it("returns the current content store when the project is reinitialized during initialization", async () => {
		const core = new Core("/tmp/content-store-root-a");
		const oldInitializationStarted = deferred();
		const releaseOldInitialization = deferred();
		type Store = Awaited<ReturnType<Core["getContentStore"]>>;
		const oldStore = {
			dispose() {},
			ensureInitialized: async () => {
				oldInitializationStarted.resolve();
				await releaseOldInitialization.promise;
			},
		} as unknown as Store;
		let newInitializations = 0;
		const newStore = {
			dispose() {},
			ensureInitialized: async () => {
				newInitializations += 1;
			},
		} as unknown as Store;
		const internals = core as unknown as { contentStore?: Store };
		internals.contentStore = oldStore;

		const loading = core.getContentStore();
		await oldInitializationStarted.promise;
		core.reinitializeProjectRoot("/tmp/content-store-root-b");
		internals.contentStore = newStore;
		releaseOldInitialization.resolve();

		expect(await loading).toBe(newStore);
		expect(newInitializations).toBe(1);
	});

	it("uses hidden local completed tasks to suppress older active branch state", async () => {
		const core = new Core("/tmp/hidden-local-completed");
		const branchCommit = "d".repeat(40);
		const branchPath = "backlog/tasks/task-1 - Shared.md";
		const completedTask: Task = {
			id: "TASK-1",
			title: "Completed locally",
			status: "Done",
			assignee: [],
			createdDate: "2026-08-10",
			labels: [],
			dependencies: [],
			filePath: "/tmp/hidden-local-completed/backlog/completed/task-1 - Shared.md",
		};
		core.fs.loadConfig = async () => ({ ...config, remoteOperations: false });
		core.fs.listCompletedTasks = async () => [completedTask];
		core.listTasksWithMetadata = async () => [];
		core.git.listRecentBranchTips = async () => [
			{ name: "main", commit: "0".repeat(40), current: true },
			{ name: "feature/active", commit: branchCommit, current: false },
		];
		core.git.listFilesInTree = async () => [branchPath];
		core.git.getBranchLastModifiedMap = async () => new Map([[branchPath, new Date("2026-08-09T00:00:00Z")]]);
		core.git.showFile = async () => taskMarkdown("TASK-1", "Older branch state");
		core.git.getRepositoryRoot = async () => null;

		expect(await core.loadTasks()).toEqual([]);
		const included = await core.loadTasks(undefined, undefined, { includeCompleted: true });
		expect(included.map((task) => ({ source: task.source, status: task.status, title: task.title }))).toEqual([
			{ source: "completed", status: "Done", title: "Completed locally" },
		]);
	});

	it("does not publish a stable branch snapshot from an old project generation", async () => {
		const core = new Core("/tmp/task-corpus-root-a");
		let releaseOldTasks = () => {};
		let markOldTasksStarted = () => {};
		const oldTasksStarted = new Promise<void>((resolve) => {
			markOldTasksStarted = resolve;
		});
		const oldTasksGate = new Promise<void>((resolve) => {
			releaseOldTasks = resolve;
		});
		core.fs.loadConfig = async () => ({ ...config, checkActiveBranches: false });
		core.listTasksWithMetadata = async () => {
			markOldTasksStarted();
			await oldTasksGate;
			return [
				{
					id: "TASK-1",
					title: "Old root task",
					status: "To Do",
					assignee: [],
					createdDate: "2026-08-10",
					labels: [],
					dependencies: [],
				},
			];
		};
		const loading = core.loadTasks();
		await oldTasksStarted;

		core.reinitializeProjectRoot("/tmp/task-corpus-root-b");
		core.fs.loadConfig = async () => ({ ...config, checkActiveBranches: false });
		core.git.getRepositoryRoot = async () => null;
		core.listTasksWithMetadata = async () => [
			{
				id: "TASK-2",
				title: "New root task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-08-10",
				labels: [],
				dependencies: [],
			},
		];
		releaseOldTasks();

		expect((await loading).map((task) => task.title)).toEqual(["New root task"]);
	});

	it("retries warm public reads instead of returning a disposed old-root store", async () => {
		const rootA = createUniqueTestDir("warm-public-read-root-a");
		const rootB = createUniqueTestDir("warm-public-read-root-b");
		try {
			for (const read of ["list", "task"] as const) {
				for (const [root, title] of [
					[rootA, "Old root task"],
					[rootB, "New root task"],
				] as const) {
					const setup = new Core(root);
					await initializeFilesystemTestProject(setup, title);
					const savedConfig = await setup.fs.loadConfig();
					if (!savedConfig) throw new Error("Expected test config");
					await setup.fs.saveConfig({ ...savedConfig, checkActiveBranches: false, remoteOperations: false });
					await setup.fs.saveTask({
						id: "TASK-1",
						title,
						status: "To Do",
						assignee: [],
						createdDate: "2026-08-10",
						labels: [],
						dependencies: [],
					});
				}

				const core = new Core(rootA, { enableWatchers: true });
				try {
					await core.queryTasks();
					const oldFilesystem = core.fs;
					const loadOldConfig = oldFilesystem.loadConfig.bind(oldFilesystem);
					const configGate = deferred();
					const configStarted = deferred();
					oldFilesystem.loadConfig = async () => {
						configStarted.resolve();
						await configGate.promise;
						return await loadOldConfig();
					};

					const reading =
						read === "list"
							? core.queryTasks().then((tasks) => tasks.map((task) => task.title))
							: core.getTask("TASK-1").then((task) => (task ? [task.title] : []));
					await configStarted.promise;
					core.reinitializeProjectRoot(rootB);
					configGate.resolve();

					expect(await reading).toEqual(["New root task"]);
				} finally {
					core.disposeContentStore();
				}
			}
		} finally {
			await safeCleanup(rootA);
			await safeCleanup(rootB);
		}
	});

	it("keeps task details and subtask summaries on one project generation", async () => {
		const rootA = createUniqueTestDir("task-details-root-a");
		const rootB = createUniqueTestDir("task-details-root-b");
		try {
			for (const [root, label] of [
				[rootA, "Old root"],
				[rootB, "New root"],
			] as const) {
				const setup = new Core(root);
				await initializeFilesystemTestProject(setup, label);
				const savedConfig = await setup.fs.loadConfig();
				if (!savedConfig) throw new Error("Expected test config");
				await setup.fs.saveConfig({ ...savedConfig, checkActiveBranches: false, remoteOperations: false });
				await setup.fs.saveTask({
					id: "TASK-1",
					title: `${label} parent`,
					status: "To Do",
					assignee: [],
					createdDate: "2026-08-10",
					labels: [],
					dependencies: [],
				});
				await setup.fs.saveTask({
					id: "TASK-2",
					title: `${label} child`,
					status: "To Do",
					assignee: [],
					createdDate: "2026-08-10",
					labels: [],
					dependencies: [],
					parentTaskId: "TASK-1",
				});
			}

			const core = new Core(rootA, { enableWatchers: true });
			try {
				await core.queryTasks();
				const oldFilesystem = core.fs;
				const listOldTasks = oldFilesystem.listTasks.bind(oldFilesystem);
				const listGate = deferred();
				const listStarted = deferred();
				oldFilesystem.listTasks = async () => {
					listStarted.resolve();
					await listGate.promise;
					return await listOldTasks();
				};

				const reading = core.getTaskWithSubtasks("TASK-1", undefined, { refreshCrossBranch: false });
				await listStarted.promise;
				core.reinitializeProjectRoot(rootB);
				listGate.resolve();
				const task = await reading;

				expect(task?.title).toBe("New root parent");
				expect(task?.subtaskSummaries).toEqual([{ id: "TASK-2", title: "New root child" }]);
			} finally {
				core.disposeContentStore();
			}
		} finally {
			await safeCleanup(rootA);
			await safeCleanup(rootB);
		}
	});

	it("keeps equal-time winner selection stable when cold scans finish out of ref order and later come from cache", async () => {
		const alphaCommit = "3".repeat(40);
		const betaCommit = "4".repeat(40);
		const gammaCommit = "5".repeat(40);
		const path = "backlog/completed/task-1 - Shared.md";
		const showCalls = new Map<string, number>();
		const started = new Map([
			[alphaCommit, deferred()],
			[betaCommit, deferred()],
			[gammaCommit, deferred()],
		]);
		const releases = new Map([
			[alphaCommit, deferred()],
			[betaCommit, deferred()],
			[gammaCommit, deferred()],
		]);
		const completed = new Map([
			[alphaCommit, deferred()],
			[betaCommit, deferred()],
			[gammaCommit, deferred()],
		]);
		const scanCompletionOrder: string[] = [];
		const git = {
			listFilesInTree: async (commit: string) => {
				started.get(commit)?.resolve();
				await releases.get(commit)?.promise;
				scanCompletionOrder.push(commit);
				completed.get(commit)?.resolve();
				return [path];
			},
			getBranchLastModifiedMap: async () => new Map([[path, new Date("2026-08-10T00:00:00Z")]]),
			showFile: async (commit: string) => {
				showCalls.set(commit, (showCalls.get(commit) ?? 0) + 1);
				return taskMarkdown("TASK-1", "Stable tie winner");
			},
		} as unknown as GitOperations;
		const loader = new BranchTaskLoader(git);
		const tips: GitBranchTip[] = [
			{ name: "main", commit: "0".repeat(40), current: true },
			{ name: "feature/alpha", commit: alphaCommit, current: false },
			{ name: "feature/beta", commit: betaCommit, current: false },
			{ name: "feature/gamma", commit: gammaCommit, current: false },
		];

		const coldLoad = loader.load(tips, config, [], true);
		await Promise.all([...started.values()].map((barrier) => barrier.promise));
		for (const commit of [alphaCommit, betaCommit, gammaCommit]) {
			releases.get(commit)?.resolve();
			await completed.get(commit)?.promise;
		}
		await coldLoad;
		expect(scanCompletionOrder).toEqual([alphaCommit, betaCommit, gammaCommit]);
		expect(showCalls).toEqual(new Map([[alphaCommit, 1]]));
		await loader.load(tips, config, [], true);
		expect(showCalls).toEqual(new Map([[alphaCommit, 1]]));
	});

	it("fetches before tips, retries a moved ref through the caches, and publishes only the stable generation", async () => {
		const oldCommit = "a".repeat(40);
		const newCommit = "b".repeat(40);
		const currentCommit = "c".repeat(40);
		const oldPath = "backlog/tasks/task-1 - Old.md";
		const newPath = "backlog/tasks/task-2 - New.md";
		const currentTip: GitBranchTip = { name: "main", commit: currentCommit, current: true };
		const oldTips: GitBranchTip[] = [currentTip, { name: "origin/feature", commit: oldCommit, current: false }];
		const newTips: GitBranchTip[] = [currentTip, { name: "origin/feature", commit: newCommit, current: false }];
		const core = new Core("/tmp/shared-branch-task-loader-test");
		let fetchCalls = 0;
		let tipCalls = 0;
		let resolveCalls = 0;
		let branchEnumerationCalls = 0;
		const events: string[] = [];
		const treeCalls = new Map<string, number>();
		const historyCalls = new Map<string, number>();
		const showCalls = new Map<string, number>();

		core.fs.loadConfig = async () => config;
		core.fs.listCompletedTasks = async () => [];
		core.listTasksWithMetadata = async () => [];
		core.git.fetch = async () => {
			fetchCalls += 1;
			events.push("fetch");
		};
		core.git.listRecentBranchTips = async () => {
			tipCalls += 1;
			events.push("tips");
			return tipCalls === 1 ? oldTips : newTips;
		};
		core.git.resolveCommit = async () => {
			resolveCalls += 1;
			return null;
		};
		core.git.listRecentBranches = async () => {
			branchEnumerationCalls += 1;
			return [];
		};
		core.git.listRecentRemoteBranches = async () => {
			branchEnumerationCalls += 1;
			return [];
		};
		core.git.listFilesInTree = async (commit) => {
			treeCalls.set(commit, (treeCalls.get(commit) ?? 0) + 1);
			return commit === oldCommit ? [oldPath] : [newPath];
		};
		core.git.getBranchLastModifiedMap = async (commit) => {
			historyCalls.set(commit, (historyCalls.get(commit) ?? 0) + 1);
			const path = commit === oldCommit ? oldPath : newPath;
			return new Map([[path, new Date("2026-08-10T00:00:00Z")]]);
		};
		core.git.showFile = async (commit) => {
			showCalls.set(commit, (showCalls.get(commit) ?? 0) + 1);
			return commit === oldCommit ? taskMarkdown("TASK-1", "Stale task") : taskMarkdown("TASK-2", "Stable task");
		};
		core.git.getRepositoryRoot = async () => null;

		const first = await core.loadTasks();
		expect(first.map((task) => task.title)).toEqual(["Stable task"]);
		expect(fetchCalls).toBe(1);
		expect(events.slice(0, 2)).toEqual(["fetch", "tips"]);
		expect(tipCalls).toBe(3);
		expect(resolveCalls).toBe(0);
		expect(branchEnumerationCalls).toBe(0);
		expect(treeCalls).toEqual(
			new Map([
				[oldCommit, 1],
				[newCommit, 1],
			]),
		);
		expect(historyCalls).toEqual(treeCalls);
		expect(showCalls).toEqual(treeCalls);

		const second = await core.loadTasks();
		expect(second.map((task) => task.title)).toEqual(["Stable task"]);
		expect(fetchCalls).toBe(1);
		expect(tipCalls).toBe(5);
		expect(treeCalls.get(newCommit)).toBe(1);
		expect(historyCalls.get(newCommit)).toBe(1);
		expect(showCalls.get(newCommit)).toBe(1);
	});
});
