import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`http://127.0.0.1:${serverPort}${path}`, init);
	if (!response.ok) {
		throw new Error(`${response.status}: ${await response.text()}`);
	}
	return response.json();
}

function makeTask(overrides: Partial<Task>): Task {
	return {
		id: "task-1",
		title: "Task",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		rawContent: "Task body",
		...overrides,
	};
}

describe("BacklogServer demote endpoint", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("server-demote");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig({
			projectName: "Server Demote",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		await core.createTask(
			makeTask({
				id: "task-1",
				title: "Demote Test Task",
				status: "To Do",
			}),
			false,
		);

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(async () => {
			await fetchJson<unknown>("/api/tasks");
		});
	});

	afterEach(async () => {
		if (server) {
			await server.stop();
			server = null;
		}
		await safeCleanup(TEST_DIR);
	});

	it("demotes a task to draft via POST /api/tasks/:id/demote", async () => {
		const activeTasksBefore = await core.filesystem.listTasks();
		expect(activeTasksBefore.map((t) => t.id)).toContain("TASK-1");

		const result = await fetchJson<{ success: boolean }>("/api/tasks/task-1/demote", {
			method: "POST",
		});
		expect(result.success).toBe(true);

		const activeTasksAfter = await core.filesystem.listTasks();
		expect(activeTasksAfter.map((t) => t.id)).not.toContain("TASK-1");

		const drafts = await core.filesystem.listDrafts();
		expect(drafts.length).toBe(1);
		expect(drafts[0]?.title).toBe("Demote Test Task");
		expect(drafts[0]?.id).toMatch(/^DRAFT-\d+$/i);
	});

	it("returns 404 for non-existent task", async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/task-999/demote`, {
			method: "POST",
		});
		expect(response.status).toBe(404);
		const data = await response.json();
		expect(data.error).toBe("Task not found");
	});
});
