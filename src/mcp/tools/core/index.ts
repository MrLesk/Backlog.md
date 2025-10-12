import { MCP_WORKFLOW_TEXT } from "../../../guidelines/mcp/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { JsonSchema } from "../../validation/validators.ts";

const readBacklogInstructionsSchema: JsonSchema = {
	type: "object",
	properties: {},
	required: [],
	additionalProperties: false,
};

function createReadBacklogInstructionsTool(): McpToolHandler {
	return createSimpleValidatedTool(
		{
			name: "read_backlog_instructions",
			description: "Return the Backlog.md MCP workflow instructions for agent onboarding",
			inputSchema: readBacklogInstructionsSchema,
		},
		readBacklogInstructionsSchema,
		async () => {
			return {
				content: [
					{
						type: "text",
						text: MCP_WORKFLOW_TEXT,
					},
				],
			};
		},
	);
}

export function registerCoreTools(server: McpServer): void {
	server.addTool(createReadBacklogInstructionsTool());
}
