/**
 * MCP Server for Backlog.md
 *
 * ⚠️ LOCAL DEVELOPMENT ONLY: Designed for localhost use with local AI assistants.
 * See docs/mcp/SECURITY.md for usage guidelines.
 *
 * Supported transports:
 * - stdio: Process isolation (recommended)
 * - http: localhost only (127.0.0.1)
 * - sse: localhost only (127.0.0.1)
 */

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
import { ConnectionManager } from "./connection/manager.ts";
import { BacklogHttpTransport, type HttpTransportOptions } from "./transports/http.ts";
import { BacklogSseTransport, type SseTransportOptions } from "./transports/sse.ts";
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
	private transport?: StdioServerTransport | BacklogSseTransport | BacklogHttpTransport;
	private connectionManager?: ConnectionManager;
	private cleanupInterval?: NodeJS.Timeout;
	private tools: Map<string, McpToolHandler>;
	private resources: Map<string, McpResourceHandler>;
	private prompts: Map<string, McpPromptHandler>;
	private transportType?: TransportType;

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

		// First try exact match
		let resource = this.resources.get(uri);

		// If not found, try to match by base URI (for parameterized resources)
		if (!resource) {
			const baseUri = uri.split("?")[0] || uri; // Remove query parameters
			resource = this.resources.get(baseUri);
		}

		if (!resource) {
			throw new Error(`Resource not found: ${uri}`);
		}

		return await resource.handler(uri);
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

	private async startSseTransport(options?: SseTransportOptions): Promise<void> {
		if (!this.connectionManager) {
			throw new Error("Connection manager not initialized for SSE transport");
		}
		this.transport = new BacklogSseTransport(options);
		await this.transport.start(this.server, this.connectionManager);
	}

	private async startHttpTransport(options?: HttpTransportOptions): Promise<void> {
		if (!this.connectionManager) {
			throw new Error("Connection manager not initialized for HTTP transport");
		}
		this.transport = new BacklogHttpTransport(options);
		await this.transport.start(this.server, this.connectionManager);
	}

	public async connect(
		transportType: TransportType,
		options?: SseTransportOptions | HttpTransportOptions,
	): Promise<void> {
		this.transportType = transportType;

		if (transportType === "stdio") {
			await this.startStdioTransport();
		} else {
			// Create ConnectionManager only for network transports
			if (!this.connectionManager) {
				this.connectionManager = new ConnectionManager({
					inactivity: 30000, // 30 seconds
					absolute: 3600000, // 1 hour
				});
			}

			if (transportType === "sse") {
				await this.startSseTransport(options as SseTransportOptions);
			} else if (transportType === "http") {
				await this.startHttpTransport(options as HttpTransportOptions);
			} else {
				throw new Error(`Unknown transport type: ${transportType}`);
			}
		}
	}

	public async start(): Promise<void> {
		if (!this.transport) {
			throw new Error("No transport connected. Call connect() first.");
		}

		// Start periodic connection cleanup only for network transports
		if (this.connectionManager && (this.transportType === "http" || this.transportType === "sse")) {
			this.cleanupInterval = this.connectionManager.startPeriodicCleanup(60000); // Every minute
		}

		// Server automatically starts when transport connects
	}

	/**
	 * Get the actual port number that the transport is listening on
	 * @returns The port number, or undefined if no transport is connected or it doesn't support port reporting
	 */
	public getPort(): number | undefined {
		if (this.transport && "getPort" in this.transport) {
			return this.transport.getPort();
		}
		return undefined;
	}

	public async stop(): Promise<void> {
		// Stop periodic cleanup
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = undefined;
		}

		// Clean up all connections (only for network transports)
		if (this.connectionManager) {
			this.connectionManager.stopPeriodicCleanup();
			await this.connectionManager.removeAllConnections("Server shutdown");
		}

		if (this.transport && "stop" in this.transport) {
			await this.transport.stop();
		}
		if (this.server) {
			await this.server.close();
		}
	}

	public getServer(): Server {
		return this.server;
	}

	public getConnectionManager(): ConnectionManager | undefined {
		return this.connectionManager;
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
