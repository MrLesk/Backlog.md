import {
	MCP_TASK_CREATION_GUIDE,
	MCP_TASK_EXECUTION_GUIDE,
	MCP_TASK_FINALIZATION_GUIDE,
	MCP_WORKFLOW_OVERVIEW,
	MCP_WORKFLOW_OVERVIEW_TOOLS,
} from "../guidelines/mcp/index.ts";

export interface WorkflowGuideDefinition {
	key: "overview" | "task-creation" | "task-execution" | "task-finalization";
	uri: string;
	name: string;
	description: string;
	mimeType: string;
	resourceText: string;
	toolText?: string;
	toolName: string;
	toolDescription: string;
}

export const WORKFLOW_GUIDES: WorkflowGuideDefinition[] = [
	{
		key: "overview",
		uri: "backlog://workflow/overview",
		name: "Backlog Workflow Overview",
		description: "Overview of when and how to use Backlog.md for task management",
		mimeType: "text/markdown",
		resourceText: MCP_WORKFLOW_OVERVIEW,
		toolText: MCP_WORKFLOW_OVERVIEW_TOOLS,
		toolName: "get_workflow_overview",
		toolDescription: "Retrieve the Backlog.md workflow overview guidance in markdown format",
	},
	{
		key: "task-creation",
		uri: "backlog://workflow/task-creation",
		name: "Task Creation Guide",
		description: "Detailed guide for creating tasks: scope assessment, acceptance criteria, parent/subtasks",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_CREATION_GUIDE,
		toolName: "get_task_creation_guide",
		toolDescription: "Retrieve the Backlog.md task creation guide in markdown format",
	},
	{
		key: "task-execution",
		uri: "backlog://workflow/task-execution",
		name: "Task Execution Guide",
		description: "Detailed guide for planning and executing tasks: workflow, discipline, scope changes",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_EXECUTION_GUIDE,
		toolName: "get_task_execution_guide",
		toolDescription: "Retrieve the Backlog.md task execution guide in markdown format",
	},
	{
		key: "task-finalization",
		uri: "backlog://workflow/task-finalization",
		name: "Task Finalization Guide",
		description: "Detailed guide for finalizing tasks: Definition of Done, finalization workflow, next steps",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_FINALIZATION_GUIDE,
		toolName: "get_task_finalization_guide",
		toolDescription: "Retrieve the Backlog.md task finalization guide in markdown format",
	},
];

export function getWorkflowGuideByUri(uri: string): WorkflowGuideDefinition | undefined {
	return WORKFLOW_GUIDES.find((guide) => guide.uri === uri);
}
