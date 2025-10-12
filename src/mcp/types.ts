import type {
	CallToolResult,
	GetPromptResult,
	ListPromptsResult,
	ListResourcesResult,
	ListToolsResult,
	Prompt,
	ReadResourceResult,
	Resource,
	Tool,
} from "@modelcontextprotocol/sdk/types.js";

export interface McpToolHandler {
	name: string;
	description: string;
	inputSchema: object;
	handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

export interface McpResourceHandler {
	uri: string;
	name?: string;
	description?: string;
	mimeType?: string;
	handler: (uri: string) => Promise<ReadResourceResult>;
}

export interface McpPromptHandler {
	name: string;
	description?: string;
	arguments?: Array<{
		name: string;
		description?: string;
		required?: boolean;
	}>;
	handler: (args: Record<string, unknown>) => Promise<GetPromptResult>;
}

export type {
	CallToolResult,
	ListResourcesResult,
	ListToolsResult,
	ReadResourceResult,
	Tool,
	Resource,
	Prompt,
	ListPromptsResult,
	GetPromptResult,
};
