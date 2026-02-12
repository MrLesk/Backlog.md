/**
 * MCP Command Group - Model Context Protocol CLI commands.
 *
 * This simplified command set focuses on the stdio transport, which is the
 * only supported transport for Backlog.md's local MCP integration.
 */

import type { Command } from "commander";
import { createMcpServer } from "../mcp/server.ts";

type StartOptions = {
	debug?: boolean;
	dir?: string;
};

/**
 * Register MCP command group with CLI program.
 *
 * @param program - Commander program instance
 */
export function registerMcpCommand(program: Command): void {
	const mcpCmd = program.command("mcp");
	registerStartCommand(mcpCmd);
}

/**
 * Register 'mcp start' command for stdio transport.
 */
function registerStartCommand(mcpCmd: Command): void {
	mcpCmd
		.command("start")
		.description("Start the MCP server using stdio transport")
		.option("-d, --debug", "Enable debug logging", false)
		.option("--dir <path>", "Path to the backlog project directory")
		.action(async (options: StartOptions) => {
			try {
				const projectDir = options.dir ?? process.env.BACKLOG_DIR ?? process.cwd();
				const server = await createMcpServer(projectDir, { debug: options.debug });

				await server.connect();
				await server.start();

				if (options.debug) {
					console.error("Backlog.md MCP server started (stdio transport)");
				}

				let shutdownTriggered = false;
				const shutdown = async (signal: string) => {
					if (shutdownTriggered) {
						return;
					}
					shutdownTriggered = true;
					if (options.debug) {
						console.error(`Received ${signal}, shutting down MCP server...`);
					}

					try {
						await server.stop();
						process.exit(0);
					} catch (error) {
						console.error("Error during MCP server shutdown:", error);
						process.exit(1);
					}
				};

				const handleStdioClose = () => shutdown("stdio");
				process.stdin.once("end", handleStdioClose);
				process.stdin.once("close", handleStdioClose);

				const handlePipeError = (error: unknown) => {
					const code =
						error && typeof error === "object" && "code" in error
							? String((error as { code?: string }).code ?? "")
							: "";
					if (code === "EPIPE") {
						void shutdown("EPIPE");
					}
				};
				process.stdout.once("error", handlePipeError);
				process.stderr.once("error", handlePipeError);

				process.once("SIGINT", () => shutdown("SIGINT"));
				process.once("SIGTERM", () => shutdown("SIGTERM"));
				if (process.platform !== "win32") {
					process.once("SIGHUP", () => shutdown("SIGHUP"));
					process.once("SIGPIPE", () => shutdown("SIGPIPE"));
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Failed to start MCP server: ${message}`);
				process.exit(1);
			}
		});
}
