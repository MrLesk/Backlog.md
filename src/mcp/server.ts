import { stat } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
	CallToolRequestSchema,
	ErrorCode,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListResourcesRequestSchema,
	ListResourceTemplatesRequestSchema,
	ListRootsResultSchema,
	ListToolsRequestSchema,
	McpError,
	ReadResourceRequestSchema,
	RootsListChangedNotificationSchema,
	type ServerNotification,
	type ServerRequest,
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

type ServerRequestExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export class McpServer extends Core {
	private readonly server: Server;
	private transport?: StdioServerTransport;
	private stopping = false;

	/** Debug log lines collected during roots discovery (exposed to init-required resource). */
	public readonly debugLog: string[] = [];

	/** Whether roots discovery is enabled (and options for re-runs on roots change). */
	private rootsDiscoveryEnabled = false;
	private rootsDiscoveryOptions: { debug?: boolean } = {};
	private rootsResolutionDirty = false;
	private rootsResolutionInFlight?: Promise<void>;

	/** The projectRoot passed to createMcpServer, used to revert on downgrade. */
	private readonly initialProjectRoot: string;

	/** True when the server has been upgraded from fallback to a real project. */
	private upgraded = false;

	private readonly tools = new Map<string, McpToolHandler>();
	private readonly resources = new Map<string, McpResourceHandler>();
	private readonly prompts = new Map<string, McpPromptHandler>();

	constructor(projectRoot: string, instructions: string) {
		super(projectRoot, { enableWatchers: true });
		this.initialProjectRoot = projectRoot;

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
					logging: {},
				},
				instructions,
			},
		);

		this.setupHandlers();
	}

	/**
	 * Enable roots-based project discovery for fallback mode.
	 *
	 * The first request-scoped handler invocation can query MCP roots to look
	 * for a valid backlog project. If found, the server reinitializes the Core,
	 * registers the full toolset, and notifies the client. Subsequent requests
	 * reuse the cached resolution until the client reports roots changes.
	 */
	enableRootsDiscovery(options?: { debug?: boolean }): void {
		this.rootsDiscoveryEnabled = true;
		this.rootsDiscoveryOptions = options ?? {};
		this.rootsResolutionDirty = true;
	}

	private log(message: string, options?: { debug?: boolean }): void {
		this.debugLog.push(message);
		if (options?.debug) {
			console.error(message);
		}
		// Also send via MCP logging protocol when transport is connected
		this.server.sendLoggingMessage({ level: "info", logger: "backlog", data: message }).catch(() => {});
	}

	private async ensureRootsResolved(extra?: ServerRequestExtra): Promise<void> {
		if (!this.rootsDiscoveryEnabled || !this.rootsResolutionDirty || !extra) {
			return;
		}

		if (!this.rootsResolutionInFlight) {
			const resolutionPromise = this.resolveFromRoots(extra, this.rootsDiscoveryOptions).finally(() => {
				if (this.rootsResolutionInFlight === resolutionPromise) {
					this.rootsResolutionInFlight = undefined;
				}
			});
			this.rootsResolutionInFlight = resolutionPromise;
		}

		await this.rootsResolutionInFlight;
	}

	private async resolveFromRoots(extra: ServerRequestExtra, options?: { debug?: boolean }): Promise<void> {
		this.rootsResolutionDirty = false;

		const caps = this.server.getClientCapabilities();
		if (!caps?.roots) {
			this.log("Client does not support MCP roots capability, staying in fallback mode.", options);
			return;
		}

		try {
			const { roots } = await extra.sendRequest({ method: "roots/list" }, ListRootsResultSchema);
			this.log(`Received ${roots.length} root(s) from client.`, options);

			const checkedPaths = new Set<string>();
			for (const root of roots) {
				const rootPath = await this.resolveRootSearchPath(root.uri);
				if (!rootPath) continue;
				checkedPaths.add(rootPath);

				// Only check the root itself — don't walk up the tree, as that
				// could match an unrelated ancestor project outside the workspace.
				const resolution = resolveBacklogDirectory(rootPath);
				if (!resolution.configPath) continue;

				if (await this.upgradeToProject(rootPath, options)) {
					return;
				}
			}

			if (this.upgraded) {
				await this.downgradeToFallback(options);
			}

			const checkedRoots =
				checkedPaths.size > 0
					? Array.from(checkedPaths)
							.map((path) => `\`${path}\``)
							.join(", ")
					: "no usable file roots";
			this.log(`No valid backlog project found in MCP roots: ${checkedRoots}`, options);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.log(`Roots discovery failed: ${message}`, options);
		}
	}

	private async resolveRootSearchPath(rootUri: string): Promise<string | null> {
		if (!rootUri.startsWith("file://")) {
			return null;
		}

		try {
			const rootPath = fileURLToPath(rootUri);
			const rootStat = await stat(rootPath);
			if (rootStat.isDirectory()) {
				return rootPath;
			}
			if (rootStat.isFile()) {
				return dirname(rootPath);
			}
		} catch {
			return null;
		}

		return null;
	}

	/**
	 * Reinitialize Core with a discovered project root and register the full
	 * toolset, replacing fallback-mode registrations.
	 */
	private async upgradeToProject(projectRoot: string, options?: { debug?: boolean }): Promise<boolean> {
		if (this.upgraded && this.filesystem.rootDir === projectRoot) {
			this.log(`MCP roots still resolve to current project: ${projectRoot}`, options);
			return true;
		}

		const previousProjectRoot = this.filesystem.rootDir;
		this.reinitializeProjectRoot(projectRoot);
		await this.ensureConfigLoaded();
		const config = await this.filesystem.loadConfig();

		if (!config) {
			this.reinitializeProjectRoot(previousProjectRoot);
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

		// Notify client that available tools/resources/prompts changed
		await this.server.sendToolListChanged();
		await this.server.sendResourceListChanged();
		await this.server.sendPromptListChanged();

		this.upgraded = true;
		this.log(`MCP server upgraded to project: ${projectRoot}`, options);
		return true;
	}

	/**
	 * Revert from an upgraded project back to fallback mode.
	 * Called when roots change and no valid project is found in the new roots.
	 */
	private async downgradeToFallback(options?: { debug?: boolean }): Promise<void> {
		this.reinitializeProjectRoot(this.initialProjectRoot);
		this.upgraded = false;

		this.tools.clear();
		this.resources.clear();
		this.prompts.clear();

		registerInitRequiredResource(this, this.initialProjectRoot);

		await this.server.sendToolListChanged();
		await this.server.sendResourceListChanged();
		await this.server.sendPromptListChanged();

		this.log("MCP server reverted to fallback mode (workspace no longer has a backlog project).", options);
	}

	private setupHandlers(): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async (_request, extra) => this.listTools(extra));
		this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => this.callTool(request, extra));
		this.server.setRequestHandler(ListResourcesRequestSchema, async (_request, extra) => this.listResources(extra));
		this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async (_request, extra) =>
			this.listResourceTemplates(extra),
		);
		this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) =>
			this.readResource(request, extra),
		);
		this.server.setRequestHandler(ListPromptsRequestSchema, async (_request, extra) => this.listPrompts(extra));
		this.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => this.getPrompt(request, extra));

		// Mark cached roots resolution dirty when client workspace changes.
		this.server.setNotificationHandler(RootsListChangedNotificationSchema, () => {
			if (this.rootsDiscoveryEnabled) {
				this.rootsResolutionDirty = true;
			}
		});
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

	protected async listTools(extra?: ServerRequestExtra): Promise<ListToolsResult> {
		await this.ensureRootsResolved(extra);
		return {
			tools: Array.from(this.tools.values()).map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: {
					type: "object",
					...tool.inputSchema,
				},
				...(tool.annotations ? { annotations: tool.annotations } : {}),
			})),
		};
	}

	protected async callTool(
		request: {
			params: { name: string; arguments?: Record<string, unknown> };
		},
		extra?: ServerRequestExtra,
	): Promise<CallToolResult> {
		await this.ensureRootsResolved(extra);
		const { name, arguments: args = {} } = request.params;
		const tool = this.tools.get(name);

		if (!tool) {
			throw new McpError(ErrorCode.InvalidParams, `Tool not found: ${name}`);
		}

		return await tool.handler(args);
	}

	protected async listResources(extra?: ServerRequestExtra): Promise<ListResourcesResult> {
		await this.ensureRootsResolved(extra);
		return {
			resources: Array.from(this.resources.values()).map((resource) => ({
				uri: resource.uri,
				name: resource.name || "Unnamed Resource",
				description: resource.description,
				mimeType: resource.mimeType,
			})),
		};
	}

	protected async listResourceTemplates(extra?: ServerRequestExtra): Promise<ListResourceTemplatesResult> {
		await this.ensureRootsResolved(extra);
		return {
			resourceTemplates: [],
		};
	}

	protected async readResource(
		request: { params: { uri: string } },
		extra?: ServerRequestExtra,
	): Promise<ReadResourceResult> {
		await this.ensureRootsResolved(extra);
		const { uri } = request.params;

		// Exact match first
		let resource = this.resources.get(uri);

		// Fallback to base URI for parameterised resources
		if (!resource) {
			const baseUri = uri.split("?")[0] || uri;
			resource = this.resources.get(baseUri);
		}

		if (!resource) {
			throw new McpError(ErrorCode.InvalidParams, `Resource not found: ${uri}`);
		}

		return await resource.handler(uri);
	}

	protected async listPrompts(extra?: ServerRequestExtra): Promise<ListPromptsResult> {
		await this.ensureRootsResolved(extra);
		return {
			prompts: Array.from(this.prompts.values()).map((prompt) => ({
				name: prompt.name,
				description: prompt.description,
				arguments: prompt.arguments,
			})),
		};
	}

	protected async getPrompt(
		request: {
			params: { name: string; arguments?: Record<string, unknown> };
		},
		extra?: ServerRequestExtra,
	): Promise<GetPromptResult> {
		await this.ensureRootsResolved(extra);
		const { name, arguments: args = {} } = request.params;
		const prompt = this.prompts.get(name);

		if (!prompt) {
			throw new McpError(ErrorCode.InvalidParams, `Prompt not found: ${name}`);
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
 * in fallback mode with roots discovery enabled — the first request-scoped MCP
 * handler can then query client roots to find the correct project.
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
