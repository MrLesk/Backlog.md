import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { initializeProject } from "../core/init.ts";
import type { BacklogConfig } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("Enhanced init command", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = createUniqueTestDir("test-enhanced-init");
	});

	afterEach(async () => {
		try {
			await safeCleanup(tmpDir);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	test("should detect existing project and preserve config during re-initialization", async () => {
		const core = new Core(tmpDir);

		// First initialization
		await core.initializeProject("Test Project");

		// Verify initial config
		const initialConfig = await core.filesystem.loadConfig();
		expect(initialConfig?.projectName).toBe("Test Project");
		expect(initialConfig?.autoCommit).toBe(false);

		// Modify some config values to test preservation
		expect(initialConfig).toBeTruthy();
		if (!initialConfig) throw new Error("Config not loaded");
		const modifiedConfig: BacklogConfig = {
			...initialConfig,
			projectName: initialConfig?.projectName ?? "Test Project",
			autoCommit: true,
			defaultEditor: "vim",
			defaultPort: 8080,
		};
		await core.filesystem.saveConfig(modifiedConfig);

		// Re-initialization should detect existing config
		const existingConfig = await core.filesystem.loadConfig();
		expect(existingConfig).toBeTruthy();
		expect(existingConfig?.projectName).toBe("Test Project");
		expect(existingConfig?.autoCommit).toBe(true);
		expect(existingConfig?.defaultEditor).toBe("vim");
		expect(existingConfig?.defaultPort).toBe(8080);

		// Verify backlog structure exists
		const configExists = await Bun.file(join(tmpDir, "backlog", "config.yml")).exists();
		expect(configExists).toBe(true);
	});

	test("should create default config for new project initialization", async () => {
		const core = new Core(tmpDir);

		// Check that no config exists initially
		const initialConfig = await core.filesystem.loadConfig();
		expect(initialConfig).toBeNull();

		// Initialize project
		await core.initializeProject("New Project");

		// Verify config was created with defaults
		const config = await core.filesystem.loadConfig();
		expect(config).toBeTruthy();
		expect(config?.projectName).toBe("New Project");
		expect(config?.autoCommit).toBe(false); // Default value
		expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
		expect(config?.dateFormat).toBe("yyyy-mm-dd");
	});

	test("should handle editor configuration in init flow", async () => {
		const core = new Core(tmpDir);

		// Test that editor can be set and saved
		const configWithEditor = {
			projectName: "Editor Test Project",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			defaultStatus: "To Do",
			dateFormat: "yyyy-mm-dd",
			backlogDirectory: "backlog",
			autoCommit: false,
			remoteOperations: true,
			defaultEditor: "code --wait",
		};

		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(configWithEditor);

		// Verify editor was saved
		const loadedConfig = await core.filesystem.loadConfig();
		expect(loadedConfig?.defaultEditor).toBe("code --wait");
	});

	test("should handle config with missing fields by filling defaults", async () => {
		const core = new Core(tmpDir);

		// Create a minimal config (like from an older version)
		const minimalConfig = {
			projectName: "Legacy Project",
			statuses: ["To Do", "Done"],
			labels: [],
			milestones: [],
			defaultStatus: "To Do",
			dateFormat: "yyyy-mm-dd",
		};

		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(minimalConfig);

		// Load config - should handle missing fields gracefully
		const loadedConfig = await core.filesystem.loadConfig();
		expect(loadedConfig).toBeTruthy();
		expect(loadedConfig?.projectName).toBe("Legacy Project");
		expect(loadedConfig?.autoCommit).toBeUndefined(); // Missing fields should be undefined, not cause errors
	});

	test("should preserve existing statuses and labels during re-initialization", async () => {
		const core = new Core(tmpDir);

		// Initialize with custom config
		const customConfig = {
			projectName: "Custom Project",
			statuses: ["Backlog", "In Progress", "Review", "Done"],
			labels: ["bug", "feature", "enhancement"],
			milestones: ["v1.0", "v2.0"],
			defaultStatus: "Backlog",
			dateFormat: "dd/mm/yyyy",
			maxColumnWidth: 30,
			backlogDirectory: "backlog",
			autoCommit: true,
		};

		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(customConfig);

		// Simulate re-initialization by loading existing config
		const existingConfig = await core.filesystem.loadConfig();
		expect(existingConfig).toBeTruthy();
		expect(existingConfig?.statuses).toEqual(["Backlog", "In Progress", "Review", "Done"]);
		expect(existingConfig?.labels).toEqual(["bug", "feature", "enhancement"]);
		expect(existingConfig?.milestones).toEqual(["v1.0", "v2.0"]);
		expect(existingConfig?.dateFormat).toBe("dd/mm/yyyy");
		expect(existingConfig?.maxColumnWidth).toBe(30);
	});

	test("should handle zero-padding configuration in init flow", async () => {
		const core = new Core(tmpDir);

		// Test config with zero-padding enabled
		const configWithPadding = {
			projectName: "Padded Project",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			defaultStatus: "To Do",
			dateFormat: "yyyy-mm-dd",
			backlogDirectory: "backlog",
			autoCommit: false,
			remoteOperations: true,
			zeroPaddedIds: 3,
		};

		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(configWithPadding);

		// Verify zero-padding was saved
		const loadedConfig = await core.filesystem.loadConfig();
		expect(loadedConfig?.zeroPaddedIds).toBe(3);

		// Test that zero-padding config is available for ID generation
		// (ID generation happens in CLI, not in Core.createTask)
		expect(loadedConfig?.zeroPaddedIds).toBe(3);
	});

	test("should handle zero-padding disabled configuration", async () => {
		const core = new Core(tmpDir);

		// Test config with zero-padding disabled
		const configWithoutPadding = {
			projectName: "Non-Padded Project",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			defaultStatus: "To Do",
			dateFormat: "yyyy-mm-dd",
			backlogDirectory: "backlog",
			autoCommit: false,
			remoteOperations: true,
			zeroPaddedIds: 0,
		};

		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(configWithoutPadding);

		// Verify zero-padding was saved as disabled
		const loadedConfig = await core.filesystem.loadConfig();
		expect(loadedConfig?.zeroPaddedIds).toBe(0);

		// Test that zero-padding is properly disabled
		// (ID generation happens in CLI, not in Core.createTask)
		expect(loadedConfig?.zeroPaddedIds).toBe(0);
	});

	test("should preserve existing zero-padding config during re-initialization", async () => {
		const core = new Core(tmpDir);

		// Create initial config with padding
		const initialConfig = {
			projectName: "Test Project",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			defaultStatus: "To Do",
			dateFormat: "yyyy-mm-dd",
			backlogDirectory: "backlog",
			autoCommit: false,
			zeroPaddedIds: 4,
		};

		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(initialConfig);

		// Simulate re-initialization by loading existing config
		const existingConfig = await core.filesystem.loadConfig();
		expect(existingConfig).toBeTruthy();
		expect(existingConfig?.zeroPaddedIds).toBe(4);

		// Verify the padding config is preserved
		// (ID generation happens in CLI, not in Core.createTask)
		expect(existingConfig?.zeroPaddedIds).toBe(4);
	});

	test("should create default task prefix when not specified", async () => {
		const core = new Core(tmpDir);

		// Initialize project without custom prefix
		await core.initializeProject("Default Prefix Project");

		// Verify default prefix is "task"
		const config = await core.filesystem.loadConfig();
		expect(config?.prefixes).toBeTruthy();
		expect(config?.prefixes?.task).toBe("task");
	});

	test("should handle custom task prefix in config", async () => {
		const core = new Core(tmpDir);

		// Create config with custom prefix
		const customPrefixConfig = {
			projectName: "JIRA Project",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			defaultStatus: "To Do",
			dateFormat: "yyyy-mm-dd",
			backlogDirectory: "backlog",
			autoCommit: false,
			prefixes: {
				task: "JIRA",
				draft: "draft",
			},
		};

		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(customPrefixConfig);

		// Verify custom prefix was saved
		const loadedConfig = await core.filesystem.loadConfig();
		expect(loadedConfig?.prefixes?.task).toBe("JIRA");
	});

	test("should preserve existing prefix during re-initialization", async () => {
		const core = new Core(tmpDir);

		// Create initial config with custom prefix
		const initialConfig = {
			projectName: "Custom Prefix Project",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			defaultStatus: "To Do",
			dateFormat: "yyyy-mm-dd",
			backlogDirectory: "backlog",
			autoCommit: false,
			prefixes: {
				task: "BUG",
				draft: "draft",
			},
		};

		await core.filesystem.ensureBacklogStructure();
		await core.filesystem.saveConfig(initialConfig);

		// Simulate re-initialization by loading existing config
		const existingConfig = await core.filesystem.loadConfig();
		expect(existingConfig).toBeTruthy();
		expect(existingConfig?.prefixes?.task).toBe("BUG");

		// Verify the prefix is preserved (cannot be changed after init)
		expect(existingConfig?.prefixes?.task).toBe("BUG");
	});

	test("initializeProject should use custom taskPrefix from advancedConfig", async () => {
		const core = new Core(tmpDir);

		// Initialize project with custom prefix via initializeProject function
		const result = await initializeProject(core, {
			projectName: "JIRA Init Test",
			integrationMode: "none",
			advancedConfig: {
				taskPrefix: "JIRA",
			},
		});

		expect(result.success).toBe(true);
		expect(result.config.prefixes?.task).toBe("JIRA");

		// Verify it was saved
		const loadedConfig = await core.filesystem.loadConfig();
		expect(loadedConfig?.prefixes?.task).toBe("JIRA");
	});

	test("initializeProject should preserve existing prefix on re-init", async () => {
		const core = new Core(tmpDir);

		// First init with custom prefix
		await initializeProject(core, {
			projectName: "Re-Init Test",
			integrationMode: "none",
			advancedConfig: {
				taskPrefix: "ISSUE",
			},
		});

		// Verify initial prefix
		const initialConfig = await core.filesystem.loadConfig();
		expect(initialConfig?.prefixes?.task).toBe("ISSUE");

		// Re-initialize (simulating re-init with different taskPrefix - should be ignored)
		const result = await initializeProject(core, {
			projectName: "Re-Init Test Updated",
			integrationMode: "none",
			existingConfig: initialConfig,
			advancedConfig: {
				taskPrefix: "CHANGED", // This should be ignored since existingConfig has prefixes
			},
		});

		// Verify prefix was preserved from existingConfig
		expect(result.config.prefixes?.task).toBe("ISSUE");
	});

	test("initializeProject should use default prefix when not specified", async () => {
		const core = new Core(tmpDir);

		// Initialize without custom prefix
		const result = await initializeProject(core, {
			projectName: "Default Prefix Init",
			integrationMode: "none",
		});

		expect(result.success).toBe(true);
		expect(result.config.prefixes?.task).toBe("task");
	});

	test("prefixes should persist to disk and reload correctly with new Core instance", async () => {
		const core1 = new Core(tmpDir);

		// Initialize with custom prefix
		await initializeProject(core1, {
			projectName: "Disk Persistence Test",
			integrationMode: "none",
			advancedConfig: {
				taskPrefix: "PERSIST",
			},
		});

		// Create a NEW Core instance to bypass any in-memory cache
		// This simulates what happens when a user runs a new command in a new process
		const core2 = new Core(tmpDir);
		const loadedConfig = await core2.filesystem.loadConfig();

		// This test would fail if prefixes aren't properly serialized/parsed from disk
		expect(loadedConfig?.prefixes?.task).toBe("PERSIST");
	});
});
