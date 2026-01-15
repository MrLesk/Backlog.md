import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { getTaskFilename, getTaskPath, normalizeTaskId, taskFileExists, taskIdsEqual } from "../utils/task-path.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("Task path utilities", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-task-path");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Configure git for tests - required for CI
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await core.initializeProject("Test Project");

		// Create some test task files
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(join(tasksDir, "task-123 - Test Task.md"), "# Test Task 123");
		await writeFile(join(tasksDir, "task-456 - Another Task.md"), "# Another Task 456");
		await writeFile(join(tasksDir, "task-789 - Final Task.md"), "# Final Task 789");
		// Additional: padded and dotted ids
		await writeFile(join(tasksDir, "task-0001 - Padded One.md"), "# Padded One");
		await writeFile(join(tasksDir, "task-3.01 - Subtask Padded.md"), "# Subtask Padded 3.01");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("normalizeTaskId", () => {
		it("should add uppercase TASK- prefix if missing", () => {
			expect(normalizeTaskId("123")).toBe("TASK-123");
			expect(normalizeTaskId("456")).toBe("TASK-456");
		});

		it("should normalize existing prefix to uppercase", () => {
			expect(normalizeTaskId("task-123")).toBe("TASK-123");
			expect(normalizeTaskId("TASK-456")).toBe("TASK-456");
		});

		it("should preserve non-default prefixes when present", () => {
			expect(normalizeTaskId("JIRA-456")).toBe("JIRA-456");
			expect(normalizeTaskId("jira-789")).toBe("JIRA-789");
		});

		it("should handle empty strings", () => {
			expect(normalizeTaskId("")).toBe("TASK-");
		});

		it("should normalize mixed-case prefixes to uppercase", () => {
			expect(normalizeTaskId("TASK-001")).toBe("TASK-001");
			expect(normalizeTaskId("Task-42")).toBe("TASK-42");
			expect(normalizeTaskId("task-99")).toBe("TASK-99");
		});

		it("should work with custom prefixes (uppercase output)", () => {
			expect(normalizeTaskId("123", "JIRA")).toBe("JIRA-123");
			expect(normalizeTaskId("JIRA-456", "JIRA")).toBe("JIRA-456");
			expect(normalizeTaskId("jira-789", "JIRA")).toBe("JIRA-789");
		});

		it("should work with draft prefix (uppercase output)", () => {
			expect(normalizeTaskId("1", "draft")).toBe("DRAFT-1");
			expect(normalizeTaskId("draft-5", "draft")).toBe("DRAFT-5");
		});
	});

	describe("taskIdsEqual", () => {
		it("should compare IDs case-insensitively", () => {
			expect(taskIdsEqual("task-123", "TASK-123")).toBe(true);
			expect(taskIdsEqual("Task-456", "task-456")).toBe(true);
		});

		it("should handle numeric comparison (leading zeros)", () => {
			expect(taskIdsEqual("task-1", "task-01")).toBe(true);
			expect(taskIdsEqual("task-001", "task-1")).toBe(true);
		});

		it("should compare subtask IDs correctly", () => {
			expect(taskIdsEqual("task-1.2", "task-1.2")).toBe(true);
			expect(taskIdsEqual("task-1.2", "task-1.02")).toBe(true);
			expect(taskIdsEqual("task-1.2", "task-1.3")).toBe(false);
		});

		it("should work with custom prefixes", () => {
			expect(taskIdsEqual("JIRA-100", "jira-100", "JIRA")).toBe(true);
			expect(taskIdsEqual("100", "JIRA-100", "JIRA")).toBe(true);
		});

		it("should return false for different IDs", () => {
			expect(taskIdsEqual("task-1", "task-2")).toBe(false);
			expect(taskIdsEqual("task-1.1", "task-1.2")).toBe(false);
		});
	});

	describe("getTaskPath", () => {
		it("should return full path for existing task", async () => {
			const path = await getTaskPath("123", core);
			expect(path).toBeTruthy();
			expect(path).toContain("task-123 - Test Task.md");
			expect(path).toContain(core.filesystem.tasksDir);
		});

		it("should work with task- prefix", async () => {
			const path = await getTaskPath("task-456", core);
			expect(path).toBeTruthy();
			expect(path).toContain("task-456 - Another Task.md");
		});

		it("should resolve zero-padded numeric IDs to the same task", async () => {
			// File exists as task-0001; query with 1
			const path1 = await getTaskPath("1", core);
			expect(path1).toBeTruthy();
			expect(path1).toContain("task-0001 - Padded One.md");

			// Query with zero-padded input for non-padded file (123)
			const path2 = await getTaskPath("0123", core);
			expect(path2).toBeTruthy();
			expect(path2).toContain("task-123 - Test Task.md");
		});

		it("should resolve case-insensitive task IDs", async () => {
			const uppercase = await getTaskPath("TASK-0001", core);
			expect(uppercase).toBeTruthy();
			expect(uppercase).toContain("task-0001 - Padded One.md");

			const mixedCase = await getTaskPath("Task-456", core);
			expect(mixedCase).toBeTruthy();
			expect(mixedCase).toContain("task-456 - Another Task.md");
		});

		it("should return null for non-existent task", async () => {
			const path = await getTaskPath("999", core);
			expect(path).toBeNull();
		});

		it("should handle errors gracefully", async () => {
			// Pass invalid core to trigger error
			const path = await getTaskPath("123", null as unknown as Core);
			expect(path).toBeNull();
		});
	});

	describe("getTaskFilename", () => {
		it("should return filename for existing task", async () => {
			const filename = await getTaskFilename("789", core);
			expect(filename).toBe("task-789 - Final Task.md");
		});

		it("should resolve dotted IDs ignoring leading zeros in segments", async () => {
			const filename = await getTaskFilename("3.1", core);
			expect(filename).toBe("task-3.01 - Subtask Padded.md");
		});

		it("should resolve case-insensitive IDs when fetching filenames", async () => {
			const filename = await getTaskFilename("TASK-789", core);
			expect(filename).toBe("task-789 - Final Task.md");
		});

		it("should return null for non-existent task", async () => {
			const filename = await getTaskFilename("999", core);
			expect(filename).toBeNull();
		});
	});

	describe("taskFileExists", () => {
		it("should return true for existing tasks", async () => {
			const exists = await taskFileExists("123", core);
			expect(exists).toBe(true);
		});

		it("should return false for non-existent tasks", async () => {
			const exists = await taskFileExists("999", core);
			expect(exists).toBe(false);
		});

		it("should work with task- prefix", async () => {
			const exists = await taskFileExists("task-456", core);
			expect(exists).toBe(true);
		});
	});

	describe("integration with Core default", () => {
		it("should work without explicit core parameter when in valid project", async () => {
			// Change to test directory to use default Core
			const originalCwd = process.cwd();
			process.chdir(TEST_DIR);

			try {
				const path = await getTaskPath("123");
				expect(path).toBeTruthy();
				expect(path).toContain("task-123 - Test Task.md");
			} finally {
				process.chdir(originalCwd);
			}
		});
	});
});
