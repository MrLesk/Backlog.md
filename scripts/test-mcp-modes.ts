#!/usr/bin/env bun
/**
 * Non-Interactive MCP Mode Testing Script
 *
 * Tests both development and global installation modes without requiring
 * interactive CLI commands or user input.
 */

import { resolve } from "node:path";
import { spawn } from "node:child_process";

// Import our test helpers
import {
	setupDevelopmentEnvironment,
	setupGlobalEnvironment,
	setupEmptyEnvironment,
	setupBacklogProject,
	setupMcpWrapper,
	validateEnvironment,
	mockGlobalBacklogCommand,
	withCleanEnvironment,
	type TestEnvironment
} from "../src/test/mcp-test-helpers.ts";

interface TestResult {
	name: string;
	passed: boolean;
	error?: string;
	duration: number;
	details?: Record<string, any>;
}

interface TestSuite {
	name: string;
	results: TestResult[];
	passed: number;
	failed: number;
	duration: number;
}

/**
 * Main test runner
 */
async function main() {
	const args = process.argv.slice(2);
	const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1];
	const verbose = args.includes('--verbose');

	console.log("🧪 Backlog.md MCP Mode Testing Suite");
	console.log("=====================================");
	console.log("");

	const suites: TestSuite[] = [];

	try {
		// Test 1: Development Mode
		if (!mode || mode === 'dev' || mode === 'development') {
			console.log("🔧 Testing Development Mode...");
			const devSuite = await testDevelopmentMode(verbose);
			suites.push(devSuite);
		}

		// Test 2: Global Mode
		if (!mode || mode === 'global') {
			console.log("\n📦 Testing Global Mode...");
			const globalSuite = await testGlobalMode(verbose);
			suites.push(globalSuite);
		}

		// Test 3: Mixed Scenarios
		if (!mode || mode === 'mixed') {
			console.log("\n🔄 Testing Mixed Scenarios...");
			const mixedSuite = await testMixedScenarios(verbose);
			suites.push(mixedSuite);
		}

		// Test 4: Error Handling
		if (!mode || mode === 'errors') {
			console.log("\n❌ Testing Error Handling...");
			const errorSuite = await testErrorHandling(verbose);
			suites.push(errorSuite);
		}

	} catch (error) {
		console.error("💥 Test runner failed:", error);
		process.exit(1);
	}

	// Print summary
	console.log("\n📊 Test Summary");
	console.log("================");

	let totalPassed = 0;
	let totalFailed = 0;
	let totalDuration = 0;

	for (const suite of suites) {
		const status = suite.failed === 0 ? "✅" : "❌";
		console.log(`${status} ${suite.name}: ${suite.passed}/${suite.passed + suite.failed} passed (${suite.duration}ms)`);

		if (verbose && suite.failed > 0) {
			for (const result of suite.results) {
				if (!result.passed) {
					console.log(`   ❌ ${result.name}: ${result.error}`);
				}
			}
		}

		totalPassed += suite.passed;
		totalFailed += suite.failed;
		totalDuration += suite.duration;
	}

	console.log("");
	console.log(`Total: ${totalPassed}/${totalPassed + totalFailed} tests passed`);
	console.log(`Duration: ${totalDuration}ms`);

	if (totalFailed > 0) {
		console.log("");
		console.log("💡 Some tests failed. Run with --verbose for details.");
		process.exit(1);
	}

	console.log("");
	console.log("🎉 All tests passed!");
}

/**
 * Tests development mode functionality
 */
