import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import type { Core } from "../core/backlog.ts";
import type { ContentStore } from "../core/content-store.ts";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let testDir: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;
let auxiliaryWorktreeDir: string | null = null;

const createTask = (partial: Partial<Task>): Task => ({
	id: "TASK-1",
	title: "Statistics task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-01",
	labels: [],
	dependencies: [],
	...partial,
});

function rootConfig(projectName: string, backlogDirectory: string): string {
	return [
		`project_name: "${projectName}"`,
		`backlog_directory: "${backlogDirectory}"`,
		'statuses: ["Queued", "Done"]',
		"labels: []",
		'priorities: ["Urgent", "Low"]',
		"date_format: YYYY-MM-DD",
		"remote_operations: false",
		"check_active_branches: false",
		'task_prefix: "TASK"',
		"",
	].join("\n");
}

type StatisticsResponse = {
	totalTasks: number;
	completedTasks: number;
	completionPercentage: number;
	draftCount: number;
	statusCounts: Record<string, number>;
	priorityCounts: Record<string, number>;
};

async function requestStatistics(): Promise<StatisticsResponse> {
	const response = await fetch(`http://127.0.0.1:${serverPort}/api/statistics`);
	expect(response.status).toBe(200);
	return (await response.json()) as StatisticsResponse;
}

async function startStatisticsServer(): Promise<void> {
	server = new BacklogServer(testDir);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
	expect(serverPort).toBeGreaterThan(0);
}

async function restartWithStatisticsBranch(branchTask: Task): Promise<void> {
	await server?.stop();
	server = null;
	const config = await filesystem.loadConfig();
	if (!config) throw new Error("Expected statistics test config");
	await filesystem.saveConfig({ ...config, checkActiveBranches: true });

	await $`git init -b main`.cwd(testDir).quiet();
	await $`git add backlog`.cwd(testDir).quiet();
	await $`git commit -m "Add main statistics corpus"`.cwd(testDir).quiet();
	await $`git switch -c statistics-shadow`.cwd(testDir).quiet();
	await filesystem.saveTask(branchTask);
	await $`git add backlog`.cwd(testDir).quiet();
	await $`git commit -m "Add branch statistics task"`.cwd(testDir).quiet();
	await $`git switch main`.cwd(testDir).quiet();
	await startStatisticsServer();
}

async function addStatisticsBranchTask(task: Task): Promise<void> {
	auxiliaryWorktreeDir = createUniqueTestDir("server-statistics-worktree");
	await $`git worktree add ${auxiliaryWorktreeDir} statistics-shadow`.cwd(testDir).quiet();
	try {
		const branchFilesystem = new FileSystem(auxiliaryWorktreeDir);
		await branchFilesystem.saveTask(task);
		await $`git add backlog`.cwd(auxiliaryWorktreeDir).quiet();
		await $`git commit -m "Move statistics branch ref"`.cwd(auxiliaryWorktreeDir).quiet();
	} finally {
		await $`git worktree remove --force ${auxiliaryWorktreeDir}`.cwd(testDir).quiet().nothrow();
		await safeCleanup(auxiliaryWorktreeDir);
		auxiliaryWorktreeDir = null;
	}
}

