import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";

describe("--desc alias functionality", () => {
	const testDir = join(process.cwd(), "test-desc-alias");
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
		await mkdir(testDir, { recursive: true });

		// Initialize git repo first
		await $`git init`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email "test@example.com"`.cwd(testDir).quiet();

		// Initialize backlog project using Core
		const core = new Core(testDir);
		await core.initializeProject("Desc Alias Test Project");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should create task with --desc alias", async () => {
		const result = await $`bun ${cliPath} task create "Test --desc alias" --desc "Created with --desc"`
			.cwd(testDir)
			.quiet();

		// Check that command succeeded (no exception thrown)
		const output = await $`bun ${cliPath} task 1 --plain`.cwd(testDir).text();
		expect(output).toContain("Test --desc alias");
		expect(output).toContain("Created with --desc");
	});

	it("should verify task created with --desc has correct description", async () => {
		// Create task with --desc
		await $`bun ${cliPath} task create "Test task" --desc "Description via --desc"`.cwd(testDir).quiet();

		// Verify the task was created with correct description
		const core = new Core(testDir);
		const task = await core.filesystem.loadTask("task-1");

		expect(task).not.toBeNull();
		expect(task?.body).toContain("Description via --desc");
	});

	it("should edit task description with --desc alias", async () => {
		// Create initial task
		const core = new Core(testDir);
		await core.createTask(
			{
				id: "task-1",
				title: "Edit test task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				body: "Original description",
			},
			false,
		);

		// Edit with --desc
		await $`bun ${cliPath} task edit 1 --desc "Updated via --desc"`.cwd(testDir).quiet();

		// Command succeeded without throwing

		// Verify the description was updated
		const updatedTask = await core.filesystem.loadTask("task-1");
		expect(updatedTask?.body).toContain("Updated via --desc");
	});

	it("should create draft with --desc alias", async () => {
		await $`bun ${cliPath} draft create "Draft with --desc" --desc "Draft description"`.cwd(testDir).quiet();

		// Command succeeded without throwing
	});

	it("should verify draft created with --desc has correct description", async () => {
		// Create draft with --desc
		await $`bun ${cliPath} draft create "Test draft" --desc "Draft via --desc"`.cwd(testDir).quiet();

		// Verify the draft was created with correct description
		const core = new Core(testDir);
		const draft = await core.filesystem.loadDraft("task-1");

		expect(draft).not.toBeNull();
		expect(draft?.body).toContain("Draft via --desc");
	});

	it("should show --desc in help text", async () => {
		const result = await $`bun ${cliPath} task create --help`.cwd(testDir).text();

		expect(result).toContain("-d, --description <text>");
		expect(result).toContain("--desc <text>");
		expect(result).toContain("alias for --description");
	});
});
