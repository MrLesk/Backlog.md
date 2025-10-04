import type { Task } from "../../types/index.ts";
import type { McpServer } from "../server.ts";
import type { McpResourceHandler, ReadResourceResult } from "../types.ts";

/**
 * Task list resource handler
 * Provides filtered list of tasks with optional query parameters
 */
function createTaskListResource(server: McpServer): McpResourceHandler {
	return {
		uri: "backlog://tasks/list",
		name: "Task List",
		description: "Filtered list of tasks with optional filtering by status, labels, assignee, and search terms",
		mimeType: "application/json",
		handler: async (uri: string): Promise<ReadResourceResult> => {
			try {
				// Parse query parameters from URI
				const url = new URL(uri);
				const params: Record<string, unknown> = {};

				if (url.searchParams.get("status")) {
					params.status = url.searchParams.get("status");
				}
				if (url.searchParams.get("assignee")) {
					params.assignee = url.searchParams.get("assignee");
				}
				if (url.searchParams.get("search")) {
					params.search = url.searchParams.get("search");
				}
				if (url.searchParams.get("labels")) {
					params.labels = url.searchParams
						.get("labels")
						?.split(",")
						.map((l) => l.trim());
				}
				if (url.searchParams.get("limit")) {
					const limit = Number.parseInt(url.searchParams.get("limit") || "0", 10);
					if (limit > 0) {
						params.limit = limit;
					}
				}

				// Get all tasks from filesystem and filter them
				const allTasks = await server.filesystem.listTasks();

				// Apply filtering
				let filteredTasks = allTasks;

				if (params.status) {
					filteredTasks = filteredTasks.filter((task) =>
						(task.status || "").toLowerCase().includes((params.status as string).toLowerCase()),
					);
				}

				if (params.assignee) {
					filteredTasks = filteredTasks.filter(
						(task) =>
							task.assignee &&
							Array.isArray(task.assignee) &&
							task.assignee.some((a) => a.toLowerCase().includes((params.assignee as string).toLowerCase())),
					);
				}

				if (params.search) {
					const searchTerm = (params.search as string).toLowerCase();
					filteredTasks = filteredTasks.filter(
						(task) =>
							(task.title || "").toLowerCase().includes(searchTerm) ||
							(task.description || "").toLowerCase().includes(searchTerm),
					);
				}

				if (params.labels && (params.labels as string[]).length > 0) {
					filteredTasks = filteredTasks.filter(
						(task) =>
							task.labels &&
							Array.isArray(task.labels) &&
							(params.labels as string[]).some((label: string) => task.labels.includes(label)),
					);
				}

				// Apply limit
				if (params.limit) {
					filteredTasks = filteredTasks.slice(0, params.limit as number);
				}

				// Prepare response with expected structure
				const response = {
					tasks: filteredTasks,
					metadata: {
						totalTasks: filteredTasks.length,
						filters: {
							...(params.status ? { status: params.status as string } : {}),
							...(params.assignee ? { assignee: params.assignee as string } : {}),
							...(params.search ? { search: params.search as string } : {}),
							...(params.labels ? { labels: params.labels as string[] } : {}),
							...(params.limit ? { limit: params.limit as number } : {}),
						},
					},
				};

				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(response, null, 2),
						},
					],
				};
			} catch (error) {
				throw new Error(`Failed to read task list resource: ${error}`);
			}
		},
	};
}

/**
 * Board state resource handler
 * Provides current kanban board state with task distribution
 */
