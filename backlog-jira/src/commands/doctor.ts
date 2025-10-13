import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SyncStore } from "../state/store.ts";
import { logger } from "../utils/logger.ts";

async function exec(command: string, args: string[] = []): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, {
			shell: false,
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		proc.stdout.on("data", (data) => {
			stdout += data;
		});
		proc.stderr.on("data", (data) => {
			stderr += data;
		});

		proc.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(`${command} failed: ${stderr}`));
			}
		});
	});
}

async function checkBunRuntime(): Promise<void> {
	const version = await exec("bun", ["--version"]);
	if (!version.startsWith("1.")) {
		throw new Error(`Bun 1.x required, found: ${version}`);
	}
	logger.info(`  ✓ Bun runtime: ${version}`);
}

async function checkBacklogCLI(): Promise<void> {
	const version = await exec("backlog", ["--version"]);
	logger.info(`  ✓ Backlog CLI: ${version}`);
}

async function checkMCPServer(): Promise<void> {
	// We'll actually test the MCP connection in the connect command
	// For now, just check if we're in a project with tasks
	const result = await exec("backlog", ["task", "list", "--plain"]);
	if (!result) {
		logger.warn("  ⚠ No tasks found. Make sure you're in a Backlog.md project directory.");
	} else {
		logger.info("  ✓ Backlog.md project detected");
	}
}

async function checkDatabasePerms(): Promise<void> {
	const configDir = join(process.cwd(), ".backlog-jira");
	if (!existsSync(configDir)) {
		throw new Error(".backlog-jira/ not found. Run 'backlog-jira init' first.");
	}

	const store = new SyncStore();
	store.testWriteAccess();
	store.close();
	logger.info("  ✓ Database permissions OK");
}

async function checkGitStatus(): Promise<void> {
	try {
		const status = await exec("git", ["status", "--porcelain"]);
		if (status.trim()) {
			logger.warn("  ⚠ Working directory has uncommitted changes");
		} else {
			logger.info("  ✓ Git working directory clean");
		}
	} catch (error) {
		logger.warn("  ⚠ Not a git repository");
	}
}

async function checkMCPConnectivity(): Promise<void> {
	try {
		// Try to list tasks via MCP (which uses the backlog CLI)
		const startTime = Date.now();
		const result = await exec("backlog", ["task", "list", "--plain", "-s", "To Do"]);
		const duration = Date.now() - startTime;
		
		if (duration > 5000) {
			logger.warn(`  ⚠ MCP response slow (${duration}ms). Consider optimizing task count.`);
		} else {
			logger.info(`  ✓ MCP connectivity OK (${duration}ms)`);
		}
	} catch (error) {
		throw new Error("Failed to connect to MCP server. Ensure backlog CLI is working.");
	}
}

async function checkNodeModules(): Promise<void> {
	const nodeModulesPath = join(process.cwd(), "node_modules");
	if (!existsSync(nodeModulesPath)) {
		throw new Error("node_modules not found. Run 'bun install' first.");
	}
	logger.info("  ✓ Dependencies installed");
}

async function checkDiskSpace(): Promise<void> {
	try {
		// Check available disk space (macOS/Linux)
		const result = await exec("df", ["-h", process.cwd()]);
		const lines = result.split("\n");
		if (lines.length > 1) {
			const parts = lines[1].split(/\s+/);
			const available = parts[3];
			logger.info(`  ✓ Disk space: ${available} available`);
		}
	} catch (error) {
		// Non-critical check, just log warning
		logger.warn("  ⚠ Could not check disk space");
	}
}

async function checkConfigFile(): Promise<void> {
	const configPath = join(process.cwd(), ".backlog-jira", "config.json");
	if (!existsSync(configPath)) {
		throw new Error("Config file not found. Run 'backlog-jira init' first.");
	}
	
	// Validate config structure
	try {
		const configContent = await Bun.file(configPath).text();
		const config = JSON.parse(configContent);
		
		const requiredFields = ["jiraProjectKey", "mcpServerName"];
		const missingFields = requiredFields.filter(field => !config[field]);
		
		if (missingFields.length > 0) {
			throw new Error(`Missing required config fields: ${missingFields.join(", ")}`);
		}
		
		logger.info("  ✓ Configuration file valid");
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error("Config file contains invalid JSON");
		}
		throw error;
	}
}

export async function doctorCommand(): Promise<void> {
	logger.info("Running environment checks...\n");

	const checks = [
		{ name: "Bun runtime", fn: checkBunRuntime, critical: true },
		{ name: "Backlog CLI", fn: checkBacklogCLI, critical: true },
		{ name: "Dependencies", fn: checkNodeModules, critical: true },
		{ name: "Configuration", fn: checkConfigFile, critical: true },
		{ name: "Database", fn: checkDatabasePerms, critical: true },
		{ name: "MCP Connectivity", fn: checkMCPConnectivity, critical: true },
		{ name: "Backlog.md project", fn: checkMCPServer, critical: false },
		{ name: "Git status", fn: checkGitStatus, critical: false },
		{ name: "Disk space", fn: checkDiskSpace, critical: false },
	];

	let criticalFailed = false;
	let warningCount = 0;

	for (const check of checks) {
		try {
			await check.fn();
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (check.critical) {
				logger.error(`  ✗ ${check.name}: ${errorMsg}`);
				criticalFailed = true;
			} else {
				logger.warn(`  ⚠ ${check.name}: ${errorMsg}`);
				warningCount++;
			}
		}
	}

	logger.info("");

	if (criticalFailed) {
		logger.error("Critical checks failed. Please fix the issues above before proceeding.");
		process.exit(1);
	}

	if (warningCount > 0) {
		logger.info(`✓ All critical checks passed! (${warningCount} warning${warningCount > 1 ? "s" : ""})`);
	} else {
		logger.info("✓ All checks passed! Ready to sync.");
	}
}
