/**
 * MCP Command Group - Model Context Protocol CLI commands
 *
 * This module provides all MCP-related CLI commands:
 * - setup: Display MCP setup instructions
 * - security: Display security guidelines
 * - start: Start MCP server with various transport options
 * - stop: Stop running MCP server
 * - status: Check MCP server status
 * - test: Test MCP connection and functionality
 * - doctor: Diagnose MCP configuration issues
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import {
	buildTransportOptions,
	type CliTransportOptions,
	initializeMcpServer,
	logTransportInfo,
	setupShutdownHandlers,
	validateTransportOptions,
} from "../mcp/cli-server.ts";
import { runMcpDoctor, testMcpConnection } from "../mcp/test-connection.ts";
import type { TransportType } from "../mcp/types.ts";
import { scrollableViewer } from "../ui/tui.ts";
import {
	cleanupStaleProcess,
	isProcessRunning,
	MCP_PID_FILE,
	readPidFile,
	removePidFile,
	writePidFile,
} from "../utils/pid-manager.ts";
import { setupMCP } from "./mcp-setup.ts";

/**
 * Register MCP command group with CLI program
 *
 * @param program - Commander program instance
 */
export function registerMcpCommand(program: Command): void {
	const mcpCmd = program.command("mcp");

	registerSetupCommand(mcpCmd);
	registerSecurityCommand(mcpCmd);
	registerStartCommand(mcpCmd);
	registerStopCommand(mcpCmd);
	registerStatusCommand(mcpCmd);
	registerTestCommand(mcpCmd);
	registerDoctorCommand(mcpCmd);
}

/**
 * Register 'mcp setup' command
 */
function registerSetupCommand(mcpCmd: Command): void {
	mcpCmd
		.command("setup")
		.description("Display MCP setup instructions for AI coding assistants")
		.action(async () => {
			await setupMCP();
		});
}

/**
 * Register 'mcp security' command
 */
function registerSecurityCommand(mcpCmd: Command): void {
	mcpCmd
		.command("security")
		.description("Display MCP security guidelines and safety information")
		.action(async () => {
			try {
				// Try to find SECURITY.md in the package
				const possiblePaths = [
					join(__dirname, "../docs/mcp/SECURITY.md"),
					join(__dirname, "../../docs/mcp/SECURITY.md"),
					join(process.cwd(), "docs/mcp/SECURITY.md"),
				];

				let content: string | null = null;
				for (const path of possiblePaths) {
					try {
						content = await readFile(path, "utf-8");
						break;
					} catch {
						// Try next path
					}
				}

				if (!content) {
					console.log(chalk.yellow("\n⚠️  Security documentation not found locally."));
					console.log(chalk.dim("View online: https://github.com/MrLesk/Backlog.md/blob/main/docs/mcp/SECURITY.md\n"));
					return;
				}

				// Display the content with paging if possible
				const lines = content.split("\n");
				const termHeight = process.stdout.rows || 40;

				if (lines.length > termHeight - 5 && process.stdout.isTTY) {
					// Use scrollable viewer for long content
					await scrollableViewer(content);
				} else {
					// Just print it
					console.log(content);
				}
			} catch (error) {
				console.error(chalk.red("Error displaying security guidelines:"), error);
				console.log(chalk.dim("\nView online: https://github.com/MrLesk/Backlog.md/blob/main/docs/mcp/SECURITY.md\n"));
			}
		});
}

/**
 * Register 'mcp start' command
 */
