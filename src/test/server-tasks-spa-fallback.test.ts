import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rename } from "node:fs/promises";
import { join, relative } from "node:path";
import { $ } from "bun";
import type { ContentStore } from "../core/content-store.ts";
import { FileSystem } from "../file-system/operations.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { BacklogConfig, Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;
let auxiliaryWorktreeDir: string | null = null;
let remoteRepoDir: string | null = null;

const routedTask: Task = {
	id: "BACK-001.02",
	title: "Fix labels and docs",
	status: "In Progress",
	assignee: ["@alex"],
	labels: ["web"],
	dependencies: [],
	createdDate: "2026-07-10",
};

async function request(path: string, init: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(`http://127.0.0.1:${serverPort}${path}`, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

async function replaceWatchedConfigFile(configPath: string, content: string): Promise<void> {
	const replacementPath = `${configPath}.replacement`;
	await Bun.write(replacementPath, content);
	await retry(
		async () => {
			await rename(replacementPath, configPath);
			return true;
		},
		10,
		25,
	);
}

async function startServer(): Promise<void> {
	server = new BacklogServer(TEST_DIR);
	await server.start(0, false);
	const port = server.getPort();
	expect(port).not.toBeNull();
	serverPort = port ?? 0;

	await retry(
		async () => {
			const statusResponse = await request("/api/status", {}, 500);
			if (!statusResponse.ok) throw new Error("server status endpoint not ready");
			return true;
		},
		10,
		50,
	);
}

async function restartWithActiveBranchCollision(
	branchTaskId: "BACK-1" | "BACK-001",
	includeBranchOnlyTask = false,
	useSamePath = branchTaskId === "BACK-1",
): Promise<void> {
	await server?.stop();
	server = null;

	const config = await filesystem.loadConfig();
	if (!config) {
		throw new Error("Expected test config");
	}
	await filesystem.saveConfig({ ...config, checkActiveBranches: true });
	const mainTask = { ...routedTask, id: "BACK-1", title: "Main collision task" };
	const mainTaskPath = await filesystem.saveTask(mainTask);
	await filesystem.saveTask({ ...mainTask, id: "BACK-002", title: "Inherited unchanged task" });

	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git add backlog`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Add main task"`.cwd(TEST_DIR).quiet();
	await $`git switch -c collision-shadow`.cwd(TEST_DIR).quiet();

	if (useSamePath) {
		const title = branchTaskId === "BACK-1" ? "Exact branch collision" : "Padded same-path version";
		await Bun.write(mainTaskPath, serializeTask({ ...mainTask, id: branchTaskId, title }));
	} else {
		await $`git rm -- ${relative(TEST_DIR, mainTaskPath)}`.cwd(TEST_DIR).quiet();
		await Bun.write(
			join(filesystem.tasksDir, "back-001 - Padded branch collision.md"),
			serializeTask({ ...mainTask, id: branchTaskId, title: "Padded branch collision" }),
		);
	}
	if (includeBranchOnlyTask) {
		await Bun.write(
			join(filesystem.tasksDir, "back-099 - Branch-only task.md"),
			serializeTask({ ...mainTask, id: "BACK-099", title: "Branch-only task" }),
		);
	}

	await $`git add backlog`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Add branch collision"`.cwd(TEST_DIR).quiet();
	await $`git switch main`.cwd(TEST_DIR).quiet();
	await startServer();
}

async function restartWithActiveRemoteCollision(useSamePath = false): Promise<void> {
	await server?.stop();
	server = null;

	const config = await filesystem.loadConfig();
	if (!config) {
		throw new Error("Expected test config");
	}
	await filesystem.saveConfig({ ...config, checkActiveBranches: true, remoteOperations: true });
	const mainTask = { ...routedTask, id: "BACK-1", title: "Main collision task" };
	const mainTaskPath = await filesystem.saveTask(mainTask);

	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git add backlog`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Add main task"`.cwd(TEST_DIR).quiet();

	remoteRepoDir = createUniqueTestDir("server-task-collision-remote");
	await $`git init --bare -b main ${remoteRepoDir}`.cwd(TEST_DIR).quiet();
	await $`git remote add origin ${remoteRepoDir}`.cwd(TEST_DIR).quiet();
	await $`git push -u origin main`.cwd(TEST_DIR).quiet();

	await $`git switch -c remote-update`.cwd(TEST_DIR).quiet();
	if (useSamePath) {
		await Bun.write(
			mainTaskPath,
			serializeTask({ ...mainTask, id: "BACK-001", title: "Remote same-path version", status: "Done" }),
		);
	} else {
		await $`git rm -- ${relative(TEST_DIR, mainTaskPath)}`.cwd(TEST_DIR).quiet();
		await Bun.write(
			join(filesystem.tasksDir, "back-1 - Remote-path-collision.md"),
			serializeTask({ ...mainTask, title: "Remote path collision" }),
		);
	}
	await $`git add backlog`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Move task on remote main"`.cwd(TEST_DIR).quiet();
	await $`git push origin HEAD:main`.cwd(TEST_DIR).quiet();
	await $`git switch main`.cwd(TEST_DIR).quiet();
	await $`git branch -D remote-update`.cwd(TEST_DIR).quiet();
	await startServer();
}

async function restartWithActiveLegacyCollision(): Promise<void> {
	await server?.stop();
	server = null;

	const config = await filesystem.loadConfig();
	if (!config) {
		throw new Error("Expected test config");
	}
	await filesystem.saveConfig({ ...config, checkActiveBranches: true });
	const localTask = { ...routedTask, id: "BACK-PREFIXED", title: "Local legacy task" };
	const localTaskPath = await filesystem.saveTask(localTask);

	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git add backlog`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Add local legacy task"`.cwd(TEST_DIR).quiet();
	await $`git switch -c legacy-collision-shadow`.cwd(TEST_DIR).quiet();
	await Bun.write(localTaskPath, serializeTask({ ...localTask, title: "Changed legacy branch task" }));
	await $`git add backlog`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Change legacy task on branch"`.cwd(TEST_DIR).quiet();
	await $`git switch main`.cwd(TEST_DIR).quiet();
	await startServer();
}

async function replaceCollisionBranchTask(replacementId: string, title: string): Promise<void> {
	auxiliaryWorktreeDir = createUniqueTestDir("server-task-collision-worktree");
	await $`git worktree add ${auxiliaryWorktreeDir} collision-shadow`.cwd(TEST_DIR).quiet();
	const branchFilesystem = new FileSystem(auxiliaryWorktreeDir);
	const branchTask = await branchFilesystem.loadTask("BACK-1");
	if (!branchTask?.filePath) {
		throw new Error("Expected colliding branch task");
	}
	await $`git rm -- ${relative(auxiliaryWorktreeDir, branchTask.filePath)}`.cwd(auxiliaryWorktreeDir).quiet();
	await Bun.write(
		join(branchFilesystem.tasksDir, `${replacementId.toLowerCase()} - Branch-replacement.md`),
		serializeTask({ ...routedTask, id: replacementId, title }),
	);
	await $`git add backlog`.cwd(auxiliaryWorktreeDir).quiet();
	await $`git commit -m "Replace colliding branch task"`.cwd(auxiliaryWorktreeDir).quiet();
	await $`git worktree remove --force ${auxiliaryWorktreeDir}`.cwd(TEST_DIR).quiet();
	await safeCleanup(auxiliaryWorktreeDir);
	auxiliaryWorktreeDir = null;
}

async function addCollisionBranchTask(task: Task): Promise<void> {
	auxiliaryWorktreeDir = createUniqueTestDir("server-task-collision-worktree");
	await $`git worktree add ${auxiliaryWorktreeDir} collision-shadow`.cwd(TEST_DIR).quiet();
	try {
		const branchFilesystem = new FileSystem(auxiliaryWorktreeDir);
		await branchFilesystem.saveTask(task);
		await $`git add backlog`.cwd(auxiliaryWorktreeDir).quiet();
		await $`git commit -m "Add branch task"`.cwd(auxiliaryWorktreeDir).quiet();
	} finally {
		await $`git worktree remove --force ${auxiliaryWorktreeDir}`.cwd(TEST_DIR).quiet().nothrow();
		await safeCleanup(auxiliaryWorktreeDir);
		auxiliaryWorktreeDir = null;
	}
}

describe("BacklogServer task SPA fallback", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-task-spa-fallback");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Task SPA Fallback",
			statuses: ["To Do", "In Progress", "Done"],
			labels: ["web"],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			prefixes: { task: "BACK" },
			zeroPaddedIds: 3,
		});
		await filesystem.saveTask(routedTask);

		await startServer();
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		if (auxiliaryWorktreeDir) {
			await $`git worktree remove --force ${auxiliaryWorktreeDir}`.cwd(TEST_DIR).quiet().nothrow();
			await safeCleanup(auxiliaryWorktreeDir);
			auxiliaryWorktreeDir = null;
		}
		if (remoteRepoDir) {
			await safeCleanup(remoteRepoDir);
			remoteRepoDir = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("serves task and board namespaces through the SPA for direct and refreshed navigation", async () => {
		// Compile the HTML bundle once before exercising the bounded route requests.
		// The test runner's existing timeout bounds this first-build readiness check;
		// aborting it early can leave Bun's development bundler with a stale socket.
		const shellResponse = await fetch(`http://127.0.0.1:${serverPort}/`);
		expect(shellResponse.status).toBe(200);
		expect(shellResponse.headers.get("content-type")).toContain("text/html");
		expect(await shellResponse.text()).toContain('<div id="root"></div>');

		const paths = [
			"/tasks",
			"/tasks/",
			"/tasks/001.02",
			"/tasks/BACK-001.02/fix-labels",
			"/tasks/BACK%2D001.02/fix-labels?status=In%20Progress",
			"/tasks/BACK-001.02/fix-labels/",
			"/tasks/BACK-001.02/fix-labels/extra",
			"/board",
			"/board/",
			"/board/001.02",
			"/board/001.02/fix-labels",
		];

		for (const path of paths) {
			const response = await request(path);
			expect(response.status, path).toBe(200);
			expect(response.headers.get("content-type"), path).toContain("text/html");
			expect(await response.text(), path).toContain('<div id="root"></div>');
		}
	});

	it("keeps API routes distinct from the SPA wildcard", async () => {
		const listResponse = await request("/api/tasks?crossBranch=false");
		expect(listResponse.status).toBe(200);
		expect(listResponse.headers.get("content-type")).toContain("application/json");
		expect((await listResponse.json()) as Task[]).toHaveLength(1);

		const taskResponse = await request("/api/task/1.2");
		expect(taskResponse.status).toBe(200);
		expect(taskResponse.headers.get("content-type")).toContain("application/json");
		expect(((await taskResponse.json()) as Task).id).toBe(routedTask.id);

		const createResponse = await request("/api/tasks", {
			method: "POST",
			body: JSON.stringify({}),
			headers: { "Content-Type": "application/json" },
		});
		expect(createResponse.status).toBe(400);
		expect(createResponse.headers.get("content-type")).toContain("application/json");
	});

	it("routes browser task reads and mutations through Core without direct task-corpus filesystem calls", async () => {
		const serverInternals = server as unknown as { core: { filesystem: FileSystem } };
		const taskFilesystem = serverInternals.core.filesystem;
		const directCalls: string[] = [];
		const originals = {
			listTasks: taskFilesystem.listTasks.bind(taskFilesystem),
			listCompletedTasks: taskFilesystem.listCompletedTasks.bind(taskFilesystem),
			loadTask: taskFilesystem.loadTask.bind(taskFilesystem),
			saveTask: taskFilesystem.saveTask.bind(taskFilesystem),
		};
		const recordDirectServerCall = (operation: string) => {
			const caller = (new Error().stack ?? "")
				.split("\n")
				.find((line) => line.includes("/src/") && !line.includes("server-tasks-spa-fallback.test.ts"));
			if (caller?.includes("/src/server/index.ts")) directCalls.push(operation);
		};
		taskFilesystem.listTasks = async (...args) => {
			recordDirectServerCall("listTasks");
			return await originals.listTasks(...args);
		};
		taskFilesystem.listCompletedTasks = async (...args) => {
			recordDirectServerCall("listCompletedTasks");
			return await originals.listCompletedTasks(...args);
		};
		taskFilesystem.loadTask = async (...args) => {
			recordDirectServerCall("loadTask");
			return await originals.loadTask(...args);
		};
		taskFilesystem.saveTask = async (...args) => {
			recordDirectServerCall("saveTask");
			return await originals.saveTask(...args);
		};

		try {
			expect((await request(`/api/tasks?parent=${routedTask.id}`)).status).toBe(200);
			expect((await request(`/api/task/${routedTask.id}`)).status).toBe(200);
			expect(
				(
					await request(`/api/tasks/${routedTask.id}`, {
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ status: "In Progress" }),
					})
				).status,
			).toBe(200);
			expect((await request("/api/tasks/duplicates")).status).toBe(200);
			expect(
				(
					await request("/api/tasks/reorder", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							taskId: routedTask.id,
							targetStatus: "In Progress",
							orderedTaskIds: [routedTask.id],
						}),
					})
				).status,
			).toBe(200);
			expect((await request(`/api/tasks/${routedTask.id}/complete`, { method: "POST" })).status).toBe(200);
		} finally {
			taskFilesystem.listTasks = originals.listTasks;
			taskFilesystem.listCompletedTasks = originals.listCompletedTasks;
			taskFilesystem.loadTask = originals.loadTask;
			taskFilesystem.saveTask = originals.saveTask;
		}

		expect(directCalls).toEqual([]);
	});

	it("serves completed-only task details through Core", async () => {
		expect(await filesystem.completeTask(routedTask.id)).toBe(true);

		const response = await request(`/api/task/${routedTask.id}`);

		expect(response.status).toBe(200);
		const task = (await response.json()) as Task;
		expect(task.id).toBe(routedTask.id);
		expect(task.source).toBe("completed");
	});

	it("returns conflict after a frontmatter ID collision appears under an unchanged filename", async () => {
		const siblingPath = await filesystem.saveTask({ ...routedTask, id: "BACK-002", title: "Sibling task" });
		const warm = await request("/api/task/BACK-002");
		expect(warm.status).toBe(200);

		await Bun.write(siblingPath, serializeTask({ ...routedTask, title: "Changed frontmatter identity" }));
		const response = await request(`/api/task/${routedTask.id}`);

		expect(response.status).toBe(409);
		expect(await response.text()).toContain("ambiguous");
	});

	it("prefers the freshly read current-worktree task over stale store content", async () => {
		const contentStore = await (
			server as unknown as { getContentStoreInstance: () => Promise<ContentStore> }
		).getContentStoreInstance();
		const originalGetTasks = contentStore.getTasks.bind(contentStore);
		const liveTask = { ...routedTask, title: "Live current-worktree title" };
		await filesystem.saveTask(liveTask);
		contentStore.getTasks = () => [{ ...routedTask, title: "Stale cached title" }];

		try {
			const response = await request(`/api/task/${routedTask.id}`);
			expect(response.status).toBe(200);
			expect(((await response.json()) as Task).title).toBe(liveTask.title);
		} finally {
			contentStore.getTasks = originalGetTasks;
		}
	});

	it("serves an exact legacy task ID and distinguishes missing from malformed inputs", async () => {
		await Bun.write(
			join(filesystem.tasksDir, "back-prefixed - Legacy task.md"),
			serializeTask({ ...routedTask, id: "BACK-PREFIXED", title: "Legacy task" }),
		);

		const found = await request("/api/task/BACK-PREFIXED");
		expect(found.status).toBe(200);
		expect(((await found.json()) as Task).title).toBe("Legacy task");

		const missing = await request("/api/task/BACK-MISSING");
		expect(missing.status).toBe(404);
		expect((await missing.json()) as { error: string }).toEqual({ error: "Task BACK-MISSING not found" });

		const malformed = await request("/api/task/BACK-%2E%2E");
		expect(malformed.status).toBe(400);
		expect((await malformed.json()) as { error: string }).toEqual({ error: "Invalid task ID: BACK-.." });

		const traversal = await request("/api/task/BACK-PREFIXED%2F..%2Fsecret");
		expect(traversal.status).toBe(400);
		expect((await traversal.json()) as { error: string }).toEqual({
			error: "Invalid task ID: BACK-PREFIXED/../secret",
		});
	});

	it("fails closed on duplicate exact legacy task IDs", async () => {
		for (const title of ["Legacy one", "Legacy two"]) {
			await Bun.write(
				join(filesystem.tasksDir, `back-prefixed - ${title}.md`),
				serializeTask({ ...routedTask, id: "BACK-PREFIXED", title }),
			);
		}

		const response = await request("/api/task/BACK-PREFIXED");
		expect(response.status).toBe(409);
		const { error } = (await response.json()) as { error: string };
		expect(error).toContain("back-prefixed - Legacy one.md");
		expect(error).toContain("back-prefixed - Legacy two.md");
		expect(error).toContain("backlog doctor");
	});

	it("never returns or mutates an adjacent huge task ID and fails closed on ambiguity", async () => {
		const saveTaskFile = async (id: string, title: string) => {
			await Bun.write(
				join(filesystem.tasksDir, `${id.toLowerCase()} - ${title}.md`),
				serializeTask({ ...routedTask, id, title }),
			);
		};

		await saveTaskFile("BACK-9007199254740993", "Huge neighbor");
		const missing = await request("/api/task/BACK-9007199254740992");
		expect(missing.status).toBe(404);
		const rejectedUpdate = await request("/api/task/BACK-9007199254740992", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Wrongly mutated" }),
		});
		expect(rejectedUpdate.status).toBe(404);
		expect((await filesystem.loadTask("BACK-9007199254740993"))?.title).toBe("Huge neighbor");

		await saveTaskFile("BACK-9007199254740992", "Huge target");
		const target = await request("/api/task/BACK-9007199254740992");
		expect(target.status).toBe(200);
		expect(((await target.json()) as Task).title).toBe("Huge target");

		await saveTaskFile("BACK-9007199254740992.0002", "Huge dotted target");
		const dotted = await request("/api/task/BACK-09007199254740992.2");
		expect(dotted.status).toBe(200);
		expect(((await dotted.json()) as Task).title).toBe("Huge dotted target");

		await saveTaskFile("BACK-09007199254740992", "Huge padded duplicate");
		const ambiguous = await request("/api/task/BACK-9007199254740992");
		expect(ambiguous.status).toBe(409);
		const { error } = (await ambiguous.json()) as { error: string };
		expect(error).toContain("back-9007199254740992 - Huge target.md");
		expect(error).toContain("back-09007199254740992 - Huge padded duplicate.md");
		expect(error).toContain("backlog doctor");
	});

	it("fails closed instead of opening an arbitrary zero-padded duplicate", async () => {
		await Bun.write(
			join(filesystem.tasksDir, "back-1.2 - Duplicate.md"),
			serializeTask({ ...routedTask, id: "BACK-1.2", title: "Duplicate identity" }),
		);

		const response = await request("/api/task/BACK-1.2");
		expect(response.status).toBe(409);
		expect(response.headers.get("content-type")).toContain("application/json");
		const { error } = (await response.json()) as { error: string };
		expect(error).toContain("back-001.02 - Fix-labels-and-docs.md");
		expect(error).toContain("back-1.2 - Duplicate.md");
		expect(error).toContain("backlog doctor");
	});

	it("fails closed when a visible cross-branch task collides with a local padded ID", async () => {
		const contentStore = await (
			server as unknown as { getContentStoreInstance: () => Promise<ContentStore> }
		).getContentStoreInstance();
		const refreshTasks = contentStore.refreshTasks.bind(contentStore);
		contentStore.refreshTasks = async () => {};
		try {
			contentStore.upsertTask(
				{
					...routedTask,
					id: "REMOTE-1.2",
					title: "Cross-branch collision",
					branch: "feature/collision",
					source: "remote",
				},
				{ root: filesystem.backlogDir },
			);

			const response = await request("/api/task/1.2");
			expect(response.status).toBe(409);
			expect((await response.json()) as { error: string }).toEqual({
				error: "Task ID 1.2 is ambiguous. Repair duplicate task IDs before opening it.",
			});
		} finally {
			contentStore.refreshTasks = refreshTasks;
		}
	});

	it("takes exactly two branch-tip snapshots for a cold cross-branch task list", async () => {
		await restartWithActiveBranchCollision("BACK-1", true);
		const coreGit = (
			server as unknown as {
				core: {
					git: {
						listRecentBranchTips: (days: number) => Promise<Array<{ name: string; commit: string }>>;
					};
				};
			}
		).core.git;
		const originalListRecentBranchTips = coreGit.listRecentBranchTips.bind(coreGit);
		let tipSnapshotCount = 0;
		coreGit.listRecentBranchTips = async (days) => {
			tipSnapshotCount += 1;
			return await originalListRecentBranchTips(days);
		};

		try {
			const response = await request("/api/tasks?crossBranch=true", {}, 10000);
			expect(response.status).toBe(200);
			expect(((await response.json()) as Task[]).map((task) => task.id)).toContain("BACK-099");
			expect(tipSnapshotCount).toBe(2);
		} finally {
			coreGit.listRecentBranchTips = originalListRecentBranchTips;
		}
	});

	it("refreshes branch tips once for a warm parent-filtered task list", async () => {
		await restartWithActiveBranchCollision("BACK-1");
		expect((await request("/api/tasks?crossBranch=true", {}, 10000)).status).toBe(200);

		const coreGit = (
			server as unknown as {
				core: {
					git: {
						listRecentBranchTips: (days: number) => Promise<Array<{ name: string; commit: string }>>;
					};
				};
			}
		).core.git;
		const originalListRecentBranchTips = coreGit.listRecentBranchTips.bind(coreGit);
		let tipSnapshotCount = 0;
		coreGit.listRecentBranchTips = async (days) => {
			tipSnapshotCount += 1;
			return await originalListRecentBranchTips(days);
		};

		try {
			const response = await request("/api/tasks?parent=BACK-1&crossBranch=true", {}, 10000);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual([]);
			expect(tipSnapshotCount).toBe(1);
		} finally {
			coreGit.listRecentBranchTips = originalListRecentBranchTips;
		}
	});

	it("refreshes search results after an active branch ref moves", async () => {
		await restartWithActiveBranchCollision("BACK-1");
		const searchPath = "/api/search?type=task&query=zirconium";
		const initial = await request(searchPath, {}, 10000);
		expect(initial.status).toBe(200);
		expect(await initial.json()).toEqual([]);

		await addCollisionBranchTask({
			...routedTask,
			id: "BACK-120",
			title: "Zirconium branch ref sentinel",
			status: "To Do",
		});

		const refreshed = await request(searchPath, {}, 10000);
		expect(refreshed.status).toBe(200);
		const results = (await refreshed.json()) as Array<{ type: string; task?: Task }>;
		expect(results.map((result) => result.task?.id)).toContain("BACK-120");
	});

	it("coalesces concurrent ref fingerprints and skips full reloads while refs are unchanged", async () => {
		const serverInternals = server as unknown as {
			core: {
				git: {
					listRecentBranchTips: (days: number) => Promise<Array<{ name: string; commit: string }>>;
				};
			};
			getContentStoreInstance: () => Promise<ContentStore>;
		};
		const contentStore = await serverInternals.getContentStoreInstance();
		const originalRefreshTasks = contentStore.refreshTasks.bind(contentStore);
		const originalListRecentBranchTips = serverInternals.core.git.listRecentBranchTips.bind(serverInternals.core.git);
		let refreshCount = 0;
		let fingerprintCount = 0;
		let releaseFingerprint: () => void = () => {};
		let resolveFingerprintStarted: () => void = () => {};
		const fingerprintStarted = new Promise<void>((resolve) => {
			resolveFingerprintStarted = resolve;
		});
		const fingerprintGate = new Promise<void>((resolve) => {
			releaseFingerprint = resolve;
		});
		contentStore.refreshTasks = async () => {
			refreshCount += 1;
			await originalRefreshTasks();
		};
		serverInternals.core.git.listRecentBranchTips = async (days) => {
			fingerprintCount += 1;
			resolveFingerprintStarted();
			await fingerprintGate;
			return await originalListRecentBranchTips(days);
		};

		try {
			const requests = Array.from({ length: 8 }, () => request("/api/task/BACK-001.02", {}, 5000));
			await fingerprintStarted;
			await Bun.sleep(20);
			expect(fingerprintCount).toBe(1);
			releaseFingerprint();
			const responses = await Promise.all(requests);
			expect(responses.every((response) => response.status === 200)).toBe(true);
			expect(refreshCount).toBe(0);

			expect((await request("/api/task/BACK-001.02", {}, 5000)).status).toBe(200);
			expect(refreshCount).toBe(0);
		} finally {
			releaseFingerprint();
			contentStore.refreshTasks = originalRefreshTasks;
			serverInternals.core.git.listRecentBranchTips = originalListRecentBranchTips;
		}
	});

	it("coalesces one full reload when concurrent reads observe a changed ref snapshot", async () => {
		await restartWithActiveBranchCollision("BACK-001");
		const contentStore = await (
			server as unknown as { getContentStoreInstance: () => Promise<ContentStore> }
		).getContentStoreInstance();
		const originalRefreshTasks = contentStore.refreshTasks.bind(contentStore);
		let refreshCount = 0;
		let releaseRefresh: () => void = () => {};
		let resolveRefreshStarted: () => void = () => {};
		const refreshStarted = new Promise<void>((resolve) => {
			resolveRefreshStarted = resolve;
		});
		const refreshGate = new Promise<void>((resolve) => {
			releaseRefresh = resolve;
		});
		contentStore.refreshTasks = async () => {
			refreshCount += 1;
			resolveRefreshStarted();
			await refreshGate;
			await originalRefreshTasks();
		};

		try {
			await $`git branch fingerprint-only`.cwd(TEST_DIR).quiet();
			const requests = Array.from({ length: 8 }, () => request("/api/task/BACK-1", {}, 5000));
			await refreshStarted;
			await Bun.sleep(20);
			expect(refreshCount).toBe(1);
			releaseRefresh();
			const responses = await Promise.all(requests);
			expect(responses.every((response) => response.status === 409)).toBe(true);
			expect(refreshCount).toBe(1);
		} finally {
			releaseRefresh();
			contentStore.refreshTasks = originalRefreshTasks;
		}
	});

	it("returns the local task when an active branch changes the same task path", async () => {
		await restartWithActiveBranchCollision("BACK-1");

		const response = await request("/api/task/BACK-1");
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).title).toBe("Main collision task");
	});

	it("returns the local task when an active branch uses a padded ID at the same task path", async () => {
		await restartWithActiveBranchCollision("BACK-001", false, true);

		const response = await request("/api/task/BACK-1");
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).title).toBe("Main collision task");
	});

	it("fails closed when an active branch uses the same normalized ID at a different task path", async () => {
		await restartWithActiveBranchCollision("BACK-001");

		const response = await request("/api/task/BACK-1");
		expect(response.status).toBe(409);
		expect((await response.json()) as { error: string }).toEqual({
			error: "Task ID BACK-1 is ambiguous. Repair duplicate task IDs before opening it.",
		});
	});

	it("fails closed when active origin/main uses the same ID at a different task path", async () => {
		await restartWithActiveRemoteCollision();

		const response = await request("/api/task/BACK-1");
		expect(response.status).toBe(409);
		expect((await response.json()) as { error: string }).toEqual({
			error: "Task ID BACK-1 is ambiguous. Repair duplicate task IDs before opening it.",
		});
	});

	it("returns the local task when active origin/main has a padded version at the same path", async () => {
		await restartWithActiveRemoteCollision(true);

		const response = await request("/api/task/BACK-1");
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).title).toBe("Main collision task");
	});

	it("returns the local legacy task when an active branch changes the same task path", async () => {
		await restartWithActiveLegacyCollision();

		const response = await request("/api/task/BACK-PREFIXED");
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).title).toBe("Local legacy task");
	});

	it("serves the default task list from the content store instead of re-reading the working copy", async () => {
		await restartWithActiveBranchCollision("BACK-001", true);
		// Warm the store so the counted requests measure steady-state list serving.
		expect((await request("/api/tasks")).status).toBe(200);

		const serverFilesystem = (server as unknown as { core: { filesystem: FileSystem } }).core.filesystem;
		const originalListTasks = serverFilesystem.listTasks.bind(serverFilesystem);
		let workingCopyScans = 0;
		serverFilesystem.listTasks = async (...args) => {
			workingCopyScans += 1;
			return await originalListTasks(...args);
		};

		try {
			const defaultList = await request("/api/tasks");
			expect(defaultList.status).toBe(200);
			expect(((await defaultList.json()) as Task[]).map((task) => task.id)).toContain("BACK-099");
			expect(workingCopyScans).toBe(0);

			// The explicit local view still costs a working-copy read, which is why it must not be the default.
			const localList = await request("/api/tasks?crossBranch=false");
			expect(localList.status).toBe(200);
			expect(((await localList.json()) as Task[]).map((task) => task.id)).not.toContain("BACK-099");
			expect(workingCopyScans).toBeGreaterThan(0);
		} finally {
			serverFilesystem.listTasks = originalListTasks;
		}
	});

	it("reopens the local task after a browser save with an inherited active branch", async () => {
		await restartWithActiveBranchCollision("BACK-1");

		const saved = await request("/api/tasks/BACK-2", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Saved through browser API" }),
		});
		expect(saved.status).toBe(200);

		const reopened = await request("/api/task/BACK-2", {}, 5000);
		expect(reopened.status).toBe(200);
		expect(((await reopened.json()) as Task).title).toBe("Saved through browser API");
	});

	it("uses the current config when active-branch collision checks are toggled", async () => {
		await restartWithActiveBranchCollision("BACK-001", true);

		const initialCollision = await request("/api/task/BACK-1");
		expect(initialCollision.status).toBe(409);
		expect((await initialCollision.json()) as { error: string }).toEqual({
			error: "Task ID BACK-1 is ambiguous. Repair duplicate task IDs before opening it.",
		});
		const initialTasks = await request("/api/tasks?crossBranch=true");
		expect(initialTasks.status).toBe(200);
		expect(((await initialTasks.json()) as Task[]).map((task) => task.id)).toContain("BACK-099");
		const branchOnlyTask = await request("/api/task/BACK-099");
		expect(branchOnlyTask.status).toBe(200);
		expect(((await branchOnlyTask.json()) as Task).title).toBe("Branch-only task");
		const configResponse = await request("/api/config");
		expect(configResponse.status).toBe(200);
		const config = (await configResponse.json()) as Record<string, unknown>;

		const disabled = await request(
			"/api/config",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...config, checkActiveBranches: false }),
			},
			5000,
		);
		expect(disabled.status).toBe(200);
		expect((await disabled.json()) as { checkActiveBranches: boolean }).toMatchObject({
			checkActiveBranches: false,
		});
		const disabledReadback = await request("/api/config");
		expect(disabledReadback.status).toBe(200);
		expect((await disabledReadback.json()) as { checkActiveBranches: boolean }).toMatchObject({
			checkActiveBranches: false,
		});
		const localOnly = await request("/api/task/BACK-1");
		expect(localOnly.status).toBe(200);
		expect(((await localOnly.json()) as Task).title).toBe("Main collision task");
		const localTasks = await request("/api/tasks?crossBranch=true");
		expect(localTasks.status).toBe(200);
		expect(((await localTasks.json()) as Task[]).map((task) => task.id)).not.toContain("BACK-099");

		const enabled = await request(
			"/api/config",
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...config, checkActiveBranches: true }),
			},
			5000,
		);
		expect(enabled.status).toBe(200);
		expect((await enabled.json()) as { checkActiveBranches: boolean }).toMatchObject({
			checkActiveBranches: true,
		});
		const enabledReadback = await request("/api/config");
		expect(enabledReadback.status).toBe(200);
		expect((await enabledReadback.json()) as { checkActiveBranches: boolean }).toMatchObject({
			checkActiveBranches: true,
		});
		const restoredTasks = await request("/api/tasks?crossBranch=true");
		expect(restoredTasks.status).toBe(200);
		expect(((await restoredTasks.json()) as Task[]).map((task) => task.id)).toContain("BACK-099");
		const restoredCollision = await request("/api/task/BACK-1");
		expect(restoredCollision.status).toBe(409);
		expect((await restoredCollision.json()) as { error: string }).toEqual({
			error: "Task ID BACK-1 is ambiguous. Repair duplicate task IDs before opening it.",
		});
	});

	it("keeps config and duplicate-task reads fail-closed while a watched config is unusable", async () => {
		await server?.stop();
		server = null;
		const cachedConfig = await filesystem.loadConfig();
		if (!cachedConfig) throw new Error("Expected cached test config");
		const customStatuses = ["Queued", "Working", "Complete"];
		await filesystem.saveConfig({ ...cachedConfig, statuses: customStatuses });
		await restartWithActiveBranchCollision("BACK-001");
		expect((await request("/api/task/BACK-1")).status).toBe(409);
		expect((await request("/api/tasks?crossBranch=true")).status).toBe(200);

		const activeServer = server as unknown as {
			core: { filesystem: FileSystem };
			contentStore: ContentStore | null;
		};
		const serverFilesystem = activeServer.core.filesystem;
		const contentStore = activeServer.contentStore;
		if (!contentStore) throw new Error("Expected active content store");
		const canonicalContent = await Bun.file(serverFilesystem.configFilePath).text();
		const disabledContent = canonicalContent.replace("check_active_branches: true", "check_active_branches: false");
		const unusableContents = [
			[
				'project_name: "Partial"',
				"statuses: [",
				"labels: []",
				"date_format: YYYY-MM-DD",
				"check_active_branches: false",
				'task_prefix: "BACK"',
				"",
			].join("\n"),
			[
				'project_name: ""',
				'statuses: ["Queued", "Working", "Complete"]',
				'labels: ["web"]',
				"date_format: YYYY-MM-DD",
				"check_active_branches: false",
				'task_prefix: "BACK"',
				"",
			].join("\n"),
			[
				'project_name: "Malformed boolean"',
				'statuses: ["Queued", "Working", "Complete"]',
				'labels: ["web"]',
				"date_format: YYYY-MM-DD",
				"check_active_branches: fals",
				'task_prefix: "BACK"',
				"",
			].join("\n"),
			[
				'project_name: "Malformed active days"',
				'statuses: ["Queued", "Working", "Complete"]',
				'labels: ["web"]',
				"date_format: YYYY-MM-DD",
				"check_active_branches: true",
				"active_branch_days: nope",
				'task_prefix: "BACK"',
				"",
			].join("\n"),
			[
				'project_name: "Malformed task prefix"',
				'statuses: ["Queued", "Working", "Complete"]',
				'labels: ["web"]',
				"date_format: YYYY-MM-DD",
				"check_active_branches: true",
				"active_branch_days: 30",
				'task_prefix: "BACK-2"',
				"",
			].join("\n"),
		];

		const originalParseConfig = serverFilesystem.parseConfig.bind(serverFilesystem);
		const unusableParseAttempts = new Map(unusableContents.map((content) => [content, 0]));
		serverFilesystem.parseConfig = (content) => {
			const attempts = unusableParseAttempts.get(content);
			if (attempts !== undefined) {
				unusableParseAttempts.set(content, attempts + 1);
			}
			// Counted before parsing: a rejected list value throws instead of returning.
			return originalParseConfig(content);
		};

		let publicationAttempts = 0;
		const unsubscribe = contentStore.subscribe((event) => {
			if (event.type === "config") publicationAttempts += 1;
		});

		try {
			for (const unusableContent of unusableContents) {
				await replaceWatchedConfigFile(serverFilesystem.configFilePath, unusableContent);
				await retry(
					async () => {
						if ((unusableParseAttempts.get(unusableContent) ?? 0) < 8) {
							throw new Error("watchers have not exhausted the unusable candidate");
						}
						return true;
					},
					12,
					25,
				);
				expect(publicationAttempts).toBe(0);

				const concurrentReads = await Promise.all(
					Array.from({ length: 8 }, async () => {
						const [configResponse, coreConfig, taskResponse] = await Promise.all([
							request("/api/config", {}, 5000),
							serverFilesystem.loadConfig(),
							request("/api/task/BACK-1", {}, 5000),
						]);
						return {
							apiConfig: (await configResponse.json()) as BacklogConfig,
							configStatus: configResponse.status,
							coreConfig,
							taskStatus: taskResponse.status,
						};
					}),
				);
				for (const read of concurrentReads) {
					expect(read.configStatus).toBe(200);
					expect(read.apiConfig.projectName).toBe("Task SPA Fallback");
					expect(read.apiConfig.statuses).toEqual(customStatuses);
					expect(read.apiConfig.checkActiveBranches).toBe(true);
					expect(read.coreConfig?.projectName).toBe("Task SPA Fallback");
					expect(read.coreConfig?.statuses).toEqual(customStatuses);
					expect(read.coreConfig?.checkActiveBranches).toBe(true);
					expect(read.taskStatus).toBe(409);
				}
				expect(publicationAttempts).toBe(0);
			}

			await replaceWatchedConfigFile(serverFilesystem.configFilePath, disabledContent);
			await retry(
				async () => {
					const [configResponse, taskResponse] = await Promise.all([
						request("/api/config", {}, 5000),
						request("/api/task/BACK-1", {}, 5000),
					]);
					const config = (await configResponse.json()) as BacklogConfig;
					if (publicationAttempts !== 1 || config.checkActiveBranches !== false || taskResponse.status !== 200) {
						throw new Error("valid config has not published coherently");
					}
					return true;
				},
				12,
				25,
			);

			await replaceWatchedConfigFile(serverFilesystem.configFilePath, disabledContent);
			await Bun.sleep(250);
			expect(publicationAttempts).toBe(1);
			expect((await serverFilesystem.loadConfig())?.checkActiveBranches).toBe(false);
		} finally {
			unsubscribe();
			serverFilesystem.parseConfig = originalParseConfig;
		}
	});

	it("drops a cached collision after the active branch is removed", async () => {
		await restartWithActiveBranchCollision("BACK-001");
		expect((await request("/api/task/BACK-1")).status).toBe(409);

		await $`git branch -D collision-shadow`.cwd(TEST_DIR).quiet();

		const response = await request("/api/task/BACK-1", {}, 5000);
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).title).toBe("Main collision task");
	});

	it("rebuilds cached collision entries after an active branch task changes", async () => {
		await restartWithActiveBranchCollision("BACK-001");
		expect((await request("/api/task/BACK-1")).status).toBe(409);

		await replaceCollisionBranchTask("BACK-100", "Branch replacement");

		const response = await request("/api/task/BACK-1", {}, 5000);
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).title).toBe("Main collision task");
		const addedTask = await request("/api/task/BACK-100", {}, 5000);
		expect(addedTask.status).toBe(200);
		expect(((await addedTask.json()) as Task).title).toBe("Branch replacement");
	});

	it("retries a branch scan when a ref moves after its tree was indexed", async () => {
		await restartWithActiveBranchCollision("BACK-001");
		expect((await request("/api/task/BACK-1")).status).toBe(409);

		// Advance the branch to an uncached generation first. Unchanged commit trees are
		// intentionally reused, so the movement trigger must run while a new SHA is indexed.
		await replaceCollisionBranchTask("BACK-001", "Uncached collision generation");
		const collisionCommit = (await $`git rev-parse collision-shadow`.cwd(TEST_DIR).quiet()).text().trim();
		const coreGit = (
			server as unknown as {
				core: {
					git: {
						listFilesInTree: (ref: string, path: string) => Promise<string[]>;
					};
				};
			}
		).core.git;
		const originalListFilesInTree = coreGit.listFilesInTree.bind(coreGit);
		let movedDuringScan = false;
		coreGit.listFilesInTree = async (ref, path) => {
			const files = await originalListFilesInTree(ref, path);
			if (!movedDuringScan && ref === collisionCommit) {
				movedDuringScan = true;
				await replaceCollisionBranchTask("BACK-100", "Moved during scan");
			}
			return files;
		};

		try {
			await $`git branch fingerprint-trigger`.cwd(TEST_DIR).quiet();
			const response = await request("/api/task/BACK-1", {}, 10000);
			expect(movedDuringScan).toBe(true);
			expect(response.status).toBe(200);
			expect(((await response.json()) as Task).title).toBe("Main collision task");
			const replacement = await request("/api/task/BACK-100", {}, 5000);
			expect(replacement.status).toBe(200);
			expect(((await replacement.json()) as Task).title).toBe("Moved during scan");
		} finally {
			coreGit.listFilesInTree = originalListFilesInTree;
		}
	});
});
