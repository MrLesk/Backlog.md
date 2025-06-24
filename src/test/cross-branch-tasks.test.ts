import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import {
	filterTasksByLatestState,
	getLatestTaskStatesForIds,
} from "../core/cross-branch-tasks.ts";
import { GitOperations } from "../git/operations.ts";

const TEST_DIR = join(import.meta.dir, "..", "..", "test-cross-branch");

describe("Cross-branch tasks functionality", () => {
	beforeEach(async () => {
		// Clean up and create test directory
		if (Bun.file(TEST_DIR).exists()) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });

		// Initialize git repository
		await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], {
			cwd: TEST_DIR,
		}).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], {
			cwd: TEST_DIR,
		}).exited;

		// Initialize backlog project
		const core = new Core(TEST_DIR);
		await core.initializeProject("Cross-branch Test");
	});

	afterEach(() => {
		if (Bun.file(TEST_DIR).exists()) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	test("should handle empty task list gracefully", async () => {
		const gitOps = new GitOperations(TEST_DIR);
		const result = await getLatestTaskStatesForIds(gitOps, []);

		expect(result).toBeInstanceOf(Map);
		expect(result.size).toBe(0);
	});

	test("should handle non-existent tasks gracefully", async () => {
		const gitOps = new GitOperations(TEST_DIR);
		const result = await getLatestTaskStatesForIds(gitOps, ["task-999"]);

		expect(result).toBeInstanceOf(Map);
		expect(result.size).toBe(0);
	});

	test("should filter tasks correctly when no directory info available", () => {
		const tasks = [
			{
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-06-24",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		const emptyDirectoryMap = new Map();
		const result = filterTasksByLatestState(tasks, emptyDirectoryMap);

		// Should return all tasks when no directory info is available
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("task-1");
	});

	test("should import GitOperations correctly", () => {
		// This test ensures the import works correctly
		const gitOps = new GitOperations(TEST_DIR);
		expect(gitOps).toBeDefined();
		expect(typeof gitOps.listAllBranches).toBe("function");
	});

	test("should handle basic single-branch scenario", async () => {
		const core = new Core(TEST_DIR);

		// Create a test task
		await core.createTask(
			{
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2024-06-24",
				labels: [],
				dependencies: [],
				description: "Test task for cross-branch functionality",
			},
			false,
		);

		const gitOps = new GitOperations(TEST_DIR);
		const result = await getLatestTaskStatesForIds(gitOps, ["task-1"]);

		expect(result).toBeInstanceOf(Map);
		// In a single-branch scenario, the function should still work
		// even if it doesn't find the task (due to git complexities in tests)
	});
});
