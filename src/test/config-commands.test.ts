import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";

describe("Config commands", () => {
	const testDir = join(process.cwd(), "test-config-commands");
	let core: Core;

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
		await mkdir(testDir, { recursive: true });

		core = new Core(testDir);
		await core.initializeProject("Test Config Project");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should save and load defaultEditor config", async () => {
		// Load initial config
		const config = await core.filesystem.loadConfig();
		expect(config).toBeTruthy();
		expect(config!.defaultEditor).toBeUndefined();

		// Set defaultEditor
		config!.defaultEditor = "nano";
		await core.filesystem.saveConfig(config!);

		// Reload config and verify it was saved
		const reloadedConfig = await core.filesystem.loadConfig();
		expect(reloadedConfig).toBeTruthy();
		expect(reloadedConfig!.defaultEditor).toBe("nano");
	});

	it("should handle config with and without defaultEditor", async () => {
		// Initially undefined
		let config = await core.filesystem.loadConfig();
		expect(config!.defaultEditor).toBeUndefined();

		// Set to a value
		config!.defaultEditor = "vi";
		await core.filesystem.saveConfig(config!);

		config = await core.filesystem.loadConfig();
		expect(config!.defaultEditor).toBe("vi");

		// Clear the value
		config!.defaultEditor = undefined;
		await core.filesystem.saveConfig(config!);

		config = await core.filesystem.loadConfig();
		expect(config!.defaultEditor).toBeUndefined();
	});

	it("should preserve other config values when setting defaultEditor", async () => {
		let config = await core.filesystem.loadConfig();
		const originalProjectName = config!.projectName;
		const originalStatuses = [...config!.statuses];

		// Set defaultEditor
		config!.defaultEditor = "code";
		await core.filesystem.saveConfig(config!);

		// Reload and verify other values are preserved
		config = await core.filesystem.loadConfig();
		expect(config!.defaultEditor).toBe("code");
		expect(config!.projectName).toBe(originalProjectName);
		expect(config!.statuses).toEqual(originalStatuses);
	});
});
