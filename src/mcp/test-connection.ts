import { spawn } from "node:child_process";
import { resolve as pathResolve } from "node:path";
import type { InstallationContext } from "../utils/installation-detector.ts";

export interface McpTestResult {
	success: boolean;
	context: InstallationContext;
	errors: string[];
	warnings: string[];
	tools: string[];
	resources: string[];
	prompts: string[];
	serverInfo?: {
		version: string;
		transport: string;
		startupTime: number;
	};
}

export interface McpDoctorResult {
	overall: "healthy" | "warning" | "error";
	checks: Array<{
		name: string;
		status: "pass" | "warn" | "fail";
		message: string;
		suggestion?: string;
	}>;
	context: InstallationContext;
	recommendations: string[];
}

/**
 * Tests MCP server connection and functionality
 */
export async function testMcpConnection(projectRoot?: string): Promise<McpTestResult> {
	const startTime = Date.now();
	const root = projectRoot || process.cwd();

	try {
		// Get installation context
		const { getInstallationContext, validateMcpConfiguration } = await import("../utils/installation-detector.ts");
		const context = getInstallationContext(root);

		// Validate configuration
		const validation = await validateMcpConfiguration(context);
		if (!validation.valid) {
			return {
				success: false,
				context,
				errors: validation.errors,
				warnings: validation.warnings,
				tools: [],
				resources: [],
				prompts: [],
			};
		}

		// Test server startup
		const serverTest = await testServerStartup(context);
		const startupTime = Date.now() - startTime;

		return {
			success: serverTest.success,
			context,
			errors: [...(validation.errors || []), ...(serverTest.errors || [])],
			warnings: [...(validation.warnings || []), ...(serverTest.warnings || [])],
			tools: serverTest.tools,
			resources: serverTest.resources,
			prompts: serverTest.prompts,
			serverInfo: serverTest.success
				? {
						version: "1.0.0",
						transport: "stdio",
						startupTime,
					}
				: undefined,
		};
	} catch (error) {
		return {
			success: false,
			context: {
				isGlobalInstall: false,
				isDevelopment: false,
				isBacklogProject: false,
				mcpEntryPoint: "unknown",
				projectRoot: root,
				mcpCommands: {},
			},
			errors: [`Failed to test MCP connection: ${error instanceof Error ? error.message : String(error)}`],
			warnings: [],
			tools: [],
			resources: [],
			prompts: [],
		};
	}
}

/**
 * Performs comprehensive MCP diagnostics
 */
