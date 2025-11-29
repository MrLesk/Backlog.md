import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

// Helper to extract text from MCP content (handles union types)
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

describe("MCP document tools", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDir("mcp-documents");
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();

		await mcpServer.initializeProject("Docs Project");
		const config = await loadConfig(mcpServer);
		registerDocumentTools(mcpServer, config);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
		} catch {
			// ignore shutdown issues in tests
		}
		await safeCleanup(TEST_DIR);
	});

	it("creates and lists documents", async () => {
		const createResult = await mcpServer.testInterface.callTool({
			params: {
				name: "document_create",
				arguments: {
					title: "Engineering Guidelines",
					content: "# Overview\n\nFollow the documented practices.",
				},
			},
		});

		const createText = getText(createResult.content);
		expect(createText).toContain("Document created successfully.");
		expect(createText).toContain("Document doc-1 - Engineering Guidelines");
		expect(createText).toContain("# Overview");

		const listResult = await mcpServer.testInterface.callTool({
			params: { name: "document_list", arguments: {} },
		});

		const listText = getText(listResult.content);
		expect(listText).toContain("Documents:");
		expect(listText).toContain("doc-1 - Engineering Guidelines");
		expect(listText).toContain("tags: (none)");
	});

	it("filters documents using substring search", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "document_create",
				arguments: {
					title: "Engineering Guidelines",
					content: "Content",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "document_create",
				arguments: {
					title: "Product Strategy",
					content: "Strategy content",
				},
			},
		});

		const filteredResult = await mcpServer.testInterface.callTool({
			params: { name: "document_list", arguments: { search: "strat" } },
		});

		const filteredText = getText(filteredResult.content);
		expect(filteredText).toContain("Documents:");
		expect(filteredText).toContain("Product Strategy");
		expect(filteredText).not.toContain("Engineering Guidelines");
	});

	it("views documents regardless of ID casing or padding", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "document_create",
				arguments: {
					title: "Runbook",
					content: "Step 1: Do the thing.",
				},
			},
		});

		const withPrefix = await mcpServer.testInterface.callTool({
			params: { name: "document_view", arguments: { id: "doc-1" } },
		});
		const withoutPrefix = await mcpServer.testInterface.callTool({
			params: { name: "document_view", arguments: { id: "1" } },
		});
		const uppercase = await mcpServer.testInterface.callTool({
			params: { name: "document_view", arguments: { id: "DOC-0001" } },
		});
		const zeroPadded = await mcpServer.testInterface.callTool({
			params: { name: "document_view", arguments: { id: "0001" } },
		});

		const prefixText = getText(withPrefix.content);
		const noPrefixText = getText(withoutPrefix.content);
		const uppercaseText = getText(uppercase.content);
		const zeroPaddedText = getText(zeroPadded.content);
		expect(prefixText).toContain("Document doc-1 - Runbook");
		expect(prefixText).toContain("Step 1: Do the thing.");
		expect(noPrefixText).toContain("Document doc-1 - Runbook");
		expect(uppercaseText).toContain("Document doc-1 - Runbook");
		expect(zeroPaddedText).toContain("Document doc-1 - Runbook");
	});

	it("updates documents including title changes", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "document_create",
				arguments: {
					title: "Incident Response",
					content: "Initial content",
				},
			},
		});

		const updateResult = await mcpServer.testInterface.callTool({
			params: {
				name: "document_update",
				arguments: {
					id: "DOC-0001",
					title: "Incident Response Handbook",
					content: "Updated procedures",
				},
			},
		});

		const updateText = getText(updateResult.content);
		expect(updateText).toContain("Document updated successfully.");
		expect(updateText).toContain("Document doc-1 - Incident Response Handbook");
		expect(updateText).toContain("Updated procedures");

		const viewResult = await mcpServer.testInterface.callTool({
			params: { name: "document_view", arguments: { id: "doc-1" } },
		});
		const viewText = getText(viewResult.content);
		expect(viewText).toContain("Incident Response Handbook");
		expect(viewText).toContain("Updated procedures");
	});

	it("searches documents and includes formatted scores", async () => {
		await mcpServer.testInterface.callTool({
			params: {
				name: "document_create",
				arguments: {
					title: "Architecture Overview",
					content: "Contains service topology details.",
				},
			},
		});

		const searchResult = await mcpServer.testInterface.callTool({
			params: {
				name: "document_search",
				arguments: {
					query: "architecture",
				},
			},
		});

		const searchText = getText(searchResult.content);
		expect(searchText).toContain("Documents:");
		expect(searchText).toMatch(/Architecture Overview/);
		expect(searchText).toMatch(/\[score [0-1]\.\d{3}]/);
	});
});
