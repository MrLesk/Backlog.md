import type { Task } from "./index.ts";

// Branded types for domain-specific values
export type Percentage = number & { readonly __brand: "Percentage" };
export type Duration = number & { readonly __brand: "Duration" };
export type TaskCount = number & { readonly __brand: "TaskCount" };

// Time period configuration with discriminated union
export type AnalysisTimeframe =
	| { readonly type: "days"; readonly value: number }
	| { readonly type: "weeks"; readonly value: number }
	| { readonly type: "months"; readonly value: number }
	| { readonly type: "preset"; readonly value: "last7days" | "last30days" | "last90days" | "thisMonth" | "thisQuarter" }
	| { readonly type: "custom"; readonly start: Date; readonly end: Date };

// Metric types that can be included in analysis
export type MetricType = "overview" | "trends" | "team" | "capacity" | "quality" | "dependencies" | "velocity";

// Data classification levels for security
export type SecurityLevel = "public" | "internal" | "confidential";

// Configuration for project overview generation
export interface ProjectOverviewConfig {
	readonly timeframe: AnalysisTimeframe;
	readonly includeMetrics: readonly MetricType[];
	readonly securityLevel: SecurityLevel;
	readonly teamFilter?: readonly string[];
	readonly priorityFilter?: readonly ("high" | "medium" | "low")[];
}

// Project overview metadata
export interface ProjectMetadata {
	readonly projectName: string;
	readonly analysisTimestamp: string;
	readonly timePeriod: {
		readonly start: string;
		readonly end: string;
		readonly description: string;
	};
	readonly dataFreshness: string;
	readonly metricsIncluded: readonly MetricType[];
	readonly taskCount: TaskCount;
}

// Core project metrics
export interface ProjectOverview {
	readonly totalTasks: TaskCount;
	readonly completedTasks: TaskCount;
	readonly inProgressTasks: TaskCount;
	readonly todoTasks: TaskCount;
	readonly blockedTasks: TaskCount;
	readonly completionRate: Percentage;
	readonly averageCompletionTime: Duration;
}

// Trend data structure
export interface TrendData {
	readonly period: string;
	readonly value: number;
	readonly change?: number;
	readonly changeDirection?: "up" | "down" | "stable";
}

// Project trends analysis
export interface ProjectTrends {
	readonly velocity: readonly TrendData[];
	readonly qualityMetrics: readonly TrendData[];
	readonly completionRate: readonly TrendData[];
	readonly taskCreation: readonly TrendData[];
}

// Team metrics and insights
export interface TeamMetrics {
	readonly teamSize: number;
	readonly activeContributors: number;
	readonly workloadDistribution: readonly {
		readonly assignee: string;
		readonly taskCount: TaskCount;
		readonly completedTasks: TaskCount;
		readonly completionRate: Percentage;
	}[];
	readonly productivityTrends: readonly {
		readonly assignee: string;
		readonly weeklyVelocity: number;
		readonly trend: "improving" | "declining" | "stable";
	}[];
}

// Capacity analysis
export interface CapacityAnalysis {
	readonly currentCapacity: number;
	readonly utilizationRate: Percentage;
	readonly bottlenecks: readonly {
		readonly area: string;
		readonly severity: "high" | "medium" | "low";
		readonly description: string;
	}[];
	readonly recommendations: readonly string[];
}

// Quality metrics
export interface QualityMetrics {
	readonly tasksWithDescription: TaskCount;
	readonly tasksWithAcceptanceCriteria: TaskCount;
	readonly tasksWithImplementationNotes: TaskCount;
	readonly documentationRate: Percentage;
	readonly acceptanceCriteriaRate: Percentage;
	readonly averageTaskComplexity: number;
}

// Dependency metrics
export interface DependencyMetrics {
	readonly tasksWithDependencies: TaskCount;
	readonly totalDependencies: number;
	readonly dependencyRate: Percentage;
	readonly criticalPath: readonly string[];
	readonly blockedByDependencies: TaskCount;
}

// Velocity metrics
export interface VelocityMetrics {
	readonly weeklyVelocity: number;
	readonly monthlyVelocity: number;
	readonly averageVelocity: number;
	readonly velocityTrend: "increasing" | "decreasing" | "stable";
	readonly predictedCompletion: string;
}

// Project insights and recommendations
export interface Recommendation {
	readonly type: "performance" | "quality" | "process" | "team" | "risk";
	readonly priority: "high" | "medium" | "low";
	readonly title: string;
	readonly description: string;
	readonly actionItems: readonly string[];
	readonly expectedImpact: string;
}

export interface Insight {
	readonly category: "trend" | "anomaly" | "opportunity" | "risk";
	readonly title: string;
	readonly description: string;
	readonly confidence: Percentage;
	readonly relatedTasks?: readonly string[];
}

// Main project overview result
export interface ProjectOverviewResult {
	readonly metadata: ProjectMetadata;
	readonly overview: ProjectOverview;
	trends?: ProjectTrends;
	team?: TeamMetrics;
	capacity?: CapacityAnalysis;
	quality?: QualityMetrics;
	dependencies?: DependencyMetrics;
	velocity?: VelocityMetrics;
	recommendations: readonly Recommendation[];
	insights: readonly Insight[];
}

// Error handling for project overview
export interface ProjectOverviewError {
	readonly code: "INSUFFICIENT_DATA" | "INVALID_TIMEFRAME" | "ACCESS_DENIED" | "COMPUTATION_ERROR";
	readonly message: string;
	readonly details?: Record<string, unknown>;
}

// Result type with error handling
export type ProjectOverviewResponse =
	| { readonly success: true; readonly data: ProjectOverviewResult }
	| { readonly success: false; readonly error: ProjectOverviewError };

// Helper utility types
export type TaskFilter = (task: Task) => boolean;
export type MetricCalculator<T, R> = (data: readonly T[]) => R;
export type TrendAnalyzer<T> = (historical: readonly T[], current: T) => "increasing" | "decreasing" | "stable";

// Data quality metrics
export interface DataQualityMetrics {
	readonly completeness: Percentage;
	readonly consistency: Percentage;
	readonly freshness: Percentage;
	readonly accuracy: Percentage;
}
