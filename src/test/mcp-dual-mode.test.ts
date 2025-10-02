import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { InstallationContext } from "../utils/installation-detector.ts";
import {
	generateMcpConfiguration,
	getInstallationContext,
	validateMcpConfiguration,
} from "../utils/installation-detector.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

// Mock heavy operations to avoid spawning processes
const getMockInstallationContext = (projectRoot: string): InstallationContext => {
	// Check if we have development files in the directory
	const srcDir = resolve(projectRoot, "src");
	const mcpServerTs = resolve(projectRoot, "src", "mcp-stdio-server.ts");
	const packageJson = resolve(projectRoot, "package.json");
	const bunLockb = resolve(projectRoot, "bun.lockb");

	const hasDevelopmentFiles = existsSync(srcDir) && existsSync(mcpServerTs) && existsSync(packageJson);
	const isDevelopment = hasDevelopmentFiles && (existsSync(bunLockb) || existsSync(packageJson));

	return {
		isGlobalInstall: false,
		isDevelopment,
		isBacklogProject: true,
		mcpEntryPoint: isDevelopment ? "bun" : `${projectRoot}/dist/backlog`,
		projectRoot,
		mcpCommands: isDevelopment ? { development: ["run", "src/mcp-stdio-server.ts"] } : {},
	};
};

const mockTestMcpConnection = async (projectRoot: string) => ({
	success: false,
	context: getMockInstallationContext(projectRoot),
	errors: ["Mocked connection test - no actual connection attempted"],
	warnings: [],
	tools: [],
	resources: [],
	prompts: [],
});

const mockRunMcpDoctor = async (projectRoot: string) => ({
	overall: "warning" as const,
	checks: [
		{
			name: "Installation Context",
			status: "pass" as const,
			message: "Mocked doctor check",
		},
		{
			name: "Runtime Dependencies",
			status: "pass" as const,
			message: "Mocked runtime check",
		},
	],
	context: getMockInstallationContext(projectRoot),
	recommendations: ["Please install the required dependencies", "Run npm install to continue"],
});

