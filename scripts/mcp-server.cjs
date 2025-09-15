#!/usr/bin/env node
/**
 * MCP Server Wrapper Script
 *
 * Intelligently determines whether to use development or global installation
 * for starting the backlog.md MCP server. This script is called by Claude Code
 * via the .mcp.json configuration and automatically detects the appropriate
 * startup method based on the project context.
 *
 * Follows the same pattern as cli.cjs for distribution consistency.
 */

const { spawn } = require("node:child_process");
const { resolve } = require("node:path");
const { existsSync } = require("node:fs");

/**
 * Main wrapper function
 */
async function main() {
	try {
		// Get the project root from environment or current directory
		const projectRoot = process.env.BACKLOG_PROJECT_ROOT || process.cwd();

		// Detect installation context
		const context = detectInstallationContext(projectRoot);

		// Log startup information to stderr (won't interfere with MCP protocol)
		console.error(`🔧 Backlog.md MCP Wrapper: ${context.description}`);
		console.error(`📁 Project root: ${projectRoot}`);
		console.error(`🚀 Starting MCP server...`);

		// Start the appropriate MCP server
		await startMcpServer(context, projectRoot);

	} catch (error) {
		console.error("❌ Failed to start MCP server:", error.message);
		console.error("");
		console.error("💡 Troubleshooting:");
		console.error("   • For development: ensure 'bun' is installed and run from project root");
		console.error("   • For global install: run 'npm install -g backlog.md'");
		console.error("   • Run 'backlog mcp doctor' for detailed diagnostics");
		process.exit(1);
	}
}

/**
 * Detects the installation context
 */
function detectInstallationContext(projectRoot) {
	const isDevelopment = detectDevelopmentMode(projectRoot);
	const isGlobalInstall = detectGlobalInstall();

	// Determine priority: development > global > error
	if (isDevelopment) {
		return {
			mode: "development",
			description: "Development mode (running from source)",
			command: "bun",
			args: ["run", resolve(projectRoot, "src", "mcp-stdio-server.ts")],
		};
	}

	if (isGlobalInstall) {
		return {
			mode: "global",
			description: "Global installation",
			command: "backlog",
			args: ["mcp", "start", "--stdio"],
		};
	}

	throw new Error("No suitable MCP installation found");
}

/**
 * Detects development mode by checking for source files
 */
function detectDevelopmentMode(projectRoot) {
	const srcDir = resolve(projectRoot, "src");
	const mcpServerTs = resolve(projectRoot, "src", "mcp-stdio-server.ts");
	const packageJson = resolve(projectRoot, "package.json");

	// Check for essential development files
	return existsSync(srcDir) && existsSync(mcpServerTs) && existsSync(packageJson);
}

/**
 * Detects global installation by testing the backlog command
 */
function detectGlobalInstall() {
	try {
		const { execSync } = require("node:child_process");
		execSync("backlog --version", { stdio: "pipe", timeout: 3000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Starts the MCP server with the detected configuration
 */
function startMcpServer(context, projectRoot) {
	return new Promise((resolve, reject) => {
		// Set up environment variables
		const env = {
			...process.env,
			BACKLOG_PROJECT_ROOT: projectRoot,
		};

		// Spawn the MCP server process
		const child = spawn(context.command, context.args, {
			env,
			stdio: "inherit", // Pass through stdin/stdout for MCP protocol
			cwd: projectRoot,
		});

		// Handle process events
		child.on("error", (error) => {
			if (error.code === "ENOENT") {
				reject(new Error(`Command not found: ${context.command}. Please install the required runtime.`));
			} else {
				reject(error);
			}
		});

		child.on("close", (code, signal) => {
			if (signal) {
				console.error(`🛑 MCP server terminated by signal: ${signal}`);
			} else if (code !== 0) {
				console.error(`❌ MCP server exited with code: ${code}`);
			} else {
				console.error("✅ MCP server stopped gracefully");
			}
			resolve();
		});

		// Handle graceful shutdown
		const shutdown = (signal) => {
			console.error(`📨 Received ${signal}, forwarding to MCP server...`);
			child.kill(signal);
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));
		process.on("SIGHUP", () => shutdown("SIGHUP"));

		// Handle wrapper process exit
		process.on("exit", () => {
			if (!child.killed) {
				child.kill("SIGTERM");
			}
		});
	});
}

/**
 * Provides detailed help information
 */
function showHelp() {
	console.error("Backlog.md MCP Server Wrapper");
	console.error("");
	console.error("This script automatically detects and starts the appropriate MCP server:");
	console.error("");
	console.error("Development Mode:");
	console.error("  • Detected when src/mcp-stdio-server.ts exists");
	console.error("  • Uses: bun run src/mcp-stdio-server.ts");
	console.error("  • Requires: Bun runtime");
	console.error("");
	console.error("Global Installation:");
	console.error("  • Detected when 'backlog' command is available");
	console.error("  • Uses: backlog mcp start --stdio");
	console.error("  • Requires: npm install -g backlog.md");
	console.error("");
	console.error("Environment Variables:");
	console.error("  BACKLOG_PROJECT_ROOT  Override project root directory");
	console.error("");
	console.error("For troubleshooting, run: backlog mcp doctor");
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
	showHelp();
	process.exit(0);
}

// Only run main if this script is executed directly
if (require.main === module) {
	main().catch((error) => {
		console.error("💥 Wrapper script failed:", error.message);
		process.exit(1);
	});
}