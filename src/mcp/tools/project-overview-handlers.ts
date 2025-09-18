import type { Task } from "../../types/index.ts";
import type {
	MetricType,
	ProjectOverviewCache,
	ProjectOverviewConfig,
	ProjectOverviewResponse,
	ProjectOverviewResult,
	SecurityLevel,
} from "../../types/project-overview.ts";
import {
	calculateDependencyMetrics,
	calculateProjectOverview,
	calculateQualityMetrics,
	calculateTeamMetrics,
	calculateTrends,
	calculateVelocityMetrics,
	filterTasksByAssignee,
	filterTasksByTimeframe,
	formatTimeframeDescription,
	getDateRange,
} from "../../utils/project-analytics.ts";
import {
	generateCapacityAnalysis,
	generateInsights,
	generateRecommendations,
} from "../../utils/recommendation-engine.ts";
import type { McpServer } from "../server.ts";

/**
 * Handlers for project overview MCP tool
 */

export class ProjectOverviewHandlers {
	private cache: ProjectOverviewCache | null = null;
	private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

	constructor(private server: McpServer) {}

	/**
	 * Generate comprehensive project overview
	 */
	async generateProjectOverview(config: ProjectOverviewConfig): Promise<ProjectOverviewResponse> {
		try {
			// Validate configuration
			const validationError = this.validateConfig(config);
			if (validationError) {
				return {
					success: false,
					error: {
						code: "INVALID_TIMEFRAME",
						message: validationError,
					},
				};
			}

			// Check cache first (if not forced refresh)
			if (!config.refreshCache && this.isCacheValid(config)) {
				return {
					success: true,
					data: this.cache?.data,
				};
			}

			// Load tasks from filesystem
			const allTasks = await this.server.filesystem.listTasks();
			const projectConfig = await this.server.filesystem.loadConfig();

			if (!projectConfig) {
				return {
					success: false,
					error: {
						code: "INSUFFICIENT_DATA",
						message: "Project configuration not found. Please run 'backlog init' first.",
					},
				};
			}

			// Apply security filtering
			const tasks = this.applySecurityFiltering(allTasks, config.securityLevel);

			// Apply filters
			let filteredTasks = tasks;

			// Apply time filtering if specified
			filteredTasks = filterTasksByTimeframe(filteredTasks, config.timeframe);

			// Apply team filter if specified
			if (config.teamFilter && config.teamFilter.length > 0) {
				filteredTasks = filterTasksByAssignee(filteredTasks, config.teamFilter);
			}

			// Apply priority filter if specified
			if (config.priorityFilter && config.priorityFilter.length > 0) {
				filteredTasks = filteredTasks.filter((task) => task.priority && config.priorityFilter?.includes(task.priority));
			}

			// Generate time period information
			const { start, end } = getDateRange(config.timeframe);
			const timePeriodDescription = formatTimeframeDescription(config.timeframe);

			// Calculate all metrics
			const overview = calculateProjectOverview(filteredTasks);

			const analysisInput = {
				tasks: filteredTasks,
				overview,
			};

			const result: ProjectOverviewResult = {
				metadata: {
					projectName: projectConfig.projectName || "Project",
					analysisTimestamp: new Date().toISOString(),
					timePeriod: {
						start: start.toISOString(),
						end: end.toISOString(),
						description: timePeriodDescription,
					},
					dataFreshness: this.calculateDataFreshness(tasks),
					metricsIncluded: config.includeMetrics,
					taskCount: overview.totalTasks,
				},
				overview,
				recommendations: [],
				insights: [],
			};

			// Calculate optional metrics based on configuration
			if (config.includeMetrics.includes("trends")) {
				result.trends = calculateTrends(filteredTasks, config.timeframe);
			}

			if (config.includeMetrics.includes("team")) {
				result.team = calculateTeamMetrics(filteredTasks);
				Object.assign(analysisInput, { team: result.team });
			}

			if (config.includeMetrics.includes("quality")) {
				result.quality = calculateQualityMetrics(filteredTasks);
				Object.assign(analysisInput, { quality: result.quality });
			}

			if (config.includeMetrics.includes("velocity")) {
				result.velocity = calculateVelocityMetrics(filteredTasks);
				Object.assign(analysisInput, { velocity: result.velocity });
			}

			if (config.includeMetrics.includes("dependencies")) {
				result.dependencies = calculateDependencyMetrics(filteredTasks);
				Object.assign(analysisInput, { dependencies: result.dependencies });
			}

			if (config.includeMetrics.includes("capacity")) {
				result.capacity = generateCapacityAnalysis(analysisInput);
			}

			// Generate recommendations and insights
			(result as any).recommendations = generateRecommendations(analysisInput);
			(result as any).insights = generateInsights(analysisInput);

			// Update cache
			this.updateCache(config, result, filteredTasks.length);

			// Log audit trail for security
			await this.logAuditTrail(config, filteredTasks.length);

			return {
				success: true,
				data: result,
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "COMPUTATION_ERROR",
					message: `Failed to generate project overview: ${error}`,
					details: { error: String(error) },
				},
			};
		}
	}

	/**
	 * Validate project overview configuration
	 */
	private validateConfig(config: ProjectOverviewConfig): string | null {
		// Validate timeframe
		switch (config.timeframe.type) {
			case "days":
				if (config.timeframe.value < 1 || config.timeframe.value > 365) {
					return "Days value must be between 1 and 365";
				}
				break;
			case "weeks":
				if (config.timeframe.value < 1 || config.timeframe.value > 52) {
					return "Weeks value must be between 1 and 52";
				}
				break;
			case "months":
				if (config.timeframe.value < 1 || config.timeframe.value > 24) {
					return "Months value must be between 1 and 24";
				}
				break;
			case "custom": {
				if (config.timeframe.start >= config.timeframe.end) {
					return "Custom timeframe start date must be before end date";
				}
				const maxRange = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
				if (config.timeframe.end.getTime() - config.timeframe.start.getTime() > maxRange) {
					return "Custom timeframe cannot exceed 2 years";
				}
				break;
			}
		}

		// Validate metrics
		const validMetrics: MetricType[] = [
			"overview",
			"trends",
			"team",
			"capacity",
			"quality",
			"dependencies",
			"velocity",
		];
		const invalidMetrics = config.includeMetrics.filter((m) => !validMetrics.includes(m));
		if (invalidMetrics.length > 0) {
			return `Invalid metrics: ${invalidMetrics.join(", ")}`;
		}

		// Validate team filter
		if (config.teamFilter && config.teamFilter.length > 20) {
			return "Team filter cannot include more than 20 assignees";
		}

		return null;
	}

	/**
	 * Apply security filtering based on access level
	 */
	private applySecurityFiltering(tasks: readonly Task[], securityLevel: SecurityLevel): Task[] {
		switch (securityLevel) {
			case "public":
				// Only include tasks without sensitive labels
				return tasks.filter((task) => {
					const sensitiveLabels = ["confidential", "internal", "private", "security"];
					return !task.labels?.some((label) =>
						sensitiveLabels.some((sensitive) => label.toLowerCase().includes(sensitive)),
					);
				});

			case "internal":
				// Exclude only highly confidential tasks
				return tasks.filter((task) => {
					const confidentialLabels = ["confidential", "secret", "classified"];
					return !task.labels?.some((label) =>
						confidentialLabels.some((confidential) => label.toLowerCase().includes(confidential)),
					);
				});
			default:
				// Include all tasks
				return [...tasks];
		}
	}

	/**
	 * Check if cached data is still valid
	 */
	private isCacheValid(config: ProjectOverviewConfig): boolean {
		if (!this.cache) return false;

		const now = new Date();
		if (now > this.cache.validUntil) return false;

		// Check if configuration has changed
		const configHash = this.generateConfigHash(config);
		if (configHash !== this.cache.configHash) return false;

		return true;
	}

	/**
	 * Update cache with new data
	 */
	private updateCache(config: ProjectOverviewConfig, result: ProjectOverviewResult, taskCount: number): void {
		const now = new Date();
		const validUntil = new Date(now.getTime() + this.CACHE_TTL);

		this.cache = {
			lastComputed: now,
			data: result,
			taskCount: taskCount as any, // TaskCount brand
			configHash: this.generateConfigHash(config),
			validUntil,
		};
	}

	/**
	 * Generate hash for configuration to detect changes
	 */
	private generateConfigHash(config: ProjectOverviewConfig): string {
		const configString = JSON.stringify({
			timeframe: config.timeframe,
			metrics: [...config.includeMetrics].sort(),
			security: config.securityLevel,
			team: config.teamFilter ? [...config.teamFilter].sort() : undefined,
			priority: config.priorityFilter ? [...config.priorityFilter].sort() : undefined,
		});

		// Simple hash function (in production, use a proper crypto hash)
		let hash = 0;
		for (let i = 0; i < configString.length; i++) {
			const char = configString.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString(36);
	}

	/**
	 * Calculate data freshness indicator
	 */
	private calculateDataFreshness(tasks: readonly Task[]): string {
		if (tasks.length === 0) return "No data";

		const now = new Date();
		const recentTasks = tasks.filter((task) => {
			const taskDate = task.updatedDate ? new Date(task.updatedDate) : new Date(task.createdDate);
			const daysDiff = (now.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24);
			return daysDiff <= 7;
		});

		const freshnessPercent = Math.round((recentTasks.length / tasks.length) * 100);

		if (freshnessPercent > 50) return "Fresh (updated within last week)";
		if (freshnessPercent > 20) return "Moderate (some recent updates)";
		return "Stale (limited recent activity)";
	}

	/**
	 * Log audit trail for security and monitoring
	 */
	private async logAuditTrail(config: ProjectOverviewConfig, taskCount: number): Promise<void> {
		// In a production system, this would write to an audit log
		const auditEntry = {
			timestamp: new Date().toISOString(),
			action: "project_overview_generated",
			securityLevel: config.securityLevel,
			taskCount,
			metricsRequested: config.includeMetrics,
			timeframe: config.timeframe,
		};

		// For now, just log to console (in production, use proper logging)
		console.log("[AUDIT]", JSON.stringify(auditEntry));
	}

	/**
	 * Clear cache (for testing or manual cache invalidation)
	 */
	clearCache(): void {
		this.cache = null;
	}

	/**
	 * Get cache statistics for monitoring
	 */
	getCacheStats(): { hit: boolean; age?: number; size?: number } {
		if (!this.cache) {
			return { hit: false };
		}

		const age = Date.now() - this.cache.lastComputed.getTime();
		const size = JSON.stringify(this.cache.data).length;

		return {
			hit: true,
			age,
			size,
		};
	}
}
