import initRequired from "./init-required.md" with { type: "text" };
import overviewResources from "./overview.md" with { type: "text" };
import overviewTools from "./overview-tools.md" with { type: "text" };
import taskCreation from "./task-creation.md" with { type: "text" };
import taskExecution from "./task-execution.md" with { type: "text" };
import taskFinalization from "./task-finalization.md" with { type: "text" };

export const MCP_WORKFLOW_OVERVIEW = overviewResources.trim();
export const MCP_WORKFLOW_OVERVIEW_TOOLS = overviewTools.trim();
export const MCP_TASK_CREATION_GUIDE = taskCreation.trim();
export const MCP_TASK_EXECUTION_GUIDE = taskExecution.trim();
export const MCP_TASK_FINALIZATION_GUIDE = taskFinalization.trim();
export const MCP_INIT_REQUIRED_GUIDE = initRequired.trim();
