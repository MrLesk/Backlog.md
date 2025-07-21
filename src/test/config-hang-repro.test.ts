import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";

describe("Config Loading & Migration", () => {
	const testRoot = "/tmp/test-config-migration";
	const backlogDir = join(testRoot, "backlog");
	const configPath = join(backlogDir, "config.yml");

	beforeEach(async () => {
		await rm(testRoot, { recursive: true, force: true });
		await mkdir(backlogDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testRoot, { recursive: true, force: true });
	});

	it("should load config from standard backlog directory", async () => {
		const config = `project_name: "Test Project"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: []
default_status: "To Do"
date_format: "yyyy-mm-dd"
max_column_width: 20
auto_commit: false`;

		await writeFile(configPath, config);

		const fs = new FileSystem(testRoot);

		// This should complete without hanging
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error("Config loading timed out - infinite loop detected!")), 5000);
		});

		const loadedConfig = (await Promise.race([fs.loadConfig(), timeoutPromise])) as any;

		expect(loadedConfig).toBeTruthy();
		expect(loadedConfig?.projectName).toBe("Test Project");
	});

	it("should migrate legacy .backlog directory to backlog", async () => {
		// Create a legacy .backlog directory instead of backlog
		const legacyBacklogDir = join(testRoot, ".backlog");
		const legacyConfigPath = join(legacyBacklogDir, "config.yml");

		await rm(backlogDir, { recursive: true, force: true });
		await mkdir(legacyBacklogDir, { recursive: true });

		const legacyConfig = `project_name: "Legacy Project"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: []
default_status: "To Do"
date_format: "yyyy-mm-dd"
max_column_width: 20
auto_commit: false`;

		await writeFile(legacyConfigPath, legacyConfig);

		const fs = new FileSystem(testRoot);
		const config = await fs.loadConfig();

		// Check that config was loaded
		expect(config).toBeTruthy();
		expect(config?.projectName).toBe("Legacy Project");

		// Check that the directory was renamed
		const newBacklogExists = await Bun.file(join(testRoot, "backlog", "config.yml")).exists();
		const oldBacklogExists = await Bun.file(join(testRoot, ".backlog", "config.yml")).exists();

		expect(newBacklogExists).toBe(true);
		expect(oldBacklogExists).toBe(false);
	});
});
