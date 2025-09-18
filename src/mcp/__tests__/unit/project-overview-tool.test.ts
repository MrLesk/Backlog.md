import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { createUniqueTestDir, safeCleanup } from "../../../test/test-utils.ts";
import { McpServer } from "../../server.ts";
import { registerProjectOverviewTools } from "../../tools/project-overview-tool.ts";
import { registerTaskTools } from "../../tools/task-tools.ts";

let TEST_DIR: string;

describe("Project Overview Tool", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-project-overview");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize the project to create config with default statuses
		await mcpServer.initializeProject("Test Project");

		// Register tools
		registerTaskTools(mcpServer);
		registerProjectOverviewTools(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	test("should register project_overview tool", async () => {
		const tools = await mcpServer.listTools();
		const overviewTool = tools.tools.find((t) => t.name === "project_overview");

		expect(overviewTool).toBeDefined();
		expect(overviewTool?.description).toContain("comprehensive project overview");
	});

	test("should generate basic project overview", async () => {
		// Create test tasks
		await createTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "quality"],
					securityLevel: "internal",
				},
			},
		});

		expect(result.isError).toBeFalsy();
		expect(result.content).toBeDefined();

		const response = JSON.parse(result.content[0].text);
		expect(response.success).toBe(true);
		expect(response.overview.metadata.projectName).toBe("Test Project");
		expect(response.overview.summary.totalTasks).toBeGreaterThan(0);
		expect(response.overview.recommendations).toBeDefined();
		expect(response.overview.insights).toBeDefined();
	});

	test("should validate timeframe parameters", async () => {
		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "days", value: 500 }, // Invalid: too many days
					includeMetrics: ["overview"],
				},
			},
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("Days value must be between 1 and 365");
	});

	test("should apply security filtering", async () => {
		// Create tasks with different security levels
		await createSecurityTestTasks(mcpServer);

		// Test public access
		const publicResult = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview"],
					securityLevel: "public",
				},
			},
		});

		const publicResponse = JSON.parse(publicResult.content[0].text);
		const publicTaskCount = publicResponse.overview.summary.totalTasks;

		// Test internal access
		const internalResult = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview"],
					securityLevel: "internal",
				},
			},
		});

		const internalResponse = JSON.parse(internalResult.content[0].text);
		const internalTaskCount = internalResponse.overview.summary.totalTasks;

		// Internal should have access to more tasks than public
		expect(internalTaskCount).toBeGreaterThanOrEqual(publicTaskCount);
	});

	test("should generate team metrics", async () => {
		await createTeamTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "team"],
					securityLevel: "internal",
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.metrics.team).toBeDefined();
		expect(response.overview.metrics.team.size).toBeGreaterThan(0);
		expect(response.overview.metrics.team.workloadDistribution).toBeDefined();
	});

	test("should generate velocity metrics", async () => {
		await createVelocityTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "velocity"],
					securityLevel: "internal",
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.metrics.velocity).toBeDefined();
		expect(response.overview.metrics.velocity.weekly).toBeDefined();
		expect(response.overview.metrics.velocity.trend).toMatch(/increasing|decreasing|stable/);
	});

	test("should generate quality metrics", async () => {
		await createQualityTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "quality"],
					securityLevel: "internal",
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.metrics.quality).toBeDefined();
		expect(response.overview.metrics.quality.documentationRate).toMatch(/\d+%/);
		expect(response.overview.metrics.quality.acceptanceCriteriaRate).toMatch(/\d+%/);
	});

	test("should generate dependencies metrics", async () => {
		await createDependencyTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "dependencies"],
					securityLevel: "internal",
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.metrics.dependencies).toBeDefined();
		expect(response.overview.metrics.dependencies.dependencyRate).toMatch(/\d+%/);
		expect(response.overview.metrics.dependencies.criticalPath).toBeDefined();
	});

	test("should generate capacity analysis", async () => {
		await createCapacityTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "capacity"],
					securityLevel: "internal",
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.metrics.capacity).toBeDefined();
		expect(response.overview.metrics.capacity.currentCapacity).toBeGreaterThan(0);
		expect(response.overview.metrics.capacity.utilizationRate).toMatch(/\d+%/);
	});

	test("should respect team filter", async () => {
		await createTeamTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview"],
					securityLevel: "internal",
					teamFilter: ["alice"],
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.summary.totalTasks).toBeLessThanOrEqual(3); // Only Alice's tasks
	});

	test("should respect priority filter", async () => {
		await createPriorityTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview"],
					securityLevel: "internal",
					priorityFilter: ["high"],
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		// Should only include high priority tasks
		expect(response.overview.summary.totalTasks).toBeLessThanOrEqual(2);
	});

	test("should handle custom timeframe", async () => {
		await createDateTestTasks(mcpServer);

		const start = new Date("2024-01-01");
		const end = new Date("2024-01-31");

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: {
						type: "custom",
						start: start.toISOString(),
						end: end.toISOString(),
					},
					includeMetrics: ["overview"],
					securityLevel: "internal",
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.metadata.timePeriod.start).toContain("2024-01-01");
		expect(response.overview.metadata.timePeriod.end).toContain("2024-01-31");
	});

	test("should generate actionable recommendations", async () => {
		await createRecommendationTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "quality", "team"],
					securityLevel: "internal",
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.recommendations).toBeDefined();
		expect(response.overview.recommendations.length).toBeGreaterThan(0);

		const recommendation = response.overview.recommendations[0];
		expect(recommendation.type).toMatch(/performance|quality|process|team|risk/);
		expect(recommendation.priority).toMatch(/high|medium|low/);
		expect(recommendation.actionItems).toBeDefined();
		expect(recommendation.actionItems.length).toBeGreaterThan(0);
	});

	test("should generate insights", async () => {
		await createInsightTestTasks(mcpServer);

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "velocity", "quality"],
					securityLevel: "internal",
				},
			},
		});

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.insights).toBeDefined();

		if (response.overview.insights.length > 0) {
			const insight = response.overview.insights[0];
			expect(insight.category).toMatch(/trend|anomaly|opportunity|risk/);
			expect(insight.confidence).toMatch(/\d+%/);
		}
	});

	test("should handle performance optimization", async () => {
		// Create a large number of tasks to test performance
		await createLargeTestDataset(mcpServer, 100);

		const startTime = Date.now();

		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview", "velocity", "quality", "team"],
					securityLevel: "internal",
				},
			},
		});

		const endTime = Date.now();
		const duration = endTime - startTime;

		expect(result.isError).toBeFalsy();
		expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds

		const response = JSON.parse(result.content[0].text);
		expect(response.overview.summary.totalTasks).toBe(100);
	});
});

