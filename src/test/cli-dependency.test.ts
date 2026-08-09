import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();

// Runs the CLI with stdio reported as a TTY so interactive-only behavior (the edit wizard) applies.
async function runCliWithInteractiveTty(cwd: string, args: string[]) {
	const entryPath = join(cwd, "interactive-cli-entry.ts");
	await writeFile(
		entryPath,
		`Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
await import(${JSON.stringify(pathToFileURL(CLI_PATH).href)});
`,
	);
	return await $`bun ${entryPath} ${args}`.cwd(cwd).quiet().nothrow();
}

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

	it("merges --depends-on and --dep on task create", async () => {
		await $`bun ${CLI_PATH} task create "Base task one"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Base task two"`.cwd(testDir).quiet();

		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1 --dep TASK-2`.cwd(testDir).quiet();

		expect((await core.filesystem.loadTask("TASK-3"))?.dependencies).toEqual(["TASK-1", "TASK-2"]);
	});

	it("rejects empty dependency values on task create and draft create without creating anything", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();

		const emptyDependsOn = await $`bun ${CLI_PATH} task create "Empty depends-on" --depends-on ""`
			.cwd(testDir)
			.quiet()
			.nothrow();
		expect(emptyDependsOn.exitCode).toBe(1);
		// Create has nothing to clear, so the empty value stays an error here even though task edit clears.
		expect(emptyDependsOn.stderr.toString()).toContain(
			"Cannot use an empty value with --depends-on or --dep. Omit the flag to leave task dependencies unset.",
		);

		const emptyDep = await $`bun ${CLI_PATH} task create "Empty dep" --dep ""`.cwd(testDir).quiet().nothrow();
		expect(emptyDep.exitCode).toBe(1);
		expect(emptyDep.stderr.toString()).toContain("Cannot use an empty value with --depends-on or --dep");

		const emptyAlongsideValue =
			await $`bun ${CLI_PATH} task create "Empty alongside value" --depends-on "" --dep TASK-1`
				.cwd(testDir)
				.quiet()
				.nothrow();
		expect(emptyAlongsideValue.exitCode).toBe(1);
		expect(emptyAlongsideValue.stderr.toString()).toContain("Cannot use an empty value with --depends-on or --dep");

		const emptyDraftDep = await $`bun ${CLI_PATH} task create "Empty draft dep" --draft --dep ""`
			.cwd(testDir)
			.quiet()
			.nothrow();
		expect(emptyDraftDep.exitCode).toBe(1);
		expect(emptyDraftDep.stderr.toString()).toContain("Cannot use an empty value with --depends-on or --dep");

		expect(await core.filesystem.loadTask("TASK-2")).toBeNull();
		expect(await core.filesystem.listDrafts()).toHaveLength(0);
	});

	it("clears dependencies with --clear-deps", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1`.cwd(testDir).quiet();

		const result = await $`bun ${CLI_PATH} task edit 2 --clear-deps --plain`.cwd(testDir).quiet();

		expect(result.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual([]);
	});

	it("clears dependencies with --clear-deps in an interactive terminal", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1`.cwd(testDir).quiet();

		const result = await runCliWithInteractiveTty(testDir, ["task", "edit", "2", "--clear-deps"]);

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("Updated task TASK-2");
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual([]);
	});

	// On edit an explicit empty value is the second spelling of --clear-deps, matching `-a ""`.
	it("clears dependencies with an explicit empty value", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1`.cwd(testDir).quiet();

		const emptyDependsOn = await $`bun ${CLI_PATH} task edit 2 --depends-on ${""} --plain`.cwd(testDir).quiet();
		expect(emptyDependsOn.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual([]);

		await $`bun ${CLI_PATH} task edit 2 --depends-on TASK-1`.cwd(testDir).quiet();
		const emptyDep = await $`bun ${CLI_PATH} task edit 2 --dep ${""} --plain`.cwd(testDir).quiet();
		expect(emptyDep.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual([]);
	});

	it("accepts an explicit empty value together with --clear-deps", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1`.cwd(testDir).quiet();

		const result = await $`bun ${CLI_PATH} task edit 2 --clear-deps --dep ${""} --plain`.cwd(testDir).quiet().nothrow();

		expect(result.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual([]);
	});

	// Blank values normalize away exactly as they do inside one value (`--dep "TASK-1,"`) and for `-a ""`,
	// so a real dependency alongside a blank one still sets that dependency.
	it("ignores an empty value when a dependency value is also given", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Dependent task"`.cwd(testDir).quiet();

		const result = await $`bun ${CLI_PATH} task edit 2 --depends-on ${""} --dep TASK-1 --plain`.cwd(testDir).quiet();

		expect(result.exitCode).toBe(0);
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual(["TASK-1"]);
	});

	it("rejects conflicting dependency edits without changing dependencies", async () => {
		await $`bun ${CLI_PATH} task create "Base task"`.cwd(testDir).quiet();
		await $`bun ${CLI_PATH} task create "Dependent task" --depends-on TASK-1`.cwd(testDir).quiet();

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
