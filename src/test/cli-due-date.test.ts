import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();

describe("CLI due dates", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = createUniqueTestDir("cli-due-date");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		await initializeTestProject(new Core(testDir), "CLI due dates");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("creates, lists, edits, and clears task due dates", async () => {
		const created = await $`bun ${CLI_PATH} task create "Ship release" --due-date 2026-08-10 --plain`
			.cwd(testDir)
			.text();
		// A due date names a day, so it is shown as written with no time and no (UTC) marker.
		expect(created).toContain("Due: 2026-08-10");
		expect(created).not.toContain("Due: 2026-08-10 ");

		const listed = await $`bun ${CLI_PATH} task list --plain`.cwd(testDir).text();
		expect(listed).toContain("due 2026-08-10)");

		const edited = await $`bun ${CLI_PATH} task edit 1 --due-date 2026-08-12 --plain`.cwd(testDir).text();
		expect(edited).toContain("Due: 2026-08-12");

		await $`bun ${CLI_PATH} task edit 1 --clear-due-date`.cwd(testDir).quiet();
		const task = await new Core(testDir).filesystem.loadTask("task-1");
		expect(task?.dueDate).toBeUndefined();
	});

	it("rejects invalid and conflicting task due date flags", async () => {
		const invalid = await $`bun ${CLI_PATH} task create "Invalid due" --due-date 10/08/2026`
			.cwd(testDir)
			.nothrow()
			.quiet();
		expect(invalid.exitCode).toBe(1);
		expect(invalid.stderr.toString()).toContain("YYYY-MM-DD");

		await $`bun ${CLI_PATH} task create "Valid task"`.cwd(testDir).quiet();
		const conflict = await $`bun ${CLI_PATH} task edit 1 --due-date 2026-08-10 --clear-due-date`
			.cwd(testDir)
			.nothrow()
			.quiet();
		expect(conflict.exitCode).toBe(1);
		expect(conflict.stderr.toString()).toContain("Cannot use --due-date and --clear-due-date together");
	});

	it("supports milestone due dates through add and rename", async () => {
		const added = await $`bun ${CLI_PATH} milestone add "Release" --due-date 2026-09-01`.cwd(testDir).text();
		expect(added).toContain("Due: 2026-09-01");

		await $`bun ${CLI_PATH} milestone rename Release Release --due-date 2026-09-02`.cwd(testDir).quiet();
		let milestone = await new Core(testDir).filesystem.loadMilestone("m-0");
		expect(milestone?.dueDate).toBe("2026-09-02");

		await $`bun ${CLI_PATH} milestone rename Release Release --clear-due-date`.cwd(testDir).quiet();
		milestone = await new Core(testDir).filesystem.loadMilestone("m-0");
		expect(milestone?.dueDate).toBeUndefined();
	});
});
