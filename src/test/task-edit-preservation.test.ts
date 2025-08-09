import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Task edit section preservation", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-task-edit-preservation");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		// Initialize backlog project using Core
		const core = new Core(TEST_DIR);
		await core.initializeProject("Task Edit Preservation Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should preserve all sections when updating description", async () => {
		// Create a task with all sections
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Full task test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				body: "Original description",
			},
			false,
		);

		// Add acceptance criteria
		await $`bun ${cliPath} task edit 1 --ac "Criterion 1,Criterion 2"`.cwd(TEST_DIR).quiet();

		// Add implementation plan
		await $`bun ${cliPath} task edit 1 --plan "Step 1\nStep 2\nStep 3"`.cwd(TEST_DIR).quiet();

		// Add implementation notes
		await $`bun ${cliPath} task edit 1 --notes "Original implementation notes"`.cwd(TEST_DIR).quiet();

		// Verify all sections exist
		let result = await $`bun ${cliPath} task 1 --plain`.cwd(TEST_DIR).text();

		expect(result).toContain("Original description");
		expect(result).toContain("Criterion 1");
		expect(result).toContain("Criterion 2");
		expect(result).toContain("Step 1");
		expect(result).toContain("Step 2");
		expect(result).toContain("Step 3");
		expect(result).toContain("Original implementation notes");

		// Update just the description
		await $`bun ${cliPath} task edit 1 -d "UPDATED description"`.cwd(TEST_DIR).quiet();

		// Verify ALL sections are preserved
		result = await $`bun ${cliPath} task 1 --plain`.cwd(TEST_DIR).text();

		expect(result).toContain("UPDATED description");
		expect(result).toContain("Criterion 1");
		expect(result).toContain("Criterion 2");
		expect(result).toContain("Step 1");
		expect(result).toContain("Step 2");
		expect(result).toContain("Step 3");
		expect(result).toContain("Original implementation notes");
	});

	it("should preserve all sections when updating acceptance criteria", async () => {
		// Create a task with all sections
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-2",
				title: "AC update test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				body: "Test description",
			},
			false,
		);

		// Add all sections
		await $`bun ${cliPath} task edit 2 --ac "Original criterion"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit 2 --plan "Original plan"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit 2 --notes "Original notes"`.cwd(TEST_DIR).quiet();

		// Add new acceptance criteria (now adds instead of replacing)
		await $`bun ${cliPath} task edit 2 --ac "Updated criterion 1" --ac "Updated criterion 2"`.cwd(TEST_DIR).quiet();

		// Verify all sections are preserved
		const result = await $`bun ${cliPath} task 2 --plain`.cwd(TEST_DIR).text();

		expect(result).toContain("Test description");
		expect(result).toContain("Original criterion"); // Now preserved
		expect(result).toContain("Updated criterion 1");
		expect(result).toContain("Updated criterion 2");
		expect(result).toContain("Original plan");
		expect(result).toContain("Original notes");
	});

	it("should preserve all sections when updating implementation plan", async () => {
		// Create a task with all sections
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-3",
				title: "Plan update test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				body: "Test description",
			},
			false,
		);

		// Add all sections
		await $`bun ${cliPath} task edit 3 --ac "Test criterion"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit 3 --plan "Original plan"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit 3 --notes "Original notes"`.cwd(TEST_DIR).quiet();

		// Update implementation plan
		await $`bun ${cliPath} task edit 3 --plan "Updated plan step 1\nUpdated plan step 2"`.cwd(TEST_DIR).quiet();

		// Verify all sections are preserved
		const result = await $`bun ${cliPath} task 3 --plain`.cwd(TEST_DIR).text();

		expect(result).toContain("Test description");
		expect(result).toContain("Test criterion");
		expect(result).toContain("Updated plan step 1");
		expect(result).toContain("Updated plan step 2");
		expect(result).toContain("Original notes");
		expect(result).not.toContain("Original plan");
	});

	it("should preserve all sections when updating implementation notes", async () => {
		// Create a task with all sections
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-4",
				title: "Notes update test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				body: "Test description",
			},
			false,
		);

		// Add all sections
		await $`bun ${cliPath} task edit 4 --ac "Test criterion"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit 4 --plan "Test plan"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit 4 --notes "Original notes"`.cwd(TEST_DIR).quiet();

		// Update implementation notes (should append to existing)
		await $`bun ${cliPath} task edit 4 --notes "Additional notes"`.cwd(TEST_DIR).quiet();

		// Verify all sections are preserved and notes are appended
		const result = await $`bun ${cliPath} task 4 --plain`.cwd(TEST_DIR).text();

		expect(result).toContain("Test description");
		expect(result).toContain("Test criterion");
		expect(result).toContain("Test plan");
		expect(result).toContain("Original notes");
		expect(result).toContain("Additional notes");
	});

	it("should handle tasks with minimal content", async () => {
		// Create a task with just description
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-5",
				title: "Minimal task test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				body: "Minimal description",
			},
			false,
		);

		// Update description
		await $`bun ${cliPath} task edit 5 -d "Updated minimal description"`.cwd(TEST_DIR).quiet();

		// Should have updated description and default AC text
		const result = await $`bun ${cliPath} task 5 --plain`.cwd(TEST_DIR).text();

		expect(result).toContain("Updated minimal description");
		expect(result).toContain("No acceptance criteria defined");
	});
});
