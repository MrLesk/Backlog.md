import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import type { PromptRunner } from "../commands/advanced-config-wizard.ts";
import { configureAdvancedSettings } from "../commands/configure-advanced-settings.ts";
import { DEFAULT_STATUSES } from "../constants/index.ts";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

describe("Config commands", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-config-commands");
		await mkdir(TEST_DIR, { recursive: true });

		// Configure git for tests - required for CI
		await $`git init`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Test Config Project");
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
			{ editor: "backlog-test-editor" },
			{ definitionOfDoneAction: "add" },
			{ definitionOfDoneItem: "Ship release notes" },
			{ definitionOfDoneAction: "done" },
			{ configureWebUI: true },
			{ defaultPort: 7007, autoOpenBrowser: false },
			{ installClaudeAgent: true },
		]);

		const { mergedConfig, installClaudeAgent, installShellCompletions } = await configureAdvancedSettings(core, {
			promptImpl: promptStub,
			isEditorAvailable: async (editor) => editor === "backlog-test-editor",
		});

		expect(installClaudeAgent).toBe(true);
		expect(installShellCompletions).toBe(true);
		expect(mergedConfig.checkActiveBranches).toBe(true);
		expect(mergedConfig.remoteOperations).toBe(false);
		expect(mergedConfig.activeBranchDays).toBe(14);
		expect(mergedConfig.bypassGitHooks).toBe(true);
		expect(mergedConfig.autoCommit).toBe(true);
		expect(mergedConfig.zeroPaddedIds).toBe(4);
		expect(mergedConfig.defaultEditor).toBe("backlog-test-editor");
		expect(mergedConfig.definitionOfDone).toEqual(["Ship release notes"]);
		expect(mergedConfig.defaultPort).toBe(7007);
		expect(mergedConfig.autoOpenBrowser).toBe(false);

		const reloadedConfig = await core.filesystem.loadConfig();
		expect(reloadedConfig?.zeroPaddedIds).toBe(4);
		expect(reloadedConfig?.defaultEditor).toBe("backlog-test-editor");
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

	it("round-trips taskListPaneWidth through config get/set/list", async () => {
		const defaultGet = await $`bun ${CLI_PATH} config get taskListPaneWidth`.cwd(TEST_DIR).text();
		expect(defaultGet.trim()).toBe("");

		await $`bun ${CLI_PATH} config set taskListPaneWidth 55`.cwd(TEST_DIR).quiet();

		const afterSet = await $`bun ${CLI_PATH} config get taskListPaneWidth`.cwd(TEST_DIR).text();
		expect(afterSet.trim()).toBe("55");

		const listOutput = await $`bun ${CLI_PATH} config list`.cwd(TEST_DIR).text();
		expect(listOutput).toContain("taskListPaneWidth: 55");

		const reloaded = await new Core(TEST_DIR).filesystem.loadConfig();
		expect(reloaded?.taskListPaneWidth).toBe(55);
	});

	it("rejects taskListPaneWidth values outside 10-90", async () => {
		for (const value of ["5", "95", "abc"]) {
			const result = await $`bun ${CLI_PATH} config set taskListPaneWidth ${value}`.cwd(TEST_DIR).nothrow().quiet();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("taskListPaneWidth must be a percentage between 10 and 90");
		}
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

	it("round-trips defaultAssignee through config set, get, and list", async () => {
		const unset = await $`bun ${CLI_PATH} config get defaultAssignee`.cwd(TEST_DIR).nothrow().quiet();
		expect(unset.exitCode).toBe(0);
		expect(unset.stdout.toString().trim()).toBe("");

		const set = await $`bun ${CLI_PATH} config set defaultAssignee ${"@alice, @bob"}`.cwd(TEST_DIR).nothrow().quiet();
		expect(set.exitCode).toBe(0);

		core.filesystem.invalidateConfigCache();
		expect((await core.filesystem.loadConfig())?.defaultAssignee).toEqual(["@alice", "@bob"]);

		const get = await $`bun ${CLI_PATH} config get defaultAssignee`.cwd(TEST_DIR).nothrow().quiet();
		expect(get.stdout.toString().trim()).toBe("@alice, @bob");

		const list = await $`bun ${CLI_PATH} config list`.cwd(TEST_DIR).nothrow().quiet();
		expect(list.stdout.toString()).toContain("defaultAssignee: [@alice, @bob]");

		const cleared = await $`bun ${CLI_PATH} config set defaultAssignee ${""}`.cwd(TEST_DIR).nothrow().quiet();
		expect(cleared.exitCode).toBe(0);

		core.filesystem.invalidateConfigCache();
		expect((await core.filesystem.loadConfig())?.defaultAssignee).toBeUndefined();
	});

	it("reads defaultAssignee written as a scalar, a block sequence, or with a trailing comment", async () => {
		const configPath = core.filesystem.configFilePath;
		const baseConfig = await Bun.file(configPath).text();
		const loadAssignee = async (line: string) => {
			await Bun.write(configPath, `${baseConfig}${line}\n`);
			core.filesystem.invalidateConfigCache();
			return (await core.filesystem.loadConfig())?.defaultAssignee;
		};

		expect(await loadAssignee('default_assignee: "@legacy"')).toEqual(["@legacy"]);
		expect(await loadAssignee('default_assignee:\n  - "@alice"\n  - "@bob"')).toEqual(["@alice", "@bob"]);
		// YAML comments belong to the file, not to the assignee.
		expect(await loadAssignee('default_assignee: "@alice" # owner')).toEqual(["@alice"]);
		expect(await loadAssignee('default_assignee: ["@alice", "@bob"] # owners')).toEqual(["@alice", "@bob"]);
	});

	it("round-trips a defaultAssignee containing characters that need YAML escaping", async () => {
		const quoted = '@a"b\\c';
		const set = await $`bun ${CLI_PATH} config set defaultAssignee ${quoted}`.cwd(TEST_DIR).nothrow().quiet();
		expect(set.exitCode).toBe(0);

		expect(await Bun.file(core.filesystem.configFilePath).text()).toContain('default_assignee: ["@a\\"b\\\\c"]');

		core.filesystem.invalidateConfigCache();
		expect((await core.filesystem.loadConfig())?.defaultAssignee).toEqual([quoted]);

		const created = await core.createTaskFromInput({ title: "Escaped default assignee" }, false);
		expect(created.task.assignee).toEqual([quoted]);
	});

	it("refuses to load a list config value that is not valid YAML, naming the file and the key", async () => {
		const configPath = core.filesystem.configFilePath;
		const baseConfig = await Bun.file(configPath).text();

		for (const key of ["statuses", "labels", "types", "priorities", "default_assignee"]) {
			// Truncated array, and an unbalanced quote that still opens and closes with brackets.
			for (const line of [`${key}: ["a`, `${key}: ["a]`]) {
				await Bun.write(configPath, `${baseConfig}${line}\n`);
				core.filesystem.invalidateConfigCache();

				const failure = await core.filesystem.loadConfig().then(
					() => undefined,
					(error: unknown) => (error instanceof Error ? error.message : String(error)),
				);
				expect(failure).toBeDefined();
				expect(failure).toStartWith("Backlog could not start because");
				expect(failure).toContain(configPath);
				expect(failure).toContain(`invalid value for "${key}"`);
			}
		}
	});

	it("refuses to load a list config value YAML reads but the key cannot hold, naming the type problem", async () => {
		const configPath = core.filesystem.configFilePath;
		const baseConfig = await Bun.file(configPath).text();

		for (const key of ["statuses", "labels", "types", "priorities", "default_assignee"]) {
			// A single name is the legacy spelling of default_assignee, so only that key accepts a scalar.
			const wrongTyped = [
				[`${key}: {name: "@alice"}`, "a mapping"],
				[`${key}: 42`, "a number"],
				[`${key}: true`, "a boolean"],
				...(key === "default_assignee" ? [] : [[`${key}: To Do`, "a scalar"]]),
			];
			const expected = key === "default_assignee" ? "a list or a single name" : "a list";

			for (const [line, shape] of wrongTyped) {
				await Bun.write(configPath, `${baseConfig}${line}\n`);
				core.filesystem.invalidateConfigCache();

				const failure = await core.filesystem.loadConfig().then(
					() => undefined,
					(error: unknown) => (error instanceof Error ? error.message : String(error)),
				);
				expect(failure).toBeDefined();
				expect(failure).toStartWith("Backlog could not start because");
				expect(failure).toContain(configPath);
				expect(failure).toContain(`invalid value for "${key}"`);
				expect(failure).toContain(`expected ${expected}, got ${shape}`);
			}
		}
	});

	it("still accepts the value shapes a list key legitimately has", () => {
		// Strictness must not reach an explicitly empty value, a legacy single assignee name, or a list.
		expect(core.filesystem.parseConfig('project_name: "P"\nstatuses:\n').statuses).toEqual([...DEFAULT_STATUSES]);
		expect(core.filesystem.parseConfig('project_name: "P"\nstatuses: []\n').statuses).toEqual([]);
		expect(core.filesystem.parseConfig('project_name: "P"\nlabels:\n').labels).toEqual([]);
		expect(core.filesystem.parseConfig('project_name: "P"\ndefault_assignee: "@alex"\n').defaultAssignee).toEqual([
			"@alex",
		]);
		expect(core.filesystem.parseConfig('project_name: "P"\ndefault_assignee:\n').defaultAssignee).toEqual([]);
		expect(core.filesystem.parseConfig('project_name: "P"\ndefault_assignee:\n  - "@a"\n').defaultAssignee).toEqual([
			"@a",
		]);
		// Numbers inside a list are still coerced to their written form rather than rejected.
		expect(core.filesystem.parseConfig('project_name: "P"\nstatuses: [1, 2]\n').statuses).toEqual(["1", "2"]);
	});

	it("keeps a malformed list value from changing how another list key reads", () => {
		// The commas inside the quoted labels are only safe when labels is parsed as YAML; the
		// malformed statuses value must be reported instead of downgrading labels to a text split.
		expect(() => core.filesystem.parseConfig('project_name: "P"\nstatuses: ["To Do]\nlabels: ["a, b", "c"]\n')).toThrow(
			'invalid value for "statuses"',
		);
		expect(core.filesystem.parseConfig('project_name: "P"\nlabels: ["a, b", "c"]\n').labels).toEqual(["a, b", "c"]);
	});

	it("reads the config key at column 0, not an indented look-alike inside another key's value", () => {
		// A nested mapping and a block scalar can both contain a line that looks like a config key.
		const nested = core.filesystem.parseConfig(
			'project_name: "P"\nstatuses: [top]\nmeta_thing:\n  statuses: [nested1, nested2]\n',
		);
		expect(nested.statuses).toEqual(["top"]);

		const blockScalar = core.filesystem.parseConfig(
			'project_name: "P"\nstatuses: [real]\nnotes_thing: |\n  statuses: [fake]\n',
		);
		expect(blockScalar.statuses).toEqual(["real"]);

		// A block-sequence top-level key must win over the look-alike too, and a malformed
		// look-alike must not make the real key unreadable.
		const blockSequence = core.filesystem.parseConfig(
			'project_name: "P"\nstatuses:\n  - Top\nmeta_thing:\n  statuses: [nested]\n',
		);
		expect(blockSequence.statuses).toEqual(["Top"]);
		expect(
			core.filesystem.parseConfig('project_name: "P"\nstatuses: [top]\nmeta_thing:\n  statuses: ["broken\n').statuses,
		).toEqual(["top"]);

		// Control: with no column-0 occurrence, an indented key is still the only value there is.
		expect(core.filesystem.parseConfig('project_name: "P"\n\tstatuses: ["tabbed"]\n').statuses).toEqual(["tabbed"]);
		expect(core.filesystem.parseConfig('project_name: "P"\n  statuses: ["spaced"]\n').statuses).toEqual(["spaced"]);
	});

	it("does not blame a valid list key for a malformed value under a key Backlog does not read", () => {
		// Any mapping key ends the previous key's block, whatever characters its name uses. Without that,
		// the malformed custom-setting line folds into the statuses block and startup blames statuses —
		// an error the user cannot fix by editing the key it names.
		for (const unreadKey of ["custom-setting", "my.setting", '"quoted-key"', "2fa"]) {
			const config = core.filesystem.parseConfig(`project_name: "P"\nstatuses: [Queued, Done]\n${unreadKey}: ["bad]\n`);
			expect(config.statuses).toEqual(["Queued", "Done"]);
		}

		// A block-sequence value survives the same shape, and each key is still reported on its own.
		expect(
			core.filesystem.parseConfig('project_name: "P"\nstatuses:\n  - Queued\ncustom-setting: ["bad]\n').statuses,
		).toEqual(["Queued"]);
		expect(() =>
			core.filesystem.parseConfig('project_name: "P"\nstatuses: ["Queued]\ncustom-setting: ["bad]\n'),
		).toThrow('invalid value for "statuses"');

		// A sequence item is not a key even when its text contains a colon, so it must not cut the block.
		expect(core.filesystem.parseConfig('project_name: "P"\nstatuses:\n- "a: b"\n- Done\n').statuses).toEqual([
			"a: b",
			"Done",
		]);
	});

	it("reports a rejected config value without half-applying a draft or milestone mutation", async () => {
		await $`bun ${CLI_PATH} draft create "Draftling" --plain`.cwd(TEST_DIR).nothrow().quiet();
		await core.filesystem.createMilestone("Mile");
		const configPath = core.filesystem.configFilePath;
		const baseConfig = await Bun.file(configPath).text();
		const listFiles = async () =>
			(await $`find backlog -type f`.cwd(TEST_DIR).nothrow().quiet().text()).split("\n").sort();

		await Bun.write(configPath, `${baseConfig}statuses: ["To Do]\n`);
		const before = await listFiles();

		// A swallowed error used to report a draft that still exists as missing, and a mutation ordered
		// before the first config read used to leave the draft or milestone half-moved.
		for (const args of [
			["draft", "promote", "draft-1"],
			["draft", "archive", "draft-1"],
			["milestone", "add", "Second"],
			["milestone", "archive", "Mile"],
		]) {
			const result = await $`bun ${CLI_PATH} ${args}`.cwd(TEST_DIR).nothrow().quiet();
			const stderr = result.stderr.toString();
			expect(result.exitCode).not.toBe(0);
			expect(stderr).toContain("Backlog could not start because");
			expect(stderr).toContain('invalid value for "statuses"');
			expect(stderr).not.toContain("not found");
			expect(await listFiles()).toEqual(before);
		}
	});

	it("resolves a YAML alias against the anchor defined under another key", () => {
		// An alias only has meaning in document context, so a list value that uses one must still
		// resolve even though each key's own block is what gets parsed.
		const shared = core.filesystem.parseConfig(
			'project_name: "P"\nstatuses: &workflow [To Do, Done]\nlabels: *workflow\n',
		);
		expect(shared.statuses).toEqual(["To Do", "Done"]);
		expect(shared.labels).toEqual(["To Do", "Done"]);

		const scalarAnchor = core.filesystem.parseConfig('project_name: "P"\ndefault_status: &s "To Do"\nstatuses: [*s]\n');
		expect(scalarAnchor.statuses).toEqual(["To Do"]);

		// Document context must not rescue a value that is genuinely malformed.
		expect(() => core.filesystem.parseConfig('project_name: "P"\nstatuses: ["To Do]\n')).toThrow(
			'invalid value for "statuses"',
		);
	});

	it("exits non-zero with the config error at every entry point that reads config", async () => {
		const configPath = core.filesystem.configFilePath;
		const baseConfig = await Bun.file(configPath).text();
		await Bun.write(configPath, `${baseConfig}statuses: ["To Do]\n`);

		// Bare invocation must not report an initialized project as uninitialized, the empty-list fast
		// path must not hide the failure, and MCP startup must not bury the message behind a summary.
		for (const args of [["task", "list", "--plain"], ["--plain"], ["draft", "list", "--plain"], ["mcp", "start"]]) {
			const result = await $`bun ${CLI_PATH} ${args}`.cwd(TEST_DIR).nothrow().quiet();
			const stderr = result.stderr.toString();
			expect(result.exitCode).not.toBe(0);
			expect(stderr).toStartWith("Backlog could not start because");
			expect(stderr).toContain('invalid value for "statuses"');
			expect(stderr).not.toContain("at parseConfig");
			expect(result.stdout.toString()).not.toContain("not initialized");
			expect(result.stdout.toString()).not.toContain("No drafts found");
		}
	});

	it("clears defaultEditor via config set with an explicitly empty value", async () => {
		// An empty value means "no editor": it must be stored, not rejected as an invalid executable
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Config not loaded");
		config.defaultEditor = "code --wait";
		await core.filesystem.saveConfig(config);
		expect((await core.filesystem.loadConfig())?.defaultEditor).toBe("code --wait");

		const cleared = await $`bun ${CLI_PATH} config set defaultEditor ${""}`.cwd(TEST_DIR).nothrow().quiet();
		expect(cleared.exitCode).toBe(0);

		core.filesystem.invalidateConfigCache();
		const reloaded = await core.filesystem.loadConfig();
		expect(reloaded?.defaultEditor).toBeUndefined();
	});

	it("honors an explicitly empty --default-editor flag during init instead of discarding it", async () => {
		// With EDITOR set as a sentinel, a discarded empty flag would fall back to the environment value
		const initDir = createUniqueTestDir("test-config-commands-init");
		await mkdir(initDir, { recursive: true });
		await $`git init`.cwd(initDir).quiet();

		const env = { ...process.env, EDITOR: "backlog-sentinel-editor", VISUAL: "backlog-sentinel-editor" };
		const result =
			await $`bun ${CLI_PATH} init "Editorless Project" --defaults --default-editor ${""} --integration-mode none`
				.cwd(initDir)
				.env(env)
				.nothrow()
				.quiet();
		expect(result.exitCode).toBe(0);

		const initCore = new Core(initDir);
		const config = await initCore.filesystem.loadConfig();
		expect(config?.defaultEditor).toBeUndefined();

		await safeCleanup(initDir);
	});

	it("clears a configured editor when re-initializing with an explicitly empty --default-editor", async () => {
		const initDir = createUniqueTestDir("test-config-commands-reinit");
		await mkdir(initDir, { recursive: true });
		await $`git init`.cwd(initDir).quiet();

		// First init without the flag: the EDITOR env fallback must still apply
		const env = { ...process.env, EDITOR: "backlog-sentinel-editor", VISUAL: "backlog-sentinel-editor" };
		const initial = await $`bun ${CLI_PATH} init "Editor Project" --defaults --integration-mode none`
			.cwd(initDir)
			.env(env)
			.nothrow()
			.quiet();
		expect(initial.exitCode).toBe(0);

		const initCore = new Core(initDir);
		expect((await initCore.filesystem.loadConfig())?.defaultEditor).toBe("backlog-sentinel-editor");

		// Re-init with an explicitly empty flag: clears the editor instead of keeping the existing value
		const reinit =
			await $`bun ${CLI_PATH} init "Editor Project" --defaults --default-editor ${""} --integration-mode none`
				.cwd(initDir)
				.env(env)
				.nothrow()
				.quiet();
		expect(reinit.exitCode).toBe(0);
		initCore.filesystem.invalidateConfigCache();
		expect((await initCore.filesystem.loadConfig())?.defaultEditor).toBeUndefined();

		await safeCleanup(initDir);
	});
});