function registerStartCommand(mcpCmd: Command): void {
	mcpCmd
		.command("start")
		.description("Start MCP server")
		.option("-d, --debug", "Enable debug logging", false)
		.option("-t, --transport <type>", "Transport type (stdio|http|sse)", "stdio")
		.option("-p, --port <port>", "Port number for HTTP/SSE transport", "8080")
		.option("--host <host>", "Host to bind to for HTTP/SSE transport", "localhost")
		.option("--auth-type <type>", "Authentication type (none|bearer|basic)", "none")
		.option("--auth-token <token>", "Authentication token for bearer auth")
		.option("--auth-user <username>", "Username for basic auth")
		.option("--auth-pass <password>", "Password for basic auth")
		.option("--cors-origin <origin>", "CORS allowed origins (comma-separated or *)", "*")
		.option("--daemon", "Run as daemon process (HTTP/SSE transport only)", false)
		.action(async (options: CliTransportOptions) => {
			try {
				// Only use PID files for daemon-like transports (HTTP/SSE)
				// stdio transport should be ephemeral and allow multiple instances
				if (options.transport !== "stdio") {
					// Check if server is already running
					const existingPid = readPidFile();
					if (existingPid && isProcessRunning(existingPid)) {
						console.error(`MCP server is already running with PID ${existingPid}`);
						process.exit(1);
					}

					// Clean up stale PID file if needed
					cleanupStaleProcess();
				}

				// Validate transport options
				const validation = validateTransportOptions(options);
				if (!validation.valid) {
					for (const error of validation.errors) {
						console.error(error);
					}
					process.exit(1);
				}

				// Initialize server
				const server = await initializeMcpServer(process.cwd(), {
					debug: options.debug,
				});

				// Load config for defaults
				const config = await server.filesystem.loadConfig();

				// Write PID file only for daemon-like transports
				if (options.transport !== "stdio") {
					writePidFile(process.pid);
				}

				// Set up graceful shutdown
				setupShutdownHandlers(server, {
					removePidFile: options.transport !== "stdio",
					pidFilePath: MCP_PID_FILE,
					debug: options.debug,
				});

				// Prepare transport options for HTTP/SSE
				let transportOptions: ReturnType<typeof buildTransportOptions> | undefined;
				if (options.transport === "sse" || options.transport === "http") {
					transportOptions = buildTransportOptions(options, config);
				}

				if (options.debug && transportOptions) {
					logTransportInfo(options, transportOptions);
				}

				// Connect to transport
				await server.connect(options.transport as TransportType, transportOptions);

				// Start server for stdio transport
				if (options.transport === "stdio") {
					await server.start();
				}
			} catch (error) {
				// Only remove PID file if we created one
				if (options.transport !== "stdio") {
					removePidFile();
				}
				console.error("Failed to start MCP server:", error instanceof Error ? error.message : error);
				process.exit(1);
			}
		});
}

/**
 * Register 'mcp stop' command
 */
function registerStopCommand(mcpCmd: Command): void {
	mcpCmd
		.command("stop")
		.description("Stop running MCP server")
		.action(() => {
			try {
				const pid = readPidFile();

				if (!pid) {
					console.error("No MCP server PID file found. Server may not be running.");
					process.exit(1);
				}

				if (!isProcessRunning(pid)) {
					console.error(`Process ${pid} is not running. Cleaning up stale PID file.`);
					removePidFile();
					process.exit(1);
				}

				console.log(`Stopping MCP server (PID ${pid})...`);
				process.kill(pid, "SIGTERM");

				// Wait a moment for graceful shutdown
				setTimeout(() => {
					if (isProcessRunning(pid)) {
						console.log("Forcing shutdown...");
						try {
							process.kill(pid, "SIGKILL");
						} catch {
							// Process may have already stopped
						}
					}
					removePidFile();
					console.log("MCP server stopped.");
				}, 2000);
			} catch (error) {
				console.error("Failed to stop MCP server:", error instanceof Error ? error.message : error);
				process.exit(1);
			}
		});
}

/**
 * Register 'mcp status' command
 */
function registerStatusCommand(mcpCmd: Command): void {
	mcpCmd
		.command("status")
		.description("Check MCP server status")
		.action(() => {
			try {
				const pid = readPidFile();

				if (!pid) {
					console.log("MCP server: Not running (no PID file found)");
					return;
				}

				if (isProcessRunning(pid)) {
					console.log(`MCP server: Running (PID ${pid})`);
				} else {
					console.log(`MCP server: Not running (stale PID file found for ${pid})`);
					console.log("Cleaning up stale PID file...");
					removePidFile();
				}
			} catch (error) {
				console.error("Failed to check server status:", error instanceof Error ? error.message : error);
				process.exit(1);
			}
		});
}

