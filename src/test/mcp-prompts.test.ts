import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { registerWorkflowPrompts } from "../mcp/prompts/workflow-prompts.ts";
import { McpServer } from "../mcp/server.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("MCP Prompts", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-mcp-prompts");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize the project to create config with default statuses
		await mcpServer.initializeProject("Test Project");

		// Register workflow prompts for comprehensive testing
		registerWorkflowPrompts(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("basic prompt management", () => {
		it("should allow adding prompts and list them", async () => {
			const testPrompt = {
				name: "test-prompt",
				description: "A test prompt",
				arguments: [{ name: "input", description: "Input parameter", required: true }],
				handler: async () => ({ description: "Test prompt", messages: [] }),
			};

			mcpServer.addPrompt(testPrompt);

			const result = await mcpServer.testInterface.listPrompts();
			expect(result.prompts.length).toBeGreaterThanOrEqual(5); // 4 workflow prompts + 1 test prompt

			const testPromptResult = result.prompts.find((p) => p.name === "test-prompt");
			expect(testPromptResult?.name).toBe("test-prompt");
			expect(testPromptResult?.description).toBe("A test prompt");
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

		it("should list workflow prompts by default", async () => {
			const result = await mcpServer.testInterface.listPrompts();
			const promptNames = result.prompts.map((p) => p.name);

			expect(promptNames).toContain("task_creation_workflow");
			expect(promptNames).toContain("sprint_planning_workflow");
			expect(promptNames).toContain("code_review_workflow");
			expect(promptNames).toContain("daily_standup_workflow");
			expect(result.prompts).toHaveLength(4);
		});
	});

	describe("argument validation", () => {
		it("should enforce required arguments for task creation", async () => {
			const request = {
				params: {
					name: "task_creation_workflow",
					arguments: {}, // Missing required userRequirement
				},
			};

			await expect(mcpServer.testInterface.getPrompt(request)).rejects.toThrow(
				"userRequirement is required for task creation workflow",
			);
		});

		it("should handle optional arguments with defaults", async () => {
			const request = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Add search feature",
						// projectContext is optional
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			expect(result.description).toContain("Task creation workflow");

			const content = result.messages[0]?.content.text;
			expect(content).toContain("Add search feature");
			expect(content).toContain("No project context provided");
		});

		it("should reject invalid argument types gracefully", async () => {
			const invalidArgsTest = {
				name: "test-validation-prompt",
				description: "Validation test prompt",
				handler: async (args: Record<string, unknown>) => {
					// Validate argument types
					if (args.numericArg && typeof args.numericArg !== "number") {
						throw new Error("numericArg must be a number");
					}
					return { description: "Valid arguments", messages: [] };
				},
			};

			mcpServer.addPrompt(invalidArgsTest);

			const request = {
				params: {
					name: "test-validation-prompt",
					arguments: {
						numericArg: "not-a-number", // Invalid type
					},
				},
			};

			await expect(mcpServer.testInterface.getPrompt(request)).rejects.toThrow("numericArg must be a number");
		});

		it("should ignore extra/unknown arguments", async () => {
			const request = {
				params: {
					name: "sprint_planning_workflow",
					arguments: {
						boardState: "5 todo, 2 in progress",
						unknownArg: "should be ignored",
						anotherUnknown: 123,
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			expect(result.description).toContain("Sprint planning workflow");

			const content = result.messages[0]?.content.text;
			expect(content).toContain("5 todo, 2 in progress");
			// Unknown arguments should be ignored without error
		});

		it("should handle empty and null argument values", async () => {
			const request = {
				params: {
					name: "daily_standup_workflow",
					arguments: {
						date: "", // Empty string
						assignee: null, // Null value
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			expect(result.description).toContain("Daily standup workflow");

			const content = result.messages[0]?.content.text;
			// Should use defaults for empty/null values
			expect(content).toContain("Team-wide standup");
		});
	});

	describe("dynamic prompt generation", () => {
		it("should generate different prompt variations based on context", async () => {
			const request1 = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Fix login bug",
						projectContext: "React frontend with JWT auth",
					},
				},
			};

			const request2 = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Add API endpoint",
						projectContext: "Node.js backend with Express",
					},
				},
			};

			const result1 = await mcpServer.testInterface.getPrompt(request1);
			const result2 = await mcpServer.testInterface.getPrompt(request2);

			const content1 = result1.messages[0]?.content.text;
			const content2 = result2.messages[0]?.content.text;

			// Both should contain their specific requirements and contexts
			expect(content1).toContain("Fix login bug");
			expect(content1).toContain("React frontend with JWT auth");
			expect(content2).toContain("Add API endpoint");
			expect(content2).toContain("Node.js backend with Express");

			// Content should be different but structure similar
			expect(content1).not.toBe(content2);
		});

		it("should adapt prompt based on different parameter combinations", async () => {
			const minimal = {
				params: {
					name: "sprint_planning_workflow",
					arguments: {},
				},
			};

			const comprehensive = {
				params: {
					name: "sprint_planning_workflow",
					arguments: {
						boardState: "Complex board with 20 tasks across 3 statuses",
						capacity: "Team of 5 developers, 80 hours capacity",
						priorities: "Focus on performance optimization and user experience",
					},
				},
			};

			const minimalResult = await mcpServer.testInterface.getPrompt(minimal);
			const comprehensiveResult = await mcpServer.testInterface.getPrompt(comprehensive);

			const minimalContent = minimalResult.messages[0]?.content.text;
			const comprehensiveContent = comprehensiveResult.messages[0]?.content.text;

			// Minimal should have generic guidance
			expect(minimalContent).toContain("Analyze the current board state");
			expect(minimalContent).toContain("Assess team capacity");

			// Comprehensive should include specific details
			expect(comprehensiveContent).toContain("Complex board with 20 tasks");
			expect(comprehensiveContent).toContain("Team of 5 developers");
			expect(comprehensiveContent).toContain("performance optimization");
		});

		it("should interpolate various data types correctly", async () => {
			const testPrompt = {
				name: "data-type-test",
				description: "Test data type interpolation",
				handler: async (args: Record<string, unknown>) => {
					return {
						description: "Data type test",
						messages: [
							{
								role: "user" as const,
								content: {
									type: "text" as const,
									text: `String: ${args.stringVal}, Number: ${args.numberVal}, Boolean: ${args.booleanVal}, Array: ${JSON.stringify(args.arrayVal)}`,
								},
							},
						],
					};
				},
			};

			mcpServer.addPrompt(testPrompt);

			const request = {
				params: {
					name: "data-type-test",
					arguments: {
						stringVal: "hello world",
						numberVal: 42,
						booleanVal: true,
						arrayVal: ["item1", "item2"],
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			const content = result.messages[0]?.content.text;

			expect(content).toContain("String: hello world");
			expect(content).toContain("Number: 42");
			expect(content).toContain("Boolean: true");
			expect(content).toContain('Array: ["item1","item2"]');
		});

		it("should construct dynamic messages based on state", async () => {
			const request = {
				params: {
					name: "code_review_workflow",
					arguments: {
						taskId: "task-123",
						prUrl: "https://github.com/example/repo/pull/456",
						changes: "Added authentication system with JWT tokens and middleware",
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			expect(result.messages).toHaveLength(1);

			const content = result.messages[0]?.content.text;

			// Should dynamically construct the review context
			expect(content).toContain("Task: task-123");
			expect(content).toContain("Pull Request: https://github.com/example/repo/pull/456");
			expect(content).toContain("Changes Summary: Added authentication system");
			expect(content).toContain("Code Review Checklist for task-123");
		});
	});

	describe("context injection", () => {
		it("should inject project context into task creation prompts", async () => {
			const request = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Implement user dashboard",
						projectContext: "Vue.js SPA with Vuex state management, TypeScript, and Tailwind CSS",
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			const content = result.messages[0]?.content.text;

			expect(content).toContain("Project Context: Vue.js SPA with Vuex state management");
			expect(content).toContain("User Requirement: Implement user dashboard");
			expect(content).toContain("Technical labels: frontend, backend, api, ui, database");
		});

		it("should inject board state into sprint planning prompts", async () => {
			const request = {
				params: {
					name: "sprint_planning_workflow",
					arguments: {
						boardState: "To Do: 15 tasks, In Progress: 4 tasks, Done: 23 tasks, Total velocity: 12 story points/week",
						capacity: "3 developers, 2 QA, 120 person-hours available",
						priorities: "Critical: payment processing, High: user onboarding, Medium: analytics",
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			const content = result.messages[0]?.content.text;

			expect(content).toContain("Board State: To Do: 15 tasks, In Progress: 4 tasks");
			expect(content).toContain("Team Capacity: 3 developers, 2 QA, 120 person-hours");
			expect(content).toContain("Business Priorities: Critical: payment processing");
		});

		it("should inject PR and changes into code review prompts", async () => {
			const request = {
				params: {
					name: "code_review_workflow",
					arguments: {
						taskId: "task-789",
						prUrl: "https://github.com/company/project/pull/123",
						changes: "Refactored database layer with connection pooling, added query optimization, implemented caching",
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			const content = result.messages[0]?.content.text;

			expect(content).toContain("Task: task-789");
			expect(content).toContain("Pull Request: https://github.com/company/project/pull/123");
			expect(content).toContain("Changes Summary: Refactored database layer");
			expect(content).toContain("query optimization");
			expect(content).toContain("implemented caching");
		});

		it("should inject date and assignee into standup prompts", async () => {
			const request = {
				params: {
					name: "daily_standup_workflow",
					arguments: {
						date: "2024-03-15",
						assignee: "sarah.developer",
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(request);
			const content = result.messages[0]?.content.text;

			expect(content).toContain("Date: 2024-03-15");
			expect(content).toContain("Focus: sarah.developer");
			expect(content).toContain("Daily Standup - 2024-03-15");
		});
	});

	describe("multi-step workflows", () => {
		it("should support sequential prompt execution pattern", async () => {
			// Step 1: Create a task using task creation workflow
			const taskCreationRequest = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Implement user authentication system",
						projectContext: "New feature for existing React app",
					},
				},
			};

			const taskResult = await mcpServer.testInterface.getPrompt(taskCreationRequest);
			expect(taskResult.description).toContain("Task creation workflow");

			// Step 2: Plan sprint including this task
			const sprintPlanningRequest = {
				params: {
					name: "sprint_planning_workflow",
					arguments: {
						boardState: "To Do: 1 new authentication task, 5 existing tasks",
						capacity: "40 person-hours available",
						priorities: "Authentication is high priority",
					},
				},
			};

			const sprintResult = await mcpServer.testInterface.getPrompt(sprintPlanningRequest);
			expect(sprintResult.description).toContain("Sprint planning workflow");

			// Both results should be independent but complementary
			const taskContent = taskResult.messages[0]?.content.text;
			const sprintContent = sprintResult.messages[0]?.content.text;

			expect(taskContent).toContain("authentication system");
			expect(sprintContent).toContain("Authentication is high priority");
		});

		it("should simulate state persistence between workflow steps", async () => {
			// Simulate a workflow where information from one step influences the next
			const taskId = "task-456";

			// Step 1: Code review with specific findings
			const reviewRequest = {
				params: {
					name: "code_review_workflow",
					arguments: {
						taskId,
						prUrl: "https://github.com/example/repo/pull/789",
						changes: "Added unit tests, fixed memory leaks, optimized queries",
					},
				},
			};

			const reviewResult = await mcpServer.testInterface.getPrompt(reviewRequest);

			// Step 2: Standup referencing the reviewed task
			const standupRequest = {
				params: {
					name: "daily_standup_workflow",
					arguments: {
						date: "2024-03-16",
						assignee: "dev.team",
					},
				},
			};

			const standupResult = await mcpServer.testInterface.getPrompt(standupRequest);

			// Verify both workflows reference compatible information
			const reviewContent = reviewResult.messages[0]?.content.text;
			const standupContent = standupResult.messages[0]?.content.text;

			expect(reviewContent).toContain(taskId);
			expect(reviewContent).toContain("unit tests");
			expect(standupContent).toContain("COMPLETED WORK:");
			expect(standupContent).toContain("ACTIVE WORK:");
		});

		it("should support workflow branching based on responses", async () => {
			// Test different workflow paths based on task complexity
			const simpleTaskRequest = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Fix typo in documentation",
						projectContext: "Quick documentation fix",
					},
				},
			};

			const complexTaskRequest = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Redesign entire user interface with new design system",
						projectContext: "Major UI overhaul affecting all components",
					},
				},
			};

			const simpleResult = await mcpServer.testInterface.getPrompt(simpleTaskRequest);
			const complexResult = await mcpServer.testInterface.getPrompt(complexTaskRequest);

			const simpleContent = simpleResult.messages[0]?.content.text;
			const complexContent = complexResult.messages[0]?.content.text;

			// Both should follow the same template but adapt to complexity
			expect(simpleContent).toContain("Fix typo in documentation");
			expect(simpleContent).toContain("Type labels: feature, bug, enhancement");

			expect(complexContent).toContain("Redesign entire user interface");
			expect(complexContent).toContain("Major UI overhaul");
			expect(complexContent).toContain("Technical labels: frontend, backend, api, ui");
		});
	});

	describe("conditional prompts", () => {
		it("should show conditional sections based on provided arguments", async () => {
			const withContextRequest = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Add payment processing",
						projectContext: "E-commerce platform with Stripe integration",
					},
				},
			};

			const withoutContextRequest = {
				params: {
					name: "task_creation_workflow",
					arguments: {
						userRequirement: "Add payment processing",
					},
				},
			};

			const withContextResult = await mcpServer.testInterface.getPrompt(withContextRequest);
			const withoutContextResult = await mcpServer.testInterface.getPrompt(withoutContextRequest);

			const withContent = withContextResult.messages[0]?.content.text;
			const withoutContent = withoutContextResult.messages[0]?.content.text;

			// With context should show the provided context
			expect(withContent).toContain("Project Context: E-commerce platform with Stripe");

			// Without context should show the fallback message
			expect(withoutContent).toContain("No project context provided - analyze the repository");
		});

		it("should provide fallback messages for missing optional data", async () => {
			const minimalRequest = {
				params: {
					name: "sprint_planning_workflow",
					arguments: {}, // No optional data provided
				},
			};

			const result = await mcpServer.testInterface.getPrompt(minimalRequest);
			const content = result.messages[0]?.content.text;

			// Should contain fallback guidance
			expect(content).toContain("Analyze the current board state");
			expect(content).toContain("Assess team capacity");
			expect(content).toContain("Identify business priorities");
		});

		it("should adapt content based on argument presence", async () => {
			const codeReviewMinimal = {
				params: {
					name: "code_review_workflow",
					arguments: {
						taskId: "task-minimal",
					},
				},
			};

			const codeReviewComplete = {
				params: {
					name: "code_review_workflow",
					arguments: {
						taskId: "task-complete",
						prUrl: "https://github.com/example/repo/pull/999",
						changes: "Complete implementation with tests and documentation",
					},
				},
			};

			const minimalResult = await mcpServer.testInterface.getPrompt(codeReviewMinimal);
			const completeResult = await mcpServer.testInterface.getPrompt(codeReviewComplete);

			const minimalContent = minimalResult.messages[0]?.content.text;
			const completeContent = completeResult.messages[0]?.content.text;

			// Minimal should have fallback messages
			expect(minimalContent).toContain("Pull Request URL not provided");
			expect(minimalContent).toContain("Review the PR description and diff");

			// Complete should show all provided information
			expect(completeContent).toContain("Pull Request: https://github.com/example/repo/pull/999");
			expect(completeContent).toContain("Changes Summary: Complete implementation");
		});
	});

	describe("error handling", () => {
		it("should handle prompt handler errors gracefully", async () => {
			const errorPrompt = {
				name: "error-test-prompt",
				description: "A prompt that throws an error",
				handler: async () => {
					throw new Error("Handler failed for testing");
				},
			};

			mcpServer.addPrompt(errorPrompt);

			const request = {
				params: {
					name: "error-test-prompt",
					arguments: {},
				},
			};

			await expect(mcpServer.testInterface.getPrompt(request)).rejects.toThrow("Handler failed for testing");
		});

		it("should handle missing required arguments appropriately", async () => {
			const request = {
				params: {
					name: "code_review_workflow",
					arguments: {
						// Missing required taskId
						prUrl: "https://example.com/pr/123",
					},
				},
			};

			await expect(mcpServer.testInterface.getPrompt(request)).rejects.toThrow(
				"taskId is required for code review workflow",
			);
		});

		it("should handle malformed arguments properly", async () => {
			const malformedArgsPrompt = {
				name: "malformed-test",
				description: "Test malformed arguments",
				handler: async (args: Record<string, unknown>) => {
					// Simulate argument validation
					if (args.requiredField === undefined) {
						throw new Error("requiredField is missing");
					}
					if (typeof args.requiredField !== "string") {
						throw new Error("requiredField must be a string");
					}
					return { description: "Valid", messages: [] };
				},
			};

			mcpServer.addPrompt(malformedArgsPrompt);

			// Test 1: Missing required field
			const missingFieldRequest = {
				params: {
					name: "malformed-test",
					arguments: {
						otherField: "value",
					},
				},
			};

			await expect(mcpServer.testInterface.getPrompt(missingFieldRequest)).rejects.toThrow("requiredField is missing");

			// Test 2: Wrong type
			const wrongTypeRequest = {
				params: {
					name: "malformed-test",
					arguments: {
						requiredField: 123, // Should be string
					},
				},
			};

			await expect(mcpServer.testInterface.getPrompt(wrongTypeRequest)).rejects.toThrow(
				"requiredField must be a string",
			);

			// Test 3: Valid arguments should work
			const validRequest = {
				params: {
					name: "malformed-test",
					arguments: {
						requiredField: "valid string",
					},
				},
			};

			const result = await mcpServer.testInterface.getPrompt(validRequest);
			expect(result.description).toBe("Valid");
		});
	});
});
