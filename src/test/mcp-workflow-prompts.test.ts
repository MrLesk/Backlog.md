import { describe, expect, test } from "bun:test";
import {
	codeReviewPrompt,
	dailyStandupPrompt,
	registerWorkflowPrompts,
	sprintPlanningPrompt,
	taskCreationPrompt,
} from "../mcp/prompts/workflow-prompts.ts";
import { McpServer } from "../mcp/server.ts";

describe("workflow prompts", () => {
	describe("taskCreationPrompt", () => {
		test("should have correct metadata", () => {
			expect(taskCreationPrompt.name).toBe("task_creation_workflow");
			expect(taskCreationPrompt.description).toContain("Guided task creation");
			expect(taskCreationPrompt.arguments).toBeDefined();
			expect(taskCreationPrompt.arguments).toHaveLength(2);

			const userRequirementArg = taskCreationPrompt.arguments?.find((arg) => arg.name === "userRequirement");
			expect(userRequirementArg?.required).toBe(true);

			const projectContextArg = taskCreationPrompt.arguments?.find((arg) => arg.name === "projectContext");
			expect(projectContextArg?.required).toBe(false);
		});

		test("should generate prompt with user requirement", async () => {
			const result = await taskCreationPrompt.handler({
				userRequirement: "Add dark mode toggle to settings page",
			});

			expect(result.description).toContain("Task creation workflow");
			expect(result.messages).toHaveLength(1);
			expect(result.messages[0]?.role).toBe("user");
			expect(result.messages[0]?.content.type).toBe("text");

			const content = result.messages[0]?.content.text;
			expect(content).toContain("Add dark mode toggle to settings page");
			expect(content).toContain("Title Generation");
			expect(content).toContain("Acceptance Criteria");
			expect(content).toContain("Labels Assignment");
		});

		test("should handle project context when provided", async () => {
			const result = await taskCreationPrompt.handler({
				userRequirement: "Add API endpoint",
				projectContext: "Express.js backend with TypeScript",
			});

			const content = result.messages[0]?.content.text;
			expect(content).toContain("Express.js backend with TypeScript");
			expect(content).toContain("Add API endpoint");
		});

		test("should handle missing project context gracefully", async () => {
			const result = await taskCreationPrompt.handler({
				userRequirement: "Fix login bug",
			});

			const content = result.messages[0]?.content.text;
			expect(content).toContain("No project context provided");
			expect(content).toContain("analyze the repository structure");
		});
	});

	describe("sprintPlanningPrompt", () => {
		test("should have correct metadata", () => {
			expect(sprintPlanningPrompt.name).toBe("sprint_planning_workflow");
			expect(sprintPlanningPrompt.description).toContain("Sprint planning workflow");
			expect(sprintPlanningPrompt.arguments).toBeDefined();
			expect(sprintPlanningPrompt.arguments).toHaveLength(3);

			// All arguments should be optional for sprint planning
			sprintPlanningPrompt.arguments?.forEach((arg) => {
				expect(arg.required).toBe(false);
			});
		});

		test("should generate sprint planning template", async () => {
			const result = await sprintPlanningPrompt.handler({});

			expect(result.description).toContain("Sprint planning workflow");
			expect(result.messages).toHaveLength(1);

			const content = result.messages[0]?.content.text;
			expect(content).toContain("Sprint Goal Definition");
			expect(content).toContain("Capacity Planning");
			expect(content).toContain("Task Selection Strategy");
			expect(content).toContain("Sprint Goals:");
		});

		test("should incorporate provided context", async () => {
			const result = await sprintPlanningPrompt.handler({
				boardState: "10 To Do, 3 In Progress, 15 Done",
				capacity: "40 person-hours available",
				priorities: "Focus on user authentication features",
			});

			const content = result.messages[0]?.content.text;
			expect(content).toContain("10 To Do, 3 In Progress, 15 Done");
			expect(content).toContain("40 person-hours available");
			expect(content).toContain("Focus on user authentication features");
		});

		test("should provide guidance when context is missing", async () => {
			const result = await sprintPlanningPrompt.handler({});

			const content = result.messages[0]?.content.text;
			expect(content).toContain("Analyze the current board state");
			expect(content).toContain("Assess team capacity");
			expect(content).toContain("Identify business priorities");
		});
	});

	describe("codeReviewPrompt", () => {
		test("should have correct metadata", () => {
			expect(codeReviewPrompt.name).toBe("code_review_workflow");
			expect(codeReviewPrompt.description).toContain("Code review integration");
			expect(codeReviewPrompt.arguments).toBeDefined();
			expect(codeReviewPrompt.arguments).toHaveLength(3);

			const taskIdArg = codeReviewPrompt.arguments?.find((arg) => arg.name === "taskId");
			expect(taskIdArg?.required).toBe(true);

			const prUrlArg = codeReviewPrompt.arguments?.find((arg) => arg.name === "prUrl");
			expect(prUrlArg?.required).toBe(false);

			const changesArg = codeReviewPrompt.arguments?.find((arg) => arg.name === "changes");
			expect(changesArg?.required).toBe(false);
		});

		test("should generate code review template with task ID", async () => {
			const result = await codeReviewPrompt.handler({
				taskId: "task-123",
			});

			expect(result.description).toContain("Code review workflow");
			expect(result.messages).toHaveLength(1);

			const content = result.messages[0]?.content.text;
			expect(content).toContain("task-123");
			expect(content).toContain("Task Alignment Check");
			expect(content).toContain("Code Quality Review");
			expect(content).toContain("Testing Verification");
			expect(content).toContain("Code Review Checklist for task-123");
		});

		test("should include PR URL and changes when provided", async () => {
			const result = await codeReviewPrompt.handler({
				taskId: "task-456",
				prUrl: "https://github.com/example/repo/pull/123",
				changes: "Added authentication middleware and login endpoint",
			});

			const content = result.messages[0]?.content.text;
			expect(content).toContain("https://github.com/example/repo/pull/123");
			expect(content).toContain("Added authentication middleware and login endpoint");
		});

		test("should handle missing optional parameters gracefully", async () => {
			const result = await codeReviewPrompt.handler({
				taskId: "task-789",
			});

			const content = result.messages[0]?.content.text;
			expect(content).toContain("Pull Request URL not provided");
			expect(content).toContain("Review the PR description and diff");
		});
	});

	describe("dailyStandupPrompt", () => {
		test("should have correct metadata", () => {
			expect(dailyStandupPrompt.name).toBe("daily_standup_workflow");
			expect(dailyStandupPrompt.description).toContain("Daily standup template");
			expect(dailyStandupPrompt.arguments).toBeDefined();
			expect(dailyStandupPrompt.arguments).toHaveLength(2);

			// Both arguments should be optional
			dailyStandupPrompt.arguments?.forEach((arg) => {
				expect(arg.required).toBe(false);
			});
		});

		test("should generate standup template with default date", async () => {
			const result = await dailyStandupPrompt.handler({});

			expect(result.description).toContain("Daily standup workflow");
			expect(result.messages).toHaveLength(1);

			const content = result.messages[0]?.content.text;
			expect(content).toContain("Board State Review");
			expect(content).toContain("Progress Updates");
			expect(content).toContain("Blocker Identification");
			expect(content).toContain("COMPLETED WORK:");
			expect(content).toContain("ACTIVE WORK:");
			expect(content).toContain("BLOCKERS:");

			// Should include current date
			const today = new Date().toISOString().split("T")[0];
			expect(content).toContain(today);
		});

		test("should use provided date and assignee", async () => {
			const result = await dailyStandupPrompt.handler({
				date: "2024-01-15",
				assignee: "john.doe",
			});

			const content = result.messages[0]?.content.text;
			expect(content).toContain("2024-01-15");
			expect(content).toContain("john.doe");
		});

		test("should handle team-wide standup when no assignee provided", async () => {
			const result = await dailyStandupPrompt.handler({
				date: "2024-01-15",
			});

			const content = result.messages[0]?.content.text;
			expect(content).toContain("Team-wide standup covering all active work");
		});
	});

	describe("registerWorkflowPrompts", () => {
		test("should register all workflow prompts on server", () => {
			const callHistory: unknown[] = [];
			const mockServer: Pick<McpServer, "addPrompt"> = {
				addPrompt: (prompt: unknown) => {
					callHistory.push(prompt);
				},
			};

			registerWorkflowPrompts(mockServer as McpServer);

			expect(callHistory).toHaveLength(4);
			expect(callHistory).toContain(taskCreationPrompt);
			expect(callHistory).toContain(sprintPlanningPrompt);
			expect(callHistory).toContain(codeReviewPrompt);
			expect(callHistory).toContain(dailyStandupPrompt);
		});
	});

	describe("integration with McpServer", () => {
		test("should be accessible through MCP server", async () => {
			// Create a test directory for the server
			const testDir = "/tmp/mcp-workflow-test";
			await Bun.write(`${testDir}/backlog.md`, "# Test Backlog\n");

			const mcpServer = new McpServer(testDir);
			registerWorkflowPrompts(mcpServer);

			// Test listing prompts
			const promptsList = await mcpServer.testInterface.listPrompts();
			expect(promptsList.prompts).toHaveLength(4);

			const promptNames = promptsList.prompts.map((p) => p.name);
			expect(promptNames).toContain("task_creation_workflow");
			expect(promptNames).toContain("sprint_planning_workflow");
			expect(promptNames).toContain("code_review_workflow");
			expect(promptNames).toContain("daily_standup_workflow");

			// Test getting a specific prompt
			const taskCreationResult = await mcpServer.testInterface.getPrompt({
				params: {
					name: "task_creation_workflow",
					arguments: { userRequirement: "Test requirement" },
				},
			});

			expect(taskCreationResult.description).toContain("Task creation workflow");
			expect(taskCreationResult.messages).toHaveLength(1);
			expect(taskCreationResult.messages[0]?.content.text).toContain("Test requirement");

			// Cleanup
			await Bun.$`rm -rf ${testDir}`.quiet();
		});

		test("should handle invalid prompt requests gracefully", async () => {
			const testDir = "/tmp/mcp-workflow-test-2";
			await Bun.write(`${testDir}/backlog.md`, "# Test Backlog\n");

			const mcpServer = new McpServer(testDir);
			registerWorkflowPrompts(mcpServer);

			// Test non-existent prompt
			await expect(
				mcpServer.testInterface.getPrompt({
					params: {
						name: "non_existent_prompt",
						arguments: {},
					},
				}),
			).rejects.toThrow("Prompt not found: non_existent_prompt");

			// Cleanup
			await Bun.$`rm -rf ${testDir}`.quiet();
		});
	});
});
