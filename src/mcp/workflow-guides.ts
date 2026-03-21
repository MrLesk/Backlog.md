import {
	MCP_TASK_CREATION_GUIDE,
	MCP_TASK_EXECUTION_GUIDE,
	MCP_TASK_FINALIZATION_GUIDE,
	MCP_WORKFLOW_OVERVIEW,
	MCP_WORKFLOW_OVERVIEW_TOOLS,
} from "../guidelines/mcp/index.ts";

export const WORKFLOW_GUIDE_KEYS = ["overview", "task-creation", "task-execution", "task-finalization"] as const;

export type WorkflowGuideKey = (typeof WORKFLOW_GUIDE_KEYS)[number];

export interface WorkflowGuideDefinition {
	key: WorkflowGuideKey;
	uri: string;
	name: string;
	description: string;
	mimeType: string;
	resourceText: string;
	toolText?: string;
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
	},
	{
		key: "task-creation",
		uri: "backlog://workflow/task-creation",
		name: "Task Creation Guide",
		description: "Detailed guide for creating tasks: scope assessment, acceptance criteria, parent/subtasks",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_CREATION_GUIDE,
	},
	{
		key: "task-execution",
		uri: "backlog://workflow/task-execution",
		name: "Task Execution Guide",
		description: "Detailed guide for planning and executing tasks: workflow, discipline, scope changes",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_EXECUTION_GUIDE,
	},
	{
		key: "task-finalization",
		uri: "backlog://workflow/task-finalization",
		name: "Task Finalization Guide",
		description: "Detailed guide for finalizing tasks: Definition of Done, finalization workflow, next steps",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_FINALIZATION_GUIDE,
	},
];

export function getWorkflowGuideByUri(uri: string): WorkflowGuideDefinition | undefined {
	return WORKFLOW_GUIDES.find((guide) => guide.uri === uri);
}

export function getWorkflowGuideByKey(key: WorkflowGuideKey): WorkflowGuideDefinition | undefined {
	return WORKFLOW_GUIDES.find((guide) => guide.key === key);
}