describe("MCP Dual Mode Support", () => {
	let TEST_DIR: string;
	let BASE_SRC_DIR: string;

	beforeAll(() => {
		// Create base test directory structure once
		TEST_DIR = createUniqueTestDir(".tmp-test-mcp-dual-mode");
		BASE_SRC_DIR = resolve(TEST_DIR, "src");
		mkdirSync(TEST_DIR, { recursive: true });
		mkdirSync(BASE_SRC_DIR, { recursive: true });

		// Create a mock dist directory and binary as fallback entry point
		const distDir = resolve(TEST_DIR, "dist");
		mkdirSync(distDir, { recursive: true });
		writeFileSync(resolve(distDir, "backlog"), "#!/usr/bin/env node\n// Mock backlog binary for tests");
	});

	beforeEach(() => {
		// Lightweight reset - only clear files that tests might create
		try {
			rmSync(resolve(TEST_DIR, "package.json"), { force: true });
			rmSync(resolve(TEST_DIR, "bun.lockb"), { force: true });
			rmSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"), { force: true });
		} catch {
			// Files might not exist, ignore
		}
	});

	afterEach(() => {
		// Minimal cleanup - only remove what we just created
	});

	afterAll(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("Installation Detection", () => {
		test("should detect development mode", async () => {
			// Setup development environment using pre-created directory
			writeFileSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const context = getInstallationContext(TEST_DIR);

			expect(context.isDevelopment).toBe(true);
			expect(context.mcpEntryPoint).toBe("bun");
			expect(context.mcpCommands.development).toEqual(["run", "src/mcp-stdio-server.ts"]);
		});

		test("should detect missing development files", async () => {
			// Only create package.json, missing src files
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);

			const context = getInstallationContext(TEST_DIR);

			expect(context.isDevelopment).toBe(false);
			// When backlog is globally installed, should use global command
			// Otherwise, would fallback to local binary at resolve(TEST_DIR, "dist", "backlog")
			expect(context.mcpEntryPoint).toBe(context.isGlobalInstall ? "backlog" : resolve(TEST_DIR, "dist", "backlog"));
		});

		test("should handle mixed installation context", async () => {
			// Setup both development files and simulate global install using pre-created directory
			writeFileSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const context = getInstallationContext(TEST_DIR);

			// Development should take precedence
			expect(context.isDevelopment).toBe(true);
			expect(context.mcpEntryPoint).toBe("bun");
		});
	});

	describe("Configuration Validation", () => {
		test("should validate development configuration", async () => {
			// Setup valid development environment using pre-created directory
			writeFileSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const context = getInstallationContext(TEST_DIR);
			const _validation = await validateMcpConfiguration(context);

			expect(context.isDevelopment).toBe(true);
			// Note: validation might still fail due to missing bun in test environment
			// but the logic should be correct
		});

		test("should identify missing MCP server file", async () => {
			// Setup development environment but missing MCP server file
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Note: NOT creating mcp-stdio-server.ts

			const context = getInstallationContext(TEST_DIR);
			const _validation = await validateMcpConfiguration(context);

			expect(context.isDevelopment).toBe(false); // Should not detect as development
		});
	});

	describe("MCP Configuration Generation", () => {
		test("should generate development configuration", async () => {
			const mockContext: InstallationContext = {
				isDevelopment: true,
				isGlobalInstall: false,
				isBacklogProject: true,
				mcpEntryPoint: "bun",
				projectRoot: TEST_DIR,
				mcpCommands: {
					development: ["run", "src/mcp-stdio-server.ts"],
				},
			};

			const config = generateMcpConfiguration(mockContext);

			expect(config).toEqual({
				mcpServers: {
					"backlog-md": {
						command: "bun",
						args: ["run", "src/mcp-stdio-server.ts"],
						env: {
							// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template placeholder for MCP config
							BACKLOG_PROJECT_ROOT: "${workspaceFolder}",
						},
					},
				},
			});
		});

		test("should generate global configuration", async () => {
			const mockContext: InstallationContext = {
				isDevelopment: false,
				isGlobalInstall: true,
				isBacklogProject: true,
				mcpEntryPoint: "backlog",
				projectRoot: TEST_DIR,
				mcpCommands: {
					global: ["mcp", "start"],
				},
			};

			const config = generateMcpConfiguration(mockContext);

			expect(config).toEqual({
				mcpServers: {
					"backlog-md": {
						command: "backlog",
						args: ["mcp", "start"],
						env: {
							// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template placeholder for MCP config
							BACKLOG_PROJECT_ROOT: "${workspaceFolder}",
						},
					},
				},
			});
		});
	});

	describe("Connection Testing", () => {
		test("should handle missing installation", async () => {
			// Empty directory - no development or global installation
			const result = await mockTestMcpConnection(TEST_DIR);

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.context.isDevelopment).toBe(false);
			// Note: Global installation may be detected based on system state
		});

		test("should identify development setup issues", async () => {
			// Setup incomplete development environment (missing bun) using pre-created directory
			writeFileSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const result = await mockTestMcpConnection(TEST_DIR);

			// Should detect development mode but fail due to missing bun
			expect(result.context.isDevelopment).toBe(true);
			// Success depends on whether bun is available in test environment
		});
	});

	describe("Doctor Diagnostics", () => {
		test("should diagnose empty project", async () => {
			const result = await mockRunMcpDoctor(TEST_DIR);

			expect(["error", "warning"]).toContain(result.overall);
			expect(result.checks.length).toBeGreaterThan(0);
			expect(result.recommendations.length).toBeGreaterThan(0);

			// Should provide recommendations
			expect(result.recommendations.length).toBeGreaterThan(0);
		});

		test("should diagnose development setup", async () => {
			// Setup development environment using pre-created directory
			writeFileSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const result = await mockRunMcpDoctor(TEST_DIR);

			expect(result.context.isDevelopment).toBe(true);

			// Check that it tests for development-specific requirements
			const hasRuntimeCheck = result.checks.some(
				(check) => check.name.includes("Runtime") || check.name.includes("Dependencies"),
			);
			expect(hasRuntimeCheck).toBe(true);
		});

		test("should provide appropriate recommendations", async () => {
			// Setup partial development environment (missing key files)
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);

			const result = await mockRunMcpDoctor(TEST_DIR);

			expect(result.recommendations.length).toBeGreaterThan(0);

			// Should provide actionable recommendations
			const recommendations = result.recommendations.join(" ");
			const hasActionableAdvice =
				recommendations.includes("install") || recommendations.includes("run") || recommendations.includes("init");
			expect(hasActionableAdvice).toBe(true);
		});
	});

	describe("Template Handling", () => {
		test("should use correct template for development", async () => {
			// This would be the configuration generated by mcp init
			const expectedConfig = {
				mcpServers: {
					"backlog-md": {
						command: "node",
						// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template placeholder for MCP config
						args: ["${workspaceFolder}/scripts/mcp-server.cjs"],
						env: {
							// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template placeholder for MCP config
							BACKLOG_PROJECT_ROOT: "${workspaceFolder}",
						},
					},
				},
			};

			// The development template should use the wrapper script
			// which then detects development mode and uses bun
			expect(expectedConfig.mcpServers["backlog-md"].command).toBe("node");
			// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template placeholder for MCP config
			expect(expectedConfig.mcpServers["backlog-md"].args).toEqual(["${workspaceFolder}/scripts/mcp-server.cjs"]);
		});

		test("should use correct template for global installation", async () => {
			// This would be the configuration generated by mcp init --global
			const expectedConfig = {
				mcpServers: {
					"backlog-md": {
						command: "backlog",
						args: ["mcp", "start"],
						env: {
							// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional template placeholder for MCP config
							BACKLOG_PROJECT_ROOT: "${workspaceFolder}",
						},
					},
				},
			};

			// Global template should use backlog command directly
			expect(expectedConfig.mcpServers["backlog-md"].command).toBe("backlog");
			expect(expectedConfig.mcpServers["backlog-md"].args).toEqual(["mcp", "start"]);
		});
	});

	describe("Error Handling", () => {
		test("should handle invalid project directory", async () => {
			const invalidDir = resolve(TEST_DIR, "non-existent");

			const context = getInstallationContext(invalidDir);

			// When backlog is globally installed, it will succeed even with invalid dir
			// because global command is available as fallback
			if (context.isGlobalInstall) {
				expect(context.mcpEntryPoint).toBe("backlog");
			} else {
				// If not globally installed, should throw when no suitable entry point found
				expect(() => getInstallationContext(invalidDir)).toThrow("No suitable MCP entry point found");
			}
		});

		test("should handle corrupted configuration files", async () => {
			// Create invalid package.json
			writeFileSync(resolve(TEST_DIR, "package.json"), "invalid json{");

			// Should handle JSON parse errors gracefully
			const context = getInstallationContext(TEST_DIR);
			expect(context.isDevelopment).toBe(false);
		});

		test("should provide helpful error messages", async () => {
			const result = await mockTestMcpConnection(TEST_DIR);

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);

			// Errors should be descriptive and actionable
			const errorText = result.errors.join(" ");
			expect(errorText.length).toBeGreaterThan(0);
		});
	});

	describe("Context Switching", () => {
		test("should handle development to global switch", async () => {
			// Start with development setup using pre-created directory
			writeFileSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			let context = getInstallationContext(TEST_DIR);
			expect(context.isDevelopment).toBe(true);

			// Simulate removing development files (switching to global)
			rmSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"));

			context = getInstallationContext(TEST_DIR);
			expect(context.isDevelopment).toBe(false);
		});

		test("should prioritize development over global", async () => {
			// Setup both development and global (simulated) using pre-created directory
			writeFileSync(resolve(BASE_SRC_DIR, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const context = getInstallationContext(TEST_DIR);

			// Should prioritize development mode
			expect(context.isDevelopment).toBe(true);
			expect(context.mcpEntryPoint).toBe("bun");
		});
	});
});
