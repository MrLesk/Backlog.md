import { handleMcpError, McpError } from "../errors/mcp-errors.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult } from "../types.ts";

/**
 * Interface for notes operation parameters
 */
export interface NotesSetParams {
	id: string;
	content: string;
}

export interface NotesAppendParams {
	id: string;
	content: string;
	separator?: string;
}

export interface NotesGetParams {
	id: string;
}

export interface NotesClearParams {
	id: string;
}

export interface PlanSetParams {
	id: string;
	content: string;
}

export interface PlanAppendParams {
	id: string;
	content: string;
	separator?: string;
}

export interface PlanGetParams {
	id: string;
}

export interface PlanClearParams {
	id: string;
}

/**
 * Validates that a separator doesn't contain control characters that would break markdown
 */
function validateSeparator(separator: string): string[] {
	const errors: string[] = [];

	// Check for control characters (except newline and tab which are allowed)
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Need to validate control characters for separator
	const hasInvalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(separator);
	if (hasInvalidChars) {
		errors.push("Separator contains invalid control characters");
	}

	return errors;
}

/**
 * Format notes operation result as readable markdown
 */
function formatNotesOperationResult(
	operation: string,
	taskId: string,
	details: {
		contentLength?: number;
		appendedLength?: number;
		totalLength?: number;
		separator?: string;
		content?: string;
	},
): string {
	const lines = [];

	switch (operation) {
		case "notes_set":
			lines.push(`**Implementation Notes Updated** for task ${taskId}`);
			lines.push(`✓ Content length: ${details.contentLength} characters`);
			break;
		case "notes_append":
			lines.push(`**Implementation Notes Appended** to task ${taskId}`);
			lines.push(`✓ Appended: ${details.appendedLength} characters`);
			lines.push(`✓ Total length: ${details.totalLength} characters`);
			if (details.separator !== "\n\n") {
				lines.push(`✓ Separator: "${details.separator}"`);
			}
			break;
		case "notes_get":
			lines.push(`**Implementation Notes** for task ${taskId}`);
			lines.push(`Length: ${details.contentLength} characters`);
			lines.push("");
			lines.push("---");
			lines.push("");
			lines.push(details.content || "*No implementation notes*");
			break;
		case "notes_clear":
			lines.push(`**Implementation Notes Cleared** for task ${taskId}`);
			lines.push("✓ All notes have been removed");
			break;
	}

	return lines.join("\n");
}

/**
 * Format plan operation result as readable markdown
 */
function formatPlanOperationResult(
	operation: string,
	taskId: string,
	details: {
		contentLength?: number;
		appendedLength?: number;
		totalLength?: number;
		separator?: string;
		content?: string;
	},
): string {
	const lines = [];

	switch (operation) {
		case "plan_set":
			lines.push(`**Implementation Plan Updated** for task ${taskId}`);
			lines.push(`✓ Content length: ${details.contentLength} characters`);
			break;
		case "plan_append":
			lines.push(`**Implementation Plan Appended** to task ${taskId}`);
			lines.push(`✓ Appended: ${details.appendedLength} characters`);
			lines.push(`✓ Total length: ${details.totalLength} characters`);
			if (details.separator !== "\n\n") {
				lines.push(`✓ Separator: "${details.separator}"`);
			}
			break;
		case "plan_get":
			lines.push(`**Implementation Plan** for task ${taskId}`);
			lines.push(`Length: ${details.contentLength} characters`);
			lines.push("");
			lines.push("---");
			lines.push("");
			lines.push(details.content || "*No implementation plan*");
			break;
		case "plan_clear":
			lines.push(`**Implementation Plan Cleared** for task ${taskId}`);
			lines.push("✓ All plan content has been removed");
			break;
	}

	return lines.join("\n");
}

/**
 * Handlers for notes management tools
 */
export class NotesToolHandlers {
	constructor(private server: McpServer) {}

	/**
	 * Set implementation notes (replace existing content)
	 */
	async setNotes(params: NotesSetParams): Promise<CallToolResult> {
		try {
			// Validate content size
			if (params.content.length > 50000) {
				return handleMcpError(
					new McpError(
						`Content exceeds maximum size limit of 50,000 characters (${params.content.length} characters)`,
						"CONTENT_TOO_LARGE",
					),
				);
			}

			// Load the task
			const task = await this.server.fs.loadTask(params.id);
			if (!task) {
				return handleMcpError(new McpError(`Task with ID '${params.id}' not found`, "TASK_NOT_FOUND"));
			}

			// Update implementation notes
			task.implementationNotes = params.content;

			// Save the updated task
			await this.server.updateTask(task);

			return {
				content: [
					{
						type: "text",
						text: formatNotesOperationResult("notes_set", params.id, {
							contentLength: params.content.length,
						}),
					},
				],
			};
		} catch (error) {
			return handleMcpError(error);
		}
	}

	/**
	 * Append to implementation notes
	 */
	async appendNotes(params: NotesAppendParams): Promise<CallToolResult> {
		try {
			const separator = params.separator || "\n\n";

			// Validate separator
			const separatorErrors = validateSeparator(separator);
			if (separatorErrors.length > 0) {
				return handleMcpError(new McpError(separatorErrors.join(", "), "VALIDATION_ERROR"));
			}

			// Load the task
			const task = await this.server.fs.loadTask(params.id);
			if (!task) {
				return handleMcpError(new McpError(`Task with ID '${params.id}' not found`, "TASK_NOT_FOUND"));
			}

			// Append to existing notes
			const existingNotes = task.implementationNotes || "";
			const newContent = existingNotes ? `${existingNotes}${separator}${params.content}` : params.content;

			// Check total size doesn't exceed limit
			if (newContent.length > 50000) {
				return handleMcpError(
					new McpError(
						`Combined content exceeds maximum size limit of 50,000 characters (would be ${newContent.length} characters)`,
						"CONTENT_TOO_LARGE",
					),
				);
			}

			task.implementationNotes = newContent;

			// Save the updated task
			await this.server.updateTask(task);

			return {
				content: [
					{
						type: "text",
						text: formatNotesOperationResult("notes_append", params.id, {
							appendedLength: params.content.length,
							totalLength: newContent.length,
							separator: separator,
						}),
					},
				],
			};
		} catch (error) {
			return handleMcpError(error);
		}
	}

