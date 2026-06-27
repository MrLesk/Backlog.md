/**
 * MCP Command Group - Model Context Protocol CLI commands.
 *
 * `mcp start` serves over stdio by default (local editor integration). With
 * `--http` it serves over Streamable HTTP as a single shared server, intended to
 * run behind an authenticating reverse proxy that forwards the end-user identity.
 */

import type { Command } from "commander";
import { startHttpMcpServer } from "../mcp/http-server.ts";
import { createMcpServer } from "../mcp/server.ts";
import { findBacklogRoot } from "../utils/find-backlog-root.ts";
import { resolveRuntimeCwd } from "../utils/runtime-cwd.ts";

type StartOptions = {
	debug?: boolean;
	cwd?: string;
	http?: boolean;
	port?: string;
	host?: string;
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
 * Register 'mcp start' command (stdio by default, Streamable HTTP with --http).
 */
function registerStartCommand(mcpCmd: Command): void {
	mcpCmd
		.command("start")
		.description("Start the MCP server (stdio by default, or Streamable HTTP with --http)")
		.option("-d, --debug", "Enable debug logging", false)
		.option("--cwd <path>", "Directory to resolve Backlog root from (overrides BACKLOG_CWD)")
		.option(
			"--http",
			"Serve over Streamable HTTP instead of stdio (single shared server behind a reverse proxy)",
			false,
		)
		.option("--port <port>", "HTTP port (with --http)", "6421")
		.option("--host <host>", "HTTP bind address (with --http)", "127.0.0.1")
		.action(async (options: StartOptions) => {
			try {
				const runtimeCwd = await resolveRuntimeCwd({ cwd: options.cwd });
				const projectRoot = (await findBacklogRoot(runtimeCwd.cwd)) ?? runtimeCwd.cwd;

				// HTTP transport: a single long-lived server; identity comes per-request
				// from auth-proxy headers (see commit_author_from_proxy_headers).
				if (options.http) {
					const port = Number.parseInt(options.port ?? "6421", 10);
					if (!Number.isFinite(port) || port <= 0) {
						console.error(`Invalid --port value: ${options.port}`);
						process.exit(1);
					}
					startHttpMcpServer(projectRoot, { port, host: options.host, debug: options.debug });
					console.error(`Backlog.md MCP server (Streamable HTTP) running on http://${options.host}:${port}/mcp`);
					const shutdownHttp = (signal: string) => {
						if (options.debug) console.error(`Received ${signal}, shutting down MCP HTTP server...`);
						process.exit(0);
					};
					process.once("SIGINT", () => shutdownHttp("SIGINT"));
					process.once("SIGTERM", () => shutdownHttp("SIGTERM"));
					return;
				}

				// An explicit --cwd/BACKLOG_CWD pins the root; an inferred process.cwd()
				// lets the server follow the client's workspace roots instead.
				const pinned = runtimeCwd.source !== "process";
				const server = await createMcpServer(projectRoot, { debug: options.debug, pinned });

				await server.connect();
				await server.start();

				if (options.debug) {
					if (runtimeCwd.source !== "process") {
						console.error(`Using MCP start directory from ${runtimeCwd.sourceLabel}: ${runtimeCwd.cwd}`);
					}
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
				if (process.platform !== "win32") {
					// On Windows, stdin can emit "close" while the MCP stdio pipe is still usable.
					process.stdin.once("close", handleStdioClose);
				}

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
