import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { BacklogServer } from "../server/index.ts";
import type { SearchResult, Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let testDir: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "TASK-1",
		title: "Demote me",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		...overrides,
	};
}

beforeEach(async () => {
	testDir = createUniqueTestDir("server-demote");
	await mkdir(testDir, { recursive: true });
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "Server demote",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});
	await core.createTask(task(), false);

	server = new BacklogServer(testDir);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
	await retry(async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/status`);
		if (!response.ok) throw new Error("Server is not ready");
	});
});

afterEach(async () => {
	await server?.stop();
	server = null;
	await safeCleanup(testDir);
});

describe("BacklogServer demote endpoint", () => {
	it("moves an active task through the canonical Core demotion", async () => {
		const beforeSearch = (await fetch(`http://127.0.0.1:${serverPort}/api/search`).then((result) =>
			result.json(),
		)) as SearchResult[];
		expect(beforeSearch.some((result) => result.type === "task" && result.task.id === "TASK-1")).toBe(true);

		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-1/demote`, { method: "POST" });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(await core.filesystem.loadTask("TASK-1")).toBeNull();

		const drafts = await core.filesystem.listDrafts();
		expect(drafts).toHaveLength(1);
		expect(drafts[0]).toMatchObject({ id: "DRAFT-1", title: "Demote me", status: "To Do" });

		const refreshedSearch = (await fetch(`http://127.0.0.1:${serverPort}/api/search`).then((result) =>
			result.json(),
		)) as SearchResult[];
		expect(refreshedSearch.some((result) => result.type === "task" && result.task.id === "TASK-1")).toBe(false);
	});

	it("returns 404 without writing when the task does not exist", async () => {
		const before = await core.filesystem.listDrafts();
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-999/demote`, {
			method: "POST",
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Task not found" });
		expect(await core.filesystem.listDrafts()).toEqual(before);
		expect(await core.filesystem.loadTask("TASK-1")).not.toBeNull();
	});

	it("returns 409 without moving either file when the task ID is ambiguous", async () => {
		const duplicatePath = join(core.filesystem.tasksDir, "task-01 - Duplicate.md");
		await Bun.write(duplicatePath, serializeTask(task({ id: "TASK-01", title: "Duplicate" })));

		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-1/demote`, { method: "POST" });

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({ error: expect.stringContaining("ambiguous") });
		expect(await core.filesystem.listDrafts()).toEqual([]);
		expect(await Bun.file(duplicatePath).exists()).toBe(true);
		expect((await core.filesystem.listTasks()).map((entry) => entry.title).sort()).toEqual(["Demote me", "Duplicate"]);
	});
});
