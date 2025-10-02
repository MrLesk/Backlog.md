import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createUniqueTestDir } from "./test-utils.ts";

export interface TestEnvironment {
	dir: string;
	type: "development" | "global" | "empty";
	cleanup: () => void;
}

/**
 * Creates a complete development environment for testing MCP
 */
export function setupDevelopmentEnvironment(name?: string): TestEnvironment {
	const testDir = createUniqueTestDir(name || ".tmp-test-mcp-dev");

	// Create directory structure
	mkdirSync(testDir, { recursive: true });

	// Create src directory with MCP server
	const srcDir = resolve(testDir, "src");
	mkdirSync(srcDir, { recursive: true });

	writeFileSync(
		resolve(srcDir, "mcp-stdio-server.ts"),
		`#!/usr/bin/env bun
/**
 * Test MCP stdio server entry point
 */

import { McpServer } from "./mcp/server.ts";

async function main() {
	try {
		const projectRoot = process.env.BACKLOG_PROJECT_ROOT || process.cwd();
		const mcpServer = new McpServer(projectRoot);

		// Connect via stdio transport
		await mcpServer.connect("stdio");
		await mcpServer.start();

		console.error("Test MCP server started via stdio transport");

		// Handle graceful shutdown
		const shutdown = async (signal: string) => {
			console.error(\`Received \${signal}, shutting down...\`);
			await mcpServer.stop();
			process.exit(0);
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));

	} catch (error) {
		console.error("Failed to start test MCP server:", error);
		process.exit(1);
	}
}

if (import.meta.main) {
	main();
}
`,
	);

	// Create package.json
	writeFileSync(
		resolve(testDir, "package.json"),
		JSON.stringify(
			{
				name: "backlog.md-test",
				version: "1.0.0",
				type: "module",
				dependencies: {
					"@modelcontextprotocol/sdk": "^1.18.0",
				},
			},
			null,
			2,
		),
	);

	// Create bun.lockb (empty file to indicate Bun usage)
	writeFileSync(resolve(testDir, "bun.lockb"), "");

	// Create node_modules directory structure
	const nodeModulesDir = resolve(testDir, "node_modules");
	mkdirSync(nodeModulesDir, { recursive: true });

	return {
		dir: testDir,
		type: "development",
		cleanup: () => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		},
	};
}

/**
 * Creates a global installation environment for testing MCP
 */
export function setupGlobalEnvironment(name?: string): TestEnvironment {
	const testDir = createUniqueTestDir(name || ".tmp-test-mcp-global");

	// Create directory structure (no src directory)
	mkdirSync(testDir, { recursive: true });

	// Create minimal project files but NO src directory
	writeFileSync(
		resolve(testDir, "package.json"),
		JSON.stringify(
			{
				name: "test-project",
				version: "1.0.0",
			},
			null,
			2,
		),
	);

	// Create .gitignore but no development files
	writeFileSync(resolve(testDir, ".gitignore"), "node_modules/\n");

	return {
		dir: testDir,
		type: "global",
		cleanup: () => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		},
	};
}

/**
 * Creates an empty environment (no installation detected)
 */
export function setupEmptyEnvironment(name?: string): TestEnvironment {
	const testDir = createUniqueTestDir(name || ".tmp-test-mcp-empty");

	// Create completely empty directory
	mkdirSync(testDir, { recursive: true });

	return {
		dir: testDir,
		type: "empty",
		cleanup: () => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		},
	};
}

/**
 * Creates a minimal backlog.md project structure without CLI interaction
 */
export function setupBacklogProject(testDir: string): void {
	// Create backlog directory structure
	const backlogDir = resolve(testDir, "backlog");
	const tasksDir = resolve(testDir, "backlog", "tasks");

	mkdirSync(tasksDir, { recursive: true });

	// Create .backlogrc config file
	writeFileSync(
		resolve(backlogDir, ".backlogrc"),
		JSON.stringify(
			{
				version: "1.0.0",
				created: new Date().toISOString(),
			},
			null,
			2,
		),
	);

	// Create a sample task
	writeFileSync(
		resolve(tasksDir, "task-001.md"),
		`---
id: task-001
title: Sample task
status: To Do
created_date: '2025-01-15 10:00'
labels: []
assignee: []
---

# Sample task

This is a sample task for testing purposes.

## Acceptance Criteria

- [ ] Task should be visible in the board
- [ ] Task should be manageable via MCP
`,
	);

	// Create git repository
	mkdirSync(resolve(testDir, ".git"), { recursive: true });
	writeFileSync(resolve(testDir, ".git", "config"), "[core]\n\trepositoryformatversion = 0\n");
}

/**
 * Creates MCP wrapper script in test environment
 */
