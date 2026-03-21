import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListResourcesRequestSchema,
	ListResourceTemplatesRequestSchema,
	ListToolsRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Core } from "../core/backlog.ts";
import { getPackageName } from "../utils/app-info.ts";
import { resolveBacklogDirectory } from "../utils/backlog-directory.ts";
import { getVersion } from "../utils/version.ts";
import { registerInitRequiredResource } from "./resources/init-required/index.ts";
import { registerWorkflowResources } from "./resources/workflow/index.ts";
import { registerDefinitionOfDoneTools } from "./tools/definition-of-done/index.ts";
import { registerDocumentTools } from "./tools/documents/index.ts";
import { registerMilestoneTools } from "./tools/milestones/index.ts";
import { registerTaskTools } from "./tools/tasks/index.ts";
import { registerWorkflowTools } from "./tools/workflow/index.ts";
import type {
	CallToolResult,
	GetPromptResult,
	ListPromptsResult,
	ListResourcesResult,
	ListResourceTemplatesResult,
	ListToolsResult,
	McpPromptHandler,
	McpResourceHandler,
	McpToolHandler,
	ReadResourceResult,
} from "./types.ts";

/**
 * Minimal MCP server implementation for stdio transport.
 *
 * The Backlog.md MCP server is intentionally local-only and exposes tools,
 * resources, and prompts through the stdio transport so that desktop editors
 * (e.g. Claude Code) can interact with a project without network exposure.
 */
const APP_NAME = getPackageName();
const APP_VERSION = await getVersion();
const INSTRUCTIONS =
	"At the beginning of each session, list the available resources and read the first one to understand how to use Backlog.md for task management. Additional detailed guides are available as resources when needed.";

type ServerInitOptions = {
	debug?: boolean;
};

export class McpServer extends Core {
	private readonly server: Server;
	private transport?: StdioServerTransport;
	private stopping = false;

	/** Resolved once roots discovery completes (or immediately in normal mode). */
	private _ready: Promise<void> = Promise.resolve();

	/** Debug log lines collected during roots discovery (exposed to init-required resource). */
	public readonly debugLog: string[] = [];

	private readonly tools = new Map<string, McpToolHandler>();
	private readonly resources = new Map<string, McpResourceHandler>();
	private readonly prompts = new Map<string, McpPromptHandler>();

	constructor(projectRoot: string, instructions: string) {
		super(projectRoot, { enableWatchers: true });

		this.server = new Server(
			{
				name: APP_NAME,
				version: APP_VERSION,
			},
			{
				capabilities: {
					tools: { listChanged: true },
					resources: { listChanged: true },
					prompts: { listChanged: true },
				},
				instructions,
			},
		);

		this.setupHandlers();
	}

	/**
	 * Enable roots-based project discovery for fallback mode.
	 *
	 * After the client completes initialization, the server queries MCP roots
	 * and looks for a valid backlog project. If found, it reinitializes the
	 * Core, registers the full toolset, and notifies the client.
	 *
	 * A readiness gate ensures all handlers wait until discovery completes
	 * so clients see the correct tool/resource list from the first request.
	 */
	enableRootsDiscovery(options?: { debug?: boolean }): void {
		let resolveReady!: () => void;
		this._ready = new Promise<void>((r) => {
			resolveReady = r;
		});

		this.server.oninitialized = () => {
			this.resolveFromRoots(options).finally(resolveReady);
		};
	}

	private log(message: string, options?: { debug?: boolean }): void {
		this.debugLog.push(message);
		if (options?.debug) {
			console.error(message);
		}
	}

