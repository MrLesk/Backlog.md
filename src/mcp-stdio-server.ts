#!/usr/bin/env bun

/**
 * MCP stdio server entry point for Claude Code integration
 */

import { registerWorkflowPrompts } from "./mcp/prompts/workflow-prompts.ts";
import { registerDataResources } from "./mcp/resources/data-resources.ts";
import { McpServer } from "./mcp/server.ts";
import { registerBoardTools } from "./mcp/tools/board-tools.ts";
import { registerConfigTools } from "./mcp/tools/config-tools.ts";
import { registerDecisionTools } from "./mcp/tools/decision-tools.ts";
import { registerDependencyTools } from "./mcp/tools/dependency-tools.ts";
import { registerDocumentTools } from "./mcp/tools/document-tools.ts";
import { registerDraftTools } from "./mcp/tools/draft-tools.ts";
import { registerNotesTools } from "./mcp/tools/notes-tools.ts";
import { registerProjectOverviewTools } from "./mcp/tools/project-overview-tool.ts";
import { registerSequenceTools } from "./mcp/tools/sequence-tools.ts";
import { registerTaskTools } from "./mcp/tools/task-tools.ts";

async function main() {
	try {
		// Get project root from environment variable or current working directory
		const projectRoot = process.env.BACKLOG_PROJECT_ROOT || process.cwd();

		// Create MCP server instance
		const mcpServer = new McpServer(projectRoot);

		// Ensure config is loaded and get it for dynamic schema generation
		await mcpServer.ensureConfigLoaded();
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) {
			throw new Error("Failed to load backlog configuration");
		}

		// Register all tools and prompts (pass config to tools that need dynamic schemas)
		registerTaskTools(mcpServer, config);
		registerDraftTools(mcpServer, config);
		registerDecisionTools(mcpServer);
		registerDocumentTools(mcpServer);
		registerNotesTools(mcpServer);
		registerDependencyTools(mcpServer);
		registerBoardTools(mcpServer);
		registerConfigTools(mcpServer);
		registerSequenceTools(mcpServer);
		registerProjectOverviewTools(mcpServer);
		registerDataResources(mcpServer);
		registerWorkflowPrompts(mcpServer);

		// Connect via stdio transport for Claude Code
		await mcpServer.connect("stdio");

		// Start the server
		await mcpServer.start();

		// Log to stderr so it doesn't interfere with MCP protocol on stdout
		console.error("Backlog.md MCP server started via stdio transport");
		console.error(`Project root: ${projectRoot}`);

		// Handle graceful shutdown
		const shutdown = async (signal: string) => {
			console.error(`Received ${signal}, shutting down...`);
			try {
				await mcpServer.stop();
				console.error("MCP server stopped gracefully");
				process.exit(0);
			} catch (error) {
				console.error("Error during shutdown:", error);
				process.exit(1);
			}
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));
	} catch (error) {
		console.error("Failed to start MCP server:", error);
		process.exit(1);
	}
}

// Only run if this script is executed directly
if (import.meta.main) {
	main();
}
