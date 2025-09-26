import type { Task } from "../../types/index.ts";
import { formatTaskPlainText } from "../../ui/task-viewer.ts";
import { McpError } from "../errors/mcp-errors.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult } from "../types.ts";

/**
 * DraftToolHandlers class containing all draft management business logic
 */
export class DraftToolHandlers {
	constructor(private server: McpServer) {}

	/**
	 * Create a new draft
	 */
	async createDraft(args: {
		title: string;
		description?: string;
		labels?: string[];
		assignee?: string[];
		priority?: "high" | "medium" | "low";
	}): Promise<CallToolResult> {
		const { title, description, labels = [], assignee = [], priority } = args;

		try {
			// Generate draft ID (simple implementation, real one uses more complex logic)
			const drafts = await this.server.fs.listDrafts();
			const highestId = drafts.reduce((max, draft) => {
				const numericId = Number.parseInt(draft.id.replace("draft-", ""), 10);
				return Number.isNaN(numericId) ? max : Math.max(max, numericId);
			}, 0);
			const newId = `draft-${highestId + 1}`;

			const draft: Task = {
				id: newId,
				title,
				status: "", // Drafts don't have status
				assignee,
				createdDate: new Date().toISOString(),
				labels,
				dependencies: [], // Drafts don't have dependencies
				body: description || "",
				description,
				priority,
				acceptanceCriteriaItems: [], // Drafts don't have acceptance criteria initially
			};

			await this.server.fs.saveDraft(draft);

			// Format the draft using formatTaskPlainText since drafts are tasks
			const formattedDraft = formatTaskPlainText(draft, draft.body || "");

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully created draft:\n\n${formattedDraft}`,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to create draft: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * List drafts with optional filtering
	 */
	async listDrafts(
		args: { assignee?: string; labels?: string[]; search?: string; limit?: number } = {},
	): Promise<CallToolResult> {
		const { assignee, labels, search, limit = 50 } = args;

		try {
			const drafts = await this.server.fs.listDrafts();
			let filteredDrafts = drafts;

			// Apply filters
			if (assignee) {
				filteredDrafts = filteredDrafts.filter((draft) => draft.assignee.includes(assignee));
			}

			if (labels && Array.isArray(labels)) {
				filteredDrafts = filteredDrafts.filter((draft) => labels.every((label) => draft.labels.includes(label)));
			}

			if (search) {
				const searchTerm = search.toLowerCase();
				filteredDrafts = filteredDrafts.filter(
					(draft) =>
						draft.title.toLowerCase().includes(searchTerm) || draft.description?.toLowerCase().includes(searchTerm),
				);
			}

			// Apply limit
			filteredDrafts = filteredDrafts.slice(0, limit);

			if (filteredDrafts.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No drafts found.",
						},
					],
				};
			}

			// Format each draft using formatTaskPlainText since drafts are tasks
			const draftsText = filteredDrafts
				.map((draft) => formatTaskPlainText(draft, draft.body || ""))
				.join(`\n${"=".repeat(80)}\n\n`);

			return {
				content: [
					{
						type: "text" as const,
						text: `Found ${filteredDrafts.length} draft(s):\n\n${draftsText}`,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to list drafts: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * View a single draft
	 */
	async viewDraft(args: { id: string }): Promise<CallToolResult> {
		const { id } = args;

		try {
			const draft = await this.server.fs.loadDraft(id);

			if (!draft) {
				throw new McpError(`Draft not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Format the draft using formatTaskPlainText since drafts are tasks
			const draftText = formatTaskPlainText(draft, draft.body || "");

			return {
				content: [
					{
						type: "text" as const,
						text: draftText,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to view draft: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Promote a draft to a task
	 */
	async promoteDraft(args: { id: string; status?: string }): Promise<CallToolResult> {
		const { id, status } = args;

		try {
			const draft = await this.server.fs.loadDraft(id);

			if (!draft) {
				throw new McpError(`Draft not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Convert draft to task format
			const tasks = await this.server.fs.listTasks();
			const highestId = tasks.reduce((max, task) => {
				const numericId = Number.parseInt(task.id.replace("task-", ""), 10);
				return Number.isNaN(numericId) ? max : Math.max(max, numericId);
			}, 0);
			const newTaskId = `task-${highestId + 1}`;

			const task: Task = {
				...draft,
				id: newTaskId,
				status: status || "To Do",
				createdDate: new Date().toISOString(),
				updatedDate: new Date().toISOString(),
			};

			// Create the task
			await this.server.createTask(task);

			// Remove the draft using the filesystem abstraction
			// Note: We archive the draft to remove it cleanly through the proper abstraction
			await this.server.fs.archiveDraft(id);

			// Format the newly created task using formatTaskPlainText
			const formattedTask = formatTaskPlainText(task, task.body || "");

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully promoted draft ${id} to task:\n\n${formattedTask}`,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to promote draft: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Archive a draft
	 */
	async archiveDraft(args: { id: string }): Promise<CallToolResult> {
		const { id } = args;

		try {
			const draft = await this.server.fs.loadDraft(id);

			if (!draft) {
				throw new McpError(`Draft not found: ${id}`, "TASK_NOT_FOUND");
			}

			const archived = await this.server.fs.archiveDraft(id);

			if (!archived) {
				throw new McpError(`Failed to archive draft: ${id}`, "OPERATION_FAILED");
			}

			// Format the archived draft using formatTaskPlainText since drafts are tasks
			const formattedDraft = formatTaskPlainText(draft, draft.body || "");

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully archived draft:\n\n${formattedDraft}`,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to archive draft: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