function createBoardStateResource(server: McpServer): McpResourceHandler {
	return {
		uri: "backlog://board/state",
		name: "Board State",
		description: "Current kanban board state with task distribution and configuration",
		mimeType: "application/json",
		handler: async (uri: string): Promise<ReadResourceResult> => {
			try {
				// Get board state using the same approach as board-tools.ts
				const tasks = await server.filesystem.listTasks();
				const config = await server.filesystem.loadConfig();

				if (!config) {
					throw new Error("Configuration not found. Please run 'backlog init' first.");
				}

				// Calculate metadata
				const totalTasks = tasks.length;
				const statusCounts: Record<string, number> = {};
				const columns: Record<string, Task[]> = {};

				// Group tasks by status
				for (const task of tasks) {
					const status = task.status || "No Status";
					if (!columns[status]) {
						columns[status] = [];
					}
					columns[status].push(task);
					statusCounts[status] = (statusCounts[status] || 0) + 1;
				}

				// Calculate completion metrics
				const completedTasks = tasks.filter((task) => (task.status || "").toLowerCase() === "done").length;
				const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

				// Calculate weekly velocity (tasks completed in last week)
				const oneWeekAgo = new Date();
				oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

				const weeklyVelocity = tasks.filter((task) => {
					if ((task.status || "").toLowerCase() !== "done") return false;
					// Use createdDate as fallback since updatedDate might not be set in tests
					const dateToCheck = task.updatedDate || task.createdDate;
					if (!dateToCheck) return false;
					const taskDate = new Date(dateToCheck);
					return taskDate >= oneWeekAgo;
				}).length;

				// Calculate average tasks per status
				const statusCount = Object.keys(statusCounts).length;
				const averageTasksPerStatus = statusCount > 0 ? Math.round(totalTasks / statusCount) : 0;

				const boardState = {
					board: {
						columns,
						statusCounts,
					},
					metrics: {
						totalTasks,
						completedTasks,
						completionRate,
						weeklyVelocity,
						averageTasksPerStatus,
					},
					configuration: {
						projectName: config.projectName || "Project",
						statuses: config.statuses || [],
						workflowStages: (config.statuses || []).length,
					},
					lastUpdated: new Date().toISOString(),
				};

				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(boardState, null, 2),
						},
					],
				};
			} catch (error) {
				throw new Error(`Failed to read board state resource: ${error}`);
			}
		},
	};
}

/**
 * Project statistics resource handler
 * Provides analytics and metrics about the project
 */
function createProjectStatisticsResource(server: McpServer): McpResourceHandler {
	return {
		uri: "backlog://project/statistics",
		name: "Project Statistics",
		description: "Project analytics and metrics including task counts, completion rates, and trends",
		mimeType: "application/json",
		handler: async (uri: string): Promise<ReadResourceResult> => {
			try {
				// Get basic task statistics
				const allTasks = await server.filesystem.listTasks();
				const completedTasks = allTasks.filter((task) => (task.status || "").toLowerCase() === "done");
				const _inProgressTasks = allTasks.filter((task) => (task.status || "").toLowerCase() === "in progress");
				const _todoTasks = allTasks.filter((task) => (task.status || "").toLowerCase() === "to do");

				// Get project configuration
				const config = await server.filesystem.loadConfig();

				// Calculate comprehensive statistics
				const completionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

				// Get unique labels
				const allLabels = new Set<string>();
				for (const task of allTasks) {
					if (task.labels && Array.isArray(task.labels)) {
						for (const label of task.labels) {
							allLabels.add(label);
						}
					}
				}

				// Calculate distributions
				const labelDistribution = await getLabelDistribution(allTasks);
				const priorityDistribution: Record<string, number> = {};
				const statusDistribution: Record<string, number> = {};

				allTasks.forEach((task) => {
					if (task.priority) {
						priorityDistribution[task.priority] = (priorityDistribution[task.priority] || 0) + 1;
					}
					if (task.status) {
						statusDistribution[task.status] = (statusDistribution[task.status] || 0) + 1;
					}
				});

				// Calculate timeline metrics
				const creationTrends = await getCreationTrends(server);

				// Calculate quality metrics
				const tasksWithDescription = allTasks.filter((task) => task.description?.trim()).length;
				const tasksWithAcceptanceCriteria = allTasks.filter(
					(task) => task.acceptanceCriteriaItems && task.acceptanceCriteriaItems.length > 0,
				).length;
				const tasksWithImplementationNotes = allTasks.filter((task) => task.implementationNotes?.trim()).length;

				// Calculate dependency metrics
				const tasksWithDependencies = allTasks.filter(
					(task) => task.dependencies && task.dependencies.length > 0,
				).length;
				const totalDependencies = allTasks.reduce((total, task) => total + (task.dependencies?.length || 0), 0);

				const statistics = {
					overview: {
						totalTasks: allTasks.length,
						completedTasks: completedTasks.length,
						completionRate,
						projectName: config?.projectName || "Project",
						uniqueLabels: allLabels.size,
					},
					distribution: {
						status: statusDistribution,
						labels: labelDistribution,
						priority: priorityDistribution,
					},
					timeline: {
						weeklyVelocity: getWeeklyVelocity(allTasks),
						tasksCreatedLastWeek: creationTrends.lastWeek,
						tasksCompletedLastWeek: getTasksCompletedLastWeek(allTasks),
						creationTrend: creationTrends.lastWeek > 0 ? "increasing" : "stable",
					},
					quality: {
						tasksWithDescription,
						tasksWithAcceptanceCriteria,
						tasksWithImplementationNotes,
						documentationRate: allTasks.length > 0 ? Math.round((tasksWithDescription / allTasks.length) * 100) : 0,
						acceptanceCriteriaRate:
							allTasks.length > 0 ? Math.round((tasksWithAcceptanceCriteria / allTasks.length) * 100) : 0,
					},
					dependencies: {
						tasksWithDependencies,
						totalDependencies,
						dependencyRate: allTasks.length > 0 ? Math.round((tasksWithDependencies / allTasks.length) * 100) : 0,
					},
					generatedAt: new Date().toISOString(),
				};

				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(statistics, null, 2),
						},
					],
				};
			} catch (error) {
				throw new Error(`Failed to read project statistics resource: ${error}`);
			}
		},
	};
}

