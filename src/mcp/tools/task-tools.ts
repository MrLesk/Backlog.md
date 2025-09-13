import type { Task } from "../../types/index.ts";
import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";

/**
 * Task creation tool schema
 */
const taskCreateSchema = {
	type: "object",
	properties: {
		title: {
			type: "string",
			description: "The title of the task",
			minLength: 1,
		},
		description: {
			type: "string",
			description: "Optional description of the task",
		},
		labels: {
			type: "array",
			items: { type: "string" },
			description: "Optional array of labels for the task",
		},
		assignee: {
			type: "array",
			items: { type: "string" },
			description: "Optional array of assignees for the task",
		},
		priority: {
			type: "string",
			enum: ["high", "medium", "low"],
			description: "Optional priority level for the task",
		},
		parentTaskId: {
			type: "string",
			description: "Optional parent task ID to create this as a subtask",
		},
	},
	required: ["title"],
} as const;

/**
 * Task listing tool schema
 */
const taskListSchema = {
	type: "object",
	properties: {
		status: {
			type: "string",
			description: "Filter tasks by status",
		},
		assignee: {
			type: "string",
			description: "Filter tasks by assignee",
		},
		labels: {
			type: "array",
			items: { type: "string" },
			description: "Filter tasks by labels (tasks must have all specified labels)",
		},
		search: {
			type: "string",
			description: "Search term to filter tasks by title or description",
		},
		limit: {
			type: "number",
			description: "Maximum number of tasks to return (default: 50)",
			minimum: 1,
			maximum: 1000,
		},
	},
	required: [],
} as const;

/**
 * Task update tool schema
 */
const taskUpdateSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			description: "The ID of the task to update",
			minLength: 1,
		},
		title: {
			type: "string",
			description: "New title for the task",
		},
		status: {
			type: "string",
			description: "New status for the task",
		},
		description: {
			type: "string",
			description: "New description for the task",
		},
		labels: {
			type: "array",
			items: { type: "string" },
			description: "New labels array for the task",
		},
		assignee: {
			type: "array",
			items: { type: "string" },
			description: "New assignees array for the task",
		},
		priority: {
			type: "string",
			enum: ["high", "medium", "low"],
			description: "New priority level for the task",
		},
		implementationNotes: {
			type: "string",
			description: "Implementation notes for the task",
		},
	},
	required: ["id"],
} as const;

/**
 * Create task tool handler
 */
const taskCreateTool: McpToolHandler = {
	name: "task_create",
	description: "Create a new task in the backlog",
	inputSchema: taskCreateSchema,
	handler: async (args: Record<string, unknown>) => {
		const server = args._server as McpServer;
		if (!server) {
			throw new Error("Server instance not available");
		}

		const { title, description, labels = [], assignee = [], priority, parentTaskId } = args;

		try {
			// Generate task ID (simple implementation, real one uses more complex logic)
			const tasks = await server.fs.listTasks();
			const highestId = tasks.reduce((max, task) => {
				const numericId = Number.parseInt(task.id.replace("task-", ""), 10);
				return Number.isNaN(numericId) ? max : Math.max(max, numericId);
			}, 0);
			const newId = `task-${highestId + 1}`;

			const task: Task = {
				id: newId,
				title: title as string,
				status: "📋 Ready",
				assignee: assignee as string[],
				createdDate: new Date().toISOString(),
				labels: labels as string[],
				dependencies: [],
				body: description ? (description as string) : "",
				description: description as string,
				parentTaskId: parentTaskId as string,
				priority: priority as "high" | "medium" | "low",
			};

			const taskId = await server.createTask(task, false);

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
	},
};

/**
 * List tasks tool handler
 */
const taskListTool: McpToolHandler = {
	name: "task_list",
	description: "List tasks with optional filtering",
	inputSchema: taskListSchema,
	handler: async (args: Record<string, unknown>) => {
		const server = args._server as McpServer;
		if (!server) {
			throw new Error("Server instance not available");
		}

		const { status, assignee, labels, search, limit = 50 } = args;

		try {
			const tasks = await server.fs.listTasks();
			let filteredTasks = tasks;

			// Apply filters
			if (status) {
				filteredTasks = filteredTasks.filter((task) => task.status === status);
			}

			if (assignee) {
				filteredTasks = filteredTasks.filter((task) => task.assignee.includes(assignee as string));
			}

			if (labels && Array.isArray(labels)) {
				filteredTasks = filteredTasks.filter((task) =>
					(labels as string[]).every((label) => task.labels.includes(label)),
				);
			}

			if (search) {
				const searchTerm = (search as string).toLowerCase();
				filteredTasks = filteredTasks.filter(
					(task) =>
						task.title.toLowerCase().includes(searchTerm) || task.description?.toLowerCase().includes(searchTerm),
				);
			}

			// Apply limit
			filteredTasks = filteredTasks.slice(0, limit as number);

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
	},
};

/**
 * Update task tool handler
 */
const taskUpdateTool: McpToolHandler = {
	name: "task_update",
	description: "Update an existing task",
	inputSchema: taskUpdateSchema,
	handler: async (args: Record<string, unknown>) => {
		const server = args._server as McpServer;
		if (!server) {
			throw new Error("Server instance not available");
		}

		const { id, title, status, description, labels, assignee, priority, implementationNotes } = args;

		try {
			const tasks = await server.fs.listTasks();
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
			if (title) updatedTask.title = title as string;
			if (status) updatedTask.status = status as string;
			if (description !== undefined) updatedTask.description = description as string;
			if (labels) updatedTask.labels = labels as string[];
			if (assignee) updatedTask.assignee = assignee as string[];
			if (priority) updatedTask.priority = priority as "high" | "medium" | "low";
			if (implementationNotes !== undefined) updatedTask.implementationNotes = implementationNotes as string;

			await server.updateTask(updatedTask, false);

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
	},
};

/**
 * Register all task management tools with the MCP server
 * @param server The McpServer instance to register tools with
 */
export function registerTaskTools(server: McpServer): void {
	// Add server reference to tools for access to Core methods
	const createToolWithServer = (tool: McpToolHandler): McpToolHandler => ({
		...tool,
		handler: async (args: Record<string, unknown>) => {
			return tool.handler({ ...args, _server: server });
		},
	});

	server.addTool(createToolWithServer(taskCreateTool));
	server.addTool(createToolWithServer(taskListTool));
	server.addTool(createToolWithServer(taskUpdateTool));
}

// Export individual tools for testing
export { taskCreateTool, taskListTool, taskUpdateTool };
