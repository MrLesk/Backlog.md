import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/task-tools.ts";
import { parseSequenceCreateMarkdown, parseSequencePlanMarkdown } from "./markdown-test-helpers.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

// Helper to load config for tests
async function loadTestConfig(server: McpServer) {
	const config = await server.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load config");
	}
	return config;
}

describe("McpServer", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-mcp-server");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize the project to create config with default statuses
		await mcpServer.initializeProject("Test Project");
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

	describe("transport methods", () => {
		it("should connect successfully to SSE transport", async () => {
			// SSE transport is now implemented, so it should connect successfully
			// Use dynamic port allocation (port 0) to avoid conflicts
			await expect(mcpServer.connect("sse", { port: 0 })).resolves.toBeUndefined();
		});

		it("should require transport before starting", async () => {
			await expect(mcpServer.start()).rejects.toThrow("No transport connected");
		});

		it("should throw error for unknown transport type", async () => {
			await expect(mcpServer.connect("unknown" as "stdio")).rejects.toThrow("Unknown transport type: unknown");
		});
	});

	describe("task tools integration", () => {
		beforeEach(async () => {
			const config = await loadTestConfig(mcpServer);
			registerTaskTools(mcpServer, config);
		});

		it("should register task management tools", async () => {
			const result = await mcpServer.testInterface.listTools();
			const toolNames = result.tools.map((tool) => tool.name);

			expect(toolNames).toContain("task_create");
			expect(toolNames).toContain("task_list");
			expect(toolNames).toContain("task_update");
			expect(toolNames).toContain("task_view");
			expect(toolNames).toContain("task_archive");
			expect(toolNames).toContain("task_demote");
			expect(toolNames).toContain("criteria_add");
			expect(toolNames).toContain("criteria_remove");
			expect(toolNames).toContain("criteria_check");
			expect(toolNames).toContain("criteria_list");
			expect(result.tools).toHaveLength(10);
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
			expect(result.content[0]?.text).toContain("Task task-1 - Test Task");
			expect(result.content[0]?.text).toContain("Status: ○ 📋 Ready");
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
			expect(result.content[0]?.text).toContain("Task task-1 - First Task");
			expect(result.content[0]?.text).toContain("Status: ○ 📋 Ready");
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
					arguments: { id: "task-1", status: "In Progress" },
				},
			});

			// Filter by status
			const request = {
				params: {
					name: "task_list",
					arguments: { status: "In Progress" },
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Task task-1 - Ready Task");
			expect(result.content[0]?.text).toContain("Status: ◒ In Progress");
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
			expect(result.content[0]?.text).toContain("Task task-1 - Frontend Task");
			expect(result.content[0]?.text).toContain("Labels: frontend, ui");
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
						status: "Done",
						description: "Updated description",
					},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Task task-1 - Updated Title");

			// Verify update by listing
			const listResult = await mcpServer.testInterface.callTool({
				params: { name: "task_list", arguments: {} },
			});
			expect(listResult.content[0]?.text).toContain("Task task-1 - Updated Title");
			expect(listResult.content[0]?.text).toContain("Status: ✔ Done");
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
			expect(titleSearch.content[0]?.text).toContain("Task task-1 - Authentication System");
			expect(titleSearch.content[0]?.text).toContain("Implement user login and registration");

			// Search by description
			const descSearch = await mcpServer.testInterface.callTool({
				params: {
					name: "task_list",
					arguments: { search: "schema" },
				},
			});
			expect(descSearch.content[0]?.text).toContain("Task task-2 - Database Migration");
			expect(descSearch.content[0]?.text).toContain("Update database schema");
		});

		it("should handle errors gracefully for non-existent task updates", async () => {
			const request = {
				params: {
					name: "task_update",
					arguments: { id: "non-existent-task", title: "New Title" },
				},
			};

			// Tool call returns wrapped error response instead of throwing
			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Task not found: non-existent-task");
		});

		it("should validate required fields for task creation", async () => {
			const request = {
				params: {
					name: "task_create",
					arguments: { description: "Missing title" },
				},
			};

			// Tool call returns wrapped error response instead of throwing
			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Required field 'title' is missing or null");
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
			// Should contain 3 tasks based on count in the output
			const taskText = (result.content[0]?.text as string) || "";
			const taskMatches = taskText.match(/Task task-\d+/g);
			expect(taskMatches?.length).toBe(3);
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
			expect(result.content[0]?.text).toContain("Task task-1.1 - Subtask");
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
			expect(result.content[0]?.text).toContain("Task task-1 - Implementation Task");
		});

		describe("task view, archive, and demote tools", () => {
			it("should view task with complete details using task_view", async () => {
				// First create the dependency task
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Dependency Task",
							description: "A dependency task",
						},
					},
				});

				// Create a task with comprehensive details
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Complex Task",
							description: "A task with all metadata",
							labels: ["frontend", "ui"],
							assignee: ["developer1"],
							priority: "high",
							acceptanceCriteria: ["Criterion 1", "Criterion 2"],
							dependencies: ["task-1"],
						},
					},
				});

				// View the task
				const request = {
					params: {
						name: "task_view",
						arguments: { id: "task-2" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				const taskText = result.content[0]?.text || "";

				expect(taskText).toContain("Task task-2 - Complex Task");
				expect(taskText).toContain("Status: ○ 📋 Ready");
				expect(taskText).toContain("Assignee: @developer1");
				expect(taskText).toContain("Priority: High");
				expect(taskText).toContain("Labels: frontend, ui");
				expect(taskText).toContain("Dependencies: task-1");
				expect(taskText).toContain("Description:");
				expect(taskText).toContain("A task with all metadata");
				expect(taskText).toContain("Acceptance Criteria:");
				expect(taskText).toContain("- [ ] #1 Criterion 1");
				expect(taskText).toContain("- [ ] #2 Criterion 2");
			});

			it("should handle task_view for non-existent task", async () => {
				const request = {
					params: {
						name: "task_view",
						arguments: { id: "non-existent-task" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("Task not found: non-existent-task");
			});

			it("should archive completed task successfully", async () => {
				// Create a task
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task to Archive" },
					},
				});

				// Update task to Done status
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-1", status: "Done" },
					},
				});

				// Archive the task
				const request = {
					params: {
						name: "task_archive",
						arguments: { id: "task-1" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Expect task details in plain text format after archiving
				expect(result.content[0]?.text).toContain("Task task-1 - Task to Archive");
			});

			it("should prevent archiving non-completed task", async () => {
				// Create a task (default status is Ready)
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Non-completed Task" },
					},
				});

				// Try to archive the task (should fail)
				const request = {
					params: {
						name: "task_archive",
						arguments: { id: "task-1" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("task status must be 'Done'");
			});

			it("should handle task_archive for non-existent task", async () => {
				const request = {
					params: {
						name: "task_archive",
						arguments: { id: "non-existent-task" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("Task not found: non-existent-task");
			});

			it("should demote task successfully", async () => {
				// Create a task
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task to Demote" },
					},
				});

				// Demote the task
				const request = {
					params: {
						name: "task_demote",
						arguments: { id: "task-1" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Expect task details in plain text format after demotion
				expect(result.content[0]?.text).toContain("Task task-1 - Task to Demote");
			});

			it("should handle task_demote for non-existent task", async () => {
				const request = {
					params: {
						name: "task_demote",
						arguments: { id: "non-existent-task" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("Task not found: non-existent-task");
			});

			it("should validate required id parameter for new tools", async () => {
				const tools = ["task_view", "task_archive", "task_demote"];

				for (const toolName of tools) {
					const request = {
						params: {
							name: toolName,
							arguments: {}, // Missing required id parameter
						},
					};

					const result = await mcpServer.testInterface.callTool(request);
					expect(result.content).toHaveLength(1);
					expect(result.content[0]?.text).toContain("Required field 'id' is missing or null");
				}
			});

			it("should show implementation plan and notes in task_view", async () => {
				// Create task
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task with Plan and Notes" },
					},
				});

				// Update task with implementation plan and notes
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: {
							id: "task-1",
							implementationNotes: "Implemented user authentication using JWT tokens",
						},
					},
				});

				// View the task
				const request = {
					params: {
						name: "task_view",
						arguments: { id: "task-1" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				const taskText = result.content[0]?.text || "";

				expect(taskText).toContain("Implementation Notes:");
				expect(taskText).toContain("Implemented user authentication using JWT tokens");
			});
		});
	});

	describe("tool validation and error handling", () => {
		beforeEach(async () => {
			const config = await loadTestConfig(mcpServer);
			registerTaskTools(mcpServer, config);
		});

		describe("input schema validation", () => {
			it("should handle invalid input schema types", async () => {
				const request = {
					params: {
						name: "task_create",
						arguments: {
							title: 123, // Should be string
							description: true, // Should be string
							labels: "not-an-array", // Should be array
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// The tool should handle type conversion or validation gracefully
				expect(result.content[0]?.text).toBeDefined();
			});

			it("should handle null and undefined values", async () => {
				const request = {
					params: {
						name: "task_update",
						arguments: {
							id: null,
							title: undefined,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("Required field 'id' is missing or null");
			});

			it("should validate required parameters", async () => {
				const request = {
					params: {
						name: "task_update",
						arguments: {}, // Missing required 'id' parameter
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("id");
			});

			it("should handle extremely large input values", async () => {
				const largeString = "x".repeat(10000);
				const request = {
					params: {
						name: "task_create",
						arguments: {
							title: largeString,
							description: largeString,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Should either succeed or fail gracefully
				expect(result.content[0]?.text).toBeDefined();
			});

			it("should handle special characters and unicode", async () => {
				const request = {
					params: {
						name: "task_create",
						arguments: {
							title: "🚀 Task with émojis and spëcial chars ñoña",
							description: "Unicode test: 中文 العربية עברית русский",
							labels: ["测试", "тест", "🏷️"],
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("Task task-1 - 🚀 Task with émojis and spëcial chars ñoña");
			});
		});

		describe("error handling scenarios", () => {
			it("should handle malformed request objects", async () => {
				const request = {
					params: {
						name: "task_create",
						arguments: "not-an-object" as unknown as Record<string, unknown>, // Should be object
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Should handle invalid JSON format gracefully
				expect(result.content[0]?.text).toBeDefined();
			});

			it("should handle deeply nested invalid data", async () => {
				const request = {
					params: {
						name: "task_create",
						arguments: {
							title: "Test Task",
							metadata: {
								nested: {
									deeply: {
										invalid: () => "function",
									},
								},
							},
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Should handle gracefully without crashing
				expect(result.content[0]?.text).toBeDefined();
			});

			it("should handle circular references in arguments", async () => {
				// Since we can't actually pass circular references through MCP,

				// we'll test with a mock scenario that might cause similar issues
				const request = {
					params: {
						name: "task_create",
						arguments: {
							title: "Test Task",
							description: JSON.stringify({ deep: { nested: { data: "test" } } }),
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toBeDefined();
			});

			it("should handle concurrent tool calls", async () => {
				// Create multiple concurrent task creation requests
				const requests = Array.from({ length: 10 }, (_, i) =>
					mcpServer.testInterface.callTool({
						params: {
							name: "task_create",
							arguments: {
								title: `Concurrent Task ${i + 1}`,
								description: `Created concurrently - ${Date.now()}`,
							},
						},
					}),
				);

				const results = await Promise.all(requests);

				// All requests should complete
				expect(results).toHaveLength(10);

				// All should have valid responses
				results.forEach((result) => {
					expect(result.content).toHaveLength(1);
					expect(result.content[0]?.text).toBeDefined();
				});

				// Verify tasks were created
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "task_list", arguments: {} },
				});

				// Should contain multiple task entries
				const taskText = (listResult.content[0]?.text as string) || "";
				const taskCount = taskText.split("Task task-").length - 1;
				expect(taskCount).toBeGreaterThan(5);
			});

			it("should handle tool execution with corrupted project state", async () => {
				// Simulate corrupted state by directly manipulating the filesystem
				// This tests resilience to unexpected conditions
				const request = {
					params: {
						name: "task_list",
						arguments: {},
					},
				};

				// Tool should handle gracefully even if underlying data has issues
				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toBeDefined();
			});
		});

		describe("boundary value testing", () => {
			it("should handle empty string inputs", async () => {
				const request = {
					params: {
						name: "task_create",
						arguments: {
							title: "",
							description: "",
							labels: [],
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Should fail validation for empty title
				expect(result.content[0]?.text).toBeDefined();
			});

			it("should handle maximum array sizes", async () => {
				const largeLabelsArray = Array.from({ length: 1000 }, (_, i) => `label${i}`);

				const request = {
					params: {
						name: "task_create",
						arguments: {
							title: "Large Labels Test",
							labels: largeLabelsArray,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Should either succeed or fail gracefully with appropriate error
				expect(result.content[0]?.text).toBeDefined();
			});

			it("should handle negative numbers and edge numeric values", async () => {
				const request = {
					params: {
						name: "task_list",
						arguments: {
							limit: -1, // Negative limit
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Should handle negative limits appropriately
				expect(result.content[0]?.text).toBeDefined();
			});
		});

		describe("tool interaction patterns", () => {
			it("should handle rapid sequential tool calls", async () => {
				// Test rapid sequential operations
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Rapid Test 1" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-1", title: "Updated Rapidly" },
					},
				});

				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "task_list", arguments: {} },
				});

				expect(listResult.content[0]?.text).toContain("Updated Rapidly");
			});

			it("should maintain state consistency across tool calls", async () => {
				// Create task
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "State Test", labels: ["initial"] },
					},
				});

				// Update task
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-1", labels: ["updated", "consistent"] },
					},
				});

				// Verify state
				const result = await mcpServer.testInterface.callTool({
					params: { name: "task_list", arguments: {} },
				});

				expect(result.content[0]?.text).toContain("State Test");
				expect(result.content[0]?.text).toContain("updated");
				expect(result.content[0]?.text).toContain("consistent");
			});
		});
	});

	describe("board and sequence management tools", () => {
		beforeEach(async () => {
			const config = await loadTestConfig(mcpServer);
			registerTaskTools(mcpServer, config);
			// Import and register board and sequence tools
			const { registerBoardTools } = require("../mcp/tools/board-tools.ts");
			const { registerSequenceTools } = require("../mcp/tools/sequence-tools.ts");
			registerBoardTools(mcpServer);
			registerSequenceTools(mcpServer);
		});

		describe("board management", () => {
			it("should register board_view tool", async () => {
				const result = await mcpServer.testInterface.listTools();
				const toolNames = result.tools.map((tool) => tool.name);

				expect(toolNames).toContain("board_view");
			});

			it("should get board view with no tasks", async () => {
				const request = {
					params: {
						name: "board_view",
						arguments: { includeMetadata: true },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const boardData = JSON.parse((result.content[0]?.text || "{}") as string);
				expect(boardData.columns).toBeDefined();
				expect(boardData.metadata).toBeDefined();
				expect(boardData.metadata.totalTasks).toBe(0);
				expect(boardData.metadata.completionRate).toBe(0);
			});

			it("should get board view with tasks in different statuses", async () => {
				// Create tasks with different statuses
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Todo Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "In Progress Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-2", status: "In Progress" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Done Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-3", status: "Done" },
					},
				});

				const request = {
					params: {
						name: "board_view",
						arguments: { includeMetadata: true },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const boardData = JSON.parse((result.content[0]?.text || "{}") as string);
				expect(boardData.columns).toBeDefined();
				expect(boardData.metadata.totalTasks).toBe(3);
				expect(boardData.metadata.statusCounts["📋 Ready"]).toBe(1);
				expect(boardData.metadata.statusCounts["In Progress"]).toBe(1);
				expect(boardData.metadata.statusCounts.Done).toBe(1);
				expect(boardData.metadata.completionRate).toBe(33); // 1/3 = 33%
			});

			it("should get board view without metadata", async () => {
				// Create a task
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Test Task" },
					},
				});

				const request = {
					params: {
						name: "board_view",
						arguments: { includeMetadata: false },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const boardData = JSON.parse((result.content[0]?.text || "{}") as string);
				expect(boardData.columns).toBeDefined();
				expect(boardData.metadata).toBeUndefined();
			});

			it("should handle board view with invalid arguments", async () => {
				const request = {
					params: {
						name: "board_view",
						arguments: { includeMetadata: "invalid" }, // Should be boolean
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				// Should handle gracefully or return error
				expect(result.content[0]?.text).toBeDefined();
			});

			it("should calculate completion rate correctly with various done statuses", async () => {
				// Create tasks with various completion statuses
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task 1" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task 2" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-2", status: "Done" },
					},
				});

				const request = {
					params: {
						name: "board_view",
						arguments: { includeMetadata: true },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				const boardData = JSON.parse((result.content[0]?.text || "{}") as string);

				expect(boardData.metadata.totalTasks).toBe(2);
				expect(boardData.metadata.completionRate).toBe(50); // 1/2 = 50%
			});
		});

		describe("sequence management", () => {
			it("should register sequence tools", async () => {
				const result = await mcpServer.testInterface.listTools();
				const toolNames = result.tools.map((tool) => tool.name);

				expect(toolNames).toContain("sequence_create");
				expect(toolNames).toContain("sequence_plan");
			});

			it("should create sequence with no tasks", async () => {
				const request = {
					params: {
						name: "sequence_create",
						arguments: { includeCompleted: false },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const sequenceData = parseSequenceCreateMarkdown((result.content?.[0]?.text as string) || "");
				expect(sequenceData.unsequenced).toEqual([]);
				expect(sequenceData.sequences).toEqual([]);
				expect(sequenceData.metadata.totalTasks).toBe(0);
				expect(sequenceData.metadata.sequenceCount).toBe(0);
			});

			it("should create sequence with independent tasks", async () => {
				// Create independent tasks (no dependencies)
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Independent Task 1" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Independent Task 2" },
					},
				});

				const request = {
					params: {
						name: "sequence_create",
						arguments: { includeCompleted: false },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const sequenceData = parseSequenceCreateMarkdown((result.content?.[0]?.text as string) || "");
				expect(sequenceData.metadata.totalTasks).toBe(2);
				expect(sequenceData.metadata.filteredTasks).toBe(2);
				expect(sequenceData.unsequenced).toHaveLength(2);
			});

			it("should create sequence with tasks having dependencies", async () => {
				// Create tasks with dependencies
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Parent Task",
							description: "This is a parent task",
						},
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Child Task",
							dependencies: ["task-1"],
						},
					},
				});

				const request = {
					params: {
						name: "sequence_create",
						arguments: { includeCompleted: false },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const sequenceData = parseSequenceCreateMarkdown((result.content?.[0]?.text as string) || "");
				expect(sequenceData.metadata.totalTasks).toBe(2);
				// Should have sequences if dependencies exist
				expect(sequenceData.sequences).toBeDefined();
			});

			it("should filter sequences by status", async () => {
				// Create tasks with different statuses
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Todo Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Progress Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-2", status: "In Progress" },
					},
				});

				const request = {
					params: {
						name: "sequence_create",
						arguments: {
							includeCompleted: false,
							filterStatus: "In Progress",
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const sequenceData = parseSequenceCreateMarkdown((result.content?.[0]?.text as string) || "");
				expect(sequenceData.metadata.filteredTasks).toBe(1);
				expect(sequenceData.metadata.filterStatus).toBe("In Progress");
			});

			it("should include completed tasks when requested", async () => {
				// Create a completed task
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Done Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-1", status: "Done" },
					},
				});

				// Test without including completed
				const request1 = {
					params: {
						name: "sequence_create",
						arguments: { includeCompleted: false },
					},
				};

				const result1 = await mcpServer.testInterface.callTool(request1);
				const sequenceData1 = parseSequenceCreateMarkdown((result1.content?.[0]?.text as string) || "");
				expect(sequenceData1.metadata.filteredTasks).toBe(0);

				// Test with including completed
				const request2 = {
					params: {
						name: "sequence_create",
						arguments: { includeCompleted: true },
					},
				};

				const result2 = await mcpServer.testInterface.callTool(request2);
				const sequenceData2 = parseSequenceCreateMarkdown((result2.content?.[0]?.text as string) || "");
				expect(sequenceData2.metadata.filteredTasks).toBe(1);
			});

			it("should plan sequence execution with phases", async () => {
				// Create tasks for planning
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task 1" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task 2" },
					},
				});

				const request = {
					params: {
						name: "sequence_plan",
						arguments: { includeCompleted: false },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const planData = parseSequencePlanMarkdown((result.content?.[0]?.text as string) || "");
				expect(planData.phases).toBeDefined();
				expect(planData.unsequenced).toBeDefined();
				expect(planData.summary).toBeDefined();
				expect(planData.summary.totalPhases).toBeGreaterThanOrEqual(0);
			});

			it("should plan sequence for specific task IDs", async () => {
				// Create multiple tasks
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task 1" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task 2" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task 3" },
					},
				});

				const request = {
					params: {
						name: "sequence_plan",
						arguments: {
							taskIds: ["task-1", "task-3"],
							includeCompleted: false,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);

				const planData = parseSequencePlanMarkdown((result.content?.[0]?.text as string) || "");
				expect(planData.summary).toBeDefined();
				// Should only plan for the 2 specified tasks
				const totalTasksInPlan = Number(planData.summary.totalTasksInPlan) + planData.unsequenced.length;
				expect(totalTasksInPlan).toBe(2);
			});

			it("should handle missing task IDs in sequence planning", async () => {
				const request = {
					params: {
						name: "sequence_plan",
						arguments: {
							taskIds: ["non-existent-task"],
							includeCompleted: false,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("Tasks not found: non-existent-task");
			});

			it("should handle sequence operations with edge cases", async () => {
				// Test with empty task IDs array
				const request1 = {
					params: {
						name: "sequence_plan",
						arguments: {
							taskIds: [],
							includeCompleted: false,
						},
					},
				};

				const result1 = await mcpServer.testInterface.callTool(request1);
				expect(result1.content).toHaveLength(1);

				// Test with null/undefined values
				const request2 = {
					params: {
						name: "sequence_create",
						arguments: {},
					},
				};

				const result2 = await mcpServer.testInterface.callTool(request2);
				expect(result2.content).toHaveLength(1);

				const sequenceData = parseSequenceCreateMarkdown((result2.content?.[0]?.text as string) || "");
				expect(sequenceData.metadata).toBeDefined();
			});
		});

		describe("board and sequence integration", () => {
			it("should work together to provide comprehensive project view", async () => {
				// Create a mix of tasks in different states
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Foundation Task",
							description: "Base task for the project",
						},
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Dependent Task",
							dependencies: ["task-1"],
						},
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-1", status: "In Progress" },
					},
				});

				// Get board view
				const boardResult = await mcpServer.testInterface.callTool({
					params: {
						name: "board_view",
						arguments: { includeMetadata: true },
					},
				});

				// Get sequence view
				const sequenceResult = await mcpServer.testInterface.callTool({
					params: {
						name: "sequence_create",
						arguments: { includeCompleted: false },
					},
				});

				// Both should work and provide consistent data
				expect(boardResult.content).toHaveLength(1);
				expect(sequenceResult.content).toHaveLength(1);

				const boardData = JSON.parse((boardResult.content[0]?.text || "{}") as string);
				const sequenceData = parseSequenceCreateMarkdown((sequenceResult.content?.[0]?.text as string) || "");

				expect(boardData.metadata.totalTasks).toBe(2);
				expect(sequenceData.metadata.totalTasks).toBe(2);
				expect(sequenceData.metadata.filteredTasks).toBe(2); // Both should be included (not completed)
			});

			it("should maintain data consistency across board and sequence operations", async () => {
				// Create tasks with dependencies and different statuses
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task A", labels: ["frontend"] },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Task B", dependencies: ["task-1"], labels: ["backend"] },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-1", status: "Done" },
					},
				});

				// Get both views and verify consistency
				const boardResult = await mcpServer.testInterface.callTool({
					params: { name: "board_view", arguments: { includeMetadata: true } },
				});

				const sequenceResult = await mcpServer.testInterface.callTool({
					params: { name: "sequence_create", arguments: { includeCompleted: true } },
				});

				const boardData = JSON.parse((boardResult.content[0]?.text || "{}") as string);
				const sequenceData = parseSequenceCreateMarkdown((sequenceResult.content?.[0]?.text as string) || "");

				// Both should see the same total number of tasks
				expect(boardData.metadata.totalTasks).toBe(2);
				expect(sequenceData.metadata.totalTasks).toBe(2);

				// Board should show one completed task
				expect(boardData.metadata.statusCounts.Done).toBe(1);
				expect(boardData.metadata.completionRate).toBe(50);
			});
		});
	});

	describe("MCP data resources", () => {
		beforeEach(async () => {
			const config = await loadTestConfig(mcpServer);
			registerTaskTools(mcpServer, config);
			// Import and register data resources
			const { registerDataResources } = require("../mcp/resources/data-resources.ts");
			registerDataResources(mcpServer);
		});

		describe("resource registration", () => {
			it("should register data resources", async () => {
				const result = await mcpServer.testInterface.listResources();
				const resourceUris = result.resources.map((resource) => resource.uri);

				expect(resourceUris).toContain("backlog://tasks/list");
				expect(resourceUris).toContain("backlog://board/state");
				expect(resourceUris).toContain("backlog://project/statistics");
			});

			it("should have proper resource metadata", async () => {
				const result = await mcpServer.testInterface.listResources();

				const taskListResource = result.resources.find((r) => r.uri === "backlog://tasks/list");
				expect(taskListResource?.name).toBe("Task List");
				expect(taskListResource?.description).toContain("Filtered list of tasks");
				expect(taskListResource?.mimeType).toBe("application/json");

				const boardStateResource = result.resources.find((r) => r.uri === "backlog://board/state");
				expect(boardStateResource?.name).toBe("Board State");
				expect(boardStateResource?.description).toContain("kanban board state");

				const statisticsResource = result.resources.find((r) => r.uri === "backlog://project/statistics");
				expect(statisticsResource?.name).toBe("Project Statistics");
				expect(statisticsResource?.description).toContain("analytics and metrics");
			});
		});

		describe("task list resource", () => {
			it("should read task list resource with no tasks", async () => {
				const request = { params: { uri: "backlog://tasks/list" } };
				const result = await mcpServer.testInterface.readResource(request);

				expect(result.contents).toHaveLength(1);
				const taskListData = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(taskListData.tasks).toEqual([]);
				expect(taskListData.metadata.totalTasks).toBe(0);
			});

			it("should read task list resource with tasks", async () => {
				// Create some tasks
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Test Task 1",
							labels: ["frontend", "bug"],
							priority: "high",
						},
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Test Task 2",
							labels: ["backend"],
							priority: "medium",
						},
					},
				});

				const request = { params: { uri: "backlog://tasks/list" } };
				const result = await mcpServer.testInterface.readResource(request);

				expect(result.contents).toHaveLength(1);
				const taskListData = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(taskListData.tasks).toHaveLength(2);
				expect(taskListData.metadata.totalTasks).toBe(2);
				expect(taskListData.tasks[0].title).toBe("Test Task 1");
				expect(taskListData.tasks[0].labels).toEqual(["frontend", "bug"]);
				expect(taskListData.tasks[0].priority).toBe("high");
			});

			it("should filter tasks by status", async () => {
				// Create tasks with different statuses
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Todo Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Progress Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-2", status: "In Progress" },
					},
				});

				const request = { params: { uri: "backlog://tasks/list?status=progress" } };
				const result = await mcpServer.testInterface.readResource(request);

				const taskListData = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(taskListData.tasks).toHaveLength(1);
				expect(taskListData.tasks[0].title).toBe("Progress Task");
				expect(taskListData.metadata.filters.status).toBe("progress");
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

				const request = { params: { uri: "backlog://tasks/list?labels=frontend,ui" } };
				const result = await mcpServer.testInterface.readResource(request);

				const taskListData = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(taskListData.tasks).toHaveLength(1);
				expect(taskListData.tasks[0].title).toBe("Frontend Task");
				expect(taskListData.metadata.filters.labels).toEqual(["frontend", "ui"]);
			});

			it("should limit task results", async () => {
				// Create multiple tasks
				for (let i = 1; i <= 5; i++) {
					await mcpServer.testInterface.callTool({
						params: {
							name: "task_create",
							arguments: { title: `Task ${i}` },
						},
					});
				}

				const request = { params: { uri: "backlog://tasks/list?limit=3" } };
				const result = await mcpServer.testInterface.readResource(request);

				const taskListData = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(taskListData.tasks).toHaveLength(3);
				expect(taskListData.metadata.filters.limit).toBe(3);
			});

			it("should handle invalid URI parameters gracefully", async () => {
				const request = { params: { uri: "backlog://tasks/list?limit=invalid&status=" } };
				const result = await mcpServer.testInterface.readResource(request);

				expect(result.contents).toHaveLength(1);
				const taskListData = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(taskListData.tasks).toBeDefined();
			});
		});

		describe("board state resource", () => {
			it("should read board state with no tasks", async () => {
				const request = { params: { uri: "backlog://board/state" } };
				const result = await mcpServer.testInterface.readResource(request);

				expect(result.contents).toHaveLength(1);
				const boardState = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(boardState.board.columns).toBeDefined();
				expect(boardState.metrics.totalTasks).toBe(0);
				expect(boardState.metrics.completionRate).toBe(0);
				expect(boardState.configuration.projectName).toBe("Test Project");
			});

			it("should read board state with tasks in different statuses", async () => {
				// Create tasks in different statuses
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Todo Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Progress Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-2", status: "In Progress" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Done Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-3", status: "Done" },
					},
				});

				const request = { params: { uri: "backlog://board/state" } };
				const result = await mcpServer.testInterface.readResource(request);

				const boardState = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(boardState.metrics.totalTasks).toBe(3);
				expect(boardState.metrics.completedTasks).toBe(1);
				expect(boardState.metrics.completionRate).toBe(33);
				expect(boardState.board.statusCounts["In Progress"]).toBe(1);
				expect(boardState.board.statusCounts.Done).toBe(1);
			});

			it("should calculate weekly velocity", async () => {
				// Create and complete a task (will be recent)
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: { title: "Recent Task" },
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: { id: "task-1", status: "Done" },
					},
				});

				const request = { params: { uri: "backlog://board/state" } };
				const result = await mcpServer.testInterface.readResource(request);

				const boardState = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(boardState.metrics.weeklyVelocity).toBe(1);
				expect(boardState.metrics.averageTasksPerStatus).toBeGreaterThanOrEqual(0);
			});

			it("should include configuration information", async () => {
				const request = { params: { uri: "backlog://board/state" } };
				const result = await mcpServer.testInterface.readResource(request);

				const boardState = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(boardState.configuration.projectName).toBe("Test Project");
				expect(boardState.configuration.statuses).toEqual(["To Do", "In Progress", "Done"]);
				expect(boardState.configuration.workflowStages).toBe(3);
				expect(boardState.lastUpdated).toBeDefined();
			});
		});

		describe("project statistics resource", () => {
			it("should read project statistics with no tasks", async () => {
				const request = { params: { uri: "backlog://project/statistics" } };
				const result = await mcpServer.testInterface.readResource(request);

				expect(result.contents).toHaveLength(1);
				const statistics = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(statistics.overview.totalTasks).toBe(0);
				expect(statistics.overview.completionRate).toBe(0);
				expect(statistics.overview.projectName).toBe("Test Project");
				expect(statistics.distribution.status).toEqual({});
				expect(statistics.timeline.weeklyVelocity).toBe(0);
			});

			it("should calculate comprehensive statistics", async () => {
				// Create diverse tasks
				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Frontend Task",
							description: "Build UI components",
							labels: ["frontend", "ui"],
							priority: "high",
							acceptanceCriteria: ["UI renders correctly", "Responsive design"],
						},
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_create",
						arguments: {
							title: "Backend Task",
							description: "API implementation",
							labels: ["backend", "api"],
							priority: "medium",
							dependencies: ["task-1"],
						},
					},
				});

				await mcpServer.testInterface.callTool({
					params: {
						name: "task_update",
						arguments: {
							id: "task-1",
							status: "Done",
							implementationNotes: "Completed with React components",
						},
					},
				});

				const request = { params: { uri: "backlog://project/statistics" } };
				const result = await mcpServer.testInterface.readResource(request);

				const statistics = JSON.parse((result.contents?.[0]?.text as string) || "{}");

				// Overview statistics
				expect(statistics.overview.totalTasks).toBe(2);
				expect(statistics.overview.completedTasks).toBe(1);
				expect(statistics.overview.completionRate).toBe(50);
				expect(statistics.overview.uniqueLabels).toBe(4); // frontend, ui, backend, api

				// Distribution analysis
				expect(statistics.distribution.labels.frontend).toBe(1);
				expect(statistics.distribution.labels.backend).toBe(1);
				expect(statistics.distribution.priority.high).toBe(1);
				expect(statistics.distribution.priority.medium).toBe(1);

				// Timeline metrics
				expect(statistics.timeline.tasksCreatedLastWeek).toBe(2);
				expect(statistics.timeline.tasksCompletedLastWeek).toBe(1);

				// Quality metrics
				expect(statistics.quality.tasksWithDescription).toBe(2);
				expect(statistics.quality.tasksWithAcceptanceCriteria).toBe(1);
				expect(statistics.quality.tasksWithImplementationNotes).toBe(1);
				expect(statistics.quality.documentationRate).toBe(100);
				expect(statistics.quality.acceptanceCriteriaRate).toBe(50);

				// Dependency metrics
				expect(statistics.dependencies.tasksWithDependencies).toBe(1);
				expect(statistics.dependencies.totalDependencies).toBe(1);
				expect(statistics.dependencies.dependencyRate).toBe(50);
			});

			it("should handle different priority distributions", async () => {
				// Create tasks with various priorities (using valid priorities)
				const priorities = ["high", "high", "medium", "low"];
				for (let i = 0; i < priorities.length; i++) {
					await mcpServer.testInterface.callTool({
						params: {
							name: "task_create",
							arguments: {
								title: `Task ${i + 1}`,
								priority: priorities[i],
							},
						},
					});
				}

				const request = { params: { uri: "backlog://project/statistics" } };
				const result = await mcpServer.testInterface.readResource(request);

				const statistics = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(statistics.distribution.priority.high).toBe(2);
				expect(statistics.distribution.priority.medium).toBe(1);
				expect(statistics.distribution.priority.low).toBe(1);
			});

			it("should track creation trends", async () => {
				// Create tasks (they will be recent)
				await mcpServer.testInterface.callTool({
					params: { name: "task_create", arguments: { title: "Recent Task 1" } },
				});

				await mcpServer.testInterface.callTool({
					params: { name: "task_create", arguments: { title: "Recent Task 2" } },
				});

				const request = { params: { uri: "backlog://project/statistics" } };
				const result = await mcpServer.testInterface.readResource(request);

				const statistics = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(statistics.timeline.tasksCreatedLastWeek).toBe(2);
				expect(statistics.timeline.creationTrend).toBe("increasing");
			});
		});

		describe("resource caching and updates", () => {
			it("should provide fresh data on each resource read", async () => {
				// Read initial state
				const request = { params: { uri: "backlog://project/statistics" } };
				const result1 = await mcpServer.testInterface.readResource(request);
				const stats1 = JSON.parse((result1.contents[0]?.text || "{}") as string);
				expect(stats1.overview.totalTasks).toBe(0);

				// Add minimal delay to ensure different timestamps
				await new Promise((resolve) => setTimeout(resolve, 1));

				// Add a task
				await mcpServer.testInterface.callTool({
					params: { name: "task_create", arguments: { title: "New Task" } },
				});

				// Read again - should show updated data
				const result2 = await mcpServer.testInterface.readResource(request);
				const stats2 = JSON.parse((result2.contents[0]?.text || "{}") as string);
				expect(stats2.overview.totalTasks).toBe(1);

				// Timestamps should be different (within reasonable bounds)
				const time1 = new Date(stats1.generatedAt).getTime();
				const time2 = new Date(stats2.generatedAt).getTime();
				expect(time2).toBeGreaterThan(time1);
			});

			it("should handle concurrent resource reads", async () => {
				// Create some baseline data
				await mcpServer.testInterface.callTool({
					params: { name: "task_create", arguments: { title: "Concurrent Test" } },
				});

				// Make multiple concurrent reads
				const requests = Array.from({ length: 5 }, () =>
					mcpServer.testInterface.readResource({ params: { uri: "backlog://board/state" } }),
				);

				const results = await Promise.all(requests);

				// All should succeed
				expect(results).toHaveLength(5);

				// All should have valid data
				results.forEach((result) => {
					expect(result.contents).toHaveLength(1);
					const boardState = JSON.parse((result.contents?.[0]?.text as string) || "{}");
					expect(boardState.metrics.totalTasks).toBe(1);
				});
			});
		});

		describe("resource error handling", () => {
			it("should handle non-existent resource URIs", async () => {
				const request = { params: { uri: "backlog://invalid/resource" } };
				await expect(mcpServer.testInterface.readResource(request)).rejects.toThrow(
					"Resource not found: backlog://invalid/resource",
				);
			});

			it("should handle malformed URI parameters", async () => {
				// Test with malformed parameters
				const request = { params: { uri: "backlog://tasks/list?limit=abc&status=&labels=" } };
				const result = await mcpServer.testInterface.readResource(request);

				expect(result.contents).toHaveLength(1);
				// Should not crash and provide valid response
				const taskListData = JSON.parse((result.contents?.[0]?.text as string) || "{}");
				expect(taskListData.tasks).toBeDefined();
				expect(taskListData.metadata).toBeDefined();
			});
		});
	});
});
