import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { createUniqueTestDir, safeCleanup } from "../../../test/test-utils.ts";
import { McpServer } from "../../server.ts";
import { registerDocumentTools } from "../../tools/document-tools.ts";

let TEST_DIR: string;

describe("Document Tools", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-document-tools");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize the project to create config
		await mcpServer.initializeProject("Test Project");

		registerDocumentTools(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("tool registration", () => {
		it("should register document management tools", async () => {
			const result = await mcpServer.testInterface.listTools();
			const toolNames = result.tools.map((tool) => tool.name);

			expect(toolNames).toContain("doc_create");
			expect(toolNames).toContain("doc_list");
			expect(toolNames).toContain("doc_view");
		});

		it("should have proper tool schemas", async () => {
			const result = await mcpServer.testInterface.listTools();
			const docCreateTool = result.tools.find((tool) => tool.name === "doc_create");
			const docListTool = result.tools.find((tool) => tool.name === "doc_list");
			const docViewTool = result.tools.find((tool) => tool.name === "doc_view");

			expect(docCreateTool).toBeDefined();
			expect(docCreateTool?.description).toContain("Create a new document");
			expect(docCreateTool?.inputSchema).toBeDefined();

			expect(docListTool).toBeDefined();
			expect(docListTool?.description).toContain("List all documents");
			expect(docListTool?.inputSchema).toBeDefined();

			expect(docViewTool).toBeDefined();
			expect(docViewTool?.description).toContain("Get complete document content");
			expect(docViewTool?.inputSchema).toBeDefined();
		});
	});

	describe("doc_create", () => {
		it("should create a document with basic info", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "Test Document",
						content: "This is a test document content",
						type: "guide",
						tags: ["test", "example"],
					},
				},
			});

			expect(result.isError).toBeFalsy();
			expect(result.content[0]?.text).toContain("Document created successfully");
			expect(result.content[0]?.text).toMatch(/doc-\d+/);
		});

		it("should create a document with minimal required fields", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "Minimal Document",
						content: "Minimal content",
					},
				},
			});

			expect(result.isError).toBeFalsy();
			expect(result.content[0]?.text).toContain("Document created successfully");
		});

		it("should validate required fields", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						content: "Content without title",
					},
				},
			});

			expect(result.isError).toBeTruthy();
		});

		it("should validate document type", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "Invalid Type Document",
						content: "Content",
						type: "invalid_type",
					},
				},
			});

			expect(result.isError).toBeTruthy();
		});

		it("should limit tags count", async () => {
			const tooManyTags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "Too Many Tags",
						content: "Content",
						tags: tooManyTags,
					},
				},
			});

			expect(result.isError).toBeTruthy();
		});
	});

	describe("doc_list", () => {
		beforeEach(async () => {
			// Create test documents
			await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "Guide Document",
						content: "This is a guide",
						type: "guide",
						tags: ["tutorial", "guide"],
					},
				},
			});

			await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "README Document",
						content: "This is a readme",
						type: "readme",
						tags: ["documentation"],
					},
				},
			});

			await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "Specification Document",
						content: "This is a specification",
						type: "specification",
						tags: ["spec", "api"],
					},
				},
			});
		});

		it("should list all documents", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_list",
					arguments: {},
				},
			});

			expect(result.isError).toBeFalsy();
			const text = result.content[0]?.text as string;
			expect(typeof text).toBe("string");
			// Should be simple format: "id - title" per line
			if (text.trim()) {
				const lines = text.split("\n");
				expect(lines.length).toBeGreaterThan(0);
				// Each line should match "doc-XXX - Title" format
				for (const line of lines) {
					expect(line).toMatch(/^doc-\d+\s+-\s+.+$/);
				}
			}
		});

		// REMOVED: Tests for unauthorized filtering and pagination features
		// These features exceeded CLI capabilities and have been removed for architecture compliance

		// it("should filter by type", async () => {
		// it("should filter by tags", async () => {
		// it("should support pagination", async () => {
		// it("should include document summaries with metadata", async () => {
	});

	describe("doc_view", () => {
		let documentId: string;

		beforeEach(async () => {
			// Create a test document and extract its ID
			const createResult = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "View Test Document",
						content: "This is a document for viewing tests.\n\nIt has multiple lines.",
						type: "specification",
						tags: ["test", "view"],
					},
				},
			});

			expect(createResult.isError).toBeFalsy();
			const match = (createResult.content[0]?.text as string).match(/doc-\d+/);
			expect(match).toBeTruthy();
			documentId = match?.[0] || "";
		});

		it("should view a document by ID", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_view",
					arguments: {
						id: documentId,
					},
				},
			});

			expect(result.isError).toBeFalsy();
			const data = JSON.parse(result.content[0]?.text as string);

			expect(data.id).toBe(documentId);
			expect(data.title).toBe("View Test Document");
			expect(data.type).toBe("specification");
			expect(data.content).toContain("This is a document for viewing tests");
			expect(data.tags).toEqual(["test", "view"]);
			// Removed metadata checks - simplified to match CLI capabilities
		});

		it("should handle non-existent document", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_view",
					arguments: {
						id: "doc-nonexistent",
					},
				},
			});

			expect(result.isError).toBeTruthy();
			expect(result.content[0]?.text).toContain("Error viewing document");
		});

		it("should validate required ID parameter", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_view",
					arguments: {},
				},
			});

			expect(result.isError).toBeTruthy();
		});
	});

	describe("integration with filesystem", () => {
		it("should persist documents to filesystem", async () => {
			await mcpServer.testInterface.callTool({
				params: {
					name: "doc_create",
					arguments: {
						title: "Persistence Test",
						content: "This document should be saved to filesystem",
						type: "other",
					},
				},
			});

			// Verify the document exists in filesystem
			const documents = await mcpServer.fs.listDocuments();
			const persistedDoc = documents.find((doc) => doc.title === "Persistence Test");

			expect(persistedDoc).toBeDefined();
			expect(persistedDoc?.type).toBe("other");
			expect(persistedDoc?.body).toContain("This document should be saved to filesystem");
		});

		it("should integrate with existing filesystem operations", async () => {
			// Create document via filesystem
			const testDoc = {
				id: "doc-filesystem-test",
				title: "Filesystem Created Document",
				type: "guide" as const,
				createdDate: new Date().toISOString().slice(0, 16).replace("T", " "),
				body: "Created directly via filesystem",
				tags: ["filesystem"],
			};

			await mcpServer.fs.saveDocument(testDoc);

			// Verify it appears in doc_list
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "doc_list",
					arguments: {},
				},
			});

			expect(result.isError).toBeFalsy();
			const text = result.content[0]?.text as string;

			// Should find the document in simple text format: "doc-filesystem-test - Filesystem Created Document"
			expect(text).toContain("doc-filesystem-test - Filesystem Created Document");
		});
	});
});
