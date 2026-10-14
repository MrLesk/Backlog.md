import type { VacatedTaskResult } from "../../../core/backlog.ts";
import { findLocalDuplicateTaskIds } from "../../../core/duplicate-task-repair.ts";
import { loadTaskDetail, loadTaskListItems } from "../../../core/task-detail.ts";
import { isCreateLockError, isTaskLockError } from "../../../file-system/operations.ts";
import { isWorkingCopyTask, type SearchPriorityFilter, type Task, type TaskListFilter } from "../../../types/index.ts";
import type { TaskEditArgs, TaskEditRequest } from "../../../types/task-edit-args.ts";
import { formatAcceptanceCriteriaSummarySuffix } from "../../../ui/acceptance-criteria-progress.ts";
import { formatDependencyCleanupMessage } from "../../../utils/dependency-graph.ts";
import { formatDuplicateTaskIdWarning } from "../../../utils/duplicate-detection.ts";
import {
	createMilestoneFilterValueResolver,
	type MilestoneFilterValueResolver,
} from "../../../utils/milestone-filter.ts";
import { resolveMilestoneInputForStorage } from "../../../utils/milestone-storage.ts";
import { buildTaskUpdateInput } from "../../../utils/task-edit-builder.ts";
import { taskNotFoundMessage } from "../../../utils/task-path.ts";
import { applyTaskFilters, createTaskSearchIndex } from "../../../utils/task-search.ts";
import { sectionTasks, sortTasks } from "../../../utils/task-sorting.ts";
import { formatUtcDateForDisplay } from "../../../utils/utc-date-display.ts";
import { BacklogToolError, runCoreOperation } from "../../errors/mcp-errors.ts";
import type { McpServer } from "../../server.ts";
import type { CallToolResult } from "../../types.ts";
import { formatTaskCallResult } from "../../utils/task-response.ts";

export type TaskCreateArgs = {
	title: string;
	description?: string;
	labels?: string[];
	assignee?: string[];
	priority?: string;
	type?: string;
	project?: string;
	ordinal?: number;
	status?: string;
	dueDate?: string;
	milestone?: string;
	parentTaskId?: string;
	acceptanceCriteria?: string[];
	definitionOfDoneAdd?: string[];
	disableDefinitionOfDoneDefaults?: boolean;
	dependencies?: string[];
	references?: string[];
	documentation?: string[];
	modifiedFiles?: string[];
	finalSummary?: string;
};

export type TaskListArgs = {
	status?: string;
	type?: string[];
	project?: string[];
	assignee?: string;
	unassigned?: boolean;
	milestone?: string;
	labels?: string[];
	search?: string;
	ready?: boolean;
	limit?: number;
};

export type TaskSearchArgs = {
	query?: string;
	status?: string;
	type?: string[];
	project?: string[];
	priority?: SearchPriorityFilter;
	modifiedFiles?: string[];
	limit?: number;
};

export class TaskHandlers {
	constructor(private readonly core: McpServer) {}

	private async resolveMilestoneInput(milestone: string): Promise<string> {
		const [activeMilestones, archivedMilestones] = await Promise.all([
			this.core.filesystem.listMilestones(),
			this.core.filesystem.listArchivedMilestones(),
		]);
		return resolveMilestoneInputForStorage(milestone, activeMilestones, archivedMilestones);
	}

	private async createMilestoneFilterValueResolver(): Promise<MilestoneFilterValueResolver> {
		const [activeMilestones, archivedMilestones] = await Promise.all([
			this.core.filesystem.listMilestones(),
			this.core.filesystem.listArchivedMilestones(),
		]);
		return createMilestoneFilterValueResolver([...activeMilestones, ...archivedMilestones]);
	}

	private isDraftStatus(status?: string | null): boolean {
		return (status ?? "").trim().toLowerCase() === "draft";
	}

