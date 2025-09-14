import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { createUniqueTestDir, safeCleanup } from "../../../test/test-utils.ts";
import { McpServer } from "../../server.ts";
import { registerTaskTools } from "../../tools/task-tools.ts";

let TEST_DIR: string;

describe("Task Tools", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-task-tools");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		registerTaskTools(mcpServer);
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
		it("should register task management tools", async () => {
			const result = await mcpServer.testInterface.listTools();
			const toolNames = result.tools.map((tool) => tool.name);

			expect(toolNames).toContain("task_create");
			expect(toolNames).toContain("task_list");
			expect(toolNames).toContain("task_update");
			expect(result.tools).toHaveLength(3);
		});

		it("should have proper tool schemas", async () => {
			const result = await mcpServer.testInterface.listTools();
			const tools = result.tools;

			const createTool = tools.find((t) => t.name === "task_create");
			expect(createTool?.description).toContain("Create a new task");
			expect(createTool?.inputSchema.properties?.title).toBeDefined();

			const listTool = tools.find((t) => t.name === "task_list");
			expect(listTool?.description).toContain("List tasks");
			expect(listTool?.inputSchema.properties?.status).toBeDefined();

			const updateTool = tools.find((t) => t.name === "task_update");
			expect(updateTool?.description).toContain("Update an existing task");
			expect(updateTool?.inputSchema.properties?.id).toBeDefined();
		});
	});

	describe("task_create tool", () => {
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
	});

	describe("task_list tool", () => {
		beforeEach(async () => {
			// Create some test tasks
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Frontend Task",
						description: "UI development task",
						labels: ["frontend", "ui"],
					},
				},
			});

			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Backend Task",
						description: "API development task",
						labels: ["backend", "api"],
					},
				},
			});
		});

		it("should list tasks with task_list tool", async () => {
			const request = {
				params: {
					name: "task_list",
					arguments: {},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Found 2 task(s):");
			expect(result.content[0]?.text).toContain("Frontend Task");
			expect(result.content[0]?.text).toContain("Backend Task");
		});

		it("should filter tasks by status", async () => {
			// Update one task status
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

		it("should search tasks by title and description", async () => {
			// Search by title
			const titleSearch = await mcpServer.testInterface.callTool({
				params: {
					name: "task_list",
					arguments: { search: "Frontend" },
				},
			});
			expect(titleSearch.content[0]?.text).toContain("Found 1 task(s):");
			expect(titleSearch.content[0]?.text).toContain("Frontend Task");

			// Search by description
			const descSearch = await mcpServer.testInterface.callTool({
				params: {
					name: "task_list",
					arguments: { search: "API" },
				},
			});
			expect(descSearch.content[0]?.text).toContain("Found 1 task(s):");
			expect(descSearch.content[0]?.text).toContain("Backend Task");
		});

		it("should limit task list results", async () => {
			// Create additional tasks
			for (let i = 3; i <= 5; i++) {
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
	});

	describe("task_update tool", () => {
		beforeEach(async () => {
			// Create a test task
			await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: { title: "Original Title" },
				},
			});
		});

		it("should update task with task_update tool", async () => {
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

		it("should update task implementation notes", async () => {
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

		it("should handle errors gracefully for non-existent task updates", async () => {
			const request = {
				params: {
					name: "task_update",
					arguments: { id: "non-existent-task", title: "New Title" },
				},
			};

			await expect(mcpServer.testInterface.callTool(request)).rejects.toThrow("Task not found: non-existent-task");
		});
	});
});
