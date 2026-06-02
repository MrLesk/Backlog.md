import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { getTaskStatistics } from "../core/statistics.ts";
import { Core } from "../index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI overview command with --plain", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-overview");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Overview Command Project");

		// Use today's date to avoid stale classification
		const today = new Date().toISOString().split("T")[0] as string;

		// Create tasks with varied statuses and priorities
		await core.createTask(
			{
				id: "task-1",
				title: "Todo high priority",
				status: "To Do",
				priority: "high",
				assignee: [],
				createdDate: today,
				labels: [],
				dependencies: [],
				rawContent: "High priority todo",
				description: "High priority todo",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-2",
				title: "In progress medium",
				status: "In Progress",
				priority: "medium",
				assignee: [],
				createdDate: today,
				labels: [],
				dependencies: [],
				rawContent: "Medium priority in progress",
				description: "Medium priority in progress",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-3",
				title: "Done low priority",
				status: "Done",
				priority: "low",
				assignee: [],
				createdDate: today,
				updatedDate: today,
				labels: [],
				dependencies: [],
				rawContent: "Low priority done",
				description: "Low priority done",
			},
			false,
		);

		// Create a blocked task (depends on task-1 which is not done)
		await core.createTask(
			{
				id: "task-4",
				title: "Blocked task",
				status: "To Do",
				assignee: [],
				createdDate: today,
				labels: [],
				dependencies: ["task-1"],
				rawContent: "Blocked by task-1",
				description: "Blocked by task-1",
			},
			false,
		);

		// Create a task with no priority (defaults to "none")
		await core.createTask(
			{
				id: "task-5",
				title: "No priority task",
				status: "To Do",
				assignee: [],
				createdDate: today,
				labels: [],
				dependencies: [],
				rawContent: "No priority",
				description: "No priority",
			},
			false,
		);
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("displays statistics in plain output", async () => {
		const result = await $`bun ${cliPath} overview --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		expect(stdout).toContain("Project Overview");
		expect(stdout).toContain("Total Tasks");
		expect(stdout).toContain("Completion");
		expect(stdout).toContain("To Do");
		expect(stdout).toContain("In Progress");
		expect(stdout).toContain("Done");
		expect(stdout).toContain("Blocked");
	});

	it("excludes ANSI escape codes in plain output", async () => {
		const result = await $`bun ${cliPath} overview --plain`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
		const stdout = result.stdout.toString();
		// ANSI escape codes start with ESC (\x1b)
		expect(stdout).not.toContain("\x1b[");
	});
});

describe("getTaskStatistics unit tests", () => {
	const statuses = ["To Do", "In Progress", "Done"];

	const createTask = (partial: Partial<Task>): Task => ({
		id: "task-1",
		title: "Test Task",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2024-01-01",
		rawContent: "",
		...partial,
	});

	it("calculates all statistics fields correctly", () => {
		const tasks: Task[] = [
			createTask({ id: "task-1", status: "To Do", priority: "high" }),
			createTask({ id: "task-2", status: "In Progress", priority: "medium" }),
			createTask({ id: "task-3", status: "Done", priority: "low" }),
		];
		const drafts: Task[] = [createTask({ id: "task-4", status: "" })];

		const stats = getTaskStatistics(tasks, drafts, statuses);

		expect(stats.totalTasks).toBe(3);
		expect(stats.completedTasks).toBe(1);
		expect(stats.completionPercentage).toBe(33);
		expect(stats.draftCount).toBe(1);
		expect(stats.statusCounts.get("To Do")).toBe(1);
		expect(stats.statusCounts.get("In Progress")).toBe(1);
		expect(stats.statusCounts.get("Done")).toBe(1);
		expect(stats.priorityCounts.get("high")).toBe(1);
		expect(stats.priorityCounts.get("medium")).toBe(1);
		expect(stats.priorityCounts.get("low")).toBe(1);
	});

	it("includes recent activity fields", () => {
		const now = new Date();
		const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

		const tasks: Task[] = [
			createTask({
				id: "task-1",
				createdDate: threeDaysAgo.toISOString().split("T")[0] as string,
				updatedDate: threeDaysAgo.toISOString().split("T")[0] as string,
			}),
		];

		const stats = getTaskStatistics(tasks, [], statuses);

		expect(stats.recentActivity.created.length).toBe(1);
		expect(stats.recentActivity.updated.length).toBe(1);
		expect(stats.recentActivity.created[0]?.id).toBe("task-1");
	});
});