	private formatTaskSummaryLine(task: Task, options: { includeStatus?: boolean } = {}): string {
		const priorityIndicator = task.priority ? `[${task.priority.toUpperCase()}] ` : "";
		const typeIndicator = task.type ? `[${task.type}] ` : "";
		const projectIndicator = task.project ? `[${task.project}] ` : "";
		// An archived task is off the board whatever its status says, so its line says so.
		const statusParts = [task.status, task.source === "archived" ? "archived" : ""].filter(Boolean);
		const statusText = options.includeStatus && statusParts.length > 0 ? ` (${statusParts.join(", ")})` : "";
		const acceptanceCriteria = formatAcceptanceCriteriaSummarySuffix(task);
		const dueDate = task.dueDate ? ` (due ${formatUtcDateForDisplay(task.dueDate)})` : "";
		return `  ${priorityIndicator}${typeIndicator}${projectIndicator}${task.id} - ${task.title}${statusText}${acceptanceCriteria}${dueDate}`;
	}

	private async loadTaskOrThrow(id: string): Promise<Task> {
		const task = await this.core.getTask(id);
		if (!task) {
			throw new BacklogToolError(taskNotFoundMessage(id), "TASK_NOT_FOUND");
		}
		return task;
	}

	async createTask(args: TaskCreateArgs): Promise<CallToolResult> {
		try {
			const rawOrdinal = (args as { ordinal?: unknown }).ordinal;
			if (rawOrdinal === null) {
				throw new BacklogToolError("Ordinal must be a non-negative number.", "VALIDATION_ERROR");
			}

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
				dueDate: args.dueDate,
				status: args.status,
				priority: args.priority,
				type: args.type,
				project: args.project,
				...(typeof rawOrdinal === "number" ? { ordinal: rawOrdinal } : {}),
				milestone,
				labels: args.labels,
				assignee: args.assignee,
				dependencies: args.dependencies,
				references: args.references,
				documentation: args.documentation,
				modifiedFiles: args.modifiedFiles,
				parentTaskId: args.parentTaskId,
				finalSummary: args.finalSummary,
				acceptanceCriteria,
				definitionOfDoneAdd: args.definitionOfDoneAdd,
				disableDefinitionOfDoneDefaults: args.disableDefinitionOfDoneDefaults,
			});

