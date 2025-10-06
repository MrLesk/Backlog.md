import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { registerDataResources } from "../mcp/resources/data-resources.ts";
import { McpServer } from "../mcp/server.ts";
import { registerDecisionTools } from "../mcp/tools/decision-tools.ts";
import { registerDocumentTools } from "../mcp/tools/document-tools.ts";
import { registerDraftTools } from "../mcp/tools/draft-tools.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Data Resources Filtering", () => {
	let mcpServer: McpServer;

	beforeAll(async () => {
		TEST_DIR = createUniqueTestDir("test-filtering-data-resources");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		// Initialize the project to create config
		await mcpServer.initializeProject("Test Project");

		// Load config for dynamic schema generation
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load config");
		}

		registerDataResources(mcpServer);
		registerDraftTools(mcpServer, config);
		registerDocumentTools(mcpServer);
		registerDecisionTools(mcpServer);

		// Create some test data using MCP tools
		await mcpServer.testInterface.callTool({
			params: {
				name: "draft_create",
				arguments: {
					title: "Test Draft 1",
					description: "A test draft for filtering",
					assignee: ["alice"],
					labels: ["feature", "ui"],
					priority: "high",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "draft_create",
				arguments: {
					title: "Another Draft",
					description: "Second draft for testing",
					assignee: ["bob"],
					labels: ["bug"],
					priority: "medium",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "doc_create",
				arguments: {
					title: "Test Document",
					content: "This is a test document content",
					type: "guide",
					tags: ["documentation", "api"],
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "doc_create",
				arguments: {
					title: "API Reference",
					content: "API documentation content",
					type: "specification",
					tags: ["api"],
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "decision_create",
				arguments: {
					title: "Architecture Decision",
					context: "Need to choose database technology",
					decision: "Use PostgreSQL for primary database",
					status: "accepted",
				},
			},
		});

		await mcpServer.testInterface.callTool({
			params: {
				name: "decision_create",
				arguments: {
					title: "UI Framework",
					context: "Choose frontend framework",
					decision: "Use React for component library",
					status: "proposed",
				},
			},
		});
	});

	afterAll(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("drafts/list filtering", () => {
		it("should filter drafts by assignee", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://drafts/list?assignee=alice" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.drafts).toHaveLength(1);
			expect(response.drafts[0].title).toBe("Test Draft 1");
			expect(response.metadata.filters.assignee).toBe("alice");
		});

		it("should filter drafts by search term", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://drafts/list?search=filtering" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.drafts).toHaveLength(1);
			expect(response.drafts[0].title).toBe("Test Draft 1");
			expect(response.metadata.filters.search).toBe("filtering");
		});

		it("should filter drafts by labels", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://drafts/list?labels=feature,ui" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.drafts).toHaveLength(1);
			expect(response.drafts[0].title).toBe("Test Draft 1");
			expect(response.metadata.filters.labels).toEqual(["feature", "ui"]);
		});

		it("should apply limit parameter", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://drafts/list?limit=1" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.drafts).toHaveLength(1);
			expect(response.metadata.filters.limit).toBe(1);
		});
	});

	describe("docs/list filtering", () => {
		it("should filter documents by type", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://docs/list?type=guide" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.documents).toHaveLength(1);
			expect(response.documents[0].title).toBe("Test Document");
			expect(response.metadata.filters.type).toBe("guide");
		});

		it("should filter documents by search term", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://docs/list?search=test" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.documents).toHaveLength(1); // Only "Test Document" contains "test"
			expect(response.metadata.filters.search).toBe("test");
		});

		it("should filter documents by tags", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://docs/list?tags=documentation" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.documents).toHaveLength(1);
			expect(response.documents[0].title).toBe("Test Document");
			expect(response.metadata.filters.tags).toEqual(["documentation"]);
		});

		it("should support pagination with limit and offset", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://docs/list?limit=1&offset=1" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.documents).toHaveLength(1);
			expect(response.metadata.totalDocuments).toBe(2);
			expect(response.metadata.returned).toBe(1);
			expect(response.metadata.offset).toBe(1);
			expect(response.metadata.filters.limit).toBe(1);
			expect(response.metadata.filters.offset).toBe(1);
		});
	});

	describe("decisions/list filtering", () => {
		it("should filter decisions by status", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://decisions/list?status=accepted" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.decisions).toHaveLength(1);
			expect(response.decisions[0].title).toBe("Architecture Decision");
			expect(response.metadata.filters.status).toBe("accepted");
		});

		it("should filter decisions by search term", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://decisions/list?search=database" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.decisions).toHaveLength(1);
			expect(response.decisions[0].title).toBe("Architecture Decision");
			expect(response.metadata.filters.search).toBe("database");
		});

		it("should apply limit parameter", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://decisions/list?limit=1" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.decisions).toHaveLength(1);
			expect(response.metadata.filters.limit).toBe(1);
		});
	});

	describe("project/overview filtering", () => {
		it("should support teamFilter parameter", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://project/overview?teamFilter=alice" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.overview).toBeDefined();
			expect(response.filters.teamFilter).toEqual(["alice"]);
		});

		it("should support priorityFilter parameter", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: {
					uri: "backlog://project/overview?priorityFilter=high,medium",
				},
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.overview).toBeDefined();
			expect(response.filters.priorityFilter).toEqual(["high", "medium"]);
		});

		it("should return comprehensive overview data", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://project/overview" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.overview.projectName).toBe("Test Project");
			expect(response.overview.totalDrafts).toBe(2);
			expect(response.overview.totalDocuments).toBe(2);
			expect(response.overview.totalDecisions).toBe(2);
			expect(response.taskMetrics).toBeDefined();
			expect(response.distribution).toBeDefined();
			expect(response.quality).toBeDefined();
			expect(response.configuration).toBeDefined();
		});
	});

	describe("error handling", () => {
		it("should handle invalid limit values gracefully", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://drafts/list?limit=invalid" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.drafts).toHaveLength(2); // Should return all without limit
			expect(response.metadata.filters).not.toHaveProperty("limit");
		});

		it("should handle negative offset values", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://docs/list?offset=-1" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.documents).toHaveLength(2); // Should treat as offset=0
			expect(response.metadata.offset).toBe(0);
		});

		it("should cap limit at 1000", async () => {
			const result = await mcpServer.testInterface.readResource({
				params: { uri: "backlog://drafts/list?limit=2000" },
			});

			const response = JSON.parse((result.contents?.[0]?.text as string) || "{}");
			expect(response.metadata.filters.limit).toBe(1000);
		});
	});
});
