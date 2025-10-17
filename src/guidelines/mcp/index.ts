import initRequired from "./init-required.md" with { type: "text" };
import overview from "./overview.md" with { type: "text" };
import taskCompletion from "./task-completion.md" with { type: "text" };
import taskCreation from "./task-creation.md" with { type: "text" };
import taskExecution from "./task-execution.md" with { type: "text" };

export const MCP_WORKFLOW_OVERVIEW = overview.trim();
export const MCP_TASK_CREATION_GUIDE = taskCreation.trim();
export const MCP_TASK_EXECUTION_GUIDE = taskExecution.trim();
export const MCP_TASK_COMPLETION_GUIDE = taskCompletion.trim();
export const MCP_INIT_REQUIRED_GUIDE = initRequired.trim();
