import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import type { PromptRunner } from "../commands/advanced-config-wizard.ts";
import { configureAdvancedSettings } from "../commands/configure-advanced-settings.ts";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Config commands", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-config-commands");
		await mkdir(TEST_DIR, { recursive: true });

		// Configure git for tests - required for CI
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Test Config Project");
	});

	function createPromptStub(sequence: Array<Record<string, unknown>>): PromptRunner {
		const stub: PromptRunner = async () => {
			const response = sequence.shift();
			if (!response) {
				throw new Error("Advanced config wizard requested an unexpected prompt.");
			}
			return response;
		};
		return stub;
	}

	it("configureAdvancedSettings keeps defaults when no changes requested", async () => {
		const promptStub = createPromptStub([
			{ installCompletions: false },
			{ checkActiveBranches: true },
			{ remoteOperations: true },
			{ activeBranchDays: 30 },
			{ bypassGitHooks: false },
			{ autoCommit: false },
			{ enableZeroPadding: false },
			{ editor: "" },
			{ definitionOfDoneAction: "done" },
			{ configureWebUI: false },
			{ installClaudeAgent: false },
		]);

		const { mergedConfig, installClaudeAgent, installShellCompletions } = await configureAdvancedSettings(core, {
			promptImpl: promptStub,
		});

		expect(installClaudeAgent).toBe(false);
		expect(installShellCompletions).toBe(false);
		expect(mergedConfig.checkActiveBranches).toBe(true);
		expect(mergedConfig.remoteOperations).toBe(true);
		expect(mergedConfig.activeBranchDays).toBe(30);
		expect(mergedConfig.bypassGitHooks).toBe(false);
		expect(mergedConfig.autoCommit).toBe(false);
		expect(mergedConfig.zeroPaddedIds).toBeUndefined();
		expect(mergedConfig.defaultEditor).toBeUndefined();
		expect(mergedConfig.definitionOfDone).toEqual([]);
		expect(mergedConfig.defaultPort).toBe(6420);
		expect(mergedConfig.autoOpenBrowser).toBe(true);

		const reloadedConfig = await core.filesystem.loadConfig();
		expect(reloadedConfig?.definitionOfDone).toEqual([]);
		expect(reloadedConfig?.defaultPort).toBe(6420);
		expect(reloadedConfig?.autoOpenBrowser).toBe(true);
	});

	it("configureAdvancedSettings applies wizard selections", async () => {
		const promptStub = createPromptStub([
			{ installCompletions: true },
			{ checkActiveBranches: true },
			{ remoteOperations: false },
			{ activeBranchDays: 14 },
			{ bypassGitHooks: true },
			{ autoCommit: true },
			{ enableZeroPadding: true },
			{ paddingWidth: 4 },
			{ editor: "bun" },
			{ definitionOfDoneAction: "add" },
			{ definitionOfDoneItem: "Ship release notes" },
			{ definitionOfDoneAction: "done" },
			{ configureWebUI: true },
			{ defaultPort: 7007, autoOpenBrowser: false },
			{ installClaudeAgent: true },
		]);

		const { mergedConfig, installClaudeAgent, installShellCompletions } = await configureAdvancedSettings(core, {
			promptImpl: promptStub,
		});

		expect(installClaudeAgent).toBe(true);
		expect(installShellCompletions).toBe(true);
		expect(mergedConfig.checkActiveBranches).toBe(true);
		expect(mergedConfig.remoteOperations).toBe(false);
		expect(mergedConfig.activeBranchDays).toBe(14);
		expect(mergedConfig.bypassGitHooks).toBe(true);
		expect(mergedConfig.autoCommit).toBe(true);
		expect(mergedConfig.zeroPaddedIds).toBe(4);
		expect(mergedConfig.defaultEditor).toBe("bun");
		expect(mergedConfig.definitionOfDone).toEqual(["Ship release notes"]);
		expect(mergedConfig.defaultPort).toBe(7007);
		expect(mergedConfig.autoOpenBrowser).toBe(false);

		const reloadedConfig = await core.filesystem.loadConfig();
		expect(reloadedConfig?.zeroPaddedIds).toBe(4);
		expect(reloadedConfig?.defaultEditor).toBe("bun");
		expect(reloadedConfig?.definitionOfDone).toEqual(["Ship release notes"]);
		expect(reloadedConfig?.defaultPort).toBe(7007);
		expect(reloadedConfig?.autoOpenBrowser).toBe(false);
		expect(reloadedConfig?.bypassGitHooks).toBe(true);
		expect(reloadedConfig?.autoCommit).toBe(true);
	});

	it("configureAdvancedSettings supports add/remove/reorder/clear actions for Definition of Done defaults", async () => {
		const promptStub = createPromptStub([
			{ installCompletions: false },
			{ checkActiveBranches: true },
			{ remoteOperations: true },
			{ activeBranchDays: 30 },
			{ bypassGitHooks: false },
			{ autoCommit: false },
			{ enableZeroPadding: false },
			{ editor: "" },
			{ definitionOfDoneAction: "add" },
			{ definitionOfDoneItem: "  First item  " },
			{ definitionOfDoneAction: "add" },
			{ definitionOfDoneItem: "Second item" },
			{ definitionOfDoneAction: "reorder" },
			{ moveFromIndex: 2, moveToIndex: 1 },
			{ definitionOfDoneAction: "remove" },
			{ removeDefinitionOfDoneIndex: 2 },
			{ definitionOfDoneAction: "clear" },
			{ confirmClearDefinitionOfDone: true },
			{ definitionOfDoneAction: "add" },
			{ definitionOfDoneItem: "  Final item  " },
			{ definitionOfDoneAction: "done" },
			{ configureWebUI: false },
			{ installClaudeAgent: false },
		]);

		const { mergedConfig } = await configureAdvancedSettings(core, {
			promptImpl: promptStub,
		});

		expect(mergedConfig.definitionOfDone).toEqual(["Final item"]);
		const reloadedConfig = await core.filesystem.loadConfig();
		expect(reloadedConfig?.definitionOfDone).toEqual(["Final item"]);
	});

	it("exposes config list/get/set subcommands", async () => {
		const listOutput = await $`bun ${CLI_PATH} config list`.cwd(TEST_DIR).text();
		expect(listOutput).toContain("Configuration:");

		await $`bun ${CLI_PATH} config set defaultPort 7001`.cwd(TEST_DIR).quiet();

		const portOutput = await $`bun ${CLI_PATH} config get defaultPort`.cwd(TEST_DIR).text();
		expect(portOutput.trim()).toBe("7001");
	});

	it("round-trips hideEmptyColumns through config get/set/list", async () => {
		const defaultGet = await $`bun ${CLI_PATH} config get hideEmptyColumns`.cwd(TEST_DIR).text();
		expect(defaultGet.trim()).toBe("false");

		await $`bun ${CLI_PATH} config set hideEmptyColumns true`.cwd(TEST_DIR).quiet();

		const afterSet = await $`bun ${CLI_PATH} config get hideEmptyColumns`.cwd(TEST_DIR).text();
		expect(afterSet.trim()).toBe("true");

		const listOutput = await $`bun ${CLI_PATH} config list`.cwd(TEST_DIR).text();
		expect(listOutput).toContain("hideEmptyColumns: true");
	});

	it("parses block-style YAML sequences identically to inline arrays for list keys", () => {
		const inline = core.filesystem.parseConfig(
			'project_name: "P"\nstatuses: ["To Do", "Done"]\nlabels: ["a", "b"]\ntypes: ["bug", "epic"]\npriorities: ["Critical", "Low"]\n',
		);
		const block = core.filesystem.parseConfig(
			'project_name: "P"\nstatuses:\n  - To Do\n  - Done\nlabels:\n  - a\n  - b\ntypes:\n  - bug\n  - epic\npriorities:\n  - Critical\n  - Low\n',
		);

		expect(block.statuses).toEqual(inline.statuses);
		expect(block.labels).toEqual(inline.labels);
		expect(block.types).toEqual(inline.types);
		expect(block.priorities).toEqual(inline.priorities);
		expect(block.priorities).toEqual(["Critical", "Low"]);
	});

	it("preserves commas inside quoted list values", () => {
		const config = core.filesystem.parseConfig('project_name: "P"\npriorities: ["Very High, Almost", "Low"]\n');
		expect(config.priorities).toEqual(["Very High, Almost", "Low"]);
	});

	it("honors block-style priorities end-to-end through config get and task create", async () => {
		const configPath = core.filesystem.configFilePath;
		const existing = await Bun.file(configPath).text();
		await Bun.write(configPath, `${existing.trimEnd()}\npriorities:\n  - Critical\n  - Normal\n`);

		const priorities = await $`bun ${CLI_PATH} config get priorities`.cwd(TEST_DIR).text();
		expect(priorities.trim()).toBe("Critical, Normal");

		const created = await $`bun ${CLI_PATH} task create "Block priority task" --priority Critical --plain`
			.cwd(TEST_DIR)
			.text();
		expect(created).toContain("Priority: Critical");
	});

	it("gives accurate guidance when setting list keys and consistent unknown-key lists", async () => {
		const priorities = await $`bun ${CLI_PATH} config set priorities High`.cwd(TEST_DIR).nothrow().quiet();
		const prioritiesError = priorities.stderr.toString();
		expect(priorities.exitCode).not.toBe(0);
		expect(prioritiesError).toContain("priorities cannot be set directly");
		expect(prioritiesError).toContain("backlog config get priorities");
		expect(prioritiesError).not.toContain("list-priorities");

		const types = await $`bun ${CLI_PATH} config set types bug`.cwd(TEST_DIR).nothrow().quiet();
		const typesError = types.stderr.toString();
		expect(types.exitCode).not.toBe(0);
		expect(typesError).toContain("types cannot be set directly");
		expect(typesError).not.toContain("Unknown config key");

		const unknownGet = await $`bun ${CLI_PATH} config get nosuchkey`.cwd(TEST_DIR).nothrow().quiet();
		const unknownSet = await $`bun ${CLI_PATH} config set nosuchkey value`.cwd(TEST_DIR).nothrow().quiet();
		const getKeys = unknownGet.stderr.toString().match(/Available keys: .*/)?.[0];
		const setKeys = unknownSet.stderr.toString().match(/Available keys: .*/)?.[0];
		expect(getKeys).toBeDefined();
		expect(setKeys).toEqual(getKeys);
	});

	it("surfaces milestones in config get/list from milestone files", async () => {
		await core.filesystem.createMilestone("Release 1");

		const milestonesOutput = await $`bun ${CLI_PATH} config get milestones`.cwd(TEST_DIR).text();
		expect(milestonesOutput.trim()).toBe("m-0");

		const listOutput = await $`bun ${CLI_PATH} config list`.cwd(TEST_DIR).text();
		expect(listOutput).toContain("milestones: [m-0]");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("should save and load defaultEditor config", async () => {
		// Load initial config
		const config = await core.filesystem.loadConfig();
		expect(config).toBeTruthy();
		expect(config?.defaultEditor).toBeUndefined();

		// Set defaultEditor
		if (config) {
			config.defaultEditor = "nano";
			await core.filesystem.saveConfig(config);
		}

		// Reload config and verify it was saved
		const reloadedConfig = await core.filesystem.loadConfig();
		expect(reloadedConfig).toBeTruthy();
		expect(reloadedConfig?.defaultEditor).toBe("nano");
	});

	it("should handle config with and without defaultEditor", async () => {
		// Initially undefined
		let config = await core.filesystem.loadConfig();
		expect(config?.defaultEditor).toBeUndefined();

		// Set to a value
		if (config) {
			config.defaultEditor = "vi";
			await core.filesystem.saveConfig(config);
		}

		config = await core.filesystem.loadConfig();
		expect(config?.defaultEditor).toBe("vi");

		// Clear the value
		if (config) {
			config.defaultEditor = undefined;
			await core.filesystem.saveConfig(config);
		}

		config = await core.filesystem.loadConfig();
		expect(config?.defaultEditor).toBeUndefined();
	});

	it("should preserve other config values when setting defaultEditor", async () => {
		let config = await core.filesystem.loadConfig();
		const originalProjectName = config?.projectName;
		const originalStatuses = config ? [...config.statuses] : [];

		// Set defaultEditor
		if (config) {
			config.defaultEditor = "code";
			await core.filesystem.saveConfig(config);
		}

		// Reload and verify other values are preserved
		config = await core.filesystem.loadConfig();
		expect(config?.defaultEditor).toBe("code");
		expect(config?.projectName).toBe(originalProjectName ?? "");
		expect(config?.statuses).toEqual(originalStatuses);
	});
});