			return await formatTaskCallResult(await loadTaskDetail(this.core, createdTask));
		} catch (error) {
			if (isCreateLockError(error)) {
				throw new BacklogToolError(error.message, "OPERATION_FAILED");
			}
			if (error instanceof Error) {
				throw new BacklogToolError(error.message, "VALIDATION_ERROR");
			}
			throw new BacklogToolError(String(error), "VALIDATION_ERROR");
		}
	}

	async listTasks(args: TaskListArgs = {}): Promise<CallToolResult> {
		if (args.assignee && args.unassigned) {
			throw new BacklogToolError("unassigned cannot be combined with assignee.", "VALIDATION_ERROR");
		}
		const config = await this.core.filesystem.loadConfig();
		const priorities = config?.priorities;
		if (this.isDraftStatus(args.status)) {
			let drafts = applyTaskFilters(await this.core.filesystem.listDrafts(), {
				query: args.search,
				// Searching drafts has always narrowed to the literal "Draft" status; listing them has not.
				status: args.search || args.type?.length || args.project?.length ? "Draft" : undefined,
				type: args.type,
				project: args.project,
				assignee: args.assignee,
				unassigned: args.unassigned,
				milestone: args.milestone,
				resolveMilestoneLabel: args.milestone ? await this.createMilestoneFilterValueResolver() : undefined,
				labels: args.labels,
				labelMatch: "all",
			});
			if (args.ready) {
				drafts = (await loadTaskListItems(this.core, drafts)).filter((draft) => draft.isReady);
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

			let sortedDrafts = sortTasks(drafts, undefined, priorities);
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
		if (args.type?.length) {
			filters.type = args.type;
		}
		if (args.project?.length) {
			filters.project = args.project;
		}
		if (args.assignee) {
			filters.assignee = args.assignee;
		}
		if (args.unassigned) {
			filters.unassigned = true;
		}
		if (args.milestone) {
			filters.milestone = args.milestone;
		}
		if (args.labels?.length) {
			filters.labels = args.labels;
			filters.labelMatch = "all";
		}

		let tasks = await this.core.queryTasks({
			query: args.search,
			filters: Object.keys(filters).length > 0 ? filters : undefined,
			includeCrossBranch: false,
		});

		if (args.ready) {
			// The same shared verdict `task list --ready` filters on, resolved against the whole
			// corpus rather than the tasks the filters above left.
			tasks = (await loadTaskListItems(this.core, tasks)).filter((task) => task.isReady);
		}

		const filteredByLabels = tasks.filter((task) => isWorkingCopyTask(task));

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

		// The list has no sort option, so it is in the default order of a task list and always in
		// status sections. `limit` counts rows in the order the sections print them.
		const sections = sectionTasks(
			sortTasks(filteredByLabels, undefined, priorities),
			undefined,
			config?.statuses ?? [],
		);

		const contentItems: Array<{ type: "text"; text: string }> = [];
		let remaining = typeof args.limit === "number" && args.limit >= 0 ? args.limit : undefined;
		for (const section of sections) {
			const limitedTasks = remaining !== undefined ? section.tasks.slice(0, remaining) : section.tasks;
			if (remaining !== undefined) {
				remaining -= limitedTasks.length;
			}
			if (limitedTasks.length === 0) {
				continue;
			}
			const sectionLines: string[] = [`${section.status || "No Status"}:`];
			for (const task of limitedTasks) {
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

		try {
			const duplicateGroups = await findLocalDuplicateTaskIds(this.core);
			if (duplicateGroups.length > 0) {
				contentItems.unshift({
					type: "text",
					text: formatDuplicateTaskIdWarning(duplicateGroups),
				});
			}
		} catch {
			// Duplicate detection is best-effort; skip if filesystem is unavailable
		}

		return {
			content: contentItems,
		};
	}

	async searchTasks(args: TaskSearchArgs): Promise<CallToolResult> {
		const query = args.query?.trim() ?? "";
		const modifiedFiles = args.modifiedFiles?.map((file) => file.trim()).filter((file) => file.length > 0);
		if (!query && (!modifiedFiles || modifiedFiles.length === 0) && !args.type?.length && !args.project?.length) {
			throw new BacklogToolError(
				"Search query, modifiedFiles, type filter, or project filter is required",
				"VALIDATION_ERROR",
			);
		}

		if (this.isDraftStatus(args.status)) {
			const drafts = await this.core.filesystem.listDrafts();
			const searchIndex = createTaskSearchIndex(drafts);
			let draftMatches = searchIndex.search({
				query,
				status: "Draft",
				type: args.type,
				project: args.project,
				priority: args.priority,
				modifiedFiles,
			});
			if (typeof args.limit === "number" && args.limit >= 0) {
				draftMatches = draftMatches.slice(0, args.limit);
			}

			if (draftMatches.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `No tasks found for "${query || modifiedFiles?.join(", ")}".`,
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

		const tasks = await this.core.loadWorkingCopyTasks(true);
		const searchIndex = createTaskSearchIndex(tasks);
		let taskMatches = searchIndex.search({
			query,
			status: args.status,
			type: args.type,
			project: args.project,
			priority: args.priority,
			modifiedFiles,
		});
		if (typeof args.limit === "number" && args.limit >= 0) {
			taskMatches = taskMatches.slice(0, args.limit);
		}

		const taskResults = taskMatches.filter((task) => isWorkingCopyTask(task));
		if (taskResults.length === 0) {
			return {
				content: [
					{
						type: "text",
						text: `No tasks found for "${query || modifiedFiles?.join(", ")}".`,
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
			return await formatTaskCallResult(await loadTaskDetail(this.core, draft));
		}

		const task = await this.core.getTaskWithSubtasks(args.id);
		if (!task) {
			throw new BacklogToolError(taskNotFoundMessage(args.id), "TASK_NOT_FOUND");
		}
		// Task detail is the only MCP result read through the detail path, so it is the only one that
		// carries the graph. The edit and lifecycle confirmations stay as short as they were.
		return await formatTaskCallResult(await loadTaskDetail(this.core, task));
	}

	async archiveTask(args: { id: string }): Promise<CallToolResult> {
		const draft = await this.core.filesystem.loadDraft(args.id);
		if (draft) {
			const success = await this.core.archiveDraft(draft.id);
			if (!success) {
				throw new BacklogToolError(`Failed to archive task: ${args.id}`, "OPERATION_FAILED");
			}

			return await formatTaskCallResult(await loadTaskDetail(this.core, draft), [`Archived draft ${draft.id}.`]);
		}

		const task = await this.loadTaskOrThrow(args.id);
		if (!(await runCoreOperation(() => this.core.archiveTask(task.id)))) {
			throw new BacklogToolError(taskNotFoundMessage(args.id), "TASK_NOT_FOUND");
		}

		const refreshed = (await this.core.getTask(task.id)) ?? task;
		return await formatTaskCallResult(await loadTaskDetail(this.core, refreshed), [`Archived task ${task.id}.`]);
	}

	async deleteTask(args: { id: string }): Promise<CallToolResult> {
		const task = await this.loadTaskOrThrow(args.id);
		const deletion = await runCoreOperation(() => this.core.deleteTask(task.id));
		if (!deletion.success) {
			throw new BacklogToolError(taskNotFoundMessage(args.id), "TASK_NOT_FOUND");
		}

		const cleanupMessage = formatDependencyCleanupMessage(task.id, deletion.cleanedTaskIds);
		const lines = [`Deleted task ${task.id}.`, ...(cleanupMessage ? [`${cleanupMessage}.`] : [])];
		return { content: [{ type: "text", text: lines.join("\n") }] };
	}

	async restoreTask(args: { id: string }): Promise<CallToolResult> {
		const task = await this.loadTaskOrThrow(args.id);
		if (!(await runCoreOperation(() => this.core.restoreTask(task.id)))) {
			throw new BacklogToolError(taskNotFoundMessage(args.id), "TASK_NOT_FOUND");
		}

		const refreshed = (await this.core.getTask(task.id)) ?? task;
		return await formatTaskCallResult(await loadTaskDetail(this.core, refreshed), [`Restored task ${task.id}.`]);
	}

	async demoteTask(args: { id: string }): Promise<CallToolResult> {
		const task = await this.loadTaskOrThrow(args.id);
		let demotion: VacatedTaskResult;
		try {
			demotion = await this.core.demoteTask(task.id, false);
		} catch (error) {
			if (isCreateLockError(error)) {
				throw new BacklogToolError(error.message, "OPERATION_FAILED");
			}
			throw error;
		}
		if (!demotion.success) {
			throw new BacklogToolError(`Failed to demote task: ${args.id}`, "OPERATION_FAILED");
		}

		const refreshed = (await this.core.getTask(task.id)) ?? task;
		const cleanupMessage = formatDependencyCleanupMessage(task.id, demotion.cleanedTaskIds);
		return await formatTaskCallResult(
			await loadTaskDetail(this.core, refreshed),
			cleanupMessage ? [`${cleanupMessage}.`] : undefined,
		);
	}

	async editTask(args: TaskEditRequest): Promise<CallToolResult> {
		try {
			const rawOrdinal = (args as { ordinal?: unknown }).ordinal;
			if (rawOrdinal === null) {
				throw new BacklogToolError("Ordinal must be a non-negative number.", "VALIDATION_ERROR");
			}

			const updateInput = buildTaskUpdateInput(args);
			if (typeof updateInput.milestone === "string") {
				updateInput.milestone = await this.resolveMilestoneInput(updateInput.milestone);
			}
			const { task: updatedTask, cleanedTaskIds } = await this.core.editTaskOrDraft(args.id, updateInput);
			const cleanupMessage = formatDependencyCleanupMessage(args.id, cleanedTaskIds);
			return await formatTaskCallResult(
				await loadTaskDetail(this.core, updatedTask),
				cleanupMessage ? [`${cleanupMessage}.`] : undefined,
			);
		} catch (error) {
			if (isTaskLockError(error)) {
				throw new BacklogToolError(error.message, "OPERATION_FAILED");
			}
			if (error instanceof Error) {
				throw new BacklogToolError(error.message, "VALIDATION_ERROR");
			}
			throw new BacklogToolError(String(error), "VALIDATION_ERROR");
		}
	}
}

export type { TaskEditArgs, TaskEditRequest };
