import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/task-tools.ts";
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
		it("should throw error for unimplemented SSE transport", async () => {
			await expect(mcpServer.connect("sse")).rejects.toThrow("SSE transport not yet implemented");
		});

		it("should require transport before starting", async () => {
			await expect(mcpServer.start()).rejects.toThrow("No transport connected");
		});

		it("should throw error for unknown transport type", async () => {
			await expect(mcpServer.connect("unknown" as "stdio")).rejects.toThrow("Unknown transport type: unknown");
		});
	});

	describe("task tools integration", () => {
		beforeEach(() => {
			registerTaskTools(mcpServer);
		});

		it("should register task management tools", async () => {
			const result = await mcpServer.testInterface.listTools();
			const toolNames = result.tools.map((tool) => tool.name);

			expect(toolNames).toContain("task_create");
			expect(toolNames).toContain("task_list");
			expect(toolNames).toContain("task_update");
			expect(result.tools).toHaveLength(3);
		});

		it("should create task with task_create tool", async () => {
			const request = {
				params: {
					name: "task_create",
					arguments: {
						title: "Test Task",
						description: "A test task for validation",
						labels: ["test", "validation"],
						priority: "high",
					},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Successfully created task:");
			expect(result.content[0]?.text).toContain("task-");
		});

		it("should list tasks with task_list tool", async () => {
			// First create a task
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "First Task",
						description: "First test task",
						labels: ["test"],
					},
				},
			});

			// Then list tasks
			const request = {
				params: {
					name: "task_list",
					arguments: {},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Found 1 task(s):");
			expect(result.content[0]?.text).toContain("First Task");
		});

		it("should filter tasks by status", async () => {
			// Create tasks with different statuses
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: { title: "Ready Task" },
				},
			});

			await mcpServer.testInterface.callTool({
				params: {
					name: "task_update",
					arguments: { id: "task-1", status: "🚧 In Progress" },
				},
			});

			// Filter by status
			const request = {
				params: {
					name: "task_list",
					arguments: { status: "🚧 In Progress" },
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Found 1 task(s):");
			expect(result.content[0]?.text).toContain("🚧 In Progress");
		});

		it("should filter tasks by labels", async () => {
			// Create tasks with different labels
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Frontend Task",
						labels: ["frontend", "ui"],
					},
				},
			});

			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Backend Task",
						labels: ["backend", "api"],
					},
				},
			});

			// Filter by labels
			const request = {
				params: {
					name: "task_list",
					arguments: { labels: ["frontend"] },
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Found 1 task(s):");
			expect(result.content[0]?.text).toContain("Frontend Task");
		});

		it("should update task with task_update tool", async () => {
			// Create a task first
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: { title: "Original Title" },
				},
			});

			// Update the task
			const request = {
				params: {
					name: "task_update",
					arguments: {
						id: "task-1",
						title: "Updated Title",
						status: "✔ Done",
						description: "Updated description",
					},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Successfully updated task: task-1");

			// Verify update by listing
			const listResult = await mcpServer.testInterface.callTool({
				params: { name: "task_list", arguments: {} },
			});
			expect(listResult.content[0]?.text).toContain("Updated Title");
			expect(listResult.content[0]?.text).toContain("✔ Done");
		});

		it("should search tasks by title and description", async () => {
			// Create tasks with searchable content
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Authentication System",
						description: "Implement user login and registration",
					},
				},
			});

			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Database Migration",
						description: "Update database schema",
					},
				},
			});

			// Search by title
			const titleSearch = await mcpServer.testInterface.callTool({
				params: {
					name: "task_list",
					arguments: { search: "Authentication" },
				},
			});
			expect(titleSearch.content[0]?.text).toContain("Found 1 task(s):");
			expect(titleSearch.content[0]?.text).toContain("Authentication System");

			// Search by description
			const descSearch = await mcpServer.testInterface.callTool({
				params: {
					name: "task_list",
					arguments: { search: "schema" },
				},
			});
			expect(descSearch.content[0]?.text).toContain("Found 1 task(s):");
			expect(descSearch.content[0]?.text).toContain("Database Migration");
		});

		it("should handle errors gracefully for non-existent task updates", async () => {
			const request = {
				params: {
					name: "task_update",
					arguments: { id: "non-existent-task", title: "New Title" },
				},
			};

			await expect(mcpServer.testInterface.callTool(request)).rejects.toThrow("Task not found: non-existent-task");
		});

		it("should validate required fields for task creation", async () => {
			const request = {
				params: {
					name: "task_create",
					arguments: { description: "Missing title" },
				},
			};

			// This should work since our handler doesn't validate schema (that would be done by MCP layer)
			// But the title will be undefined, causing issues
			await expect(mcpServer.testInterface.callTool(request)).rejects.toThrow();
		});

		it("should limit task list results", async () => {
			// Create multiple tasks
			for (let i = 1; i <= 5; i++) {
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: `Task ${i}` },
					},
				});
			}

			// Request with limit
			const request = {
				params: {
					name: "task_list",
					arguments: { limit: 3 },
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Found 3 task(s):");
		});

		it("should handle task creation with parent task", async () => {
			// Create parent task
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: { title: "Parent Task" },
				},
			});

			// Create subtask
			const request = {
				params: {
					name: "task_create",
					arguments: {
						title: "Subtask",
						parentTaskId: "task-1",
					},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Successfully created task:");
		});

		it("should update task implementation notes", async () => {
			// Create task
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: { title: "Implementation Task" },
				},
			});

			// Update with implementation notes
			const request = {
				params: {
					name: "task_update",
					arguments: {
						id: "task-1",
						implementationNotes: "Added user authentication flow",
					},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Successfully updated task: task-1");
		});
	});
});
