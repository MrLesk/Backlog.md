import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { JsonSchema } from "../mcp/validation/validators.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let TEST_DIR: string;
let mcpServer: McpServer;

async function loadConfig(server: McpServer) {
	const config = await server.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load backlog configuration for tests");
	}
	return config;
}

describe("MCP task references and documentation", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-refs-docs");
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await initializeTestProject(mcpServer, "Test Project");

		const config = await loadConfig(mcpServer);
		registerTaskTools(mcpServer, config);
	});

	afterEach(async () => {
		const stopResult = await Promise.allSettled([mcpServer.stop()]);
		const cleanupResult = await Promise.allSettled([safeCleanup(TEST_DIR)]);
		const errors = [...stopResult, ...cleanupResult]
			.filter((result): result is PromiseRejectedResult => result.status === "rejected")
			.map((result) => result.reason);
		if (errors.length === 1) throw errors[0];
		if (errors.length > 1) throw new AggregateError(errors, "MCP server and fixture cleanup both failed");
	});

	it("publishes references and documentation in task create and edit schemas", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const toolByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		const createSchema = toolByName.get("task_create")?.inputSchema as JsonSchema | undefined;
		const editSchema = toolByName.get("task_edit")?.inputSchema as JsonSchema | undefined;

		expect(createSchema?.properties?.references?.items?.type).toBe("string");
		expect(createSchema?.properties?.documentation?.items?.type).toBe("string");
		for (const field of [
			"references",
			"addReferences",
			"removeReferences",
			"documentation",
			"addDocumentation",
			"removeDocumentation",
		]) {
			expect(editSchema?.properties?.[field]?.items?.type).toBe("string");
		}
	});

	it("creates and persists references and documentation through the MCP adapter", async () => {
		const result = await mcpServer.testInterface.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Feature with supporting material",
					references: ["https://github.com/issue/123", "src/api.ts"],
					documentation: ["https://design-docs.example.com", "docs/spec.md"],
				},
			},
		});

		const text = getText(result.content);
		expect(text).toContain("Task TASK-1 - Feature with supporting material");
		expect(text).toContain("References: https://github.com/issue/123, src/api.ts");
		expect(text).toContain("Documentation: https://design-docs.example.com, docs/spec.md");

		const task = await mcpServer.getTask("task-1");
		expect(task?.references).toEqual(["https://github.com/issue/123", "src/api.ts"]);
		expect(task?.documentation).toEqual(["https://design-docs.example.com", "docs/spec.md"]);
	});

	it("routes reference and documentation set, add, and remove edits", async () => {
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Task to edit" } },
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					references: ["ref-1.ts", "ref-2.ts"],
					documentation: ["doc-1.md", "doc-2.md"],
				},
			},
		});
		await mcpServer.testInterface.callTool({
			params: {
				name: "task_edit",
				arguments: {
					id: "task-1",
					addReferences: ["ref-3.ts"],
					removeReferences: ["ref-2.ts"],
					addDocumentation: ["doc-3.md"],
					removeDocumentation: ["doc-2.md"],
				},
			},
		});

		const task = await mcpServer.getTask("task-1");
		expect(task?.references).toEqual(["ref-1.ts", "ref-3.ts"]);
		expect(task?.documentation).toEqual(["doc-1.md", "doc-3.md"]);
	});
});
