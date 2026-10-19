import type { BacklogConfig } from "../../../types/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import {
	generateTaskCreateSchema,
	generateTaskEditSchema,
	generateTaskListSchema,
	generateTaskSearchSchema,
} from "../../utils/schema-generators.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { TaskCreateArgs, TaskEditRequest, TaskListArgs, TaskSearchArgs } from "./handlers.ts";
import { TaskHandlers } from "./handlers.ts";
import { taskArchiveSchema, taskDeleteSchema, taskRestoreSchema, taskViewSchema } from "./schemas.ts";

export function registerTaskTools(server: McpServer, config: BacklogConfig): void {
	const handlers = new TaskHandlers(server);

	const taskCreateSchema = generateTaskCreateSchema(config);
	const taskEditSchema = generateTaskEditSchema(config);
	const taskListSchema = generateTaskListSchema(config);
	const taskSearchSchema = generateTaskSearchSchema(config);

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
			description:
				"List Backlog.md tasks with optional filtering by status, type, project, assignee (or unassigned: true for tasks with no assignee), milestone, labels, and search",
			inputSchema: taskListSchema,
			annotations: { title: "List Tasks", readOnlyHint: true, destructiveHint: false },
		},
		taskListSchema,
		async (input) => handlers.listTasks(input as TaskListArgs),
	);

	const searchTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_search",
			description: "Search Backlog.md tasks by title, description, task type, project, and modified file path filters",
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
				"Edit a Backlog.md task, including metadata (status, priority, type, project), implementation plan/notes, dependencies, acceptance criteria, and task-specific Definition of Done items",
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
			description:
				"Move a task in any status off the board into the archive; keeps its ID, record, dependencies, and references",
			inputSchema: taskArchiveSchema,
			annotations: { title: "Archive Task", destructiveHint: true },
		},
		taskArchiveSchema,
		async (input) => handlers.archiveTask(input as { id: string }),
	);

	const deleteTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_delete",
			description:
				"Permanently delete an archived task and release its ID once no other branch or worktree still holds the task; removes the dependencies and references other tasks and drafts hold to it. The task must be archived first (task_archive) and must have no subtasks, as tasks or as drafts",
			inputSchema: taskDeleteSchema,
			annotations: { title: "Delete Task", destructiveHint: true },
		},
		taskDeleteSchema,
		async (input) => handlers.deleteTask(input as { id: string }),
	);

	const restoreTaskTool: McpToolHandler = createSimpleValidatedTool(
		{
			name: "task_restore",
			description:
				"Move an archived task back to the board with the same ID and the status it had; archived tasks are read-only until restored",
			inputSchema: taskRestoreSchema,
			annotations: { title: "Restore Task", destructiveHint: false },
		},
		taskRestoreSchema,
		async (input) => handlers.restoreTask(input as { id: string }),
	);

	server.addTool(createTaskTool);
	server.addTool(listTaskTool);
	server.addTool(searchTaskTool);
	server.addTool(editTaskTool);
	server.addTool(viewTaskTool);
	server.addTool(archiveTaskTool);
	server.addTool(deleteTaskTool);
	server.addTool(restoreTaskTool);
}

export type { TaskCreateArgs, TaskEditArgs, TaskListArgs, TaskSearchArgs } from "./handlers.ts";
export {
	taskArchiveSchema,
	taskListSchema,
	taskSearchSchema,
	taskViewSchema,
} from "./schemas.ts";
