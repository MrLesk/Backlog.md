import { computeSequences } from "../../core/sequences.ts";
import type { Sequence, Task } from "../../types/index.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult, McpToolHandler } from "../types.ts";
import { createSimpleValidatedTool } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";

/**
 * Metadata for sequence creation response
 */
interface SequenceCreateMetadata {
	totalTasks: number;
	filteredTasks: number;
	sequenceCount: number;
	unsequencedCount: number;
	includeCompleted: boolean;
	filterStatus: string | null;
	maxTasksInSequence: number;
}

/**
 * Complete sequence creation data structure
 */
interface SequenceCreateData {
	unsequenced: Task[];
	sequences: Sequence[];
	metadata: SequenceCreateMetadata;
}

/**
 * Helper function to format sequence_create results as markdown
 */
function formatSequenceCreateMarkdown(sequenceData: SequenceCreateData): string {
	const lines = ["# Task Execution Sequences", ""];

	// Metadata summary
	lines.push("## Summary");
	lines.push("");
	lines.push("| Metric | Value |");
	lines.push("|--------|-------|");
	lines.push(`| Total Tasks | ${sequenceData.metadata.totalTasks} |`);
	lines.push(`| Filtered Tasks | ${sequenceData.metadata.filteredTasks} |`);
	lines.push(`| Sequences | ${sequenceData.metadata.sequenceCount} |`);
	lines.push(`| Unsequenced Tasks | ${sequenceData.metadata.unsequencedCount} |`);
	lines.push(`| Include Completed | ${sequenceData.metadata.includeCompleted} |`);
	if (sequenceData.metadata.filterStatus) {
		lines.push(`| Filter Status | ${sequenceData.metadata.filterStatus} |`);
	}
	lines.push("");

	// Sequences
	if (sequenceData.sequences && sequenceData.sequences.length > 0) {
		lines.push("## Execution Sequences");
		lines.push("");

		for (const sequence of sequenceData.sequences) {
			lines.push(`### Sequence ${sequence.index}`);
			lines.push("");
			lines.push("**Tasks in order:**");
			for (const task of sequence.tasks) {
				lines.push(`- **${task.id}** - ${task.title} (${task.status})`);
			}
			lines.push("");
		}
	}

	// Unsequenced tasks
	if (sequenceData.unsequenced && sequenceData.unsequenced.length > 0) {
		lines.push("## Unsequenced Tasks");
		lines.push("");
		lines.push("These tasks can be done in any order:");
		lines.push("");
		for (const task of sequenceData.unsequenced) {
			lines.push(`- **${task.id}** - ${task.title} (${task.status})`);
		}
		lines.push("");
	}

	if (sequenceData.sequences.length === 0 && sequenceData.unsequenced.length === 0) {
		lines.push("No tasks found matching the criteria.");
	}

	return lines.join("\n");
}

/**
 * Task data in execution plan phase
 */
interface ExecutionPlanTask {
	id: string;
	title: string;
	status: string;
	dependencies: string[];
	estimatedEffort: unknown;
	assignee: string[];
}

/**
 * Phase in execution plan
 */
interface ExecutionPlanPhase {
	phase: number;
	name: string;
	tasks: ExecutionPlanTask[];
	canRunInParallel: boolean;
	dependsOn: number[];
}

/**
 * Unsequenced task in execution plan
 */
interface ExecutionPlanUnsequenced {
	id: string;
	title: string;
	status: string;
	reason: string;
}

/**
 * Summary of execution plan
 */
interface ExecutionPlanSummary {
	totalPhases: number;
	totalTasksInPlan: number;
	unsequencedTasks: number;
	canStartImmediately: number;
}

/**
 * Complete execution plan data structure
 */
interface ExecutionPlan {
	phases: ExecutionPlanPhase[];
	unsequenced: ExecutionPlanUnsequenced[];
	summary: ExecutionPlanSummary;
}

/**
 * Helper function to format sequence_plan results as markdown
 */
