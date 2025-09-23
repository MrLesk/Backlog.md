import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { createAsyncValidatedTool, type ValidationContext } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { ProjectOverviewHandlers } from "./project-overview-handlers.ts";

/**
 * Simplified project overview tool schema (CLI feature parity only)
 */
const projectOverviewSchema: JsonSchema = {
	type: "object",
	properties: {},
	required: [],
};

/**
 * Create project overview tool
 */
function createProjectOverviewTool(server: McpServer): McpToolHandler {
	const handlers = new ProjectOverviewHandlers(server);

	return createAsyncValidatedTool(
		{
			name: "project_overview",
			description: "Generate basic project overview with task statistics (same as CLI overview command)",
			inputSchema: projectOverviewSchema,
		},
		projectOverviewSchema,
		async (_input, _context) => [], // No additional validation needed
		async (_args: Record<string, unknown>, _context: ValidationContext) => {
			// Generate basic overview (no parameters needed - matches CLI)
			const result = await handlers.generateBasicProjectOverview();

			if (!result.success || !result.data) {
				return {
					content: [
						{
							type: "text",
							text: `Error generating project overview: ${result.error?.message || "Unknown error"}`,
						},
					],
					isError: true,
				};
			}

			// Format response using CLI-compatible data structure
			const statistics = result.data;

			// Convert Map objects to plain objects for JSON serialization
			const statusCounts = Object.fromEntries(statistics.statusCounts);
			const priorityCounts = Object.fromEntries(statistics.priorityCounts);

			const response = {
				success: true,
				statistics: {
					statusCounts,
					priorityCounts,
					totalTasks: statistics.totalTasks,
					completedTasks: statistics.completedTasks,
					completionPercentage: statistics.completionPercentage,
					draftCount: statistics.draftCount,
					recentActivity: {
						created: statistics.recentActivity.created.map((task) => ({
							id: task.id,
							title: task.title,
							createdDate: task.createdDate,
						})),
						updated: statistics.recentActivity.updated.map((task) => ({
							id: task.id,
							title: task.title,
							updatedDate: task.updatedDate,
						})),
					},
					projectHealth: {
						averageTaskAge: statistics.projectHealth.averageTaskAge,
						staleTasks: statistics.projectHealth.staleTasks.map((task) => ({
							id: task.id,
							title: task.title,
							updatedDate: task.updatedDate,
						})),
						blockedTasks: statistics.projectHealth.blockedTasks.map((task) => ({
							id: task.id,
							title: task.title,
							dependencies: task.dependencies,
						})),
					},
				},
			};

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(response, null, 2),
					},
				],
			};
		},
	);
}

// No additional parsing functions needed for simplified version

/**
 * Register project overview tools with the MCP server
 */
export function registerProjectOverviewTools(server: McpServer): void {
	server.addTool(createProjectOverviewTool(server));
}

// Export handlers for testing
export { ProjectOverviewHandlers };
