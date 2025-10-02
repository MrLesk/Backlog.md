import type { TaskStatistics } from "../../core/statistics.ts";
import type { McpServer } from "../server.ts";

/**
 * Simplified handlers for project overview MCP tool
 * Provides only basic statistics that match CLI overview command
 */

export class ProjectOverviewHandlers {
	constructor(private server: McpServer) {}

	/**
	 * Generate basic project overview (CLI feature parity only)
	 */
	async generateBasicProjectOverview(): Promise<{
		success: boolean;
		data?: TaskStatistics;
		error?: { code: string; message: string };
	}> {
		try {
			// Use Core API to get basic statistics (CLI feature parity)
			const { tasks: activeTasks, drafts, statuses } = await this.server.loadAllTasksForStatistics();

			// Use the same statistics calculation as CLI overview command
			const { getTaskStatistics } = await import("../../core/statistics.ts");
			const statistics = getTaskStatistics(activeTasks, drafts, statuses);

			return {
				success: true,
				data: statistics,
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "COMPUTATION_ERROR",
					message: `Failed to generate project overview: ${error}`,
				},
			};
		}
	}
}
