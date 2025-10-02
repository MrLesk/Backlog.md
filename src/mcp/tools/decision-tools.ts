import type { McpServer } from "../server.ts";
import type { McpToolHandler } from "../types.ts";
import { createAsyncValidatedTool } from "../validation/tool-wrapper.ts";
import type { JsonSchema } from "../validation/validators.ts";
import { DecisionToolHandlers } from "./decision-handlers.ts";

/**
 * Decision creation tool schema
 */
const decisionCreateSchema: JsonSchema = {
	type: "object",
	properties: {
		title: {
			type: "string",
			minLength: 1,
			maxLength: 200,
		},
		context: {
			type: "string",
			maxLength: 10000,
		},
		decision: {
			type: "string",
			maxLength: 10000,
		},
		consequences: {
			type: "string",
			maxLength: 10000,
		},
		alternatives: {
			type: "string",
			maxLength: 10000,
		},
		status: {
			type: "string",
			enum: ["proposed", "accepted", "rejected", "superseded"],
		},
	},
	required: ["title"],
};

/**
 * Decision creation tool handler
 */
const createDecisionCreateTool = (handlers: DecisionToolHandlers): McpToolHandler =>
	createAsyncValidatedTool(
		{
			name: "decision_create",
			description: "Create a new Architecture Decision Record (ADR) with structured content and frontmatter",
			inputSchema: decisionCreateSchema,
		},
		decisionCreateSchema,
		async (_input, _context) => [], // No additional validation needed
		async (input, _context) => {
			return handlers.createDecision({
				title: input.title as string,
				context: (input.context as string) || "",
				decision: (input.decision as string) || "",
				consequences: (input.consequences as string) || "",
				alternatives: input.alternatives as string | undefined,
				status: (input.status as "proposed" | "accepted" | "rejected" | "superseded") || "proposed",
			});
		},
	);

/**
 * Register all decision management tools with the MCP server
 * @param server The McpServer instance to register tools with
 */
export function registerDecisionTools(server: McpServer): void {
	const handlers = new DecisionToolHandlers(server);

	server.addTool(createDecisionCreateTool(handlers));
}

// Export tool creators and schemas for testing
export { createDecisionCreateTool, decisionCreateSchema };
