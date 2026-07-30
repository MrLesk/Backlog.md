import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { BacklogServer } from "../server/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

type InitHandler = {
	core: Core;
	handleInit(req: Request): Promise<Response>;
	handleGetConfig(): Promise<Response>;
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

	it("round-trips autoCommitMode and quoted project names from browser initialization", async () => {
		const server = new BacklogServer(TEST_DIR) as unknown as InitHandler;
		const response = await server.handleInit(
			initRequest({
				projectName: 'Browser "Quoted" Init',
				advancedConfig: { autoCommit: true, autoCommitMode: "amend-own" },
			}),
		);

		expect(response.status).toBe(200);
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		expect(config?.projectName).toBe('Browser "Quoted" Init');
		expect(config?.autoCommit).toBe(true);
		expect(config?.autoCommitMode).toBe("amend-own");
		const { task } = await core.createTaskFromInput({ title: "Mutation after quoted initialization" }, false);
		expect((await core.filesystem.loadTask(task.id))?.title).toBe("Mutation after quoted initialization");
	});

	it("returns and publishes persisted current config after a post-save browser init race", async () => {
		const server = new BacklogServer(TEST_DIR) as unknown as InitHandler;
		const originalSaveConfig = server.core.filesystem.saveConfig.bind(server.core.filesystem);
		server.core.filesystem.saveConfig = async (config) => {
			await originalSaveConfig(config);
			const configPath = server.core.filesystem.configFilePath;
			const savedBytes = await Bun.file(configPath).text();
			await Bun.write(
				configPath,
				savedBytes
					.replace("auto_commit: true", "auto_commit: false")
					.replace("auto_commit_mode: amend-own", "auto_commit_mode: new"),
			);
		};

		const response = await server.handleInit(
			initRequest({ advancedConfig: { autoCommit: true, autoCommitMode: "amend-own" } }),
		);
		const body = (await response.json()) as { config: { autoCommit: boolean; autoCommitMode: string } };
		const cachedResponse = await server.handleGetConfig();

		expect(response.status).toBe(200);
		expect(body.config.autoCommit).toBe(false);
		expect(body.config.autoCommitMode).toBe("new");
		expect(await cachedResponse.json()).toEqual(expect.objectContaining({ autoCommit: false, autoCommitMode: "new" }));
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
