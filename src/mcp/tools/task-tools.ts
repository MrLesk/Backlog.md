import type { BacklogConfig } from "../../types/index.ts";
import { getCanonicalStatus, getValidStatuses } from "../../utils/status.ts";
import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { generateTaskCreateSchema, generateTaskUpdateSchema } from "../utils/schema-generators.ts";
import {
	createAsyncValidatedTool,
	createSimpleValidatedTool,
	type ValidationContext,
} from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { TaskToolHandlers } from "./task-handlers.ts";

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
 * Task view tool schema
 */
const taskViewSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
	},
	required: ["id"],
};

/**
 * Task archive tool schema
 */
const taskArchiveSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
	},
	required: ["id"],
};

/**
 * Task demote tool schema
 */
const taskDemoteSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
	},
	required: ["id"],
};

/**
 * Criteria add tool schema
 */
const criteriaAddSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		criteria: {
			type: "array",
			items: { type: "string", minLength: 1, maxLength: 500 },
		},
	},
	required: ["id", "criteria"],
};

/**
 * Criteria remove tool schema
 */
const criteriaRemoveSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		indices: {
			type: "array",
			items: { type: "number", minimum: 1 },
		},
	},
	required: ["id", "indices"],
};

/**
 * Criteria check tool schema
 */
const criteriaCheckSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
		},
		indices: {
			type: "array",
			items: { type: "number", minimum: 1 },
		},
		checked: {
			type: "boolean",
		},
	},
	required: ["id", "indices", "checked"],
};

/**
 * Criteria list tool schema
 */
const criteriaListSchema: JsonSchema = {
	type: "object",
	properties: {
		id: {
			type: "string",
			minLength: 1,
			maxLength: 50,
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
		const inputStatus = input.status as string;
		const canonicalStatus = await getCanonicalStatus(inputStatus, context.core);

		if (!canonicalStatus) {
			// Status not found even with case-insensitive matching
			const validStatuses = await getValidStatuses(context.core);
			errors.push(
				`Status '${inputStatus}' is not valid. Valid statuses: ${validStatuses.join(", ")} ` +
					"(case-insensitive matching supported)",
			);
		} else {
			// Normalize to canonical casing from config
			input.status = canonicalStatus;
		}
	}

	return errors;
}

/**
 * Create task tool handler
 */
const createTaskCreateTool = (handlers: TaskToolHandlers, server: McpServer, schema: JsonSchema): McpToolHandler =>
	createAsyncValidatedTool(
		{
			name: "task_create",
			description: `Create a new task in the backlog.

Status values are case-insensitive but project-specific. Use config_get({"key": "statuses"}) to discover valid values, or check the tool schema's status enum.

Common defaults: "To Do", "In Progress", "Done"`,
			inputSchema: schema,
		},
		schema,
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
				acceptanceCriteria: (input.acceptanceCriteria as string[]) || [],
				dependencies: (input.dependencies as string[]) || [],
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
 * View task tool handler
 */
const createTaskViewTool = (handlers: TaskToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "task_view",
			description: "Get complete task details including all metadata and relationships",
			inputSchema: taskViewSchema,
		},
		taskViewSchema,
		async (input, _context) => {
			return handlers.viewTask({
				id: input.id as string,
			});
		},
	);

/**
 * Archive task tool handler
 */
const createTaskArchiveTool = (handlers: TaskToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "task_archive",
			description: "Archive a completed task by moving it to the archive folder",
			inputSchema: taskArchiveSchema,
		},
		taskArchiveSchema,
		async (input, _context) => {
			return handlers.archiveTask({
				id: input.id as string,
			});
		},
	);

/**
 * Demote task tool handler
 */
const createTaskDemoteTool = (handlers: TaskToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "task_demote",
			description: "Convert a task back to draft status",
			inputSchema: taskDemoteSchema,
		},
		taskDemoteSchema,
		async (input, _context) => {
			return handlers.demoteTask({
				id: input.id as string,
			});
		},
	);

