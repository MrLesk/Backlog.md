import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListResourcesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Core } from "../core/backlog.ts";
import type {
	CallToolResult,
	GetPromptResult,
	ListPromptsResult,
	ListResourcesResult,
	ListToolsResult,
	McpPromptHandler,
	McpResourceHandler,
	McpToolHandler,
	ReadResourceResult,
	TransportType,
} from "./types.ts";

export class McpServer extends Core {
	private server: Server;
	private transport?: StdioServerTransport;
	private tools: Map<string, McpToolHandler>;
	private resources: Map<string, McpResourceHandler>;
	private prompts: Map<string, McpPromptHandler>;

	constructor(projectRoot: string) {
		super(projectRoot);

		this.tools = new Map();
		this.resources = new Map();
		this.prompts = new Map();

		this.server = new Server(
			{
				name: "backlog.md-mcp-server",
				version: "1.0.0",
			},
			{
				capabilities: {
					tools: {
						listChanged: true,
					},
					resources: {
						subscribe: false,
						listChanged: true,
					},
					prompts: {
						listChanged: true,
					},
				},
			},
		);

		this.setupHandlers();
	}

	private setupHandlers(): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => this.listTools());
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => this.callTool(request));
		this.server.setRequestHandler(ListResourcesRequestSchema, async () => this.listResources());
		this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => this.readResource(request));
		this.server.setRequestHandler(ListPromptsRequestSchema, async () => this.listPrompts());
		this.server.setRequestHandler(GetPromptRequestSchema, async (request) => this.getPrompt(request));
	}

	protected async listTools(): Promise<ListToolsResult> {
		return {
			tools: Array.from(this.tools.values()).map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: {
					type: "object",
					...tool.inputSchema,
				},
			})),
		};
	}

	protected async callTool(request: {
		params: { name: string; arguments?: Record<string, unknown> };
	}): Promise<CallToolResult> {
		const { name, arguments: args = {} } = request.params;
		const tool = this.tools.get(name);

		if (!tool) {
			throw new Error(`Tool not found: ${name}`);
		}

		return await tool.handler(args);
	}

	protected async listResources(): Promise<ListResourcesResult> {
		return {
			resources: Array.from(this.resources.values()).map((resource) => ({
				uri: resource.uri,
				name: resource.name || "Unnamed Resource",
				description: resource.description,
				mimeType: resource.mimeType,
			})),
		};
	}

	protected async readResource(request: { params: { uri: string } }): Promise<ReadResourceResult> {
		const { uri } = request.params;
		const resource = this.resources.get(uri);

		if (!resource) {
			throw new Error(`Resource not found: ${uri}`);
		}

		return await resource.handler();
	}

	protected async listPrompts(): Promise<ListPromptsResult> {
		return {
			prompts: Array.from(this.prompts.values()).map((prompt) => ({
				name: prompt.name,
				description: prompt.description,
				arguments: prompt.arguments,
			})),
		};
	}

	protected async getPrompt(request: {
		params: { name: string; arguments?: Record<string, unknown> };
	}): Promise<GetPromptResult> {
		const { name, arguments: args = {} } = request.params;
		const prompt = this.prompts.get(name);

		if (!prompt) {
			throw new Error(`Prompt not found: ${name}`);
		}

		return await prompt.handler(args);
	}

	public addTool(tool: McpToolHandler): void {
		this.tools.set(tool.name, tool);
	}

	public addResource(resource: McpResourceHandler): void {
		this.resources.set(resource.uri, resource);
	}

	public addPrompt(prompt: McpPromptHandler): void {
		this.prompts.set(prompt.name, prompt);
	}

	private async startStdioTransport(): Promise<void> {
		this.transport = new StdioServerTransport();
		await this.server.connect(this.transport);
		console.error("MCP server running on stdio"); // Log to stderr to avoid stdout interference
	}

	public async connect(transportType: TransportType, _options?: Record<string, unknown>): Promise<void> {
		if (transportType === "stdio") {
			await this.startStdioTransport();
		} else if (transportType === "sse") {
			throw new Error("SSE transport not yet implemented - will be added in task 265.08");
		} else {
			throw new Error(`Unknown transport type: ${transportType}`);
		}
	}

	public async start(): Promise<void> {
		if (!this.transport) {
			throw new Error("No transport connected. Call connect() first.");
		}
		// Server automatically starts when transport connects
	}

	public async stop(): Promise<void> {
		if (this.server) {
			await this.server.close();
		}
	}

	public getServer(): Server {
		return this.server;
	}

	// Test interface for accessing protected methods
	public get testInterface() {
		return {
			listTools: () => this.listTools(),
			callTool: (request: { params: { name: string; arguments?: Record<string, unknown> } }) => this.callTool(request),
			listResources: () => this.listResources(),
			readResource: (request: { params: { uri: string } }) => this.readResource(request),
			listPrompts: () => this.listPrompts(),
			getPrompt: (request: { params: { name: string; arguments?: Record<string, unknown> } }) =>
				this.getPrompt(request),
		};
	}
}
