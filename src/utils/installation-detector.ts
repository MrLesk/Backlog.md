import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface InstallationContext {
	/** True if running from a global npm installation */
	isGlobalInstall: boolean;
	/** True if running from source code (development) */
	isDevelopment: boolean;
	/** True if the target directory is a backlog project */
	isBacklogProject: boolean;
	/** The appropriate MCP entry point for this installation */
	mcpEntryPoint: string;
	/** The project root directory where MCP will be set up */
	projectRoot: string;
	/** The source directory where backlog.md is located */
	sourceRoot?: string;
	/** Available MCP startup commands */
	mcpCommands: {
		development?: string[];
		global?: string[];
	};
}

/**
 * Detects the current installation context and provides appropriate MCP configuration
 */
export function getInstallationContext(projectRoot?: string, sourceRoot?: string): InstallationContext {
	const root = projectRoot || process.cwd();

	// Check if the target directory is a backlog project
	const isBacklogProject = detectBacklogProject(root);

	// Check if we're running from source (development mode)
	// When sourceRoot is provided, check if we're running from backlog.md source
	const isDevelopment = sourceRoot
		? detectDevelopmentMode(sourceRoot) && detectGlobalInstall()
		: detectDevelopmentMode(root);

	// Check if backlog is globally available
	const isGlobalInstall = detectGlobalInstall();

	// Determine the appropriate MCP entry point
	const mcpEntryPoint = determineMcpEntryPoint(root, isDevelopment, isGlobalInstall);

	// Build command arrays for different scenarios
	const mcpCommands = buildMcpCommands(root, isDevelopment, isGlobalInstall);

	return {
		isGlobalInstall,
		isDevelopment,
		isBacklogProject,
		mcpEntryPoint,
		projectRoot: root,
		sourceRoot,
		mcpCommands,
	};
}

/**
 * Detects if a directory is a backlog project
 */
function detectBacklogProject(projectRoot: string): boolean {
	// Check for key backlog project indicators
	const backlogDir = resolve(projectRoot, "backlog");
	const backlogMd = resolve(projectRoot, "backlog.md");

	return existsSync(backlogDir) || existsSync(backlogMd);
}

/**
 * Detects if we're running from source code (development mode)
 */
function detectDevelopmentMode(projectRoot: string): boolean {
	// Check for key development indicators
	const srcDir = resolve(projectRoot, "src");
	const mcpServerTs = resolve(projectRoot, "src", "mcp-stdio-server.ts");
	const packageJson = resolve(projectRoot, "package.json");
	const bunLockb = resolve(projectRoot, "bun.lockb");

	// Must have source directory and MCP server TypeScript file
	if (!existsSync(srcDir) || !existsSync(mcpServerTs)) {
		return false;
	}

	// Check if package.json exists and is valid JSON
	let hasValidPackageJson = false;
	if (existsSync(packageJson)) {
		try {
			const { readFileSync } = require("node:fs");
			const content = readFileSync(packageJson, "utf8");
			JSON.parse(content);
			hasValidPackageJson = true;
		} catch {
			// Invalid JSON, not a valid development environment
			hasValidPackageJson = false;
		}
	}

	const hasBunLock = existsSync(bunLockb);
	const hasNodeModules = existsSync(resolve(projectRoot, "node_modules"));

	// Development mode if we have source + valid package management files
	return hasValidPackageJson && (hasBunLock || hasNodeModules);
}

/**
 * Detects if backlog is available as a global command
 */
function detectGlobalInstall(): boolean {
	try {
		// Try to resolve backlog as a global command
		const { execSync } = require("node:child_process");
		execSync("backlog --version", { stdio: "pipe", timeout: 5000 });
		return true;
	} catch {
		// Command not found or failed
		return false;
	}
}

/**
 * Determines the best MCP entry point based on installation context
 */
function determineMcpEntryPoint(projectRoot: string, isDevelopment: boolean, isGlobalInstall: boolean): string {
	if (isDevelopment) {
		// Use bun to run TypeScript directly
		return "bun";
	}

	if (isGlobalInstall) {
		// Use global backlog command
		return "backlog";
	}

	// Fallback: try to find local binary
	const localBinary = resolve(projectRoot, "dist", "backlog");
	if (existsSync(localBinary)) {
		return localBinary;
	}

	// No suitable entry point found
	throw new Error("No suitable MCP entry point found. Either run from source or install globally.");
}

/**
 * Builds command arrays for different MCP startup scenarios
 */
function buildMcpCommands(
	_projectRoot: string,
	isDevelopment: boolean,
	isGlobalInstall: boolean,
): { development?: string[]; global?: string[] } {
	const commands: { development?: string[]; global?: string[] } = {};

	if (isDevelopment) {
		commands.development = ["run", "src/mcp-stdio-server.ts"];
	}

	if (isGlobalInstall) {
		commands.global = ["mcp", "start", "--stdio"];
	}

	return commands;
}

/**
 * Validates that the detected MCP configuration will work
 */
export async function validateMcpConfiguration(context: InstallationContext): Promise<{
	valid: boolean;
	errors: string[];
	warnings: string[];
}> {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check if project root exists and is valid
	if (!existsSync(context.projectRoot)) {
		errors.push(`Project root does not exist: ${context.projectRoot}`);
		return { valid: false, errors, warnings };
	}

	// Validate development setup
	if (context.isDevelopment) {
		const srcMcpServer = resolve(context.projectRoot, "src", "mcp-stdio-server.ts");
		if (!existsSync(srcMcpServer)) {
			errors.push("Development mode detected but src/mcp-stdio-server.ts not found");
		}

		// Check if bun is available
		try {
			const { execSync } = require("node:child_process");
			execSync("bun --version", { stdio: "pipe", timeout: 3000 });
		} catch {
			errors.push("Development mode detected but 'bun' command not available");
		}
	}

	// Validate global installation
	if (context.isGlobalInstall) {
		try {
			const { execSync } = require("node:child_process");
			const output = execSync("backlog --version", { stdio: "pipe", timeout: 3000, encoding: "utf8" });
			if (!output.includes("backlog")) {
				warnings.push("Global backlog command available but version output unexpected");
			}
		} catch {
			errors.push("Global installation detected but 'backlog' command not working");
		}
	}

	// Check if neither mode is available
	if (!context.isDevelopment && !context.isGlobalInstall) {
		errors.push("No suitable MCP installation found. Either run from source or install globally.");
	}

	// Warn if both modes are available (potential confusion)
	if (context.isDevelopment && context.isGlobalInstall) {
		warnings.push("Both development and global installations detected. Development mode will be preferred.");
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Gets a human-readable description of the installation context
 */
export function getInstallationDescription(context: InstallationContext): string {
	if (context.isDevelopment && context.isGlobalInstall) {
		return "Development mode (with global installation also available)";
	}

	if (context.isDevelopment) {
		return "Development mode (running from source)";
	}

	if (context.isGlobalInstall) {
		return "Global installation";
	}

	return "Unknown installation mode";
}

/**
 * Creates MCP server configuration for Claude Code based on installation context
 */
export function generateMcpConfiguration(context: InstallationContext): object {
	const config = {
		mcpServers: {
			"backlog-md": {
				command: context.mcpEntryPoint,
				args: context.isDevelopment ? context.mcpCommands.development : context.mcpCommands.global,
				env: {
					// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template placeholder for MCP config
					BACKLOG_PROJECT_ROOT: "${workspaceFolder}",
				},
			},
		},
	};

	return config;
}
