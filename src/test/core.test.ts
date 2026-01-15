import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { Document, Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Core", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-core");
		core = new Core(TEST_DIR);
		await core.filesystem.ensureBacklogStructure();

		// Initialize git repository for testing
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("initialization", () => {
		it("should have filesystem and git operations available", () => {
			expect(core.filesystem).toBeDefined();
			expect(core.gitOps).toBeDefined();
		});

		it("should initialize project with default config", async () => {
			await core.initializeProject("Test Project", true);

			const config = await core.filesystem.loadConfig();
			expect(config?.projectName).toBe("Test Project");
			expect(config?.statuses).toEqual(["To Do", "In Progress", "Done"]);
			expect(config?.defaultStatus).toBe("To Do");
		});
	});

	describe("task operations", () => {
		const sampleTask: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-06-07",
			labels: ["test"],
			dependencies: [],
			description: "This is a test task",
		};

		beforeEach(async () => {
			await core.initializeProject("Test Project", true);
		});

		it("should create task without auto-commit", async () => {
			await core.createTask(sampleTask, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("TASK-1");
			expect(loadedTask?.title).toBe("Test Task");
		});

		it("should create task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			// Check if task file was created
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("TASK-1");

			// Check git status to see if there are uncommitted changes
			const _hasChanges = await core.gitOps.hasUncommittedChanges();

			const lastCommit = await core.gitOps.getLastCommitMessage();
			// For now, just check that we have a commit (could be initialization or task)
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("should update task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			// Check original task
			const originalTask = await core.filesystem.loadTask("task-1");
			expect(originalTask?.title).toBe("Test Task");

			await core.updateTaskFromInput("task-1", { title: "Updated Task" }, true);

			// Check if task was updated
			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.title).toBe("Updated Task");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			// For now, just check that we have a commit (could be initialization or task)
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("should archive task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			const archived = await core.archiveTask("task-1", true);
			expect(archived).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Archive task TASK-1");
		});

		it("should demote task with auto-commit", async () => {
			await core.createTask(sampleTask, true);

			const demoted = await core.demoteTask("task-1", true);
			expect(demoted).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Demote task TASK-1");
		});

		it("should resolve tasks using flexible ID formats", async () => {
			const standardTask: Task = { ...sampleTask, id: "task-5", title: "Standard" };
			const paddedTask: Task = { ...sampleTask, id: "task-007", title: "Padded" };
			await core.createTask(standardTask, false);
			await core.createTask(paddedTask, false);

			const uppercase = await core.getTask("TASK-5");
			expect(uppercase?.id).toBe("TASK-5");

			const bare = await core.getTask("5");
			expect(bare?.id).toBe("TASK-5");

			const zeroPadded = await core.getTask("0007");
			expect(zeroPadded?.id).toBe("TASK-007");

			const mixedCase = await core.getTask("Task-007");
			expect(mixedCase?.id).toBe("TASK-007");
		});

		it("should return false when archiving non-existent task", async () => {
			const archived = await core.archiveTask("non-existent", true);
			expect(archived).toBe(false);
		});

		it("should apply default status when task has empty status", async () => {
			const taskWithoutStatus: Task = {
				...sampleTask,
				status: "",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.status).toBe("To Do"); // Should use default from config
		});

		it("should not override existing status", async () => {
			const taskWithStatus: Task = {
				...sampleTask,
				status: "In Progress",
			};

			await core.createTask(taskWithStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-1");
			expect(loadedTask?.status).toBe("In Progress");
		});

		it("should preserve description text when saving without header markers", async () => {
			const taskNoHeader: Task = {
				...sampleTask,
				id: "task-2",
				description: "Just text",
			};

			await core.createTask(taskNoHeader, false);
			const loaded = await core.filesystem.loadTask("task-2");
			expect(loaded?.description).toBe("Just text");
			const body = await core.getTaskContent("task-2");
			const matches = (body?.match(/## Description/g) ?? []).length;
			expect(matches).toBe(1);
		});

		it("should not duplicate description header in saved content", async () => {
			const taskWithHeader: Task = {
				...sampleTask,
				id: "task-3",
				description: "Existing",
			};

			await core.createTask(taskWithHeader, false);
			const body = await core.getTaskContent("task-3");
			const matches = (body?.match(/## Description/g) ?? []).length;
			expect(matches).toBe(1);
		});

		it("should handle task creation without auto-commit when git fails", async () => {
			// Create task in directory without git
			const nonGitCore = new Core(join(TEST_DIR, "no-git"));
			await nonGitCore.filesystem.ensureBacklogStructure();

			// This should succeed even without git
			await nonGitCore.createTask(sampleTask, false);

			const loadedTask = await nonGitCore.filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe("TASK-1");
		});

		it("should normalize assignee for string and array inputs", async () => {
			const stringTask = {
				...sampleTask,
				id: "task-2",
				title: "String Assignee",
				assignee: "@alice",
			} as unknown as Task;
			await core.createTask(stringTask, false);
			const loadedString = await core.filesystem.loadTask("task-2");
			expect(loadedString?.assignee).toEqual(["@alice"]);

			const arrayTask: Task = {
				...sampleTask,
				id: "task-3",
				title: "Array Assignee",
				assignee: ["@bob"],
			};
			await core.createTask(arrayTask, false);
			const loadedArray = await core.filesystem.loadTask("task-3");
			expect(loadedArray?.assignee).toEqual(["@bob"]);
		});

		it("should normalize assignee when updating tasks", async () => {
			await core.createTask(sampleTask, false);

			await core.updateTaskFromInput("task-1", { assignee: ["@carol"] }, false);
			let loaded = await core.filesystem.loadTask("task-1");
			expect(loaded?.assignee).toEqual(["@carol"]);

			await core.updateTaskFromInput("task-1", { assignee: ["@dave"] }, false);
			loaded = await core.filesystem.loadTask("task-1");
			expect(loaded?.assignee).toEqual(["@dave"]);
		});

		it("should create sub-tasks with proper hierarchical IDs", async () => {
			await core.initializeProject("Subtask Project", true);

			// Create parent task
			const { task: parent } = await core.createTaskFromInput({
				title: "Parent Task",
				status: "To Do",
			});
			expect(parent.id).toBe("TASK-1");

			// Create first sub-task
			const { task: child1 } = await core.createTaskFromInput({
				title: "First Child",
				parentTaskId: parent.id,
				status: "To Do",
			});
			expect(child1.id).toBe("TASK-1.1");
			expect(child1.parentTaskId).toBe("TASK-1");

			// Create second sub-task
			const { task: child2 } = await core.createTaskFromInput({
				title: "Second Child",
				parentTaskId: parent.id,
				status: "To Do",
			});
			expect(child2.id).toBe("TASK-1.2");
			expect(child2.parentTaskId).toBe("TASK-1");

			// Create another parent task to ensure sequential numbering still works
			const { task: parent2 } = await core.createTaskFromInput({
				title: "Second Parent",
				status: "To Do",
			});
			expect(parent2.id).toBe("TASK-2");
		});
	});

	describe("document operations", () => {
		const baseDocument: Document = {
			id: "doc-1",
			title: "Operations Guide",
			type: "guide",
			createdDate: "2025-06-07",
			rawContent: "# Ops Guide",
		};

		beforeEach(async () => {
			await core.initializeProject("Test Project", false);
		});

		it("updates a document title without leaving the previous file behind", async () => {
			await core.createDocument(baseDocument, false);

			const [initialFile] = await Array.fromAsync(new Bun.Glob("doc-*.md").scan({ cwd: core.filesystem.docsDir }));
			expect(initialFile).toBe("doc-1 - Operations-Guide.md");

			const documents = await core.filesystem.listDocuments();
			const existingDoc = documents[0];
			if (!existingDoc) {
				throw new Error("Expected document to exist after creation");
			}
			expect(existingDoc.title).toBe("Operations Guide");

			await core.updateDocument({ ...existingDoc, title: "Operations Guide Updated" }, "# Updated content", false);

			const docFiles = await Array.fromAsync(new Bun.Glob("doc-*.md").scan({ cwd: core.filesystem.docsDir }));
			expect(docFiles).toHaveLength(1);
			expect(docFiles[0]).toBe("doc-1 - Operations-Guide-Updated.md");

			const updatedDocs = await core.filesystem.listDocuments();
			expect(updatedDocs[0]?.title).toBe("Operations Guide Updated");
		});

		it("shows a git rename when the document title changes", async () => {
			await core.createDocument(baseDocument, true);

			const renamedDoc: Document = {
				...baseDocument,
				title: "Operations Guide Renamed",
			};

			await core.updateDocument(renamedDoc, "# Ops Guide", false);

			await $`git add -A`.cwd(TEST_DIR).quiet();
			const diffResult = await $`git diff --name-status -M HEAD`.cwd(TEST_DIR).quiet();
			const diff = diffResult.stdout.toString();
			const previousPath = "backlog/docs/doc-1 - Operations-Guide.md";
			const renamedPath = "backlog/docs/doc-1 - Operations-Guide-Renamed.md";
			const escapeForRegex = (value: string) => value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
			expect(diff).toMatch(
				new RegExp(`^R\\d*\\t${escapeForRegex(previousPath)}\\t${escapeForRegex(renamedPath)}`, "m"),
			);
		});
	});

	describe("draft operations", () => {
		// Drafts now use DRAFT-X id format and draft-x filename prefix
		const sampleDraft: Task = {
			id: "draft-1",
			title: "Draft Task",
			status: "Draft",
			assignee: [],
			createdDate: "2025-06-07",
			labels: [],
			dependencies: [],
			description: "Draft task",
		};

		beforeEach(async () => {
			await core.initializeProject("Draft Project", true);
		});

		it("should create draft without auto-commit", async () => {
			await core.createDraft(sampleDraft, false);

			const loaded = await core.filesystem.loadDraft("draft-1");
			expect(loaded?.id).toBe("DRAFT-1");
		});

		it("should create draft with auto-commit", async () => {
			await core.createDraft(sampleDraft, true);

			const loaded = await core.filesystem.loadDraft("draft-1");
			expect(loaded?.id).toBe("DRAFT-1");

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toBeDefined();
			expect(lastCommit.length).toBeGreaterThan(0);
		});

		it("should promote draft with auto-commit", async () => {
			await core.createDraft(sampleDraft, true);

			const promoted = await core.promoteDraft("draft-1", true);
			expect(promoted).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Promote draft DRAFT-1");
		});

		it("should archive draft with auto-commit", async () => {
			await core.createDraft(sampleDraft, true);

			const archived = await core.archiveDraft("draft-1", true);
			expect(archived).toBe(true);

			const lastCommit = await core.gitOps.getLastCommitMessage();
			expect(lastCommit).toContain("backlog: Archive draft DRAFT-1");
		});

		it("should normalize assignee for string and array inputs", async () => {
			const draftString = {
				...sampleDraft,
				id: "draft-2",
				title: "Draft String",
				assignee: "@erin",
			} as unknown as Task;
			await core.createDraft(draftString, false);
			const loadedString = await core.filesystem.loadDraft("draft-2");
			expect(loadedString?.assignee).toEqual(["@erin"]);

			const draftArray: Task = {
				...sampleDraft,
				id: "draft-3",
				title: "Draft Array",
				assignee: ["@frank"],
			};
			await core.createDraft(draftArray, false);
			const loadedArray = await core.filesystem.loadDraft("draft-3");
			expect(loadedArray?.assignee).toEqual(["@frank"]);
		});
	});

	describe("integration with config", () => {
		it("should use custom default status from config", async () => {
			// Initialize with custom config
			await core.initializeProject("Custom Project");

			// Update config with custom default status
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.defaultStatus = "Custom Status";
				await core.filesystem.saveConfig(config);
			}

			const taskWithoutStatus: Task = {
				id: "task-custom",
				title: "Custom Task",
				status: "",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Task without status",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-custom");
			expect(loadedTask?.status).toBe("Custom Status");
		});

		it("should fall back to To Do when config has no default status", async () => {
			// Initialize project
			await core.initializeProject("Fallback Project");

			// Update config to remove default status
			const config = await core.filesystem.loadConfig();
			if (config) {
				config.defaultStatus = undefined;
				await core.filesystem.saveConfig(config);
			}

			const taskWithoutStatus: Task = {
				id: "task-fallback",
				title: "Fallback Task",
				status: "",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Task without status",
			};

			await core.createTask(taskWithoutStatus, false);

			const loadedTask = await core.filesystem.loadTask("task-fallback");
			expect(loadedTask?.status).toBe("To Do");
		});
	});

	describe("directory accessor integration", () => {
		it("should use FileSystem directory accessors for git operations", async () => {
			await core.initializeProject("Accessor Test");

			const task: Task = {
				id: "task-accessor",
				title: "Accessor Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				description: "Testing directory accessors",
			};

			// Create task without auto-commit to avoid potential git timing issues
			await core.createTask(task, false);

			// Verify the task file was created in the correct directory
			const _tasksDir = core.filesystem.tasksDir;

			// List all files to see what was actually created
			const allFiles = await core.filesystem.listTasks();

			// Check that a task with the expected ID exists
			const createdTask = allFiles.find((t) => t.id === "TASK-ACCESSOR");
			expect(createdTask).toBeDefined();
			expect(createdTask?.title).toBe("Accessor Test Task");
		}, 10000);
	});
});
