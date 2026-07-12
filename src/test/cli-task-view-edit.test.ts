import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

const normalizeCliOutput = (output: string) => output.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("CLI Integration", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli");
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("task view command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "View Test Project");
		});

		it("should display task details with markdown formatting", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			const testTask = {
				id: "task-1",
				title: "Test View Task",
				status: "To Do",
				assignee: ["testuser"],
				createdDate: "2025-06-08",
				labels: ["test", "cli"],
				dependencies: [],
				rawContent: "This is a test task for view command",
			};

			await core.createTask(testTask, false);

			// Load the task back
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask).not.toBeNull();
			expect(loadedTask?.id).toBe("TASK-1"); // IDs normalized to uppercase
			expect(loadedTask?.title).toBe("Test View Task");
			expect(loadedTask?.status).toBe("To Do");
			expect(loadedTask?.assignee).toEqual(["testuser"]);
			expect(loadedTask?.labels).toEqual(["test", "cli"]);
			expect(loadedTask?.rawContent).toBe("This is a test task for view command");
		});

		it("should handle task IDs with and without 'task-' prefix", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-5",
					title: "Prefix Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Testing task ID normalization",
				},
				false,
			);

			// Test loading with full task-5 ID
			const taskWithPrefix = await core.filesystem.loadTask("task-5");
			expect(taskWithPrefix?.id).toBe("TASK-5"); // IDs normalized to uppercase

			// Test loading with just numeric ID (5)
			const taskWithoutPrefix = await core.filesystem.loadTask("5");
			// The filesystem loadTask should handle normalization
			expect(taskWithoutPrefix?.id).toBe("TASK-5"); // IDs normalized to uppercase
		});

		it("never views an adjacent or ambiguous task beyond the safe integer range", async () => {
			const core = new Core(TEST_DIR);
			const saveTask = async (id: string, title: string) => {
				await core.filesystem.saveTask({
					id,
					title,
					status: "To Do",
					assignee: [],
					createdDate: "2026-07-10",
					labels: [],
					dependencies: [],
				});
			};

			await saveTask("TASK-9007199254740993", "Huge neighbor");
			const missing = await $`bun ${CLI_PATH} task view TASK-9007199254740992 --plain`.cwd(TEST_DIR).nothrow().quiet();
			const missingOutput = normalizeCliOutput(missing.stdout.toString() + missing.stderr.toString());
			expect(missingOutput).toContain("Task TASK-9007199254740992 not found.");
			expect(missingOutput).not.toContain("Huge neighbor");

			await saveTask("TASK-9007199254740992", "Huge target");
			const found = await $`bun ${CLI_PATH} task view TASK-9007199254740992 --plain`.cwd(TEST_DIR).nothrow().quiet();
			const foundOutput = normalizeCliOutput(found.stdout.toString() + found.stderr.toString());
			expect(foundOutput).toContain("Huge target");
			expect(foundOutput).not.toContain("Huge neighbor");

			await saveTask("TASK-9007199254740992.0002", "Huge dotted target");
			const dotted = await $`bun ${CLI_PATH} task view TASK-09007199254740992.2 --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
			const dottedOutput = normalizeCliOutput(dotted.stdout.toString() + dotted.stderr.toString());
			expect(dottedOutput).toContain("Huge dotted target");

			await Bun.write(
				join(core.filesystem.tasksDir, "task-09007199254740992 - Huge-padded-duplicate.md"),
				serializeTask({
					id: "TASK-09007199254740992",
					title: "Huge padded duplicate",
					status: "To Do",
					assignee: [],
					createdDate: "2026-07-10",
					labels: [],
					dependencies: [],
				}),
			);
			const ambiguous = await $`bun ${CLI_PATH} task view TASK-9007199254740992 --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
			const ambiguousOutput = normalizeCliOutput(ambiguous.stdout.toString() + ambiguous.stderr.toString());
			expect(ambiguous.exitCode).toBe(1);
			expect(ambiguousOutput).toContain("Task ID TASK-9007199254740992 is ambiguous");
			expect(ambiguousOutput).toContain("task-9007199254740992 - Huge-target.md");
			expect(ambiguousOutput).toContain("task-09007199254740992 - Huge-padded-duplicate.md");
			expect(ambiguousOutput).toContain("backlog doctor");
			expect(ambiguousOutput).not.toContain("Huge neighbor");
		});

		it("should return null for non-existent tasks", async () => {
			const core = new Core(TEST_DIR);

			const nonExistentTask = await core.filesystem.loadTask("task-999");
			expect(nonExistentTask).toBeNull();
		});

		it("should not modify task files (read-only operation)", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			const originalTask = {
				id: "task-1",
				title: "Read Only Test",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-08",
				labels: ["readonly"],
				dependencies: [],
				rawContent: "Original description",
			};

			await core.createTask(originalTask, false);

			// Load the task (simulating view operation)
			const viewedTask = await core.filesystem.loadTask("task-1");

			// Load again to verify nothing changed
			const secondView = await core.filesystem.loadTask("task-1");

			expect(viewedTask).toEqual(secondView);
			expect(viewedTask?.title).toBe("Read Only Test");
			expect(viewedTask?.rawContent).toBe("Original description");
		});
	});

	describe("task shortcut command", () => {
		beforeEach(async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Shortcut Test Project");
		});

		it("should display formatted task details like the view command", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Shortcut Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Shortcut description",
				},
				false,
			);

			const resultShortcut = await $`bun ${CLI_PATH} task 1 --plain`.cwd(TEST_DIR).quiet();
			const resultView = await $`bun ${CLI_PATH} task view 1 --plain`.cwd(TEST_DIR).quiet();

			const outShortcut = resultShortcut.stdout.toString();
			const outView = resultView.stdout.toString();

			expect(outShortcut).toBe(outView);
			expect(outShortcut).toContain("Task TASK-1 - Shortcut Task");
		});
	});

	describe("task edit command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Edit Test Project", true);
		});

		it("should update task title, description, and status", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-1",
					title: "Original Title",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Original description",
				},
				false,
			);

			// Load and edit the task
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();

			await core.updateTaskFromInput(
				"task-1",
				{
					title: "Updated Title",
					description: "Updated description",
					status: "In Progress",
				},
				false,
			);

			// Verify changes were persisted
			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask?.title).toBe("Updated Title");
			expect(extractStructuredSection(updatedTask?.rawContent || "", "description")).toBe("Updated description");
			expect(updatedTask?.status).toBe("In Progress");
			const today = new Date().toISOString().slice(0, 16).replace("T", " ");
			expect(updatedTask?.updatedDate).toBe(today);
		});

		it("should update assignee", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-2",
					title: "Assignee Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Testing assignee updates",
				},
				false,
			);

			// Update assignee
			await core.updateTaskFromInput("task-2", { assignee: ["newuser@example.com"] }, false);

			// Verify assignee was updated
			const updatedTask = await core.filesystem.loadTask("task-2");
			expect(updatedTask?.assignee).toEqual(["newuser@example.com"]);
		});

		it("should replace all labels with new labels", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task with existing labels
			await core.createTask(
				{
					id: "task-3",
					title: "Label Replace Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["old1", "old2"],
					dependencies: [],
					rawContent: "Testing label replacement",
				},
				false,
			);

			// Replace all labels
			await core.updateTaskFromInput("task-3", { labels: ["new1", "new2", "new3"] }, false);

			// Verify labels were replaced
			const updatedTask = await core.filesystem.loadTask("task-3");
			expect(updatedTask?.labels).toEqual(["new1", "new2", "new3"]);
		});

		it("should add labels without replacing existing ones", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task with existing labels
			await core.createTask(
				{
					id: "task-4",
					title: "Label Add Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["existing"],
					dependencies: [],
					rawContent: "Testing label addition",
				},
				false,
			);

			// Add new labels
			await core.updateTaskFromInput("task-4", { addLabels: ["added1", "added2"] }, false);

			// Verify labels were added
			const updatedTask = await core.filesystem.loadTask("task-4");
			expect(updatedTask?.labels).toEqual(["existing", "added1", "added2"]);
		});

		it("should remove specific labels", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task with multiple labels
			await core.createTask(
				{
					id: "task-5",
					title: "Label Remove Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["keep1", "remove", "keep2"],
					dependencies: [],
					rawContent: "Testing label removal",
				},
				false,
			);

			// Remove specific label
			await core.updateTaskFromInput("task-5", { removeLabels: ["remove"] }, false);

			// Verify label was removed
			const updatedTask = await core.filesystem.loadTask("task-5");
			expect(updatedTask?.labels).toEqual(["keep1", "keep2"]);
		});

		it("should replace labels from repeated CLI label flags", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-6",
					title: "Repeated Label Replace Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["old1", "old2"],
					dependencies: [],
					rawContent: "Testing repeated label replacement",
				},
				false,
			);

			await $`bun ${CLI_PATH} task edit task-6 --label new1 --label new2,new3 --plain`.cwd(TEST_DIR).quiet();

			const updatedTask = await core.filesystem.loadTask("task-6");
			expect(updatedTask?.labels).toEqual(["new1", "new2", "new3"]);
		});

		it("should add labels from repeated CLI add-label flags", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-7",
					title: "Repeated Label Add Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["existing"],
					dependencies: [],
					rawContent: "Testing repeated label additions",
				},
				false,
			);

			await $`bun ${CLI_PATH} task edit task-7 --add-label video --add-label test,bug --plain`.cwd(TEST_DIR).quiet();

			const updatedTask = await core.filesystem.loadTask("task-7");
			expect(updatedTask?.labels).toEqual(["existing", "video", "test", "bug"]);
		});

		it("should remove labels from repeated CLI remove-label flags", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-8",
					title: "Repeated Label Remove Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["keep", "drop1", "drop2", "drop3"],
					dependencies: [],
					rawContent: "Testing repeated label removals",
				},
				false,
			);

			await $`bun ${CLI_PATH} task edit task-8 --remove-label drop1 --remove-label drop2,drop3 --plain`
				.cwd(TEST_DIR)
				.quiet();

			const updatedTask = await core.filesystem.loadTask("task-8");
			expect(updatedTask?.labels).toEqual(["keep"]);
		});

		it("should clear labels from CLI clear-labels flag", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-9",
					title: "Clear Labels Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["old1", "old2"],
					dependencies: [],
					rawContent: "Testing label clearing",
				},
				false,
			);

			await $`bun ${CLI_PATH} task edit task-9 --clear-labels --plain`.cwd(TEST_DIR).quiet();

			const updatedTask = await core.filesystem.loadTask("task-9");
			expect(updatedTask?.labels).toEqual([]);
		});

		it("should reject mixing CLI label replacement with label mutations", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-10",
					title: "Mixed Label Mode Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["old"],
					dependencies: [],
					rawContent: "Testing mixed label mode rejection",
				},
				false,
			);

			const addResult = await $`bun ${CLI_PATH} task edit task-10 --label replacement --add-label extra --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
			const removeResult = await $`bun ${CLI_PATH} task edit task-10 --label replacement --remove-label old --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();
			const clearResult = await $`bun ${CLI_PATH} task edit task-10 --clear-labels --add-label extra --plain`
				.cwd(TEST_DIR)
				.nothrow()
				.quiet();

			for (const result of [addResult, removeResult]) {
				expect(result.exitCode).toBe(1);
				expect(result.stderr.toString()).toContain("Cannot combine --label with --add-label or --remove-label");
			}
			expect(clearResult.exitCode).toBe(1);
			expect(clearResult.stderr.toString()).toContain(
				"Cannot combine --clear-labels with --label, --add-label, or --remove-label",
			);
			const updatedTask = await core.filesystem.loadTask("task-10");
			expect(updatedTask?.labels).toEqual(["old"]);
		});

		it("should handle non-existent task gracefully", async () => {
			const core = new Core(TEST_DIR);

			const nonExistentTask = await core.filesystem.loadTask("task-999");
			expect(nonExistentTask).toBeNull();
		});

		it("should automatically set updated_date field when editing", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-6",
					title: "Updated Date Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-07",
					labels: [],
					dependencies: [],
					rawContent: "Testing updated date",
				},
				false,
			);

			// Edit the task (without manually setting updatedDate)
			await core.updateTaskFromInput("task-6", { title: "Updated Title" }, false);

			// Verify updated_date was automatically set to today's date
			const updatedTask = await core.filesystem.loadTask("task-6");
			const today = new Date().toISOString().slice(0, 16).replace("T", " ");
			expect(updatedTask?.updatedDate).toBe(today);
			expect(updatedTask?.createdDate).toBe("2025-06-07"); // Should remain unchanged
		});

		it("should commit changes automatically", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-7",
					title: "Commit Test",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					rawContent: "Testing auto-commit",
				},
				false,
			);

			// Edit the task with auto-commit enabled
			await core.updateTaskFromInput("task-7", { title: "Updated for Commit" }, true);

			// Verify the task was updated (this confirms the update functionality works)
			const updatedTask = await core.filesystem.loadTask("task-7");
			expect(updatedTask?.title).toBe("Updated for Commit");

			// For now, just verify that updateTask with autoCommit=true doesn't throw
			// The actual git commit functionality is tested at the Core level
		});

		it("should preserve YAML frontmatter formatting", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-8",
					title: "YAML Test",
					status: "To Do",
					assignee: ["testuser"],
					createdDate: "2025-06-08",
					labels: ["yaml", "test"],
					dependencies: ["task-1"],
					rawContent: "Testing YAML preservation",
				},
				false,
			);

			// Edit the task
			await core.updateTaskFromInput(
				"task-8",
				{
					title: "Updated YAML Test",
					status: "In Progress",
				},
				false,
			);

			// Verify all frontmatter fields are preserved
			const updatedTask = await core.filesystem.loadTask("task-8");
			expect(updatedTask?.id).toBe("TASK-8"); // IDs normalized to uppercase
			expect(updatedTask?.title).toBe("Updated YAML Test");
			expect(updatedTask?.status).toBe("In Progress");
			expect(updatedTask?.assignee).toEqual(["testuser"]);
			expect(updatedTask?.createdDate).toBe("2025-06-08");
			const today = new Date().toISOString().slice(0, 16).replace("T", " ");
			expect(updatedTask?.updatedDate).toBe(today);
			expect(updatedTask?.labels).toEqual(["yaml", "test"]);
			expect(updatedTask?.dependencies).toEqual(["task-1"]);
			expect(updatedTask?.rawContent).toBe("Testing YAML preservation");
		});
	});
});
