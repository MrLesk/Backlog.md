import { MCP_INIT_REQUIRED_GUIDE } from "../../../guidelines/mcp/index.ts";
import type { McpServer } from "../../server.ts";
import type { McpResourceHandler } from "../../types.ts";

function createInitRequiredResource(): McpResourceHandler {
	return {
		uri: "backlog://init-required",
		name: "Backlog.md Not Initialized",
		description: "Instructions for initializing Backlog.md in this project",
		mimeType: "text/markdown",
		handler: async () => ({
			contents: [
				{
					uri: "backlog://init-required",
					mimeType: "text/markdown",
					text: MCP_INIT_REQUIRED_GUIDE,
				},
			],
		}),
	};
}

export function registerInitRequiredResource(server: McpServer): void {
	server.addResource(createInitRequiredResource());
}
