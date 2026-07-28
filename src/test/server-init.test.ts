import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

type InitHandler = {
	handleInit(req: Request): Promise<Response>;
};

function initRequest(body: Record<string, unknown>): Request {
	return new Request("http://127.0.0.1/api/init", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			projectName: "Server Init",
			integrationMode: "none",
			...body,
		}),
	});
}

describe("BacklogServer init endpoint", () => {
	beforeEach(() => {
		TEST_DIR = createUniqueTestDir("server-init");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("parses string false filesystemOnly without enabling filesystem-only mode", async () => {
		const server = new BacklogServer(TEST_DIR) as unknown as InitHandler;
		const response = await server.handleInit(initRequest({ filesystemOnly: "false" }));

		expect(response.status).toBe(200);

		const config = await new Core(TEST_DIR).filesystem.loadConfig();
		expect(config?.filesystemOnly).toBe(false);
		expect(config?.remoteOperations).toBe(true);
		expect(config?.checkActiveBranches).toBe(true);
	});

	it("round-trips autoCommitMode from browser initialization", async () => {
		const server = new BacklogServer(TEST_DIR) as unknown as InitHandler;
		const response = await server.handleInit(
			initRequest({ advancedConfig: { autoCommit: true, autoCommitMode: "amend-own" } }),
		);

		expect(response.status).toBe(200);
		const config = await new Core(TEST_DIR).filesystem.loadConfig();
		expect(config?.autoCommit).toBe(true);
		expect(config?.autoCommitMode).toBe("amend-own");
	});

	it("rejects an invalid browser initialization autoCommitMode without writing config", async () => {
		const server = new BacklogServer(TEST_DIR) as unknown as InitHandler;
		const response = await server.handleInit(initRequest({ advancedConfig: { autoCommitMode: "amend" } }));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Auto commit mode must be new or amend-own" });
		expect(await new Core(TEST_DIR).filesystem.loadConfig()).toBeNull();
	});

	it("accepts string true filesystemOnly for loose init callers", async () => {
		const server = new BacklogServer(TEST_DIR) as unknown as InitHandler;
		const response = await server.handleInit(initRequest({ filesystemOnly: "true" }));

		expect(response.status).toBe(200);

		const config = await new Core(TEST_DIR).filesystem.loadConfig();
		expect(config?.filesystemOnly).toBe(true);
		expect(config?.remoteOperations).toBe(false);
		expect(config?.checkActiveBranches).toBe(false);
	});
});
