import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("CLI dependency options", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-cli-dependency");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();
		core = new Core(testDir);
		await initializeTestProject(core, "CLI dependency options");
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

	it("rejects a dependency that does not exist", async () => {
		const result = await $`bun ${CLI_PATH} task create "Dependent task" --dep TASK-999`.cwd(testDir).quiet().nothrow();

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("The following dependencies do not exist: TASK-999");
	});
});
