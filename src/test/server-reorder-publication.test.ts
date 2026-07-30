import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, retry, safeCleanup, sleep, withTimeout } from "./test-utils.ts";

let testDir: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let socket: WebSocket | null = null;

const task = (id: string): Task => ({
	id,
	title: `Task ${id}`,
	status: "To Do",
	ordinal: 1000,
	assignee: [],
	createdDate: "2026-01-01",
	labels: [],
	dependencies: [],
});

beforeEach(async () => {
	testDir = createUniqueTestDir("server-reorder-publication");
	await mkdir(testDir, { recursive: true });
	const core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "Server reorder publication",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});
	for (const id of ["TASK-1", "TASK-2", "TASK-3"]) {
		await core.filesystem.saveTask(task(id));
	}

	server = new BacklogServer(testDir);
	await server.start(0, false);
	serverPort = server.getPort() ?? 0;
	await retry(async () => {
		const response = await fetch(`http://127.0.0.1:${serverPort}/api/status`);
		if (!response.ok) throw new Error("Server is not ready");
	});
});

afterEach(async () => {
	socket?.close();
	socket = null;
	await server?.stop();
	server = null;
	await safeCleanup(testDir);
});

describe("reorder WebSocket publication", () => {
	it("publishes one reconciliation after a multi-task ordinal rebalance", async () => {
		const messages: string[] = [];
		socket = new WebSocket(`ws://127.0.0.1:${serverPort}`);
		await withTimeout(
			new Promise<void>((resolve, reject) => {
				if (!socket) return reject(new Error("WebSocket was not created"));
				socket.onopen = () => resolve();
				socket.onerror = () => reject(new Error("WebSocket failed to open"));
			}),
			"reorder test WebSocket",
			2000,
		);
		socket.onmessage = (event) => messages.push(String(event.data));

		const response = await fetch(`http://127.0.0.1:${serverPort}/api/tasks/reorder`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				taskId: "TASK-3",
				targetStatus: "To Do",
				orderedTaskIds: ["TASK-1", "TASK-3", "TASK-2"],
			}),
		});

		expect(response.status).toBe(200);
		const result = (await response.json()) as { success: boolean; task: Task };
		expect(result.task.ordinal).toBe(2000);
		await retry(async () => {
			if (!messages.includes("tasks-updated")) throw new Error("Reconciliation was not published");
		});
		await sleep(50);
		expect(messages.filter((message) => message === "tasks-updated")).toHaveLength(1);
	});
});
