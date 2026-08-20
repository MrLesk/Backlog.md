import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let filesystem: FileSystem;
let serverPort = 0;

const webTask: Task = {
	id: "TASK-0001",
	title: "Web project search task",
	status: "In Progress",
	assignee: ["@codex"],
	createdDate: "2025-09-20 10:00",
	labels: [],
	dependencies: [],
	description: "Alpha token appears here",
	project: "Web",
};

const apiTask: Task = {
	id: "TASK-0002",
	title: "API project search task",
	status: "In Progress",
	assignee: ["@codex"],
	createdDate: "2025-09-20 10:30",
	labels: [],
	dependencies: [],
	description: "Alpha token appears here too",
	project: "API",
};

const unprojectedTask: Task = {
	id: "TASK-0003",
	title: "Unprojected search task",
	status: "In Progress",
	assignee: ["@codex"],
	createdDate: "2025-09-20 11:00",
	labels: [],
	dependencies: [],
	description: "Alpha token with no project",
};

async function fetchJson<T>(path: string): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`);
	if (!response.ok) {
		throw new Error(`Request to ${path} failed with status ${response.status}`);
	}
	return (await response.json()) as T;
}

describe("BacklogServer search endpoint project filtering", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-search-project");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Server Search Project Filter",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			projects: ["Web", "API", "Mobile"],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		await filesystem.saveTask(webTask);
		await filesystem.saveTask(apiTask);
		await filesystem.saveTask(unprojectedTask);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;
		expect(serverPort).toBeGreaterThan(0);

		await retry(
			async () => {
				const tasks = await fetchJson<Task[]>("/api/tasks");
				expect(tasks.length).toBeGreaterThan(0);
				return tasks;
			},
			10,
			100,
		);
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("filters search results by a single project", async () => {
		const results = await fetchJson<Array<{ type: string; task?: Task }>>(
			"/api/search?type=task&query=Alpha&project=Web",
		);
		expect(results).toHaveLength(1);
		expect(results[0]?.task?.id).toBe(webTask.id);
	});

	it("applies OR semantics for repeated project params", async () => {
		const results = await fetchJson<Array<{ type: string; task?: Task }>>(
			"/api/search?type=task&query=Alpha&project=web&project=api",
		);
		const ids = results.map((result) => result.task?.id).sort();
		expect(ids).toEqual([apiTask.id, webTask.id].sort());
	});

	it("rejects unsupported project filters with 400 and lists valid values", async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/search?type=task&query=Alpha&project=desktop`);
		expect(response.status).toBe(400);
		const body = (await response.json()) as { error?: string };
		expect(body.error).toContain("Unsupported project 'desktop'");
		expect(body.error).toContain("Web, API, Mobile");
	});

	it("does not filter GET /api/tasks by project (unfiltered base fetch, matching type's absence there)", async () => {
		const tasks = await fetchJson<Task[]>("/api/tasks?project=Web");
		const ids = tasks.map((task) => task.id).sort();
		expect(ids).toEqual([apiTask.id, unprojectedTask.id, webTask.id].sort());
	});
});