/**
 * Helper function to calculate creation trends
 */
async function getCreationTrends(server: McpServer): Promise<{ lastWeek: number; lastMonth: number; total: number }> {
	try {
		const allTasks = await server.filesystem.listTasks();
		const now = new Date();
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

		// Count tasks created in different time periods
		const recentTasks = allTasks.filter((task: Task) => {
			if (!task.createdDate) return false;
			const created = new Date(task.createdDate);
			return created >= oneWeekAgo;
		});

		const monthlyTasks = allTasks.filter((task: Task) => {
			if (!task.createdDate) return false;
			const created = new Date(task.createdDate);
			return created >= oneMonthAgo;
		});

		return {
			lastWeek: recentTasks.length,
			lastMonth: monthlyTasks.length,
			total: allTasks.length,
		};
	} catch {
		return {
			lastWeek: 0,
			lastMonth: 0,
			total: 0,
		};
	}
}

/**
 * Helper function to calculate label distribution
 */
async function getLabelDistribution(tasks: Task[]): Promise<Record<string, number>> {
	const labelCounts: Record<string, number> = {};

	for (const task of tasks) {
		if (task.labels && Array.isArray(task.labels)) {
			for (const label of task.labels) {
				labelCounts[label] = (labelCounts[label] || 0) + 1;
			}
		}
	}

	return labelCounts;
}

/**
 * Helper function to calculate weekly velocity
 */
function getWeeklyVelocity(tasks: Task[]): number {
	const oneWeekAgo = new Date();
	oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

	return tasks.filter((task) => {
		if ((task.status || "").toLowerCase() !== "done") return false;
		const dateToCheck = task.updatedDate || task.createdDate;
		if (!dateToCheck) return false;
		const taskDate = new Date(dateToCheck);
		return taskDate >= oneWeekAgo;
	}).length;
}

/**
 * Helper function to calculate tasks completed last week
 */
function getTasksCompletedLastWeek(tasks: Task[]): number {
	const oneWeekAgo = new Date();
	oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

	return tasks.filter((task) => {
		if ((task.status || "").toLowerCase() !== "done") return false;
		const dateToCheck = task.updatedDate || task.createdDate;
		if (!dateToCheck) return false;
		const taskDate = new Date(dateToCheck);
		return taskDate >= oneWeekAgo;
	}).length;
}

/**
 * Drafts list resource handler
 * Provides filtered list of draft tasks with optional query parameters
 */
