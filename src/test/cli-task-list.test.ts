import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("CLI Integration", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("task list command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "List Test Project", true);
		});

		it("should show 'No tasks found' when no tasks exist", async () => {
			const core = new Core(TEST_DIR);
			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);
		});

		it("should list tasks grouped by status", async () => {
			const core = new Core(TEST_DIR);

			// Create test tasks with different statuses
			await core.createTask(
				{
					id: "task-1",
					title: "First Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "First test task",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-2",
					title: "Second Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Second test task",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-3",
					title: "Third Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Third test task",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(3);

			// Verify tasks are grouped correctly by status
			const todoTasks = tasks.filter((t) => t.status === "To Do");
			const doneTasks = tasks.filter((t) => t.status === "Done");

			expect(todoTasks).toHaveLength(2);
			expect(doneTasks).toHaveLength(1);
			expect(todoTasks.map((t) => t.id)).toEqual(["TASK-1", "TASK-3"]); // IDs normalized to uppercase
			expect(doneTasks.map((t) => t.id)).toEqual(["TASK-2"]); // IDs normalized to uppercase
		});

		it("should respect config status order", async () => {
			const core = new Core(TEST_DIR);

			// Load and verify default config status order
			const config = await core.filesystem.loadConfig();
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
		});

		it("should filter tasks by status", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "First Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "First test task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Second Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Second test task",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --status Done`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("Done:");
			expect(out).toContain("TASK-2 - Second Task"); // IDs normalized to uppercase
			expect(out).not.toContain("TASK-1");
		});

		it("should filter tasks by status case-insensitively", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "First Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "First test task",
				},
				true,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Second Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Second test task",
				},
				true,
			);

			const testCases = ["done", "DONE", "DoNe"];

			for (const status of testCases) {
				const result = await $`bun ${CLI_PATH} task list --plain --status ${status}`.cwd(TEST_DIR).quiet();
				const out = result.stdout.toString();
				expect(out).toContain("Done:");
				expect(out).toContain("TASK-2 - Second Task"); // IDs normalized to uppercase
				expect(out).not.toContain("TASK-1");
			}

			// Test with -s flag
			const resultShort = await $`bun ${CLI_PATH} task list --plain -s done`.cwd(TEST_DIR).quiet();
			const outShort = resultShort.stdout.toString();
			expect(outShort).toContain("Done:");
			expect(outShort).toContain("TASK-2 - Second Task"); // IDs normalized to uppercase
			expect(outShort).not.toContain("TASK-1");
		});

		it("should filter tasks by assignee", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Assigned Task",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Assigned task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Unassigned Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Other task",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --assignee alice`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("TASK-1 - Assigned Task"); // IDs normalized to uppercase
			expect(out).not.toContain("TASK-2 - Unassigned Task");
		});

		it("should filter tasks without an assignee using --unassigned", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Assigned Task",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Assigned task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Unassigned Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Other task",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --unassigned`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("TASK-2 - Unassigned Task");
			expect(out).not.toContain("TASK-1 - Assigned Task");
		});

		it("should reject combining --unassigned with --assignee", async () => {
			const result = await $`bun ${CLI_PATH} task list --plain --assignee alice --unassigned`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("--unassigned cannot be combined with --assignee");
		});

		it("should filter tasks by labels requiring every requested label", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "UI Bug Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["UI", "Bug"],
					dependencies: [],
					rawContent: "UI bug task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "UI Only Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["ui"],
					dependencies: [],
					rawContent: "UI only task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-3",
					title: "Bug Only Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["bug"],
					dependencies: [],
					rawContent: "Bug only task",
				},
				false,
			);

			const commaResult = await $`bun ${CLI_PATH} task list --plain --labels ui,bug`.cwd(TEST_DIR).quiet();
			const repeatedResult = await $`bun ${CLI_PATH} task list --plain --labels ui --labels bug`.cwd(TEST_DIR).quiet();

			for (const result of [commaResult, repeatedResult]) {
				const out = result.stdout.toString();
				expect(out).toContain("TASK-1 - UI Bug Task");
				expect(out).not.toContain("TASK-2 - UI Only Task");
				expect(out).not.toContain("TASK-3 - Bug Only Task");
			}
		});

		it("should filter tasks by search query", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Billing Webhook",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Handle invoice payment callbacks.",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "Profile Settings",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Update account preferences.",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --search "invoice payment"`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("TASK-1 - Billing Webhook");
			expect(out).not.toContain("TASK-2 - Profile Settings");
		});

		it("should apply plain limit before regrouping sorted tasks by status", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Low Priority First ID",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					priority: "low",
					rawContent: "Low priority task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "High Priority Later ID",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					priority: "high",
					rawContent: "High priority task",
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task list --plain --limit 1`.cwd(TEST_DIR).quiet();
			const out = result.stdout.toString();
			expect(out).toContain("Done:");
			expect(out).toContain("[HIGH] TASK-2 - High Priority Later ID");
			expect(out).not.toContain("To Do:");
			expect(out).not.toContain("TASK-1 - Low Priority First ID");
		});

		it("should use configured custom priorities for create, list, search, and help", async () => {
			const core = new Core(TEST_DIR);
			const config = await core.filesystem.loadConfig();
			if (!config) {
				throw new Error("Expected test config to exist");
			}
			await core.filesystem.saveConfig({
				...config,
				priorities: ["Very High", "High", "Medium", "Low", "Very Low"],
			});

			await $`bun ${CLI_PATH} task create "Custom priority urgent task" --priority "Very High" --plain`
				.cwd(TEST_DIR)
				.quiet();
			await $`bun ${CLI_PATH} task create "Custom priority later task" --priority "Very Low" --plain`
				.cwd(TEST_DIR)
				.quiet();

			const listResult = await $`bun ${CLI_PATH} task list --plain --priority "very high"`.cwd(TEST_DIR).quiet();
			const listOutput = listResult.stdout.toString();
			expect(listOutput).toContain("[VERY HIGH] TASK-1 - Custom priority urgent task");
			expect(listOutput).not.toContain("Custom priority later task");

			const searchResult = await $`bun ${CLI_PATH} search "Custom priority" --priority "VERY HIGH" --plain`
				.cwd(TEST_DIR)
				.quiet();
			const searchOutput = searchResult.stdout.toString();
			expect(searchOutput).toContain("TASK-1 - Custom priority urgent task");
			expect(searchOutput).not.toContain("TASK-2 - Custom priority later task");

			const helpOutput = await $`bun ${CLI_PATH} task create --help`.cwd(TEST_DIR).text();
			expect(helpOutput).toContain("priority: one of configured priorities: Very High, High, Medium, Low, Very Low");
		});

		it("should combine search, labels, and existing task list filters", async () => {
			const core = new Core(TEST_DIR);
			const milestone = await core.filesystem.createMilestone("Release Filters");

			await core.createTask(
				{
					id: "task-1",
					title: "OAuth Parent",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Parent task",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-1.1",
					title: "OAuth Callback",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: ["security", "api"],
					dependencies: [],
					description: "Implement token exchange callback.",
					milestone: milestone.id,
					parentTaskId: "task-1",
					priority: "high",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-1.2",
					title: "OAuth Callback Missing Label",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: ["security"],
					dependencies: [],
					description: "Implement token exchange callback.",
					milestone: milestone.id,
					parentTaskId: "task-1",
					priority: "high",
				},
				false,
			);
			await core.createTask(
				{
					id: "task-2",
					title: "OAuth Callback Other Parent",
					status: "To Do",
					assignee: ["alice"],
					createdDate: "2025-06-08",
					labels: ["security", "api"],
					dependencies: [],
					description: "Implement token exchange callback.",
					milestone: milestone.id,
					priority: "high",
				},
				false,
			);

			const result =
				await $`bun ${CLI_PATH} task list --plain --status ${"To Do"} --assignee alice --milestone "Release Filters" --parent TASK-1 --priority high --labels security,api --search "OAuth Callback"`
					.cwd(TEST_DIR)
					.quiet();
			const out = result.stdout.toString();
			expect(out).toContain("[HIGH] TASK-1.1 - OAuth Callback");
			expect(out).not.toContain("TASK-1.2 - OAuth Callback Missing Label");
			expect(out).not.toContain("TASK-2 - OAuth Callback Other Parent");
		});

		it("should reject invalid task list limit", async () => {
			const result = await $`bun ${CLI_PATH} task list --plain --limit 0`.cwd(TEST_DIR).nothrow().quiet();
			const out = result.stdout.toString() + result.stderr.toString();

			expect(result.exitCode).toBe(1);
			expect(out).toContain("--limit must be a positive integer (1 or greater).");
			expect(out).toContain("Try 'backlog task list --help' for options.");
		});
	});
});
