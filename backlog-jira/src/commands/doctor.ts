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

async function checkConfigFile(): Promise<void> {
	const configPath = join(process.cwd(), ".backlog-jira", "config.json");
	if (!existsSync(configPath)) {
		throw new Error("Config file not found. Run 'backlog-jira init' first.");
	}
	logger.info("  ✓ Configuration file exists");
}

export async function doctorCommand(): Promise<void> {
	logger.info("Running environment checks...\n");

	const checks = [
		{ name: "Bun runtime", fn: checkBunRuntime },
		{ name: "Backlog CLI", fn: checkBacklogCLI },
		{ name: "Configuration", fn: checkConfigFile },
		{ name: "Database", fn: checkDatabasePerms },
		{ name: "Backlog.md project", fn: checkMCPServer },
		{ name: "Git status", fn: checkGitStatus },
	];

	let allPassed = true;

	for (const check of checks) {
		try {
			await check.fn();
		} catch (error) {
			logger.error(`  ✗ ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
			allPassed = false;
		}
	}

	logger.info("");

	if (!allPassed) {
		logger.error("Some checks failed. Please fix the issues above before proceeding.");
		process.exit(1);
	}

	logger.info("✓ All checks passed! Ready to sync.");
}
