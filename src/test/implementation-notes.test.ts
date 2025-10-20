import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import type { Task } from "../types/index.ts";
import { editTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Implementation Notes CLI", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-notes");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Implementation Notes Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("task create with implementation notes", () => {
		it("should handle all task creation scenarios with implementation notes", async () => {
			// Test 1: create task with implementation notes using --notes
			const result1 =
				await $`bun ${[CLI_PATH, "task", "create", "Test Task 1", "--notes", "Initial implementation completed"]}`
					.cwd(TEST_DIR)
					.quiet()
					.nothrow();
			expect(result1.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			let task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("<!-- SECTION:NOTES:BEGIN -->");
			expect(extractStructuredSection(task?.rawContent || "", "implementationNotes")).toContain(
				"Initial implementation completed",
			);

			// Test 2: create task with multi-line implementation notes
			const result2 =
				await $`bun ${[CLI_PATH, "task", "create", "Test Task 2", "--notes", "Step 1: Analysis completed\nStep 2: Implementation in progress"]}`
					.cwd(TEST_DIR)
					.quiet()
					.nothrow();
			expect(result2.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-2");
			expect(task).not.toBeNull();
			const notes2 = extractStructuredSection(task?.rawContent || "", "implementationNotes") || "";
			expect(notes2).toContain("Step 1: Analysis completed");
			expect(notes2).toContain("Step 2: Implementation in progress");

			// Test 3: create task with both plan and notes (notes should come after plan)
			const result3 =
				await $`bun ${[CLI_PATH, "task", "create", "Test Task 3", "--plan", "1. Design\n2. Build\n3. Test", "--notes", "Following the plan step by step"]}`
					.cwd(TEST_DIR)
					.quiet()
					.nothrow();
			expect(result3.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-3");
			expect(task).not.toBeNull();
			expect(extractStructuredSection(task?.rawContent || "", "implementationPlan")).toContain("1. Design");
			expect(extractStructuredSection(task?.rawContent || "", "implementationNotes")).toContain(
				"Following the plan step by step",
			);

			// Check that Implementation Notes comes after Implementation Plan
			const desc = task?.rawContent || "";
			const planIndex = desc.indexOf("## Implementation Plan");
			const notesIndex = desc.indexOf("## Implementation Notes");
			expect(notesIndex).toBeGreaterThan(planIndex);

			// Test 4: create task with multiple options including notes
			const result4 =
				await $`bun ${[CLI_PATH, "task", "create", "Test Task 4", "-d", "Complex task description", "--ac", "Must work correctly,Must be tested", "--notes", "Using TDD approach"]}`
					.cwd(TEST_DIR)
					.quiet()
					.nothrow();
			expect(result4.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-4");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("Complex task description");
			expect(extractStructuredSection(task?.rawContent || "", "implementationNotes")).toContain("Using TDD approach");

			// Test 5: create task without notes should not add the section
			const result5 = await $`bun ${[CLI_PATH, "task", "create", "Test Task 5"]}`.cwd(TEST_DIR).quiet().nothrow();
			expect(result5.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-5");
			expect(task).not.toBeNull();
			// Should not add Implementation Notes section for empty notes
			expect(task?.rawContent).not.toContain("## Implementation Notes");
		});
	});

	describe("task edit with implementation notes", () => {
		it("should handle all implementation notes scenarios", async () => {
			const core = new Core(TEST_DIR);

			// Test 1: add implementation notes to existing task
			const task1: Task = {
				id: "task-1",
				title: "Test Task 1",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Test description",
			};
			await core.createTask(task1, false);

			let result = await editTaskPlatformAware(
				{
					taskId: "1",
					notes: "Fixed the bug by updating the validation logic",
				},
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			let updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask).not.toBeNull();
			expect(updatedTask?.rawContent).toContain("## Implementation Notes");
			expect(updatedTask?.rawContent).toContain("Fixed the bug by updating the validation logic");

			// Test 2: overwrite existing implementation notes
			const task2: Task = {
				id: "task-2",
				title: "Test Task 2",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Test description",
				implementationNotes: "Initial implementation completed",
			};
			await core.createTask(task2, false);

			result = await editTaskPlatformAware(
				{
					taskId: "2",
					notes: "Added error handling",
				},
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			updatedTask = await core.filesystem.loadTask("task-2");
			expect(updatedTask).not.toBeNull();
			const notesSection = updatedTask?.rawContent?.match(/## Implementation Notes\s*\n([\s\S]*?)(?=\n## |$)/i);
			expect(notesSection?.[1]).not.toContain("Initial implementation completed");
			expect(notesSection?.[1]).toContain("Added error handling");

			// Test 3: work together with status update when marking as Done
			const task3: Task = {
				id: "task-3",
				title: "Feature Implementation",
				status: "In Progress",
				assignee: ["@dev"],
				createdDate: "2025-07-03",
				labels: ["feature"],
				dependencies: [],
				description: "Implement new feature",
				acceptanceCriteriaItems: [
					{ index: 1, text: "Feature works", checked: false },
					{ index: 2, text: "Tests pass", checked: false },
				],
			};
			await core.createTask(task3, false);

			result = await editTaskPlatformAware(
				{
					taskId: "3",
					status: "Done",
					notes: "Implemented using the factory pattern\nAdded unit tests\nUpdated documentation",
				},
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			updatedTask = await core.filesystem.loadTask("task-3");
			expect(updatedTask).not.toBeNull();
			expect(updatedTask?.status).toBe("Done");
			expect(updatedTask?.rawContent).toContain("## Implementation Notes");
			expect(updatedTask?.rawContent).toContain("Implemented using the factory pattern");
			expect(updatedTask?.rawContent).toContain("Added unit tests");
			expect(updatedTask?.rawContent).toContain("Updated documentation");

			// Test 4: handle multi-line notes with proper formatting
			const task4: Task = {
				id: "task-4",
				title: "Complex Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Complex task description",
			};
			await core.createTask(task4, false);

			const multiLineNotes = `Completed the following:
- Refactored the main module
- Added error boundaries
- Improved performance by 30%

Technical decisions:
- Used memoization for expensive calculations
- Implemented lazy loading`;

			result = await editTaskPlatformAware(
				{
					taskId: "4",
					notes: multiLineNotes,
				},
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			updatedTask = await core.filesystem.loadTask("task-4");
			expect(updatedTask).not.toBeNull();
			expect(updatedTask?.rawContent).toContain("Refactored the main module");
			expect(updatedTask?.rawContent).toContain("Technical decisions:");
			expect(updatedTask?.rawContent).toContain("Implemented lazy loading");

			// Test 5: position implementation notes after implementation plan if present
			const task5: Task = {
				id: "task-5",
				title: "Planned Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				rawContent:
					"Task with plan\n\n## Acceptance Criteria\n\n- [ ] Works\n\n## Implementation Plan\n\n1. Design\n2. Build\n3. Test",
			};
			await core.createTask(task5, false);

			result = await editTaskPlatformAware(
				{
					taskId: "5",
					notes: "Followed the plan successfully",
				},
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			updatedTask = await core.filesystem.loadTask("task-5");
			expect(updatedTask).not.toBeNull();
			const desc = updatedTask?.rawContent || "";

			// Check that Implementation Notes comes after Implementation Plan
			const planIndex = desc.indexOf("## Implementation Plan");
			const notesIndex = desc.indexOf("## Implementation Notes");
			expect(planIndex).toBeGreaterThan(0);
			expect(notesIndex).toBeGreaterThan(planIndex);

			// Test 6: handle empty notes gracefully
			const task6: Task = {
				id: "task-6",
				title: "Test Task 6",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Test description",
			};
			await core.createTask(task6, false);

			result = await editTaskPlatformAware(
				{
					taskId: "6",
					notes: "",
				},
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			updatedTask = await core.filesystem.loadTask("task-6");
			expect(updatedTask).not.toBeNull();
			// Should not add Implementation Notes section for empty notes
			expect(updatedTask?.rawContent).not.toContain("## Implementation Notes");
		});

		it("preserves nested H2 headings when migrating legacy implementation notes", async () => {
			const core = new Core(TEST_DIR);
			const task: Task = {
				id: "task-7",
				title: "Legacy Notes",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				rawContent:
					"Initial description\n\n## Implementation Notes\n\nSummary of work\n\n## Follow-up\n\nCapture additional findings",
			};
			await core.createTask(task, false);

			const appendResult = await $`bun ${CLI_PATH} task edit 7 --append-notes "Added verification details"`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(appendResult.exitCode).toBe(0);

			const updated = await core.filesystem.loadTask("task-7");
			expect(updated).not.toBeNull();
			const body = updated?.rawContent || "";
			expect(body).toContain("<!-- SECTION:NOTES:BEGIN -->");
			const notesContent = extractStructuredSection(body, "implementationNotes") || "";
			expect(notesContent).toContain("## Follow-up");
			expect(notesContent).toContain("Summary of work");
			expect(notesContent).toContain("Added verification details");
		});
	});
});
