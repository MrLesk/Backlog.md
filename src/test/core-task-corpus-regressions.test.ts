import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { loadTaskCorpus } from "../core/task-detail.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { buildDependencyGraph } from "../utils/dependency-graph.ts";
import { createUniqueTestDir, getPlatformTimeout, safeCleanup, waitUntil } from "./test-utils.ts";

let testDir: string;
let core: Core;
let extraDirs: string[];
let extraCores: Core[];

function trackDir(suffix: string): string {
	const dir = `${testDir}-${suffix}`;
	extraDirs.push(dir);
	return dir;
}

function trackCore(instance: Core): Core {
	extraCores.push(instance);
	return instance;
}

async function saveRemoteEnabledConfig(projectName: string): Promise<void> {
	await core.filesystem.saveConfig({
		projectName,
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: true,
		checkActiveBranches: true,
		activeBranchDays: 30,
		autoCommit: false,
	});
}

function task(id: string, title: string, status = "To Do"): Task {
	return {
		id,
		title,
		status,
		assignee: [],
		createdDate: "2026-08-01",
		labels: [],
		dependencies: [],
		description: `${title} body`,
	};
}

async function writeTask(directory: string, filename: string, value: Task): Promise<string> {
	await mkdir(directory, { recursive: true });
	const path = join(directory, filename);
	await Bun.write(path, serializeTask(value));
	return path;
}

async function commit(message: string, date: string): Promise<void> {
	await $`git add -A`.cwd(testDir).quiet();
	await $`GIT_AUTHOR_DATE="${date}" GIT_COMMITTER_DATE="${date}" git -c user.name="Backlog Test" -c user.email="test@example.com" commit -m ${message}`
		.cwd(testDir)
		.quiet();
}

function recentCommitDate(minutesAgo: number): string {
	return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

beforeEach(async () => {
	testDir = createUniqueTestDir("core-task-corpus-regressions");
	extraDirs = [];
	extraCores = [];
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "Core task corpus regressions",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: true,
		activeBranchDays: 30,
		autoCommit: false,
	});
	await $`git init -b main`.cwd(testDir).quiet();
	await commit("Initialize project", recentCommitDate(3));
});

afterEach(async () => {
	for (const instance of [core, ...extraCores]) {
		instance.disposeSearchService();
		instance.disposeContentStore();
	}
	for (const dir of [testDir, ...extraDirs]) {
		await safeCleanup(dir);
	}
});

