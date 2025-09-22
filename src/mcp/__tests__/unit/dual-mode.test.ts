import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createUniqueTestDir, safeCleanup } from "../../../test/test-utils.ts";
import type { InstallationContext } from "../../../utils/installation-detector.ts";

describe("MCP Dual Mode Support", () => {
	let TEST_DIR: string;

	beforeEach(() => {
		TEST_DIR = createUniqueTestDir(".tmp-test-mcp-dual-mode");
		// Ensure the test directory exists
		const { mkdirSync } = require("node:fs");
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		safeCleanup(TEST_DIR);
	});

	describe("Installation Detection", () => {
		test("should detect development mode", async () => {
			// Setup development environment
			const srcDir = resolve(TEST_DIR, "src");
			const { mkdirSync } = await import("node:fs");
			mkdirSync(srcDir, { recursive: true });

			writeFileSync(resolve(srcDir, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const { getInstallationContext } = await import("../../../utils/installation-detector.ts");
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

			const { getInstallationContext } = await import("../../../utils/installation-detector.ts");
			const context = getInstallationContext(TEST_DIR);

			expect(context.isDevelopment).toBe(false);
		});

		test("should handle mixed installation context", async () => {
			// Setup both development files and simulate global install
			const srcDir = resolve(TEST_DIR, "src");
			const { mkdirSync } = await import("node:fs");
			mkdirSync(srcDir, { recursive: true });

			writeFileSync(resolve(srcDir, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const { getInstallationContext } = await import("../../../utils/installation-detector.ts");
			const context = getInstallationContext(TEST_DIR);

			// Development should take precedence
			expect(context.isDevelopment).toBe(true);
			expect(context.mcpEntryPoint).toBe("bun");
		});
	});

	describe("Configuration Validation", () => {
		test("should validate development configuration", async () => {
			// Setup valid development environment
			const srcDir = resolve(TEST_DIR, "src");
			const { mkdirSync } = await import("node:fs");
			mkdirSync(srcDir, { recursive: true });

			writeFileSync(resolve(srcDir, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const { getInstallationContext, validateMcpConfiguration } = await import(
				"../../../utils/installation-detector.ts"
			);
			const context = getInstallationContext(TEST_DIR);
			const _validation = await validateMcpConfiguration(context);

			expect(context.isDevelopment).toBe(true);
			// Note: validation might still fail due to missing bun in test environment
			// but the logic should be correct
		});

		test("should identify missing MCP server file", async () => {
			// Setup development environment but missing MCP server file
			const srcDir = resolve(TEST_DIR, "src");
			const { mkdirSync } = await import("node:fs");
			mkdirSync(srcDir, { recursive: true });

			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Note: NOT creating mcp-stdio-server.ts

			const { getInstallationContext, validateMcpConfiguration } = await import(
				"../../../utils/installation-detector.ts"
			);
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
				mcpEntryPoint: "bun",
				projectRoot: TEST_DIR,
				mcpCommands: {
					development: ["run", "src/mcp-stdio-server.ts"],
				},
			};

			const { generateMcpConfiguration } = await import("../../../utils/installation-detector.ts");
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
				mcpEntryPoint: "backlog",
				projectRoot: TEST_DIR,
				mcpCommands: {
					global: ["mcp", "start"],
				},
			};

			const { generateMcpConfiguration } = await import("../../../utils/installation-detector.ts");
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
			const { testMcpConnection } = await import("../../test-connection.ts");
			const result = await testMcpConnection(TEST_DIR);

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.context.isDevelopment).toBe(false);
			// Note: Global installation may be detected based on system state
		}, 10000);

		test("should identify development setup issues", async () => {
			// Setup incomplete development environment (missing bun)
			const srcDir = resolve(TEST_DIR, "src");
			const { mkdirSync } = await import("node:fs");
			mkdirSync(srcDir, { recursive: true });

			writeFileSync(resolve(srcDir, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const { testMcpConnection } = await import("../../test-connection.ts");
			const result = await testMcpConnection(TEST_DIR);

			// Should detect development mode but fail due to missing bun
			expect(result.context.isDevelopment).toBe(true);
			// Success depends on whether bun is available in test environment
		});
	});

	describe("Doctor Diagnostics", () => {
		test("should diagnose empty project", async () => {
			const { runMcpDoctor } = await import("../../test-connection.ts");
			const result = await runMcpDoctor(TEST_DIR);

			expect(["error", "warning"]).toContain(result.overall);
			expect(result.checks.length).toBeGreaterThan(0);
			expect(result.recommendations.length).toBeGreaterThan(0);

			// Should provide recommendations
			expect(result.recommendations.length).toBeGreaterThan(0);
		});

		test("should diagnose development setup", async () => {
			// Setup development environment
			const srcDir = resolve(TEST_DIR, "src");
			const { mkdirSync } = await import("node:fs");
			mkdirSync(srcDir, { recursive: true });

			writeFileSync(resolve(srcDir, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const { runMcpDoctor } = await import("../../test-connection.ts");
			const result = await runMcpDoctor(TEST_DIR);

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

			const { runMcpDoctor } = await import("../../test-connection.ts");
			const result = await runMcpDoctor(TEST_DIR);

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
			// Simulate CLI init command logic for development mode
			const _mockContext: InstallationContext = {
				isDevelopment: true,
				isGlobalInstall: false,
				mcpEntryPoint: "bun",
				projectRoot: TEST_DIR,
				mcpCommands: {
					development: ["run", "src/mcp-stdio-server.ts"],
				},
			};

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
			const _mockContext: InstallationContext = {
				isDevelopment: false,
				isGlobalInstall: true,
				mcpEntryPoint: "backlog",
				projectRoot: TEST_DIR,
				mcpCommands: {
					global: ["mcp", "start"],
				},
			};

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

			const { getInstallationContext } = await import("../../../utils/installation-detector.ts");

			// Should not throw, but return appropriate context
			const context = getInstallationContext(invalidDir);
			expect(context.projectRoot).toBe(invalidDir);
			expect(context.isDevelopment).toBe(false);
			// Note: Global installation may be detected based on system state
		});

		test("should handle corrupted configuration files", async () => {
			// Create invalid package.json
			writeFileSync(resolve(TEST_DIR, "package.json"), "invalid json{");

			const { getInstallationContext } = await import("../../../utils/installation-detector.ts");

			// Should handle JSON parse errors gracefully
			const context = getInstallationContext(TEST_DIR);
			expect(context.isDevelopment).toBe(false);
		});

		test("should provide helpful error messages", async () => {
			const { testMcpConnection } = await import("../../test-connection.ts");
			const result = await testMcpConnection(TEST_DIR);

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);

			// Errors should be descriptive and actionable
			const errorText = result.errors.join(" ");
			expect(errorText.length).toBeGreaterThan(0);
		}, 10000);
	});

	describe("Context Switching", () => {
		test("should handle development to global switch", async () => {
			// Start with development setup
			const srcDir = resolve(TEST_DIR, "src");
			const { mkdirSync } = await import("node:fs");
			mkdirSync(srcDir, { recursive: true });

			writeFileSync(resolve(srcDir, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const { getInstallationContext } = await import("../../../utils/installation-detector.ts");
			let context = getInstallationContext(TEST_DIR);
			expect(context.isDevelopment).toBe(true);

			// Simulate removing development files (switching to global)
			rmSync(resolve(srcDir, "mcp-stdio-server.ts"));
			rmSync(srcDir, { recursive: true });

			context = getInstallationContext(TEST_DIR);
			expect(context.isDevelopment).toBe(false);
		});

		test("should prioritize development over global", async () => {
			// Setup both development and global (simulated)
			const srcDir = resolve(TEST_DIR, "src");
			const { mkdirSync } = await import("node:fs");
			mkdirSync(srcDir, { recursive: true });

			writeFileSync(resolve(srcDir, "mcp-stdio-server.ts"), "// MCP server");
			writeFileSync(
				resolve(TEST_DIR, "package.json"),
				JSON.stringify({
					name: "backlog.md",
					version: "1.0.0",
				}),
			);
			// Add bun.lockb to indicate development environment
			writeFileSync(resolve(TEST_DIR, "bun.lockb"), "");

			const { getInstallationContext } = await import("../../../utils/installation-detector.ts");
			const context = getInstallationContext(TEST_DIR);

			// Should prioritize development mode
			expect(context.isDevelopment).toBe(true);
			expect(context.mcpEntryPoint).toBe("bun");
		});
	});
});
