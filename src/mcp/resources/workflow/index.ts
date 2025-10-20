import {
	MCP_TASK_COMPLETION_GUIDE,
	MCP_TASK_CREATION_GUIDE,
	MCP_TASK_EXECUTION_GUIDE,
	MCP_WORKFLOW_OVERVIEW,
} from "../../../guidelines/mcp/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpResourceHandler } from "../../types.ts";

function createWorkflowOverviewResource(): McpResourceHandler {
	return {
		uri: "backlog://workflow/overview",
		name: "Backlog Workflow Overview",
		description: "Overview of when and how to use Backlog.md for task management",
		mimeType: "text/markdown",
		handler: async () => ({
			contents: [
				{
					uri: "backlog://workflow/overview",
					mimeType: "text/markdown",
					text: MCP_WORKFLOW_OVERVIEW,
				},
			],
		}),
	};
}

function createTaskCreationGuideResource(): McpResourceHandler {
	return {
		uri: "backlog://workflow/task-creation",
		name: "Task Creation Guide",
		description: "Detailed guide for creating tasks: scope assessment, acceptance criteria, parent/subtasks",
		mimeType: "text/markdown",
		handler: async () => ({
			contents: [
				{
					uri: "backlog://workflow/task-creation",
					mimeType: "text/markdown",
					text: MCP_TASK_CREATION_GUIDE,
				},
			],
		}),
	};
}

function createTaskExecutionGuideResource(): McpResourceHandler {
	return {
		uri: "backlog://workflow/task-execution",
		name: "Task Execution Guide",
		description: "Detailed guide for planning and executing tasks: workflow, discipline, scope changes",
		mimeType: "text/markdown",
		handler: async () => ({
			contents: [
				{
					uri: "backlog://workflow/task-execution",
					mimeType: "text/markdown",
					text: MCP_TASK_EXECUTION_GUIDE,
				},
			],
		}),
	};
}

function createTaskCompletionGuideResource(): McpResourceHandler {
	return {
		uri: "backlog://workflow/task-completion",
		name: "Task Completion Guide",
		description: "Detailed guide for completing tasks: Definition of Done, completion workflow, next steps",
		mimeType: "text/markdown",
		handler: async () => ({
			contents: [
				{
					uri: "backlog://workflow/task-completion",
					mimeType: "text/markdown",
					text: MCP_TASK_COMPLETION_GUIDE,
				},
			],
		}),
	};
}

export function registerWorkflowResources(server: McpServer): void {
	server.addResource(createWorkflowOverviewResource());
	server.addResource(createTaskCreationGuideResource());
	server.addResource(createTaskExecutionGuideResource());
	server.addResource(createTaskCompletionGuideResource());
}