async function testDevelopmentMode(verbose: boolean): Promise<TestSuite> {
	const startTime = Date.now();
	const results: TestResult[] = [];

	await withCleanEnvironment(async () => {
		// Test 1: Environment Setup
		results.push(await runTest("Development Environment Setup", async () => {
			const testEnv = setupDevelopmentEnvironment("dev-mode-test");
			const validation = validateEnvironment(testEnv);

			testEnv.cleanup();

			if (!validation.valid) {
				throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
			}

			return { environmentType: "development" };
		}));

		// Test 2: Installation Detection
		results.push(await runTest("Development Mode Detection", async () => {
			const testEnv = setupDevelopmentEnvironment("dev-detection");

			try {
				// Import and test installation detector
				const { getInstallationContext } = await import("../src/utils/installation-detector.ts");
				const context = getInstallationContext(testEnv.dir);

				if (!context.isDevelopment) {
					throw new Error("Failed to detect development mode");
				}

				if (context.mcpEntryPoint !== "bun") {
					throw new Error(`Expected 'bun' entry point, got '${context.mcpEntryPoint}'`);
				}

				return {
					detected: true,
					entryPoint: context.mcpEntryPoint,
					commands: context.mcpCommands
				};
			} finally {
				testEnv.cleanup();
			}
		}));

		// Test 3: Wrapper Script Behavior
		results.push(await runTest("Development Wrapper Script", async () => {
			const testEnv = setupDevelopmentEnvironment("dev-wrapper");

			try {
				setupMcpWrapper(testEnv.dir);

				// Test wrapper script execution
				const wrapperPath = resolve(testEnv.dir, "scripts", "mcp-server.cjs");
				const result = await runCommand("node", [wrapperPath], {
					cwd: testEnv.dir,
					env: { ...process.env, BACKLOG_PROJECT_ROOT: testEnv.dir },
					timeout: 5000
				});

				if (!result.stderr.includes("Development mode")) {
					throw new Error("Wrapper did not detect development mode");
				}

				return { wrapperWorked: true, output: result.stderr };
			} finally {
				testEnv.cleanup();
			}
		}));
	});

	const duration = Date.now() - startTime;
	const passed = results.filter(r => r.passed).length;
	const failed = results.length - passed;

	return {
		name: "Development Mode",
		results,
		passed,
		failed,
		duration
	};
}

/**
 * Tests global installation mode functionality
 */
async function testGlobalMode(verbose: boolean): Promise<TestSuite> {
	const startTime = Date.now();
	const results: TestResult[] = [];

	await withCleanEnvironment(async () => {
		// Test 1: Environment Setup
		results.push(await runTest("Global Environment Setup", async () => {
			const testEnv = setupGlobalEnvironment("global-mode-test");
			const validation = validateEnvironment(testEnv);

			testEnv.cleanup();

			if (!validation.valid) {
				throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
			}

			return { environmentType: "global" };
		}));

		// Test 2: Global Command Mock
		results.push(await runTest("Global Command Simulation", async () => {
			const mockCommand = mockGlobalBacklogCommand(true);

			try {
				// Test that mock backlog command is available
				const result = await runCommand("backlog", ["--version"], { timeout: 3000 });

				if (!result.stdout.includes("Mock backlog")) {
					throw new Error("Mock global backlog command not working");
				}

				return { mockWorking: true };
			} finally {
				mockCommand.restore();
			}
		}));

		// Test 3: Installation Detection
		results.push(await runTest("Global Mode Detection", async () => {
			const testEnv = setupGlobalEnvironment("global-detection");
			const mockCommand = mockGlobalBacklogCommand(true);

			try {
				const { getInstallationContext } = await import("../src/utils/installation-detector.ts");
				const context = getInstallationContext(testEnv.dir);

				// Should detect global installation (mocked)
				if (!context.isGlobalInstall) {
					throw new Error("Failed to detect global installation");
				}

				if (context.mcpEntryPoint !== "backlog") {
					throw new Error(`Expected 'backlog' entry point, got '${context.mcpEntryPoint}'`);
				}

				return {
					detected: true,
					entryPoint: context.mcpEntryPoint
				};
			} finally {
				testEnv.cleanup();
				mockCommand.restore();
			}
		}));
	});
	const duration = Date.now() - startTime;
	const passed = results.filter(r => r.passed).length;
	const failed = results.length - passed;

	return {
		name: "Global Mode",
		results,
		passed,
		failed,
		duration
	};
}

