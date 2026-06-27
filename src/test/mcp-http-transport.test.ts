import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { startHttpMcpServer } from "../mcp/http-server.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let httpServer: ReturnType<typeof startHttpMcpServer> | null = null;

async function lastAuthor(dir: string) {
	const { stdout } = await $`git log -1 --format=%an%x09%ae%x09%cn`.cwd(dir).quiet();
	const [authorName, authorEmail, committerName] = stdout.toString().trim().split("\t");
	return { authorName, authorEmail, committerName };
}

async function callCreateTask(port: number, headers: Record<string, string>, title: string) {
	const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
		requestInit: { headers },
	});
	const client = new Client({ name: "test-client", version: "1.0.0" });
	await client.connect(transport);
	try {
		await client.callTool({ name: "task_create", arguments: { title } });
	} finally {
		await client.close();
	}
}

describe("MCP Streamable-HTTP transport", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-http");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.email robot@host`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Backlog Robot"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "MCP HTTP Project", true);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("no config");
		config.autoCommit = true;
		config.commitAuthorFromProxyHeaders = true;
		await core.filesystem.saveConfig(config);

		httpServer = startHttpMcpServer(TEST_DIR, { port: 0 });
	});

	afterEach(async () => {
		httpServer?.stop(true);
		httpServer = null;
		await safeCleanup(TEST_DIR);
	});

	it("attributes the commit to the proxied user from forwarded headers", async () => {
		const port = httpServer?.port ?? 0;
		expect(port).toBeGreaterThan(0);

		await callCreateTask(
			port,
			{ "x-forwarded-email": "alice@example.com", "x-forwarded-preferred-username": "Alice Dupont" },
			"Created over HTTP by Alice",
		);

		const id = await lastAuthor(TEST_DIR);
		expect(id.authorName).toBe("Alice Dupont");
		expect(id.authorEmail).toBe("alice@example.com");
		// committer stays the server git identity
		expect(id.committerName).toBe("Backlog Robot");
	});

	it("falls back to the git identity when no identity headers are present", async () => {
		const port = httpServer?.port ?? 0;
		await callCreateTask(port, {}, "Created over HTTP anonymously");

		const id = await lastAuthor(TEST_DIR);
		expect(id.authorName).toBe("Backlog Robot");
		expect(id.authorEmail).toBe("robot@host");
	});
});
