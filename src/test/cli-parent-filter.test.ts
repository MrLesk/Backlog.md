import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import { createUniqueTestDir, getExitCode, safeCleanup } from "./test-utils.ts";

describe("CLI parent task filtering", () => {
	let testDir: string;
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-parent-filter");
		try {
			await rm(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(testDir, { recursive: true });

		// Initialize git repo first using Bun.spawn (same pattern as other tests)
		await Bun.spawn(["git", "init", "-b", "main"], { cwd: testDir }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: testDir }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: testDir }).exited;

		// Initialize backlog project using Core (same pattern as other tests)
		const core = new Core(testDir);
		await core.initializeProject("Parent Filter Test Project");

		// Create a parent task
		await core.createTask(
			{
				id: "task-1",
				title: "Parent task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Parent task description",
			},
			false,
		);

		// Create child tasks
		await core.createTask(
			{
				id: "task-1.1",
				title: "Child task 1",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Child task 1 description",
				parentTaskId: "task-1",
			},
			false,
		);

		await core.createTask(
			{
				id: "task-1.2",
				title: "Child task 2",
				status: "In Progress",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Child task 2 description",
				parentTaskId: "task-1",
			},
			false,
		);

		// Create another standalone task
		await core.createTask(
			{
				id: "task-2",
				title: "Standalone task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Standalone task description",
			},
			false,
		);
	});

	afterEach(async () => {
		try {
			await safeCleanup(testDir);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should filter tasks by parent with full task ID", () => {
		const result = spawnSync("bun", [cliPath, "task", "list", "--parent", "task-1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		const exitCode = getExitCode(result);

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout);
			console.error("STDERR:", result.stderr);
			console.error("Error:", result.error);
		}

		expect(exitCode).toBe(0);
		// Should contain only child tasks
		expect(result.stdout).toContain("task-1.1 - Child task 1");
		expect(result.stdout).toContain("task-1.2 - Child task 2");
		// Should not contain parent or standalone tasks
		expect(result.stdout).not.toContain("task-1 - Parent task");
		expect(result.stdout).not.toContain("task-2 - Standalone task");
	});

	it("should filter tasks by parent with short task ID", () => {
		const result = spawnSync("bun", [cliPath, "task", "list", "--parent", "1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		const exitCode = getExitCode(result);

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout);
			console.error("STDERR:", result.stderr);
			console.error("Error:", result.error);
		}

		expect(exitCode).toBe(0);
		// Should contain only child tasks
		expect(result.stdout).toContain("task-1.1 - Child task 1");
		expect(result.stdout).toContain("task-1.2 - Child task 2");
		// Should not contain parent or standalone tasks
		expect(result.stdout).not.toContain("task-1 - Parent task");
		expect(result.stdout).not.toContain("task-2 - Standalone task");
	});

	it("should show error for non-existent parent task", () => {
		const result = spawnSync("bun", [cliPath, "task", "list", "--parent", "task-999", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		const exitCode = getExitCode(result);

		expect(exitCode).toBe(0); // CLI exits successfully but shows error message
		expect(result.stderr).toContain("Parent task task-999 not found.");
	});

	it("should show message when parent has no children", () => {
		const result = spawnSync("bun", [cliPath, "task", "list", "--parent", "task-2", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		const exitCode = getExitCode(result);

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout);
			console.error("STDERR:", result.stderr);
			console.error("Error:", result.error);
		}

		expect(exitCode).toBe(0);
		expect(result.stdout).toContain("No child tasks found for parent task task-2.");
	});

	it("should work with -p shorthand flag", () => {
		const result = spawnSync("bun", [cliPath, "task", "list", "-p", "task-1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		const exitCode = getExitCode(result);

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout);
			console.error("STDERR:", result.stderr);
			console.error("Error:", result.error);
		}

		expect(exitCode).toBe(0);
		// Should contain only child tasks
		expect(result.stdout).toContain("task-1.1 - Child task 1");
		expect(result.stdout).toContain("task-1.2 - Child task 2");
	});

	it("should combine parent filter with status filter", () => {
		const result = spawnSync("bun", [cliPath, "task", "list", "--parent", "task-1", "--status", "To Do", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		const exitCode = getExitCode(result);

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout);
			console.error("STDERR:", result.stderr);
			console.error("Error:", result.error);
		}

		expect(exitCode).toBe(0);
		// Should contain only child task with "To Do" status
		expect(result.stdout).toContain("task-1.1 - Child task 1");
		// Should not contain child task with "In Progress" status
		expect(result.stdout).not.toContain("task-1.2 - Child task 2");
	});
});
