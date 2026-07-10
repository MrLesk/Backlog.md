import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, retry, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let filesystem: FileSystem;
let server: BacklogServer | null = null;
let serverPort = 0;

async function fetchWithTimeout(path: string, timeoutMs = 1000): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(`http://127.0.0.1:${serverPort}${path}`, { signal: controller.signal });
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
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
		});

		server = new BacklogServer(TEST_DIR);
		await server.start(0, false);
		const port = server.getPort();
		expect(port).not.toBeNull();
		serverPort = port ?? 0;

		await retry(
			async () => {
				const res = await fetchWithTimeout("/api/status", 500);
				if (!res.ok) throw new Error("server not ready");
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

	it("serves the SPA entry for /tasks/TASK-1", async () => {
		const res = await fetchWithTimeout("/tasks/TASK-1");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const body = await res.text();
		expect(body).toContain('<div id="root"></div>');
		expect(body).toContain("Backlog.md - Task Management");
	});

	it("serves the SPA entry for /tasks/TASK-1/some-title", async () => {
		const res = await fetchWithTimeout("/tasks/TASK-1/some-title");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
		const body = await res.text();
		expect(body).toContain('<div id="root"></div>');
	});
});
