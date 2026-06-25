import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../index.ts";
import {
	createTaskPlatformAware,
	editTaskPlatformAware,
	listTasksViaCore,
	viewTaskPlatformAware,
} from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("test-helpers", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-helpers");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Test Helpers Project");
		core.disposeSearchService();
		core.disposeContentStore();
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("createTaskPlatformAware", () => {
		it("creates a task and returns taskId", async () => {
			const result = await createTaskPlatformAware({ title: "My task" }, TEST_DIR);
			expect(result.exitCode).toBe(0);
			expect(result.taskId).toBeDefined();
			expect(result.stdout).toContain("Created task");
		});

		it("returns error for empty title", async () => {
			const result = await createTaskPlatformAware({ title: "" }, TEST_DIR);
			expect(result.exitCode).toBe(1);
		});

		it("creates draft with draft flag", async () => {
			const result = await createTaskPlatformAware({ title: "Draft task", draft: true }, TEST_DIR);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Created draft");
		});
	});

	describe("editTaskPlatformAware", () => {
		it("edits an existing task", async () => {
			const created = await createTaskPlatformAware({ title: "Original title" }, TEST_DIR);
			expect(created.exitCode).toBe(0);
			const taskId = created.taskId as string;

			const result = await editTaskPlatformAware({ taskId, title: "Updated title" }, TEST_DIR);
			expect(result.exitCode).toBe(0);
		});

		it("returns error for non-existent task", async () => {
			const result = await editTaskPlatformAware({ taskId: "task-999", title: "New title" }, TEST_DIR);
			expect(result.exitCode).toBe(1);
		});
	});

	describe("viewTaskPlatformAware", () => {
		it("views a task", async () => {
			const created = await createTaskPlatformAware({ title: "View me" }, TEST_DIR);
			const taskId = created.taskId as string;

			const result = await viewTaskPlatformAware({ taskId }, TEST_DIR);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("View me");
		});
	});

	describe("listTasksViaCore", () => {
		beforeEach(async () => {
			const core = new Core(TEST_DIR);
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
			core.disposeSearchService();
			core.disposeContentStore();
		});

		it("lists all tasks in plain mode", async () => {
			const result = await listTasksViaCore({ plain: true }, TEST_DIR);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("TASK-1 - High priority task");
			expect(result.stdout).toContain("TASK-2 - Low priority task");
		});

		it("filters by priority", async () => {
			const result = await listTasksViaCore({ priority: "high", plain: true }, TEST_DIR);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("TASK-1 - High priority task");
			expect(result.stdout).not.toContain("TASK-2 - Low priority task");
		});

		it("shows priority indicators in plain output", async () => {
			const result = await listTasksViaCore({ plain: true }, TEST_DIR);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("[HIGH]");
			expect(result.stdout).toContain("[LOW]");
		});

		it("sorts by priority", async () => {
			const result = await listTasksViaCore({ sort: "priority", plain: true }, TEST_DIR);
			expect(result.exitCode).toBe(0);
			const highIndex = result.stdout.indexOf("[HIGH]");
			const lowIndex = result.stdout.indexOf("[LOW]");
			expect(highIndex).toBeLessThan(lowIndex);
		});

		it("returns error for invalid priority", async () => {
			const result = await listTasksViaCore({ priority: "invalid", plain: true }, TEST_DIR);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("Invalid priority: invalid");
		});

		it("returns error for invalid sort field", async () => {
			const result = await listTasksViaCore({ sort: "invalid", plain: true }, TEST_DIR);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain("Invalid sort field: invalid");
		});

		it("filters by status", async () => {
			const result = await listTasksViaCore({ status: "In Progress", plain: true }, TEST_DIR);
			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("TASK-2 - Low priority task");
			expect(result.stdout).not.toContain("TASK-1 - High priority task");
		});
	});
});
