import type { BacklogConfig } from "../../../types/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { generateTaskCreateSchema, generateTaskEditSchema } from "../../utils/schema-generators.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { TaskCreateArgs, TaskEditRequest, TaskListArgs, TaskSearchArgs } from "./handlers.ts";
import { TaskHandlers } from "./handlers.ts";
import { taskArchiveSchema, taskCompleteSchema, taskListSchema, taskSearchSchema, taskViewSchema } from "./schemas.ts";

export function registerTaskTools(server: McpServer, config: BacklogConfig): void {
	const handlers = new TaskHandlers(server);

	const taskCreateSchema = generateTaskCreateSchema(config);
	const taskEditSchema = generateTaskEditSchema(config);

	const createTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_create",
			description: "Create a new task using Backlog.md",
			inputSchema: taskCreateSchema,
			annotations: { title: "Create Task", destructiveHint: false },
		},
		taskCreateSchema,
		async (input) => handlers.createTask(input as TaskCreateArgs),
	);

	const listTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_list",
			description: "List Backlog.md tasks from with optional filtering",
			inputSchema: taskListSchema,
			annotations: { title: "List Tasks", readOnlyHint: true, destructiveHint: false },
		},
		taskListSchema,
		async (input) => handlers.listTasks(input as TaskListArgs),
	);

	const searchTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_search",
			description: "Search Backlog.md tasks by title and description",
			inputSchema: taskSearchSchema,
			annotations: { title: "Search Tasks", readOnlyHint: true, destructiveHint: false },
		},
		taskSearchSchema,
		async (input) => handlers.searchTasks(input as TaskSearchArgs),
	);

	const editTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_edit",
			description:
				"Edit a Backlog.md task, including metadata, implementation plan/notes, dependencies, acceptance criteria, and task-specific Definition of Done items",
			inputSchema: taskEditSchema,
			annotations: { title: "Edit Task", destructiveHint: false },
		},
		taskEditSchema,
		async (input) => handlers.editTask(input as unknown as TaskEditRequest),
	);

	const viewTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_view",
			description: "View a Backlog.md task details",
			inputSchema: taskViewSchema,
			annotations: { title: "View Task", readOnlyHint: true, destructiveHint: false },
		},
		taskViewSchema,
		async (input) => handlers.viewTask(input as { id: string }),
	);

	const archiveTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_archive",
			description: "Archive a Backlog.md task",
			inputSchema: taskArchiveSchema,
			annotations: { title: "Archive Task", destructiveHint: true },
		},
		taskArchiveSchema,
		async (input) => handlers.archiveTask(input as { id: string }),
	);

	const completeTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_complete",
			description: "Complete a Backlog.md task (move it to the completed folder)",
			inputSchema: taskCompleteSchema,
			annotations: { title: "Complete Task", destructiveHint: true },
		},
		taskCompleteSchema,
		async (input) => handlers.completeTask(input as { id: string }),
	);

	server.addTool(createTaskTool);
	server.addTool(listTaskTool);
	server.addTool(searchTaskTool);
	server.addTool(editTaskTool);
	server.addTool(viewTaskTool);
	server.addTool(archiveTaskTool);
	server.addTool(completeTaskTool);
}

export type { TaskCreateArgs, TaskEditArgs, TaskListArgs, TaskSearchArgs } from "./handlers.ts";
export { taskArchiveSchema, taskCompleteSchema, taskListSchema, taskSearchSchema, taskViewSchema } from "./schemas.ts";