/**
 * Tests mixed scenarios and edge cases
 */
async function testMixedScenarios(verbose: boolean): Promise<TestSuite> {
	const startTime = Date.now();
	const results: TestResult[] = [];

	await withCleanEnvironment(async () => {
		// Test 1: Empty Environment
		results.push(await runTest("Empty Environment Detection", async () => {
			const testEnv = setupEmptyEnvironment("empty-test");
			const mockCommand = mockGlobalBacklogCommand(false);

			try {
				const { getInstallationContext } = await import("../src/utils/installation-detector.ts");
				const context = getInstallationContext(testEnv.dir);

				// Should not detect development mode (no src files)
				if (context.isDevelopment) {
					throw new Error("Incorrectly detected development mode in empty environment");
				}

				// Global detection depends on actual system state
				// If backlog is globally available, that's correct behavior
				return {
					emptyDetected: true,
					developmentDetected: context.isDevelopment,
					globalDetected: context.isGlobalInstall
				};
			} finally {
				testEnv.cleanup();
				mockCommand.restore();
			}
		}));

		// Test 2: Project Structure Validation
		results.push(await runTest("Backlog Project Setup", async () => {
			const testEnv = setupEmptyEnvironment("project-setup");

			try {
				// Should start as invalid
				const { runMcpDoctor } = await import("../src/mcp/test-connection.ts");
				let result = await runMcpDoctor(testEnv.dir);

				const structureCheck = result.checks.find(c => c.name === "Project Structure");
				if (structureCheck?.status === "pass") {
					throw new Error("Invalid project incorrectly validated as valid");
				}

				// Set up proper project structure
				setupBacklogProject(testEnv.dir);

				// Should now be valid
				result = await runMcpDoctor(testEnv.dir);
				const updatedCheck = result.checks.find(c => c.name === "Project Structure");
				if (updatedCheck?.status !== "pass") {
					throw new Error("Valid project not detected after setup");
				}

				return { projectSetup: true };
			} finally {
				testEnv.cleanup();
			}
		}));

		// Test 3: Mode Priority (Development > Global)
		results.push(await runTest("Mode Priority Testing", async () => {
			const testEnv = setupDevelopmentEnvironment("priority-test");
			const mockCommand = mockGlobalBacklogCommand(true);

			try {
				// Both development and global should be available
				const { getInstallationContext } = await import("../src/utils/installation-detector.ts");
				const context = getInstallationContext(testEnv.dir);

				// Development should take priority
				if (!context.isDevelopment) {
					throw new Error("Development mode not detected when both available");
				}

				if (context.mcpEntryPoint !== "bun") {
					throw new Error("Development mode not prioritized over global");
				}

				return { priorityCorrect: true };
			} finally {
				testEnv.cleanup();
				mockCommand.restore();
			}
		}));
	});

	const duration = Date.now() - startTime;
	const passed = results.filter(r => r.passed).length;
	const failed = results.length - passed;

	return {
		name: "Mixed Scenarios",
		results,
		passed,
		failed,
		duration
	};
}

/**
 * Tests error handling scenarios
 */
