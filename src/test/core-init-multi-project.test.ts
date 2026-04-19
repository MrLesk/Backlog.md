import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { initializeProject } from "../core/init.ts";
import { readProjectRegistry } from "../utils/project-registry.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

describe("core init multi-project support", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = createUniqueTestDir("test-core-init-multi-project");
	});

	afterEach(async () => {
		await safeCleanup(tmpDir);
	});

	test("initializeProject creates a project-scoped backlog and registry entry", async () => {
		const core = new Core(tmpDir);

		const result = await initializeProject(core, {
			projectName: "xx01",
			integrationMode: "none",
		});

		expect(result.success).toBe(true);
		expect(result.config.projectName).toBe("xx01");

		const registry = await readProjectRegistry(tmpDir);
		expect(registry).toEqual({
			version: 1,
			defaultProject: "xx01",
			projects: [{ key: "xx01" }],
		});

		expect(await Bun.file(join(tmpDir, "backlog", "xx01", "config.yml")).exists()).toBe(true);

		const projectCore = new Core(tmpDir, { backlogRoot: join(tmpDir, "backlog", "xx01") });
		const loadedConfig = await projectCore.filesystem.loadConfig();
		expect(loadedConfig?.projectName).toBe("xx01");
		expect(projectCore.filesystem.backlogDirName).toBe("backlog/xx01");
	});

	test("initializeTestProject keeps the passed-in core usable after init", async () => {
		const core = new Core(tmpDir);

		await initializeTestProject(core, "xx01");

		expect(core.filesystem.backlogDirName).toBe("backlog/xx01");
		expect(await Bun.file(join(tmpDir, "backlog", "xx01", "config.yml")).exists()).toBe(true);

		const loadedConfig = await core.filesystem.loadConfig();
		expect(loadedConfig?.projectName).toBe("xx01");
	});
});
