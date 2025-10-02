const { existsSync, realpathSync } = require("node:fs");
const { resolve } = require("node:path");

/**
 * Smart CLI detection for Backlog.md
 * Automatically determines the best execution mode based on installation context
 */

function debugLog(message) {
	if (process.env.BACKLOG_DEBUG || process.env.BACKLOG_SMART_CLI_DEBUG) {
		console.error(`[BACKLOG_CLI_DEBUG] ${message}`);
	}
}

/**
 * Detects if this is a globally linked installation (bun link or npm link)
 * @returns {boolean} True if running from a linked installation
 */
function isGloballyLinked() {
	try {
		const scriptRealPath = realpathSync(__filename);

		// Check multiple indicators of global linking:
		// 1. Script is accessed via a symlink (process.argv[1] differs from __filename real path)
		// 2. Running from global installation directories
		// 3. Bun link pattern (/.bun/bin/ points to project directory)

		const commandPath = process.argv[1];
		const isSymlinked = commandPath && commandPath !== scriptRealPath;

		const isInGlobalDir =
			scriptRealPath.includes("/install/global/") ||
			scriptRealPath.includes("/.npm/") ||
			scriptRealPath.includes("/lib/node_modules/");

		const isBunLinked = commandPath?.includes("/.bun/bin/") && !scriptRealPath.includes("/.bun/install/global/");

		const isLinked = isSymlinked || isInGlobalDir || isBunLinked;

		debugLog("Global link check details:");
		debugLog(`  Command path: ${commandPath}`);
		debugLog(`  Script real path: ${scriptRealPath}`);
		debugLog(`  Is symlinked: ${isSymlinked}`);
		debugLog(`  Is in global dir: ${isInGlobalDir}`);
		debugLog(`  Is bun linked: ${isBunLinked}`);
		debugLog(`  Final result: ${isLinked ? "linked" : "local"}`);

		return isLinked;
	} catch (error) {
		debugLog(`Global link check failed: ${error.message}`);
		return false;
	}
}

/**
 * Detects the appropriate execution mode for the CLI
 * @returns {Object} Execution configuration { mode, command, args }
 */
function detectExecutionMode() {
	try {
		// Get the real path of the calling script (follows symlinks)
		const scriptRealPath = realpathSync(__filename);
		const projectRoot = resolve(scriptRealPath, "../..");

		debugLog(`Script real path: ${scriptRealPath}`);
		debugLog(`Project root: ${projectRoot}`);

		// Security: Validate we're in a valid Node.js project context
		const packageJsonPath = resolve(projectRoot, "package.json");
		if (!existsSync(packageJsonPath)) {
			throw new Error("Not in a valid Node.js project - package.json not found");
		}

		// Check for different execution contexts
		const hasSrcCli = existsSync(resolve(projectRoot, "src/cli.ts"));
		const hasDistBinary = existsSync(resolve(projectRoot, "dist/backlog"));
		const isLinked = isGloballyLinked();

		debugLog(`Has src/cli.ts: ${hasSrcCli}`);
		debugLog(`Has dist/backlog: ${hasDistBinary}`);
		debugLog(`Is globally linked: ${isLinked}`);

		// Check if platform binary is available (production install)
		const hasPlatformBinary = (() => {
			try {
				const { resolveBinaryPath } = require("./resolveBinary.cjs");
				const binaryPath = resolveBinaryPath();
				debugLog(`Platform binary path: ${binaryPath}`);
				return existsSync(binaryPath);
			} catch (error) {
				debugLog(`Platform binary check failed: ${error.message}`);
				return false;
			}
		})();

		debugLog(`Has platform binary: ${hasPlatformBinary}`);

		// Check for manual execution mode override
		const manualMode = process.env.BACKLOG_EXECUTION_MODE;
		if (manualMode) {
			debugLog(`Manual execution mode override: ${manualMode}`);
			return getExecutionConfigForMode(manualMode, projectRoot, hasPlatformBinary);
		}

		// Feature flag to disable smart detection
		if (process.env.BACKLOG_SMART_CLI === "false") {
			debugLog("Smart CLI detection disabled by environment variable");
			if (hasPlatformBinary) {
				const { resolveBinaryPath } = require("./resolveBinary.cjs");
				return { mode: "production-forced", command: resolveBinaryPath(), args: [] };
			}
			throw new Error("Smart CLI disabled but no platform binary available");
		}

		// NEW DECISION LOGIC (prioritizes development mode for linked installations):
		// 1. If globally linked OR (src files exist AND no platform binary) -> DEVELOPMENT MODE
		// 2. If platform binary exists -> PRODUCTION MODE
		// 3. If built binary exists but no src files -> BUILT MODE
		// 4. Fallback to development if src files exist

		if (isLinked || (hasSrcCli && !hasPlatformBinary)) {
			// Development scenario - globally linked installation or development setup
			debugLog("Using development mode (TypeScript source)");
			return {
				mode: "development",
				command: "bun",
				args: [resolve(projectRoot, "src/cli.ts")],
			};
		}

		if (hasPlatformBinary) {
			// Production scenario - use platform-specific binary
			debugLog("Using platform binary (production mode)");
			const { resolveBinaryPath } = require("./resolveBinary.cjs");
			return {
				mode: "production",
				command: resolveBinaryPath(),
				args: [],
			};
		}

		if (hasDistBinary) {
			// Built binary exists but no src files (unusual but possible)
			debugLog("Using built binary (dist mode)");
			return {
				mode: "built",
				command: resolve(projectRoot, "dist/backlog"),
				args: [],
			};
		}

		if (hasSrcCli) {
			// Fallback to development mode if src files exist
			debugLog("Fallback to development mode");
			return {
				mode: "development-fallback",
				command: "bun",
				args: [resolve(projectRoot, "src/cli.ts")],
			};
		}

		throw new Error("No valid backlog installation found");
	} catch (error) {
		debugLog(`Detection error: ${error.message}`);
		throw error;
	}
}

