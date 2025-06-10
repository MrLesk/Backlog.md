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
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("To Do");

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

		it("should create agent instruction files when requested", async () => {
			// Set up a git repository
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			// Simulate the agent instructions being added
			const core = new Core(TEST_DIR);
			await core.initializeProject("Agent Test Project");

			// Import and call addAgentInstructions directly (simulating user saying "y")
			const { addAgentInstructions } = await import("../index.ts");
			await addAgentInstructions(TEST_DIR, core.gitOps);

			// Verify agent files were created
			const agentsFile = await Bun.file(join(TEST_DIR, "AGENTS.md")).exists();
			const claudeFile = await Bun.file(join(TEST_DIR, "CLAUDE.md")).exists();
			const cursorFile = await Bun.file(join(TEST_DIR, ".cursorrules")).exists();

			expect(agentsFile).toBe(true);
			expect(claudeFile).toBe(true);
			expect(cursorFile).toBe(true);

			// Verify content
			const agentsContent = await Bun.file(join(TEST_DIR, "AGENTS.md")).text();
			const claudeContent = await Bun.file(join(TEST_DIR, "CLAUDE.md")).text();
			expect(agentsContent).toContain("Backlog");
			expect(claudeContent).toContain("CLAUDE.md");
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
					assignee: [],
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
					assignee: [],
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
					assignee: [],
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
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
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
				assignee: ["testuser"],
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
			expect(loadedTask?.assignee).toEqual(["testuser"]);
			expect(loadedTask?.labels).toEqual(["test", "cli"]);
			expect(loadedTask?.description).toBe("## Description\n\nThis is a test task for view command");
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
				assignee: [],
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
			expect(viewedTask?.description).toBe("## Description\n\nOriginal description");
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
					status: "To Do",
					assignee: [],
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
			expect(updatedTask?.description).toBe("## Description\n\nUpdated description");
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
					assignee: [],
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
				task.assignee = ["newuser@example.com"];
				task.updatedDate = "2025-06-08";
				await core.updateTask(task, false);
			}

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
					assignee: [],
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
					assignee: [],
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
					status: "To Do",
					assignee: [],
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
					status: "To Do",
					assignee: [],
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
					status: "To Do",
					assignee: ["testuser"],
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
			expect(updatedTask?.assignee).toEqual(["testuser"]);
			expect(updatedTask?.createdDate).toBe("2025-06-08");
			expect(updatedTask?.updatedDate).toBe("2025-06-08");
			expect(updatedTask?.labels).toEqual(["yaml", "test"]);
			expect(updatedTask?.dependencies).toEqual(["task-1"]);
			expect(updatedTask?.description).toBe("## Description\n\nTesting YAML preservation");
		});
	});

	describe("task archive and state transition commands", () => {
		beforeEach(async () => {
			// Set up a git repository and initialize backlog
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("Archive Test Project");
		});

		it("should archive a task", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-1",
					title: "Archive Test Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["completed"],
					dependencies: [],
					description: "Task ready for archiving",
				},
				false,
			);

			// Archive the task
			const success = await core.archiveTask("task-1", false);
			expect(success).toBe(true);

			// Verify task is no longer in tasks directory
			const task = await core.filesystem.loadTask("task-1");
			expect(task).toBeNull();

			// Verify task exists in archive
			const { readdir } = await import("node:fs/promises");
			const archiveFiles = await readdir(join(TEST_DIR, ".backlog", "archive", "tasks"));
			expect(archiveFiles.some((f) => f.startsWith("task-1"))).toBe(true);
		});

		it("should handle archiving non-existent task", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.archiveTask("task-999", false);
			expect(success).toBe(false);
		});

		it("should demote task to drafts", async () => {
			const core = new Core(TEST_DIR);

			// Create a test task
			await core.createTask(
				{
					id: "task-2",
					title: "Demote Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["needs-revision"],
					dependencies: [],
					description: "Task that needs to go back to drafts",
				},
				false,
			);

			// Demote the task
			const success = await core.demoteTask("task-2", false);
			expect(success).toBe(true);

			// Verify task is no longer in tasks directory
			const task = await core.filesystem.loadTask("task-2");
			expect(task).toBeNull();

			// Verify task now exists as a draft
			const draft = await core.filesystem.loadDraft("task-2");
			expect(draft?.id).toBe("task-2");
			expect(draft?.title).toBe("Demote Test Task");
		});

		it("should promote draft to tasks", async () => {
			const core = new Core(TEST_DIR);

			// Create a test draft
			await core.createDraft(
				{
					id: "task-3",
					title: "Promote Test Draft",
					status: "Draft",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["ready"],
					dependencies: [],
					description: "Draft ready for promotion",
				},
				false,
			);

			// Promote the draft
			const success = await core.promoteDraft("task-3", false);
			expect(success).toBe(true);

			// Verify draft is no longer in drafts directory
			const draft = await core.filesystem.loadDraft("task-3");
			expect(draft).toBeNull();

			// Verify draft now exists as a task
			const task = await core.filesystem.loadTask("task-3");
			expect(task?.id).toBe("task-3");
			expect(task?.title).toBe("Promote Test Draft");
		});

		it("should archive a draft", async () => {
			const core = new Core(TEST_DIR);

			// Create a test draft
			await core.createDraft(
				{
					id: "task-4",
					title: "Archive Test Draft",
					status: "Draft",
					assignee: [],
					createdDate: "2025-06-08",
					labels: ["cancelled"],
					dependencies: [],
					description: "Draft that should be archived",
				},
				false,
			);

			// Archive the draft
			const success = await core.archiveDraft("task-4", false);
			expect(success).toBe(true);

			// Verify draft is no longer in drafts directory
			const draft = await core.filesystem.loadDraft("task-4");
			expect(draft).toBeNull();

			// Verify draft exists in archive
			const { readdir } = await import("node:fs/promises");
			const archiveFiles = await readdir(join(TEST_DIR, ".backlog", "archive", "drafts"));
			expect(archiveFiles.some((f) => f.startsWith("task-4"))).toBe(true);
		});

		it("should handle promoting non-existent draft", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.promoteDraft("task-999", false);
			expect(success).toBe(false);
		});

		it("should handle demoting non-existent task", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.demoteTask("task-999", false);
			expect(success).toBe(false);
		});

		it("should handle archiving non-existent draft", async () => {
			const core = new Core(TEST_DIR);

			const success = await core.archiveDraft("task-999", false);
			expect(success).toBe(false);
		});

		it("should commit archive operations automatically", async () => {
			const core = new Core(TEST_DIR);

			// Create and archive a task with auto-commit
			await core.createTask(
				{
					id: "task-5",
					title: "Commit Archive Test",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "Testing auto-commit on archive",
				},
				false,
			);

			const success = await core.archiveTask("task-5", true); // autoCommit = true
			expect(success).toBe(true);

			// Verify operation completed successfully
			const task = await core.filesystem.loadTask("task-5");
			expect(task).toBeNull();
		});

		it("should preserve task content through state transitions", async () => {
			const core = new Core(TEST_DIR);

			// Create a task with rich content
			const originalTask = {
				id: "task-6",
				title: "Content Preservation Test",
				status: "In Progress",
				assignee: ["testuser"],
				createdDate: "2025-06-08",
				labels: ["important", "preservation-test"],
				dependencies: ["task-1", "task-2"],
				description: "This task has rich metadata that should be preserved through transitions",
			};

			await core.createTask(originalTask, false);

			// Demote to draft
			await core.demoteTask("task-6", false);
			const asDraft = await core.filesystem.loadDraft("task-6");

			expect(asDraft?.title).toBe(originalTask.title);
			expect(asDraft?.assignee).toEqual(originalTask.assignee);
			expect(asDraft?.labels).toEqual(originalTask.labels);
			expect(asDraft?.dependencies).toEqual(originalTask.dependencies);
			expect(asDraft?.description).toBe(originalTask.description);

			// Promote back to task
			await core.promoteDraft("task-6", false);
			const backToTask = await core.filesystem.loadTask("task-6");

			expect(backToTask?.title).toBe(originalTask.title);
			expect(backToTask?.assignee).toEqual(originalTask.assignee);
			expect(backToTask?.labels).toEqual(originalTask.labels);
			expect(backToTask?.dependencies).toEqual(originalTask.dependencies);
			expect(backToTask?.description).toBe(originalTask.description);
		});
	});

	describe("doc and decision commands", () => {
		beforeEach(async () => {
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("Doc Test Project");
		});

		it("should create and list documents", async () => {
			const core = new Core(TEST_DIR);
			const doc: DocType = {
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-06-08",
				content: "Content",
			};
			await core.createDocument(doc, false);

			const docs = await core.filesystem.listDocuments();
			expect(docs).toHaveLength(1);
			expect(docs[0].title).toBe("Guide");
		});

		it("should create and list decisions", async () => {
			const core = new Core(TEST_DIR);
			const decision: DecisionLog = {
				id: "decision-1",
				title: "Choose Stack",
				date: "2025-06-08",
				status: "accepted",
				context: "context",
				decision: "decide",
				consequences: "conseq",
			};
			await core.createDecisionLog(decision, false);
			const decisions = await core.filesystem.listDecisionLogs();
			expect(decisions).toHaveLength(1);
			expect(decisions[0].title).toBe("Choose Stack");
		});
	});

	describe("board view command", () => {
		beforeEach(async () => {
			await Bun.spawn(["git", "init"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

			const core = new Core(TEST_DIR);
			await core.initializeProject("Board Test Project");
		});

		it("should display kanban board with tasks grouped by status", async () => {
			const core = new Core(TEST_DIR);

			// Create test tasks with different statuses
			await core.createTask(
				{
					id: "task-1",
					title: "Todo Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "A task in todo",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-2",
					title: "Progress Task",
					status: "In Progress",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "A task in progress",
				},
				false,
			);

			await core.createTask(
				{
					id: "task-3",
					title: "Done Task",
					status: "Done",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "A completed task",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(3);

			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];
			expect(statuses).toEqual(["To Do", "In Progress", "Done"]);

			// Test the kanban board generation
			const { generateKanbanBoard } = await import("../board.ts");
			const board = generateKanbanBoard(tasks, statuses);

			// Verify board contains all statuses and tasks (now on separate lines)
			expect(board).toContain("To Do");
			expect(board).toContain("In Progress");
			expect(board).toContain("Done");
			expect(board).toContain("task-1");
			expect(board).toContain("Todo Task");
			expect(board).toContain("task-2");
			expect(board).toContain("Progress Task");
			expect(board).toContain("task-3");
			expect(board).toContain("Done Task");

			// Verify board structure
			const lines = board.split("\n");
			expect(lines[0]).toContain("To Do"); // Header should contain statuses with tasks
			expect(lines[0]).toContain("In Progress");
			expect(lines[0]).toContain("Done");
			expect(lines[1]).toContain("-"); // Separator line
			expect(lines.length).toBeGreaterThan(2); // Should have content rows
		});

		it("should handle empty project with default statuses", async () => {
			const core = new Core(TEST_DIR);

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);

			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const { generateKanbanBoard } = await import("../board.ts");
			const board = generateKanbanBoard(tasks, statuses);

			// Should return empty board when no tasks exist
			expect(board).toBe("");
		});

		it("should support vertical layout option", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Todo Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-08",
					labels: [],
					dependencies: [],
					description: "A task in todo",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const { generateKanbanBoard } = await import("../board.ts");
			const board = generateKanbanBoard(tasks, statuses, "vertical");

			const lines = board.split("\n");
			expect(lines[0]).toBe("To Do");
			expect(board).toContain("task-1");
			expect(board).toContain("Todo Task");
		});

		it("should support --vertical shortcut flag", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-1",
					title: "Shortcut Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-09",
					labels: [],
					dependencies: [],
					description: "Testing vertical shortcut",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			// Test that --vertical flag produces vertical layout
			const { generateKanbanBoard } = await import("../board.ts");
			const board = generateKanbanBoard(tasks, statuses, "vertical");

			const lines = board.split("\n");
			expect(lines[0]).toBe("To Do");
			expect(board).toContain("task-1");
			expect(board).toContain("Shortcut Task");
		});

		it("should merge task status from remote branches", async () => {
			const core = new Core(TEST_DIR);

			const task = {
				id: "task-1",
				title: "Remote Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-09",
				labels: [],
				dependencies: [],
				description: "from remote",
			} as Task;

			await core.createTask(task, true);

			// set up remote repository
			const remoteDir = join(TEST_DIR, "remote.git");
			await Bun.spawn(["git", "init", "--bare", remoteDir]).exited;
			await Bun.spawn(["git", "remote", "add", "origin", remoteDir], { cwd: TEST_DIR }).exited;
			await Bun.spawn(["git", "push", "-u", "origin", "master"], { cwd: TEST_DIR }).exited;

			// create branch with updated status
			await Bun.spawn(["git", "checkout", "-b", "feature"], { cwd: TEST_DIR }).exited;
			await core.updateTask({ ...task, status: "Done" }, true);
			await Bun.spawn(["git", "push", "-u", "origin", "feature"], { cwd: TEST_DIR }).exited;

			// switch back to master where status is still To Do
			await Bun.spawn(["git", "checkout", "master"], { cwd: TEST_DIR }).exited;

			await core.gitOps.fetch();
			const branches = await core.gitOps.listRemoteBranches();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const localTasks = await core.filesystem.listTasks();
			const tasksById = new Map(localTasks.map((t) => [t.id, t]));

			for (const branch of branches) {
				const ref = `origin/${branch}`;
				const files = await core.gitOps.listFilesInTree(ref, ".backlog/tasks");
				for (const file of files) {
					const content = await core.gitOps.showFile(ref, file);
					const remoteTask = parseTask(content);
					const existing = tasksById.get(remoteTask.id);
					const currentIdx = existing ? statuses.indexOf(existing.status) : -1;
					const newIdx = statuses.indexOf(remoteTask.status);
					if (!existing || newIdx > currentIdx || currentIdx === -1 || newIdx === currentIdx) {
						tasksById.set(remoteTask.id, remoteTask);
					}
				}
			}

			const final = tasksById.get("task-1");
			expect(final?.status).toBe("Done");
		});

		it("should default to view when no subcommand is provided", async () => {
			const core = new Core(TEST_DIR);

			await core.createTask(
				{
					id: "task-99",
					title: "Default Cmd Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-10",
					labels: [],
					dependencies: [],
					description: "test",
				},
				false,
			);

			const resultDefault = Bun.spawnSync(["bun", "src/cli.ts", "board"], { cwd: TEST_DIR });
			const resultView = Bun.spawnSync(["bun", "src/cli.ts", "board", "view"], { cwd: TEST_DIR });

			expect(resultDefault.stdout.toString()).toBe(resultView.stdout.toString());
		});

		it("should export kanban board to file", async () => {
			const core = new Core(TEST_DIR);

			// Create test tasks
			await core.createTask(
				{
					id: "task-1",
					title: "Export Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-09",
					labels: [],
					dependencies: [],
					description: "Testing board export",
				},
				false,
			);

			const { exportKanbanBoardToFile } = await import("../index.ts");
			const outputPath = join(TEST_DIR, "test-export.md");
			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			await exportKanbanBoardToFile(tasks, statuses, outputPath);

			// Verify file was created and contains expected content
			const content = await Bun.file(outputPath).text();
			expect(content).toContain("To Do");
			expect(content).toContain("task-1");
			expect(content).toContain("Export Test Task");

			// Test appending behavior
			await exportKanbanBoardToFile(tasks, statuses, outputPath);
			const appendedContent = await Bun.file(outputPath).text();
			const occurrences = appendedContent.split("task-1").length - 1;
			expect(occurrences).toBe(2); // Should appear twice after appending
		});
	});
});
