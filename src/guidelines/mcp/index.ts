import execute from "./execute.md" with { type: "text" };
import overview from "./overview.md" with { type: "text" };
import plan from "./plan.md" with { type: "text" };
import review from "./review.md" with { type: "text" };
import understand from "./understand.md" with { type: "text" };

const sections = [overview, understand, plan, execute, review].map((section) => section.trim());
export const MCP_WORKFLOW_TEXT = sections.join("\n\n");
