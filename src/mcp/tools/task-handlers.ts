import { AcceptanceCriteriaManager } from "../../core/acceptance-criteria.ts";
import type { Task } from "../../types/index.ts";
import { formatTaskPlainText } from "../../ui/task-viewer.ts";
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
	 * Normalize dependencies to proper task-X format
	 */
	private normalizeDependencies(dependencies: string[]): string[] {
		if (!dependencies || dependencies.length === 0) return [];

		return dependencies
			.flatMap((dep) =>
				String(dep)
					.split(",")
					.map((d) => d.trim()),
			)
			.filter(Boolean)
			.map((dep) => (dep.startsWith("task-") ? dep : `task-${dep}`));
	}

	/**
	 * Validate that all dependencies exist (ported from CLI)
	 */
	private async validateDependencies(dependencies: string[]): Promise<{ valid: string[]; invalid: string[] }> {
		const valid: string[] = [];
		const invalid: string[] = [];

		if (dependencies.length === 0) {
			return { valid, invalid };
		}

		// Load both tasks and drafts to validate dependencies
		const [tasks, drafts] = await Promise.all([this.server.fs.listTasks(), this.server.fs.listDrafts()]);

		const allTaskIds = new Set([...tasks.map((t) => t.id), ...drafts.map((d) => d.id)]);

		for (const dep of dependencies) {
			if (allTaskIds.has(dep)) {
				valid.push(dep);
			} else {
				invalid.push(dep);
			}
		}

		return { valid, invalid };
	}

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
			// Generate task ID (simple implementation, real one uses more complex logic)
			const tasks = await this.server.fs.listTasks();
			const highestId = tasks.reduce((max, task) => {
				const numericId = Number.parseInt(task.id.replace("task-", ""), 10);
				return Number.isNaN(numericId) ? max : Math.max(max, numericId);
			}, 0);
			const newId = `task-${highestId + 1}`;

			// Normalize and validate dependencies
			const normalizedDependencies = this.normalizeDependencies(dependencies);
			const { valid, invalid } = await this.validateDependencies(normalizedDependencies);

			if (invalid.length > 0) {
				throw new McpError(`The following dependencies do not exist: ${invalid.join(", ")}`, "VALIDATION_ERROR");
			}

			// Convert acceptance criteria strings to structured format
			const acceptanceCriteriaItems = acceptanceCriteria.map((text, index) => ({
				index: index + 1,
				text,
				checked: false,
			}));

			const task: Task = {
				id: newId,
				title,
				status: status || "📋 Ready",
				assignee,
				createdDate: new Date().toISOString(),
				labels,
				dependencies: valid,
				body: description || "",
				description,
				parentTaskId,
				priority,
				acceptanceCriteriaItems,
			};

			const filepath = await this.server.createTask(task);

			// Extract task ID from filepath (e.g., "/path/to/task-1 - Title.md" -> "task-1")
			const taskId = task.id; // We already generated this above
			// Load the created task and return formatted output
			const createdTask = await this.server.fs.loadTask(taskId);
			// Use the filepath returned from createTask
			const content = await Bun.file(filepath).text();

			if (createdTask) {
				return {
					content: [
						{
							type: "text" as const,
							text: formatTaskPlainText(createdTask, content, filepath),
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully created task: ${filepath}`,
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

			// Validate dependencies if provided
			let validatedDependencies: string[] | undefined;
			if (dependencies !== undefined) {
				const normalizedDependencies = this.normalizeDependencies(dependencies);
				const { valid, invalid } = await this.validateDependencies(normalizedDependencies);

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
			const task = await this.server.fs.loadTask(id);

			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Create context for getTaskPath utility
			const tasksDir = this.server.fs.tasksDir;
			const context = { filesystem: { tasksDir } };
			const taskPath = await getTaskPath(id, context);

			if (!taskPath) {
				throw new McpError(`Task file not found: ${id}`, "TASK_NOT_FOUND");
			}

			const taskFile = Bun.file(taskPath);
			const content = await taskFile.text();

			// Use AcceptanceCriteriaManager to add criteria
			const updatedContent = AcceptanceCriteriaManager.addCriteria(content, criteria);

			// Write the updated content back to file
			await Bun.write(taskPath, updatedContent);

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully added ${criteria.length} acceptance criteria to task: ${id}`,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to add criteria: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Remove acceptance criteria by indices (supports batch operations)
	 */
	async removeCriteria(args: { id: string; indices: number[] }): Promise<CallToolResult> {
		const { id, indices } = args;

		try {
			const task = await this.server.fs.loadTask(id);

			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Create context for getTaskPath utility
			const tasksDir = this.server.fs.tasksDir;
			const context = { filesystem: { tasksDir } };
			const taskPath = await getTaskPath(id, context);

			if (!taskPath) {
				throw new McpError(`Task file not found: ${id}`, "TASK_NOT_FOUND");
			}

			const taskFile = Bun.file(taskPath);
			let content = await taskFile.text();

			// Remove criteria in descending order to maintain indices validity
			const sortedIndices = [...indices].sort((a, b) => b - a);
			const removedIndices: number[] = [];

			for (const index of sortedIndices) {
				try {
					content = AcceptanceCriteriaManager.removeCriterionByIndex(content, index);
					removedIndices.push(index);
				} catch (error) {
					// Continue with other indices even if one fails
					console.warn(
						`Failed to remove criteria #${index}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}

			if (removedIndices.length === 0) {
				throw new McpError(`No criteria were removed. Invalid indices: ${indices.join(", ")}`, "VALIDATION_ERROR");
			}

			// Write the updated content back to file
			await Bun.write(taskPath, content);

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully removed ${removedIndices.length} acceptance criteria from task: ${id}`,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to remove criteria: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Check/uncheck acceptance criteria by indices (supports batch operations)
	 */
	async checkCriteria(args: { id: string; indices: number[]; checked: boolean }): Promise<CallToolResult> {
		const { id, indices, checked } = args;

		try {
			const task = await this.server.fs.loadTask(id);

			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Create context for getTaskPath utility
			const tasksDir = this.server.fs.tasksDir;
			const context = { filesystem: { tasksDir } };
			const taskPath = await getTaskPath(id, context);

			if (!taskPath) {
				throw new McpError(`Task file not found: ${id}`, "TASK_NOT_FOUND");
			}

			const taskFile = Bun.file(taskPath);
			let content = await taskFile.text();

			// Check/uncheck criteria for each index
			const updatedIndices: number[] = [];

			for (const index of indices) {
				try {
					content = AcceptanceCriteriaManager.checkCriterionByIndex(content, index, checked);
					updatedIndices.push(index);
				} catch (error) {
					// Continue with other indices even if one fails
					console.warn(
						`Failed to ${checked ? "check" : "uncheck"} criteria #${index}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}

			if (updatedIndices.length === 0) {
				throw new McpError(`No criteria were updated. Invalid indices: ${indices.join(", ")}`, "VALIDATION_ERROR");
			}

			// Write the updated content back to file
			await Bun.write(taskPath, content);

			const action = checked ? "checked" : "unchecked";
			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully ${action} ${updatedIndices.length} acceptance criteria for task: ${id}`,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to check criteria: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * List all acceptance criteria with status
	 */
	async listCriteria(args: { id: string }): Promise<CallToolResult> {
		const { id } = args;

		try {
			const task = await this.server.fs.loadTask(id);

			if (!task) {
				throw new McpError(`Task not found: ${id}`, "TASK_NOT_FOUND");
			}

			// Create context for getTaskPath utility
			const tasksDir = this.server.fs.tasksDir;
			const context = { filesystem: { tasksDir } };
			const taskPath = await getTaskPath(id, context);

			if (!taskPath) {
				throw new McpError(`Task file not found: ${id}`, "TASK_NOT_FOUND");
			}

			const taskFile = Bun.file(taskPath);
			const content = await taskFile.text();

			// Parse acceptance criteria using AcceptanceCriteriaManager
			const criteria = AcceptanceCriteriaManager.parseAllCriteria(content);

			if (criteria.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Task ${id} has no acceptance criteria.`,
						},
					],
				};
			}

			// Format criteria list with status
			const criteriaList = criteria
				.map((criterion) => {
					const status = criterion.checked ? "✅" : "❌";
					return `${status} #${criterion.index} ${criterion.text}`;
				})
				.join("\n");

			const checkedCount = criteria.filter((c) => c.checked).length;
			const totalCount = criteria.length;

			return {
				content: [
					{
						type: "text" as const,
						text: `**Acceptance Criteria for ${id}** (${checkedCount}/${totalCount} completed):\n\n${criteriaList}`,
					},
				],
			};
		} catch (error) {
			// Re-throw McpError instances to preserve specific error types
			if (error instanceof McpError) {
				throw error;
			}
			throw new Error(`Failed to list criteria: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