// Helper functions to create test data

async function createTestTasks(server: McpServer): Promise<void> {
	// Register task tools for test data creation
	const { registerTaskTools } = await import("../../tools/task-tools.ts");
	registerTaskTools(server);

	const tasks = [
		{
			title: "Complete user authentication",
			description: "Implement OAuth2 authentication",
			status: "Done",
			assignee: ["alice"],
			labels: ["backend", "security"],
		},
		{
			title: "Design user interface",
			description: "Create wireframes for main dashboard",
			status: "In Progress",
			assignee: ["bob"],
			labels: ["frontend", "ui"],
		},
		{
			title: "Setup CI/CD pipeline",
			description: "",
			status: "To Do",
			assignee: ["charlie"],
			labels: ["devops"],
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createSecurityTestTasks(server: McpServer): Promise<void> {
	const tasks = [
		{
			title: "Public feature",
			description: "Public facing feature",
			status: "Done",
			assignee: ["alice"],
			labels: ["public"],
		},
		{
			title: "Internal API",
			description: "Internal API endpoint",
			status: "In Progress",
			assignee: ["bob"],
			labels: ["internal", "api"],
		},
		{
			title: "Security audit",
			description: "Confidential security review",
			status: "To Do",
			assignee: ["charlie"],
			labels: ["confidential", "security"],
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createTeamTestTasks(server: McpServer): Promise<void> {
	const tasks = [
		{
			title: "Alice task 1",
			description: "Task for Alice",
			status: "Done",
			assignee: ["alice"],
			labels: ["frontend"],
		},
		{
			title: "Alice task 2",
			description: "Another task for Alice",
			status: "In Progress",
			assignee: ["alice"],
			labels: ["frontend"],
		},
		{
			title: "Alice task 3",
			description: "Third task for Alice",
			status: "To Do",
			assignee: ["alice"],
			labels: ["frontend"],
		},
		{
			title: "Bob task 1",
			description: "Task for Bob",
			status: "Done",
			assignee: ["bob"],
			labels: ["backend"],
		},
		{
			title: "Bob task 2",
			description: "Another task for Bob",
			status: "In Progress",
			assignee: ["bob"],
			labels: ["backend"],
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createVelocityTestTasks(server: McpServer): Promise<void> {
	const now = new Date();
	const tasks = [];

	// Create completed tasks from different time periods
	for (let i = 0; i < 5; i++) {
		const date = new Date(now);
		date.setDate(date.getDate() - i * 2); // Every 2 days

		tasks.push({
			title: `Completed task ${i + 1}`,
			description: "A completed task",
			status: "Done",
			assignee: ["alice"],
			labels: ["feature"],
			createdDate: date.toISOString(),
			updatedDate: date.toISOString(),
		});
	}

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createQualityTestTasks(server: McpServer): Promise<void> {
	const tasks = [
		{
			title: "Well documented task",
			description: "This task has a comprehensive description explaining what needs to be done and why it's important.",
			status: "To Do",
			assignee: ["alice"],
			labels: ["feature"],
			acceptanceCriteria: ["User can login successfully", "Session is maintained", "Logout works correctly"],
		},
		{
			title: "Poorly documented task",
			description: "",
			status: "To Do",
			assignee: ["bob"],
			labels: ["bug"],
		},
		{
			title: "Medium documented task",
			description: "Has description but no AC",
			status: "In Progress",
			assignee: ["charlie"],
			labels: ["enhancement"],
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createDependencyTestTasks(server: McpServer): Promise<void> {
	// First create the dependency task using the tool
	const depTaskResult = await server.callTool({
		params: {
			name: "task_create",
			arguments: {
				title: "Foundation task",
				description: "This task must be completed first",
				status: "To Do",
				assignee: ["alice"],
				labels: ["foundation"],
			},
		},
	});

	// Extract the task ID from the response text
	const responseText = depTaskResult.content[0].text;
	const match = responseText.match(/Successfully created task: .*\/(task-\d+)/);
	if (!match) {
		throw new Error(`Failed to extract task ID from response: ${responseText}`);
	}
	const depTaskId = match[1];

	// Then create tasks that depend on it
	const tasks = [
		{
			title: "Dependent task 1",
			description: "Depends on foundation task",
			status: "To Do",
			assignee: ["bob"],
			labels: ["feature"],
			dependencies: [depTaskId],
		},
		{
			title: "Dependent task 2",
			description: "Also depends on foundation task",
			status: "To Do",
			assignee: ["charlie"],
			labels: ["feature"],
			dependencies: [depTaskId],
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createCapacityTestTasks(server: McpServer): Promise<void> {
	const tasks = [
		{
			title: "Alice overload 1",
			description: "Task 1 for Alice",
			status: "In Progress",
			assignee: ["alice"],
			labels: ["feature"],
		},
		{
			title: "Alice overload 2",
			description: "Task 2 for Alice",
			status: "In Progress",
			assignee: ["alice"],
			labels: ["feature"],
		},
		{
			title: "Alice overload 3",
			description: "Task 3 for Alice",
			status: "In Progress",
			assignee: ["alice"],
			labels: ["feature"],
		},
		{
			title: "Bob normal task",
			description: "Normal task for Bob",
			status: "In Progress",
			assignee: ["bob"],
			labels: ["feature"],
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createPriorityTestTasks(server: McpServer): Promise<void> {
	const tasks = [
		{
			title: "High priority task 1",
			description: "Critical task",
			status: "To Do",
			assignee: ["alice"],
			labels: ["critical"],
			priority: "high" as const,
		},
		{
			title: "High priority task 2",
			description: "Another critical task",
			status: "In Progress",
			assignee: ["bob"],
			labels: ["critical"],
			priority: "high" as const,
		},
		{
			title: "Medium priority task",
			description: "Important task",
			status: "To Do",
			assignee: ["charlie"],
			labels: ["feature"],
			priority: "medium" as const,
		},
		{
			title: "Low priority task",
			description: "Nice to have",
			status: "To Do",
			assignee: ["alice"],
			labels: ["enhancement"],
			priority: "low" as const,
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createDateTestTasks(server: McpServer): Promise<void> {
	const tasks = [
		{
			title: "January 2024 task",
			description: "Task from January",
			status: "Done",
			assignee: ["alice"],
			labels: ["feature"],
			createdDate: "2024-01-15T10:00:00Z",
		},
		{
			title: "February 2024 task",
			description: "Task from February",
			status: "Done",
			assignee: ["bob"],
			labels: ["feature"],
			createdDate: "2024-02-15T10:00:00Z",
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createRecommendationTestTasks(server: McpServer): Promise<void> {
	// Create tasks that will trigger recommendations
	const tasks = [
		// Low completion rate scenario
		{
			title: "Incomplete task 1",
			description: "",
			status: "To Do",
			assignee: ["alice"],
			labels: ["feature"],
		},
		{
			title: "Incomplete task 2",
			description: "",
			status: "To Do",
			assignee: ["bob"],
			labels: ["feature"],
		},
		{
			title: "Incomplete task 3",
			description: "",
			status: "In Progress",
			assignee: ["charlie"],
			labels: ["feature"],
		},
		// Only one completed task for low completion rate
		{
			title: "Completed task",
			description: "The only completed task",
			status: "Done",
			assignee: ["alice"],
			labels: ["feature"],
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createInsightTestTasks(server: McpServer): Promise<void> {
	const tasks = [
		{
			title: "High quality task",
			description:
				"This task has excellent documentation and well-defined acceptance criteria, representing best practices.",
			status: "Done",
			assignee: ["alice"],
			labels: ["feature"],
			acceptanceCriteria: ["Feature works as expected", "Code is properly tested", "Documentation is updated"],
		},
		{
			title: "Another high quality task",
			description: "Another well-documented task with clear requirements and comprehensive acceptance criteria.",
			status: "Done",
			assignee: ["bob"],
			labels: ["feature"],
			acceptanceCriteria: ["Requirements are met", "Performance is acceptable", "No regressions introduced"],
		},
	];

	for (const task of tasks) {
		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}

async function createLargeTestDataset(server: McpServer, count: number): Promise<void> {
	const statuses = ["To Do", "In Progress", "Done"]; // Removed "Blocked" as it's not valid
	const assignees = ["alice", "bob", "charlie", "diana"];
	const labels = ["frontend", "backend", "mobile", "devops", "testing"];
	const priorities = ["high", "medium", "low"];

	for (let i = 0; i < count; i++) {
		const task = {
			title: `Task ${i + 1}`,
			description: `Description for task ${i + 1}`,
			status: statuses[i % statuses.length],
			assignee: [assignees[i % assignees.length]],
			labels: [labels[i % labels.length]],
			priority: priorities[i % priorities.length] as "high" | "medium" | "low",
		};

		await server.callTool({
			params: {
				name: "task_create",
				arguments: task,
			},
		});
	}
}
