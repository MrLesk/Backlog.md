import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

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

	it("returns replacement feedback when browser initialization amends agent instructions", async () => {
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -q -b main`.cwd(TEST_DIR);
		await $`git config user.name "Test User"`.cwd(TEST_DIR);
		await $`git config user.email test@example.com`.cwd(TEST_DIR);
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Before browser re-initialization");
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing test config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, autoCommitMode: "amend-own" });
		await $`git add . && git commit -q -m "Initialize owned sequence"`.cwd(TEST_DIR);
		await core.createTaskFromInput({ title: "Owned tip before browser initialization" });
		const previousHead = (await $`git rev-parse HEAD`.cwd(TEST_DIR).text()).trim();
		const previousCount = (await $`git rev-list --count HEAD`.cwd(TEST_DIR).text()).trim();
		await rm(core.filesystem.configFilePath);

		const server = new BacklogServer(TEST_DIR);
		try {
			await server.start(0, false);
			const response = await fetch(`http://localhost:${server.getPort()}/api/init`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectName: "Reinitialized",
					integrationMode: "cli",
					agentInstructions: ["AGENTS.md"],
					advancedConfig: { autoCommit: true, autoCommitMode: "amend-own" },
				}),
			});

			expect(response.status).toBe(200);
			expect(response.headers.get("X-Backlog-Auto-Commit")).toMatch(
				/^Amended Backlog commit [0-9a-f]{12} as [0-9a-f]{12}\.$/,
			);
			expect((await $`git rev-parse HEAD`.cwd(TEST_DIR).text()).trim()).not.toBe(previousHead);
			expect((await $`git rev-list --count HEAD`.cwd(TEST_DIR).text()).trim()).toBe(previousCount);
		} finally {
			await server.stop();
		}
	}, 20_000);

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
