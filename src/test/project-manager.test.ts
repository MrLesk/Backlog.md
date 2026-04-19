import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { ProjectManager } from "../core/project-manager.ts";
import { writeProjectRegistry } from "../utils/project-registry.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("project-scoped core", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("backlog-project-manager");
		await mkdir(join(testDir, "backlog"), { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("binds FileSystem directories to an explicit project backlog root", () => {
		const backlogRoot = join(testDir, "backlog", "xx02");
		const core = new Core(testDir, { backlogRoot });

		expect(core.filesystem.backlogDir).toBe(backlogRoot);
		expect(core.filesystem.backlogDirName).toBe("backlog/xx02");
		expect(core.filesystem.tasksDir).toBe(join(backlogRoot, "tasks"));
		expect(core.filesystem.configFilePath).toBe(join(backlogRoot, "config.yml"));
	});

	it("loads config.yaml for an explicit project backlog root", async () => {
		const backlogRoot = join(testDir, "backlog", "xx02");
		await mkdir(backlogRoot, { recursive: true });
		await writeFile(
			join(backlogRoot, "config.yaml"),
			'project_name: "Yaml Project"\nstatuses: ["To Do"]\nlabels: []\ndate_format: "yyyy-mm-dd"\n',
		);

		const core = new Core(testDir, { backlogRoot });
		const config = await core.filesystem.loadConfig();

		expect(config?.projectName).toBe("Yaml Project");
		expect(core.filesystem.configFilePath).toBe(join(backlogRoot, "config.yaml"));
	});

	it("caches Core instances per project key", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [
				{ key: "xx01", path: "apps/web" },
				{ key: "xx02", path: "packages/sdk" },
			],
		});

		const manager = new ProjectManager(testDir);
		const first = await manager.getCore({ project: "xx01" });
		const second = await manager.getCore({ project: "xx01" });

		expect(first).toBe(second);
		expect(first.filesystem.backlogDir).toBe(join(testDir, "backlog", "xx01"));
		expect(first.filesystem.tasksDir).toBe(join(testDir, "backlog", "xx01", "tasks"));
	});

	it("keeps watcher-enabled cores separate from non-watching cached cores", async () => {
		await writeProjectRegistry(testDir, {
			version: 1,
			defaultProject: "xx01",
			projects: [{ key: "xx01", path: "apps/web" }],
		});

		const manager = new ProjectManager(testDir);
		const nonWatching = await manager.getCore({ project: "xx01" });
		const watching = await manager.getCore({ project: "xx01", enableWatchers: true });
		const watchingAgain = await manager.getCore({ project: "xx01", enableWatchers: true });

		expect(watching).not.toBe(nonWatching);
		expect(watchingAgain).toBe(watching);
	});
});
