import type {
	AnalysisTimeframe,
	MetricType,
	ProjectOverviewConfig,
	SecurityLevel,
} from "../../types/project-overview.ts";
import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { createAsyncValidatedTool, type ValidationContext } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { ProjectOverviewHandlers } from "./project-overview-handlers.ts";

/**
 * Project overview tool schema
 * Simplified to avoid nested object validation issues
 */
const projectOverviewSchema: JsonSchema = {
	type: "object",
	properties: {
		timeframe: {
			// No type specified - accept any structure
		},
		includeMetrics: {
			type: "array",
			items: {
				type: "string",
			},
		},
		securityLevel: {
			type: "string",
		},
		refreshCache: {
			type: "boolean",
		},
		teamFilter: {
			type: "array",
			items: {
				type: "string",
				maxLength: 100,
			},
		},
		priorityFilter: {
			type: "array",
			items: {
				type: "string",
			},
		},
	},
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
			description: "Generate comprehensive project overview with metrics, analytics, and actionable recommendations",
			inputSchema: projectOverviewSchema,
		},
		projectOverviewSchema,
		async (_input, _context) => [], // No additional validation needed
		async (args: Record<string, unknown>, _context: ValidationContext) => {
			// Parse and validate arguments
			const timeframe = parseTimeframe(args.timeframe as any);
			const includeMetrics = (args.includeMetrics as string[]) || ["overview", "velocity", "quality"];
			const securityLevel = (args.securityLevel as SecurityLevel) || "internal";
			const refreshCache = (args.refreshCache as boolean) || false;
			const teamFilter = args.teamFilter as string[] | undefined;
			const priorityFilter = args.priorityFilter as ("high" | "medium" | "low")[] | undefined;

			const config: ProjectOverviewConfig = {
				timeframe,
				includeMetrics: includeMetrics as MetricType[],
				securityLevel,
				refreshCache,
				teamFilter,
				priorityFilter,
			};

			// Generate overview
			const result = await handlers.generateProjectOverview(config);

			if (!result.success) {
				return {
					content: [
						{
							type: "text",
							text: `Error generating project overview: ${result.error.message}`,
						},
					],
					isError: true,
				};
			}

			// Format response for agent consumption
			const overview = result.data;
			const response = {
				success: true,
				overview: {
					metadata: overview.metadata,
					summary: {
						totalTasks: overview.overview.totalTasks,
						completedTasks: overview.overview.completedTasks,
						completionRate: `${overview.overview.completionRate}%`,
						inProgressTasks: overview.overview.inProgressTasks,
						blockedTasks: overview.overview.blockedTasks,
						averageCompletionTime: `${overview.overview.averageCompletionTime} days`,
					},
					metrics: {
						...(overview.velocity && {
							velocity: {
								weekly: overview.velocity.weeklyVelocity,
								monthly: overview.velocity.monthlyVelocity,
								trend: overview.velocity.velocityTrend,
								predictedCompletion: overview.velocity.predictedCompletion,
							},
						}),
						...(overview.quality && {
							quality: {
								documentationRate: `${overview.quality.documentationRate}%`,
								acceptanceCriteriaRate: `${overview.quality.acceptanceCriteriaRate}%`,
								averageComplexity: overview.quality.averageTaskComplexity.toFixed(1),
							},
						}),
						...(overview.team && {
							team: {
								size: overview.team.teamSize,
								activeContributors: overview.team.activeContributors,
								workloadDistribution: overview.team.workloadDistribution.map((w) => ({
									assignee: w.assignee,
									tasks: w.taskCount,
									completionRate: `${w.completionRate}%`,
								})),
							},
						}),
						...(overview.dependencies && {
							dependencies: {
								dependencyRate: `${overview.dependencies.dependencyRate}%`,
								blockedTasks: overview.dependencies.blockedByDependencies,
								criticalPath: overview.dependencies.criticalPath,
							},
						}),
						...(overview.capacity && {
							capacity: {
								currentCapacity: overview.capacity.currentCapacity,
								utilizationRate: `${overview.capacity.utilizationRate}%`,
								bottlenecks: overview.capacity.bottlenecks,
							},
						}),
					},
					recommendations: overview.recommendations.map((r) => ({
						type: r.type,
						priority: r.priority,
						title: r.title,
						description: r.description,
						actionItems: r.actionItems,
						expectedImpact: r.expectedImpact,
					})),
					insights: overview.insights.map((i) => ({
						category: i.category,
						title: i.title,
						description: i.description,
						confidence: `${i.confidence}%`,
					})),
					...(overview.trends && {
						trends: {
							velocity: overview.trends.velocity,
							qualityMetrics: overview.trends.qualityMetrics,
							completionRate: overview.trends.completionRate,
							taskCreation: overview.trends.taskCreation,
						},
					}),
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

/**
 * Parse timeframe from input arguments
 */
function parseTimeframe(timeframeInput: any): AnalysisTimeframe {
	if (!timeframeInput || typeof timeframeInput !== "object") {
		// Default timeframe
		return { type: "preset", value: "last30days" };
	}

	const { type, value, start, end } = timeframeInput;

	switch (type) {
		case "days":
		case "weeks":
		case "months":
			return { type, value: Number(value) };

		case "preset":
			return { type, value };

		case "custom":
			return {
				type,
				start: new Date(start),
				end: new Date(end),
			};

		default:
			// Fallback to default
			return { type: "preset", value: "last30days" };
	}
}

/**
 * Register project overview tools with the MCP server
 */
export function registerProjectOverviewTools(server: McpServer): void {
	server.addTool(createProjectOverviewTool(server));
}

// Export handlers for testing
export { ProjectOverviewHandlers };
