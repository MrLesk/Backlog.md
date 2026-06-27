import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let BARE_DIR: string;
let SEED_DIR: string;
let OTHER_DIR: string;
let MCP_DIR: string;

async function rev(dir: string, ref: string): Promise<string> {
	const { stdout } = await $`git rev-parse ${ref}`.cwd(dir).quiet();
	return stdout.toString().trim();
}

async function configGit(dir: string) {
	await $`git config user.email robot@host`.cwd(dir).quiet();
	await $`git config user.name "Backlog Robot"`.cwd(dir).quiet();
}

describe("MCP auto-pull before tool calls", () => {
	beforeEach(async () => {
		BARE_DIR = `${createUniqueTestDir("mcp-pull-remote")}.git`;
		await mkdir(BARE_DIR, { recursive: true });
		await $`git init --bare -b main`.cwd(BARE_DIR).quiet();

		// Seed the project and publish it to the bare remote.
		SEED_DIR = createUniqueTestDir("mcp-pull-seed");
		await mkdir(SEED_DIR, { recursive: true });
		await $`git init -b main`.cwd(SEED_DIR).quiet();
		await configGit(SEED_DIR);
		await $`git remote add origin ${BARE_DIR}`.cwd(SEED_DIR).quiet();
		const seedCore = new Core(SEED_DIR);
		await initializeTestProject(seedCore, "MCP Pull Project", true);
		await $`git push -u origin main`.cwd(SEED_DIR).quiet();

		// The MCP clone — initially at the seed state.
		MCP_DIR = createUniqueTestDir("mcp-pull-mcp");
		await $`git clone ${BARE_DIR} ${MCP_DIR}`.quiet();
		await configGit(MCP_DIR);

		// Another collaborator pushes a new commit after the MCP clone was made.
		OTHER_DIR = createUniqueTestDir("mcp-pull-other");
		await $`git clone ${BARE_DIR} ${OTHER_DIR}`.quiet();
		await configGit(OTHER_DIR);
		await Bun.write(`${OTHER_DIR}/backlog/docs/remote-note.md`, "# pushed by someone else\n");
		await $`git add backlog/docs/remote-note.md`.cwd(OTHER_DIR).quiet();
		await $`git commit -m "docs: remote change"`.cwd(OTHER_DIR).quiet();
		await $`git push origin main`.cwd(OTHER_DIR).quiet();
	});

	afterEach(async () => {
		await safeCleanup(BARE_DIR);
		await safeCleanup(SEED_DIR);
		await safeCleanup(OTHER_DIR);
		await safeCleanup(MCP_DIR);
	});

	async function startMcp(autoPull: boolean): Promise<McpServer> {
		const server = new McpServer(MCP_DIR, "Test instructions");
		await server.filesystem.ensureBacklogStructure();
		const config = await server.filesystem.loadConfig();
		if (!config) throw new Error("no config");
		config.autoPull = autoPull;
		config.remoteOperations = true;
		await server.filesystem.saveConfig(config);
		registerTaskTools(server, config);
		return server;
	}

	it("pulls remote commits before a tool call when autoPull is enabled", async () => {
		const remoteHead = await rev(BARE_DIR, "main");
		expect(await rev(MCP_DIR, "HEAD")).not.toBe(remoteHead); // behind at first

		const server = await startMcp(true);
		try {
			await server.testInterface.callTool({ params: { name: "task_list", arguments: {} } });
			expect(await rev(MCP_DIR, "HEAD")).toBe(remoteHead); // caught up via auto-pull
		} finally {
			await server.stop();
		}
	});

	it("does not pull when autoPull is disabled", async () => {
		const before = await rev(MCP_DIR, "HEAD");
		const remoteHead = await rev(BARE_DIR, "main");
		expect(before).not.toBe(remoteHead);

		const server = await startMcp(false);
		try {
			await server.testInterface.callTool({ params: { name: "task_list", arguments: {} } });
			expect(await rev(MCP_DIR, "HEAD")).toBe(before); // unchanged
		} finally {
			await server.stop();
		}
	});
});
