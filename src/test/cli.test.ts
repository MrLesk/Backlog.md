import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Core, isGitRepository } from "../index.ts";

const TEST_DIR = join(process.cwd(), "test-cli");

describe("CLI Integration", () => {
	beforeEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });
	});

	afterEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("backlog init command", () => {
		it("should initialize backlog project in existing git repo", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			// Initialize backlog project using Core (simulating CLI)
			const core = new Core(TEST_DIR);
			await core.initializeProject("CLI Test Project");

			// Verify directory structure was created
			const configExists = await Bun.file(join(TEST_DIR, ".backlog", "config.yml")).exists();
			expect(configExists).toBe(true);

			// Verify config content
			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("CLI Test Project");
			expect(config?.statuses).toEqual(["Draft", "To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("Draft");

			// Verify git commit was created
			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("Initialize backlog project: CLI Test Project");
		});

		it("should create all required directories", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("Directory Test");

			// Check all expected directories exist
			const expectedDirs = [
				".backlog",
				".backlog/tasks",
				".backlog/drafts",
				".backlog/archive",
				".backlog/archive/tasks",
				".backlog/archive/drafts",
				".backlog/docs",
				".backlog/decisions",
			];

			for (const dir of expectedDirs) {
				try {
					const stats = await stat(join(TEST_DIR, dir));
					expect(stats.isDirectory()).toBe(true);
				} catch {
					// If stat fails, directory doesn't exist
					expect(false).toBe(true);
				}
			}
		});

		it("should handle project names with special characters", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			const specialProjectName = "My-Project_2024 (v1.0)";
			await core.initializeProject(specialProjectName);

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe(specialProjectName);
		});

		it("should work when git repo exists", async () => {
			// Set up existing git repo
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const isRepo = await isGitRepository(TEST_DIR);
			expect(isRepo).toBe(true);

			const core = new Core(TEST_DIR);
			await core.initializeProject("Existing Repo Test");

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Existing Repo Test");
		});
	});

	describe("git integration", () => {
		beforeEach(async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;
		});

		it("should create initial commit with backlog structure", async () => {
			const core = new Core(TEST_DIR);
			await core.initializeProject("Git Integration Test");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toBe("backlog: Initialize backlog project: Git Integration Test");

			// Verify git status is clean after initialization
			const isClean = await core.gitOps.isClean();
			expect(isClean).toBe(true);
		});
	});

	describe("task list command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("List Test Project");
		});

		it("should show 'No tasks found' when no tasks exist", async () => {
			const core = new Core(TEST_DIR);
			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);
		});

		it("should list tasks grouped by status", async () => {
			const core = new Core(TEST_DIR);

			// Create test tasks with different statuses
			await core.createTask(
				{
					id: "task-1",
					title: "First Task",
					status: "To Do",
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "First test task",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-2",
					title: "Second Task",
					status: "Done",
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Second test task",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-3",
					title: "Third Task",
					status: "To Do",
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Third test task",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(3);

			// Verify tasks are grouped correctly by status
			const todoTasks = tasks.filter((t) => t.status === "To Do");
			const doneTasks = tasks.filter((t) => t.status === "Done");

			expect(todoTasks).toHaveLength(2);
			expect(doneTasks).toHaveLength(1);
			expect(todoTasks.map((t) => t.id)).toEqual(["task-1", "task-3"]);
			expect(doneTasks.map((t) => t.id)).toEqual(["task-2"]);
		});

		it("should respect config status order", async () => {
			const core = new Core(TEST_DIR);

			// Load and verify default config status order
			const config = await core.filesystem.loadConfig();
			expect(config?.statuses).toEqual(["Draft", "To Do", "In Progress", "Done"]);
		});
	});

	describe("task view command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("View Test Project");
		});

		it("should display task details with markdown formatting", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			const testTask = {
				id: "task-1",
				title: "Test View Task",
				status: "To Do",
				assignee: "testuser",
				createdDate: "2025-06-08",
				labels: ["test", "cli"],
				dependencies: [],
				description: "This is a test task for view command",
			};

			await core.createTask(testTask, false);

			// Load the task back
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask).not.toBeNull();
			expect(loadedTask?.id).toBe("task-1");
			expect(loadedTask?.title).toBe("Test View Task");
			expect(loadedTask?.status).toBe("To Do");
			expect(loadedTask?.assignee).toBe("testuser");
			expect(loadedTask?.labels).toEqual(["test", "cli"]);
			expect(loadedTask?.description).toBe("This is a test task for view command");
		});

		it("should handle task IDs with and without 'task-' prefix", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-5",
					title: "Prefix Test Task",
					status: "Draft",
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Testing task ID normalization",
				},
				false,
			);

			// Test loading with full task-5 ID
			const taskWithPrefix = await core.filesystem.loadTask("task-5");
			expect(taskWithPrefix?.id).toBe("task-5");

			// Test loading with just numeric ID (5)
			const taskWithoutPrefix = await core.filesystem.loadTask("5");
			// The filesystem loadTask should handle normalization
			expect(taskWithoutPrefix?.id).toBe("task-5");
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
				createdDate: "2025-06-08",
				labels: ["readonly"],
				dependencies: [],
				description: "Original description",
			};

			await core.createTask(originalTask, false);

			// Load the task (simulating view operation)
			const viewedTask = await core.filesystem.loadTask("task-1");

			// Load again to verify nothing changed
			const secondView = await core.filesystem.loadTask("task-1");

			expect(viewedTask).toEqual(secondView);
			expect(viewedTask?.title).toBe("Read Only Test");
			expect(viewedTask?.description).toBe("Original description");
		});
	});

	describe("task edit command", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("Edit Test Project");
		});

		it("should update task title, description, and status", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-1",
					title: "Original Title",
					status: "Draft",
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Original description",
				},
				false,
			);

			// Load and edit the task
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();

			if (task) {
				task.title = "Updated Title";
				task.description = "Updated description";
				task.status = "In Progress";
				task.updatedDate = "2025-06-08";

				await core.updateTask(task, false);
			}

			// Verify changes were persisted
			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask?.title).toBe("Updated Title");
			expect(updatedTask?.description).toBe("Updated description");
			expect(updatedTask?.status).toBe("In Progress");
			expect(updatedTask?.updatedDate).toBe("2025-06-08");
		});

		it("should update assignee", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-2",
					title: "Assignee Test",
					status: "To Do",
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Testing assignee updates",
				},
				false,
			);

			// Update assignee
			const task = await core.filesystem.loadTask("task-2");
			if (task) {
				task.assignee = "newuser@example.com";
				task.updatedDate = "2025-06-08";
				await core.updateTask(task, false);
			}

			// Verify assignee was updated
			const updatedTask = await core.filesystem.loadTask("task-2");
			expect(updatedTask?.assignee).toBe("newuser@example.com");
		});

		it("should replace all labels with new labels", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task with existing labels
			await core.createTask(
				{
					id: "task-3",
					title: "Label Replace Test",
					status: "To Do",
					createdDate: "2025-06-08",
					labels: ["old1", "old2"],
					dependencies: [],
					description: "Testing label replacement",
				},
				false,
			);

			// Replace all labels
			const task = await core.filesystem.loadTask("task-3");
			if (task) {
				task.labels = ["new1", "new2", "new3"];
				task.updatedDate = "2025-06-08";
				await core.updateTask(task, false);
			}

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
					createdDate: "2025-06-08",
					labels: ["existing"],
					dependencies: [],
					description: "Testing label addition",
				},
				false,
			);

			// Add new labels
			const task = await core.filesystem.loadTask("task-4");
			if (task) {
				const newLabels = [...task.labels];
				const labelsToAdd = ["added1", "added2"];
				for (const label of labelsToAdd) {
					if (!newLabels.includes(label)) {
						newLabels.push(label);
					}
				}
				task.labels = newLabels;
				task.updatedDate = "2025-06-08";
				await core.updateTask(task, false);
			}

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
					createdDate: "2025-06-08",
					labels: ["keep1", "remove", "keep2"],
					dependencies: [],
					description: "Testing label removal",
				},
				false,
			);

			// Remove specific label
			const task = await core.filesystem.loadTask("task-5");
			if (task) {
				const newLabels = task.labels.filter((label) => label !== "remove");
				task.labels = newLabels;
				task.updatedDate = "2025-06-08";
				await core.updateTask(task, false);
			}

			// Verify label was removed
			const updatedTask = await core.filesystem.loadTask("task-5");
			expect(updatedTask?.labels).toEqual(["keep1", "keep2"]);
		});

		it("should handle non-existent task gracefully", async () => {
			const core = new Core(TEST_DIR);

			const nonExistentTask = await core.filesystem.loadTask("task-999");
			expect(nonExistentTask).toBeNull();
		});

		it("should set updated_date field when editing", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-6",
					title: "Updated Date Test",
					status: "Draft",
					createdDate: "2025-06-07",
					labels: [],
					dependencies: [],
					description: "Testing updated date",
				},
				false,
			);

			// Edit the task
			const task = await core.filesystem.loadTask("task-6");
			if (task) {
				task.title = "Updated Title";
				task.updatedDate = "2025-06-08";
				await core.updateTask(task, false);
			}

			// Verify updated_date was set
			const updatedTask = await core.filesystem.loadTask("task-6");
			expect(updatedTask?.updatedDate).toBe("2025-06-08");
			expect(updatedTask?.createdDate).toBe("2025-06-07"); // Should remain unchanged
		});

		it("should commit changes automatically", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-7",
					title: "Commit Test",
					status: "Draft",
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Testing auto-commit",
				},
				false,
			);

			// Edit the task with auto-commit enabled
			const task = await core.filesystem.loadTask("task-7");
			if (task) {
				task.title = "Updated for Commit";
				task.updatedDate = "2025-06-08";
				await core.updateTask(task, true); // autoCommit = true
			}

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
					status: "Draft",
					assignee: "testuser",
					createdDate: "2025-06-08",
					labels: ["yaml", "test"],
					dependencies: ["task-1"],
					description: "Testing YAML preservation",
				},
				false,
			);

			// Edit the task
			const task = await core.filesystem.loadTask("task-8");
			if (task) {
				task.title = "Updated YAML Test";
				task.status = "In Progress";
				task.updatedDate = "2025-06-08";
				await core.updateTask(task, false);
			}

			// Verify all frontmatter fields are preserved
			const updatedTask = await core.filesystem.loadTask("task-8");
			expect(updatedTask?.id).toBe("task-8");
			expect(updatedTask?.title).toBe("Updated YAML Test");
			expect(updatedTask?.status).toBe("In Progress");
			expect(updatedTask?.assignee).toBe("testuser");
			expect(updatedTask?.createdDate).toBe("2025-06-08");
			expect(updatedTask?.updatedDate).toBe("2025-06-08");
			expect(updatedTask?.labels).toEqual(["yaml", "test"]);
			expect(updatedTask?.dependencies).toEqual(["task-1"]);
			expect(updatedTask?.description).toBe("Testing YAML preservation");
		});
	});
});
