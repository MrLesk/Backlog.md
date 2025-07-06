import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";
import { createUniqueTestDir, getExitCode, safeCleanup } from "./test-utils.ts";

describe("CLI plain output for AI agents", () => {
	let testDir: string;
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-plain-output");
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
		await core.initializeProject("Plain Output Test Project");

		// Create a test task
		await core.createTask(
			{
				id: "task-1",
				title: "Test task for plain output",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				description: "Test description",
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

	it("should output plain text with task view --plain", () => {
		const result = spawnSync("bun", [cliPath, "task", "view", "1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Handle Windows spawnSync status issues
		const exitCode = getExitCode(result);

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout);
			console.error("STDERR:", result.stderr);
			console.error("Error:", result.error);
		}

		expect(exitCode).toBe(0);
		// Should contain the formatted task output
		expect(result.stdout).toContain("Task task-1 - Test task for plain output");
		expect(result.stdout).toContain("Status: ○ To Do");
		expect(result.stdout).toContain("Created: 2025-06-18");
		expect(result.stdout).toContain("Description:");
		expect(result.stdout).toContain("Test description");
		expect(result.stdout).toContain("Acceptance Criteria:");
		// Should not contain TUI escape codes
		expect(result.stdout).not.toContain("[?1049h");
		expect(result.stdout).not.toContain("\x1b");
	});

	it("should output plain text with task <id> --plain shortcut", async () => {
		// Verify task exists before running CLI command
		const core = new Core(testDir);
		const task = await core.filesystem.loadTask("task-1");
		expect(task).not.toBeNull();
		expect(task?.id).toBe("task-1");

		const result = spawnSync("bun", [cliPath, "task", "1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		// Handle Windows spawnSync status issues
		const exitCode = getExitCode(result);

		if (exitCode !== 0) {
			console.error("STDOUT:", result.stdout);
			console.error("STDERR:", result.stderr);
			console.error("Error:", result.error);
		}

		expect(exitCode).toBe(0);
		// Should contain the formatted task output
		expect(result.stdout).toContain("Task task-1 - Test task for plain output");
		expect(result.stdout).toContain("Status: ○ To Do");
		expect(result.stdout).toContain("Created: 2025-06-18");
		expect(result.stdout).toContain("Description:");
		expect(result.stdout).toContain("Test description");
		// Should not contain TUI escape codes
		expect(result.stdout).not.toContain("[?1049h");
		expect(result.stdout).not.toContain("\x1b");
	});

	// Task list already has --plain support and works correctly
});
