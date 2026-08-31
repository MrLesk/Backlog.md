import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup, withTimeout } from "./test-utils.ts";

let testDir: string;
let server: BacklogServer | null = null;
let serverPort = 0;
let socket: WebSocket | null = null;

beforeEach(async () => {
	testDir = createUniqueTestDir("server-milestone-broadcast");
	await mkdir(testDir, { recursive: true });
	const core = new Core(testDir);
	await core.filesystem.ensureBacklogStructure();
	await core.filesystem.saveConfig({
		projectName: "Server milestone broadcast",
		statuses: ["To Do", "In Progress", "Done"],
		labels: [],
		milestones: [],
		dateFormat: "YYYY-MM-DD",
		remoteOperations: false,
		checkActiveBranches: false,
		autoCommit: false,
	});

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

const openSocket = async (messages: string[]) => {
	socket = new WebSocket(`ws://127.0.0.1:${serverPort}`);
	await withTimeout(
		new Promise<void>((resolve, reject) => {
			if (!socket) return reject(new Error("WebSocket was not created"));
			socket.onopen = () => resolve();
			socket.onerror = () => reject(new Error("WebSocket failed to open"));
		}),
		"milestone broadcast test WebSocket",
		2000,
	);
	socket.onmessage = (event) => messages.push(String(event.data));
};

describe("milestone WebSocket publication", () => {
	it("publishes a milestone-scoped update for milestone mutations", async () => {
		const messages: string[] = [];
		await openSocket(messages);

		const createResponse = await fetch(`http://127.0.0.1:${serverPort}/api/milestones`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Launch" }),
		});
		expect(createResponse.status).toBe(201);
		const created = (await createResponse.json()) as { id: string };
		await retry(async () => {
			if (!messages.includes("milestones-updated")) throw new Error("Milestone creation was not published");
		});

		messages.length = 0;
		const archiveResponse = await fetch(
			`http://127.0.0.1:${serverPort}/api/milestones/${encodeURIComponent(created.id)}/archive`,
			{ method: "POST" },
		);
		expect(archiveResponse.status).toBe(200);
		await retry(async () => {
			if (!messages.includes("milestones-updated")) throw new Error("Milestone archive was not published");
		});
	});
});
