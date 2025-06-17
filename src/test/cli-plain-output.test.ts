import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";

describe("CLI plain output for AI agents", () => {
	const testDir = join(import.meta.dir, "test-plain-output");
	const cliPath = join(import.meta.dir, "..", "cli.ts");

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmdirSync(testDir, { recursive: true });
		}
		mkdirSync(testDir);
		process.chdir(testDir);

		// Initialize git repo first
		spawnSync("git", ["init"], { encoding: "utf8" });

		// Create backlog structure manually for testing
		mkdirSync(".backlog");
		mkdirSync(".backlog/tasks");
		mkdirSync(".backlog/drafts");
		mkdirSync(".backlog/archive");
		mkdirSync(".backlog/docs");
		mkdirSync(".backlog/decisions");

		// Create minimal config
		const configContent = `
project: Test Project
statuses:
  - To Do
  - In Progress
  - Done
`;
		Bun.write(".backlog/config.yml", configContent);

		// Create a test task
		const createResult = spawnSync(
			"bun",
			[cliPath, "task", "create", "Test task for plain output", "-d", "Test description"],
			{
				encoding: "utf8",
			},
		);
		expect(createResult.status).toBe(0);
	});

	afterEach(() => {
		process.chdir(__dirname);
		if (existsSync(testDir)) {
			rmdirSync(testDir, { recursive: true });
		}
	});

	it("should output plain text with task view --plain", () => {
		const result = spawnSync("bun", [cliPath, "task", "view", "1", "--plain"], {
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Task: task-1 - Test task for plain output");
		expect(result.stdout).toContain("Status:");
		expect(result.stdout).toContain("Assignee:");
		expect(result.stdout).toContain("Labels:");
		expect(result.stdout).toContain("Created:");
		expect(result.stdout).toContain("---");
		expect(result.stdout).toContain("## Description");
		expect(result.stdout).toContain("Test description");
		// Should not contain TUI escape codes
		expect(result.stdout).not.toContain("[?1049h");
		expect(result.stdout).not.toContain("\x1b");
	});

	it("should output plain text with task <id> --plain shortcut", () => {
		const result = spawnSync("bun", [cliPath, "task", "1", "--plain"], {
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Task: task-1 - Test task for plain output");
		expect(result.stdout).toContain("Status:");
		expect(result.stdout).toContain("## Description");
		// Should not contain TUI escape codes
		expect(result.stdout).not.toContain("[?1049h");
		expect(result.stdout).not.toContain("\x1b");
	});

	// Task list already has --plain support and works correctly
});
