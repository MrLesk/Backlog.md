import { generateKanbanBoardWithMetadata } from "../../board.ts";
import type { Task } from "../../types/index.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult, McpToolHandler } from "../types.ts";

export class BoardToolHandlers {
	constructor(private server: McpServer) {}

	async getBoardView(args: { includeMetadata?: boolean }): Promise<CallToolResult> {
		try {
			// Load tasks and config
			const tasks = await this.server.filesystem.listTasks();
			const config = await this.server.filesystem.loadConfig();

			if (!config) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Configuration not found. Please run 'backlog init' first.",
						},
					],
				};
			}

			// Generate board data
			const { includeMetadata = true } = args;

			// Calculate metadata
			const totalTasks = tasks.length;
			const statusCounts: Record<string, number> = {};
			const columns: Record<string, Task[]> = {};

			// Group tasks by status
			for (const task of tasks) {
				const status = task.status || "No Status";
				if (!columns[status]) {
					columns[status] = [];
					statusCounts[status] = 0;
				}
				columns[status].push(task);
				statusCounts[status] = (statusCounts[status] || 0) + 1;
			}

			// Calculate completion rate based on configured statuses
			const completedStatuses = config.statuses.filter(
				(status) =>
					status.toLowerCase().includes("done") ||
					status.toLowerCase().includes("complete") ||
					status.toLowerCase().includes("closed"),
			);
			const completedTasks = tasks.filter((task) => completedStatuses.includes(task.status || "")).length;
			const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

			// Build response data
			const boardData = {
				columns,
				...(includeMetadata && {
					metadata: {
						totalTasks,
						completionRate,
						statusCounts,
						projectName: config.projectName,
						configuredStatuses: config.statuses,
						boardMarkdown: generateKanbanBoardWithMetadata(tasks, config.statuses, config.projectName),
					},
				}),
			};

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(boardData, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error retrieving board view: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
					},
				],
			};
		}
	}
}

const boardViewTool = {
	name: "board_view",
	description: "Get current kanban board state with task distribution and optional metadata",
	inputSchema: {
		type: "object",
		properties: {
			includeMetadata: {
				type: "boolean",
				description: "Include additional metadata like completion rates and project info (default: true)",
			},
		},
		required: [],
	},
};

const createBoardViewTool = (handlers: BoardToolHandlers): McpToolHandler => ({
	...boardViewTool,
	handler: async (args: Record<string, unknown>) => {
		const { includeMetadata } = args;
		return handlers.getBoardView({
			includeMetadata: includeMetadata as boolean,
		});
	},
});

export function registerBoardTools(server: McpServer): void {
	const handlers = new BoardToolHandlers(server);
	server.addTool(createBoardViewTool(handlers));
}

export { createBoardViewTool };
