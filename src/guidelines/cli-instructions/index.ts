import initRequired from "./init-required.md" with { type: "text" };
import overview from "./overview.md" with { type: "text" };
import taskCreation from "./task-creation.md" with { type: "text" };
import taskExecution from "./task-execution.md" with { type: "text" };
import taskFinalization from "./task-finalization.md" with { type: "text" };

export const CLI_WORKFLOW_OVERVIEW = overview.trim();
export const CLI_TASK_CREATION_GUIDE = taskCreation.trim();
export const CLI_TASK_EXECUTION_GUIDE = taskExecution.trim();
export const CLI_TASK_FINALIZATION_GUIDE = taskFinalization.trim();
export const CLI_INIT_REQUIRED_GUIDE = initRequired.trim();
