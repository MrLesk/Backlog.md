import { basename, join } from "node:path";
import {
	isLocalEditableTask,
	type Milestone,
	type SearchPriorityFilter,
	type Task,
	type TaskListFilter,
} from "../../../types/index.ts";
import type { TaskEditArgs, TaskEditRequest } from "../../../types/task-edit-args.ts";
import { buildTaskUpdateInput } from "../../../utils/task-edit-builder.ts";
import { createTaskSearchIndex } from "../../../utils/task-search.ts";
import { sortTasks } from "../../../utils/task-sorting.ts";
import { McpError } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";
import { milestoneKey } from "../../utils/milestone-resolution.ts";
import { formatTaskCallResult } from "../../utils/task-response.ts";

export type TaskCreateArgs = {
	title: string;
	description?: string;
	labels?: string[];
	assignee?: string[];
	priority?: "high" | "medium" | "low";
	status?: string;
	milestone?: string;
	parentTaskId?: string;
	acceptanceCriteria?: string[];
	definitionOfDoneAdd?: string[];
	disableDefinitionOfDoneDefaults?: boolean;
	dependencies?: string[];
	references?: string[];
	documentation?: string[];
	finalSummary?: string;
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

	private async resolveMilestoneInput(milestone: string): Promise<string> {
		const [activeMilestones, archivedMilestones] = await Promise.all([
			this.core.filesystem.listMilestones(),
			this.core.filesystem.listArchivedMilestones(),
		]);
		const normalized = milestone.trim();
		const inputKey = milestoneKey(normalized);
		const aliasKeys = new Set<string>([inputKey]);
		const looksLikeMilestoneId = /^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized);
		const canonicalInputId =
			/^\d+$/.test(normalized) || /^m-\d+$/i.test(normalized)
				? `m-${String(Number.parseInt(normalized.replace(/^m-/i, ""), 10))}`
				: null;
		if (/^\d+$/.test(normalized)) {
			const numericAlias = String(Number.parseInt(normalized, 10));
			aliasKeys.add(numericAlias);
			aliasKeys.add(`m-${numericAlias}`);
		} else {
			const idMatch = normalized.match(/^m-(\d+)$/i);
			if (idMatch?.[1]) {
				const numericAlias = String(Number.parseInt(idMatch[1], 10));
				aliasKeys.add(numericAlias);
				aliasKeys.add(`m-${numericAlias}`);
			}
		}
		const idMatchesAlias = (milestoneId: string): boolean => {
			const idKey = milestoneKey(milestoneId);
			if (aliasKeys.has(idKey)) {
				return true;
			}
			if (/^\d+$/.test(milestoneId.trim())) {
				const numericAlias = String(Number.parseInt(milestoneId.trim(), 10));
				return aliasKeys.has(numericAlias) || aliasKeys.has(`m-${numericAlias}`);
			}
			const idMatch = milestoneId.trim().match(/^m-(\d+)$/i);
			if (!idMatch?.[1]) {
				return false;
			}
			const numericAlias = String(Number.parseInt(idMatch[1], 10));
			return aliasKeys.has(numericAlias) || aliasKeys.has(`m-${numericAlias}`);
		};
		const findIdMatch = (milestones: Milestone[]): Milestone | undefined => {
			const rawExactMatch = milestones.find((item) => milestoneKey(item.id) === inputKey);
			if (rawExactMatch) {
				return rawExactMatch;
			}
			if (canonicalInputId) {
				const canonicalRawMatch = milestones.find((item) => milestoneKey(item.id) === canonicalInputId);
				if (canonicalRawMatch) {
					return canonicalRawMatch;
				}
			}
			return milestones.find((item) => idMatchesAlias(item.id));
		};
		const findUniqueTitleMatch = (milestones: Milestone[]): Milestone | null => {
			const titleMatches = milestones.filter((item) => milestoneKey(item.title) === inputKey);
			if (titleMatches.length === 1) {
				return titleMatches[0] ?? null;
			}
			return null;
		};
		const resolveByAlias = (milestones: Milestone[]): string | null => {
			const idMatch = findIdMatch(milestones);
			const titleMatch = findUniqueTitleMatch(milestones);
			if (looksLikeMilestoneId) {
				return idMatch?.id ?? null;
			}
			if (titleMatch) {
				return titleMatch.id;
			}
			if (idMatch) {
				return idMatch.id;
			}
			return null;
		};

		const activeTitleMatches = activeMilestones.filter((item) => milestoneKey(item.title) === inputKey);
		const hasAmbiguousActiveTitle = activeTitleMatches.length > 1;
		if (looksLikeMilestoneId) {
			const activeIdMatch = findIdMatch(activeMilestones);
			if (activeIdMatch) {
				return activeIdMatch.id;
			}
			const archivedIdMatch = findIdMatch(archivedMilestones);
			if (archivedIdMatch) {
				return archivedIdMatch.id;
			}
			if (activeTitleMatches.length === 1) {
				return activeTitleMatches[0]?.id ?? normalized;
			}
			if (hasAmbiguousActiveTitle) {
				return normalized;
			}
			const archivedTitleMatch = findUniqueTitleMatch(archivedMilestones);
			return archivedTitleMatch?.id ?? normalized;
		}

		const activeMatch = resolveByAlias(activeMilestones);
		if (activeMatch) {
			return activeMatch;
		}
		if (hasAmbiguousActiveTitle) {
			return normalized;
		}
		return resolveByAlias(archivedMilestones) ?? normalized;
	}

	private isDoneStatus(status?: string | null): boolean {
		const normalized = (status ?? "").trim().toLowerCase();
		return normalized.includes("done") || normalized.includes("complete");
	}

	private isDraftStatus(status?: string | null): boolean {
		return (status ?? "").trim().toLowerCase() === "draft";
	}

	private formatTaskSummaryLine(task: Task, options: { includeStatus?: boolean } = {}): string {
		const priorityIndicator = task.priority ? `[${task.priority.toUpperCase()}] ` : "";
		const status = task.status || (task.source === "completed" ? "Done" : "");
		const statusText = options.includeStatus && status ? ` (${status})` : "";
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

			const milestone =
				typeof args.milestone === "string" ? await this.resolveMilestoneInput(args.milestone) : undefined;

			const { task: createdTask } = await this.core.createTaskFromInput({
				title: args.title,
				description: args.description,
				status: args.status,
				priority: args.priority,
				milestone,
				labels: args.labels,
				assignee: args.assignee,
				dependencies: args.dependencies,
				references: args.references,
				documentation: args.documentation,
				parentTaskId: args.parentTaskId,
				finalSummary: args.finalSummary,
				acceptanceCriteria,
				definitionOfDoneAdd: args.definitionOfDoneAdd,
				disableDefinitionOfDoneDefaults: args.disableDefinitionOfDoneDefaults,
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
		if (this.isDraftStatus(args.status)) {
			let drafts = await this.core.filesystem.listDrafts();
			if (args.search) {
				const draftSearch = createTaskSearchIndex(drafts);
				drafts = draftSearch.search({ query: args.search, status: "Draft" });
			}

			if (args.assignee) {
				drafts = drafts.filter((draft) => (draft.assignee ?? []).includes(args.assignee ?? ""));
			}

			const labelFilters = args.labels ?? [];
			if (labelFilters.length > 0) {
				drafts = drafts.filter((draft) => {
					const draftLabels = draft.labels ?? [];
					return labelFilters.every((label) => draftLabels.includes(label));
				});
			}

			if (drafts.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: "No tasks found.",
						},
					],
				};
			}

			let sortedDrafts = sortTasks(drafts, "priority");
			if (typeof args.limit === "number" && args.limit >= 0) {
				sortedDrafts = sortedDrafts.slice(0, args.limit);
			}
			const lines = ["Draft:"];
			for (const draft of sortedDrafts) {
				lines.push(this.formatTaskSummaryLine(draft));
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
			includeCrossBranch: false,
		});

		let filteredByLabels = tasks.filter((task) => isLocalEditableTask(task));
		const labelFilters = args.labels ?? [];
		if (labelFilters.length > 0) {
			filteredByLabels = filteredByLabels.filter((task) => {
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

		if (this.isDraftStatus(args.status)) {
			const drafts = await this.core.filesystem.listDrafts();
			const searchIndex = createTaskSearchIndex(drafts);
			let draftMatches = searchIndex.search({
				query,
				status: "Draft",
				priority: args.priority,
			});
			if (typeof args.limit === "number" && args.limit >= 0) {
				draftMatches = draftMatches.slice(0, args.limit);
			}

			if (draftMatches.length === 0) {
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
			for (const draft of draftMatches) {
				lines.push(this.formatTaskSummaryLine(draft, { includeStatus: true }));
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

		const tasks = await this.core.loadTasks(undefined, undefined, { includeCompleted: true });
		const searchIndex = createTaskSearchIndex(tasks);
		let taskMatches = searchIndex.search({
			query,
			status: args.status,
			priority: args.priority,
		});
		if (typeof args.limit === "number" && args.limit >= 0) {
			taskMatches = taskMatches.slice(0, args.limit);
		}

		const taskResults = taskMatches.filter((task) => isLocalEditableTask(task));
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
		for (const task of taskResults) {
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
		const draft = await this.core.filesystem.loadDraft(args.id);
		if (draft) {
			return await formatTaskCallResult(draft);
		}

		const task = await this.core.getTaskWithSubtasks(args.id);
		if (!task) {
			throw new McpError(`Task not found: ${args.id}`, "TASK_NOT_FOUND");
		}
		return await formatTaskCallResult(task);
	}

	async archiveTask(args: { id: string }): Promise<CallToolResult> {
		const draft = await this.core.filesystem.loadDraft(args.id);
		if (draft) {
			const success = await this.core.archiveDraft(draft.id);
			if (!success) {
				throw new McpError(`Failed to archive task: ${args.id}`, "OPERATION_FAILED");
			}

			return await formatTaskCallResult(draft, [`Archived draft ${draft.id}.`]);
		}

		const task = await this.loadTaskOrThrow(args.id);

		if (!isLocalEditableTask(task)) {
			throw new McpError(`Cannot archive task from another branch: ${task.id}`, "VALIDATION_ERROR");
		}

		if (this.isDoneStatus(task.status)) {
			throw new McpError(
				`Task ${task.id} is Done. Done tasks should be completed (moved to the completed folder), not archived. Use task_complete instead.`,
				"VALIDATION_ERROR",
			);
		}

		const success = await this.core.archiveTask(task.id);
		if (!success) {
			throw new McpError(`Failed to archive task: ${args.id}`, "OPERATION_FAILED");
		}

		const refreshed = (await this.core.getTask(task.id)) ?? task;
		return await formatTaskCallResult(refreshed);
	}

	async completeTask(args: { id: string }): Promise<CallToolResult> {
		const task = await this.loadTaskOrThrow(args.id);

		if (!isLocalEditableTask(task)) {
			throw new McpError(`Cannot complete task from another branch: ${task.id}`, "VALIDATION_ERROR");
		}

		if (!this.isDoneStatus(task.status)) {
			throw new McpError(
				`Task ${task.id} is not Done. Set status to "Done" with task_edit before completing it.`,
				"VALIDATION_ERROR",
			);
		}

		const filePath = task.filePath ?? null;
		const completedFilePath = filePath ? join(this.core.filesystem.completedDir, basename(filePath)) : undefined;

		const success = await this.core.completeTask(task.id);
		if (!success) {
			throw new McpError(`Failed to complete task: ${args.id}`, "OPERATION_FAILED");
		}

		return await formatTaskCallResult(task, [`Completed task ${task.id}.`], {
			filePathOverride: completedFilePath,
		});
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
			if (typeof updateInput.milestone === "string") {
				updateInput.milestone = await this.resolveMilestoneInput(updateInput.milestone);
			}
			const updatedTask = await this.core.editTaskOrDraft(args.id, updateInput);
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