describe("Core shared task corpus regressions", () => {
	it("publishes changed completed branch content at the same path after its ref moves", async () => {
		await $`git switch -c feature-completed`.cwd(testDir).quiet();
		const completedPath = await writeTask(
			core.filesystem.completedDir,
			"task-1 - Completed.md",
			task("TASK-1", "Before ref move", "Done"),
		);
		await commit("Add completed branch task", recentCommitDate(2));
		await $`git switch main`.cwd(testDir).quiet();

		expect((await core.getTask("TASK-1"))?.title).toBe("Before ref move");
		const store = await core.getContentStore();
		expect(store.getTasks()).toEqual([]);
		const publications: Array<{ status: string; title?: string }> = [];
		const unsubscribe = store.subscribe((event) => {
			if (event.type !== "tasks") return;
			const resolution = store.resolveTaskForRead("TASK-1");
			publications.push({
				status: resolution.status,
				...(resolution.status === "found" && { title: resolution.task.title }),
			});
		});

		await $`git switch feature-completed`.cwd(testDir).quiet();
		await Bun.write(completedPath, serializeTask(task("TASK-1", "After ref move", "Done")));
		await commit("Update completed branch task", recentCommitDate(1));
		await $`git switch main`.cwd(testDir).quiet();

		expect((await core.getTask("TASK-1"))?.title).toBe("After ref move");
		unsubscribe();
		expect(publications).toEqual([{ status: "found", title: "After ref move" }]);
		expect(store.getTasks()).toEqual([]);
		expect(
			store
				.getTaskCorpusSnapshot()
				.branchStateEntries?.find((entry) => entry.id === "TASK-1" && entry.type === "completed")?.task?.title,
		).toBe("After ref move");
	});

	it("resolves a dependency completed only on another branch as completed in the cross-branch corpus", async () => {
		await writeTask(core.filesystem.tasksDir, "task-2 - Root.md", {
			...task("TASK-2", "Root task"),
			dependencies: ["TASK-1"],
		});
		await commit("Add root task", recentCommitDate(2));
		await $`git switch -c feature-completed-dependency`.cwd(testDir).quiet();
		await writeTask(
			core.filesystem.completedDir,
			"task-1 - Completed elsewhere.md",
			task("TASK-1", "Completed elsewhere", "Done"),
		);
		await commit("Complete dependency on branch", recentCommitDate(1));
		await $`git switch main`.cwd(testDir).quiet();

		const corpus = await loadTaskCorpus(core, { includeCrossBranch: true });
		expect(corpus.completedTasks.some((candidate) => candidate.id === "TASK-1")).toBe(true);

		const root = corpus.tasks.find((candidate) => candidate.id === "TASK-2");
		expect(root).toBeDefined();
		const graph = buildDependencyGraph(root as Task, corpus);
		const dependency = graph.nodes.find((candidate) => candidate.id === "TASK-1");
		expect(dependency?.state).toBe("resolved");
		expect(dependency?.completed).toBe(true);
	});

	it("keeps a branch completed file claiming a local completed ID ambiguous", async () => {
		await writeTask(core.filesystem.tasksDir, "task-2 - Root.md", {
			...task("TASK-2", "Root task"),
			dependencies: ["TASK-1"],
		});
		await writeTask(core.filesystem.completedDir, "task-1 - Completed here.md", task("TASK-1", "Local", "Done"));
		await commit("Add root task and local completed dependency", recentCommitDate(2));
		await $`git switch -c feature-colliding-completed`.cwd(testDir).quiet();
		await writeTask(
			core.filesystem.completedDir,
			"task-1 - Completed elsewhere.md",
			task("TASK-1", "Branch claimant", "Done"),
		);
		await commit("Claim the same completed ID with another file", recentCommitDate(1));
		await $`git switch main`.cwd(testDir).quiet();

		const corpus = await loadTaskCorpus(core, { includeCrossBranch: true });
		const root = corpus.tasks.find((candidate) => candidate.id === "TASK-2");
		expect(root).toBeDefined();
		const graph = buildDependencyGraph(root as Task, corpus);
		const dependency = graph.nodes.find((candidate) => candidate.id === "TASK-1");
		expect(dependency?.state).toBe("ambiguous");
	});

	it("refreshes warm cross-branch duplicate findings after branch addition and deletion", async () => {
		const mainTaskPath = await writeTask(core.filesystem.tasksDir, "task-1 - Main.md", task("TASK-1", "Main task"));
		await commit("Add main task", recentCommitDate(2));

		const initial = await core.previewDuplicateTaskIdRepair({ includeBranches: true });
		expect(initial.crossBranchFindings).toEqual([]);

		await $`git switch -c feature-duplicate`.cwd(testDir).quiet();
		await unlink(mainTaskPath);
		await writeTask(core.filesystem.tasksDir, "task-1 - Feature.md", task("TASK-1", "Feature task"));
		await commit("Add distinct branch identity", recentCommitDate(1));
		await $`git switch main`.cwd(testDir).quiet();

		const added = await core.previewDuplicateTaskIdRepair({ includeBranches: true });
		expect(added.crossBranchFindings).toHaveLength(1);
		expect(added.crossBranchFindings[0]?.locations.map((location) => location.branch).sort()).toEqual([
			"feature-duplicate",
			"main",
		]);

		await $`git branch -D feature-duplicate`.cwd(testDir).quiet();
		const deleted = await core.previewDuplicateTaskIdRepair({ includeBranches: true });
		expect(deleted.crossBranchFindings).toEqual([]);
	});

	it("allocates through one shared branch snapshot without hydrating completed task blobs", async () => {
		await $`git switch -c feature-completed-id`.cwd(testDir).quiet();
		await writeTask(
			core.filesystem.completedDir,
			"task-41 - Completed.md",
			task("TASK-41", "Completed branch reservation", "Done"),
		);
		await commit("Reserve completed branch ID", recentCommitDate(2));
		await $`git branch feature-completed-id-alias`.cwd(testDir).quiet();
		await $`git switch main`.cwd(testDir).quiet();

		const git = core.gitOps;
		const originals = {
			fetch: git.fetch.bind(git),
			listRecentBranchTips: git.listRecentBranchTips.bind(git),
			listRecentBranches: git.listRecentBranches.bind(git),
			listRecentRemoteBranches: git.listRecentRemoteBranches.bind(git),
			resolveCommit: git.resolveCommit.bind(git),
			listFilesInTree: git.listFilesInTree.bind(git),
			getBranchLastModifiedMap: git.getBranchLastModifiedMap.bind(git),
			showFile: git.showFile.bind(git),
		};
		const counts = {
			fetch: 0,
			tips: 0,
			legacyBranches: 0,
			legacyRemoteBranches: 0,
			resolveCommit: 0,
			trees: 0,
			histories: 0,
			blobs: [] as string[],
		};
		git.fetch = async (...args) => {
			counts.fetch += 1;
			return await originals.fetch(...args);
		};
		git.listRecentBranchTips = async (...args) => {
			counts.tips += 1;
			return await originals.listRecentBranchTips(...args);
		};
		git.listRecentBranches = async (...args) => {
			counts.legacyBranches += 1;
			return await originals.listRecentBranches(...args);
		};
		git.listRecentRemoteBranches = async (...args) => {
			counts.legacyRemoteBranches += 1;
			return await originals.listRecentRemoteBranches(...args);
		};
		git.resolveCommit = async (...args) => {
			counts.resolveCommit += 1;
			return await originals.resolveCommit(...args);
		};
		git.listFilesInTree = async (...args) => {
			counts.trees += 1;
			return await originals.listFilesInTree(...args);
		};
		git.getBranchLastModifiedMap = async (...args) => {
			counts.histories += 1;
			return await originals.getBranchLastModifiedMap(...args);
		};
		git.showFile = async (ref, path) => {
			counts.blobs.push(path);
			return await originals.showFile(ref, path);
		};

		try {
			const created = await core.createTaskFromInput({ title: "Allocated after completed branch ID" }, false);
			expect(created.task.id).toBe("TASK-42");
		} finally {
			git.fetch = originals.fetch;
			git.listRecentBranchTips = originals.listRecentBranchTips;
			git.listRecentBranches = originals.listRecentBranches;
			git.listRecentRemoteBranches = originals.listRecentRemoteBranches;
			git.resolveCommit = originals.resolveCommit;
			git.listFilesInTree = originals.listFilesInTree;
			git.getBranchLastModifiedMap = originals.getBranchLastModifiedMap;
			git.showFile = originals.showFile;
		}

		expect(counts).toEqual({
			fetch: 0,
			tips: 2,
			legacyBranches: 0,
			legacyRemoteBranches: 0,
			resolveCommit: 0,
			trees: 1,
			histories: 1,
			blobs: [],
		});
	});

	it("keeps serving fresh branch state after an ID allocation that never installed a corpus", async () => {
		const watcherCore = trackCore(new Core(testDir, { enableWatchers: true }));
		await $`git switch -c feature-stale`.cwd(testDir).quiet();
		await writeTask(watcherCore.filesystem.tasksDir, "task-1 - Branch.md", task("TASK-1", "Before ref move"));
		await commit("Add branch task", recentCommitDate(2));
		await $`git switch main`.cwd(testDir).quiet();

		// Warms the shared corpus at the current branch tips.
		expect((await watcherCore.getTask("TASK-1"))?.title).toBe("Before ref move");

		// Moving the tip from a second worktree leaves this project's watched
		// directories untouched, so only ref-fingerprint comparison can notice it.
		const worktreeDir = trackDir("worktree");
		await $`git worktree add ${worktreeDir} feature-stale`.cwd(testDir).quiet();
		const worktreeTaskPath = join(worktreeDir, "backlog", "tasks", "task-1 - Branch.md");
		await Bun.write(worktreeTaskPath, serializeTask(task("TASK-1", "After ref move")));
		await $`git add -A`.cwd(worktreeDir).quiet();
		await $`git -c user.name="Backlog Test" -c user.email="test@example.com" commit -m "Move branch tip"`
			.cwd(worktreeDir)
			.quiet();

		// Allocation loads its own corpus without installing it; that load must not
		// claim the moved refs on behalf of the store.
		expect(await watcherCore.generateNextId()).toBe("TASK-2");

		expect((await watcherCore.getTask("TASK-1"))?.title).toBe("After ref move");
	});

	it("keeps serving fresh branch state after a rename fallback that never installed a corpus", async () => {
		const watcherCore = trackCore(new Core(testDir, { enableWatchers: true }));
		await $`git switch -c feature-stale`.cwd(testDir).quiet();
		await writeTask(watcherCore.filesystem.tasksDir, "task-1 - Branch.md", task("TASK-1", "Before ref move"));
		await commit("Add branch task", recentCommitDate(2));
		await $`git switch main`.cwd(testDir).quiet();

		const deletedTaskPath = await writeTask(
			watcherCore.filesystem.tasksDir,
			"task-2 - Local only.md",
			task("TASK-2", "Local only task"),
		);

		// Warms the shared corpus at the current branch tips.
		expect((await watcherCore.getTask("TASK-1"))?.title).toBe("Before ref move");

		// Moving the tip from a second worktree leaves this project's watched
		// directories untouched, so only ref-fingerprint comparison can notice it.
		const worktreeDir = trackDir("worktree");
		await $`git worktree add ${worktreeDir} feature-stale`.cwd(testDir).quiet();
		const worktreeTaskPath = join(worktreeDir, "backlog", "tasks", "task-1 - Branch.md");
		await Bun.write(worktreeTaskPath, serializeTask(task("TASK-1", "After ref move")));
		await $`git add -A`.cwd(worktreeDir).quiet();
		await $`git -c user.name="Backlog Test" -c user.email="test@example.com" commit -m "Move branch tip"`
			.cwd(worktreeDir)
			.quiet();

		// Deleting a local-only task with no branch-side copy sends the rename watcher
		// through findIdentity's fallback: it loads the full corpus purely to confirm the
		// task is gone, and that throwaway load must not claim the moved refs on behalf
		// of the store.
		const store = await watcherCore.getContentStore();
		await unlink(deletedTaskPath);
		await waitUntil(
			() => store.resolveTaskForRead("TASK-2").status === "not-found",
			"watched deletion with no branch-side copy",
			getPlatformTimeout(3000),
		);

		expect((await watcherCore.getTask("TASK-1"))?.title).toBe("After ref move");
	});

	it("allocates past a remote task pushed inside the read refresh window", async () => {
		await saveRemoteEnabledConfig("Core allocation freshness");
		const originDir = trackDir("origin");
		await mkdir(originDir, { recursive: true });
		await $`git init --bare -b main`.cwd(originDir).quiet();
		await writeTask(core.filesystem.tasksDir, "task-1 - Local.md", task("TASK-1", "Local task"));
		await commit("Add local task", recentCommitDate(2));
		await $`git remote add origin ${originDir}`.cwd(testDir).quiet();
		await $`git push -u origin main`.cwd(testDir).quiet();

		// A read refreshes remote refs and opens the coalesced refresh window.
		expect((await core.loadTasks()).map((entry) => entry.id)).toEqual(["TASK-1"]);

		const contributorDir = trackDir("contributor");
		await $`git clone ${originDir} ${contributorDir}`.quiet();
		await $`git switch -c contributed`.cwd(contributorDir).quiet();
		await writeTask(join(contributorDir, "backlog", "tasks"), "task-2 - Contributed.md", task("TASK-2", "Contributed"));
		await $`git add -A`.cwd(contributorDir).quiet();
		await $`git -c user.name="Backlog Test" -c user.email="test@example.com" commit -m "Contribute task"`
			.cwd(contributorDir)
			.quiet();
		await $`git push -u origin contributed`.cwd(contributorDir).quiet();

		const git = core.gitOps;
		const originalFetch = git.fetch.bind(git);
		let fetches = 0;
		git.fetch = async (...args) => {
			fetches += 1;
			return await originalFetch(...args);
		};
		try {
			// Reads may reuse the window; allocation may not, or two clones hand out
			// the same numeric ID.
			expect(await core.generateNextId()).toBe("TASK-3");
		} finally {
			git.fetch = originalFetch;
		}
		expect(fetches).toBe(1);
	});

	it("allocates past a remote task pushed while a non-forced fetch is in flight", async () => {
		await saveRemoteEnabledConfig("Core allocation in-flight freshness");
		const originDir = trackDir("origin");
		await mkdir(originDir, { recursive: true });
		await $`git init --bare -b main`.cwd(originDir).quiet();
		await writeTask(core.filesystem.tasksDir, "task-1 - Local.md", task("TASK-1", "Local task"));
		await commit("Add local task", recentCommitDate(2));
		await $`git remote add origin ${originDir}`.cwd(testDir).quiet();
		await $`git push -u origin main`.cwd(testDir).quiet();

		const git = core.gitOps;
		const originalFetch = git.fetch.bind(git);
		let fetches = 0;
		let releaseFirstFetch: () => void = () => {};
		const firstFetchStarted = new Promise<void>((resolve) => {
			git.fetch = async (...args) => {
				fetches += 1;
				const isFirstFetch = fetches === 1;
				// Capture the remote state now (before any later push), but withhold
				// resolution until released, so the caller is still "in flight" per the
				// remoteRefRefreshPromise coalescing while the push below lands.
				const result = await originalFetch(...args);
				if (isFirstFetch) {
					resolve();
					await new Promise<void>((releaseResolve) => {
						releaseFirstFetch = releaseResolve;
					});
				}
				return result;
			};
		});

		try {
			// A read starts a non-forced fetch and blocks in flight.
			const readPromise = core.loadTasks();
			await firstFetchStarted;

			// A contributor pushes a new task while that fetch is still running, so it
			// is invisible to the fetch already in flight.
			const contributorDir = trackDir("contributor");
			await $`git clone ${originDir} ${contributorDir}`.quiet();
			await $`git switch -c contributed`.cwd(contributorDir).quiet();
			await writeTask(
				join(contributorDir, "backlog", "tasks"),
				"task-2 - Contributed.md",
				task("TASK-2", "Contributed"),
			);
			await $`git add -A`.cwd(contributorDir).quiet();
			await $`git -c user.name="Backlog Test" -c user.email="test@example.com" commit -m "Contribute task"`
				.cwd(contributorDir)
				.quiet();
			await $`git push -u origin contributed`.cwd(contributorDir).quiet();

			// A forced allocation joins the in-flight fetch; it must not treat that
			// stale-at-start fetch as sufficient once it observes the push above.
			const allocationPromise = core.generateNextId();
			releaseFirstFetch();

			const [nextId] = await Promise.all([allocationPromise, readPromise]);
			expect(nextId).toBe("TASK-3");
		} finally {
			git.fetch = originalFetch;
		}
		expect(fetches).toBe(2);
	});

	it("cancels a load before it starts a remote refresh", async () => {
		await saveRemoteEnabledConfig("Core cancellation before fetch");
		const git = core.gitOps;
		const originalFetch = git.fetch.bind(git);
		let fetches = 0;
		git.fetch = async (...args) => {
			fetches += 1;
			return await originalFetch(...args);
		};
		const controller = new AbortController();
		controller.abort();
		try {
			await expect(core.loadTasks(undefined, controller.signal)).rejects.toThrow("Loading cancelled");
		} finally {
			git.fetch = originalFetch;
		}
		expect(fetches).toBe(0);
	});
});
