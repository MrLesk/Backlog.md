import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { getTaskFilename, getTaskPath, normalizeTaskId, taskFileExists } from "../utils/task-path.ts";
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
		it("should add task- prefix if missing", () => {
			expect(normalizeTaskId("123")).toBe("task-123");
			expect(normalizeTaskId("456")).toBe("task-456");
		});

		it("should not modify task IDs that already have task- prefix", () => {
			expect(normalizeTaskId("task-123")).toBe("task-123");
			expect(normalizeTaskId("task-456")).toBe("task-456");
		});

		it("should handle empty strings", () => {
			expect(normalizeTaskId("")).toBe("task-");
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
