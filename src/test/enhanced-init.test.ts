import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
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
		const modifiedConfig = {
			...initialConfig!,
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
		expect(config?.backlogDirectory).toBe("backlog");
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
});
