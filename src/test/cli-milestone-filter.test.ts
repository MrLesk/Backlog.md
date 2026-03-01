import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI milestone filtering", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-milestone-filter");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Milestone Filter Test Project");

		await core.createTask(
			{
				id: "task-1",
				title: "Milestone task one",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Task in release milestone",
				milestone: "Release-1",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-2",
				title: "Milestone task two",
				status: "In Progress",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Task in same milestone with different case",
				milestone: "release-1",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-3",
				title: "Other milestone task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Task in different milestone",
				milestone: "Release-2",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-4",
				title: "No milestone task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Task without milestone",
			},
			false,
		);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - unique directory names prevent conflicts
		}
	});

	it("filters by milestone with case-insensitive exact matching", async () => {
		const result = await $`bun ${cliPath} task list --milestone RELEASE-1 --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const output = result.stdout.toString();

		expect(output).toContain("TASK-1 - Milestone task one");
		expect(output).toContain("TASK-2 - Milestone task two");
		expect(output).not.toContain("TASK-3 - Other milestone task");
		expect(output).not.toContain("TASK-4 - No milestone task");
	});

	it("supports -m shorthand and combines milestone with status filter", async () => {
		const result = await $`bun ${cliPath} task list -m release-1 --status "To Do" --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const output = result.stdout.toString();

		expect(output).toContain("TASK-1 - Milestone task one");
		expect(output).not.toContain("TASK-2 - Milestone task two");
		expect(output).not.toContain("TASK-3 - Other milestone task");
		expect(output).not.toContain("TASK-4 - No milestone task");
	});

	it("preserves existing listing behavior when milestone filter is omitted", async () => {
		const result = await $`bun ${cliPath} task list --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const output = result.stdout.toString();

		expect(output).toContain("TASK-1 - Milestone task one");
		expect(output).toContain("TASK-2 - Milestone task two");
		expect(output).toContain("TASK-3 - Other milestone task");
		expect(output).toContain("TASK-4 - No milestone task");
	});
});
