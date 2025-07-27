import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Config commands", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-config-commands");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Configure git for tests - required for CI
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await core.initializeProject("Test Config Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
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
