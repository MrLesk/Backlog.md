import { formatTaskPlainText } from "../../ui/task-viewer-with-search.ts";
import { buildTaskFromMcpOptions } from "../../utils/task-builders.ts";
import { getTaskPath } from "../../utils/task-path.ts";
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
		try {
			// Use Core API for proper ID generation (cross-branch safe)
			const id = await this.server.generateNextId();

			// Build draft using shared utilities (same pattern as CLI)
			const draft = buildTaskFromMcpOptions(id, args);

			// Create draft using Core API
			const filepath = await this.server.createDraft(draft);

			// Load the created draft for proper formatting
			const createdDraft = await this.server.fs.loadDraft(id);
			const content = await Bun.file(filepath).text();

			if (createdDraft) {
				return {
					content: [
						{
							type: "text" as const,
							text: formatTaskPlainText(createdDraft, content, filepath),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully created draft: ${filepath}`,
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
				.map((draft) => formatTaskPlainText(draft, draft.rawContent))
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
			const draftText = formatTaskPlainText(draft, draft.rawContent);

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

			// Use Core API for draft promotion (same as CLI)
			const success = await this.server.promoteDraft(id);

			if (!success) {
				throw new McpError(`Failed to promote draft: ${id}`, "OPERATION_FAILED");
			}

			// After promotion, the task should have a proper task status, not "Draft"
			// Core's promoteDraft moves the file but keeps the "Draft" status
			const tasks = await this.server.fs.listTasks();
			const promotedTask = tasks.find((t) => t.title === draft.title && t.id === id);

			if (promotedTask) {
				// Update status to the provided status or default "To Do"
				const newStatus = status || "To Do";
				if (promotedTask.status !== newStatus) {
					promotedTask.status = newStatus;
					await this.server.updateTask(promotedTask);
				}
			}

			// Reload the promoted task after status update for display
			if (promotedTask) {
				const updatedTasks = await this.server.fs.listTasks();
				const finalTask = updatedTasks.find((t) => t.id === id);
				if (finalTask) {
					const taskPath = await getTaskPath(finalTask.id, { filesystem: { tasksDir: this.server.fs.tasksDir } });
					const content = taskPath ? await Bun.file(taskPath).text() : "";

					return {
						content: [
							{
								type: "text" as const,
								text: formatTaskPlainText(finalTask, content, taskPath || undefined),
							},
						],
					};
				}
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully promoted draft ${id} to task`,
					},
				],
			};
		} catch (error) {
			if (error instanceof McpError) {
				throw error;
			}
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

			// Use Core API for archiving (same as CLI)
			const success = await this.server.archiveDraft(id);

			if (!success) {
				throw new McpError(`Failed to archive draft: ${id}`, "OPERATION_FAILED");
			}

			// Format the archived draft using formatTaskPlainText since drafts are tasks
			const formattedDraft = formatTaskPlainText(draft, draft.rawContent);

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully archived draft:\n\n${formattedDraft}`,
					},
				],
			};
		} catch (error) {
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to archive draft: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
