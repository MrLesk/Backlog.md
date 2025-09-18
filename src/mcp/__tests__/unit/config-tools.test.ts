import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $ } from "bun";
import { createUniqueTestDir, safeCleanup } from "../../../test/test-utils.ts";
import type { BacklogConfig } from "../../../types/index.ts";
import { McpServer } from "../../server.ts";
import { registerConfigTools } from "../../tools/config-tools.ts";

let TEST_DIR: string;

describe("Config Tools", () => {
	let mcpServer: McpServer;
	const initialConfig: BacklogConfig = {
		projectName: "Test Project",
		statuses: ["To Do", "In Progress", "Done"],
		labels: ["feature", "bug"],
		milestones: ["v1.0"],
		dateFormat: "YYYY-MM-DD HH:mm",
		defaultEditor: "vim",
		defaultStatus: "To Do",
		maxColumnWidth: 80,
		defaultPort: 6420,
		autoOpenBrowser: true,
		remoteOperations: false,
		autoCommit: false,
		bypassGitHooks: false,
		checkActiveBranches: true,
		activeBranchDays: 30,
	};

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-config-tools");
		mcpServer = new McpServer(TEST_DIR);
		await mcpServer.filesystem.ensureBacklogStructure();

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		await mcpServer.filesystem.saveConfig(initialConfig);

		registerConfigTools(mcpServer);
	});

	afterEach(async () => {
		try {
			await mcpServer.stop();
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("config_get tool", () => {
		it("should return full config when no key specified", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_get",
					arguments: {},
				},
			});

			expect(result.content).toHaveLength(1);
			const data = JSON.parse(result.content[0]?.text as string);
			expect(data.projectName).toBe("Test Project");
			expect(data.statuses).toEqual(["To Do", "In Progress", "Done"]);
		});

		it("should return specific config value", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_get",
					arguments: { key: "projectName" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toBe("Test Project");
		});

		it("should return array config values", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_get",
					arguments: { key: "statuses" },
				},
			});

			expect(result.content).toHaveLength(1);
			const data = JSON.parse(result.content[0]?.text as string);
			expect(data).toEqual(["To Do", "In Progress", "Done"]);
		});

		it("should return boolean config values", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_get",
					arguments: { key: "autoCommit" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toBe("false");
		});

		it("should return null for unset optional values", async () => {
			// Create minimal config without optional fields
			const minimalConfig: BacklogConfig = {
				projectName: "Minimal Project",
				statuses: ["To Do"],
				labels: [],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
			};
			await mcpServer.filesystem.saveConfig(minimalConfig);

			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_get",
					arguments: { key: "defaultEditor" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toBe("null");
		});

		it("should handle unknown config key", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_get",
					arguments: { key: "unknownKey" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Unknown config key");
		});

		it("should handle missing config", async () => {
			const tempServer = new McpServer(createUniqueTestDir("test-no-config"));
			registerConfigTools(tempServer);

			const result = await tempServer.testInterface.callTool({
				params: {
					name: "config_get",
					arguments: { key: "projectName" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("No backlog project found");
		});
	});

	describe("config_set tool", () => {
		it("should set string config values", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "projectName", value: "Updated Project" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Successfully updated projectName to: Updated Project");

			// Verify the config was actually saved
			const config = await mcpServer.filesystem.loadConfig();
			expect(config?.projectName).toBe("Updated Project");
		});

		it("should set array config values", async () => {
			const newStatuses = ["Backlog", "In Progress", "Review", "Done"];
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "statuses", value: newStatuses },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Successfully updated");

			const config = await mcpServer.filesystem.loadConfig();
			expect(config?.statuses).toEqual(newStatuses);
		});

		it("should set boolean config values", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "autoCommit", value: true },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Successfully updated");
			const config = await mcpServer.filesystem.loadConfig();
			expect(config?.autoCommit).toBe(true);
		});

		it("should set numeric config values", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "defaultPort", value: 8080 },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Successfully updated");
			const config = await mcpServer.filesystem.loadConfig();
			expect(config?.defaultPort).toBe(8080);
		});

		it("should validate string inputs", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "projectName", value: "" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("must be a non-empty string");
		});

		it("should validate array inputs", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "statuses", value: [] },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("At least one status must be provided");
		});

		it("should validate numeric ranges", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "defaultPort", value: 999999 },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("must be an integer between 1 and 65535");
		});

		it("should validate boolean inputs", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "autoCommit", value: "not-a-boolean" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("must be a boolean value");
		});

		it("should validate defaultStatus against existing statuses", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "defaultStatus", value: "NonExistent" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("not found in configured statuses");
		});

		it("should handle unknown config key", async () => {
			const result = await mcpServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "unknownKey", value: "someValue" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("Unknown config key");
		});

		it("should handle missing config", async () => {
			const tempServer = new McpServer(createUniqueTestDir("test-no-config"));
			registerConfigTools(tempServer);

			const result = await tempServer.testInterface.callTool({
				params: {
					name: "config_set",
					arguments: { key: "projectName", value: "New Project" },
				},
			});

			expect(result.content).toHaveLength(1);
			expect(result.content[0]?.text).toContain("No backlog project found");
		});
	});
});
