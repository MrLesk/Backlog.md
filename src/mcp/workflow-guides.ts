import {
	CLI_INIT_REQUIRED_GUIDE,
	CLI_TASK_CREATION_GUIDE,
	CLI_TASK_EXECUTION_GUIDE,
	CLI_TASK_FINALIZATION_GUIDE,
	CLI_WORKFLOW_OVERVIEW,
} from "../guidelines/cli-instructions/index.ts";
import {
	MCP_TASK_CREATION_GUIDE,
	MCP_TASK_EXECUTION_GUIDE,
	MCP_TASK_FINALIZATION_GUIDE,
	MCP_WORKFLOW_OVERVIEW,
	MCP_WORKFLOW_OVERVIEW_TOOLS,
} from "../guidelines/mcp/index.ts";

export const WORKFLOW_GUIDE_KEYS = ["overview", "task-creation", "task-execution", "task-finalization"] as const;
export const INSTRUCTION_GUIDE_KEYS = [...WORKFLOW_GUIDE_KEYS, "init-required"] as const;

export type WorkflowGuideKey = (typeof WORKFLOW_GUIDE_KEYS)[number];
export type InstructionGuideKey = (typeof INSTRUCTION_GUIDE_KEYS)[number];

export interface WorkflowGuideDefinition<Key extends InstructionGuideKey = InstructionGuideKey> {
	key: Key;
	uri: string;
	name: string;
	description: string;
	mimeType: string;
	resourceText: string;
	toolText?: string;
}

export const WORKFLOW_GUIDES: WorkflowGuideDefinition<WorkflowGuideKey>[] = [
	{
		key: "overview",
		uri: "backlog://workflow/overview",
		name: "Backlog Workflow Overview",
		description: "When to create tasks and the basic workflow",
		mimeType: "text/markdown",
		resourceText: MCP_WORKFLOW_OVERVIEW,
		toolText: MCP_WORKFLOW_OVERVIEW_TOOLS,
	},
	{
		key: "task-creation",
		uri: "backlog://workflow/task-creation",
		name: "Task Creation Guide",
		description: "How to search, scope, and create tasks",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_CREATION_GUIDE,
	},
	{
		key: "task-execution",
		uri: "backlog://workflow/task-execution",
		name: "Task Execution Guide",
		description: "How to plan, update, and work through tasks",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_EXECUTION_GUIDE,
	},
	{
		key: "task-finalization",
		uri: "backlog://workflow/task-finalization",
		name: "Task Finalization Guide",
		description: "How to verify, summarize, and mark work Done",
		mimeType: "text/markdown",
		resourceText: MCP_TASK_FINALIZATION_GUIDE,
	},
];

const CLI_INSTRUCTION_TEXT_BY_KEY: Record<WorkflowGuideKey, string> = {
	overview: CLI_WORKFLOW_OVERVIEW,
	"task-creation": CLI_TASK_CREATION_GUIDE,
	"task-execution": CLI_TASK_EXECUTION_GUIDE,
	"task-finalization": CLI_TASK_FINALIZATION_GUIDE,
};

export const INSTRUCTION_GUIDES: WorkflowGuideDefinition[] = [
	...WORKFLOW_GUIDES.map((guide) => ({
		...guide,
		description: guide.key === "overview" ? "Required first read before answering any user request" : guide.description,
		resourceText: CLI_INSTRUCTION_TEXT_BY_KEY[guide.key],
		toolText: undefined,
	})),
	{
		key: "init-required",
		uri: "backlog://init-required",
		name: "Backlog Init Required Guide",
		description: "How to initialize Backlog.md in this directory",
		mimeType: "text/markdown",
		resourceText: CLI_INIT_REQUIRED_GUIDE,
	},
];

export function getWorkflowGuideByUri(uri: string): WorkflowGuideDefinition | undefined {
	return WORKFLOW_GUIDES.find((guide) => guide.uri === uri);
}

export function getWorkflowGuideByKey(key: WorkflowGuideKey): WorkflowGuideDefinition | undefined {
	return WORKFLOW_GUIDES.find((guide) => guide.key === key);
}

export function getInstructionGuideByKey(key: InstructionGuideKey): WorkflowGuideDefinition | undefined {
	return INSTRUCTION_GUIDES.find((guide) => guide.key === key);
}
