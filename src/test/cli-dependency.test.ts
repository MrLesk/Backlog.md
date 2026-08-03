import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();

describe("CLI dependency options", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-cli-dependency");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "CLI dependency options");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("creates and edits dependencies through both public flags", async () => {
		await $`bun ${CLI_PATH} task create "Base task one"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Base task two"`.cwd(testDir).quiet();

		const created = await $`bun ${CLI_PATH} task create "Dependent task" --dep 1 --plain`.cwd(testDir).quiet();
		expect(created.stdout.toString()).toContain("Task TASK-3 - Dependent task");
		expect((await core.filesystem.loadTask("TASK-3"))?.dependencies).toEqual(["TASK-1"]);

		const edited = await $`bun ${CLI_PATH} task edit 3 --depends-on TASK-1,TASK-2 --plain`.cwd(testDir).quiet();
		expect(edited.stdout.toString()).toContain("Task TASK-3 - Dependent task");
		expect((await core.filesystem.loadTask("TASK-3"))?.dependencies).toEqual(["TASK-1", "TASK-2"]);

		const viewed = await $`bun ${CLI_PATH} task view 3 --plain`.cwd(testDir).quiet();
		expect(viewed.stdout.toString()).toContain("Dependencies: TASK-1, TASK-2");
	});

	it("accumulates repeated dependency flags", async () => {
		await $`bun ${CLI_PATH} task create "Base task one"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Base task two"`.cwd(testDir).quiet();

		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1 --depends-on TASK-2`.cwd(testDir).quiet();

		expect((await core.filesystem.loadTask("TASK-3"))?.dependencies).toEqual(["TASK-1", "TASK-2"]);
	});

	it("clears dependencies with --clear-deps", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1`.cwd(testDir).quiet();

		const result = await $`bun ${CLI_PATH} task edit 2 --clear-deps --plain`.cwd(testDir).quiet();

		expect(result.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual([]);
	});

	it("rejects empty and conflicting dependency edits without changing dependencies", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1`.cwd(testDir).quiet();

		const emptyDependsOn = await $`bun ${CLI_PATH} task edit 2 --depends-on ""`.cwd(testDir).quiet().nothrow();
		expect(emptyDependsOn.exitCode).toBe(1);
		expect(emptyDependsOn.stderr.toString()).toContain("Cannot use an empty value with --depends-on or --dep");

		const emptyDep = await $`bun ${CLI_PATH} task edit 2 --dep ""`.cwd(testDir).quiet().nothrow();
		expect(emptyDep.exitCode).toBe(1);
		expect(emptyDep.stderr.toString()).toContain("Cannot use an empty value with --depends-on or --dep");

		const conflicting = await $`bun ${CLI_PATH} task edit 2 --clear-deps --depends-on TASK-1`
			.cwd(testDir)
			.quiet()
			.nothrow();
		expect(conflicting.exitCode).toBe(1);
		expect(conflicting.stderr.toString()).toContain("Cannot combine --clear-deps with --depends-on or --dep");

		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual(["TASK-1"]);
	});

	it("documents --clear-deps in task edit help", async () => {
		const result = await $`bun ${CLI_PATH} task edit --help`.cwd(testDir).quiet();

		expect(result.stdout.toString()).toContain("--clear-deps");
	});

	it("rejects a dependency that does not exist", async () => {
		const result = await $`bun ${CLI_PATH} task create "Dependent task" --dep TASK-999`.cwd(testDir).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("The following dependencies do not exist: TASK-999");
	});
});
