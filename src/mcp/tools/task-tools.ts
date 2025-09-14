import { getValidStatuses } from "../../utils/status.ts";
import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import {
	createAsyncValidatedTool,
	createSimpleValidatedTool,
	type ValidationContext,
} from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { TaskToolHandlers } from "./task-handlers.ts";

/**
 * Task creation tool schema
 */
const taskCreateSchema: JsonSchema = {
	type: "object",
	properties: {
		title: {
			type: "string",
			minLength: 1,
			maxLength: 200,
		},
		description: {
			type: "string",
			maxLength: 10000,
		},
		labels: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
		assignee: {
			type: "array",
			items: { type: "string", maxLength: 100 },
		},
		priority: {
			type: "string",
			enum: ["high", "medium", "low"],
		},
		status: {
			type: "string",
			maxLength: 100,
		},
		parentTaskId: {
			type: "string",
			maxLength: 50,
		},
	},
	required: ["title"],
};

/**
 * Task listing tool schema
 */
const taskListSchema: JsonSchema = {
	type: "object",
	properties: {
		status: {
			type: "string",
			maxLength: 100,
		},
		assignee: {
			type: "string",
			maxLength: 100,
		},
		labels: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
		search: {
			type: "string",
			maxLength: 200,
		},
		limit: {
			type: "number",
			minimum: 1,
			maximum: 1000,
		},
	},
	required: [],
};

/**
 * Task update tool schema
 */
const taskUpdateSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		title: {
			type: "string",
			maxLength: 200,
		},
		status: {
			type: "string",
			maxLength: 100,
		},
		description: {
			type: "string",
			maxLength: 10000,
		},
		labels: {
			type: "array",
			items: { type: "string", maxLength: 50 },
		},
		assignee: {
			type: "array",
			items: { type: "string", maxLength: 100 },
		},
		priority: {
			type: "string",
			enum: ["high", "medium", "low"],
		},
		implementationNotes: {
			type: "string",
			maxLength: 10000,
		},
	},
	required: ["id"],
};

/**
 * Status validator for task creation and updates
 */
async function validateTaskStatus(input: Record<string, unknown>, context?: ValidationContext): Promise<string[]> {
	const errors: string[] = [];

	if (input.status && context?.core) {
		const validStatuses = await getValidStatuses(context.core);
		const status = input.status as string;

		if (!validStatuses.includes(status)) {
			errors.push(`Status '${status}' is not valid. Valid statuses: ${validStatuses.join(", ")}`);
		}
	}

	return errors;
}

/**
 * Create task tool handler
 */
const createTaskCreateTool = (handlers: TaskToolHandlers, server: McpServer): McpToolHandler =>
	createAsyncValidatedTool(
		{
			name: "task_create",
			description: "Create a new task in the backlog",
			inputSchema: taskCreateSchema,
		},
		taskCreateSchema,
		async (input, context) => {
			const newContext = { ...context, core: server, timestamp: context?.timestamp || Date.now() };
			return validateTaskStatus(input, newContext);
		},
		async (input, _context) => {
			return handlers.createTask({
				title: input.title as string,
				description: input.description as string,
				labels: (input.labels as string[]) || [],
				assignee: (input.assignee as string[]) || [],
				priority: input.priority as "high" | "medium" | "low",
				status: input.status as string,
				parentTaskId: input.parentTaskId as string,
			});
		},
	);

/**
 * List tasks tool handler
 */
const createTaskListTool = (handlers: TaskToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "task_list",
			description: "List tasks with optional filtering",
			inputSchema: taskListSchema,
		},
		taskListSchema,
		async (input, _context) => {
			return handlers.listTasks({
				status: input.status as string,
				assignee: input.assignee as string,
				labels: input.labels as string[],
				search: input.search as string,
				limit: (input.limit as number) || 50,
			});
		},
	);

/**
 * Update task tool handler
 */
const createTaskUpdateTool = (handlers: TaskToolHandlers, server: McpServer): McpToolHandler =>
	createAsyncValidatedTool(
		{
			name: "task_update",
			description: "Update an existing task",
			inputSchema: taskUpdateSchema,
		},
		taskUpdateSchema,
		async (input, context) => {
			const newContext = { ...context, core: server, timestamp: context?.timestamp || Date.now() };
			return validateTaskStatus(input, newContext);
		},
		async (input, _context) => {
			return handlers.updateTask({
				id: input.id as string,
				title: input.title as string,
				status: input.status as string,
				description: input.description as string,
				labels: input.labels as string[],
				assignee: input.assignee as string[],
				priority: input.priority as "high" | "medium" | "low",
				implementationNotes: input.implementationNotes as string,
			});
		},
	);

/**
 * Register all task management tools with the MCP server
 * @param server The McpServer instance to register tools with
 */
export function registerTaskTools(server: McpServer): void {
	const handlers = new TaskToolHandlers(server);

	server.addTool(createTaskCreateTool(handlers, server));
	server.addTool(createTaskListTool(handlers));
	server.addTool(createTaskUpdateTool(handlers, server));
}

// Export tool creators and schemas for testing
export {
	createTaskCreateTool,
	createTaskListTool,
	createTaskUpdateTool,
	taskCreateSchema,
	taskListSchema,
	taskUpdateSchema,
};
