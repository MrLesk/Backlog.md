import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { McpServer } from "../mcp/server.ts";
import { registerProjectOverviewTools, type SerializedTaskStatistics } from "../mcp/tools/project-overview-tool.ts";
import { registerTaskTools } from "../mcp/tools/task-tools.ts";
import { parseProjectOverviewMarkdown } from "./markdown-test-helpers.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

// Type for the parsed statistics that extends SerializedTaskStatistics with optional advanced features
// that should not exist in CLI parity mode
interface ParsedProjectStatistics extends SerializedTaskStatistics {
	// Advanced features that should not exist in CLI parity mode
	velocity?: unknown;
	quality?: unknown;
	team?: unknown;
	dependencies?: unknown;
	capacity?: unknown;
	trends?: unknown;
	recommendations?: unknown;
	insights?: unknown;
}

let TEST_DIR: string;

describe("Project Overview Tool (Simplified CLI Parity)", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-project-overview-simplified");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		// Initialize the project to create config with default statuses
		await mcpServer.initializeProject("Test Project");

		// Load config for dynamic schema generation
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load config");
		}

		// Register tools
		registerTaskTools(mcpServer, config);
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

	test("should register project_overview tool with simplified description", async () => {
		const tools = await mcpServer.testInterface.listTools();
		const overviewTool = tools.tools.find((t) => t.name === "project_overview");

		expect(overviewTool).toBeDefined();
		expect(overviewTool?.description).toContain("basic project overview");
		expect(overviewTool?.description).toContain("CLI overview command");
	});

	test("should generate CLI-compatible basic project overview", async () => {
		// Create test tasks
		await createTestTasks(mcpServer);

		const result = await mcpServer.testInterface.callTool({
			params: { name: "project_overview", arguments: {} },
		});

		expect(result.isError).toBeFalsy();
		expect(result.content).toBeDefined();

		const response = parseProjectOverviewMarkdown(result.content?.[0]?.text as string);
		expect(response.success).toBe(true);
		expect(response.statistics).toBeDefined();

		// Verify CLI-compatible structure
		const stats = response.statistics as ParsedProjectStatistics;
		expect(stats.statusCounts).toBeDefined();
		expect(stats.priorityCounts).toBeDefined();
		expect(stats.totalTasks).toBeDefined();
		expect(stats.completedTasks).toBeDefined();
		expect(stats.completionPercentage).toBeDefined();
		expect(stats.draftCount).toBeDefined();
		expect(stats.recentActivity).toBeDefined();
		expect(stats.projectHealth).toBeDefined();

		// Verify NO advanced features exist
		expect(stats.velocity).toBeUndefined();
		expect(stats.quality).toBeUndefined();
		expect(stats.team).toBeUndefined();
		expect(stats.dependencies).toBeUndefined();
		expect(stats.capacity).toBeUndefined();
		expect(stats.trends).toBeUndefined();
		expect(stats.recommendations).toBeUndefined();
		expect(stats.insights).toBeUndefined();
	});

	test("should not accept advanced parameters", async () => {
		await createTestTasks(mcpServer);

		// Should work with no parameters (simplified schema)
		const result = await mcpServer.testInterface.callTool({
			params: { name: "project_overview", arguments: {} },
		});
		expect(result.isError).toBeFalsy();

		// Should still work even if advanced parameters are passed (they're ignored)
		const result2 = await mcpServer.testInterface.callTool({
			params: {
				name: "project_overview",
				arguments: {
					timeframe: { type: "days", value: 30 },
					includeMetrics: ["velocity", "quality"],
					securityLevel: "internal",
				},
			},
		});
		expect(result2.isError).toBeFalsy();

		// Response should be identical (parameters ignored)
		const response1 = parseProjectOverviewMarkdown(result.content?.[0]?.text as string);
		const response2 = parseProjectOverviewMarkdown(result2.content?.[0]?.text as string);
		expect(response1.statistics.totalTasks).toBe(response2.statistics.totalTasks);
	});

	test("should match CLI overview data structure", async () => {
		await createTestTasks(mcpServer);

		const result = await mcpServer.testInterface.callTool({
			params: { name: "project_overview", arguments: {} },
		});
		const response = parseProjectOverviewMarkdown(result.content?.[0]?.text as string);
		const stats = response.statistics;

		// Verify exact structure matches TaskStatistics interface
		expect(typeof stats.statusCounts).toBe("object");
		expect(typeof stats.priorityCounts).toBe("object");
		expect(typeof stats.totalTasks).toBe("number");
		expect(typeof stats.completedTasks).toBe("number");
		expect(typeof stats.completionPercentage).toBe("number");
		expect(typeof stats.draftCount).toBe("number");

		expect(stats.recentActivity).toBeDefined();
		expect(Array.isArray(stats.recentActivity.created)).toBe(true);
		expect(Array.isArray(stats.recentActivity.updated)).toBe(true);

		expect(stats.projectHealth).toBeDefined();
		expect(typeof stats.projectHealth.averageTaskAge).toBe("number");
		expect(Array.isArray(stats.projectHealth.staleTasks)).toBe(true);
		expect(Array.isArray(stats.projectHealth.blockedTasks)).toBe(true);
	});
});

async function createTestTasks(mcpServer: McpServer): Promise<void> {
	// Create basic test tasks for CLI overview testing
	await mcpServer.testInterface.callTool({
		params: {
			name: "task_create",
			arguments: {
				title: "Test Task 1",
				status: "To Do",
				priority: "high",
			},
		},
	});

	await mcpServer.testInterface.callTool({
		params: {
			name: "task_create",
			arguments: {
				title: "Test Task 2",
				status: "In Progress",
				priority: "medium",
			},
		},
	});

	await mcpServer.testInterface.callTool({
		params: {
			name: "task_create",
			arguments: {
				title: "Test Task 3",
				status: "Done",
				priority: "low",
			},
		},
	});
}
