import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerDecisionTools } from "../mcp/tools/decisions/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const getText = (content: unknown[] | undefined, index = 0): string => {
	const item = content?.[index] as { text?: string } | undefined;
	return item?.text ?? "";
};

let TEST_DIR: string;
let server: McpServer;

async function loadConfigOrThrow(mcpServer: McpServer) {
	const config = await mcpServer.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load config");
	}
	return config;
}

describe("MCP decision tools", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-decisions");
		server = new McpServer(TEST_DIR, "Test instructions");
		await server.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await initializeTestProject(server, "Decisions Project");
		registerDecisionTools(server, await loadConfigOrThrow(server));
	});

	afterEach(async () => {
		try {
			await server.stop();
		} catch {
			// ignore shutdown issues in tests
		}
		await safeCleanup(TEST_DIR);
	});

	it("creates and lists decisions", async () => {
		const createResult = await server.testInterface.callTool({
			params: {
				name: "decision_create",
				arguments: {
					title: "Adopt ADRs",
					content: "## Context\n\nWe need durable architecture records.",
				},
			},
		});

		const createText = getText(createResult.content);
		expect(createText).toContain("Decision created successfully.");
		expect(createText).toContain("Decision decision-1 - Adopt ADRs");
		expect(createText).toContain("We need durable architecture records.");

		const listResult = await server.testInterface.callTool({
			params: { name: "decision_list", arguments: {} },
		});

		const listText = getText(listResult.content);
		expect(listText).toContain("Decisions:");
		expect(listText).toContain("decision-1 - Adopt ADRs");
	});

	it("views decisions regardless of ID casing or padding", async () => {
		await server.testInterface.callTool({
			params: {
				name: "decision_create",
				arguments: {
					title: "Use SQLite",
					content: "## Decision\n\nUse SQLite for local storage.",
				},
			},
		});

		const withPrefix = await server.testInterface.callTool({
			params: { name: "decision_view", arguments: { id: "decision-1" } },
		});
		const withoutPrefix = await server.testInterface.callTool({
			params: { name: "decision_view", arguments: { id: "1" } },
		});
		const uppercase = await server.testInterface.callTool({
			params: { name: "decision_view", arguments: { id: "DECISION-0001" } },
		});

		expect(getText(withPrefix.content)).toContain("Decision decision-1 - Use SQLite");
		expect(getText(withoutPrefix.content)).toContain("Decision decision-1 - Use SQLite");
		expect(getText(uppercase.content)).toContain("Decision decision-1 - Use SQLite");
	});

	it("updates decisions including title changes", async () => {
		await server.testInterface.callTool({
			params: {
				name: "decision_create",
				arguments: {
					title: "Initial Storage",
					content: "## Decision\n\nUse files.",
				},
			},
		});

		const updateResult = await server.testInterface.callTool({
			params: {
				name: "decision_update",
				arguments: {
					id: "DECISION-0001",
					title: "Storage Strategy",
					content: "## Context\n\nNeed persistence.\n\n## Decision\n\nUse files with frontmatter.",
				},
			},
		});

		const updateText = getText(updateResult.content);
		expect(updateText).toContain("Decision updated successfully.");
		expect(updateText).toContain("Decision decision-1 - Storage Strategy");
		expect(updateText).toContain("Use files with frontmatter.");

		const viewResult = await server.testInterface.callTool({
			params: { name: "decision_view", arguments: { id: "1" } },
		});
		expect(getText(viewResult.content)).toContain("Decision decision-1 - Storage Strategy");
	});

	it("searches decisions and includes formatted scores", async () => {
		await server.testInterface.callTool({
			params: {
				name: "decision_create",
				arguments: {
					title: "Architecture Records",
					content: "Contains topology and architecture rationale.",
				},
			},
		});

		const searchResult = await server.testInterface.callTool({
			params: {
				name: "decision_search",
				arguments: { query: "architecture" },
			},
		});

		const searchText = getText(searchResult.content);
		expect(searchText).toContain("Decisions:");
		expect(searchText).toContain("decision-1 - Architecture Records");
		expect(searchText).toContain("[score ");
	});

	it("persists supplied create content instead of generated placeholders", async () => {
		await server.testInterface.callTool({
			params: {
				name: "decision_create",
				arguments: {
					title: "Preserve Body",
					content: "# Custom Decision\n\nA free-form markdown body.",
				},
			},
		});

		const content = await server.getDecisionContent("decision-1");
		expect(content).toContain("# Custom Decision");
		expect(content).toContain("A free-form markdown body.");
		expect(content).not.toContain("[Describe the context and problem that needs to be addressed]");
	});
});
