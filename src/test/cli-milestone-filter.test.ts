import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../index.ts";
import { listTasksViaCore } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI milestone filtering", () => {
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
		await initializeTestProject(core, "Milestone Filter Test Project");
		const newMilestone = await core.filesystem.createMilestone("New Milestones UI");

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

		await core.createTask(
			{
				id: "task-5",
				title: "Roadmap milestone task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Task in roadmap milestone",
				milestone: "Roadmap Alpha",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-6",
				title: "ID milestone task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Task with milestone stored as ID",
				milestone: newMilestone.id,
			},
			false,
		);

		core.disposeSearchService();
		core.disposeContentStore();
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - unique directory names prevent conflicts
		}
	});

	it("filters by milestone with case-insensitive matching", async () => {
		const result = await listTasksViaCore({ milestone: "RELEASE-1", plain: true }, TEST_DIR);

		expect(result.exitCode).toBe(0);
		const output = result.stdout;

		expect(output).toContain("TASK-1 - Milestone task one");
		expect(output).toContain("TASK-2 - Milestone task two");
		expect(output).not.toContain("TASK-3 - Other milestone task");
		expect(output).not.toContain("TASK-4 - No milestone task");
		expect(output).not.toContain("TASK-5 - Roadmap milestone task");
		expect(output).not.toContain("TASK-6 - ID milestone task");
	});

	it("supports -m shorthand and combines milestone with status filter", async () => {
		const result = await listTasksViaCore({ milestone: "release-1", status: "To Do", plain: true }, TEST_DIR);

		expect(result.exitCode).toBe(0);
		const output = result.stdout;

		expect(output).toContain("TASK-1 - Milestone task one");
		expect(output).not.toContain("TASK-2 - Milestone task two");
		expect(output).not.toContain("TASK-3 - Other milestone task");
		expect(output).not.toContain("TASK-4 - No milestone task");
		expect(output).not.toContain("TASK-5 - Roadmap milestone task");
		expect(output).not.toContain("TASK-6 - ID milestone task");
	});

	it("matches closest milestone for partial and typo inputs", async () => {
		const typoResult = await listTasksViaCore({ milestone: "releas-1", plain: true }, TEST_DIR);
		expect(typoResult.exitCode).toBe(0);
		const typoOutput = typoResult.stdout;

		expect(typoOutput).toContain("TASK-1 - Milestone task one");
		expect(typoOutput).toContain("TASK-2 - Milestone task two");
		expect(typoOutput).not.toContain("TASK-3 - Other milestone task");
		expect(typoOutput).not.toContain("TASK-4 - No milestone task");
		expect(typoOutput).not.toContain("TASK-5 - Roadmap milestone task");

		const partialResult = await listTasksViaCore({ milestone: "roadmp", plain: true }, TEST_DIR);
		expect(partialResult.exitCode).toBe(0);
		const partialOutput = partialResult.stdout;

		expect(partialOutput).toContain("TASK-5 - Roadmap milestone task");
		expect(partialOutput).not.toContain("TASK-1 - Milestone task one");
		expect(partialOutput).not.toContain("TASK-2 - Milestone task two");
		expect(partialOutput).not.toContain("TASK-3 - Other milestone task");
		expect(partialOutput).not.toContain("TASK-4 - No milestone task");
		expect(partialOutput).not.toContain("TASK-6 - ID milestone task");
	});

	it("matches milestone title when tasks store milestone IDs", async () => {
		const result = await listTasksViaCore({ milestone: "new", plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);
		const output = result.stdout;

		expect(output).toContain("TASK-6 - ID milestone task");
		expect(output).not.toContain("TASK-1 - Milestone task one");
		expect(output).not.toContain("TASK-2 - Milestone task two");
		expect(output).not.toContain("TASK-3 - Other milestone task");
		expect(output).not.toContain("TASK-4 - No milestone task");
		expect(output).not.toContain("TASK-5 - Roadmap milestone task");
	});

	it("preserves existing listing behavior when milestone filter is omitted", async () => {
		const result = await listTasksViaCore({ plain: true }, TEST_DIR);

		expect(result.exitCode).toBe(0);
		const output = result.stdout;

		expect(output).toContain("TASK-1 - Milestone task one");
		expect(output).toContain("TASK-2 - Milestone task two");
		expect(output).toContain("TASK-3 - Other milestone task");
		expect(output).toContain("TASK-4 - No milestone task");
		expect(output).toContain("TASK-5 - Roadmap milestone task");
		expect(output).toContain("TASK-6 - ID milestone task");
	});
});
