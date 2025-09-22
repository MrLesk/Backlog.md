import { handleMcpError, handleMcpSuccess, McpError } from "../errors/mcp-errors.ts";
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
			await this.server.updateTask(task, false);

			return handleMcpSuccess({
				operation: "notes_set",
				taskId: params.id,
				contentLength: params.content.length,
				message: "Implementation notes updated successfully",
			});
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
			await this.server.updateTask(task, false);

			return handleMcpSuccess({
				operation: "notes_append",
				taskId: params.id,
				appendedLength: params.content.length,
				totalLength: newContent.length,
				separator: separator,
				message: "Content appended to implementation notes successfully",
			});
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

			return handleMcpSuccess({
				operation: "notes_get",
				taskId: params.id,
				content: notes,
				contentLength: notes.length,
			});
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
			await this.server.updateTask(task, false);

			return handleMcpSuccess({
				operation: "notes_clear",
				taskId: params.id,
				message: "Implementation notes cleared successfully",
			});
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
			await this.server.updateTask(task, false);

			return handleMcpSuccess({
				operation: "plan_set",
				taskId: params.id,
				contentLength: params.content.length,
				message: "Implementation plan updated successfully",
			});
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
			await this.server.updateTask(task, false);

			return handleMcpSuccess({
				operation: "plan_append",
				taskId: params.id,
				appendedLength: params.content.length,
				totalLength: newContent.length,
				separator: separator,
				message: "Content appended to implementation plan successfully",
			});
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

			return handleMcpSuccess({
				operation: "plan_get",
				taskId: params.id,
				content: plan,
				contentLength: plan.length,
			});
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
			await this.server.updateTask(task, false);

			return handleMcpSuccess({
				operation: "plan_clear",
				taskId: params.id,
				message: "Implementation plan cleared successfully",
			});
		} catch (error) {
			return handleMcpError(error);
		}
	}
}
