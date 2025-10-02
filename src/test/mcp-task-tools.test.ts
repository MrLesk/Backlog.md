import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/task-tools.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

// Utility function for creating test tasks with criteria
const createTestTaskWithCriteria = async (mcpServer: McpServer, overrides = {}, criteria: string[] = []) => {
	const taskRequest = {
		params: {
			name: "task_create",
			arguments: {
				title: "Test Task",
				description: "Test description",
				...overrides,
			},
		},
	};

	const result = await mcpServer.testInterface.callTool(taskRequest);

	// Extract task ID from the formatted response (now contains "Task task-X - Title")
	const responseText = (result.content[0]?.text as string) || "";
	const taskIdMatch = responseText.match(/Task (task-\d+) -/);
	const taskId = taskIdMatch?.[1] || "task-1"; // fallback to task-1 if parsing fails

	if (criteria.length > 0) {
		await mcpServer.testInterface.callTool({
			params: {
				name: "criteria_add",
				arguments: { id: taskId, criteria },
			},
		});
	}

	return { result, taskId };
};

describe("Task Tools", () => {
	let mcpServer: McpServer;

	beforeAll(async () => {
		// One-time test setup
		TEST_DIR = createUniqueTestDir("test-task-tools");
	});

	beforeEach(async () => {
		// Create fresh server instance
		mcpServer = new McpServer(TEST_DIR);

		// Reset task state between tests - clear tasks directory
		const { existsSync, rmSync } = await import("node:fs");
		const { join } = await import("node:path");
		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		if (existsSync(tasksDir)) {
			rmSync(tasksDir, { recursive: true, force: true });
		}

		await mcpServer.filesystem.ensureBacklogStructure();
		await mcpServer.initializeProject("Test Project");

		// Load config for dynamic schema generation
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load config");
		}

		registerTaskTools(mcpServer, config);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
		} catch {
			// Ignore cleanup errors
		}
	});

	afterAll(async () => {
		try {
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
			expect(toolNames).toContain("task_view");
			expect(toolNames).toContain("task_archive");
			expect(toolNames).toContain("task_demote");
			expect(toolNames).toContain("criteria_add");
			expect(toolNames).toContain("criteria_remove");
			expect(toolNames).toContain("criteria_check");
			expect(toolNames).toContain("criteria_list");
			expect(result.tools).toHaveLength(10);
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

			// Test AC tools schemas
			const criteriaAddTool = tools.find((t) => t.name === "criteria_add");
			expect(criteriaAddTool?.description).toContain("Add new acceptance criteria");
			expect(criteriaAddTool?.inputSchema.properties?.id).toBeDefined();
			expect(criteriaAddTool?.inputSchema.properties?.criteria).toBeDefined();

			const criteriaRemoveTool = tools.find((t) => t.name === "criteria_remove");
			expect(criteriaRemoveTool?.description).toContain("Remove AC by index");
			expect(criteriaRemoveTool?.inputSchema.properties?.id).toBeDefined();
			expect(criteriaRemoveTool?.inputSchema.properties?.indices).toBeDefined();

			const criteriaCheckTool = tools.find((t) => t.name === "criteria_check");
			expect(criteriaCheckTool?.description).toContain("Check/uncheck AC items");
			expect(criteriaCheckTool?.inputSchema.properties?.id).toBeDefined();
			expect(criteriaCheckTool?.inputSchema.properties?.indices).toBeDefined();
			expect(criteriaCheckTool?.inputSchema.properties?.checked).toBeDefined();

			const criteriaListTool = tools.find((t) => t.name === "criteria_list");
			expect(criteriaListTool?.description).toContain("List operation returns all AC");
			expect(criteriaListTool?.inputSchema.properties?.id).toBeDefined();
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
			expect(result.content[0]?.text).toContain("Task task-");
			expect(result.content[0]?.text).toContain("Test Task");
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
			expect(result.content[0]?.text).toContain("Task task-");
		});

		it("should validate required fields for task creation", async () => {
			const request = {
				params: {
					name: "task_create",
					arguments: { description: "Missing title" },
				},
			};

			// Validation errors should be returned as error responses, not thrown
			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Required field 'title'");
		});
	});

	describe("task_list tool", () => {
		// Create test tasks once per test instead of in beforeEach
		const setupTestTasks = async () => {
			await createTestTaskWithCriteria(mcpServer, {
				title: "Frontend Task",
				description: "UI development task",
				labels: ["frontend", "ui"],
			});

			await createTestTaskWithCriteria(mcpServer, {
				title: "Backend Task",
				description: "API development task",
				labels: ["backend", "api"],
			});
		};

		it("should list tasks with task_list tool", async () => {
			await setupTestTasks();

			const request = {
				params: {
					name: "task_list",
					arguments: {},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Frontend Task");
			expect(result.content[0]?.text).toContain("Backend Task");
		});

		it("should filter tasks by status", async () => {
			await setupTestTasks();

			// Update one task status
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
			expect(result.content[0]?.text).toContain("Frontend Task");
			expect(result.content[0]?.text).toContain("In Progress");
		});

		it("should filter tasks by labels", async () => {
			await setupTestTasks();

			// Filter by labels
			const request = {
				params: {
					name: "task_list",
					arguments: { labels: ["frontend"] },
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Frontend Task");
			expect(result.content[0]?.text).toContain("Frontend Task");
		});

		it("should search tasks by title and description", async () => {
			await setupTestTasks();

			// Search by title
			const titleSearch = await mcpServer.testInterface.callTool({
				params: {
					name: "task_list",
					arguments: { search: "Frontend" },
				},
			});
			expect(titleSearch.content[0]?.text).toContain("Frontend Task");

			// Search by description
			const descSearch = await mcpServer.testInterface.callTool({
				params: {
					name: "task_list",
					arguments: { search: "API" },
				},
			});
			expect(descSearch.content[0]?.text).toContain("Backend Task");
		});

		it("should limit task list results", async () => {
			await setupTestTasks();

			// Create additional tasks
			for (let i = 3; i <= 5; i++) {
				await createTestTaskWithCriteria(mcpServer, { title: `Task ${i}` });
			}

			// Request with limit
			const request = {
				params: {
					name: "task_list",
					arguments: { limit: 3 },
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Task 3");
		});
	});

	describe("task_update tool", () => {
		const setupTestTask = async () => {
			return await createTestTaskWithCriteria(mcpServer, {
				title: "Original Title",
			});
		};

		it("should update task with task_update tool", async () => {
			const { taskId } = await setupTestTask();

			// Update the task
			const request = {
				params: {
					name: "task_update",
					arguments: {
						id: taskId,
						title: "Updated Title",
						status: "Done",
						description: "Updated description",
					},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Updated Title");

			// Verify update by listing
			const listResult = await mcpServer.testInterface.callTool({
				params: { name: "task_list", arguments: {} },
			});
			expect(listResult.content[0]?.text).toContain("Updated Title");
			expect(listResult.content[0]?.text).toContain("Done");
		});

		it("should update task implementation notes", async () => {
			const { taskId } = await setupTestTask();

			// Update with implementation notes
			const request = {
				params: {
					name: "task_update",
					arguments: {
						id: taskId,
						implementationNotes: "Added user authentication flow",
					},
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content[0]?.text).toContain("Added user authentication flow");
		});

		it("should handle errors gracefully for non-existent task updates", async () => {
			const request = {
				params: {
					name: "task_update",
					arguments: { id: "non-existent-task", title: "New Title" },
				},
			};

			const result = await mcpServer.testInterface.callTool(request);
			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Task not found: non-existent-task");
		});
	});

	describe("acceptance criteria tools", () => {
		const setupACTestTask = async () => {
			return await createTestTaskWithCriteria(mcpServer, {
				title: "AC Test Task",
				description: "Task for testing acceptance criteria management",
			});
		};

		describe("criteria_add tool", () => {
			it("should add single acceptance criterion", async () => {
				const { taskId } = await setupACTestTask();

				const request = {
					params: {
						name: "criteria_add",
						arguments: {
							id: taskId,
							criteria: ["User can login with valid credentials"],
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("✅ **Successfully added 1 acceptance criteria to task task-1**");

				// Verify it was added
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: "task-1" } },
				});
				expect(listResult.content[0]?.text).toContain("#1 User can login with valid credentials");
			});

			it("should add multiple acceptance criteria", async () => {
				const { taskId } = await setupACTestTask();

				const request = {
					params: {
						name: "criteria_add",
						arguments: {
							id: taskId,
							criteria: [
								"User can login with valid credentials",
								"User receives error message for invalid credentials",
								"User can logout successfully",
							],
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain("✅ **Successfully added 3 acceptance criteria to task task-1**");

				// Verify all were added
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: "task-1" } },
				});
				expect(listResult.content[0]?.text).toContain("(0/3 completed)");
				expect(listResult.content[0]?.text).toContain("#1 User can login");
				expect(listResult.content[0]?.text).toContain("#2 User receives error");
				expect(listResult.content[0]?.text).toContain("#3 User can logout");
			});

			it("should handle validation errors for criteria_add", async () => {
				const { taskId } = await setupACTestTask();

				const request = {
					params: {
						name: "criteria_add",
						arguments: {
							id: taskId,
							criteria: [], // Empty array
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				// Should fail validation for empty criteria array
				const text = result.content[0]?.text as string;
				if (text.startsWith("{")) {
					const response = JSON.parse(text);
					expect(response.success).toBe(false);
					expect(response.error.code).toBe("VALIDATION_ERROR");
				} else {
					// If it passes validation, it should return success message
					expect(text).toContain("Successfully added 0 acceptance criteria");
				}
			});

			it("should handle non-existent task for criteria_add", async () => {
				const request = {
					params: {
						name: "criteria_add",
						arguments: {
							id: "non-existent-task",
							criteria: ["Test criterion"],
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("Task not found: non-existent-task");
			});
		});

		describe("criteria_list tool", () => {
			const setupCriteriaListTest = async () => {
				return await createTestTaskWithCriteria(
					mcpServer,
					{
						title: "AC Test Task",
						description: "Task for testing acceptance criteria management",
					},
					["Feature works correctly", "Tests are passing", "Documentation is updated"],
				);
			};

			it("should list all acceptance criteria with status", async () => {
				const { taskId } = await setupCriteriaListTest();

				const request = {
					params: {
						name: "criteria_list",
						arguments: { id: taskId },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain("📋 **Acceptance Criteria for task-1** (0/3 completed)");
				expect(result.content[0]?.text).toContain("- [ ] #1 Feature works correctly");
				expect(result.content[0]?.text).toContain("- [ ] #2 Tests are passing");
				expect(result.content[0]?.text).toContain("- [ ] #3 Documentation is updated");
			});

			it("should handle task with no acceptance criteria", async () => {
				// Create task without criteria
				const { taskId } = await createTestTaskWithCriteria(mcpServer, {
					title: "Empty Task",
				});

				const request = {
					params: {
						name: "criteria_list",
						arguments: { id: taskId },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain(`📋 **Task ${taskId}** has no acceptance criteria.`);
			});

			it("should handle non-existent task for criteria_list", async () => {
				const request = {
					params: {
						name: "criteria_list",
						arguments: { id: "non-existent-task" },
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("Task not found: non-existent-task");
			});
		});

		describe("criteria_check tool", () => {
			const setupCriteriaCheckTest = async () => {
				return await createTestTaskWithCriteria(
					mcpServer,
					{
						title: "AC Test Task",
						description: "Task for testing acceptance criteria management",
					},
					["Feature implemented", "Tests written", "Code reviewed", "Documentation updated"],
				);
			};

			it("should check single acceptance criterion", async () => {
				const { taskId } = await setupCriteriaCheckTest();

				const request = {
					params: {
						name: "criteria_check",
						arguments: {
							id: taskId,
							indices: [1],
							checked: true,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain(
					`✅ **Successfully checked 1 acceptance criteria for task ${taskId}**`,
				);

				// Verify it was checked
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: taskId } },
				});
				expect(listResult.content[0]?.text).toContain("(1/4 completed)");
				expect(listResult.content[0]?.text).toContain("- [x] #1 Feature implemented");
			});

			it("should support batch check operations", async () => {
				const { taskId } = await setupCriteriaCheckTest();

				const request = {
					params: {
						name: "criteria_check",
						arguments: {
							id: taskId,
							indices: [1, 3],
							checked: true,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain(
					`✅ **Successfully checked 2 acceptance criteria for task ${taskId}**`,
				);

				// Verify both were checked
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: taskId } },
				});
				expect(listResult.content[0]?.text).toContain("(2/4 completed)");
				expect(listResult.content[0]?.text).toContain("- [x] #1 Feature implemented");
				expect(listResult.content[0]?.text).toContain("- [x] #3 Code reviewed");
			});

			it("should uncheck acceptance criteria", async () => {
				const { taskId } = await setupCriteriaCheckTest();

				// First check some criteria
				await mcpServer.testInterface.callTool({
					params: {
						name: "criteria_check",
						arguments: { id: taskId, indices: [1, 2], checked: true },
					},
				});

				// Then uncheck one
				const request = {
					params: {
						name: "criteria_check",
						arguments: {
							id: taskId,
							indices: [1],
							checked: false,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain(
					`⬜ **Successfully unchecked 1 acceptance criteria for task ${taskId}**`,
				);

				// Verify the state
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: taskId } },
				});
				expect(listResult.content[0]?.text).toContain("(1/4 completed)");
				expect(listResult.content[0]?.text).toContain("- [ ] #1 Feature implemented");
				expect(listResult.content[0]?.text).toContain("- [x] #2 Tests written");
			});

			it("should handle invalid indices gracefully", async () => {
				const { taskId } = await setupCriteriaCheckTest();

				const request = {
					params: {
						name: "criteria_check",
						arguments: {
							id: taskId,
							indices: [10], // Invalid index
							checked: true,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("No criteria were updated");
			});

			it("should handle mixed valid/invalid indices", async () => {
				const { taskId } = await setupCriteriaCheckTest();

				const request = {
					params: {
						name: "criteria_check",
						arguments: {
							id: taskId,
							indices: [1, 10, 2], // Mix of valid and invalid
							checked: true,
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain(
					`✅ **Successfully checked 2 acceptance criteria for task ${taskId}**`,
				);

				// Verify only valid indices were updated
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: taskId } },
				});
				expect(listResult.content[0]?.text).toContain("(2/4 completed)");
			});
		});

		describe("criteria_remove tool", () => {
			let taskId: string;

			beforeEach(async () => {
				// Create a task with criteria for testing
				const { taskId: newTaskId } = await createTestTaskWithCriteria(
					mcpServer,
					{
						title: "Remove Test Task",
						description: "Task for testing criteria removal",
					},
					["First criterion", "Second criterion", "Third criterion", "Fourth criterion"],
				);
				taskId = newTaskId || "task-1";
			});

			it("should remove single acceptance criterion", async () => {
				const request = {
					params: {
						name: "criteria_remove",
						arguments: {
							id: taskId,
							indices: [2], // Remove second criterion
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain(
					`🗑️ **Successfully removed 1 acceptance criteria from task ${taskId}**`,
				);

				// Verify removal and renumbering
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: "task-1" } },
				});
				expect(listResult.content[0]?.text).toContain("(0/3 completed)");
				expect(listResult.content[0]?.text).toContain("#1 First criterion");
				expect(listResult.content[0]?.text).toContain("#2 Third criterion"); // Renumbered
				expect(listResult.content[0]?.text).toContain("#3 Fourth criterion"); // Renumbered
				expect(listResult.content[0]?.text).not.toContain("Second criterion");
			});

			it("should support batch remove operations", async () => {
				const request = {
					params: {
						name: "criteria_remove",
						arguments: {
							id: taskId,
							indices: [1, 3], // Remove first and third
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain(
					`🗑️ **Successfully removed 2 acceptance criteria from task ${taskId}**`,
				);

				// Verify removal and renumbering
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: "task-1" } },
				});
				expect(listResult.content[0]?.text).toContain("(0/2 completed)");
				expect(listResult.content[0]?.text).toContain("#1 Second criterion");
				expect(listResult.content[0]?.text).toContain("#2 Fourth criterion");
				expect(listResult.content[0]?.text).not.toContain("First criterion");
				expect(listResult.content[0]?.text).not.toContain("Third criterion");
			});

			it("should maintain order and formatting after removal", async () => {
				// Check some criteria first
				await mcpServer.testInterface.callTool({
					params: {
						name: "criteria_check",
						arguments: { id: taskId, indices: [2, 4], checked: true },
					},
				});

				// Remove middle criterion
				await mcpServer.testInterface.callTool({
					params: {
						name: "criteria_remove",
						arguments: { id: taskId, indices: [3] },
					},
				});

				// Verify checked status is preserved
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: "task-1" } },
				});
				expect(listResult.content[0]?.text).toContain("(2/3 completed)");
				expect(listResult.content[0]?.text).toContain("- [x] #2 Second criterion");
				expect(listResult.content[0]?.text).toContain("- [x] #3 Fourth criterion"); // Renumbered but still checked
			});

			it("should handle invalid indices gracefully", async () => {
				const request = {
					params: {
						name: "criteria_remove",
						arguments: {
							id: taskId,
							indices: [10], // Invalid index
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content).toHaveLength(1);
				expect(result.content[0]?.text).toContain("No criteria were removed");
			});

			it("should handle mixed valid/invalid indices", async () => {
				const request = {
					params: {
						name: "criteria_remove",
						arguments: {
							id: taskId,
							indices: [1, 10, 2], // Mix of valid and invalid
						},
					},
				};

				const result = await mcpServer.testInterface.callTool(request);
				expect(result.content[0]?.text).toContain(
					`🗑️ **Successfully removed 2 acceptance criteria from task ${taskId}**`,
				);

				// Verify only valid indices were removed
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: "task-1" } },
				});
				expect(listResult.content[0]?.text).toContain("(0/2 completed)");
			});
		});

		describe("acceptance criteria integration", () => {
			it("should maintain proper validation for all operations", async () => {
				// Test required field validation for all tools
				const tools = ["criteria_add", "criteria_remove", "criteria_check", "criteria_list"];

				for (const toolName of tools) {
					const request = {
						params: {
							name: toolName,
							arguments: {}, // Missing required 'id' field
						},
					};

					const result = await mcpServer.testInterface.callTool(request);
					expect(result.content).toHaveLength(1);
					expect(result.content[0]?.text).toContain("Required field 'id'");
				}
			});

			it("should work with workflow scenarios", async () => {
				// Create a task for the workflow test
				const { taskId } = await createTestTaskWithCriteria(mcpServer, {
					title: "Workflow Test Task",
					description: "Task for testing acceptance criteria workflow",
				});

				// Add initial criteria
				await mcpServer.testInterface.callTool({
					params: {
						name: "criteria_add",
						arguments: {
							id: taskId,
							criteria: [
								"Implement user registration",
								"Add input validation",
								"Write unit tests",
								"Update documentation",
							],
						},
					},
				});

				// Complete some criteria during development
				await mcpServer.testInterface.callTool({
					params: {
						name: "criteria_check",
						arguments: { id: taskId, indices: [1, 3], checked: true },
					},
				});

				// Add more criteria discovered during implementation
				await mcpServer.testInterface.callTool({
					params: {
						name: "criteria_add",
						arguments: {
							id: taskId,
							criteria: ["Add email verification", "Handle edge cases"],
						},
					},
				});

				// Remove criterion that's no longer needed
				await mcpServer.testInterface.callTool({
					params: {
						name: "criteria_remove",
						arguments: { id: taskId, indices: [2] }, // Remove validation criterion
					},
				});

				// Verify final state
				const listResult = await mcpServer.testInterface.callTool({
					params: { name: "criteria_list", arguments: { id: taskId } },
				});

				const content = listResult.content[0]?.text as string;
				expect(content).toContain("(2/5 completed)");
				expect(content).toContain("- [x] #1 Implement user registration");
				expect(content).toContain("- [x] #2 Write unit tests"); // This was checked in step 2
				expect(content).toContain("- [ ] #3 Update documentation"); // Was #3 after removal, now unchecked
				expect(content).toContain("- [ ] #4 Add email verification");
				expect(content).toContain("- [ ] #5 Handle edge cases");
				expect(content).not.toContain("Add input validation");
			});
		});
	});
});