function createDraftsListResource(server: McpServer): McpResourceHandler {
	return {
		uri: "backlog://drafts/list",
		name: "Drafts List",
		description: "Filtered list of draft tasks with optional filtering by assignee, labels, and search terms",
		mimeType: "application/json",
		handler: async (uri: string): Promise<ReadResourceResult> => {
			try {
				// Parse query parameters from URI
				const url = new URL(uri);
				const params: Record<string, unknown> = {};

				if (url.searchParams.get("assignee")) {
					params.assignee = url.searchParams.get("assignee");
				}
				if (url.searchParams.get("search")) {
					params.search = url.searchParams.get("search");
				}
				if (url.searchParams.get("labels")) {
					params.labels = url.searchParams
						.get("labels")
						?.split(",")
						.map((l) => l.trim());
				}
				if (url.searchParams.get("limit")) {
					const limit = Number.parseInt(url.searchParams.get("limit") || "0", 10);
					if (limit > 0) {
						params.limit = Math.min(limit, 1000); // Cap at 1000 for performance
					}
				}

				// Get all drafts from filesystem and filter them
				const allDrafts = await server.filesystem.listDrafts();

				// Apply filtering
				let filteredDrafts = allDrafts;

				if (params.assignee) {
					filteredDrafts = filteredDrafts.filter(
						(draft) =>
							draft.assignee &&
							Array.isArray(draft.assignee) &&
							draft.assignee.some((a) => a.toLowerCase().includes((params.assignee as string).toLowerCase())),
					);
				}

				if (params.search) {
					const searchTerm = (params.search as string).toLowerCase();
					filteredDrafts = filteredDrafts.filter(
						(draft) =>
							(draft.title || "").toLowerCase().includes(searchTerm) ||
							(draft.description || "").toLowerCase().includes(searchTerm),
					);
				}

				if (params.labels && (params.labels as string[]).length > 0) {
					filteredDrafts = filteredDrafts.filter(
						(draft) =>
							draft.labels &&
							Array.isArray(draft.labels) &&
							(params.labels as string[]).some((label: string) => draft.labels.includes(label)),
					);
				}

				// Apply limit
				if (params.limit) {
					filteredDrafts = filteredDrafts.slice(0, params.limit as number);
				}

				// Prepare response with expected structure
				const response = {
					drafts: filteredDrafts,
					metadata: {
						totalDrafts: filteredDrafts.length,
						filters: {
							...(params.assignee ? { assignee: params.assignee as string } : {}),
							...(params.search ? { search: params.search as string } : {}),
							...(params.labels ? { labels: params.labels as string[] } : {}),
							...(params.limit ? { limit: params.limit as number } : {}),
						},
					},
				};

				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(response, null, 2),
						},
					],
				};
			} catch (error) {
				throw new Error(`Failed to read drafts list resource: ${error}`);
			}
		},
	};
}

/**
 * Documents list resource handler
 * Provides filtered list of documents with optional query parameters
 */
function createDocsListResource(server: McpServer): McpResourceHandler {
	return {
		uri: "backlog://docs/list",
		name: "Documents List",
		description: "Filtered list of documents with optional filtering by type, tags, and search terms",
		mimeType: "application/json",
		handler: async (uri: string): Promise<ReadResourceResult> => {
			try {
				// Parse query parameters from URI
				const url = new URL(uri);
				const params: Record<string, unknown> = {};

				if (url.searchParams.get("type")) {
					params.type = url.searchParams.get("type");
				}
				if (url.searchParams.get("search")) {
					params.search = url.searchParams.get("search");
				}
				if (url.searchParams.get("tags")) {
					params.tags = url.searchParams
						.get("tags")
						?.split(",")
						.map((t) => t.trim());
				}
				if (url.searchParams.get("limit")) {
					const limit = Number.parseInt(url.searchParams.get("limit") || "0", 10);
					if (limit > 0) {
						params.limit = Math.min(limit, 1000); // Cap at 1000 for performance
					}
				}
				if (url.searchParams.get("offset")) {
					const offset = Number.parseInt(url.searchParams.get("offset") || "0", 10);
					if (offset >= 0) {
						params.offset = offset;
					}
				}

				// Get all documents from filesystem and filter them
				const allDocs = await server.filesystem.listDocuments();

				// Apply filtering
				let filteredDocs = allDocs;

				if (params.type) {
					filteredDocs = filteredDocs.filter(
						(doc) => doc.type && doc.type.toLowerCase() === (params.type as string).toLowerCase(),
					);
				}

				if (params.search) {
					const searchTerm = (params.search as string).toLowerCase();
					filteredDocs = filteredDocs.filter(
						(doc) =>
							(doc.title || "").toLowerCase().includes(searchTerm) ||
							(doc.rawContent || "").toLowerCase().includes(searchTerm),
					);
				}

				if (params.tags && (params.tags as string[]).length > 0) {
					filteredDocs = filteredDocs.filter(
						(doc) =>
							doc.tags &&
							Array.isArray(doc.tags) &&
							(params.tags as string[]).some((tag: string) => doc.tags?.includes(tag)),
					);
				}

				// Apply pagination
				const totalDocs = filteredDocs.length;
				const offset = (params.offset as number) || 0;
				const limit = (params.limit as number) || totalDocs;

				filteredDocs = filteredDocs.slice(offset, offset + limit);

				// Prepare response with expected structure
				const response = {
					documents: filteredDocs,
					metadata: {
						totalDocuments: totalDocs,
						returned: filteredDocs.length,
						offset: offset,
						filters: {
							...(params.type ? { type: params.type as string } : {}),
							...(params.search ? { search: params.search as string } : {}),
							...(params.tags ? { tags: params.tags as string[] } : {}),
							...(params.limit ? { limit: params.limit as number } : {}),
							...(params.offset ? { offset: params.offset as number } : {}),
						},
					},
				};

				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(response, null, 2),
						},
					],
				};
			} catch (error) {
				throw new Error(`Failed to read documents list resource: ${error}`);
			}
		},
	};
}