	/**
	 * Get implementation notes
	 */
	async getNotes(params: NotesGetParams): Promise<CallToolResult> {
		try {
			// Load the task
			const task = await this.server.fs.loadTask(params.id);
			if (!task) {
				return handleMcpError(new McpError(`Task with ID '${params.id}' not found`, "TASK_NOT_FOUND"));
			}

			const notes = task.implementationNotes || "";

			return {
				content: [
					{
						type: "text",
						text: formatNotesOperationResult("notes_get", params.id, {
							content: notes,
							contentLength: notes.length,
						}),
					},
				],
			};
		} catch (error) {
			return handleMcpError(error);
		}
	}

	/**
	 * Clear implementation notes
	 */
	async clearNotes(params: NotesClearParams): Promise<CallToolResult> {
		try {
			// Load the task
			const task = await this.server.fs.loadTask(params.id);
			if (!task) {
				return handleMcpError(new McpError(`Task with ID '${params.id}' not found`, "TASK_NOT_FOUND"));
			}

			// Clear implementation notes
			task.implementationNotes = "";

			// Save the updated task
			await this.server.updateTask(task);

			return {
				content: [
					{
						type: "text",
						text: formatNotesOperationResult("notes_clear", params.id, {}),
					},
				],
			};
		} catch (error) {
			return handleMcpError(error);
		}
	}

	/**
	 * Set implementation plan (replace existing content)
	 */
	async setPlan(params: PlanSetParams): Promise<CallToolResult> {
		try {
			// Validate content size
			if (params.content.length > 50000) {
				return handleMcpError(
					new McpError(
						`Content exceeds maximum size limit of 50,000 characters (${params.content.length} characters)`,
						"CONTENT_TOO_LARGE",
					),
				);
			}

			// Load the task
			const task = await this.server.fs.loadTask(params.id);
			if (!task) {
				return handleMcpError(new McpError(`Task with ID '${params.id}' not found`, "TASK_NOT_FOUND"));
			}

			// Update implementation plan
			task.implementationPlan = params.content;

			// Save the updated task
			await this.server.updateTask(task);

			return {
				content: [
					{
						type: "text",
						text: formatPlanOperationResult("plan_set", params.id, {
							contentLength: params.content.length,
						}),
					},
				],
			};
		} catch (error) {
			return handleMcpError(error);
		}
	}

	/**
	 * Append to implementation plan
	 */
	async appendPlan(params: PlanAppendParams): Promise<CallToolResult> {
		try {
			const separator = params.separator || "\n\n";

			// Validate separator
			const separatorErrors = validateSeparator(separator);
			if (separatorErrors.length > 0) {
				return handleMcpError(new McpError(separatorErrors.join(", "), "VALIDATION_ERROR"));
			}

			// Load the task
			const task = await this.server.fs.loadTask(params.id);
			if (!task) {
				return handleMcpError(new McpError(`Task with ID '${params.id}' not found`, "TASK_NOT_FOUND"));
			}

			// Append to existing plan
			const existingPlan = task.implementationPlan || "";
			const newContent = existingPlan ? `${existingPlan}${separator}${params.content}` : params.content;

			// Check total size doesn't exceed limit
			if (newContent.length > 50000) {
				return handleMcpError(
					new McpError(
						`Combined content exceeds maximum size limit of 50,000 characters (would be ${newContent.length} characters)`,
						"CONTENT_TOO_LARGE",
					),
				);
			}

			task.implementationPlan = newContent;

			// Save the updated task
			await this.server.updateTask(task);

			return {
				content: [
					{
						type: "text",
						text: formatPlanOperationResult("plan_append", params.id, {
							appendedLength: params.content.length,
							totalLength: newContent.length,
							separator: separator,
						}),
					},
				],
			};
		} catch (error) {
			return handleMcpError(error);
		}
	}

	/**
	 * Get implementation plan
	 */
	async getPlan(params: PlanGetParams): Promise<CallToolResult> {
		try {
			// Load the task
			const task = await this.server.fs.loadTask(params.id);
			if (!task) {
				return handleMcpError(new McpError(`Task with ID '${params.id}' not found`, "TASK_NOT_FOUND"));
			}

			const plan = task.implementationPlan || "";

			return {
				content: [
					{
						type: "text",
						text: formatPlanOperationResult("plan_get", params.id, {
							content: plan,
							contentLength: plan.length,
						}),
					},
				],
			};
		} catch (error) {
			return handleMcpError(error);
		}
	}

	/**
	 * Clear implementation plan
	 */
	async clearPlan(params: PlanClearParams): Promise<CallToolResult> {
		try {
			// Load the task
			const task = await this.server.fs.loadTask(params.id);
			if (!task) {
				return handleMcpError(new McpError(`Task with ID '${params.id}' not found`, "TASK_NOT_FOUND"));
			}

			// Clear implementation plan
			task.implementationPlan = "";

			// Save the updated task
			await this.server.updateTask(task);

			return {
				content: [
					{
						type: "text",
						text: formatPlanOperationResult("plan_clear", params.id, {}),
					},
				],
			};
		} catch (error) {
			return handleMcpError(error);
		}
	}
}
