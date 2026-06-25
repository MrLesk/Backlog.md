import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTaskPlatformAware, editTaskPlatformAware, viewTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

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
		await initializeTestProject(core, "Desc Alias Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should create task with --desc alias", async () => {
		await createTaskPlatformAware({ title: "Test --desc alias", description: "Created with --desc" }, TEST_DIR);

		// Check output via viewTask
		const output = await viewTaskPlatformAware({ taskId: "1", plain: true }, TEST_DIR);
		expect(output.stdout).toContain("Test --desc alias");
		expect(output.stdout).toContain("Created with --desc");
	});

	it("should verify task created with --desc has correct description", async () => {
		// Create task with description
		await createTaskPlatformAware({ title: "Test task", description: "Description via --desc" }, TEST_DIR);

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

		// Edit with description
		await editTaskPlatformAware({ taskId: "1", description: "Updated via --desc" }, TEST_DIR);

		// Verify the description was updated
		const updatedTask = await core.filesystem.loadTask("task-1");
		expect(updatedTask?.description).toContain("Updated via --desc");
	});

	it("should create draft with --desc alias", async () => {
		const result = await createTaskPlatformAware(
			{ title: "Draft with --desc", description: "Draft description", draft: true },
			TEST_DIR,
		);
		// Command succeeded
		expect(result.exitCode).toBe(0);
	});

	it("should verify draft created with --desc has correct description", async () => {
		// Create draft with description
		await createTaskPlatformAware({ title: "Test draft", description: "Draft via --desc", draft: true }, TEST_DIR);

		// Verify the draft was created with correct description
		const core = new Core(TEST_DIR);
		const draft = await core.filesystem.loadDraft("draft-1");

		expect(draft).not.toBeNull();
		expect(draft?.description).toContain("Draft via --desc");
	});

	it("should show --desc in help text", async () => {
		// CLI-CONTRACT: verifies --desc alias appears in task create help output
		const result = await $`bun ${cliPath} task create --help`.cwd(TEST_DIR).text();

		expect(result).toContain("-d, --description <text>");
		expect(result).toContain("--desc <text>");
		expect(result).toContain("alias for --description");
	});
});