export async function runMcpDoctor(projectRoot?: string): Promise<McpDoctorResult> {
	const root = projectRoot || process.cwd();
	const checks: McpDoctorResult["checks"] = [];
	const recommendations: string[] = [];

	try {
		// Get installation context
		const { getInstallationContext, validateMcpConfiguration } = await import("../utils/installation-detector.ts");
		const context = getInstallationContext(root);

		// Check 1: Installation Context
		if (context.isDevelopment && context.isGlobalInstall) {
			checks.push({
				name: "Installation Context",
				status: "warn",
				message: "Both development and global installations detected",
				suggestion: "Development mode will be used. This is typically fine for development.",
			});
		} else if (context.isDevelopment) {
			checks.push({
				name: "Installation Context",
				status: "pass",
				message: "Development mode detected (running from source)",
			});
		} else if (context.isGlobalInstall) {
			checks.push({
				name: "Installation Context",
				status: "pass",
				message: "Global installation detected",
			});
		} else {
			checks.push({
				name: "Installation Context",
				status: "fail",
				message: "No suitable installation found",
				suggestion: "Either run from project source or install globally with 'npm i -g backlog.md'",
			});
		}

		// Check 2: Configuration Validation
		const validation = await validateMcpConfiguration(context);
		if (validation.valid) {
			checks.push({
				name: "MCP Configuration",
				status: "pass",
				message: "MCP configuration is valid",
			});
		} else {
			checks.push({
				name: "MCP Configuration",
				status: "fail",
				message: `Configuration errors: ${validation.errors.join(", ")}`,
				suggestion: "Fix configuration issues before proceeding",
			});
		}

		// Check 3: Project Structure
		const structureCheck = await checkProjectStructure(root);
		checks.push(structureCheck);

		// Check 4: MCP Server Files
		const serverCheck = await checkMcpServerFiles(context);
		checks.push(serverCheck);

		// Check 5: Runtime Dependencies
		const runtimeCheck = await checkRuntimeDependencies(context);
		checks.push(runtimeCheck);

		// Generate recommendations
		generateRecommendations(checks, recommendations, context);

		// Determine overall status
		const overall = determineOverallStatus(checks);

		return {
			overall,
			checks,
			context,
			recommendations,
		};
	} catch (error) {
		return {
			overall: "error",
			checks: [
				{
					name: "Doctor Execution",
					status: "fail",
					message: `Failed to run diagnostics: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			context: {
				isGlobalInstall: false,
				isDevelopment: false,
				isBacklogProject: false,
				mcpEntryPoint: "unknown",
				projectRoot: root,
				mcpCommands: {},
			},
			recommendations: ["Try running the doctor command from the project root directory"],
		};
	}
}

/**
 * Tests server startup and capabilities
 */
async function testServerStartup(context: InstallationContext): Promise<{
	success: boolean;
	errors: string[];
	warnings: string[];
	tools: string[];
	resources: string[];
	prompts: string[];
}> {
	return new Promise((resolve) => {
		// Use shorter timeout in test environment
		const timeoutMs =
			process.env.NODE_ENV === "test" || process.argv.some((arg) => arg.includes("test")) ? 2000 : 10000;
		const timeout = setTimeout(() => {
			resolve({
				success: false,
				errors: [`MCP server startup timed out after ${timeoutMs / 1000} seconds`],
				warnings: [],
				tools: [],
				resources: [],
				prompts: [],
			});
		}, timeoutMs);

		try {
			// Determine command and arguments
			let command: string;
			let args: string[];

			if (context.isDevelopment) {
				command = "bun";
				args = ["run", pathResolve(context.projectRoot, "src", "mcp-stdio-server.ts")];
			} else if (context.isGlobalInstall) {
				command = "backlog";
				args = ["mcp", "start"];
			} else {
				clearTimeout(timeout);
				resolve({
					success: false,
					errors: ["No suitable MCP entry point found"],
					warnings: [],
					tools: [],
					resources: [],
					prompts: [],
				});
				return;
			}

			// Start the server process for testing
			const child = spawn(command, args, {
				env: { ...process.env, BACKLOG_PROJECT_ROOT: context.projectRoot },
				stdio: ["pipe", "pipe", "pipe"],
				cwd: context.projectRoot,
			});

			let stdout = "";
			let stderr = "";

			child.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			child.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			// Give the server a moment to start, then kill it
			const killTimeoutMs =
				process.env.NODE_ENV === "test" || process.argv.some((arg) => arg.includes("test")) ? 500 : 2000;
			setTimeout(() => {
				child.kill("SIGTERM");
			}, killTimeoutMs);

			child.on("close", (code) => {
				clearTimeout(timeout);

				// Parse startup messages to determine success
				const success = stderr.includes("MCP server started") || stderr.includes("Backlog.md MCP server");
				const errors: string[] = [];
				const warnings: string[] = [];

				if (!success) {
					if (code !== 0) {
						errors.push(`Server exited with code ${code}`);
					}
					if (stderr.includes("Error") || stderr.includes("error")) {
						errors.push("Server reported errors during startup");
					}
					if (!stderr && !stdout) {
						errors.push("Server produced no output");
					}
				}

				// Mock tool/resource/prompt discovery for now
				// In a real implementation, this would parse server capabilities
				const tools = success ? ["task_create", "task_list", "task_update", "board_view", "config_get"] : [];
				const resources = success ? ["task/{id}", "board/current", "config/current"] : [];
				const prompts = success ? ["task_creation_workflow", "sprint_planning"] : [];

				resolve({
					success,
					errors,
					warnings,
					tools,
					resources,
					prompts,
				});
			});

			child.on("error", (error) => {
				clearTimeout(timeout);
				resolve({
					success: false,
					errors: [`Failed to start server: ${error.message}`],
					warnings: [],
					tools: [],
					resources: [],
					prompts: [],
				});
			});
		} catch (error) {
			clearTimeout(timeout);
			resolve({
				success: false,
				errors: [`Test setup failed: ${error instanceof Error ? error.message : String(error)}`],
				warnings: [],
				tools: [],
				resources: [],
				prompts: [],
			});
		}
	});
}

/**
 * Checks project structure for backlog.md compatibility
 */
async function checkProjectStructure(projectRoot: string): Promise<McpDoctorResult["checks"][0]> {
	try {
		const { existsSync } = await import("node:fs");

		// Check for essential backlog.md project files
		const backlogDir = pathResolve(projectRoot, "backlog");
		const tasksDir = pathResolve(projectRoot, "backlog", "tasks");

		// Check if essential directories exist
		const hasBacklogDir = existsSync(backlogDir);
		const hasTasksDir = existsSync(tasksDir);

		if (hasBacklogDir && hasTasksDir) {
			return {
				name: "Project Structure",
				status: "pass",
				message: "Valid backlog.md project detected",
			};
		}

		if (hasBacklogDir) {
			return {
				name: "Project Structure",
				status: "warn",
				message: "Incomplete backlog.md project structure",
				suggestion: "Run 'backlog init' to complete the project setup",
			};
		}

		return {
			name: "Project Structure",
			status: "warn",
			message: "Not a backlog.md project",
			suggestion: "Run 'backlog init' to initialize the project structure",
		};
	} catch (error) {
		return {
			name: "Project Structure",
			status: "fail",
			message: `Failed to check project structure: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Checks MCP server files existence
 */
async function checkMcpServerFiles(context: InstallationContext): Promise<McpDoctorResult["checks"][0]> {
	if (context.isDevelopment) {
		const serverPath = pathResolve(context.projectRoot, "src", "mcp-stdio-server.ts");
		const { existsSync } = await import("node:fs");

		if (existsSync(serverPath)) {
			return {
				name: "MCP Server Files",
				status: "pass",
				message: "MCP server source file found",
			};
		}

		return {
			name: "MCP Server Files",
			status: "fail",
			message: "MCP server source file missing",
			suggestion: "Ensure src/mcp-stdio-server.ts exists",
		};
	}

	return {
		name: "MCP Server Files",
		status: "pass",
		message: "Using global installation (no source files needed)",
	};
}

/**
 * Checks runtime dependencies
 */
async function checkRuntimeDependencies(context: InstallationContext): Promise<McpDoctorResult["checks"][0]> {
	if (context.isDevelopment) {
		try {
			const { execSync } = await import("node:child_process");
			execSync("bun --version", { stdio: "pipe", timeout: 3000 });
			return {
				name: "Runtime Dependencies",
				status: "pass",
				message: "Bun runtime available",
			};
		} catch {
			return {
				name: "Runtime Dependencies",
				status: "fail",
				message: "Bun runtime not found",
				suggestion: "Install Bun from https://bun.sh",
			};
		}
	}

	if (context.isGlobalInstall) {
		try {
			const { execSync } = await import("node:child_process");
			execSync("backlog --version", { stdio: "pipe", timeout: 3000 });
			return {
				name: "Runtime Dependencies",
				status: "pass",
				message: "Global backlog command available",
			};
		} catch {
			return {
				name: "Runtime Dependencies",
				status: "fail",
				message: "Global backlog command not found",
				suggestion: "Install with 'npm i -g backlog.md'",
			};
		}
	}

	return {
		name: "Runtime Dependencies",
		status: "fail",
		message: "No suitable runtime found",
	};
}

/**
 * Generates recommendations based on check results
 */
function generateRecommendations(
	checks: McpDoctorResult["checks"],
	recommendations: string[],
	context: InstallationContext,
): void {
	const failedChecks = checks.filter((c) => c.status === "fail");
	const warningChecks = checks.filter((c) => c.status === "warn");

	if (failedChecks.length === 0 && warningChecks.length === 0) {
		recommendations.push("✅ Your MCP setup looks great! No action needed.");
		return;
	}

	if (failedChecks.length > 0) {
		recommendations.push("🔧 Fix the following critical issues:");
		for (const check of failedChecks) {
			if (check.suggestion) {
				recommendations.push(`   • ${check.suggestion}`);
			}
		}
	}

	if (warningChecks.length > 0) {
		recommendations.push("⚠️  Consider addressing these warnings:");
		for (const check of warningChecks) {
			if (check.suggestion) {
				recommendations.push(`   • ${check.suggestion}`);
			}
		}
	}

	// Context-specific recommendations
	if (!context.isDevelopment && !context.isGlobalInstall) {
		recommendations.push("🚀 Get started with MCP:");
		recommendations.push("   • For development: Run from project with source code");
		recommendations.push("   • For production: Install globally with 'npm i -g backlog.md'");
	}

	if (context.isDevelopment) {
		recommendations.push("💡 Development tips:");
		recommendations.push("   • Use 'bun test src/mcp' to run MCP tests");
		recommendations.push("   • Check 'docs/mcp/README.md' for detailed documentation");
	}
}

/**
 * Determines overall status from individual checks
 */
function determineOverallStatus(checks: McpDoctorResult["checks"]): "healthy" | "warning" | "error" {
	const hasErrors = checks.some((c) => c.status === "fail");
	const hasWarnings = checks.some((c) => c.status === "warn");

	if (hasErrors) return "error";
	if (hasWarnings) return "warning";
	return "healthy";
}
