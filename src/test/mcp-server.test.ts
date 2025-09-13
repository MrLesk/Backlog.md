import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("McpServer", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-mcp-server");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("initialization", () => {
		it("should extend Core class and have all Core functionality", () => {
			expect(mcpServer.filesystem).toBeDefined();
			expect(mcpServer.gitOps).toBeDefined();
			expect(mcpServer.fs).toBeDefined();
			expect(mcpServer.git).toBeDefined();
		});

		it("should have MCP server instance", () => {
			const server = mcpServer.getServer();
			expect(server).toBeDefined();
		});

		it("should initialize with empty tools, resources, and prompts", async () => {
			const toolsResult = await mcpServer.testInterface.listTools();
			const resourcesResult = await mcpServer.testInterface.listResources();
			const promptsResult = await mcpServer.testInterface.listPrompts();

			expect(toolsResult.tools).toEqual([]);
			expect(resourcesResult.resources).toEqual([]);
			expect(promptsResult.prompts).toEqual([]);
		});
	});

	describe("tool management", () => {
		it("should allow adding tools and list them", async () => {
			const testTool = {
				name: "test-tool",
				description: "A test tool",
				inputSchema: { properties: {} },
				handler: async () => ({ content: [{ type: "text" as const, text: "test result" }] }),
			};

			mcpServer.addTool(testTool);

			const result = await mcpServer.testInterface.listTools();
			expect(result.tools).toHaveLength(1);
			expect(result.tools[0]?.name).toBe("test-tool");
			expect(result.tools[0]?.description).toBe("A test tool");
		});

		it("should call tools with proper arguments", async () => {
			let receivedArgs: Record<string, unknown> = {};
			const testTool = {
				name: "test-tool",
				description: "A test tool",
				inputSchema: { properties: { input: { type: "string" } } },
				handler: async (args: Record<string, unknown>) => {
					receivedArgs = args;
					return { content: [{ type: "text" as const, text: "success" }] };
				},
			};

			mcpServer.addTool(testTool);

			const request = {
				params: {
					name: "test-tool",
					arguments: { input: "test-value" },
				},
			};

			await mcpServer.testInterface.callTool(request);
			expect(receivedArgs).toEqual({ input: "test-value" });
		});

		it("should throw error for non-existent tools", async () => {
			const request = {
				params: {
					name: "non-existent-tool",
					arguments: {},
				},
			};

			await expect(mcpServer.testInterface.callTool(request)).rejects.toThrow("Tool not found: non-existent-tool");
		});
	});

	describe("resource management", () => {
		it("should allow adding resources and list them", async () => {
			const testResource = {
				uri: "test://resource",
				name: "Test Resource",
				description: "A test resource",
				mimeType: "text/plain",
				handler: async () => ({ contents: [{ uri: "test://resource", text: "test content" }] }),
			};

			mcpServer.addResource(testResource);

			const result = await mcpServer.testInterface.listResources();
			expect(result.resources).toHaveLength(1);
			expect(result.resources[0]?.uri).toBe("test://resource");
			expect(result.resources[0]?.name).toBe("Test Resource");
		});

		it("should read resources", async () => {
			const testResource = {
				uri: "test://resource",
				handler: async () => ({ contents: [{ uri: "test://resource", text: "test content" }] }),
			};

			mcpServer.addResource(testResource);

			const request = { params: { uri: "test://resource" } };
			const result = await mcpServer.testInterface.readResource(request);

			expect(result.contents).toHaveLength(1);
			expect(result.contents[0]?.text).toBe("test content");
		});

		it("should throw error for non-existent resources", async () => {
			const request = { params: { uri: "non-existent://resource" } };
			await expect(mcpServer.testInterface.readResource(request)).rejects.toThrow(
				"Resource not found: non-existent://resource",
			);
		});
	});

	describe("prompt management", () => {
		it("should allow adding prompts and list them", async () => {
			const testPrompt = {
				name: "test-prompt",
				description: "A test prompt",
				arguments: [{ name: "input", description: "Input parameter", required: true }],
				handler: async () => ({ description: "Test prompt", messages: [] }),
			};

			mcpServer.addPrompt(testPrompt);

			const result = await mcpServer.testInterface.listPrompts();
			expect(result.prompts).toHaveLength(1);
			expect(result.prompts[0]?.name).toBe("test-prompt");
			expect(result.prompts[0]?.description).toBe("A test prompt");
		});

		it("should get prompts with arguments", async () => {
			let receivedArgs: Record<string, unknown> = {};
			const testPrompt = {
				name: "test-prompt",
				description: "A test prompt",
				handler: async (args: Record<string, unknown>) => {
					receivedArgs = args;
					return { description: "Test prompt", messages: [] };
				},
			};

			mcpServer.addPrompt(testPrompt);

			const request = {
				params: {
					name: "test-prompt",
					arguments: { input: "test-value" },
				},
			};

			await mcpServer.testInterface.getPrompt(request);
			expect(receivedArgs).toEqual({ input: "test-value" });
		});

		it("should throw error for non-existent prompts", async () => {
			const request = {
				params: {
					name: "non-existent-prompt",
					arguments: {},
				},
			};

			await expect(mcpServer.testInterface.getPrompt(request)).rejects.toThrow("Prompt not found: non-existent-prompt");
		});
	});

	describe("transport methods", () => {
		it("should throw error for connect method (not yet implemented)", async () => {
			await expect(mcpServer.connect("stdio")).rejects.toThrow("Transport stdio is not yet implemented");
			await expect(mcpServer.connect("sse")).rejects.toThrow("Transport sse is not yet implemented");
		});

		it("should throw error for start method (not yet implemented)", async () => {
			await expect(mcpServer.start()).rejects.toThrow("MCP server start method is not yet implemented");
		});
	});
});