/**
 * Decisions list resource handler
 * Provides filtered list of decision records with optional query parameters
 */
function createDecisionsListResource(server: McpServer): McpResourceHandler {
	return {
		uri: "backlog://decisions/list",
		name: "Decisions List",
		description: "Filtered list of decision records with optional filtering by status and search terms",
		mimeType: "application/json",
		handler: async (uri: string): Promise<ReadResourceResult> => {
			try {
				// Parse query parameters from URI
				const url = new URL(uri);
				const params: Record<string, unknown> = {};

				if (url.searchParams.get("status")) {
					params.status = url.searchParams.get("status");
				}
				if (url.searchParams.get("search")) {
					params.search = url.searchParams.get("search");
				}
				if (url.searchParams.get("limit")) {
					const limit = Number.parseInt(url.searchParams.get("limit") || "0", 10);
					if (limit > 0) {
						params.limit = Math.min(limit, 1000); // Cap at 1000 for performance
					}
				}

				// Get all decisions from filesystem and filter them
				const allDecisions = await server.filesystem.listDecisions();

				// Apply filtering
				let filteredDecisions = allDecisions;

				if (params.status) {
					filteredDecisions = filteredDecisions.filter(
						(decision) => decision.status && decision.status.toLowerCase() === (params.status as string).toLowerCase(),
					);
				}

				if (params.search) {
					const searchTerm = (params.search as string).toLowerCase();
					filteredDecisions = filteredDecisions.filter(
						(decision) =>
							(decision.title || "").toLowerCase().includes(searchTerm) ||
							(decision.context || "").toLowerCase().includes(searchTerm) ||
							(decision.decision || "").toLowerCase().includes(searchTerm),
					);
				}

				// Apply limit
				if (params.limit) {
					filteredDecisions = filteredDecisions.slice(0, params.limit as number);
				}

				// Prepare response with expected structure
				const response = {
					decisions: filteredDecisions,
					metadata: {
						totalDecisions: filteredDecisions.length,
						filters: {
							...(params.status ? { status: params.status as string } : {}),
							...(params.search ? { search: params.search as string } : {}),
							...(params.limit ? { limit: params.limit as number } : {}),
						},
					},
				};

				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(response, null, 2),
						},
					],
				};
			} catch (error) {
				throw new Error(`Failed to read decisions list resource: ${error}`);
			}
		},
	};
}

/**
 * Project overview resource handler
 * Provides comprehensive project overview with metrics and analytics
 */
