import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { FileSystem } from "../file-system/operations.ts";
import type { BacklogConfig } from "../types/index.ts";

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

		const loadedConfig = (await Promise.race([fs.loadConfig(), timeoutPromise])) as BacklogConfig | null;

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

	it("migrates legacy config milestones into milestone files and removes config milestones key", async () => {
		const config = `project_name: "Legacy Milestones Project"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: ["Release 1", "Release 2"]
default_status: "To Do"
date_format: "yyyy-mm-dd"
max_column_width: 20
auto_commit: false`;

		await writeFile(configPath, config);
		const core = new Core(testRoot);
		await core.ensureConfigMigrated();

		const migratedMilestones = await core.filesystem.listMilestones();
		expect(migratedMilestones.map((milestone) => milestone.title).sort()).toEqual(["Release 1", "Release 2"]);

		const rewrittenConfig = await Bun.file(configPath).text();
		expect(rewrittenConfig).not.toContain("milestones:");
	});

	it("migrates quoted legacy milestone names containing commas", async () => {
		const config = `project_name: "Legacy Milestones Project"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: ["Release, Part 1", "Release 2"]
default_status: "To Do"
date_format: "yyyy-mm-dd"
max_column_width: 20
auto_commit: false`;

		await writeFile(configPath, config);
		const core = new Core(testRoot);
		await core.ensureConfigMigrated();

		const migratedMilestones = await core.filesystem.listMilestones();
		expect(migratedMilestones.map((milestone) => milestone.title).sort()).toEqual(["Release 2", "Release, Part 1"]);
	});

	it("migrates multiline legacy milestone list values with comments", async () => {
		const config = `project_name: "Legacy Milestones Project"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones:
  - "Release 1"
  - Release 2 # comment
  - 'Release #3'
default_status: "To Do"
date_format: "yyyy-mm-dd"
max_column_width: 20
auto_commit: false`;

		await writeFile(configPath, config);
		const core = new Core(testRoot);
		await core.ensureConfigMigrated();

		const migratedMilestones = await core.filesystem.listMilestones();
		expect(migratedMilestones.map((milestone) => milestone.title).sort()).toEqual([
			"Release #3",
			"Release 1",
			"Release 2",
		]);

		const rewrittenConfig = await Bun.file(configPath).text();
		expect(rewrittenConfig).not.toContain("milestones:");
	});

	it("migrates multiline bracketed legacy milestone arrays", async () => {
		const config = `project_name: "Legacy Milestones Project"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: [
  "Release 1",
  "Release 2"
]
default_status: "To Do"
date_format: "yyyy-mm-dd"
max_column_width: 20
auto_commit: false`;

		await writeFile(configPath, config);
		const core = new Core(testRoot);
		await core.ensureConfigMigrated();

		const migratedMilestones = await core.filesystem.listMilestones();
		expect(migratedMilestones.map((milestone) => milestone.title).sort()).toEqual(["Release 1", "Release 2"]);
	});

	it("migrates single-quoted legacy milestones with escaped apostrophes", async () => {
		const config = `project_name: "Legacy Milestones Project"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones:
  - 'Release ''Alpha'''
default_status: "To Do"
date_format: "yyyy-mm-dd"
max_column_width: 20
auto_commit: false`;

		await writeFile(configPath, config);
		const core = new Core(testRoot);
		await core.ensureConfigMigrated();

		const migratedMilestones = await core.filesystem.listMilestones();
		expect(migratedMilestones.map((milestone) => milestone.title)).toEqual(["Release 'Alpha'"]);
	});
});