describe("BacklogServer statistics endpoint", () => {
	beforeEach(async () => {
		testDir = createUniqueTestDir("server-statistics");
		filesystem = new FileSystem(testDir);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Statistics",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			priorities: ["Urgent", "Low"],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			checkActiveBranches: false,
		});

		await filesystem.saveTask(createTask({ priority: "Urgent" }));
		await filesystem.saveTask(createTask({ id: "TASK-2", title: "Completed task", status: "Done", priority: "Low" }));
		expect(await filesystem.completeTask("TASK-2")).toBe(true);
		await filesystem.saveDraft(createTask({ id: "DRAFT-1", title: "Draft task", status: "Draft" }));

		await startStatisticsServer();
	});

	afterEach(async () => {
		await server?.stop();
		server = null;
		if (auxiliaryWorktreeDir) {
			await $`git worktree remove --force ${auxiliaryWorktreeDir}`.cwd(testDir).quiet().nothrow();
			await safeCleanup(auxiliaryWorktreeDir);
			auxiliaryWorktreeDir = null;
		}
		await safeCleanup(testDir);
	});

	it("reuses branch state while reconciling cached working-copy tasks across statistics requests", async () => {
		if (!server) throw new Error("Server not started");
		const core = (server as unknown as { core: Core }).core;
		const originalListTasks = core.filesystem.listTasks.bind(core.filesystem);
		const originalListCompletedTasks = core.filesystem.listCompletedTasks.bind(core.filesystem);
		const originalStatisticsLoader = core.loadAllTasksForStatistics;
		let activeCorpusLoads = 0;
		let completedCorpusLoads = 0;
		let legacyStatisticsLoads = 0;

		core.filesystem.listTasks = async (...args) => {
			activeCorpusLoads += 1;
			return await originalListTasks(...args);
		};
		core.filesystem.listCompletedTasks = async (...args) => {
			completedCorpusLoads += 1;
			return await originalListCompletedTasks(...args);
		};
		core.loadAllTasksForStatistics = async (progressCallback) => {
			legacyStatisticsLoads += 1;
			return await originalStatisticsLoader.call(core, progressCallback);
		};

		try {
			const first = await requestStatistics();
			expect(first).toMatchObject({
				totalTasks: 2,
				completedTasks: 1,
				completionPercentage: 50,
				draftCount: 1,
				statusCounts: { "To Do": 1, "In Progress": 0, Done: 1 },
				priorityCounts: { urgent: 1, low: 1 },
			});

			const second = await requestStatistics();
			expect(second).toMatchObject({ totalTasks: 2, completedTasks: 1, draftCount: 1 });
		} finally {
			core.filesystem.listTasks = originalListTasks;
			core.filesystem.listCompletedTasks = originalListCompletedTasks;
			core.loadAllTasksForStatistics = originalStatisticsLoader;
		}

		// The second warm request performs one exact-content working-copy reconciliation.
		// Branch state remains in the initialized ContentStore and the legacy global loader is unused.
		expect(activeCorpusLoads).toBe(2);
		expect(completedCorpusLoads).toBe(2);
		expect(legacyStatisticsLoads).toBe(0);
	});

	it("uses fresh priorities without rebuilding the task corpus", async () => {
		if (!server) throw new Error("Server not started");
		await requestStatistics();
		const serverInternals = server as unknown as {
			core: Core;
			getContentStoreInstance: () => Promise<ContentStore>;
		};
		const core = serverInternals.core;
		const store = await serverInternals.getContentStoreInstance();
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected statistics test config");
		const originalEnsureConfigWatcher = store.ensureConfigWatcher.bind(store);
		const originalRefreshTasksForTaskRead = core.refreshTasksForTaskRead.bind(core);
		(store as unknown as { stopConfigWatcher: () => void }).stopConfigWatcher();
		store.ensureConfigWatcher = async () => {};
		core.refreshTasksForTaskRead = async () => false;

		try {
			await core.filesystem.saveConfig({
				...config,
				priorities: ["Critical", "Urgent", "Low"],
			});

			const refreshed = await requestStatistics();
			expect(refreshed.statusCounts).toEqual({ "To Do": 1, "In Progress": 0, Done: 1 });
			expect(refreshed.priorityCounts).toMatchObject({ critical: 0, urgent: 1, low: 1 });
			expect(store.getTaskCorpusSnapshot().config?.priorities).toEqual(["Urgent", "Low"]);
		} finally {
			store.ensureConfigWatcher = originalEnsureConfigWatcher;
			core.refreshTasksForTaskRead = originalRefreshTasksForTaskRead;
		}
	});

	it("reconciles a selected backlog root before reading its statistics", async () => {
		if (!server) throw new Error("Server not started");
		await requestStatistics();

		const rootB = new FileSystem(testDir);
		rootB.setBacklogDirectory("root-b");
		await rootB.ensureBacklogStructure();
		await rootB.saveTask(createTask({ id: "TASK-10", title: "Root B queued", status: "Queued" }));
		await rootB.saveTask(createTask({ id: "TASK-11", title: "Root B queued too", status: "Queued" }));
		await rootB.saveTask(createTask({ id: "TASK-12", title: "Root B done", status: "Done" }));
		expect(await rootB.completeTask("TASK-12")).toBe(true);
		await rootB.saveDraft(createTask({ id: "DRAFT-10", title: "Root B draft", status: "Draft" }));
		await rootB.saveDraft(createTask({ id: "DRAFT-11", title: "Root B draft too", status: "Draft" }));

		const core = (server as unknown as { core: Core }).core;
		const originalListTasks = core.filesystem.listTasks.bind(core.filesystem);
		const originalListCompletedTasks = core.filesystem.listCompletedTasks.bind(core.filesystem);
		let activeCorpusLoads = 0;
		let completedCorpusLoads = 0;
		core.filesystem.listTasks = async (...args) => {
			activeCorpusLoads += 1;
			return await originalListTasks(...args);
		};
		core.filesystem.listCompletedTasks = async (...args) => {
			completedCorpusLoads += 1;
			return await originalListCompletedTasks(...args);
		};

		try {
			await Bun.write(join(testDir, "backlog.config.yml"), rootConfig("Root B", "root-b"));
			core.filesystem.invalidateConfigCache();
			expect(core.filesystem.backlogDirName).toBe("root-b");

			const first = await requestStatistics();
			expect(first).toMatchObject({
				totalTasks: 3,
				completedTasks: 1,
				completionPercentage: 33,
				draftCount: 2,
				statusCounts: { Queued: 2, Done: 1 },
			});
			expect(first.statusCounts).toEqual({ Queued: 2, Done: 1 });

			const second = await requestStatistics();
			expect(second.statusCounts).toEqual({ Queued: 2, Done: 1 });
		} finally {
			core.filesystem.listTasks = originalListTasks;
			core.filesystem.listCompletedTasks = originalListCompletedTasks;
		}

		// Root rebinding and branch-fingerprint reconciliation each publish the new root once;
		// the second request then performs the normal cached working-copy reconciliation.
		expect(activeCorpusLoads).toBe(3);
		expect(completedCorpusLoads).toBe(3);
	});

	it("refreshes statistics after an active branch ref moves", async () => {
		await restartWithStatisticsBranch(
			createTask({ id: "TASK-10", title: "Branch statistics task", status: "In Progress", priority: "Urgent" }),
		);
		const initial = await requestStatistics();
		expect(initial).toMatchObject({ totalTasks: 3, statusCounts: { "In Progress": 1 } });

		await addStatisticsBranchTask(
			createTask({ id: "TASK-11", title: "Moved branch statistics task", status: "In Progress", priority: "Low" }),
		);

		const refreshed = await requestStatistics();
		expect(refreshed).toMatchObject({ totalTasks: 4, statusCounts: { "In Progress": 2 } });
	});

	it("keeps task and config generations coherent during a same-root config change", async () => {
		if (!server) throw new Error("Server not started");
		await requestStatistics();
		const serverInternals = server as unknown as {
			core: Core;
			getContentStoreInstance: () => Promise<ContentStore>;
		};
		const store = await serverInternals.getContentStoreInstance();
		const oldConfig = await serverInternals.core.filesystem.loadConfig();
		if (!oldConfig) throw new Error("Expected statistics test config");
		const originalRefreshTasksForTaskRead = serverInternals.core.refreshTasksForTaskRead.bind(serverInternals.core);
		let releaseRefresh: () => void = () => {};
		let markRefreshStarted: () => void = () => {};
		const refreshStarted = new Promise<void>((resolve) => {
			markRefreshStarted = resolve;
		});
		const refreshGate = new Promise<void>((resolve) => {
			releaseRefresh = resolve;
		});
		serverInternals.core.refreshTasksForTaskRead = async () => {
			markRefreshStarted();
			await refreshGate;
			return false;
		};

		try {
			const pendingStatistics = requestStatistics();
			await refreshStarted;
			(store as unknown as { stopConfigWatcher: () => void }).stopConfigWatcher();
			await serverInternals.core.filesystem.saveConfig({
				...oldConfig,
				statuses: ["Queued", "Done"],
				priorities: ["Critical"],
			});
			releaseRefresh();

			const inFlight = await pendingStatistics;
			expect(inFlight.statusCounts).toMatchObject({ "To Do": 1, "In Progress": 0, Done: 1 });
			expect(inFlight.statusCounts).not.toHaveProperty("Queued");
			expect(inFlight.priorityCounts).not.toHaveProperty("critical");
		} finally {
			releaseRefresh();
			serverInternals.core.refreshTasksForTaskRead = originalRefreshTasksForTaskRead;
		}

		const refreshed = await requestStatistics();
		expect(refreshed.statusCounts).toMatchObject({ Queued: 0, "To Do": 1, Done: 1 });
		expect(refreshed.statusCounts).not.toHaveProperty("In Progress");
		expect(refreshed.priorityCounts).toMatchObject({ critical: 0, urgent: 1, low: 1 });
	});
});
