import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { JsonSchema } from "../mcp/validation/validators.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let testDir: string;
let server: McpServer;

function getText(content: unknown[] | undefined): string {
	return (content ?? [])
		.map((item) => (item as { text?: string }).text ?? "")
		.filter(Boolean)
		.join("\n\n");
}

describe("MCP task type filtering adapter", () => {
	beforeEach(async () => {
		testDir = createUniqueTestDir("mcp-task-type-filtering");
		server = new McpServer(testDir, "Test instructions");
		await server.filesystem.ensureBacklogStructure();
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();
		await initializeTestProject(server, "MCP Type Filter Project");

		const config = await server.filesystem.loadConfig();
		if (!config) throw new Error("Expected test config");
		config.types = [" Bug ", "Epic", "bug", ""];
		await server.filesystem.saveConfig(config);
		registerTaskTools(server, config);

		for (const args of [
			{ title: "Typed bug", type: "bug", status: "To Do" },
			{ title: "Typed epic", type: "epic", status: "In Progress" },
			{ title: "Untyped legacy", status: "To Do" },
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

	it("exposes configured type arrays in list and search schemas", async () => {
		const tools = await server.testInterface.listTools();
		const byName = new Map(tools.tools.map((tool) => [tool.name, tool]));
		for (const toolName of ["task_list", "task_search"]) {
			const schema = byName.get(toolName)?.inputSchema as JsonSchema | undefined;
			const typeFilter = schema?.properties?.type;
			expect(typeFilter?.type).toBe("array");
			expect(typeFilter?.items?.enum).toEqual(["Bug", "Epic"]);
			expect(typeFilter?.items?.enumCaseInsensitive).toBe(true);
		}
	});

	it("reuses OR filtering and canonical casing for task_list", async () => {
		const bugResult = await server.testInterface.callTool({
			params: { name: "task_list", arguments: { type: ["BUG"] } },
		});
		const bugText = getText(bugResult.content);
		expect(bugText).toContain("Typed bug");
		expect(bugText).not.toContain("Typed epic");
		expect(bugText).not.toContain("Untyped legacy");

		const composedResult = await server.testInterface.callTool({
			params: { name: "task_list", arguments: { type: ["bug", "EPIC"], status: "To Do" } },
		});
		const composedText = getText(composedResult.content);
		expect(composedText).toContain("Typed bug");
		expect(composedText).not.toContain("Typed epic");
		expect(composedText).not.toContain("Untyped legacy");
	});

	it("supports type-only and text-plus-type task_search calls", async () => {
		const typeOnly = await server.testInterface.callTool({
			params: { name: "task_search", arguments: { type: ["Epic"] } },
		});
		const typeOnlyText = getText(typeOnly.content);
		expect(typeOnlyText).toContain("Typed epic");
		expect(typeOnlyText).not.toContain("Typed bug");
		expect(typeOnlyText).not.toContain("Untyped legacy");

		const searched = await server.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "Typed", type: ["bug"] } },
		});
		const searchedText = getText(searched.content);
		expect(searchedText).toContain("Typed bug");
		expect(searchedText).not.toContain("Typed epic");
	});

	it("validates filters against configured task types", async () => {
		const result = await server.testInterface.callTool({
			params: { name: "task_list", arguments: { type: ["feature"] } },
		});
		expect(result.isError).toBe(true);
		expect(getText(result.content)).toContain("must be one of: Bug, Epic");
	});

	it("applies the same type filter to drafts", async () => {
		for (const args of [
			{ title: "Bug draft", type: "Bug", status: "Draft" },
			{ title: "Epic draft", type: "Epic", status: "Draft" },
		]) {
			const result = await server.testInterface.callTool({
				params: { name: "task_create", arguments: args },
			});
			expect(result.isError).not.toBe(true);
		}

		const listed = await server.testInterface.callTool({
			params: { name: "task_list", arguments: { status: "Draft", type: ["Bug"] } },
		});
		const listedText = getText(listed.content);
		expect(listedText).toContain("Bug draft");
		expect(listedText).not.toContain("Epic draft");

		const searched = await server.testInterface.callTool({
			params: { name: "task_search", arguments: { query: "draft", status: "Draft", type: ["Epic"] } },
		});
		const searchedText = getText(searched.content);
		expect(searchedText).toContain("Epic draft");
		expect(searchedText).not.toContain("Bug draft");
	});
});
