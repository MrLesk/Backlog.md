import { afterEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import {
	MCP_TASK_COMPLETION_GUIDE,
	MCP_TASK_CREATION_GUIDE,
	MCP_TASK_EXECUTION_GUIDE,
	MCP_WORKFLOW_OVERVIEW,
} from "../guidelines/mcp/index.ts";
import { registerWorkflowResources } from "../mcp/resources/workflow/index.ts";
import { createMcpServer, McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

async function bootstrapServer(): Promise<McpServer> {
	TEST_DIR = createUniqueTestDir("mcp-server");
	// Use normal mode instructions for bootstrapped test server
	const server = new McpServer(TEST_DIR, "Test instructions");

	await server.filesystem.ensureBacklogStructure();
	await $`git init -b main`.cwd(TEST_DIR).quiet();
	await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
	await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

	await server.initializeProject("Test Project");

	// Register workflow resources manually (normally done in createMcpServer)
	registerWorkflowResources(server);

	return server;
}

describe("McpServer bootstrap", () => {
	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("exposes core capabilities before registration", async () => {
		const server = await bootstrapServer();

		const tools = await server.testInterface.listTools();
		expect(tools.tools.map((tool) => tool.name)).toEqual([]);

		const resources = await server.testInterface.listResources();
		expect(resources.resources.map((r) => r.uri)).toEqual([
			"backlog://workflow/overview",
			"backlog://workflow/task-creation",
			"backlog://workflow/task-execution",
			"backlog://workflow/task-completion",
		]);

		const prompts = await server.testInterface.listPrompts();
		expect(prompts.prompts).toEqual([]);

		const resourceTemplates = await server.testInterface.listResourceTemplates();
		expect(resourceTemplates.resourceTemplates).toEqual([]);

		await server.stop();
	});

	it("workflow overview resource returns correct content", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://workflow/overview" },
		});

		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]?.text).toBe(MCP_WORKFLOW_OVERVIEW);
		expect(result.contents[0]?.mimeType).toBe("text/markdown");

		await server.stop();
	});

	it("task creation guide resource returns correct content", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://workflow/task-creation" },
		});

		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]?.text).toBe(MCP_TASK_CREATION_GUIDE);

		await server.stop();
	});

	it("task execution guide resource returns correct content", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://workflow/task-execution" },
		});

		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]?.text).toBe(MCP_TASK_EXECUTION_GUIDE);

		await server.stop();
	});

	it("task completion guide resource returns correct content", async () => {
		const server = await bootstrapServer();

		const result = await server.testInterface.readResource({
			params: { uri: "backlog://workflow/task-completion" },
		});

		expect(result.contents).toHaveLength(1);
		expect(result.contents[0]?.text).toBe(MCP_TASK_COMPLETION_GUIDE);

		await server.stop();
	});

	it("registers task tools via helpers", async () => {
		const server = await bootstrapServer();
		const config = await server.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load config");
		}

		registerTaskTools(server, config);

		const tools = await server.testInterface.listTools();
		const toolNames = tools.tools.map((tool) => tool.name).sort();
		expect(toolNames).toEqual(["task_archive", "task_create", "task_edit", "task_list", "task_search", "task_view"]);

		const resources = await server.testInterface.listResources();
		expect(resources.resources.map((r) => r.uri)).toEqual([
			"backlog://workflow/overview",
			"backlog://workflow/task-creation",
			"backlog://workflow/task-execution",
			"backlog://workflow/task-completion",
		]);
		expect(MCP_WORKFLOW_OVERVIEW).toContain("## Backlog.md Overview (MCP)");

		const resourceTemplates = await server.testInterface.listResourceTemplates();
		expect(resourceTemplates.resourceTemplates).toEqual([]);

		await server.stop();
	});

	it("createMcpServer wires stdio-ready instance", async () => {
		TEST_DIR = createUniqueTestDir("mcp-server-factory");

		const bootstrap = new McpServer(TEST_DIR, "Bootstrap instructions");
		await bootstrap.filesystem.ensureBacklogStructure();
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await bootstrap.initializeProject("Factory Project");
		await bootstrap.stop();

		const server = await createMcpServer(TEST_DIR);

		const tools = await server.testInterface.listTools();
		expect(tools.tools.map((tool) => tool.name)).toEqual([
			"task_create",
			"task_list",
			"task_search",
			"task_edit",
			"task_view",
			"task_archive",
		]);

		const resources = await server.testInterface.listResources();
		expect(resources.resources.map((r) => r.uri)).toEqual([
			"backlog://workflow/overview",
			"backlog://workflow/task-creation",
			"backlog://workflow/task-execution",
			"backlog://workflow/task-completion",
		]);
		expect(MCP_WORKFLOW_OVERVIEW).toContain("## Backlog.md Overview (MCP)");

		const resourceTemplates = await server.testInterface.listResourceTemplates();
		expect(resourceTemplates.resourceTemplates).toEqual([]);

		await server.connect();
		await server.start();
		await server.stop();
		await safeCleanup(TEST_DIR);
	});
});
