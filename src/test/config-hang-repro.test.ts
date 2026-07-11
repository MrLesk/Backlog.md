import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { FileSystem } from "../file-system/operations.ts";
import { createUniqueTestDir, safeCleanup, withTimeout } from "./test-utils.ts";

describe("Config Loading & Migration", () => {
	let testRoot: string;
	let backlogDir: string;
	let configPath: string;

	beforeEach(async () => {
		testRoot = createUniqueTestDir("test-config-migration");
		backlogDir = join(testRoot, "backlog");
		configPath = join(backlogDir, "config.yml");
		await mkdir(backlogDir, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(testRoot);
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

		const loadedConfig = await withTimeout(fs.loadConfig(), "config loading", 5000);

		expect(loadedConfig).toBeTruthy();
		expect(loadedConfig?.projectName).toBe("Test Project");
	});

	it("should load config from .backlog directory without migrating it", async () => {
		// Create a .backlog directory instead of backlog
		const hiddenBacklogDir = join(testRoot, ".backlog");
		const hiddenConfigPath = join(hiddenBacklogDir, "config.yml");

		await rm(backlogDir, { recursive: true, force: true });
		await mkdir(hiddenBacklogDir, { recursive: true });

		const hiddenConfig = `project_name: "Legacy Project"
statuses: ["To Do", "In Progress", "Done"]
labels: []
milestones: []
default_status: "To Do"
date_format: "yyyy-mm-dd"
max_column_width: 20
auto_commit: false`;

		await writeFile(hiddenConfigPath, hiddenConfig);

		const fs = new FileSystem(testRoot);
		const config = await fs.loadConfig();

		// Check that config was loaded
		expect(config).toBeTruthy();
		expect(config?.projectName).toBe("Legacy Project");

		// Check that the directory stayed in place
		const newBacklogExists = await Bun.file(join(testRoot, "backlog", "config.yml")).exists();
		const oldBacklogExists = await Bun.file(join(testRoot, ".backlog", "config.yml")).exists();

		expect(newBacklogExists).toBe(false);
		expect(oldBacklogExists).toBe(true);
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
