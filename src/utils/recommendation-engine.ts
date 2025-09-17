import type { Task } from "../types/index.ts";
import type {
	CapacityAnalysis,
	DependencyMetrics,
	Insight,
	ProjectOverview,
	QualityMetrics,
	Recommendation,
	TeamMetrics,
	VelocityMetrics,
} from "../types/project-overview.ts";
import { createPercentage } from "./project-analytics.ts";

/**
 * Recommendation engine that analyzes project metrics and generates actionable insights
 */

export interface AnalysisInput {
	readonly tasks: readonly Task[];
	readonly overview: ProjectOverview;
	readonly team?: TeamMetrics;
	readonly quality?: QualityMetrics;
	readonly velocity?: VelocityMetrics;
	readonly dependencies?: DependencyMetrics;
}

export function generateRecommendations(input: AnalysisInput): readonly Recommendation[] {
	const recommendations: Recommendation[] = [];

	// Performance recommendations
	recommendations.push(...generatePerformanceRecommendations(input));

	// Quality recommendations
	if (input.quality) {
		recommendations.push(...generateQualityRecommendations(input.quality));
	}

	// Team recommendations
	if (input.team) {
		recommendations.push(...generateTeamRecommendations(input.team));
	}

	// Process recommendations
	recommendations.push(...generateProcessRecommendations(input));

	// Risk recommendations
	if (input.dependencies) {
		recommendations.push(...generateRiskRecommendations(input.dependencies));
	}

	// Sort by priority (high -> medium -> low)
	return recommendations.sort((a, b) => {
		const priorityOrder = { high: 3, medium: 2, low: 1 };
		return priorityOrder[b.priority] - priorityOrder[a.priority];
	});
}

function generatePerformanceRecommendations(input: AnalysisInput): Recommendation[] {
	const recommendations: Recommendation[] = [];
	const { overview, velocity } = input;

	// Low completion rate
	if (overview.completionRate < 30) {
		recommendations.push({
			type: "performance",
			priority: "high",
			title: "Improve Task Completion Rate",
			description: `Current completion rate is ${overview.completionRate}%, which is below the recommended 60% threshold.`,
			actionItems: [
				"Review blocked tasks and remove impediments",
				"Break down large tasks into smaller, manageable pieces",
				"Ensure tasks have clear acceptance criteria",
				"Implement daily standups to track progress",
			],
			expectedImpact: "Increase completion rate by 20-30% within 2 sprints",
		});
	}

	// Low velocity
	if (velocity && velocity.weeklyVelocity < 2) {
		recommendations.push({
			type: "performance",
			priority: "medium",
			title: "Increase Team Velocity",
			description: `Weekly velocity is ${velocity.weeklyVelocity} tasks, which may indicate capacity or process issues.`,
			actionItems: [
				"Analyze task sizing and estimation accuracy",
				"Identify and remove process bottlenecks",
				"Consider pair programming or knowledge sharing",
				"Review team capacity and workload distribution",
			],
			expectedImpact: "Improve velocity by 50% through process optimization",
		});
	}

	// Declining velocity trend
	if (velocity && velocity.velocityTrend === "decreasing") {
		recommendations.push({
			type: "performance",
			priority: "high",
			title: "Address Declining Velocity Trend",
			description: "Team velocity is decreasing, indicating potential process or capacity issues.",
			actionItems: [
				"Conduct retrospective to identify pain points",
				"Review recent changes in team composition or processes",
				"Analyze task complexity trends",
				"Consider technical debt impact on development speed",
			],
			expectedImpact: "Stabilize and improve velocity within 1-2 sprints",
		});
	}

	return recommendations;
}

function generateQualityRecommendations(quality: QualityMetrics): Recommendation[] {
	const recommendations: Recommendation[] = [];

	// Low documentation rate
	if (quality.documentationRate < 70) {
		recommendations.push({
			type: "quality",
			priority: "medium",
			title: "Improve Task Documentation",
			description: `${quality.documentationRate}% of tasks have descriptions. Target is 80%+ for better clarity.`,
			actionItems: [
				"Implement template for task descriptions",
				"Add documentation requirements to definition of done",
				"Conduct training on effective task writing",
				"Review and update existing undocumented tasks",
			],
			expectedImpact: "Reduce ambiguity and improve development efficiency",
		});
	}

	// Low acceptance criteria rate
	if (quality.acceptanceCriteriaRate < 60) {
		recommendations.push({
			type: "quality",
			priority: "high",
			title: "Add Acceptance Criteria to Tasks",
			description: `Only ${quality.acceptanceCriteriaRate}% of tasks have acceptance criteria. This can lead to unclear requirements.`,
			actionItems: [
				"Mandate acceptance criteria for all user-facing features",
				"Train team on writing effective acceptance criteria",
				"Review and add AC to high-priority tasks",
				"Include AC review in task planning sessions",
			],
			expectedImpact: "Improve requirement clarity and reduce rework by 30%",
		});
	}

	// High task complexity
	if (quality.averageTaskComplexity > 4) {
		recommendations.push({
			type: "quality",
			priority: "medium",
			title: "Break Down Complex Tasks",
			description: `Average task complexity is ${quality.averageTaskComplexity.toFixed(1)}, which may indicate tasks are too large.`,
			actionItems: [
				"Review high-complexity tasks and break them down",
				"Establish maximum task size guidelines",
				"Implement task refinement sessions",
				"Use story point estimation to gauge complexity",
			],
			expectedImpact: "Improve predictability and reduce development risk",
		});
	}

	return recommendations;
}

