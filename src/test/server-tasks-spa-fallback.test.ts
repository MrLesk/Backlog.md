import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
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
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
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
	});
});