function formatSequencePlanMarkdown(executionPlan: ExecutionPlan): string {
	const lines = ["# Execution Plan", ""];

	// Summary
	lines.push("## Summary");
	lines.push("");
	lines.push("| Metric | Value |");
	lines.push("|--------|-------|");
	lines.push(`| Total Phases | ${executionPlan.summary.totalPhases} |`);
	lines.push(`| Tasks in Plan | ${executionPlan.summary.totalTasksInPlan} |`);
	lines.push(`| Unsequenced Tasks | ${executionPlan.summary.unsequencedTasks} |`);
	lines.push(`| Can Start Immediately | ${executionPlan.summary.canStartImmediately} |`);
	lines.push("");

	// Phases
	if (executionPlan.phases && executionPlan.phases.length > 0) {
		lines.push("## Execution Phases");
		lines.push("");

		for (const phase of executionPlan.phases) {
			lines.push(`### Phase ${phase.phase}: ${phase.name}`);
			lines.push("");
			if (phase.dependsOn && phase.dependsOn.length > 0) {
				lines.push(`**Depends on:** Phase ${phase.dependsOn.join(", Phase ")}`);
				lines.push("");
			}
			lines.push("**Tasks:**");
			for (const task of phase.tasks) {
				const assigneeText = task.assignee && task.assignee.length > 0 ? ` (${task.assignee.join(", ")})` : "";
				lines.push(`- **${task.id}** - ${task.title} (${task.status})${assigneeText}`);
				if (task.dependencies && task.dependencies.length > 0) {
					lines.push(`  - Dependencies: ${task.dependencies.join(", ")}`);
				}
			}
			lines.push("");
		}
	}

	// Unsequenced tasks
	if (executionPlan.unsequenced && executionPlan.unsequenced.length > 0) {
		lines.push("## Unsequenced Tasks");
		lines.push("");
		lines.push("These tasks have no dependencies and can be done anytime:");
		lines.push("");
		for (const task of executionPlan.unsequenced) {
			lines.push(`- **${task.id}** - ${task.title} (${task.status})`);
			lines.push(`  - ${task.reason}`);
		}
		lines.push("");
	}

	if (executionPlan.phases.length === 0 && executionPlan.unsequenced.length === 0) {
		lines.push("No tasks found for execution planning.");
	}

	return lines.join("\n");
}

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
							text: formatSequenceCreateMarkdown(sequenceData),
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
						text: formatSequenceCreateMarkdown(sequenceData),
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
						estimatedEffort: null,
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
						text: formatSequencePlanMarkdown(executionPlan),
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

const sequenceCreateSchema: JsonSchema = {
	type: "object",
	properties: {
		includeCompleted: {
			type: "boolean",
		},
		filterStatus: {
			type: "string",
			maxLength: 100,
		},
	},
	required: [],
};

const sequencePlanSchema: JsonSchema = {
	type: "object",
	properties: {
		taskIds: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
		includeCompleted: {
			type: "boolean",
		},
	},
	required: [],
};

const createSequenceCreateTool = (handlers: SequenceToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "sequence_create",
			description: "Compute execution sequences from task dependencies",
			inputSchema: sequenceCreateSchema,
		},
		sequenceCreateSchema,
		async (input, _context) => {
			return handlers.createSequence({
				includeCompleted: input.includeCompleted as boolean,
				filterStatus: input.filterStatus as string,
			});
		},
	);

const createSequencePlanTool = (handlers: SequenceToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "sequence_plan",
			description: "Create execution plan from task sequences with detailed phase information",
			inputSchema: sequencePlanSchema,
		},
		sequencePlanSchema,
		async (input, _context) => {
			return handlers.planSequence({
				taskIds: input.taskIds as string[],
				includeCompleted: input.includeCompleted as boolean,
			});
		},
	);

export function registerSequenceTools(server: McpServer): void {
	const handlers = new SequenceToolHandlers(server);
	server.addTool(createSequenceCreateTool(handlers));
	server.addTool(createSequencePlanTool(handlers));
}

export { createSequenceCreateTool, createSequencePlanTool, sequenceCreateSchema, sequencePlanSchema };