function generateTeamRecommendations(team: TeamMetrics): Recommendation[] {
	const recommendations: Recommendation[] = [];

	// Uneven workload distribution
	const workloadVariance = calculateWorkloadVariance(team.workloadDistribution);
	if (workloadVariance > 0.3) {
		recommendations.push({
			type: "team",
			priority: "medium",
			title: "Balance Team Workload",
			description: "Workload distribution is uneven across team members, which may lead to burnout or bottlenecks.",
			actionItems: [
				"Review current task assignments",
				"Consider skills and capacity when assigning tasks",
				"Implement workload monitoring dashboard",
				"Encourage knowledge sharing and cross-training",
			],
			expectedImpact: "Improve team satisfaction and prevent burnout",
		});
	}

	// Low active contributors
	const participationRate = team.activeContributors / team.teamSize;
	if (participationRate < 0.7) {
		recommendations.push({
			type: "team",
			priority: "high",
			title: "Increase Team Participation",
			description: `Only ${team.activeContributors} out of ${team.teamSize} team members are actively contributing.`,
			actionItems: [
				"Identify barriers preventing team member participation",
				"Provide training or support for inactive members",
				"Review role clarity and expectations",
				"Consider team restructuring if needed",
			],
			expectedImpact: "Increase team capacity and engagement",
		});
	}

	// Declining productivity trends
	const decliningMembers = team.productivityTrends.filter((p) => p.trend === "declining").length;
	if (decliningMembers > team.teamSize * 0.3) {
		recommendations.push({
			type: "team",
			priority: "high",
			title: "Address Declining Team Productivity",
			description: `${decliningMembers} team members show declining productivity trends.`,
			actionItems: [
				"Conduct one-on-one meetings to understand challenges",
				"Review workload and complexity of assigned tasks",
				"Provide additional support or training",
				"Consider process improvements to reduce friction",
			],
			expectedImpact: "Restore team productivity and morale",
		});
	}

	return recommendations;
}

function generateProcessRecommendations(input: AnalysisInput): Recommendation[] {
	const recommendations: Recommendation[] = [];
	const { overview } = input;

	// Too many in-progress tasks
	const wipRatio = overview.inProgressTasks / overview.totalTasks;
	if (wipRatio > 0.4) {
		recommendations.push({
			type: "process",
			priority: "medium",
			title: "Implement Work-in-Progress Limits",
			description: `${(wipRatio * 100).toFixed(1)}% of tasks are in progress. High WIP can reduce focus and increase cycle time.`,
			actionItems: [
				"Set WIP limits for each workflow stage",
				"Focus on completing tasks before starting new ones",
				"Implement pull-based workflow",
				"Review and update task priorities regularly",
			],
			expectedImpact: "Improve focus and reduce cycle time by 25%",
		});
	}

	// Long average completion time
	if (overview.averageCompletionTime > 14) {
		// More than 2 weeks
		recommendations.push({
			type: "process",
			priority: "medium",
			title: "Reduce Task Cycle Time",
			description: `Average task completion time is ${overview.averageCompletionTime.toFixed(1)} days, which is longer than ideal.`,
			actionItems: [
				"Break down large tasks into smaller chunks",
				"Identify and remove process bottlenecks",
				"Improve handoff processes between team members",
				"Consider parallel work streams where possible",
			],
			expectedImpact: "Reduce cycle time by 30-40% and improve delivery predictability",
		});
	}

	// High number of blocked tasks
	const blockedRatio = overview.blockedTasks / overview.totalTasks;
	if (blockedRatio > 0.1) {
		recommendations.push({
			type: "process",
			priority: "high",
			title: "Reduce Task Blockages",
			description: `${(blockedRatio * 100).toFixed(1)}% of tasks are blocked, indicating process or dependency issues.`,
			actionItems: [
				"Implement daily blocker review sessions",
				"Create escalation process for blocked tasks",
				"Improve dependency planning and management",
				"Consider parallel work streams to reduce dependencies",
			],
			expectedImpact: "Improve flow and reduce delivery delays",
		});
	}

	return recommendations;
}