/**
 * Register 'mcp test' command
 */
function registerTestCommand(mcpCmd: Command): void {
	mcpCmd
		.command("test")
		.description("Test MCP server connection and functionality")
		.option("--verbose", "Show detailed test results", false)
		.action(async (options: { verbose?: boolean }) => {
			try {
				console.log("🧪 Testing MCP connection...");
				console.log("");

				const result = await testMcpConnection(process.cwd());

				// Show context info
				console.log(`📁 Project: ${result.context.projectRoot}`);
				console.log(
					`🔧 Mode: ${result.context.isDevelopment ? "Development" : result.context.isGlobalInstall ? "Global" : "Unknown"}`,
				);
				console.log(`⚡ Entry point: ${result.context.mcpEntryPoint}`);
				console.log("");

				// Show results
				if (result.success) {
					console.log("✅ MCP connection test passed!");
					console.log(`🚀 Server startup time: ${result.serverInfo?.startupTime}ms`);
					console.log(`🛠️  Available tools: ${result.tools.length}`);
					console.log(`📊 Available resources: ${result.resources.length}`);
					console.log(`💡 Available prompts: ${result.prompts.length}`);

					if (options.verbose) {
						console.log("");
						console.log("📋 Tools:", result.tools.join(", "));
						console.log("📋 Resources:", result.resources.join(", "));
						console.log("📋 Prompts:", result.prompts.join(", "));
					}
				} else {
					console.log("❌ MCP connection test failed");
					console.log("");
					console.log("🔥 Errors:");
					for (const error of result.errors) {
						console.log(`   • ${error}`);
					}
				}

				// Show warnings
				if (result.warnings.length > 0) {
					console.log("");
					console.log("⚠️  Warnings:");
					for (const warning of result.warnings) {
						console.log(`   • ${warning}`);
					}
				}

				if (!result.success) {
					console.log("");
					console.log("💡 Try running 'backlog mcp doctor' for detailed diagnostics");
					process.exit(1);
				}
			} catch (error) {
				console.error("❌ Test failed:", error instanceof Error ? error.message : error);
				process.exit(1);
			}
		});
}

/**
 * Register 'mcp doctor' command
 */
function registerDoctorCommand(mcpCmd: Command): void {
	mcpCmd
		.command("doctor")
		.description("Diagnose MCP configuration and setup issues")
		.action(async () => {
			try {
				console.log("🏥 Running MCP diagnostics...");
				console.log("");

				const result = await runMcpDoctor(process.cwd());

				// Show overall status
				const statusEmoji = result.overall === "healthy" ? "✅" : result.overall === "warning" ? "⚠️" : "❌";
				console.log(`${statusEmoji} Overall status: ${result.overall.toUpperCase()}`);
				console.log(`📁 Project: ${result.context.projectRoot}`);
				console.log(
					`🔧 Installation: ${result.context.isDevelopment ? "Development" : result.context.isGlobalInstall ? "Global" : "None detected"}`,
				);
				console.log("");

				// Show detailed checks
				console.log("🔍 Diagnostic Results:");
				for (const check of result.checks) {
					const emoji = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
					console.log(`${emoji} ${check.name}: ${check.message}`);
					if (check.suggestion && check.status !== "pass") {
						console.log(`   💡 ${check.suggestion}`);
					}
				}

				// Show recommendations
				if (result.recommendations.length > 0) {
					console.log("");
					console.log("📋 Recommendations:");
					for (const rec of result.recommendations) {
						console.log(`${rec}`);
					}
				}

				if (result.overall === "error") {
					process.exit(1);
				}
			} catch (error) {
				console.error("❌ Doctor failed:", error instanceof Error ? error.message : error);
				process.exit(1);
			}
		});
}
