import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../index.ts";

describe("CLI plain output for AI agents", () => {
	const testDir = join(process.cwd(), "test-plain-output");
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
		await mkdir(testDir, { recursive: true });

		// Initialize git repo first
		spawnSync("git", ["init"], { cwd: testDir, encoding: "utf8" });
		spawnSync("git", ["config", "user.name", "Test User"], { cwd: testDir, encoding: "utf8" });
		spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: testDir, encoding: "utf8" });

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
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should output plain text with task view --plain", () => {
		const result = spawnSync("bun", [cliPath, "task", "view", "1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		// Should contain the raw markdown with frontmatter
		expect(result.stdout).toContain("---");
		expect(result.stdout).toContain("id: task-1");
		expect(result.stdout).toContain("title: Test task for plain output");
		expect(result.stdout).toContain("status:");
		expect(result.stdout).toContain("## Description");
		expect(result.stdout).toContain("Test description");
		// Should not contain TUI escape codes
		expect(result.stdout).not.toContain("[?1049h");
		expect(result.stdout).not.toContain("\x1b");
	});

	it("should output plain text with task <id> --plain shortcut", () => {
		const result = spawnSync("bun", [cliPath, "task", "1", "--plain"], {
			cwd: testDir,
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		// Should contain the raw markdown with frontmatter
		expect(result.stdout).toContain("---");
		expect(result.stdout).toContain("id: task-1");
		expect(result.stdout).toContain("title: Test task for plain output");
		expect(result.stdout).toContain("## Description");
		// Should not contain TUI escape codes
		expect(result.stdout).not.toContain("[?1049h");
		expect(result.stdout).not.toContain("\x1b");
	});

	// Task list already has --plain support and works correctly
});
