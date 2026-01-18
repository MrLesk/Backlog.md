import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

const readConfigFile = async (root: string): Promise<string> => {
	const configPath = join(root, "backlog", "config.yml");
	return await readFile(configPath, "utf8");
};

describe("Definition of Done", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-definition-of-done");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("DoD Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("loads and saves definition_of_done in config", async () => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		expect(config).toBeTruthy();

		if (config) {
			config.definitionOfDone = ["Run tests", "Update docs"];
			await core.filesystem.saveConfig(config);
		}

		const reloaded = await core.filesystem.loadConfig();
		expect(reloaded?.definitionOfDone).toEqual(["Run tests", "Update docs"]);

		const rawConfig = await readConfigFile(TEST_DIR);
		expect(rawConfig).toContain("definition_of_done");
		expect(rawConfig).toContain("Run tests");
	});

	it("applies Definition of Done defaults on create", async () => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.definitionOfDone = ["Check formatting", "Add notes"];
			await core.filesystem.saveConfig(config);
		}

		const { task } = await core.createTaskFromInput({ title: "DoD task" });
		const saved = await core.filesystem.loadTask(task.id);
		expect(saved).not.toBeNull();
		const body = saved?.rawContent ?? "";
		expect(body).toContain("## Definition of Done");
		expect(body).toContain("<!-- DOD:BEGIN -->");
		expect(body).toContain("- [ ] #1 Check formatting");
		expect(body).toContain("- [ ] #2 Add notes");
	});

	it("can disable Definition of Done defaults on create", async () => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.definitionOfDone = ["Run tests"];
			await core.filesystem.saveConfig(config);
		}

		const { task } = await core.createTaskFromInput({
			title: "DoD overrides",
			disableDefinitionOfDoneDefaults: true,
			definitionOfDoneAdd: ["Custom checklist"],
		});
		const saved = await core.filesystem.loadTask(task.id);
		const body = saved?.rawContent ?? "";
		expect(body).toContain("## Definition of Done");
		expect(body).toContain("- [ ] #1 Custom checklist");
		expect(body).not.toContain("Run tests");
	});

	it("supports add/remove/check/uncheck Definition of Done items", async () => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.definitionOfDone = ["First item"];
			await core.filesystem.saveConfig(config);
		}

		const { task } = await core.createTaskFromInput({ title: "DoD edits" });

		await core.editTask(task.id, { addDefinitionOfDone: [{ text: "Second item", checked: false }] });
		let updated = await core.filesystem.loadTask(task.id);
		expect(updated?.rawContent).toContain("- [ ] #1 First item");
		expect(updated?.rawContent).toContain("- [ ] #2 Second item");

		await core.editTask(task.id, { checkDefinitionOfDone: [2] });
		updated = await core.filesystem.loadTask(task.id);
		expect(updated?.rawContent).toContain("- [x] #2 Second item");

		await core.editTask(task.id, { removeDefinitionOfDone: [1] });
		updated = await core.filesystem.loadTask(task.id);
		const body = updated?.rawContent ?? "";
		expect(body).not.toContain("First item");
		expect(body).toContain("- [x] #1 Second item");

		await core.editTask(task.id, { uncheckDefinitionOfDone: [1] });
		updated = await core.filesystem.loadTask(task.id);
		expect(updated?.rawContent).toContain("- [ ] #1 Second item");
	});
});
