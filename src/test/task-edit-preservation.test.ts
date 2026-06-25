import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { editTaskPlatformAware, viewTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Task edit section preservation", () => {
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
		await initializeTestProject(core, "Task Edit Preservation Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("preserves legacy task file identity and body when editing only labels", async () => {
		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const taskPath = join(tasksDir, "task-1 - hello world.md");
		await Bun.write(
			taskPath,
			`---
id: task-1
title: hello world
status: To Do
assignee: []
created_date: '2026-01-01'
labels: []
dependencies: []
---

## Description

Test description.

## Extra Notes

Keep me exactly.
`,
		);

		await editTaskPlatformAware({ taskId: "1", labels: "foo" }, TEST_DIR);

		const files = await readdir(tasksDir);
		expect(files).toContain("task-1 - hello world.md");
		expect(files).not.toContain("task-1 - hello-world.md");

		const content = await Bun.file(taskPath).text();
		expect(content).toContain("id: task-1");
		expect(content).not.toContain("id: TASK-1");
		expect(content).toContain("title: hello world");
		expect(content).toContain("status: To Do");
		expect(content).toContain("created_date:");
		expect(content).toContain("2026-01-01");
		expect(content).toContain("dependencies: []");
		expect(content).toContain("labels:\n  - foo");
		expect(content).toContain("## Description\n\nTest description.");
		expect(content).toContain("## Extra Notes\n\nKeep me exactly.");
		expect(content).not.toContain("<!-- SECTION:");
		expect(content).not.toContain("<!-- AC:");
		expect(content).not.toContain("## Acceptance Criteria");
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
				description: "Original description",
			},
			false,
		);

		// Add acceptance criteria
		await editTaskPlatformAware({ taskId: "1", ac: "Criterion 1,Criterion 2" }, TEST_DIR);

		// Add implementation plan
		await editTaskPlatformAware({ taskId: "1", plan: "Step 1\nStep 2\nStep 3" }, TEST_DIR);

		// Add implementation notes
		await editTaskPlatformAware({ taskId: "1", notes: "Original implementation notes" }, TEST_DIR);

		// Verify all sections exist
		let result = await viewTaskPlatformAware({ taskId: "1", plain: true }, TEST_DIR);

		expect(result.stdout).toContain("Original description");
		expect(result.stdout).toContain("Criterion 1");
		expect(result.stdout).toContain("Criterion 2");
		expect(result.stdout).toContain("Step 1");
		expect(result.stdout).toContain("Step 2");
		expect(result.stdout).toContain("Step 3");
		expect(result.stdout).toContain("Original implementation notes");

		// Update just the description
		await editTaskPlatformAware({ taskId: "1", description: "UPDATED description" }, TEST_DIR);

		// Verify ALL sections are preserved
		result = await viewTaskPlatformAware({ taskId: "1", plain: true }, TEST_DIR);

		expect(result.stdout).toContain("UPDATED description");
		expect(result.stdout).toContain("Criterion 1");
		expect(result.stdout).toContain("Criterion 2");
		expect(result.stdout).toContain("Step 1");
		expect(result.stdout).toContain("Step 2");
		expect(result.stdout).toContain("Step 3");
		expect(result.stdout).toContain("Original implementation notes");
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
				description: "Test description",
			},
			false,
		);

		// Add all sections
		await editTaskPlatformAware({ taskId: "2", ac: "Original criterion" }, TEST_DIR);
		await editTaskPlatformAware({ taskId: "2", plan: "Original plan" }, TEST_DIR);
		await editTaskPlatformAware({ taskId: "2", notes: "Original notes" }, TEST_DIR);

		// Add new acceptance criteria (now adds instead of replacing)
		await editTaskPlatformAware({ taskId: "2", ac: ["Updated criterion 1", "Updated criterion 2"] }, TEST_DIR);

		// Verify all sections are preserved
		const result = await viewTaskPlatformAware({ taskId: "2", plain: true }, TEST_DIR);

		expect(result.stdout).toContain("Test description");
		expect(result.stdout).toContain("Original criterion"); // Now preserved
		expect(result.stdout).toContain("Updated criterion 1");
		expect(result.stdout).toContain("Updated criterion 2");
		expect(result.stdout).toContain("Original plan");
		expect(result.stdout).toContain("Original notes");
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
				description: "Test description",
			},
			false,
		);

		// Add all sections
		await editTaskPlatformAware({ taskId: "3", ac: "Test criterion" }, TEST_DIR);
		await editTaskPlatformAware({ taskId: "3", plan: "Original plan" }, TEST_DIR);
		await editTaskPlatformAware({ taskId: "3", notes: "Original notes" }, TEST_DIR);

		// Update implementation plan
		await editTaskPlatformAware({ taskId: "3", plan: "Updated plan step 1\nUpdated plan step 2" }, TEST_DIR);

		// Verify all sections are preserved
		const result = await viewTaskPlatformAware({ taskId: "3", plain: true }, TEST_DIR);

		expect(result.stdout).toContain("Test description");
		expect(result.stdout).toContain("Test criterion");
		expect(result.stdout).toContain("Updated plan step 1");
		expect(result.stdout).toContain("Updated plan step 2");
		expect(result.stdout).toContain("Original notes");
		expect(result.stdout).not.toContain("Original plan");
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
				description: "Test description",
			},
			false,
		);

		// Add all sections
		await editTaskPlatformAware({ taskId: "4", ac: "Test criterion" }, TEST_DIR);
		await editTaskPlatformAware({ taskId: "4", plan: "Test plan" }, TEST_DIR);
		await editTaskPlatformAware({ taskId: "4", notes: "Original notes" }, TEST_DIR);

		// Update implementation notes (should overwrite existing)
		await editTaskPlatformAware({ taskId: "4", notes: "Additional notes" }, TEST_DIR);

		// Verify all sections are preserved and notes are appended
		const result = await viewTaskPlatformAware({ taskId: "4", plain: true }, TEST_DIR);

		expect(result.stdout).toContain("Test description");
		expect(result.stdout).toContain("Test criterion");
		expect(result.stdout).toContain("Test plan");
		expect(result.stdout).not.toContain("Original notes");
		expect(result.stdout).toContain("Additional notes");
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
				description: "Minimal description",
			},
			false,
		);

		// Update description
		await editTaskPlatformAware({ taskId: "5", description: "Updated minimal description" }, TEST_DIR);

		// Should have updated description and default AC text
		const result = await viewTaskPlatformAware({ taskId: "5", plain: true }, TEST_DIR);

		expect(result.stdout).toContain("Updated minimal description");
		expect(result.stdout).toContain("No acceptance criteria defined");
	});
});
