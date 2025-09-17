import type { Task } from "../../types/index.ts";
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
			// Generate task ID (simple implementation, real one uses more complex logic)
			const tasks = await this.server.fs.listTasks();
			const highestId = tasks.reduce((max, task) => {
				const numericId = Number.parseInt(task.id.replace("task-", ""), 10);
				return Number.isNaN(numericId) ? max : Math.max(max, numericId);
			}, 0);
			const newId = `task-${highestId + 1}`;

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
				dependencies,
				body: description || "",
				description,
				parentTaskId,
				priority,
				acceptanceCriteriaItems,
			};

			const taskId = await this.server.createTask(task, false);

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully created task: ${taskId}`,
					},
				],
			};
		} catch (error) {
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

			const tasksText = filteredTasks
				.map(
					(task) => `**${task.id}**: ${task.title}
- Status: ${task.status}
- Assignee: ${task.assignee.join(", ") || "Unassigned"}
- Labels: ${task.labels.join(", ") || "None"}
- Created: ${task.createdDate}${task.description ? `\n- Description: ${task.description}` : ""}`,
				)
				.join("\n\n");

			return {
				content: [
					{
						type: "text" as const,
						text: `Found ${filteredTasks.length} task(s):\n\n${tasksText || "No tasks found."}`,
					},
				],
			};
		} catch (error) {
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
				throw new Error(`Task not found: ${id}`);
			}

			// Format task details with all metadata and relationships
			const taskDetails = [];
			taskDetails.push(`**${task.id}**: ${task.title}`);
			taskDetails.push(`- Status: ${task.status}`);
			taskDetails.push(`- Assignee: ${task.assignee?.join(", ") || "Unassigned"}`);
			taskDetails.push(`- Priority: ${task.priority || "Not set"}`);
			taskDetails.push(`- Labels: ${task.labels?.join(", ") || "None"}`);
			taskDetails.push(`- Created: ${task.createdDate}`);

			if (task.updatedDate) {
				taskDetails.push(`- Updated: ${task.updatedDate}`);
			}

			if (task.parentTaskId) {
				taskDetails.push(`- Parent Task: ${task.parentTaskId}`);
			}

			if (task.dependencies && task.dependencies.length > 0) {
				taskDetails.push(`- Dependencies: ${task.dependencies.join(", ")}`);
			}

			if (task.description) {
				taskDetails.push(`\n**Description:**\n${task.description}`);
			}

			if (task.acceptanceCriteriaItems && task.acceptanceCriteriaItems.length > 0) {
				taskDetails.push("\n**Acceptance Criteria:**");
				for (const criteria of task.acceptanceCriteriaItems) {
					const checkMark = criteria.checked ? "✅" : "❌";
					taskDetails.push(`${checkMark} #${criteria.index} ${criteria.text}`);
				}
			}

			if (task.implementationPlan) {
				taskDetails.push(`\n**Implementation Plan:**\n${task.implementationPlan}`);
			}

			if (task.implementationNotes) {
				taskDetails.push(`\n**Implementation Notes:**\n${task.implementationNotes}`);
			}

			return {
				content: [
					{
						type: "text" as const,
						text: taskDetails.join("\n"),
					},
				],
			};
		} catch (error) {
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
				throw new Error(`Task not found: ${id}`);
			}

			// Validate task is completed
			if (task.status !== "Done") {
				throw new Error(`Cannot archive task '${id}': task status must be 'Done' but is '${task.status}'`);
			}

			// Archive the task
			const success = await this.server.archiveTask(id, false);

			if (!success) {
				throw new Error(`Failed to archive task: ${id}`);
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully archived task: ${id}`,
					},
				],
			};
		} catch (error) {
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
				throw new Error(`Task not found: ${id}`);
			}

			// Demote the task
			const success = await this.server.demoteTask(id, false);

			if (!success) {
				throw new Error(`Failed to demote task: ${id}`);
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully demoted task: ${id}`,
					},
				],
			};
		} catch (error) {
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
	}): Promise<CallToolResult> {
		const { id, title, status, description, labels, assignee, priority, implementationNotes } = args;

		try {
			const tasks = await this.server.fs.listTasks();
			const existingTask = tasks.find((task) => task.id === id);

			if (!existingTask) {
				throw new Error(`Task not found: ${id}`);
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

			await this.server.updateTask(updatedTask, false);

			return {
				content: [
					{
						type: "text" as const,
						text: `Successfully updated task: ${id}`,
					},
				],
			};
		} catch (error) {
			throw new Error(`Failed to update task: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
}