function createProjectOverviewResource(server: McpServer): McpResourceHandler {
	return {
		uri: "backlog://project/overview",
		name: "Project Overview",
		description: "Comprehensive project overview with metrics, analytics, and insights",
		mimeType: "application/json",
		handler: async (uri: string): Promise<ReadResourceResult> => {
			try {
				// Parse query parameters from URI
				const url = new URL(uri);
				const params: Record<string, unknown> = {};

				if (url.searchParams.get("timeframe")) {
					params.timeframe = url.searchParams.get("timeframe");
				}
				if (url.searchParams.get("teamFilter")) {
					params.teamFilter = url.searchParams
						.get("teamFilter")
						?.split(",")
						.map((t) => t.trim());
				}
				if (url.searchParams.get("priorityFilter")) {
					params.priorityFilter = url.searchParams
						.get("priorityFilter")
						?.split(",")
						.map((p) => p.trim());
				}

				// Get all tasks and project configuration
				const allTasks = await server.filesystem.listTasks();
				const allDrafts = await server.filesystem.listDrafts();
				const allDocuments = await server.filesystem.listDocuments();
				const allDecisions = await server.filesystem.listDecisions();
				const config = await server.filesystem.loadConfig();

				if (!config) {
					throw new Error("Project configuration not found. Please run 'backlog init' first.");
				}

				// Apply basic filtering
				let filteredTasks = allTasks;

				// Apply team filter if specified
				if (params.teamFilter && (params.teamFilter as string[]).length > 0) {
					filteredTasks = filteredTasks.filter(
						(task) =>
							task.assignee &&
							Array.isArray(task.assignee) &&
							task.assignee.some((assignee) =>
								(params.teamFilter as string[]).some((filter) => assignee.toLowerCase().includes(filter.toLowerCase())),
							),
					);
				}

				// Apply priority filter if specified
				if (params.priorityFilter && (params.priorityFilter as string[]).length > 0) {
					filteredTasks = filteredTasks.filter(
						(task) => task.priority && (params.priorityFilter as string[]).includes(task.priority),
					);
				}

				// Calculate basic project metrics
				const totalTasks = filteredTasks.length;
				const completedTasks = filteredTasks.filter((task) => (task.status || "").toLowerCase() === "done").length;
				const inProgressTasks = filteredTasks.filter(
					(task) => (task.status || "").toLowerCase() === "in progress",
				).length;
				const todoTasks = filteredTasks.filter((task) => (task.status || "").toLowerCase() === "to do").length;

				const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

				// Calculate status distribution
				const statusDistribution: Record<string, number> = {};
				filteredTasks.forEach((task) => {
					if (task.status) {
						statusDistribution[task.status] = (statusDistribution[task.status] || 0) + 1;
					}
				});

				// Calculate priority distribution
				const priorityDistribution: Record<string, number> = {};
				filteredTasks.forEach((task) => {
					if (task.priority) {
						priorityDistribution[task.priority] = (priorityDistribution[task.priority] || 0) + 1;
					}
				});

				// Calculate quality metrics
				const tasksWithDescription = filteredTasks.filter((task) => task.description?.trim()).length;
				const tasksWithAcceptanceCriteria = filteredTasks.filter(
					(task) => task.acceptanceCriteriaItems && task.acceptanceCriteriaItems.length > 0,
				).length;

				// Calculate weekly velocity
				const oneWeekAgo = new Date();
				oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
				const weeklyVelocity = filteredTasks.filter((task) => {
					if ((task.status || "").toLowerCase() !== "done") return false;
					const dateToCheck = task.updatedDate || task.createdDate;
					if (!dateToCheck) return false;
					const taskDate = new Date(dateToCheck);
					return taskDate >= oneWeekAgo;
				}).length;

				// Prepare comprehensive overview response
				const response = {
					overview: {
						projectName: config.projectName || "Project",
						totalTasks,
						totalDrafts: allDrafts.length,
						totalDocuments: allDocuments.length,
						totalDecisions: allDecisions.length,
						completionRate,
						lastUpdated: new Date().toISOString(),
					},
					taskMetrics: {
						completed: completedTasks,
						inProgress: inProgressTasks,
						todo: todoTasks,
						weeklyVelocity,
					},
					distribution: {
						status: statusDistribution,
						priority: priorityDistribution,
					},
					quality: {
						tasksWithDescription,
						tasksWithAcceptanceCriteria,
						documentationRate: totalTasks > 0 ? Math.round((tasksWithDescription / totalTasks) * 100) : 0,
						acceptanceCriteriaRate: totalTasks > 0 ? Math.round((tasksWithAcceptanceCriteria / totalTasks) * 100) : 0,
					},
					configuration: {
						statuses: config.statuses || [],
						workflowStages: (config.statuses || []).length,
					},
					filters: {
						...(params.timeframe ? { timeframe: params.timeframe as string } : {}),
						...(params.teamFilter ? { teamFilter: params.teamFilter as string[] } : {}),
						...(params.priorityFilter ? { priorityFilter: params.priorityFilter as string[] } : {}),
					},
				};

				return {
					contents: [
						{
							uri,
							mimeType: "application/json",
							text: JSON.stringify(response, null, 2),
						},
					],
				};
			} catch (error) {
				throw new Error(`Failed to read project overview resource: ${error}`);
			}
		},
	};
}

/**
 * Register all data resources with the MCP server
 */
export function registerDataResources(server: McpServer): void {
	server.addResource(createTaskListResource(server));
	server.addResource(createBoardStateResource(server));
	server.addResource(createProjectStatisticsResource(server));
	server.addResource(createDraftsListResource(server));
	server.addResource(createDocsListResource(server));
	server.addResource(createDecisionsListResource(server));
	server.addResource(createProjectOverviewResource(server));
}

// Export individual resource creators for testing
export {
	createTaskListResource,
	createBoardStateResource,
	createProjectStatisticsResource,
	createDraftsListResource,
	createDocsListResource,
	createDecisionsListResource,
	createProjectOverviewResource,
};
