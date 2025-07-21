import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createTaskPlatformAware, editTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Implementation Plan CLI", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-plan");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Implementation Plan Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("task create with implementation plan", () => {
		it("should handle all task creation scenarios with implementation plans", async () => {
			// Test 1: create task with implementation plan using --plan
			const result1 =
				await $`bun ${[CLI_PATH, "task", "create", "Test Task 1", "--plan", "Step 1: Analyze\nStep 2: Implement"]}`
					.cwd(TEST_DIR)
					.quiet()
					.nothrow();
			expect(result1.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			let task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Implementation Plan");
			expect(task?.body).toContain("Step 1: Analyze");
			expect(task?.body).toContain("Step 2: Implement");

			// Test 2: create task with both description and implementation plan
			const result2 =
				await $`bun ${[CLI_PATH, "task", "create", "Test Task 2", "-d", "Task description", "--plan", "1. First step\n2. Second step"]}`
					.cwd(TEST_DIR)
					.quiet()
					.nothrow();
			expect(result2.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-2");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Description");
			expect(task?.body).toContain("Task description");
			expect(task?.body).toContain("## Implementation Plan");
			expect(task?.body).toContain("1. First step");
			expect(task?.body).toContain("2. Second step");

			// Test 3: create task with acceptance criteria and implementation plan
			const result = await createTaskPlatformAware(
				{
					title: "Test Task 3",
					ac: "Must work correctly, Must be tested",
					plan: "Phase 1: Setup\nPhase 2: Testing",
				},
				TEST_DIR,
			);

			if (result.exitCode !== 0) {
				console.error("CLI Error:", result.stderr || result.stdout);
				console.error("Exit code:", result.exitCode);
			}
			expect(result.exitCode).toBe(0);

			task = await core.filesystem.loadTask(result.taskId || "task-3");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] Must work correctly");
			expect(task?.body).toContain("- [ ] Must be tested");
			expect(task?.body).toContain("## Implementation Plan");
			expect(task?.body).toContain("Phase 1: Setup");
			expect(task?.body).toContain("Phase 2: Testing");
		});
	});

	describe("task edit with implementation plan", () => {
		beforeEach(async () => {
			const core = new Core(TEST_DIR);
			await core.createTask(
				{
					id: "task-1",
					title: "Existing Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-19",
					labels: [],
					dependencies: [],
					body: "## Description\n\nExisting task description",
				},
				false,
			);
		});

		it("should handle all task editing scenarios with implementation plans", async () => {
			// Test 1: add implementation plan to existing task
			const result1 = await editTaskPlatformAware({ taskId: "1", plan: "New plan:\n- Step A\n- Step B" }, TEST_DIR);
			expect(result1.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			let task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Description");
			expect(task?.body).toContain("Existing task description");
			expect(task?.body).toContain("## Implementation Plan");
			expect(task?.body).toContain("New plan:");
			expect(task?.body).toContain("- Step A");
			expect(task?.body).toContain("- Step B");

			// Test 2: replace existing implementation plan
			// First manually add an old plan to the task by updating it directly
			task = await core.filesystem.loadTask("task-1");
			if (task) {
				task.body = `${task.body.replace(/## Implementation Plan[\s\S]*?$/, "")}

## Implementation Plan

Old plan:
1. Old step 1
2. Old step 2`;
				await core.updateTask(task, false);
			}

			// Now update with new plan
			const result2 = await editTaskPlatformAware(
				{ taskId: "1", plan: "Updated plan:\n1. New step 1\n2. New step 2" },
				TEST_DIR,
			);
			expect(result2.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Implementation Plan");
			expect(task?.body).toContain("Updated plan:");
			expect(task?.body).toContain("1. New step 1");
			expect(task?.body).toContain("2. New step 2");
			expect(task?.body).not.toContain("Old plan:");
			expect(task?.body).not.toContain("Old step 1");

			// Test 3: update both title and implementation plan
			const result =
				await $`bun ${[CLI_PATH, "task", "edit", "1", "--title", "Updated Title", "--plan", "Implementation:\n- Do this\n- Then that"]}`
					.cwd(TEST_DIR)
					.quiet()
					.nothrow();

			if (result.exitCode !== 0) {
				console.error("CLI Error:", result.stderr.toString() || result.stdout.toString());
				console.error("Exit code:", result.exitCode);
			}
			expect(result.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.title).toBe("Updated Title");
			expect(task?.body).toContain("## Implementation Plan");
			expect(task?.body).toContain("Implementation:");
			expect(task?.body).toContain("- Do this");
			expect(task?.body).toContain("- Then that");
		});
	});

	describe("implementation plan positioning", () => {
		it("should handle implementation plan positioning and edge cases", async () => {
			// Test 1: place implementation plan after acceptance criteria when both exist
			const result1 =
				await $`bun ${[CLI_PATH, "task", "create", "Test Task", "-d", "Description text", "--ac", "Criterion 1", "--plan", "Plan text"]}`
					.cwd(TEST_DIR)
					.quiet()
					.nothrow();

			if (result1.exitCode !== 0) {
				console.error("CLI Error:", result1.stderr.toString() || result1.stdout.toString());
				console.error("Exit code:", result1.exitCode);
			}
			expect(result1.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			let task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();

			const description = task?.body || "";
			const descIndex = description.indexOf("## Description");
			const acIndex = description.indexOf("## Acceptance Criteria");
			const planIndex = description.indexOf("## Implementation Plan");

			// Verify order: Description -> Acceptance Criteria -> Implementation Plan
			expect(descIndex).toBeLessThan(acIndex);
			expect(acIndex).toBeLessThan(planIndex);

			// Test 2: create task without plan (should not add the section)
			const result2 = await $`bun ${[CLI_PATH, "task", "create", "Test Task 2"]}`.cwd(TEST_DIR).quiet().nothrow();

			if (result2.exitCode !== 0) {
				console.error("CLI Error:", result2.stderr.toString() || result2.stdout.toString());
				console.error("Exit code:", result2.exitCode);
			}
			expect(result2.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-2");
			expect(task).not.toBeNull();
			// Should NOT add the section when no plan is provided
			expect(task?.body).not.toContain("## Implementation Plan");
		});
	});
});
