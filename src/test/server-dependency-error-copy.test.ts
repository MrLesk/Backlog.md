import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let testDir: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let core: Core;

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "TASK-1",
		title: "Depend on me",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-01-01",
		...overrides,
	};
}

beforeEach(async () => {
	testDir = createUniqueTestDir("server-dependency-error-copy");
	await mkdir(testDir, { recursive: true });
	core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "Server dependency error copy",
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

describe("BacklogServer dependency validation errors", () => {
	it("does not tell a rejected web-UI dependency save to open 'backlog browser'", async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dependencies: ["TASK-999"] }),
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain("TASK-999");
		expect(body.error).not.toContain("backlog browser");
	});

	it("rejects a save that makes the task depend on itself, alias spelling included", async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dependencies: ["task-1"] }),
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain("cannot depend on itself");
	});

	it("rejects a save that closes a dependency cycle, naming the cycle path", async () => {
		const createResponse = await fetch(`http://127.0.0.1:${serverPort}/api/tasks`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Depends on task 1", dependencies: ["TASK-1"] }),
		});
		expect(createResponse.status).toBe(201);
		const created = (await createResponse.json()) as { id: string };

		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/TASK-1`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ dependencies: [created.id] }),
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain(`These dependencies would create a cycle: TASK-1 -> ${created.id} -> TASK-1`);
	});

	it("still rejects a task-create request naming a missing dependency, with the same web-appropriate copy", async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "New task", dependencies: ["TASK-999"] }),
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain("TASK-999");
		expect(body.error).not.toContain("backlog browser");
	});
});
