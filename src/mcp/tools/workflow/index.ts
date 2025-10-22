import type { McpServer } from "../../server.ts";
import type { McpToolHandler } from "../../types.ts";
import { createSimpleValidatedTool } from "../../validation/tool-wrapper.ts";
import type { JsonSchema } from "../../validation/validators.ts";
import { WORKFLOW_GUIDES } from "../../workflow-guides.ts";

const emptyInputSchema: JsonSchema = {
	type: "object",
	properties: {},
	required: [],
	additionalProperties: false,
};

function createWorkflowTool(guide: (typeof WORKFLOW_GUIDES)[number]): McpToolHandler {
	const toolText = guide.toolText ?? guide.resourceText;
	return createSimpleValidatedTool(
		{
			name: guide.toolName,
			description: guide.toolDescription,
			inputSchema: emptyInputSchema,
		},
		emptyInputSchema,
		async () => ({
			content: [
				{
					type: "text",
					text: toolText,
				},
			],
			structuredContent: {
				type: "resource",
				uri: guide.uri,
				title: guide.name,
				description: guide.description,
				mimeType: guide.mimeType,
				text: toolText,
			},
		}),
	);
}

export function registerWorkflowTools(server: McpServer): void {
	for (const guide of WORKFLOW_GUIDES) {
		server.addTool(createWorkflowTool(guide));
	}
}