async function testErrorHandling(verbose: boolean): Promise<TestSuite> {
	const startTime = Date.now();
	const results: TestResult[] = [];

	await withCleanEnvironment(async () => {
		// Test 1: Missing Global Command
		results.push(await runTest("Missing Global Command Handling", async () => {
			const testEnv = setupGlobalEnvironment("no-global");

			// Mock child_process.execSync to simulate missing command
			const originalExecSync = require("node:child_process").execSync;
			const mockExecSync = function(command: string, ...args: any[]) {
				if (command.includes("backlog --version")) {
					const error = new Error("Command 'backlog' not found");
					(error as any).code = "ENOENT";
					throw error;
				}
				return originalExecSync(command, ...args);
			};

			require("node:child_process").execSync = mockExecSync;

			// Clear module cache to force re-import with mocked execSync
			const moduleId = require.resolve("../src/utils/installation-detector.ts");
			delete require.cache[moduleId];

			try {
				const { getInstallationContext } = await import("../src/utils/installation-detector.ts");

				// Should throw an error when trying to get context with no installation
				try {
					const context = getInstallationContext(testEnv.dir);
					throw new Error("Expected getInstallationContext to throw when no installation found");
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					if (!errorMessage.includes("No suitable MCP entry point found")) {
						throw new Error(`Expected 'No suitable MCP entry point found' error, got: ${errorMessage}`);
					}
				}

				return { errorHandled: true, noInstallationDetected: true };
			} finally {
				// Restore original execSync
				require("node:child_process").execSync = originalExecSync;

				// Clear module cache again to reset state
				delete require.cache[moduleId];

				testEnv.cleanup();
			}
		}));

		// Test 2: Invalid Project Directory
		results.push(await runTest("Invalid Directory Handling", async () => {
			const invalidDir = "/non/existent/directory";

			const { testMcpConnection } = await import("../src/mcp/test-connection.ts");
			const result = await testMcpConnection(invalidDir);

			// Should handle gracefully without crashing
			if (result.success) {
				throw new Error("Should not succeed with invalid directory");
			}

			if (result.errors.length === 0) {
				throw new Error("Should report errors for invalid directory");
			}

			return { errorHandled: true, errorCount: result.errors.length };
		}));

		// Test 3: Corrupted Configuration
		results.push(await runTest("Corrupted Config Handling", async () => {
			const testEnv = setupDevelopmentEnvironment("corrupted-config");

			try {
				// Write invalid JSON
				const { writeFileSync } = await import("node:fs");
				writeFileSync(resolve(testEnv.dir, "package.json"), "invalid json {");

				const { getInstallationContext } = await import("../src/utils/installation-detector.ts");
				const context = getInstallationContext(testEnv.dir);

				// Should handle corrupted JSON gracefully
				if (context.isDevelopment) {
					throw new Error("Should not detect development mode with corrupted config");
				}

				return { errorHandled: true };
			} finally {
				testEnv.cleanup();
			}
		}));
	});

	const duration = Date.now() - startTime;
	const passed = results.filter(r => r.passed).length;
	const failed = results.length - passed;

	return {
		name: "Error Handling",
		results,
		passed,
		failed,
		duration
	};
}

/**
 * Runs a single test with error handling
 */
async function runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
	const startTime = Date.now();

	try {
		const details = await testFn();
		const duration = Date.now() - startTime;

		return {
			name,
			passed: true,
			duration,
			details
		};
	} catch (error) {
		const duration = Date.now() - startTime;

		return {
			name,
			passed: false,
			error: error instanceof Error ? error.message : String(error),
			duration
		};
	}
}

/**
 * Runs a command and returns stdout/stderr
 */
function runCommand(command: string, args: string[], options: {
	cwd?: string;
	env?: Record<string, string>;
	timeout?: number;
} = {}): Promise<{ stdout: string; stderr: string; code: number }> {
	return new Promise((resolve, reject) => {
		const { timeout = 10000, cwd, env } = options;

		const child = spawn(command, args, {
			cwd: cwd || process.cwd(),
			env: env || process.env,
			stdio: ['pipe', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		child.stdout?.on('data', (data) => {
			stdout += data.toString();
		});

		child.stderr?.on('data', (data) => {
			stderr += data.toString();
		});

		const timeoutId = setTimeout(() => {
			child.kill('SIGTERM');
			reject(new Error(`Command timed out after ${timeout}ms`));
		}, timeout);

		child.on('close', (code) => {
			clearTimeout(timeoutId);
			resolve({ stdout, stderr, code: code || 0 });
		});

		child.on('error', (error) => {
			clearTimeout(timeoutId);
			reject(error);
		});
	});
}

// Run the tests if this script is executed directly
if (import.meta.main) {
	main().catch((error) => {
		console.error("💥 Test suite failed:", error);
		process.exit(1);
	});
}