function generateRiskRecommendations(dependencies: DependencyMetrics): Recommendation[] {
	const recommendations: Recommendation[] = [];

	// High dependency rate
	if (dependencies.dependencyRate > 50) {
		recommendations.push({
			type: "risk",
			priority: "medium",
			title: "Reduce Task Dependencies",
			description: `${dependencies.dependencyRate}% of tasks have dependencies, which increases coordination overhead and risk.`,
			actionItems: [
				"Review architecture to reduce coupling",
				"Consider breaking down tightly coupled features",
				"Implement feature toggles to decouple deployments",
				"Create independent work streams where possible",
			],
			expectedImpact: "Reduce coordination overhead and delivery risk",
		});
	}

	// Many tasks blocked by dependencies
	const blockedRatio = dependencies.blockedByDependencies / (dependencies.tasksWithDependencies || 1);
	if (blockedRatio > 0.3) {
		recommendations.push({
			type: "risk",
			priority: "high",
			title: "Resolve Dependency Blockages",
			description: `${dependencies.blockedByDependencies} tasks are blocked by incomplete dependencies.`,
			actionItems: [
				"Prioritize completion of blocking tasks",
				"Implement dependency tracking and monitoring",
				"Create alternative implementation paths where possible",
				"Improve cross-team coordination processes",
			],
			expectedImpact: "Unblock team capacity and improve delivery predictability",
		});
	}

	return recommendations;
}

export function generateInsights(input: AnalysisInput): readonly Insight[] {
	const insights: Insight[] = [];

	// Trend insights
	if (input.velocity) {
		if (input.velocity.velocityTrend === "increasing") {
			insights.push({
				category: "trend",
				title: "Improving Team Velocity",
				description: `Team velocity is trending upward with current weekly velocity of ${input.velocity.weeklyVelocity} tasks.`,
				confidence: createPercentage(85),
			});
		}
	}

	// Quality insights
	if (input.quality) {
		if (input.quality.documentationRate > 85) {
			insights.push({
				category: "opportunity",
				title: "Excellent Documentation Standards",
				description: `${input.quality.documentationRate}% documentation rate indicates strong planning practices.`,
				confidence: createPercentage(95),
			});
		}
	}

	// Team insights
	if (input.team) {
		const highPerformers = input.team.productivityTrends.filter((p) => p.trend === "improving").length;
		if (highPerformers > input.team.teamSize * 0.6) {
			insights.push({
				category: "opportunity",
				title: "Strong Team Performance",
				description: `${highPerformers} team members show improving productivity trends.`,
				confidence: createPercentage(90),
			});
		}
	}

	// Risk insights
	const completionRate = input.overview.completionRate;
	if (completionRate < 20) {
		insights.push({
			category: "risk",
			title: "Low Completion Rate Risk",
			description: `Current ${completionRate}% completion rate may indicate systematic issues requiring attention.`,
			confidence: createPercentage(80),
		});
	}

	// Anomaly detection
	if (input.overview.blockedTasks > input.overview.inProgressTasks) {
		insights.push({
			category: "anomaly",
			title: "Unusual Blocking Pattern",
			description: "More tasks are blocked than in progress, which is unusual and may indicate process issues.",
			confidence: createPercentage(75),
		});
	}

	return insights;
}

export function generateCapacityAnalysis(input: AnalysisInput): CapacityAnalysis {
	const { team, overview, velocity } = input;

	// Calculate current capacity (simplified)
	const currentCapacity = team ? team.activeContributors : 1;
	const totalWork = overview.totalTasks - overview.completedTasks;
	const utilizationRate =
		totalWork > 0 ? createPercentage((overview.inProgressTasks / totalWork) * 100) : createPercentage(0);

	// Identify bottlenecks
	const bottlenecks: Array<{
		readonly area: string;
		readonly severity: "high" | "medium" | "low";
		readonly description: string;
	}> = [];

	if (team) {
		// Check for overloaded team members
		const overloadedMembers = team.workloadDistribution.filter((w) => w.taskCount > currentCapacity * 2);
		if (overloadedMembers.length > 0) {
			bottlenecks.push({
				area: "Team Workload",
				severity: "high",
				description: `${overloadedMembers.length} team members are significantly overloaded`,
			});
		}
	}

	// Check for process bottlenecks
	if (overview.blockedTasks > overview.inProgressTasks * 0.5) {
		bottlenecks.push({
			area: "Process Flow",
			severity: "high",
			description: "High number of blocked tasks indicates process bottlenecks",
		});
	}

	// Check for velocity issues
	if (velocity && velocity.velocityTrend === "decreasing") {
		bottlenecks.push({
			area: "Team Velocity",
			severity: "medium",
			description: "Declining velocity trend may indicate capacity or technical issues",
		});
	}

	// Generate recommendations
	const recommendations = [
		"Monitor team workload distribution regularly",
		"Implement capacity planning for upcoming work",
		"Consider adding team members if velocity remains low",
		"Focus on removing process bottlenecks to improve flow",
	];

	return {
		currentCapacity,
		utilizationRate,
		bottlenecks,
		recommendations,
	};
}

// Helper function to calculate workload variance
function calculateWorkloadVariance(workloadDistribution: readonly TeamMetrics["workloadDistribution"][0][]): number {
	if (workloadDistribution.length === 0) return 0;

	const taskCounts = workloadDistribution.map((w) => w.taskCount);
	const mean = taskCounts.reduce((sum, count) => sum + count, 0) / taskCounts.length;
	const variance = taskCounts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / taskCounts.length;
	return Math.sqrt(variance) / (mean || 1); // Coefficient of variation
}
