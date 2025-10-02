import { generateKanbanBoardWithMetadata } from "../../board.ts";
import type { Task } from "../../types/index.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult, McpToolHandler } from "../types.ts";
import { createSimpleValidatedTool } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";

export class BoardToolHandlers {
	constructor(private server: McpServer) {}

	async getBoardView(args: {
		includeMetadata?: boolean;
		includeTasks?: boolean;
		taskFields?: string[];
		statusFilter?: string;
		limitPerStatus?: number;
		offsetPerStatus?: number;
	}): Promise<CallToolResult> {
		try {
			// Extract args with defaults
			const {
				includeMetadata = true,
				includeTasks = false,
				taskFields = ["id", "title", "status"],
				statusFilter,
				limitPerStatus = 50,
				offsetPerStatus = 0,
			} = args;

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

			// Group tasks by status with pagination
			const { columns, statusCounts, totalCounts, hasMore } = this.groupTasksByStatus(
				tasks,
				config.statuses,
				statusFilter,
				limitPerStatus,
				offsetPerStatus,
			);

			// Build response
			const boardData: {
				columns: Record<string, Partial<Task>[]> | Record<string, never>;
				metadata?: {
					totalTasks: number;
					completionRate: number;
					statusCounts: Record<string, number>;
					projectName: string;
					configuredStatuses: string[];
					boardMarkdown: string;
					pagination?: {
						applied: boolean;
						limitPerStatus: number;
						offsetPerStatus: number;
						totalByStatus: Record<string, number>;
						returnedByStatus: Record<string, number>;
						hasMore: Record<string, boolean>;
					};
				};
			} = {
				columns: {},
			};

			// Add columns (empty if includeTasks=false)
			if (includeTasks) {
				boardData.columns = this.filterTaskFields(columns, taskFields);
			} else {
				boardData.columns = {}; // Empty columns in summary mode
			}

			// Add metadata
			if (includeMetadata) {
				boardData.metadata = {
					totalTasks: tasks.length,
					completionRate: this.calculateCompletionRate(tasks, config.statuses),
					statusCounts: totalCounts, // Use total counts for metadata
					projectName: config.projectName,
					configuredStatuses: config.statuses,
					boardMarkdown: generateKanbanBoardWithMetadata(tasks, config.statuses, config.projectName),
				};

				// Add pagination info if applicable
				if (limitPerStatus || offsetPerStatus > 0 || statusFilter) {
					boardData.metadata.pagination = {
						applied: true,
						limitPerStatus,
						offsetPerStatus,
						totalByStatus: totalCounts,
						returnedByStatus: statusCounts,
						hasMore,
					};
				}
			}

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

	private groupTasksByStatus(
		tasks: Task[],
		_statuses: string[],
		statusFilter?: string,
		limitPerStatus = 50,
		offsetPerStatus = 0,
	): {
		columns: Record<string, Task[]>;
		statusCounts: Record<string, number>;
		totalCounts: Record<string, number>;
		hasMore: Record<string, boolean>;
	} {
		const columns: Record<string, Task[]> = {};
		const statusCounts: Record<string, number> = {};
		const totalCounts: Record<string, number> = {};
		const hasMore: Record<string, boolean> = {};
		const allByStatus: Record<string, Task[]> = {};

		// First pass: Group all tasks by status
		for (const task of tasks) {
			const status = task.status || "No Status";

			// Apply status filter
			if (statusFilter && status !== statusFilter) {
				continue;
			}

			if (!allByStatus[status]) {
				allByStatus[status] = [];
			}
			allByStatus[status].push(task);
		}

		// Second pass: Apply pagination
		for (const [status, statusTasks] of Object.entries(allByStatus)) {
			totalCounts[status] = statusTasks.length;

			// Apply offset and limit
			const startIndex = offsetPerStatus;
			const endIndex = offsetPerStatus + limitPerStatus;
			const paginatedTasks = statusTasks.slice(startIndex, endIndex);

			columns[status] = paginatedTasks;
			statusCounts[status] = paginatedTasks.length;
			hasMore[status] = endIndex < statusTasks.length;
		}

		return { columns, statusCounts, totalCounts, hasMore };
	}

	private filterTaskFields(columns: Record<string, Task[]>, fields: string[]): Record<string, Partial<Task>[]> {
		const filtered: Record<string, Partial<Task>[]> = {};

		for (const [status, tasks] of Object.entries(columns)) {
			filtered[status] = tasks.map((task) => {
				const filteredTask: Partial<Task> = {
					id: task.id,
					title: task.title,
					status: task.status,
				};

				// Include requested fields
				for (const field of fields) {
					if (field in task && !["id", "title", "status"].includes(field)) {
						(filteredTask as Record<string, unknown>)[field] = task[field as keyof Task];
					}
				}

				return filteredTask;
			});
		}

		return filtered;
	}

	private calculateCompletionRate(tasks: Task[], statuses: string[]): number {
		const completedStatuses = statuses.filter(
			(s) =>
				s.toLowerCase().includes("done") || s.toLowerCase().includes("complete") || s.toLowerCase().includes("closed"),
		);

		const completedTasks = tasks.filter((t) => completedStatuses.includes(t.status || "")).length;
		return tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
	}
}

const boardViewSchema: JsonSchema = {
	type: "object",
	properties: {
		includeMetadata: {
			type: "boolean",
			description: "Include metadata summary (default: true)",
		},
		includeTasks: {
			type: "boolean",
			description: "Include task objects in columns (default: false)",
		},
		taskFields: {
			type: "array",
			items: {
				type: "string",
				enum: [
					"id",
					"title",
					"status",
					"assignee",
					"labels",
					"priority",
					"createdDate",
					"updatedDate",
					"description",
					"implementationPlan",
					"implementationNotes",
					"acceptanceCriteriaItems",
					"dependencies",
					"subtasks",
				],
			},
			description: "Fields to include in task objects (default: ['id', 'title', 'status'])",
		},
		statusFilter: {
			type: "string",
			maxLength: 100,
			description: "Filter to single status column",
		},
		limitPerStatus: {
			type: "number",
			minimum: 1,
			description: "Maximum tasks per status column (default: 50)",
		},
		offsetPerStatus: {
			type: "number",
			minimum: 0,
			description: "Skip N tasks per status for pagination (default: 0)",
		},
	},
	required: [],
};

const createBoardViewTool = (handlers: BoardToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "board_view",
			description: `Get kanban board overview and task distribution with pagination support.

Default behavior (RECOMMENDED): Returns metadata summary only (~500 tokens):
- Status columns with task counts
- Completion rate and statistics
- Markdown board table

For task details: Set includeTasks=true and use:
- statusFilter: View one status column (e.g., "In Progress")
- limitPerStatus: Tasks per column (default: 50, no maximum)
- offsetPerStatus: Skip N tasks for pagination (default: 0)
- taskFields: Control which fields to include (default: id, title, status)

Pagination: Use offsetPerStatus to navigate large columns:
- Page 1: offsetPerStatus=0, limitPerStatus=50
- Page 2: offsetPerStatus=50, limitPerStatus=50
- Page 3: offsetPerStatus=100, limitPerStatus=50
Response includes hasMore flag to indicate if more tasks exist.

Examples:
- Overview: board_view()
- One column: board_view({ includeTasks: true, statusFilter: "In Progress" })
- Pagination: board_view({ includeTasks: true, statusFilter: "Done", limitPerStatus: 50, offsetPerStatus: 100 })
- Summary fields: board_view({ includeTasks: true, taskFields: ["id", "title", "assignee"] })`,
			inputSchema: boardViewSchema,
		},
		boardViewSchema,
		async (input, _context) => {
			return handlers.getBoardView({
				includeMetadata: input.includeMetadata as boolean,
				includeTasks: input.includeTasks as boolean,
				taskFields: input.taskFields as string[],
				statusFilter: input.statusFilter as string,
				limitPerStatus: input.limitPerStatus as number,
				offsetPerStatus: input.offsetPerStatus as number,
			});
		},
	);

export function registerBoardTools(server: McpServer): void {
	const handlers = new BoardToolHandlers(server);
	server.addTool(createBoardViewTool(handlers));
}

export { createBoardViewTool, boardViewSchema };
