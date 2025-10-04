/**
 * Shared MCP Server initialization logic for CLI commands
 *
 * This module provides reusable functions for initializing and configuring
 * the MCP server from CLI commands, eliminating duplication between
 * CLI start command and mcp-stdio-server.ts
 */

import type { BacklogConfig } from "../types/index.ts";
import { removePidFile } from "../utils/pid-manager.ts";
import { registerWorkflowPrompts } from "./prompts/workflow-prompts.ts";
import { registerDataResources } from "./resources/data-resources.ts";
import { McpServer } from "./server.ts";
import { registerBoardTools } from "./tools/board-tools.ts";
import { registerConfigTools } from "./tools/config-tools.ts";
import { registerDecisionTools } from "./tools/decision-tools.ts";
import { registerDependencyTools } from "./tools/dependency-tools.ts";
import { registerDocumentTools } from "./tools/document-tools.ts";
import { registerDraftTools } from "./tools/draft-tools.ts";
import { registerNotesTools } from "./tools/notes-tools.ts";
import { registerProjectOverviewTools } from "./tools/project-overview-tool.ts";
import { registerSequenceTools } from "./tools/sequence-tools.ts";
import { registerTaskTools } from "./tools/task-tools.ts";
import type { HttpTransportOptions } from "./transports/http.ts";
import type { SseTransportOptions } from "./transports/sse.ts";

/**
 * CLI transport options (parsed from command line)
 */
export interface CliTransportOptions {
	transport: string;
	host?: string;
	port?: string;
	authType?: string;
	authToken?: string;
	authUser?: string;
	authPass?: string;
	corsOrigin?: string;
	daemon?: boolean;
	debug?: boolean;
}

/**
 * Initialize MCP server with all tools, resources, and prompts
 *
 * @param projectRoot - Project root directory
 * @param options - Optional configuration
 * @returns Initialized McpServer instance
 */
export async function initializeMcpServer(
	projectRoot: string,
	options?: {
		debug?: boolean;
	},
): Promise<McpServer> {
	const server = new McpServer(projectRoot);

	// Ensure config is loaded
	await server.ensureConfigLoaded();

	// Get config for dynamic schema generation
	const config = await server.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load backlog configuration");
	}

	// Register all MCP tools in consistent order (pass config to tools that need dynamic schemas)
	registerTaskTools(server, config);
	registerDraftTools(server, config);
	registerDecisionTools(server);
	registerDocumentTools(server);
	registerNotesTools(server);
	registerDependencyTools(server);
	registerBoardTools(server);
	registerConfigTools(server);
	registerSequenceTools(server);
	registerProjectOverviewTools(server);

	// Register resources
	registerDataResources(server);

	// Register workflow prompts
	registerWorkflowPrompts(server);

	if (options?.debug) {
		console.error("MCP server initialized with all tools and resources");
		console.error("Registered tools:");
		console.error("  Task management: task_create, task_list, task_update, task_view, task_archive");
		console.error("  Draft management: draft_create, draft_list, draft_view, draft_promote, draft_archive");
		console.error("  Decision management: decision_create");
		console.error("  Document management: doc_create, doc_list, doc_view");
		console.error(
			"  Notes management: notes_set, notes_append, notes_get, notes_clear, plan_set, plan_append, plan_get, plan_clear",
		);
		console.error("  Dependency management: dependency_add, dependency_remove, dependency_list, dependency_validate");
		console.error("  Board management: board_view");
		console.error("  Configuration: config_get, config_set");
		console.error("  Sequence planning: sequence_create, sequence_plan");
		console.error("  Project overview: project_overview");
		console.error("Registered prompts:");
		console.error("  Workflow templates: task_creation_workflow, sprint_planning_workflow");
		console.error("  Code review: code_review_workflow");
		console.error("  Daily standup: daily_standup_workflow");
	}

	return server;
}

/**
 * Build transport options from CLI arguments and config
 *
 * @param cliOptions - CLI transport options
 * @param config - Backlog configuration (or null)
 * @returns Transport options for HTTP/SSE transports
 */
