import { afterEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { MCP_WORKFLOW_TEXT } from "../guidelines/mcp/index.ts";
import { createMcpServer, McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

async function bootstrapServer(): Promise<McpServer> {
	TEST_DIR = createUniqueTestDir("mcp-server");
	const server = new McpServer(TEST_DIR);

	await server.filesystem.ensureBacklogStructure();
	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

	await server.initializeProject("Test Project");
	return server;
}

describe("McpServer bootstrap", () => {
	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("exposes core capabilities before registration", async () => {
		const server = await bootstrapServer();

		const tools = await server.testInterface.listTools();
		expect(tools.tools.map((tool) => tool.name)).toEqual(["read_backlog_instructions"]);

		const resources = await server.testInterface.listResources();
		expect(resources.resources).toEqual([]);

		const prompts = await server.testInterface.listPrompts();
		expect(prompts.prompts).toEqual([]);

		await server.stop();
	});

	it("read_backlog_instructions tool returns workflow instructions", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.callTool({
			params: { name: "read_backlog_instructions", arguments: {} },
		});

		expect(result).toEqual({
			content: [
				{
					type: "text",
					text: MCP_WORKFLOW_TEXT,
				},
			],
		});

		await server.stop();
	});

	it("registers default tool set via helpers", async () => {
		const server = await bootstrapServer();
		const config = await server.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load config");
		}

		registerTaskTools(server, config);

		const tools = await server.testInterface.listTools();
		const toolNames = tools.tools.map((tool) => tool.name).sort();
		expect(toolNames).toEqual([
			"read_backlog_instructions",
			"task_archive",
			"task_create",
			"task_edit",
			"task_list",
			"task_search",
			"task_view",
		]);

		const resources = await server.testInterface.listResources();
		expect(resources.resources).toEqual([]);
		expect(MCP_WORKFLOW_TEXT).toContain("## Backlog.md Overview (MCP)");

		await server.stop();
	});

	it("createMcpServer wires stdio-ready instance", async () => {
		TEST_DIR = createUniqueTestDir("mcp-server-factory");

		const bootstrap = new McpServer(TEST_DIR);
		await bootstrap.filesystem.ensureBacklogStructure();
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await bootstrap.initializeProject("Factory Project");
		await bootstrap.stop();

		const server = await createMcpServer(TEST_DIR);

		const tools = await server.testInterface.listTools();
		expect(tools.tools.map((tool) => tool.name)).toEqual([
			"read_backlog_instructions",
			"task_create",
			"task_list",
			"task_search",
			"task_edit",
			"task_view",
			"task_archive",
		]);

		const resources = await server.testInterface.listResources();
		expect(resources.resources).toEqual([]);
		expect(MCP_WORKFLOW_TEXT).toContain("## Backlog.md Overview (MCP)");

		await server.connect();
		await server.start();
		await server.stop();
		await safeCleanup(TEST_DIR);
	});
});
