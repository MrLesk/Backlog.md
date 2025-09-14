import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { TaskToolHandlers } from "./task-handlers.ts";

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
const createTaskCreateTool = (handlers: TaskToolHandlers): McpToolHandler => ({
	name: "task_create",
	description: "Create a new task in the backlog",
	inputSchema: taskCreateSchema,
	handler: async (args: Record<string, unknown>) => {
		const { title, description, labels = [], assignee = [], priority, parentTaskId } = args;
		return handlers.createTask({
			title: title as string,
			description: description as string,
			labels: labels as string[],
			assignee: assignee as string[],
			priority: priority as "high" | "medium" | "low",
			parentTaskId: parentTaskId as string,
		});
	},
});

/**
 * List tasks tool handler
 */
const createTaskListTool = (handlers: TaskToolHandlers): McpToolHandler => ({
	name: "task_list",
	description: "List tasks with optional filtering",
	inputSchema: taskListSchema,
	handler: async (args: Record<string, unknown>) => {
		const { status, assignee, labels, search, limit = 50 } = args;
		return handlers.listTasks({
			status: status as string,
			assignee: assignee as string,
			labels: labels as string[],
			search: search as string,
			limit: limit as number,
		});
	},
});

/**
 * Update task tool handler
 */
const createTaskUpdateTool = (handlers: TaskToolHandlers): McpToolHandler => ({
	name: "task_update",
	description: "Update an existing task",
	inputSchema: taskUpdateSchema,
	handler: async (args: Record<string, unknown>) => {
		const { id, title, status, description, labels, assignee, priority, implementationNotes } = args;
		return handlers.updateTask({
			id: id as string,
			title: title as string,
			status: status as string,
			description: description as string,
			labels: labels as string[],
			assignee: assignee as string[],
			priority: priority as "high" | "medium" | "low",
			implementationNotes: implementationNotes as string,
		});
	},
});

/**
 * Register all task management tools with the MCP server
 * @param server The McpServer instance to register tools with
 */
export function registerTaskTools(server: McpServer): void {
	const handlers = new TaskToolHandlers(server);

	server.addTool(createTaskCreateTool(handlers));
	server.addTool(createTaskListTool(handlers));
	server.addTool(createTaskUpdateTool(handlers));
}

// Export tool creators for testing
export { createTaskCreateTool, createTaskListTool, createTaskUpdateTool };
