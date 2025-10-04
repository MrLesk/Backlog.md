import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { createAsyncValidatedTool, type ValidationContext } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { ProjectOverviewHandlers } from "./project-overview-handlers.ts";

/**
 * Simplified task representation for MCP responses
 */
interface SimplifiedTask {
	id: string;
	title: string;
	createdDate?: string;
	updatedDate?: string;
	dependencies?: string[];
}

/**
 * Serialized project statistics type for MCP responses
 * Maps are converted to plain objects during serialization
 */
export interface SerializedTaskStatistics {
	statusCounts: Record<string, number>;
	priorityCounts: Record<string, number>;
	totalTasks: number;
	completedTasks: number;
	completionPercentage: number;
	draftCount: number;
	recentActivity: {
		created: SimplifiedTask[];
		updated: SimplifiedTask[];
	};
	projectHealth: {
		averageTaskAge: number;
		staleTasks: SimplifiedTask[];
		blockedTasks: SimplifiedTask[];
	};
}

/**
 * Helper function to format project overview as markdown
 */
function formatProjectOverviewMarkdown(statistics: SerializedTaskStatistics): string {
	const lines = ["# Project Overview", ""];

	// Project Statistics
	lines.push("## Project Statistics");
	lines.push("");
	lines.push("| Metric | Value |");
	lines.push("|--------|-------|");
	lines.push(`| Total Tasks | ${statistics.totalTasks} |`);
	lines.push(`| Completed Tasks | ${statistics.completedTasks} |`);
	lines.push(`| Completion Rate | ${statistics.completionPercentage}% |`);
	lines.push(`| Draft Tasks | ${statistics.draftCount} |`);
	lines.push("");

	// Status Breakdown
	lines.push("## Status Breakdown");
	lines.push("");
	lines.push("| Status | Count |");
	lines.push("|--------|-------|");
	for (const [status, count] of Object.entries(statistics.statusCounts)) {
		lines.push(`| ${status} | ${count} |`);
	}
	lines.push("");

	// Priority Breakdown
	if (Object.keys(statistics.priorityCounts).length > 0) {
		lines.push("## Priority Breakdown");
		lines.push("");
		lines.push("| Priority | Count |");
		lines.push("|----------|-------|");
		for (const [priority, count] of Object.entries(statistics.priorityCounts)) {
			const displayPriority =
				priority === "none" ? "No Priority" : priority.charAt(0).toUpperCase() + priority.slice(1);
			lines.push(`| ${displayPriority} | ${count} |`);
		}
		lines.push("");
	}

	// Recent Activity
	if (statistics.recentActivity.created.length > 0 || statistics.recentActivity.updated.length > 0) {
		lines.push("## Recent Activity");
		lines.push("");

		if (statistics.recentActivity.created.length > 0) {
			lines.push("### Recently Created");
			for (const task of statistics.recentActivity.created.slice(0, 5)) {
				lines.push(`- **${task.id}** - ${task.title} *(${task.createdDate})*`);
			}
			lines.push("");
		}

		if (statistics.recentActivity.updated.length > 0) {
			lines.push("### Recently Updated");
			for (const task of statistics.recentActivity.updated.slice(0, 5)) {
				lines.push(`- **${task.id}** - ${task.title} *(${task.updatedDate})*`);
			}
			lines.push("");
		}
	}

	// Project Health
	lines.push("## Project Health");
	lines.push("");
	lines.push(`**Average Task Age:** ${statistics.projectHealth.averageTaskAge} days`);
	lines.push("");

	if (statistics.projectHealth.staleTasks.length > 0) {
		lines.push("### ⚠️ Stale Tasks (No recent activity)");
		for (const task of statistics.projectHealth.staleTasks.slice(0, 5)) {
			const lastUpdated = task.updatedDate ? ` *(last updated: ${task.updatedDate})*` : "";
			lines.push(`- **${task.id}** - ${task.title}${lastUpdated}`);
		}
		if (statistics.projectHealth.staleTasks.length > 5) {
			lines.push(`- *...and ${statistics.projectHealth.staleTasks.length - 5} more*`);
		}
		lines.push("");
	}

	if (statistics.projectHealth.blockedTasks.length > 0) {
		lines.push("### 🚫 Blocked Tasks (Waiting on dependencies)");
		for (const task of statistics.projectHealth.blockedTasks.slice(0, 5)) {
			lines.push(`- **${task.id}** - ${task.title}`);
			lines.push(`  - Waiting on: ${task.dependencies?.join(", ") || ""}`);
		}
		if (statistics.projectHealth.blockedTasks.length > 5) {
			lines.push(`- *...and ${statistics.projectHealth.blockedTasks.length - 5} more*`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

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
						text: formatProjectOverviewMarkdown(response.statistics),
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