export function buildTransportOptions(
	cliOptions: CliTransportOptions,
	config: BacklogConfig | null,
): HttpTransportOptions | SseTransportOptions {
	const mcpConfig = config?.mcp?.http;

	const options: HttpTransportOptions | SseTransportOptions = {
		host: cliOptions.host || mcpConfig?.host || "localhost",
		port: Number.parseInt(cliOptions.port || mcpConfig?.port?.toString() || "8080", 10),
		cors: {
			origin: cliOptions.corsOrigin || mcpConfig?.cors?.origin || "*",
			credentials: cliOptions.authType !== "none" || (mcpConfig?.cors?.credentials ?? false),
		},
		auth: {
			type: (cliOptions.authType || mcpConfig?.auth?.type || "none") as "bearer" | "basic" | "none",
			token: cliOptions.authToken || mcpConfig?.auth?.token,
			username: cliOptions.authUser || mcpConfig?.auth?.username,
			password: cliOptions.authPass || mcpConfig?.auth?.password,
		},
		enableDnsRebindingProtection: mcpConfig?.enableDnsRebindingProtection ?? false,
		allowedHosts: mcpConfig?.allowedHosts || [],
		allowedOrigins: mcpConfig?.allowedOrigins || [],
	};

	// HTTP transport specific option
	if (cliOptions.transport === "http") {
		const jsonResponse = (mcpConfig as Record<string, unknown>)?.enableJsonResponse;
		(options as HttpTransportOptions).enableJsonResponse = typeof jsonResponse === "boolean" ? jsonResponse : false;
	}

	// Handle CORS origin string splitting
	if (options.cors && typeof options.cors.origin === "string" && options.cors.origin !== "*") {
		options.cors.origin = options.cors.origin.split(",").map((o: string) => o.trim());
	}

	return options;
}

/**
 * Validate CLI transport options
 *
 * @param options - CLI transport options
 * @returns Validation result with any errors
 */
export function validateTransportOptions(options: CliTransportOptions): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Validate daemon mode
	if (options.daemon && !["http", "sse"].includes(options.transport)) {
		errors.push("Daemon mode is only supported with HTTP/SSE transport");
	}

	// Validate authentication options
	if (options.authType && options.authType !== "none") {
		if (options.authType === "bearer" && !options.authToken) {
			errors.push("Bearer authentication requires --auth-token");
		}
		if (options.authType === "basic" && (!options.authUser || !options.authPass)) {
			errors.push("Basic authentication requires both --auth-user and --auth-pass");
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Setup graceful shutdown handlers for MCP server
 *
 * @param server - MCP server instance
 * @param options - Shutdown options
 */
export function setupShutdownHandlers(
	server: McpServer,
	options: {
		removePidFile?: boolean;
		pidFilePath?: string;
		debug?: boolean;
	} = {},
): void {
	const cleanup = async (signal: string) => {
		if (options.debug) {
			console.error(`Received ${signal}, shutting down MCP server...`);
		}

		try {
			await server.stop();

			if (options.removePidFile && options.pidFilePath) {
				removePidFile(options.pidFilePath);
			}

			if (options.debug) {
				console.error("MCP server stopped gracefully");
			}

			process.exit(0);
		} catch (error) {
			console.error("Error during shutdown:", error);
			process.exit(1);
		}
	};

	process.on("SIGTERM", () => cleanup("SIGTERM"));
	process.on("SIGINT", () => cleanup("SIGINT"));
}

/**
 * Log transport configuration details
 *
 * @param options - CLI transport options
 * @param transportOptions - Built transport options
 */
export function logTransportInfo(
	options: CliTransportOptions,
	transportOptions: HttpTransportOptions | SseTransportOptions,
): void {
	console.error(`MCP server running on ${options.transport} transport`);

	if ((options.transport === "sse" || options.transport === "http") && transportOptions) {
		console.error(`  Host: ${transportOptions.host}:${transportOptions.port}`);
		console.error(`  Auth: ${transportOptions.auth?.type || "none"}`);

		const corsOrigin = transportOptions.cors?.origin;
		console.error(`  CORS: ${Array.isArray(corsOrigin) ? corsOrigin.join(", ") : corsOrigin || "*"}`);

		if (transportOptions.enableDnsRebindingProtection) {
			console.error("  DNS Protection: enabled");
		}
	}
}
