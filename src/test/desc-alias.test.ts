import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("--desc alias functionality", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-desc-alias");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		// Initialize backlog project using Core
		const core = new Core(TEST_DIR);
		await core.initializeProject("Desc Alias Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should create task with --desc alias", async () => {
		const _result = await $`bun ${cliPath} task create "Test --desc alias" --desc "Created with --desc"`
			.cwd(TEST_DIR)
			.quiet();

		// Check that command succeeded (no exception thrown)
		const output = await $`bun ${cliPath} task 1 --plain`.cwd(TEST_DIR).text();
		expect(output).toContain("Test --desc alias");
		expect(output).toContain("Created with --desc");
	});

	it("should verify task created with --desc has correct description", async () => {
		// Create task with --desc
		await $`bun ${cliPath} task create "Test task" --desc "Description via --desc"`.cwd(TEST_DIR).quiet();

		// Verify the task was created with correct description
		const core = new Core(TEST_DIR);
		const task = await core.filesystem.loadTask("task-1");

		expect(task).not.toBeNull();
		expect(task?.description).toContain("Description via --desc");
	});

	it("should edit task description with --desc alias", async () => {
		// Create initial task
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Edit test task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				description: "Original description",
			},
			false,
		);

		// Edit with --desc
		await $`bun ${cliPath} task edit 1 --desc "Updated via --desc"`.cwd(TEST_DIR).quiet();

		// Command succeeded without throwing

		// Verify the description was updated
		const updatedTask = await core.filesystem.loadTask("task-1");
		expect(updatedTask?.description).toContain("Updated via --desc");
	});

	it("should create draft with --desc alias", async () => {
		await $`bun ${cliPath} draft create "Draft with --desc" --desc "Draft description"`.cwd(TEST_DIR).quiet();

		// Command succeeded without throwing
	});

	it("should verify draft created with --desc has correct description", async () => {
		// Create draft with --desc
		await $`bun ${cliPath} draft create "Test draft" --desc "Draft via --desc"`.cwd(TEST_DIR).quiet();

		// Verify the draft was created with correct description
		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft("task-1");

		expect(draft).not.toBeNull();
		expect(draft?.description).toContain("Draft via --desc");
	});

	it("should show --desc in help text", async () => {
		const result = await $`bun ${cliPath} task create --help`.cwd(TEST_DIR).text();

		expect(result).toContain("-d, --description <text>");
		expect(result).toContain("--desc <text>");
		expect(result).toContain("alias for --description");
	});
});
