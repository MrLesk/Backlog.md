import { computeSequences } from "../../core/sequences.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult, McpToolHandler } from "../types.ts";

export class SequenceToolHandlers {
	constructor(private server: McpServer) {}

	async createSequence(args: { includeCompleted?: boolean; filterStatus?: string }): Promise<CallToolResult> {
		try {
			// Load all tasks
			const allTasks = await this.server.filesystem.listTasks();

			if (allTasks.length === 0) {
				const sequenceData = {
					unsequenced: [],
					sequences: [],
					metadata: {
						totalTasks: 0,
						filteredTasks: 0,
						includeCompleted: args.includeCompleted || false,
						filterStatus: args.filterStatus || null,
						sequenceCount: 0,
						unsequencedCount: 0,
						maxTasksInSequence: 0,
					},
				};

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(sequenceData, null, 2),
						},
					],
				};
			}

			// Filter tasks based on options
			let tasks = allTasks;

			// By default, exclude completed tasks (case-insensitive)
			if (!args.includeCompleted) {
				tasks = tasks.filter((t) => {
					const status = (t.status || "").toLowerCase();
					return status !== "done" && !status.includes("complete") && !status.includes("closed");
				});
			}

			// Filter by specific status if provided
			if (args.filterStatus) {
				const filterStatus = args.filterStatus.toLowerCase();
				tasks = tasks.filter((t) => (t.status || "").toLowerCase().includes(filterStatus));
			}

			// Compute sequences
			const result = computeSequences(tasks);

			// Add metadata
			const sequenceData = {
				...result,
				metadata: {
					totalTasks: allTasks.length,
					filteredTasks: tasks.length,
					includeCompleted: args.includeCompleted || false,
					filterStatus: args.filterStatus || null,
					sequenceCount: result.sequences.length,
					unsequencedCount: result.unsequenced.length,
					maxTasksInSequence:
						result.sequences.length > 0 ? Math.max(...result.sequences.map((s) => s.tasks.length)) : 0,
				},
			};

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(sequenceData, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error computing sequences: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
					},
				],
			};
		}
	}

	async planSequence(args: { taskIds?: string[]; includeCompleted?: boolean }): Promise<CallToolResult> {
		try {
			// Load all tasks
			const allTasks = await this.server.filesystem.listTasks();

			let tasks = allTasks;

			// Filter to specific task IDs if provided
			if (args.taskIds && args.taskIds.length > 0) {
				const taskIdSet = new Set(args.taskIds);
				tasks = tasks.filter((t) => taskIdSet.has(t.id));

				// Check for missing tasks
				const foundIds = new Set(tasks.map((t) => t.id));
				const missingIds = args.taskIds.filter((id) => !foundIds.has(id));

				if (missingIds.length > 0) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Tasks not found: ${missingIds.join(", ")}`,
							},
						],
					};
				}
			}

			// Filter completed tasks unless explicitly included
			if (!args.includeCompleted) {
				tasks = tasks.filter((t) => {
					const status = (t.status || "").toLowerCase();
					return status !== "done" && !status.includes("complete") && !status.includes("closed");
				});
			}

			// Compute sequences for planning
			const result = computeSequences(tasks);

			// Create execution plan
			const executionPlan = {
				phases: result.sequences.map((seq, index) => ({
					phase: index + 1,
					name: `Sequence ${seq.index}`,
					tasks: seq.tasks.map((task) => ({
						id: task.id,
						title: task.title,
						status: task.status || "No Status",
						dependencies: task.dependencies || [],
						estimatedEffort: (task as any).estimatedEffort || null,
						assignee: task.assignee || [],
					})),
					canRunInParallel: true,
					dependsOn: index > 0 ? [index] : [],
				})),
				unsequenced: result.unsequenced.map((task) => ({
					id: task.id,
					title: task.title,
					status: task.status || "No Status",
					reason: "No dependencies or dependents - can be done anytime",
				})),
				summary: {
					totalPhases: result.sequences.length,
					totalTasksInPlan: result.sequences.reduce((sum, seq) => sum + seq.tasks.length, 0),
					unsequencedTasks: result.unsequenced.length,
					canStartImmediately: result.sequences.length > 0 ? result.sequences[0]?.tasks.length || 0 : 0,
				},
			};

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(executionPlan, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error creating sequence plan: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
					},
				],
			};
		}
	}
}

const sequenceCreateTool = {
	name: "sequence_create",
	description: "Compute execution sequences from task dependencies",
	inputSchema: {
		type: "object",
		properties: {
			includeCompleted: {
				type: "boolean",
				description: "Include completed tasks in sequence computation (default: false)",
			},
			filterStatus: {
				type: "string",
				description: "Filter tasks by status (partial match, case-insensitive)",
			},
		},
		required: [],
	},
};

const sequencePlanTool = {
	name: "sequence_plan",
	description: "Create execution plan from task sequences with detailed phase information",
	inputSchema: {
		type: "object",
		properties: {
			taskIds: {
				type: "array",
				items: { type: "string" },
				description: "Specific task IDs to include in planning (optional - includes all if omitted)",
			},
			includeCompleted: {
				type: "boolean",
				description: "Include completed tasks in planning (default: false)",
			},
		},
		required: [],
	},
};

const createSequenceCreateTool = (handlers: SequenceToolHandlers): McpToolHandler => ({
	...sequenceCreateTool,
	handler: async (args: Record<string, unknown>) => {
		const { includeCompleted, filterStatus } = args;
		return handlers.createSequence({
			includeCompleted: includeCompleted as boolean,
			filterStatus: filterStatus as string,
		});
	},
});

const createSequencePlanTool = (handlers: SequenceToolHandlers): McpToolHandler => ({
	...sequencePlanTool,
	handler: async (args: Record<string, unknown>) => {
		const { taskIds, includeCompleted } = args;
		return handlers.planSequence({
			taskIds: taskIds as string[],
			includeCompleted: includeCompleted as boolean,
		});
	},
});

export function registerSequenceTools(server: McpServer): void {
	const handlers = new SequenceToolHandlers(server);
	server.addTool(createSequenceCreateTool(handlers));
	server.addTool(createSequencePlanTool(handlers));
}

export { createSequenceCreateTool, createSequencePlanTool };
