import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { listTasksViaCore } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");

let TEST_DIR: string;

describe("CLI Priority Filtering", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-priority-filtering");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Priority Filtering Test Project");

		await core.createTask(
			{
				id: "task-1",
				title: "High priority task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				priority: "high",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-2",
				title: "Medium priority task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				priority: "medium",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-3",
				title: "Low priority task",
				status: "In Progress",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				priority: "low",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-4",
				title: "No priority task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
			},
			false,
		);

		core.disposeSearchService();
		core.disposeContentStore();
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	test("task list --priority high shows only high priority tasks", async () => {
		const result = await listTasksViaCore({ priority: "high", plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const output = result.stdout;
		expect(output).toContain("TASK-1 - High priority task");
		expect(output).toContain("[HIGH]");
		expect(output).not.toContain("[MEDIUM]");
		expect(output).not.toContain("[LOW]");
		expect(output).not.toContain("TASK-2 - Medium priority task");
		expect(output).not.toContain("TASK-3 - Low priority task");
	});

	test("task list --priority medium shows only medium priority tasks", async () => {
		const result = await listTasksViaCore({ priority: "medium", plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const output = result.stdout;
		expect(output).toContain("TASK-2 - Medium priority task");
		expect(output).toContain("[MEDIUM]");
		expect(output).not.toContain("[HIGH]");
		expect(output).not.toContain("[LOW]");
	});

	test("task list --priority low shows only low priority tasks", async () => {
		const result = await listTasksViaCore({ priority: "low", plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const output = result.stdout;
		expect(output).toContain("TASK-3 - Low priority task");
		expect(output).toContain("[LOW]");
		expect(output).not.toContain("[HIGH]");
		expect(output).not.toContain("[MEDIUM]");
	});

	test("task list --priority invalid shows error", async () => {
		// CLI-CONTRACT: verifies 'task list --priority invalid' exits non-zero with specific error message format
		const result = await $`bun ${CLI_PATH} task list --priority invalid --plain`.cwd(TEST_DIR).nothrow().quiet();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Invalid priority: invalid");
		expect(result.stderr.toString()).toContain("Valid values are: high, medium, low");
	});

	test("task list --sort priority sorts by priority", async () => {
		const result = await listTasksViaCore({ sort: "priority", plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const output = result.stdout;
		expect(output).toContain("[HIGH]");
		expect(output).toContain("[MEDIUM]");
		expect(output).toContain("[LOW]");
		const highIndex = output.indexOf("[HIGH]");
		const mediumIndex = output.indexOf("[MEDIUM]");
		const lowIndex = output.indexOf("[LOW]");
		expect(highIndex).toBeLessThan(mediumIndex);
		expect(mediumIndex).toBeLessThan(lowIndex);
	});

	test("task list --sort id sorts by task ID", async () => {
		const result = await listTasksViaCore({ sort: "id", plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);
		// Should exit successfully
		expect(result.stdout).toContain("TASK-1");
	});

	test("task list --sort invalid shows error", async () => {
		// CLI-CONTRACT: verifies 'task list --sort invalid' exits non-zero with specific error message format
		const result = await $`bun ${CLI_PATH} task list --sort invalid --plain`.cwd(TEST_DIR).nothrow().quiet();
		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Invalid sort field: invalid");
		expect(result.stderr.toString()).toContain("Valid values are: priority, id");
	});

	test("task list combines priority filter with status filter", async () => {
		const result = await listTasksViaCore({ priority: "high", status: "To Do", plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const output = result.stdout;
		expect(output).toContain("TASK-1 - High priority task");
		expect(output).toContain("[HIGH]");
		expect(output).not.toContain("[MEDIUM]");
		expect(output).not.toContain("[LOW]");
	});

	test("task list combines priority filter with sort", async () => {
		const result = await listTasksViaCore({ priority: "high", sort: "id", plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const output = result.stdout;
		expect(output).toContain("TASK-1 - High priority task");
		expect(output).toContain("[HIGH]");
		expect(output).not.toContain("[MEDIUM]");
		expect(output).not.toContain("[LOW]");
	});

	test("plain output includes priority indicators", async () => {
		const result = await listTasksViaCore({ plain: true }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const output = result.stdout;
		// Tasks with priority should have proper indicators
		expect(output).toMatch(/\[HIGH\]/);
		expect(output).toMatch(/\[MEDIUM\]/);
		expect(output).toMatch(/\[LOW\]/);
	});

	test("case insensitive priority filtering", async () => {
		const upperResult = await listTasksViaCore({ priority: "HIGH", plain: true }, TEST_DIR);
		const lowerResult = await listTasksViaCore({ priority: "high", plain: true }, TEST_DIR);
		const mixedResult = await listTasksViaCore({ priority: "High", plain: true }, TEST_DIR);

		expect(upperResult.exitCode).toBe(0);
		expect(lowerResult.exitCode).toBe(0);
		expect(mixedResult.exitCode).toBe(0);

		const [upperOutput, lowerOutput, mixedOutput] = [upperResult.stdout, lowerResult.stdout, mixedResult.stdout];
		const listUpper = upperOutput.split("\n").filter((line) => line.includes("TASK-"));
		const listLower = lowerOutput.split("\n").filter((line) => line.includes("TASK-"));
		const listMixed = mixedOutput.split("\n").filter((line) => line.includes("TASK-"));

		expect(listUpper).toEqual(listLower);
		expect(listMixed).toEqual(listLower);

		for (const output of [upperOutput, lowerOutput, mixedOutput]) {
			expect(output).toContain("[HIGH]");
			expect(output).not.toContain("[MEDIUM]");
			expect(output).not.toContain("[LOW]");
		}
	});
});
