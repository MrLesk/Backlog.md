import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
let TEST_DIR: string;
let core: Core;

describe("CLI task projects", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-task-project");
		await mkdir(TEST_DIR, { recursive: true });

		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "CLI Task Project Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("fails closed when no projects are configured", async () => {
		const created = await $`bun ${CLI_PATH} task create "Web task" --project web`.cwd(TEST_DIR).quiet().nothrow();
		expect(created.exitCode).toBe(1);
		expect(created.stderr.toString()).toContain("No projects are configured. Add a 'projects:' list to");

		const createHelp = await $`bun ${CLI_PATH} task create --help`.cwd(TEST_DIR).text();
		expect(createHelp).toContain("no projects configured; see 'backlog config get projects'");

		const getOutput = await $`bun ${CLI_PATH} config get projects`.cwd(TEST_DIR).text();
		expect(getOutput.trim()).toBe("No projects configured");
	});

	describe("with configured projects", () => {
		beforeEach(async () => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Expected test config");
			config.projects = ["Web", "API"];
			await core.filesystem.saveConfig(config);
		});

		it("creates and edits projected tasks with configured canonical casing", async () => {
			const created = await $`bun ${CLI_PATH} task create "Projected task" --project aPi --plain`.cwd(TEST_DIR).quiet();
			expect(created.exitCode).toBe(0);
			expect(created.stdout.toString()).toContain("Project: API");
			expect((await core.filesystem.loadTask("TASK-1"))?.project).toBe("API");
			const viewed = await $`bun ${CLI_PATH} task view TASK-1 --plain`.cwd(TEST_DIR).quiet();
			expect(viewed.stdout.toString()).toContain("Project: API");

			const edited = await $`bun ${CLI_PATH} task edit TASK-1 --project WEB --plain`.cwd(TEST_DIR).quiet();
			expect(edited.exitCode).toBe(0);
			expect(edited.stdout.toString()).toContain("Project: Web");
			expect((await core.filesystem.loadTask("TASK-1"))?.project).toBe("Web");

			await $`bun ${CLI_PATH} task edit TASK-1 --title "Still projected"`.cwd(TEST_DIR).quiet();
			expect((await core.filesystem.loadTask("TASK-1"))?.project).toBe("Web");

			const cleared = await $`bun ${CLI_PATH} task edit TASK-1 --project "" --plain`.cwd(TEST_DIR).quiet();
			expect(cleared.stdout.toString()).not.toContain("Project:");
			expect((await core.filesystem.loadTask("TASK-1"))?.project).toBeUndefined();
		});

		it("rejects invalid values and keeps unprojected tasks unprojected", async () => {
			const invalidCreate = await $`bun ${CLI_PATH} task create "Invalid project" --project mobile`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(invalidCreate.exitCode).toBe(1);
			expect(invalidCreate.stderr.toString()).toContain("Invalid project: mobile. Valid projects are: Web, API");

			await $`bun ${CLI_PATH} task create "Unprojected task"`.cwd(TEST_DIR).quiet();
			const invalidEdit = await $`bun ${CLI_PATH} task edit TASK-1 --project mobile`.cwd(TEST_DIR).quiet().nothrow();
			expect(invalidEdit.exitCode).toBe(1);
			expect(invalidEdit.stderr.toString()).toContain("Invalid project: mobile. Valid projects are: Web, API");

			const edited = await $`bun ${CLI_PATH} task edit TASK-1 --title "Still unprojected" --plain`
				.cwd(TEST_DIR)
				.quiet();
			expect(edited.stdout.toString()).not.toContain("Project:");
			expect((await core.filesystem.loadTask("TASK-1"))?.project).toBeUndefined();
		});

		it("documents configured values and exposes them through read-only config commands", async () => {
			const getOutput = await $`bun ${CLI_PATH} config get projects`.cwd(TEST_DIR).text();
			expect(getOutput.trim()).toBe("Web, API");

			const listOutput = await $`bun ${CLI_PATH} config list`.cwd(TEST_DIR).text();
			expect(listOutput).toContain("projects: [Web, API]");

			const createHelp = await $`bun ${CLI_PATH} task create --help`.cwd(TEST_DIR).text();
			const editHelp = await $`bun ${CLI_PATH} task edit --help`.cwd(TEST_DIR).text();
			for (const output of [createHelp, editHelp]) {
				expect(output).toContain("--project <project>");
				expect(output).toContain("project: one of configured projects: Web, API");
			}
		});

		it("rejects setting projects directly through config set", async () => {
			const result = await $`bun ${CLI_PATH} config set projects "Web,API"`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain(
				"projects cannot be set directly. View current values with 'backlog config get projects'.",
			);
		});

		it("completes configured project values for create, edit, list, and search", async () => {
			for (const line of [
				"backlog task create --project ",
				"backlog task edit TASK-1 --project ",
				"backlog task list --project ",
				"backlog search --project ",
			]) {
				const result = await $`bun ${CLI_PATH} completion __complete ${line} ${String(line.length)}`
					.cwd(TEST_DIR)
					.quiet();
				expect(result.stdout.toString().trim().split("\n")).toEqual(["Web", "API"]);
			}
		});
	});
});
