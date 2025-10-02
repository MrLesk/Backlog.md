import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { registerNotesTools } from "../mcp/tools/notes-tools.ts";
import { registerTaskTools } from "../mcp/tools/task-tools.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Notes Tools", () => {
	let mcpServer: McpServer;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let consoleWarnSpy: ReturnType<typeof spyOn>;

	beforeEach(async () => {
		// Suppress console output during tests
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
		consoleWarnSpy = spyOn(console, "warn").mockImplementation(() => {});

		TEST_DIR = createUniqueTestDir("test-notes-tools");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		// Initialize the project to create config with default statuses
		await mcpServer.initializeProject("Test Project");

		// Load config for dynamic schema generation
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load config");
		}

		// Register both task tools and notes tools
		registerTaskTools(mcpServer, config);
		registerNotesTools(mcpServer);
	});

	afterEach(async () => {
		// Restore console methods
		consoleErrorSpy?.mockRestore();
		consoleWarnSpy?.mockRestore();

		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("tool registration", () => {
		it("should register notes management tools", async () => {
			const result = await mcpServer.testInterface.listTools();
			const toolNames = result.tools.map((tool) => tool.name);

			expect(toolNames).toContain("notes_set");
			expect(toolNames).toContain("notes_append");
			expect(toolNames).toContain("notes_get");
			expect(toolNames).toContain("notes_clear");
			expect(toolNames).toContain("plan_set");
			expect(toolNames).toContain("plan_append");
			expect(toolNames).toContain("plan_get");
			expect(toolNames).toContain("plan_clear");
		});

		it("should have proper tool schemas", async () => {
			const result = await mcpServer.testInterface.listTools();
			const tools = result.tools;

			const notesSetTool = tools.find((t) => t.name === "notes_set");
			expect(notesSetTool?.description).toContain("Replace entire implementation notes");
			expect(notesSetTool?.inputSchema.properties?.id).toBeDefined();
			expect(notesSetTool?.inputSchema.properties?.content).toBeDefined();

			const notesAppendTool = tools.find((t) => t.name === "notes_append");
			expect(notesAppendTool?.description).toContain("Append to implementation notes");
			expect(notesAppendTool?.inputSchema.properties?.id).toBeDefined();
			expect(notesAppendTool?.inputSchema.properties?.content).toBeDefined();
			expect(notesAppendTool?.inputSchema.properties?.separator).toBeDefined();

			const notesGetTool = tools.find((t) => t.name === "notes_get");
			expect(notesGetTool?.description).toContain("Retrieve current implementation notes");
			expect(notesGetTool?.inputSchema.properties?.id).toBeDefined();

			const notesClearTool = tools.find((t) => t.name === "notes_clear");
			expect(notesClearTool?.description).toContain("Clear implementation notes");
			expect(notesClearTool?.inputSchema.properties?.id).toBeDefined();

			const planSetTool = tools.find((t) => t.name === "plan_set");
			expect(planSetTool?.description).toContain("Replace entire implementation plan");
			expect(planSetTool?.inputSchema.properties?.id).toBeDefined();
			expect(planSetTool?.inputSchema.properties?.content).toBeDefined();

			const planAppendTool = tools.find((t) => t.name === "plan_append");
			expect(planAppendTool?.description).toContain("Append to implementation plan");
			expect(planAppendTool?.inputSchema.properties?.id).toBeDefined();
			expect(planAppendTool?.inputSchema.properties?.content).toBeDefined();
			expect(planAppendTool?.inputSchema.properties?.separator).toBeDefined();

			const planGetTool = tools.find((t) => t.name === "plan_get");
			expect(planGetTool?.description).toContain("Retrieve current implementation plan");
			expect(planGetTool?.inputSchema.properties?.id).toBeDefined();

			const planClearTool = tools.find((t) => t.name === "plan_clear");
			expect(planClearTool?.description).toContain("Clear implementation plan");
			expect(planClearTool?.inputSchema.properties?.id).toBeDefined();
		});
	});

	describe("notes operations", () => {
		let taskId: string;

		beforeEach(async () => {
			// Create a test task first
			const createResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Test Task for Notes",
						description: "A test task for notes testing",
					},
				},
			});

			expect(createResponse.content).toHaveLength(1);
			expect(createResponse.content[0]?.text).toContain("Task task-1 - Test Task for Notes");
			// Extract task ID from the response text
			const responseText = createResponse.content[0]?.text as string;
			const match = responseText.match(/Task (task-\d+)/);
			expect(match).toBeTruthy();
			taskId = match?.[1] as string;
		});

		describe("notes_set tool", () => {
			it("should set implementation notes", async () => {
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_set",
						arguments: {
							id: taskId,
							content: "Initial implementation notes",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Notes Updated**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Content length: 28 characters");
			});

			it("should fail for non-existent task", async () => {
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_set",
						arguments: {
							id: "non-existent-task",
							content: "Some notes",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				expect(response.content[0]?.text).toContain("Task with ID 'non-existent-task' not found");
			});

			it("should enforce content size limit", async () => {
				const largeContent = "a".repeat(50001); // Exceed 50KB limit

				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_set",
						arguments: {
							id: taskId,
							content: largeContent,
						},
					},
				});

				expect(response.content).toHaveLength(1);
				// Should be rejected by schema validation or business logic
				expect(response.content[0]?.text).toMatch(/exceeds maximum length|Content exceeds maximum size limit/i);

				// console.error is not called for validation errors unless DEBUG is set
				// The validation error is properly handled and returned to the client
			});
		});

		describe("notes_append tool", () => {
			it("should append to empty notes", async () => {
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_append",
						arguments: {
							id: taskId,
							content: "First note entry",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Notes Appended**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Appended: 16 characters");
				expect(responseText).toContain("Total length: 16 characters");
			});

			it("should append to existing notes with default separator", async () => {
				// First set some notes
				await mcpServer.testInterface.callTool({
					params: {
						name: "notes_set",
						arguments: {
							id: taskId,
							content: "Initial notes",
						},
					},
				});

				// Then append
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_append",
						arguments: {
							id: taskId,
							content: "Additional notes",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Notes Appended**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Appended: 16 characters");
				expect(responseText).toContain("Total length: 31 characters");
			});

			it("should append with custom separator", async () => {
				// First set some notes
				await mcpServer.testInterface.callTool({
					params: {
						name: "notes_set",
						arguments: {
							id: taskId,
							content: "Initial",
						},
					},
				});

				// Then append with custom separator
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_append",
						arguments: {
							id: taskId,
							content: "Additional",
							separator: " | ",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Notes Appended**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Appended: 10 characters");
				expect(responseText).toContain("Total length: 20 characters"); // 7 + 3 + 10
				expect(responseText).toContain('Separator: " | "');
			});

			it("should reject invalid separator", async () => {
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_append",
						arguments: {
							id: taskId,
							content: "Some content",
							separator: "\x00", // Null character
						},
					},
				});

				expect(response.content).toHaveLength(1);
				expect(response.content[0]?.text).toContain("control characters");
			});

			it("should prevent exceeding size limit", async () => {
				// First set large notes
				const largeContent = "a".repeat(40000);
				await mcpServer.testInterface.callTool({
					params: {
						name: "notes_set",
						arguments: {
							id: taskId,
							content: largeContent,
						},
					},
				});

				// Try to append more content that would exceed limit
				const appendContent = "b".repeat(11000);
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_append",
						arguments: {
							id: taskId,
							content: appendContent,
						},
					},
				});

				expect(response.content).toHaveLength(1);
				expect(response.content[0]?.text).toContain("exceeds maximum size limit");
			});
		});

		describe("notes_get tool", () => {
			it("should get empty notes for new task", async () => {
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_get",
						arguments: {
							id: taskId,
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Notes**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Length: 0 characters");
				expect(responseText).toContain("*No implementation notes*");
			});

			it("should get existing notes", async () => {
				// First set some notes
				await mcpServer.testInterface.callTool({
					params: {
						name: "notes_set",
						arguments: {
							id: taskId,
							content: "Test notes content",
						},
					},
				});

				// Then get them
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_get",
						arguments: {
							id: taskId,
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Notes**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Length: 18 characters");
				expect(responseText).toContain("Test notes content");
			});

			it("should fail for non-existent task", async () => {
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_get",
						arguments: {
							id: "non-existent-task",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				expect(response.content[0]?.text).toContain("Task with ID 'non-existent-task' not found");
			});
		});

		describe("notes_clear tool", () => {
			it("should clear existing notes", async () => {
				// First set some notes
				await mcpServer.testInterface.callTool({
					params: {
						name: "notes_set",
						arguments: {
							id: taskId,
							content: "Notes to be cleared",
						},
					},
				});

				// Then clear them
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_clear",
						arguments: {
							id: taskId,
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Notes Cleared**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("All notes have been removed");

				// Verify they are cleared
				const getResponse = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_get",
						arguments: {
							id: taskId,
						},
					},
				});

				const getResponseText = getResponse.content[0]?.text as string;
				expect(getResponseText).toContain("Length: 0 characters");
				expect(getResponseText).toContain("*No implementation notes*");
			});

			it("should fail for non-existent task", async () => {
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "notes_clear",
						arguments: {
							id: "non-existent-task",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				expect(response.content[0]?.text).toContain("Task with ID 'non-existent-task' not found");
			});
		});
	});

	describe("plan operations", () => {
		let taskId: string;

		beforeEach(async () => {
			// Create a test task first
			const createResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Test Task for Plans",
						description: "A test task for plan testing",
					},
				},
			});

			expect(createResponse.content).toHaveLength(1);
			expect(createResponse.content[0]?.text).toContain("Task task-1 - Test Task for Plans");
			const responseText = createResponse.content[0]?.text as string;
			const match = responseText.match(/Task (task-\d+)/);
			expect(match).toBeTruthy();
			taskId = match?.[1] as string;
		});

		describe("plan_set tool", () => {
			it("should set implementation plan", async () => {
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "plan_set",
						arguments: {
							id: taskId,
							content: "Step 1: Analysis\nStep 2: Implementation\nStep 3: Testing",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Plan Updated**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Content length: 55 characters");
			});
		});

		describe("plan_append tool", () => {
			it("should append to implementation plan", async () => {
				// First set a plan
				await mcpServer.testInterface.callTool({
					params: {
						name: "plan_set",
						arguments: {
							id: taskId,
							content: "Step 1: Analysis",
						},
					},
				});

				// Then append
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "plan_append",
						arguments: {
							id: taskId,
							content: "Step 2: Implementation",
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Plan Appended**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Appended: 22 characters");
				expect(responseText).toContain("Total length: 40 characters"); // 16 + 2 + 22
			});
		});

		describe("plan_get tool", () => {
			it("should get implementation plan", async () => {
				// First set a plan
				await mcpServer.testInterface.callTool({
					params: {
						name: "plan_set",
						arguments: {
							id: taskId,
							content: "Detailed plan content",
						},
					},
				});

				// Then get it
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "plan_get",
						arguments: {
							id: taskId,
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Plan**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("Length: 21 characters");
				expect(responseText).toContain("Detailed plan content");
			});
		});

		describe("plan_clear tool", () => {
			it("should clear implementation plan", async () => {
				// First set a plan
				await mcpServer.testInterface.callTool({
					params: {
						name: "plan_set",
						arguments: {
							id: taskId,
							content: "Plan to be cleared",
						},
					},
				});

				// Then clear it
				const response = await mcpServer.testInterface.callTool({
					params: {
						name: "plan_clear",
						arguments: {
							id: taskId,
						},
					},
				});

				expect(response.content).toHaveLength(1);
				const responseText = response.content[0]?.text as string;
				expect(responseText).toContain("**Implementation Plan Cleared**");
				expect(responseText).toContain(taskId);
				expect(responseText).toContain("All plan content has been removed");

				// Verify it's cleared
				const getResponse = await mcpServer.testInterface.callTool({
					params: {
						name: "plan_get",
						arguments: {
							id: taskId,
						},
					},
				});

				const getResponseText = getResponse.content[0]?.text as string;
				expect(getResponseText).toContain("Length: 0 characters");
				expect(getResponseText).toContain("*No implementation plan*");
			});
		});
	});

	describe("integration with existing systems", () => {
		let taskId: string;

		beforeEach(async () => {
			// Create a test task with initial notes
			const createResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Integration Test Task",
						description: "A test task for integration testing",
					},
				},
			});

			expect(createResponse.content).toHaveLength(1);
			expect(createResponse.content[0]?.text).toContain("Task task-1 - Integration Test Task");
			const responseText = createResponse.content[0]?.text as string;
			const match = responseText.match(/Task (task-\d+)/);
			expect(match).toBeTruthy();
			taskId = match?.[1] as string;
		});

		it("should work with task_update tool", async () => {
			// Set notes via notes tool
			await mcpServer.testInterface.callTool({
				params: {
					name: "notes_set",
					arguments: {
						id: taskId,
						content: "Notes set via notes tool",
					},
				},
			});

			// Update task via task_update tool
			const updateResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "task_update",
					arguments: {
						id: taskId,
						title: "Updated Task Title",
						implementationNotes: "Notes updated via task_update",
					},
				},
			});

			expect(updateResponse.content).toHaveLength(1);
			expect(updateResponse.content[0]?.text).toContain("Task task-1 - Updated Task Title");

			// Verify the notes were updated
			const getResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "notes_get",
					arguments: {
						id: taskId,
					},
				},
			});

			const getResponseText = getResponse.content[0]?.text as string;
			expect(getResponseText).toContain("**Implementation Notes**");
			expect(getResponseText).toContain("Notes updated via task_update");
		});

		it("should preserve basic markdown formatting", async () => {
			const markdownContent = "# Title\n\nSome content with **bold** and *italic*.";

			// Set notes with markdown
			const setResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "notes_set",
					arguments: {
						id: taskId,
						content: markdownContent,
					},
				},
			});

			const setResponseText = setResponse.content[0]?.text as string;
			expect(setResponseText).toContain("**Implementation Notes Updated**");
			expect(setResponseText).toContain(`Content length: ${markdownContent.length} characters`);

			// Get notes back
			const getResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "notes_get",
					arguments: {
						id: taskId,
					},
				},
			});

			const getResponseText = getResponse.content[0]?.text as string;
			expect(getResponseText).toContain("**Implementation Notes**");
			expect(getResponseText).toContain(markdownContent);
		});
	});

	describe("performance testing", () => {
		let taskId: string;

		beforeEach(async () => {
			const createResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "task_create",
					arguments: {
						title: "Performance Test Task",
						description: "A test task for performance testing",
					},
				},
			});

			expect(createResponse.content).toHaveLength(1);
			expect(createResponse.content[0]?.text).toContain("Task task-1 - Performance Test Task");
			const responseText = createResponse.content[0]?.text as string;
			const match = responseText.match(/Task (task-\d+)/);
			expect(match).toBeTruthy();
			taskId = match?.[1] as string;
		});

		it("should handle large content efficiently", async () => {
			const largeContent = "a".repeat(40000); // 40KB content

			const startTime = Date.now();
			const response = await mcpServer.testInterface.callTool({
				params: {
					name: "notes_set",
					arguments: {
						id: taskId,
						content: largeContent,
					},
				},
			});
			const endTime = Date.now();

			expect(response.content).toHaveLength(1);
			const responseText = response.content[0]?.text as string;
			expect(responseText).toContain("**Implementation Notes Updated**");
			expect(responseText).toContain(`Content length: ${largeContent.length} characters`);
			expect(endTime - startTime).toBeLessThan(200); // Should complete within 200ms

			// Verify content is preserved
			const getResponse = await mcpServer.testInterface.callTool({
				params: {
					name: "notes_get",
					arguments: {
						id: taskId,
					},
				},
			});

			const getResponseText = getResponse.content[0]?.text as string;
			expect(getResponseText).toContain("**Implementation Notes**");
			expect(getResponseText).toContain(largeContent);
			expect(getResponseText).toContain("Length: 40000 characters");
		});
	});
});