export function setupMcpWrapper(testDir: string): void {
	const scriptsDir = resolve(testDir, "scripts");
	mkdirSync(scriptsDir, { recursive: true });

	// Copy the actual wrapper script content
	const wrapperContent = `#!/usr/bin/env node
/**
 * Test MCP Server Wrapper Script
 */

const { spawn } = require("node:child_process");
const { resolve } = require("node:path");
const { existsSync } = require("node:fs");

async function main() {
	try {
		const projectRoot = process.env.BACKLOG_PROJECT_ROOT || process.cwd();
		const context = detectInstallationContext(projectRoot);

		console.error(\`🔧 Test MCP Wrapper: \${context.description}\`);
		console.error(\`📁 Project root: \${projectRoot}\`);

		await startMcpServer(context, projectRoot);
	} catch (error) {
		console.error("❌ Failed to start MCP server:", error.message);
		process.exit(1);
	}
}

function detectInstallationContext(projectRoot) {
	const isDevelopment = detectDevelopmentMode(projectRoot);

	if (isDevelopment) {
		return {
			mode: "development",
			description: "Development mode (running from source)",
			command: "echo",
			args: ["Test development mode MCP server"],
		};
	}

	return {
		mode: "global",
		description: "Global installation",
		command: "echo",
		args: ["Test global mode MCP server"],
	};
}

function detectDevelopmentMode(projectRoot) {
	const srcDir = resolve(projectRoot, "src");
	const mcpServerTs = resolve(projectRoot, "src", "mcp-stdio-server.ts");
	const packageJson = resolve(projectRoot, "package.json");

	return existsSync(srcDir) && existsSync(mcpServerTs) && existsSync(packageJson);
}

function startMcpServer(context, projectRoot) {
	return new Promise((resolve, reject) => {
		const child = spawn(context.command, context.args, {
			env: { ...process.env, BACKLOG_PROJECT_ROOT: projectRoot },
			stdio: "inherit",
			cwd: projectRoot,
		});

		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(\`Process exited with code \${code}\`));
		});

		// Auto-resolve for test commands
		setTimeout(resolve, 1000);
	});
}

if (require.main === module) {
	main();
}
`;

	writeFileSync(resolve(scriptsDir, "mcp-server.cjs"), wrapperContent);
}

/**
 * Validates the test environment setup
 */
export function validateEnvironment(testEnv: TestEnvironment): {
	valid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check if directory exists
	if (!existsSync(testEnv.dir)) {
		errors.push("Test directory does not exist");
		return { valid: false, errors, warnings };
	}

	// Type-specific validations
	if (testEnv.type === "development") {
		const srcDir = resolve(testEnv.dir, "src");
		const mcpServer = resolve(testEnv.dir, "src", "mcp-stdio-server.ts");
		const packageJson = resolve(testEnv.dir, "package.json");

		if (!existsSync(srcDir)) {
			errors.push("Development environment missing src/ directory");
		}
		if (!existsSync(mcpServer)) {
			errors.push("Development environment missing MCP server file");
		}
		if (!existsSync(packageJson)) {
			errors.push("Development environment missing package.json");
		}
	} else if (testEnv.type === "global") {
		const srcDir = resolve(testEnv.dir, "src");

		if (existsSync(srcDir)) {
			warnings.push("Global environment has src/ directory (should not)");
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Simulates global backlog command availability
 */
export function mockGlobalBacklogCommand(available = true): {
	restore: () => void;
} {
	const originalPath = process.env.PATH;

	if (available) {
		// Add a mock backlog command to PATH
		const mockBinDir = resolve(process.cwd(), "test-bin");
		mkdirSync(mockBinDir, { recursive: true });

		// Create mock backlog script
		writeFileSync(
			resolve(mockBinDir, "backlog"),
			`#!/bin/bash
echo "Mock backlog v1.0.0"
if [ "$1" = "mcp" ] && [ "$2" = "start" ]; then
	echo "Mock MCP server starting..." >&2
	sleep 1
	echo "Mock MCP server started" >&2
fi
`,
		);

		// Make it executable
		const { chmodSync } = require("node:fs");
		chmodSync(resolve(mockBinDir, "backlog"), 0o755);

		process.env.PATH = `${mockBinDir}:${originalPath}`;

		return {
			restore: () => {
				process.env.PATH = originalPath;
				rmSync(mockBinDir, { recursive: true, force: true });
			},
		};
	}
	// Remove any backlog command from PATH
	const paths = originalPath?.split(":") || [];
	const filteredPaths = paths.filter((p) => !p.includes("backlog"));
	process.env.PATH = filteredPaths.join(":");

	return {
		restore: () => {
			process.env.PATH = originalPath;
		},
	};
}

/**
 * Runs a function with a clean environment
 */
export async function withCleanEnvironment<T>(fn: () => Promise<T> | T): Promise<T> {
	const originalCwd = process.cwd();
	const originalPath = process.env.PATH;
	const originalBacklogRoot = process.env.BACKLOG_PROJECT_ROOT;

	try {
		return await fn();
	} finally {
		// Restore original environment
		process.chdir(originalCwd);
		if (originalPath) process.env.PATH = originalPath;
		if (originalBacklogRoot) {
			process.env.BACKLOG_PROJECT_ROOT = originalBacklogRoot;
		} else {
			delete process.env.BACKLOG_PROJECT_ROOT;
		}
	}
}
