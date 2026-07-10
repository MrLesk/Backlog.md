import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join, relative } from "node:path";
import { $ } from "bun";
import type { ContentStore } from "../core/content-store.ts";
import { FileSystem } from "../file-system/operations.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;
let auxiliaryWorktreeDir: string | null = null;

const routedTask: Task = {
	id: "BACK-001.02",
	title: "Fix labels and docs",
	status: "In Progress",
	assignee: ["@alex"],
	labels: ["web"],
	dependencies: [],
	createdDate: "2026-07-10",
};

async function request(path: string, init: RequestInit = {}, timeoutMs = 1500): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(`http://127.0.0.1:${serverPort}${path}`, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

async function startServer(): Promise<void> {
	server = new BacklogServer(TEST_DIR);
	await server.start(0, false);
	const port = server.getPort();
	expect(port).not.toBeNull();
	serverPort = port ?? 0;

	await retry(
		async () => {
			const response = await request("/api/status", {}, 500);
			if (!response.ok) throw new Error("server not ready");
			return true;
		},
		10,
		50,
	);
}

async function restartWithActiveBranchCollision(branchTaskId: "BACK-1" | "BACK-001"): Promise<void> {
	await server?.stop();
	server = null;

	const config = await filesystem.loadConfig();
	if (!config) {
		throw new Error("Expected test config");
	}
	await filesystem.saveConfig({ ...config, checkActiveBranches: true });
	const mainTask = { ...routedTask, id: "BACK-1", title: "Main collision task" };
	const mainTaskPath = await filesystem.saveTask(mainTask);

	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	await $`git add backlog`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Add main task"`.cwd(TEST_DIR).quiet();
	await $`git switch -c collision-shadow`.cwd(TEST_DIR).quiet();

	if (branchTaskId === "BACK-1") {
		await Bun.write(mainTaskPath, serializeTask({ ...mainTask, title: "Exact branch collision" }));
	} else {
		await $`git rm -- ${relative(TEST_DIR, mainTaskPath)}`.cwd(TEST_DIR).quiet();
		await Bun.write(
			join(filesystem.tasksDir, "back-001 - Padded branch collision.md"),
			serializeTask({ ...mainTask, id: branchTaskId, title: "Padded branch collision" }),
		);
	}

	await $`git add backlog`.cwd(TEST_DIR).quiet();
	await $`git commit -m "Add branch collision"`.cwd(TEST_DIR).quiet();
	await $`git switch main`.cwd(TEST_DIR).quiet();
	await startServer();
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
		await safeCleanup(TEST_DIR);
	});

	it("serves task and board namespaces through the SPA for direct and refreshed navigation", async () => {
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
		expect((await response.json()) as { error: string }).toEqual({
			error: "Task ID BACK-PREFIXED is ambiguous. Repair duplicate task IDs before opening it.",
		});
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
		expect((await ambiguous.json()) as { error: string }).toEqual({
			error: "Task ID BACK-9007199254740992 is ambiguous. Repair duplicate task IDs before opening it.",
		});
	});

	it("fails closed instead of opening an arbitrary zero-padded duplicate", async () => {
		await Bun.write(
			join(filesystem.tasksDir, "back-1.2 - Duplicate.md"),
			serializeTask({ ...routedTask, id: "BACK-1.2", title: "Duplicate identity" }),
		);

		const response = await request("/api/task/BACK-1.2");
		expect(response.status).toBe(409);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect((await response.json()) as { error: string }).toEqual({
			error: "Task ID BACK-1.2 is ambiguous. Repair duplicate task IDs before opening it.",
		});
	});

	it("fails closed when a visible cross-branch task collides with a local padded ID", async () => {
		const contentStore = await (
			server as unknown as { getContentStoreInstance: () => Promise<ContentStore> }
		).getContentStoreInstance();
		const refreshTasks = contentStore.refreshTasks.bind(contentStore);
		contentStore.refreshTasks = async () => {};
		try {
			contentStore.upsertTask({
				...routedTask,
				id: "REMOTE-1.2",
				title: "Cross-branch collision",
				branch: "feature/collision",
				source: "remote",
			});

			const response = await request("/api/task/1.2");
			expect(response.status).toBe(409);
			expect((await response.json()) as { error: string }).toEqual({
				error: "Task ID 1.2 is ambiguous. Repair duplicate task IDs before opening it.",
			});
		} finally {
			contentStore.refreshTasks = refreshTasks;
		}
	});

	for (const branchTaskId of ["BACK-1", "BACK-001"] as const) {
		it(`fails closed when active branch collision-shadow contains ${branchTaskId}`, async () => {
			await restartWithActiveBranchCollision(branchTaskId);

			const response = await request("/api/task/BACK-1");
			expect(response.status).toBe(409);
			expect((await response.json()) as { error: string }).toEqual({
				error: "Task ID BACK-1 is ambiguous. Repair duplicate task IDs before opening it.",
			});
		});
	}

	it("uses the current config when active-branch collision checks are toggled", async () => {
		await restartWithActiveBranchCollision("BACK-1");

		expect((await request("/api/task/BACK-1")).status).toBe(409);
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
		await Bun.sleep(200);
		const localOnly = await request("/api/task/BACK-1");
		expect(localOnly.status).toBe(200);
		expect(((await localOnly.json()) as Task).title).toBe("Main collision task");

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
		expect((await request("/api/task/BACK-1")).status).toBe(409);
	});

	it("drops a cached collision after the active branch is removed", async () => {
		await restartWithActiveBranchCollision("BACK-1");
		expect((await request("/api/task/BACK-1")).status).toBe(409);

		await $`git branch -D collision-shadow`.cwd(TEST_DIR).quiet();

		const response = await request("/api/task/BACK-1", {}, 5000);
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).title).toBe("Main collision task");
	});

	it("rebuilds cached collision entries after an active branch task changes", async () => {
		await restartWithActiveBranchCollision("BACK-1");
		expect((await request("/api/task/BACK-1")).status).toBe(409);

		auxiliaryWorktreeDir = createUniqueTestDir("server-task-collision-worktree");
		await $`git worktree add ${auxiliaryWorktreeDir} collision-shadow`.cwd(TEST_DIR).quiet();
		const branchFilesystem = new FileSystem(auxiliaryWorktreeDir);
		const branchTask = await branchFilesystem.loadTask("BACK-1");
		expect(branchTask?.filePath).toBeDefined();
		await $`git rm -- ${relative(auxiliaryWorktreeDir, branchTask?.filePath as string)}`
			.cwd(auxiliaryWorktreeDir)
			.quiet();
		await Bun.write(
			join(branchFilesystem.tasksDir, "back-2 - Branch-replacement.md"),
			serializeTask({ ...routedTask, id: "BACK-2", title: "Branch replacement" }),
		);
		await $`git add backlog`.cwd(auxiliaryWorktreeDir).quiet();
		await $`git commit -m "Replace colliding branch task"`.cwd(auxiliaryWorktreeDir).quiet();
		await $`git worktree remove --force ${auxiliaryWorktreeDir}`.cwd(TEST_DIR).quiet();
		await safeCleanup(auxiliaryWorktreeDir);
		auxiliaryWorktreeDir = null;

		const response = await request("/api/task/BACK-1", {}, 5000);
		expect(response.status).toBe(200);
		expect(((await response.json()) as Task).title).toBe("Main collision task");
	});
});
