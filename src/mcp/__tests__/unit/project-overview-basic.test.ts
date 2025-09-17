import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { $ } from "bun";
import { createUniqueTestDir, safeCleanup } from "../../../test/test-utils.ts";
import { McpServer } from "../../server.ts";
import { registerProjectOverviewTools } from "../../tools/project-overview-tool.ts";
import { registerTaskTools } from "../../tools/task-tools.ts";

let TEST_DIR: string;

describe("Project Overview Tool - Basic Tests", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-project-overview-basic");
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

	test("should generate basic project overview with no tasks", async () => {
		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview"],
					securityLevel: "internal",
				},
			},
		});

		expect(result.isError).toBeFalsy(); // undefined or false
		expect(result.content).toBeDefined();

		const response = JSON.parse(result.content[0].text);
		expect(response.success).toBe(true);
		expect(response.overview.metadata.projectName).toBe("Test Project");
		expect(response.overview.summary.totalTasks).toBe(0);
		expect(response.overview.recommendations).toBeDefined();
		expect(response.overview.insights).toBeDefined();
	});

	test("should generate overview with basic tasks", async () => {
		// Create a simple task first
		await mcpServer.callTool({
			params: {
				name: "task_create",
				arguments: {
					title: "Test Task",
					description: "A test task",
					status: "To Do",
					assignee: ["alice"],
					labels: ["test"],
				},
			},
		});

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
		const response = JSON.parse(result.content[0].text);
		expect(response.success).toBe(true);
		expect(response.overview.summary.totalTasks).toBe(1);
		expect(response.overview.metrics.quality).toBeDefined();
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

	test("should handle different timeframe types", async () => {
		// Test days timeframe
		const daysResult = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "days", value: 7 },
					includeMetrics: ["overview"],
					securityLevel: "internal",
				},
			},
		});

		expect(daysResult.isError).toBeFalsy();
		const daysResponse = JSON.parse(daysResult.content[0].text);
		expect(daysResponse.success).toBe(true);

		// Test preset timeframe
		const presetResult = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last7days" },
					includeMetrics: ["overview"],
					securityLevel: "internal",
				},
			},
		});

		expect(presetResult.isError).toBeFalsy();
		const presetResponse = JSON.parse(presetResult.content[0].text);
		expect(presetResponse.success).toBe(true);
	});

	test("should include different metrics based on configuration", async () => {
		// Test with multiple metrics
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

		expect(result.isError).toBeFalsy();
		const response = JSON.parse(result.content[0].text);
		expect(response.success).toBe(true);
		expect(response.overview.metadata.metricsIncluded).toContain("overview");
		expect(response.overview.metadata.metricsIncluded).toContain("velocity");
		expect(response.overview.metadata.metricsIncluded).toContain("quality");
		expect(response.overview.metadata.metricsIncluded).toContain("team");
	});

	test("should handle custom timeframe", async () => {
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

		expect(result.isError).toBeFalsy();
		const response = JSON.parse(result.content[0].text);
		expect(response.success).toBe(true);
		expect(response.overview.metadata.timePeriod.start).toContain("2024-01-01");
		expect(response.overview.metadata.timePeriod.end).toContain("2024-01-31");
	});

	test("should handle invalid custom timeframe", async () => {
		const result = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: {
						type: "custom",
						start: "2024-01-31",
						end: "2024-01-01", // End before start
					},
					includeMetrics: ["overview"],
				},
			},
		});

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("start date must be before end date");
	});

	test("should respect security levels", async () => {
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

		expect(publicResult.isError).toBeFalsy();
		const publicResponse = JSON.parse(publicResult.content[0].text);
		expect(publicResponse.success).toBe(true);

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

		expect(internalResult.isError).toBeFalsy();
		const internalResponse = JSON.parse(internalResult.content[0].text);
		expect(internalResponse.success).toBe(true);

		// Test confidential access
		const confidentialResult = await mcpServer.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "preset", value: "last30days" },
					includeMetrics: ["overview"],
					securityLevel: "confidential",
				},
			},
		});

		expect(confidentialResult.isError).toBeFalsy();
		const confidentialResponse = JSON.parse(confidentialResult.content[0].text);
		expect(confidentialResponse.success).toBe(true);
	});
});
