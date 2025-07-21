import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI plain output for AI agents", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-plain-output");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first using shell API (same pattern as other tests)
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize backlog project using Core (same pattern as other tests)
		const core = new Core(TEST_DIR);
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
				body: "Test description",
			},
			false,
		);

		// Create a test draft
		await core.createDraft(
			{
				id: "task-2",
				title: "Test draft for plain output",
				status: "Draft",
				assignee: [],
				createdDate: "2025-06-18",
				labels: [],
				dependencies: [],
				body: "Test draft description",
			},
			false,
		);
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should output plain text with task view --plain", async () => {
		const result = await $`bun ${cliPath} task view 1 --plain`.cwd(TEST_DIR).quiet();

		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(result.exitCode).toBe(0);
		// Should contain the file path as first line
		expect(result.stdout.toString()).toContain("File: ");
		expect(result.stdout.toString()).toContain("task-1 - Test-task-for-plain-output.md");
		// Should contain the formatted task output
		expect(result.stdout.toString()).toContain("Task task-1 - Test task for plain output");
		expect(result.stdout.toString()).toContain("Status: ○ To Do");
		expect(result.stdout.toString()).toContain("Created: 2025-06-18");
		expect(result.stdout.toString()).toContain("Description:");
		expect(result.stdout.toString()).toContain("Test description");
		expect(result.stdout.toString()).toContain("Acceptance Criteria:");
		// Should not contain TUI escape codes
		expect(result.stdout.toString()).not.toContain("[?1049h");
		expect(result.stdout.toString()).not.toContain("\x1b");
	});

	it("should output plain text with task <id> --plain shortcut", async () => {
		// Verify task exists before running CLI command
		const core = new Core(TEST_DIR);
		const task = await core.filesystem.loadTask("task-1");
		expect(task).not.toBeNull();
		expect(task?.id).toBe("task-1");

		const result = await $`bun ${cliPath} task 1 --plain`.cwd(TEST_DIR).quiet();

		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(result.exitCode).toBe(0);
		// Should contain the file path as first line
		expect(result.stdout.toString()).toContain("File: ");
		expect(result.stdout.toString()).toContain("task-1 - Test-task-for-plain-output.md");
		// Should contain the formatted task output
		expect(result.stdout.toString()).toContain("Task task-1 - Test task for plain output");
		expect(result.stdout.toString()).toContain("Status: ○ To Do");
		expect(result.stdout.toString()).toContain("Created: 2025-06-18");
		expect(result.stdout.toString()).toContain("Description:");
		expect(result.stdout.toString()).toContain("Test description");
		// Should not contain TUI escape codes
		expect(result.stdout.toString()).not.toContain("[?1049h");
		expect(result.stdout.toString()).not.toContain("\x1b");
	});

	it("should output plain text with draft view --plain", async () => {
		const result = await $`bun ${cliPath} draft view 2 --plain`.cwd(TEST_DIR).quiet();

		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(result.exitCode).toBe(0);
		// Should contain the file path as first line
		expect(result.stdout.toString()).toContain("File: ");
		expect(result.stdout.toString()).toContain("task-2 - Test-draft-for-plain-output.md");
		// Should contain the formatted draft output
		expect(result.stdout.toString()).toContain("Task task-2 - Test draft for plain output");
		expect(result.stdout.toString()).toContain("Status: ○ Draft");
		expect(result.stdout.toString()).toContain("Created: 2025-06-18");
		expect(result.stdout.toString()).toContain("Description:");
		expect(result.stdout.toString()).toContain("Test draft description");
		// Should not contain TUI escape codes
		expect(result.stdout.toString()).not.toContain("[?1049h");
		expect(result.stdout.toString()).not.toContain("\x1b");
	});

	it("should output plain text with draft <id> --plain shortcut", async () => {
		// Verify draft exists before running CLI command
		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft("task-2");
		expect(draft).not.toBeNull();
		expect(draft?.id).toBe("task-2");

		const result = await $`bun ${cliPath} draft 2 --plain`.cwd(TEST_DIR).quiet();

		if (result.exitCode !== 0) {
			console.error("STDOUT:", result.stdout.toString());
			console.error("STDERR:", result.stderr.toString());
		}

		expect(result.exitCode).toBe(0);
		// Should contain the file path as first line
		expect(result.stdout.toString()).toContain("File: ");
		expect(result.stdout.toString()).toContain("task-2 - Test-draft-for-plain-output.md");
		// Should contain the formatted draft output
		expect(result.stdout.toString()).toContain("Task task-2 - Test draft for plain output");
		expect(result.stdout.toString()).toContain("Status: ○ Draft");
		expect(result.stdout.toString()).toContain("Created: 2025-06-18");
		expect(result.stdout.toString()).toContain("Description:");
		expect(result.stdout.toString()).toContain("Test draft description");
		// Should not contain TUI escape codes
		expect(result.stdout.toString()).not.toContain("[?1049h");
		expect(result.stdout.toString()).not.toContain("\x1b");
	});

	// Task list already has --plain support and works correctly
});
