#!/usr/bin/env node

const { spawn } = require("node:child_process");
const { detectExecutionMode, validateRuntime, getErrorMessage, debugLog } = require("./detection.cjs");

/**
 * Smart CLI wrapper for Backlog.md
 * Automatically detects execution context and uses appropriate runtime
 */

function main() {
	try {
		// Detect the appropriate execution mode
		const config = detectExecutionMode();
		debugLog(`Detected execution mode: ${config.mode}`);
		debugLog(`Command: ${config.command}`);
		debugLog(`Args: ${JSON.stringify(config.args)}`);

		// Validate runtime availability
		if (!validateRuntime(config)) {
			throw new Error(`Runtime not available for mode: ${config.mode}`);
		}

		// Prepare arguments
		const rawArgs = process.argv.slice(2);
		const commandArgs = [...config.args, ...rawArgs];

		// Clean up unexpected args some global shims pass (e.g. bun)
		const cleanedArgs = commandArgs.filter((arg) => {
			// Filter the command itself if it appears in args
			if (arg === config.command) return false;

			// Filter any accidental deep path to our platform package binary
			try {
				const pattern = /node_modules[/\\]backlog\.md-(darwin|linux|windows)-[^/\\]+[/\\]backlog(\.exe)?$/i;
				return !pattern.test(arg);
			} catch {
				return true;
			}
		});

		debugLog(`Final command: ${config.command}`);
		debugLog(`Final args: ${JSON.stringify(cleanedArgs)}`);

		// Spawn the appropriate runtime
		const child = spawn(config.command, cleanedArgs, {
			stdio: "inherit",
			windowsHide: true,
		});

		// Handle exit
		child.on("exit", (code) => {
			process.exit(code || 0);
		});

		// Handle errors
		child.on("error", (err) => {
			// Try automatic fallback for built mode failures
			if (config.mode === "built" && err.code === "ENOENT") {
				debugLog("Built binary failed, attempting fallback to development mode");
				console.error("⚠️  Built binary failed, trying development mode...");
				try {
					fallbackToDevelopmentMode();
					return;
				} catch (fallbackError) {
					debugLog(`Fallback failed: ${fallbackError.message}`);
				}
			}
			handleSpawnError(err, config);
		});
	} catch (error) {
		// Fallback to legacy behavior if smart detection fails
		debugLog(`Smart detection failed: ${error.message}`);

		if (process.env.BACKLOG_SMART_CLI !== "false") {
			console.error(`Smart CLI detection failed: ${getErrorMessage(null, error)}`);
			console.error("Falling back to legacy mode...");

			try {
				legacyMain();
				return;
			} catch (legacyError) {
				console.error(`Legacy fallback also failed: ${legacyError.message}`);
			}
		}

		console.error(`Failed to start backlog: ${error.message}`);
		process.exit(1);
	}
}

function handleSpawnError(err, config) {
	debugLog(`Spawn error: ${err.code} - ${err.message}`);

	if (err.code === "ENOENT") {
		if (config.mode.startsWith("development")) {
			console.error("❌ Bun runtime not found.");
			console.error("💡 Please install Bun: curl -fsSL https://bun.sh/install | bash");
			console.error("💡 Or build the project: bun run build");
			console.error("💡 Or force built mode: BACKLOG_EXECUTION_MODE=built backlog");
		} else if (config.mode.startsWith("built")) {
			console.error(`❌ Built binary not found: ${config.command}`);
			console.error("💡 Try building the project: bun run build");
			console.error("💡 Or use development mode: BACKLOG_EXECUTION_MODE=development backlog");
		} else {
			console.error(`❌ Binary not found: ${config.command}`);
			console.error(
				`💡 Please ensure you have the correct version for your platform (${process.platform}-${process.arch})`,
			);
		}
	} else if (err.message?.includes("unknown command")) {
		console.error("❌ CLI execution failed with 'unknown command' error");
		console.error("💡 This often happens when the built binary is incompatible or corrupted");
		console.error("💡 Try development mode: BACKLOG_EXECUTION_MODE=development backlog");
		console.error("💡 Or rebuild: bun run build");
	} else {
		console.error(`❌ Failed to start backlog: ${err.message}`);
		console.error(`🔍 Mode: ${config.mode}, Command: ${config.command}`);
	}

	// Suggest automatic fallback
	if (config.mode.startsWith("built") && !config.mode.includes("manual")) {
		console.error("💡 Tip: Enable debug mode to see detection logic: BACKLOG_DEBUG=true backlog");
	}

	process.exit(1);
}

/**
 * Fallback to development mode when built binary fails
 */
function fallbackToDevelopmentMode() {
	const { resolve } = require("node:path");
	const scriptRealPath = require("node:fs").realpathSync(__filename);
	const projectRoot = resolve(scriptRealPath, "../..");
	const srcCliPath = resolve(projectRoot, "src/cli.ts");

	// Check if we can use development mode
	if (!require("node:fs").existsSync(srcCliPath)) {
		throw new Error("Source files not available for fallback");
	}

	debugLog("Fallback: Using development mode");
	const rawArgs = process.argv.slice(2);
	const child = spawn("bun", [srcCliPath, ...rawArgs], {
		stdio: "inherit",
		windowsHide: true,
	});

	child.on("exit", (code) => {
		process.exit(code || 0);
	});

	child.on("error", (err) => {
		if (err.code === "ENOENT") {
			console.error("❌ Fallback failed: Bun runtime not found");
			console.error("💡 Please install Bun: curl -fsSL https://bun.sh/install | bash");
		} else {
			console.error(`❌ Fallback failed: ${err.message}`);
		}
		process.exit(1);
	});
}

/**
 * Legacy behavior for fallback scenarios
 */
function legacyMain() {
	const { resolveBinaryPath } = require("./resolveBinary.cjs");

	let binaryPath;
	try {
		binaryPath = resolveBinaryPath();
	} catch {
		throw new Error(`Binary package not installed for ${process.platform}-${process.arch}.`);
	}

	// Clean up unexpected args
	const rawArgs = process.argv.slice(2);
	const cleanedArgs = rawArgs.filter((arg) => {
		if (arg === binaryPath) return false;
		try {
			const pattern = /node_modules[/\\]backlog\.md-(darwin|linux|windows)-[^/\\]+[/\\]backlog(\.exe)?$/i;
			return !pattern.test(arg);
		} catch {
			return true;
		}
	});

	// Spawn the binary
	const child = spawn(binaryPath, cleanedArgs, {
		stdio: "inherit",
		windowsHide: true,
	});

	child.on("exit", (code) => {
		process.exit(code || 0);
	});

	child.on("error", (err) => {
		if (err.code === "ENOENT") {
			console.error(`Binary not found: ${binaryPath}`);
			console.error(
				`Please ensure you have the correct version for your platform (${process.platform}-${process.arch})`,
			);
		} else {
			console.error("Failed to start backlog:", err);
		}
		process.exit(1);
	});
}

// Start the CLI
main();
