import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { initializeProject } from "../core/init.ts";
import { readProjectRegistry, writeProjectRegistry } from "../utils/project-registry.ts";
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

	test("initializeProject reuses an existing registry container root", async () => {
		await mkdir(join(tmpDir, ".backlog"), { recursive: true });
		await writeProjectRegistry(tmpDir, {
			version: 1,
			defaultProject: "legacy",
			projects: [{ key: "legacy" }],
		});

		const core = new Core(tmpDir);
		await initializeProject(core, {
			projectName: "New Project",
			integrationMode: "none",
		});

		expect(await Bun.file(join(tmpDir, ".backlog", "projects.yml")).exists()).toBe(true);
		expect(await Bun.file(join(tmpDir, ".backlog", "new-project", "config.yml")).exists()).toBe(true);
		expect(await Bun.file(join(tmpDir, "backlog", "new-project", "config.yml")).exists()).toBe(false);
		const registry = await readProjectRegistry(tmpDir);
		expect(registry?.projects.map((project) => project.key)).toContain("new-project");
	});

	test("initializeProject rejects derived project key collisions", async () => {
		const core = new Core(tmpDir);

		await initializeProject(core, {
			projectName: "Foo Bar",
			integrationMode: "none",
		});

		await expect(
			initializeProject(core, {
				projectName: "Foo-Bar",
				integrationMode: "none",
			}),
		).rejects.toThrow("Project key collision: foo-bar already exists in the project registry.");
	});

	test("initializeTestProject keeps the passed-in core usable after init", async () => {
		const core = new Core(tmpDir);

		await initializeTestProject(core, "xx01");

		expect(core.filesystem.backlogDirName).toBe("backlog/xx01");
		expect(await Bun.file(join(tmpDir, "backlog", "xx01", "config.yml")).exists()).toBe(true);

		const loadedConfig = await core.filesystem.loadConfig();
		expect(loadedConfig?.projectName).toBe("xx01");
	});

	test("initializeTestProject auto-commit stages the registry and leaves the repo clean", async () => {
		const core = new Core(tmpDir);

		await mkdir(tmpDir, { recursive: true });
		await $`git init -b main`.cwd(tmpDir).quiet();
		await $`git config user.name "Test User"`.cwd(tmpDir).quiet();
		await $`git config user.email test@example.com`.cwd(tmpDir).quiet();

		await initializeTestProject(core, "Auto Commit Project", true);

		expect(await Bun.file(join(tmpDir, "backlog", "projects.yml")).exists()).toBe(true);
		const headFiles = await $`git show --name-only --format= HEAD`.cwd(tmpDir).text();
		expect(headFiles).toContain("backlog/projects.yml");
		expect(await core.gitOps.isClean()).toBe(true);
	});
});