	private async resolveFromRoots(options?: { debug?: boolean }): Promise<void> {
		const caps = this.server.getClientCapabilities();
		if (!caps?.roots) {
			this.log("Client does not support MCP roots capability, staying in fallback mode.", options);
			return;
		}

		try {
			const { roots } = await this.server.listRoots();
			this.log(`Received ${roots.length} root(s) from client.`, options);

			const checkedPaths: string[] = [];
			for (const root of roots) {
				if (!root.uri.startsWith("file://")) continue;

				const rootPath = fileURLToPath(root.uri);
				checkedPaths.push(rootPath);

				// Only check the root itself — don't walk up the tree, as that
				// could match an unrelated ancestor project outside the workspace.
				const resolution = resolveBacklogDirectory(rootPath);
				if (!resolution.configPath) continue;

				if (await this.upgradeToProject(rootPath, options)) {
					return;
				}
			}

			this.log(
				`No valid backlog project found in MCP roots: ${checkedPaths.map((p) => `\`${p}\``).join(", ")}`,
				options,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.log(`Roots discovery failed: ${message}`, options);
		}
	}

	/**
	 * Reinitialize Core with a discovered project root and register the full
	 * toolset, replacing fallback-mode registrations.
	 */
	private async upgradeToProject(projectRoot: string, options?: { debug?: boolean }): Promise<boolean> {
		this.reinitializeProjectRoot(projectRoot);
		await this.ensureConfigLoaded();
		const config = await this.filesystem.loadConfig();

		if (!config) {
			this.log(`Skipping root ${projectRoot} (no valid config).`, options);
			return false;
		}

		// Replace fallback registrations with the full toolset
		this.tools.clear();
		this.resources.clear();
		this.prompts.clear();

		registerWorkflowResources(this);
		registerWorkflowTools(this);
		registerTaskTools(this, config);
		registerMilestoneTools(this);
		registerDefinitionOfDoneTools(this);
		registerDocumentTools(this, config);

		// Notify client that available tools/resources changed
		await this.server.sendToolListChanged();
		await this.server.sendResourceListChanged();

		this.log(`MCP server upgraded to project: ${projectRoot}`, options);
		return true;
	}

	private setupHandlers(): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => this.listTools());
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => this.callTool(request));
		this.server.setRequestHandler(ListResourcesRequestSchema, async () => this.listResources());
		this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => this.listResourceTemplates());
		this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => this.readResource(request));
		this.server.setRequestHandler(ListPromptsRequestSchema, async () => this.listPrompts());
		this.server.setRequestHandler(GetPromptRequestSchema, async (request) => this.getPrompt(request));
	}

	/**
	 * Register a tool implementation with the server.
	 */
	public addTool(tool: McpToolHandler): void {
		this.tools.set(tool.name, tool);
	}

	/**
	 * Register a resource implementation with the server.
	 */
	public addResource(resource: McpResourceHandler): void {
		this.resources.set(resource.uri, resource);
	}

	/**
	 * Register a prompt implementation with the server.
	 */
	public addPrompt(prompt: McpPromptHandler): void {
		this.prompts.set(prompt.name, prompt);
	}

	/**
	 * Connect the server to the stdio transport.
	 */
	public async connect(): Promise<void> {
		if (this.transport) {
			return;
		}

		this.transport = new StdioServerTransport();
		await this.server.connect(this.transport);
	}

	/**
	 * Start the server. The stdio transport begins handling requests as soon as
	 * it is connected, so this method exists primarily for symmetry with
	 * callers that expect an explicit start step.
	 */
	public async start(): Promise<void> {
		if (!this.transport) {
			throw new Error("MCP server not connected. Call connect() before start().");
		}
	}

	/**
	 * Stop the server and release transport resources.
	 */
	public async stop(): Promise<void> {
		if (this.stopping) {
			return;
		}
		this.stopping = true;
		try {
			await this.server.close();
		} finally {
			this.transport = undefined;
			this.disposeSearchService();
			this.disposeContentStore();
		}
	}

	public getServer(): Server {
		return this.server;
	}

	// -- Internal handlers --------------------------------------------------

	protected async listTools(): Promise<ListToolsResult> {
		await this._ready;
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
		await this._ready;
		const { name, arguments: args = {} } = request.params;
		const tool = this.tools.get(name);

		if (!tool) {
			throw new Error(`Tool not found: ${name}`);
		}

		return await tool.handler(args);
	}

	protected async listResources(): Promise<ListResourcesResult> {
		await this._ready;
		return {
			resources: Array.from(this.resources.values()).map((resource) => ({
				uri: resource.uri,
				name: resource.name || "Unnamed Resource",
				description: resource.description,
				mimeType: resource.mimeType,
			})),
		};
	}

	protected async listResourceTemplates(): Promise<ListResourceTemplatesResult> {
		await this._ready;
		return {
			resourceTemplates: [],
		};
	}

	protected async readResource(request: { params: { uri: string } }): Promise<ReadResourceResult> {
		await this._ready;
		const { uri } = request.params;

		// Exact match first
		let resource = this.resources.get(uri);

		// Fallback to base URI for parameterised resources
		if (!resource) {
			const baseUri = uri.split("?")[0] || uri;
			resource = this.resources.get(baseUri);
		}

		if (!resource) {
			throw new Error(`Resource not found: ${uri}`);
		}

		return await resource.handler(uri);
	}

	protected async listPrompts(): Promise<ListPromptsResult> {
		await this._ready;
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
		await this._ready;
		const { name, arguments: args = {} } = request.params;
		const prompt = this.prompts.get(name);

		if (!prompt) {
			throw new Error(`Prompt not found: ${name}`);
		}

		return await prompt.handler(args);
	}

	/**
	 * Helper exposed for tests so they can call handlers directly.
	 */
	public get testInterface() {
		return {
			listTools: () => this.listTools(),
			callTool: (request: { params: { name: string; arguments?: Record<string, unknown> } }) => this.callTool(request),
			listResources: () => this.listResources(),
			listResourceTemplates: () => this.listResourceTemplates(),
			readResource: (request: { params: { uri: string } }) => this.readResource(request),
			listPrompts: () => this.listPrompts(),
			getPrompt: (request: { params: { name: string; arguments?: Record<string, unknown> } }) =>
				this.getPrompt(request),
		};
	}
}

/**
 * Factory that bootstraps a fully configured MCP server instance.
 *
 * If backlog is not initialized in the project directory, the server will start
 * in fallback mode with roots discovery enabled — after the client completes
 * initialization, the server queries MCP roots to find the correct project.
 */
export async function createMcpServer(projectRoot: string, options: ServerInitOptions = {}): Promise<McpServer> {
	// We need to check config first to determine which instructions to use
	const tempCore = new Core(projectRoot);
	await tempCore.ensureConfigLoaded();
	const config = await tempCore.filesystem.loadConfig();

	const server = new McpServer(projectRoot, INSTRUCTIONS);

	// Graceful fallback: if config doesn't exist, provide init-required resource
	// and enable roots discovery so the server can find the project via MCP roots
	if (!config) {
		registerInitRequiredResource(server, projectRoot);
		server.enableRootsDiscovery({ debug: options.debug });

		if (options.debug) {
			console.error("MCP server initialised in fallback mode (roots discovery enabled).");
		}

		return server;
	}

	// Normal mode: full tools and resources
	registerWorkflowResources(server);
	registerWorkflowTools(server);
	registerTaskTools(server, config);
	registerMilestoneTools(server);
	registerDefinitionOfDoneTools(server);
	registerDocumentTools(server, config);

	if (options.debug) {
		console.error("MCP server initialised (stdio transport only).");
	}

	return server;
}