/**
 * Gets execution config for a manually specified mode
 * @param {string} mode - The requested execution mode
 * @param {string} projectRoot - The project root directory
 * @param {boolean} hasPlatformBinary - Whether platform binary is available
 * @returns {Object} Execution configuration
 */
function getExecutionConfigForMode(mode, projectRoot, hasPlatformBinary) {
	switch (mode.toLowerCase()) {
		case "development":
		case "dev":
			return {
				mode: "development-manual",
				command: "bun",
				args: [resolve(projectRoot, "src/cli.ts")],
			};
		case "built":
		case "build":
			return {
				mode: "built-manual",
				command: resolve(projectRoot, "dist/backlog"),
				args: [],
			};
		case "production":
		case "prod": {
			if (!hasPlatformBinary) {
				throw new Error("Manual production mode requested but no platform binary available");
			}
			const { resolveBinaryPath } = require("./resolveBinary.cjs");
			return {
				mode: "production-manual",
				command: resolveBinaryPath(),
				args: [],
			};
		}
		default:
			throw new Error(`Invalid execution mode: ${mode}. Use 'development', 'built', or 'production'`);
	}
}

/**
 * Validates that the required runtime is available for the detected mode
 * @param {Object} config - Execution configuration from detectExecutionMode
 * @returns {boolean} Whether the runtime is available
 */
function validateRuntime(config) {
	try {
		if (config.mode.startsWith("development") && config.command === "bun") {
			// Check if bun is available
			const { execSync } = require("node:child_process");
			execSync("bun --version", { stdio: "ignore" });
			debugLog("Bun runtime validated successfully");
			return true;
		}

		// For built and production modes, assume the binary exists if we got here
		return true;
	} catch (error) {
		debugLog(`Runtime validation failed: ${error.message}`);
		return false;
	}
}

/**
 * Gets user-friendly error messages for common issues
 * @param {string} mode - The detected execution mode
 * @param {Error} error - The error that occurred
 * @returns {string} User-friendly error message
 */
function getErrorMessage(mode, error) {
	if (mode?.startsWith("development") && error.message.includes("bun")) {
		return `Development mode requires Bun runtime.
Please install Bun: curl -fsSL https://bun.sh/install | bash
Or build the project first: bun run build`;
	}

	if (error.message.includes("platform binary")) {
		return `Platform binary not found for ${process.platform}-${process.arch}.
This usually happens in development. Try: bun install && bun run build`;
	}

	return error.message;
}

module.exports = {
	detectExecutionMode,
	validateRuntime,
	getErrorMessage,
	isGloballyLinked,
	getExecutionConfigForMode,
	debugLog,
};
