import type { SearchPriorityFilter, Task, TaskListFilter, TaskSearchResult } from "../../../types/index.ts";
import type { TaskEditArgs, TaskEditRequest } from "../../../types/task-edit-args.ts";
import { normalizeDependencies } from "../../../utils/task-builders.ts";
import { buildTaskUpdateInput } from "../../../utils/task-edit-builder.ts";
import { sortTasks } from "../../../utils/task-sorting.ts";
import { McpError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";
import { formatTaskCallResult } from "../../utils/task-response.ts";

export type TaskCreateArgs = {
	title: string;
	description?: string;
	labels?: string[];
	assignee?: string[];
	priority?: "high" | "medium" | "low";
	status?: string;
	parentTaskId?: string;
	acceptanceCriteria?: string[];
	dependencies?: string[];
};

export type TaskListArgs = {
	status?: string;
	assignee?: string;
	labels?: string[];
	search?: string;
	limit?: number;
};

export type TaskSearchArgs = {
	query: string;
	status?: string;
	priority?: SearchPriorityFilter;
	limit?: number;
};

export class TaskHandlers {
	constructor(private readonly core: McpServer) {}

	private formatTaskSummaryLine(task: Task, options: { includeStatus?: boolean } = {}): string {
		const priorityIndicator = task.priority ? `[${task.priority.toUpperCase()}] ` : "";
		const statusText = options.includeStatus && task.status ? ` (${task.status})` : "";
		return `  ${priorityIndicator}${task.id} - ${task.title}${statusText}`;
	}

	private async loadTaskOrThrow(id: string): Promise<Task> {
		const task = await this.core.getTask(id);
		if (!task) {
			throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
		}
		return task;
	}

	async createTask(args: TaskCreateArgs): Promise<CallToolResult> {
		try {
			const acceptanceCriteria =
				args.acceptanceCriteria
					?.map((text) => String(text).trim())
					.filter((text) => text.length > 0)
					.map((text) => ({ text, checked: false })) ?? undefined;

			const { task: createdTask } = await this.core.createTaskFromInput({
				title: args.title,
				description: args.description,
				status: args.status,
				priority: args.priority,
				labels: args.labels,
				assignee: args.assignee,
				dependencies: args.dependencies,
				parentTaskId: args.parentTaskId,
				acceptanceCriteria,
			});

			return await formatTaskCallResult(createdTask);
		} catch (error) {
			if (error instanceof Error) {
				throw new McpError(error.message, "VALIDATION_ERROR");
			}
			throw new McpError(String(error), "VALIDATION_ERROR");
		}
	}

	async listTasks(args: TaskListArgs = {}): Promise<CallToolResult> {
		const filters: TaskListFilter = {};
		if (args.status) {
			filters.status = args.status;
		}
		if (args.assignee) {
			filters.assignee = args.assignee;
		}

		const tasks = await this.core.queryTasks({
			query: args.search,
			limit: args.limit,
			filters: Object.keys(filters).length > 0 ? filters : undefined,
		});

		let filteredByLabels = tasks;
		const labelFilters = args.labels ?? [];
		if (labelFilters.length > 0) {
			filteredByLabels = tasks.filter((task) => {
				const taskLabels = task.labels ?? [];
				return labelFilters.every((label) => taskLabels.includes(label));
			});
		}

		if (filteredByLabels.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: "No tasks found.",
					},
				],
			};
		}

		const config = await this.core.filesystem.loadConfig();
		const statuses = config?.statuses ?? [];

		const canonicalByLower = new Map<string, string>();
		for (const status of statuses) {
			canonicalByLower.set(status.toLowerCase(), status);
		}

		const grouped = new Map<string, Task[]>();
		for (const task of filteredByLabels) {
			const rawStatus = (task.status ?? "").trim();
			const canonicalStatus = canonicalByLower.get(rawStatus.toLowerCase()) ?? rawStatus;
			const bucketKey = canonicalStatus || "";
			const existing = grouped.get(bucketKey) ?? [];
			existing.push(task);
			grouped.set(bucketKey, existing);
		}

		const orderedStatuses = [
			...statuses.filter((status) => grouped.has(status)),
			...Array.from(grouped.keys()).filter((status) => !statuses.includes(status)),
		];

		const contentItems: Array<{ type: "text"; text: string }> = [];
		for (const status of orderedStatuses) {
			const bucket = grouped.get(status) ?? [];
			const sortedBucket = sortTasks(bucket, "priority");
			const sectionLines: string[] = [`${status || "No Status"}:`];
			for (const task of sortedBucket) {
				sectionLines.push(this.formatTaskSummaryLine(task));
			}
			contentItems.push({
				type: "text",
				text: sectionLines.join("\n"),
			});
		}

		if (contentItems.length === 0) {
			contentItems.push({
				type: "text",
				text: "No tasks found.",
			});
		}

		return {
			content: contentItems,
		};
	}

	async searchTasks(args: TaskSearchArgs): Promise<CallToolResult> {
		const query = args.query.trim();
		if (!query) {
			throw new McpError("Search query cannot be empty", "VALIDATION_ERROR");
		}

		const searchService = await this.core.getSearchService();
		const filters: { status?: string; priority?: SearchPriorityFilter } = {};
		if (args.status) {
			filters.status = args.status;
		}
		if (args.priority) {
			filters.priority = args.priority;
		}

		const results = searchService.search({
			query,
			limit: args.limit,
			types: ["task"],
			filters: Object.keys(filters).length > 0 ? filters : undefined,
		});

		const taskResults = results.filter((result): result is TaskSearchResult => result.type === "task");
		if (taskResults.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: `No tasks found for "${query}".`,
					},
				],
			};
		}

		const lines: string[] = ["Tasks:"];
		for (const { task } of taskResults) {
			lines.push(this.formatTaskSummaryLine(task, { includeStatus: true }));
		}

		return {
			content: [
				{
					type: "text",
					text: lines.join("\n"),
				},
			],
		};
	}

	async viewTask(args: { id: string }): Promise<CallToolResult> {
		const task = await this.loadTaskOrThrow(args.id);
		return await formatTaskCallResult(task);
	}

	async archiveTask(args: { id: string }): Promise<CallToolResult> {
		const task = await this.loadTaskOrThrow(args.id);
		const success = await this.core.archiveTask(task.id);
		if (!success) {
			throw new McpError(`Failed to archive task: ${args.id}`, "OPERATION_FAILED");
		}

		const refreshed = (await this.core.getTask(task.id)) ?? task;
		return await formatTaskCallResult(refreshed);
	}

	async demoteTask(args: { id: string }): Promise<CallToolResult> {
		const task = await this.loadTaskOrThrow(args.id);
		const success = await this.core.demoteTask(task.id, false);
		if (!success) {
			throw new McpError(`Failed to demote task: ${args.id}`, "OPERATION_FAILED");
		}

		const refreshed = (await this.core.getTask(task.id)) ?? task;
		return await formatTaskCallResult(refreshed);
	}

	async editTask(args: TaskEditRequest): Promise<CallToolResult> {
		try {
			const updateInput = buildTaskUpdateInput(args);
			const updatedTask = await this.core.editTask(args.id, updateInput);
			return await formatTaskCallResult(updatedTask);
		} catch (error) {
			if (error instanceof Error) {
				throw new McpError(error.message, "VALIDATION_ERROR");
			}
			throw new McpError(String(error), "VALIDATION_ERROR");
		}
	}
}

export type { TaskEditArgs, TaskEditRequest };
