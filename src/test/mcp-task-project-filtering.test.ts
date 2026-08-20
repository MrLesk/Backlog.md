import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { JsonSchema } from "../mcp/validation/validators.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let testDir: string;
let server: McpServer;

function getText(content: unknown[] | undefined): string {
	return (content ?? [])
		.map((item) => (item as { text?: string }).text ?? "")
		.filter(Boolean)
		.join("\n\n");
}

describe("MCP task project filtering adapter", () => {
	beforeEach(async () => {
		testDir = createUniqueTestDir("mcp-task-project-filtering");
		server = new McpServer(testDir, "Test instructions");
		await server.filesystem.ensureBacklogStructure();
		await initializeFilesystemTestProject(server, "MCP Project Filter Project");

		const config = await server.filesystem.loadConfig();
		if (!config) throw new Error("Expected test config");
		config.projects = [" Web ", "API", "web", ""];
		await server.filesystem.saveConfig(config);
		registerTaskTools(server, config);

		for (const args of [
			{ title: "Web bug", project: "web", status: "To Do" },
			{ title: "API epic", project: "api", status: "In Progress" },
			{ title: "Unprojected legacy", status: "To Do" },
		]) {
			const result = await server.testInterface.callTool({
				params: { name: "task_create", arguments: args },
			});
			expect(result.isError).not.toBe(true);
		}
	});

	afterEach(async () => {
		const stopResult = await Promise.allSettled([server.stop()]);
		const cleanupResult = await Promise.allSettled([safeCleanup(testDir)]);
		const errors = [...stopResult, ...cleanupResult]
			.filter((result): result is PromiseRejectedResult => result.status === "rejected")
			.map((result) => result.reason);
		if (errors.length === 1) throw errors[0];
		if (errors.length > 1) throw new AggregateError(errors, "MCP server and fixture cleanup both failed");
	});

	it("exposes configured project arrays in list and search schemas", async () => {
		const tools = await server.testInterface.listTools();
		const byName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		for (const toolName of ["task_list", "task_search"]) {
			const schema = byName.get(toolName)?.inputSchema as JsonSchema | undefined;
			const projectFilter = schema?.properties?.project;
			expect(projectFilter?.type).toBe("array");
			expect(projectFilter?.items?.enum).toEqual(["Web", "API"]);
			expect(projectFilter?.items?.enumCaseInsensitive).toBe(true);
		}
	});

	it("reuses OR filtering and canonical casing for task_list", async () => {
		const webResult = await server.testInterface.callTool({
			params: { name: "task_list", arguments: { project: ["WEB"] } },
		});
		const webText = getText(webResult.content);
		expect(webText).toContain("Web bug");
		expect(webText).not.toContain("API epic");
		expect(webText).not.toContain("Unprojected legacy");

		const composedResult = await server.testInterface.callTool({
			params: { name: "task_list", arguments: { project: ["web", "API"], status: "To Do" } },
		});
		const composedText = getText(composedResult.content);
		expect(composedText).toContain("Web bug");
		expect(composedText).not.toContain("API epic");
		expect(composedText).not.toContain("Unprojected legacy");
	});

	it("supports project-only and text-plus-project task_search calls", async () => {
		const projectOnly = await server.testInterface.callTool({
			params: { name: "task_search", arguments: { project: ["API"] } },
		});
		const projectOnlyText = getText(projectOnly.content);
		expect(projectOnlyText).toContain("API epic");
		expect(projectOnlyText).not.toContain("Web bug");
		expect(projectOnlyText).not.toContain("Unprojected legacy");

		const searched = await server.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "bug", project: ["web"] } },
		});
		const searchedText = getText(searched.content);
		expect(searchedText).toContain("Web bug");
		expect(searchedText).not.toContain("API epic");
	});

	it("validates filters against configured projects", async () => {
		const result = await server.testInterface.callTool({
			params: { name: "task_list", arguments: { project: ["mobile"] } },
		});
		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("must be one of: Web, API");
	});

	it("applies the same project filter to drafts", async () => {
		for (const args of [
			{ title: "Web draft", project: "Web", status: "Draft" },
			{ title: "API draft", project: "API", status: "Draft" },
		]) {
			const result = await server.testInterface.callTool({
				params: { name: "task_create", arguments: args },
			});
			expect(result.isError).not.toBe(true);
		}

		const listed = await server.testInterface.callTool({
			params: { name: "task_list", arguments: { status: "Draft", project: ["Web"] } },
		});
		const listedText = getText(listed.content);
		expect(listedText).toContain("Web draft");
		expect(listedText).not.toContain("API draft");

		const searched = await server.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "draft", status: "Draft", project: ["API"] } },
		});
		const searchedText = getText(searched.content);
		expect(searchedText).toContain("API draft");
		expect(searchedText).not.toContain("Web draft");
	});
});