/**
 * Update task tool handler
 */
const createTaskUpdateTool = (handlers: TaskToolHandlers, server: McpServer, schema: JsonSchema): McpToolHandler =>
	createAsyncValidatedTool(
		{
			name: "task_update",
			description: `Update an existing task.

Status values are case-insensitive. Check the tool schema or use config_get({"key": "statuses"}) to see valid values.`,
			inputSchema: schema,
		},
		schema,
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
 * Criteria add tool handler
 */
const createCriteriaAddTool = (handlers: TaskToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "criteria_add",
			description: "Add new acceptance criteria to tasks",
			inputSchema: criteriaAddSchema,
		},
		criteriaAddSchema,
		async (input, _context) => {
			return handlers.addCriteria({
				id: input.id as string,
				criteria: input.criteria as string[],
			});
		},
	);

/**
 * Criteria remove tool handler
 */
const createCriteriaRemoveTool = (handlers: TaskToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "criteria_remove",
			description: "Remove AC by index (1-based)",
			inputSchema: criteriaRemoveSchema,
		},
		criteriaRemoveSchema,
		async (input, _context) => {
			return handlers.removeCriteria({
				id: input.id as string,
				indices: input.indices as number[],
			});
		},
	);

/**
 * Criteria check tool handler
 */
const createCriteriaCheckTool = (handlers: TaskToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "criteria_check",
			description: "Check/uncheck AC items to track completion",
			inputSchema: criteriaCheckSchema,
		},
		criteriaCheckSchema,
		async (input, _context) => {
			return handlers.checkCriteria({
				id: input.id as string,
				indices: input.indices as number[],
				checked: input.checked as boolean,
			});
		},
	);

/**
 * Criteria list tool handler
 */
const createCriteriaListTool = (handlers: TaskToolHandlers): McpToolHandler =>
	createSimpleValidatedTool(
		{
			name: "criteria_list",
			description: "List operation returns all AC with status",
			inputSchema: criteriaListSchema,
		},
		criteriaListSchema,
		async (input, _context) => {
			return handlers.listCriteria({
				id: input.id as string,
			});
		},
	);

/**
 * Register all task management tools with the MCP server
 * @param server The McpServer instance to register tools with
 * @param config The backlog configuration for dynamic schema generation
 */
export function registerTaskTools(server: McpServer, config: BacklogConfig): void {
	// Generate dynamic schemas based on config
	const taskCreateSchema = generateTaskCreateSchema(config);
	const taskUpdateSchema = generateTaskUpdateSchema(config);

	const handlers = new TaskToolHandlers(server);

	// Create tools with dynamic schemas
	server.addTool(createTaskCreateTool(handlers, server, taskCreateSchema));
	server.addTool(createTaskListTool(handlers));
	server.addTool(createTaskUpdateTool(handlers, server, taskUpdateSchema));
	server.addTool(createTaskViewTool(handlers));
	server.addTool(createTaskArchiveTool(handlers));
	server.addTool(createTaskDemoteTool(handlers));
	server.addTool(createCriteriaAddTool(handlers));
	server.addTool(createCriteriaRemoveTool(handlers));
	server.addTool(createCriteriaCheckTool(handlers));
	server.addTool(createCriteriaListTool(handlers));
}

// Export tool creators and schemas for testing
export {
	createTaskCreateTool,
	createTaskListTool,
	createTaskUpdateTool,
	createTaskViewTool,
	createTaskArchiveTool,
	createTaskDemoteTool,
	createCriteriaAddTool,
	createCriteriaRemoveTool,
	createCriteriaCheckTool,
	createCriteriaListTool,
	taskListSchema,
	taskViewSchema,
	taskArchiveSchema,
	taskDemoteSchema,
	criteriaAddSchema,
	criteriaRemoveSchema,
	criteriaCheckSchema,
	criteriaListSchema,
};
