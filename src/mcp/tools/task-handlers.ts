import type { Task } from "../../types/index.ts";
import { formatTaskPlainText } from "../../ui/task-viewer-with-search.ts";
import { normalizeDependencies, validateDependencies } from "../../utils/task-builders.ts";
import { getTaskPath } from "../../utils/task-path.ts";
import { McpError } from "../errors/mcp-errors.ts";
import type { McpServer } from "../server.ts";
import type { CallToolResult } from "../types.ts";

/**
 * TaskToolHandlers class containing all task management business logic
 */
export class TaskToolHandlers {
	constructor(private server: McpServer) {}

	/**
	 * Create a new task
	 */
	async createTask(args: {
		title: string;
		description?: string;
		labels?: string[];
		assignee?: string[];
		priority?: "high" | "medium" | "low";
		status?: string;
		parentTaskId?: string;
		acceptanceCriteria?: string[];
		dependencies?: string[];
	}): Promise<CallToolResult> {
		const {
			title,
			description,
			labels = [],
			assignee = [],
			priority,
			status,
			parentTaskId,
			acceptanceCriteria = [],
			dependencies = [],
		} = args;

		try {
			// Normalize and validate dependencies using shared utilities (same as CLI)
			const normalizedDependencies = normalizeDependencies(dependencies);
			const { valid, invalid } = await validateDependencies(normalizedDependencies, this.server);

			if (invalid.length > 0) {
				throw new McpError(`The following dependencies do not exist: ${invalid.join(", ")}`, "VALIDATION_ERROR");
			}

			// Use shared task building utilities (same pattern as CLI)
			const mcpOptions = {
				title,
				description,
				labels,
				assignee,
				priority,
				status: status || "📋 Ready",
				parentTaskId,
				acceptanceCriteria,
				dependencies: valid,
			};

			// Use Core API to create task with proper ID generation and cross-branch checking
			const createdTask = await this.server.createTaskFromData({
				...mcpOptions,
				acceptanceCriteriaItems: acceptanceCriteria.map((text, index) => ({
					index: index + 1,
					text,
					checked: false,
				})),
			});

			const taskPath = await getTaskPath(createdTask.id, { filesystem: { tasksDir: this.server.fs.tasksDir } });
			const content = taskPath ? await Bun.file(taskPath).text() : "";

			return {
				content: [
					{
						type: "text" as const,
						text: formatTaskPlainText(createdTask, content, taskPath || undefined),
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * List tasks with optional filtering
	 */
	async listTasks(
		args: { status?: string; assignee?: string; labels?: string[]; search?: string; limit?: number } = {},
	): Promise<CallToolResult> {
		const { status, assignee, labels, search, limit = 50 } = args;

		try {
			const tasks = await this.server.fs.listTasks();
			let filteredTasks = tasks;

			// Apply filters
			if (status) {
				filteredTasks = filteredTasks.filter((task) => task.status === status);
			}

			if (assignee) {
				filteredTasks = filteredTasks.filter((task) => task.assignee.includes(assignee));
			}

			if (labels && Array.isArray(labels)) {
				filteredTasks = filteredTasks.filter((task) => labels.every((label) => task.labels.includes(label)));
			}

			if (search) {
				const searchTerm = search.toLowerCase();
				filteredTasks = filteredTasks.filter(
					(task) =>
						task.title.toLowerCase().includes(searchTerm) || task.description?.toLowerCase().includes(searchTerm),
				);
			}

			// Apply limit
			filteredTasks = filteredTasks.slice(0, limit);

			if (filteredTasks.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: "No tasks found.",
						},
					],
				};
			}

			// Use formatTaskPlainText for consistent CLI --plain formatting
			const tasksOutput = [];
			for (const task of filteredTasks) {
				const taskPath = await getTaskPath(task.id, { filesystem: { tasksDir: this.server.fs.tasksDir } });
				const content = taskPath ? await Bun.file(taskPath).text() : "";
				tasksOutput.push(formatTaskPlainText(task, content, taskPath || undefined));
			}

			return {
				content: [
					{
						type: "text" as const,
						text: tasksOutput.join(`\n\n${"=".repeat(80)}\n\n`),
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to list tasks: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * View a task with complete details
	 */
	async viewTask(args: { id: string }): Promise<CallToolResult> {
		const { id } = args;

		try {
			const task = await this.server.fs.loadTask(id);

			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Get task file path and content for formatting
			const taskPath = await getTaskPath(id, { filesystem: { tasksDir: this.server.fs.tasksDir } });
			const content = taskPath ? await Bun.file(taskPath).text() : "";

			return {
				content: [
					{
						type: "text" as const,
						text: formatTaskPlainText(task, content, taskPath || undefined),
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to view task: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Archive a completed task
	 */
	async archiveTask(args: { id: string }): Promise<CallToolResult> {
		const { id } = args;

		try {
			// First check if task exists and validate status
			const task = await this.server.fs.loadTask(id);

			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Validate task is completed
			if (task.status !== "Done") {
				throw new McpError(
					`Cannot archive task '${id}': task status must be 'Done' but is '${task.status}'`,
					"VALIDATION_ERROR",
				);
			}

			// Archive the task
			const success = await this.server.archiveTask(id);

			if (!success) {
				throw new McpError(`Failed to archive task: ${id}`, "OPERATION_FAILED");
			}

			// Return formatted result with task details
			const taskPath = await getTaskPath(id, { filesystem: { tasksDir: this.server.fs.tasksDir } });
			const content = taskPath ? await Bun.file(taskPath).text() : "";

			return {
				content: [
					{
						type: "text" as const,
						text: formatTaskPlainText(task, content, taskPath || undefined),
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to archive task: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Demote a task back to draft status
	 */
	async demoteTask(args: { id: string }): Promise<CallToolResult> {
		const { id } = args;

		try {
			// Check if task exists
			const task = await this.server.fs.loadTask(id);

			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Demote the task
			const success = await this.server.demoteTask(id, false);

			if (!success) {
				throw new McpError(`Failed to demote task: ${id}`, "OPERATION_FAILED");
			}

			// Return formatted result with task details
			const taskPath = await getTaskPath(id, { filesystem: { tasksDir: this.server.fs.tasksDir } });
			const content = taskPath ? await Bun.file(taskPath).text() : "";

			return {
				content: [
					{
						type: "text" as const,
						text: formatTaskPlainText(task, content, taskPath || undefined),
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to demote task: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Update an existing task
	 */
	async updateTask(args: {
		id: string;
		title?: string;
		status?: string;
		description?: string;
		labels?: string[];
		assignee?: string[];
		priority?: "high" | "medium" | "low";
		implementationNotes?: string;
		dependencies?: string[];
	}): Promise<CallToolResult> {
		const { id, title, status, description, labels, assignee, priority, implementationNotes, dependencies } = args;

		try {
			const tasks = await this.server.fs.listTasks();
			const existingTask = tasks.find((task) => task.id === id);

			if (!existingTask) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Validate dependencies if provided using shared utilities
			let validatedDependencies: string[] | undefined;
			if (dependencies !== undefined) {
				const normalizedDependencies = normalizeDependencies(dependencies);
				const { valid, invalid } = await validateDependencies(normalizedDependencies, this.server);

				if (invalid.length > 0) {
					throw new McpError(`The following dependencies do not exist: ${invalid.join(", ")}`, "VALIDATION_ERROR");
				}

				validatedDependencies = valid;
			}

			// Create updated task
			const updatedTask: Task = {
				...existingTask,
				updatedDate: new Date().toISOString(),
			};

			// Apply updates conditionally
			if (title) updatedTask.title = title;
			if (status) updatedTask.status = status;
			if (description !== undefined) updatedTask.description = description;
			if (labels) updatedTask.labels = labels;
			if (assignee) updatedTask.assignee = assignee;
			if (priority) updatedTask.priority = priority;
			if (implementationNotes !== undefined) updatedTask.implementationNotes = implementationNotes;
			if (validatedDependencies !== undefined) updatedTask.dependencies = validatedDependencies;

			await this.server.updateTask(updatedTask);

			// Load updated task and return formatted output
			const refreshedTask = await this.server.fs.loadTask(id);
			const taskPath = await getTaskPath(id, { filesystem: { tasksDir: this.server.fs.tasksDir } });
			const content = taskPath ? await Bun.file(taskPath).text() : "";

			if (refreshedTask) {
				return {
					content: [
						{
							type: "text" as const,
							text: formatTaskPlainText(refreshedTask, content, taskPath || undefined),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully updated task: ${id}`,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to update task: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Add acceptance criteria to a task
	 */
	async addCriteria(args: { id: string; criteria: string[] }): Promise<CallToolResult> {
		const { id, criteria } = args;

		try {
			// Use Core API instead of direct filesystem access
			await this.server.addAcceptanceCriteria(id, criteria);

			// Get updated criteria for display
			const allCriteria = await this.server.listAcceptanceCriteria(id);
			const criteriaMarkdown = allCriteria
				.map((criterion) => {
					const checkbox = criterion.checked ? "[x]" : "[ ]";
					return `- ${checkbox} #${criterion.index} ${criterion.text}`;
				})
				.join("\n");

			const successMessage = `✅ **Successfully added ${criteria.length} acceptance criteria to task ${id}**\n\n**Current Acceptance Criteria:**\n${criteriaMarkdown}`;

			return {
				content: [
					{
						type: "text" as const,
						text: successMessage,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			// Convert Core errors to MCP errors with appropriate types
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("Task not found")) {
				throw new McpError(errorMessage, "TASK_NOT_FOUND");
			}
			throw new Error(`Failed to add criteria: ${errorMessage}`);
		}
	}

	/**
	 * Remove acceptance criteria by indices (supports batch operations)
	 */
	async removeCriteria(args: { id: string; indices: number[] }): Promise<CallToolResult> {
		const { id, indices } = args;

		try {
			// Use Core API instead of direct filesystem access
			const removedIndices = await this.server.removeAcceptanceCriteria(id, indices);

			// Get updated criteria for display
			const allCriteria = await this.server.listAcceptanceCriteria(id);
			let criteriaMarkdown = "*No acceptance criteria remaining*";
			if (allCriteria.length > 0) {
				criteriaMarkdown = allCriteria
					.map((criterion) => {
						const checkbox = criterion.checked ? "[x]" : "[ ]";
						return `- ${checkbox} #${criterion.index} ${criterion.text}`;
					})
					.join("\n");
			}

			const successMessage = `🗑️ **Successfully removed ${removedIndices.length} acceptance criteria from task ${id}**\n\n**Current Acceptance Criteria:**\n${criteriaMarkdown}`;

			return {
				content: [
					{
						type: "text" as const,
						text: successMessage,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			// Convert Core errors to MCP errors with appropriate types
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("Task not found")) {
				throw new McpError(errorMessage, "TASK_NOT_FOUND");
			}
			if (errorMessage.includes("No criteria were removed")) {
				throw new McpError(errorMessage, "VALIDATION_ERROR");
			}
			throw new Error(`Failed to remove criteria: ${errorMessage}`);
		}
	}

	/**
	 * Check/uncheck acceptance criteria by indices (supports batch operations)
	 */
	async checkCriteria(args: { id: string; indices: number[]; checked: boolean }): Promise<CallToolResult> {
		const { id, indices, checked } = args;

		try {
			// Use Core API instead of direct filesystem access
			const updatedIndices = await this.server.checkAcceptanceCriteria(id, indices, checked);

			// Get updated criteria for display
			const allCriteria = await this.server.listAcceptanceCriteria(id);
			const criteriaMarkdown = allCriteria
				.map((criterion) => {
					const checkbox = criterion.checked ? "[x]" : "[ ]";
					const highlight = updatedIndices.includes(criterion.index) ? "**" : "";
					return `- ${checkbox} #${criterion.index} ${highlight}${criterion.text}${highlight}`;
				})
				.join("\n");

			const action = checked ? "checked" : "unchecked";
			const emoji = checked ? "✅" : "⬜";
			const successMessage = `${emoji} **Successfully ${action} ${updatedIndices.length} acceptance criteria for task ${id}**\n\n**Current Acceptance Criteria:**\n${criteriaMarkdown}`;

			return {
				content: [
					{
						type: "text" as const,
						text: successMessage,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			// Convert Core errors to MCP errors with appropriate types
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("Task not found")) {
				throw new McpError(errorMessage, "TASK_NOT_FOUND");
			}
			if (errorMessage.includes("No criteria were updated")) {
				throw new McpError(errorMessage, "VALIDATION_ERROR");
			}
			throw new Error(`Failed to check criteria: ${errorMessage}`);
		}
	}

	/**
	 * List all acceptance criteria with status
	 */
	async listCriteria(args: { id: string }): Promise<CallToolResult> {
		const { id } = args;

		try {
			// Use Core API instead of direct filesystem access
			const criteria = await this.server.listAcceptanceCriteria(id);

			if (criteria.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `📋 **Task ${id}** has no acceptance criteria.`,
						},
					],
				};
			}

			// Format criteria list with checkboxes (GitHub-style markdown)
			const criteriaMarkdown = criteria
				.map((criterion) => {
					const checkbox = criterion.checked ? "[x]" : "[ ]";
					return `- ${checkbox} #${criterion.index} ${criterion.text}`;
				})
				.join("\n");

			const checkedCount = criteria.filter((c) => c.checked).length;
			const totalCount = criteria.length;
			const progressEmoji = checkedCount === totalCount ? "🎉" : "📋";

			return {
				content: [
					{
						type: "text" as const,
						text: `${progressEmoji} **Acceptance Criteria for ${id}** (${checkedCount}/${totalCount} completed)\n\n${criteriaMarkdown}`,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			// Convert Core errors to MCP errors with appropriate types
			const errorMessage = error instanceof Error ? error.message : String(error);
			if (errorMessage.includes("Task not found")) {
				throw new McpError(errorMessage, "TASK_NOT_FOUND");
			}
			throw new Error(`Failed to list criteria: ${errorMessage}`);
		}
	}
}
