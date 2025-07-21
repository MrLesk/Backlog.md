import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import type { BacklogConfig, Decision, Document, Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("FileSystem", () => {
	let filesystem: FileSystem;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-backlog");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("ensureBacklogStructure", () => {
		it("should create all required directories", async () => {
			const expectedDirs = [
				join(TEST_DIR, "backlog"),
				join(TEST_DIR, "backlog", "tasks"),
				join(TEST_DIR, "backlog", "drafts"),
				join(TEST_DIR, "backlog", "archive", "tasks"),
				join(TEST_DIR, "backlog", "archive", "drafts"),
				join(TEST_DIR, "backlog", "docs"),
				join(TEST_DIR, "backlog", "decisions"),
			];

			for (const dir of expectedDirs) {
				const stats = await stat(dir);
				expect(stats.isDirectory()).toBe(true);
			}
		});
	});

	describe("task operations", () => {
		const sampleTask: Task = {
			id: "task-1",
			title: "Test Task",
			status: "To Do",
			assignee: ["@developer"],
			reporter: "@manager",
			createdDate: "2025-06-03",
			labels: ["test"],
			milestone: "v1.0",
			dependencies: [],
			body: "This is a test task",
		};

		it("should save and load a task", async () => {
			await filesystem.saveTask(sampleTask);

			const loadedTask = await filesystem.loadTask("task-1");
			expect(loadedTask?.id).toBe(sampleTask.id);
			expect(loadedTask?.title).toBe(sampleTask.title);
			expect(loadedTask?.status).toBe(sampleTask.status);
			expect(loadedTask?.body).toBe(sampleTask.body);
		});

		it("should return null for non-existent task", async () => {
			const task = await filesystem.loadTask("non-existent");
			expect(task).toBeNull();
		});

		it("should list all tasks", async () => {
			await filesystem.saveTask(sampleTask);
			await filesystem.saveTask({
				...sampleTask,
				id: "task-2",
				title: "Second Task",
			});

			const tasks = await filesystem.listTasks();
			expect(tasks).toHaveLength(2);
			expect(tasks.map((t) => t.id)).toEqual(["task-1", "task-2"]);
		});

		it("should sort tasks numerically by ID", async () => {
			// Create tasks with IDs that would sort incorrectly with string comparison
			const taskIds = ["task-2", "task-10", "task-1", "task-20", "task-3"];
			for (const id of taskIds) {
				await filesystem.saveTask({
					...sampleTask,
					id,
					title: `Task ${id}`,
				});
			}

			const tasks = await filesystem.listTasks();
			expect(tasks.map((t) => t.id)).toEqual(["task-1", "task-2", "task-3", "task-10", "task-20"]);
		});

		it("should sort tasks with decimal IDs correctly", async () => {
			// Create tasks with decimal IDs
			const taskIds = ["task-2.10", "task-2.2", "task-2", "task-1", "task-2.1"];
			for (const id of taskIds) {
				await filesystem.saveTask({
					...sampleTask,
					id,
					title: `Task ${id}`,
				});
			}

			const tasks = await filesystem.listTasks();
			expect(tasks.map((t) => t.id)).toEqual(["task-1", "task-2", "task-2.1", "task-2.2", "task-2.10"]);
		});

		it("should archive a task", async () => {
			await filesystem.saveTask(sampleTask);

			const archived = await filesystem.archiveTask("task-1");
			expect(archived).toBe(true);

			const task = await filesystem.loadTask("task-1");
			expect(task).toBeNull();

			// Check that file exists in archive
			const archiveFiles = await readdir(join(TEST_DIR, "backlog", "archive", "tasks"));
			expect(archiveFiles.some((f) => f.startsWith("task-1"))).toBe(true);
		});

		it("should demote a task to drafts", async () => {
			await filesystem.saveTask(sampleTask);

			const demoted = await filesystem.demoteTask("task-1");
			expect(demoted).toBe(true);

			const draft = await filesystem.loadDraft("task-1");
			expect(draft?.id).toBe("task-1");
		});
	});

	describe("draft operations", () => {
		const sampleDraft: Task = {
			id: "task-draft",
			title: "Draft Task",
			status: "Draft",
			assignee: [],
			createdDate: "2025-06-07",
			labels: [],
			dependencies: [],
			body: "Draft description",
		};

		it("should save and load a draft", async () => {
			await filesystem.saveDraft(sampleDraft);

			const loaded = await filesystem.loadDraft("task-draft");
			expect(loaded?.id).toBe(sampleDraft.id);
			expect(loaded?.title).toBe(sampleDraft.title);
		});

		it("should list all drafts", async () => {
			await filesystem.saveDraft(sampleDraft);
			await filesystem.saveDraft({ ...sampleDraft, id: "task-draft2", title: "Second" });

			const drafts = await filesystem.listDrafts();
			expect(drafts.map((d) => d.id)).toEqual(["task-draft", "task-draft2"]);
		});

		it("should promote a draft to tasks", async () => {
			await filesystem.saveDraft(sampleDraft);

			const promoted = await filesystem.promoteDraft("task-draft");
			expect(promoted).toBe(true);

			const task = await filesystem.loadTask("task-draft");
			expect(task?.id).toBe("task-draft");
		});

		it("should archive a draft", async () => {
			await filesystem.saveDraft(sampleDraft);

			const archived = await filesystem.archiveDraft("task-draft");
			expect(archived).toBe(true);

			const draft = await filesystem.loadDraft("task-draft");
			expect(draft).toBeNull();

			const files = await readdir(join(TEST_DIR, "backlog", "archive", "drafts"));
			expect(files.some((f) => f.startsWith("task-draft"))).toBe(true);
		});
	});

	describe("config operations", () => {
		const sampleConfig: BacklogConfig = {
			projectName: "Test Project",
			defaultAssignee: "@admin",
			defaultStatus: "To Do",
			defaultReporter: undefined,
			statuses: ["To Do", "In Progress", "Done"],
			labels: ["bug", "feature"],
			milestones: ["v1.0", "v2.0"],
			dateFormat: "yyyy-mm-dd",
		};

		it("should save and load config", async () => {
			await filesystem.saveConfig(sampleConfig);

			const loadedConfig = await filesystem.loadConfig();
			expect(loadedConfig).toEqual(sampleConfig);
		});

		it("should return null for missing config", async () => {
			// Create a fresh filesystem without any config
			const freshFilesystem = new FileSystem(join(TEST_DIR, "fresh"));
			await freshFilesystem.ensureBacklogStructure();

			const config = await freshFilesystem.loadConfig();
			expect(config).toBeNull();
		});

		it("should handle defaultReporter field", async () => {
			const cfg: BacklogConfig = {
				projectName: "Reporter",
				defaultReporter: "@author",
				statuses: ["To Do"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
			};

			await filesystem.saveConfig(cfg);
			const loaded = await filesystem.loadConfig();
			expect(loaded?.defaultReporter).toBe("@author");
		});
	});

	describe("user config operations", () => {
		it("should save and load local and global user settings", async () => {
			await filesystem.setUserSetting("reporter", "local", false);
			await filesystem.setUserSetting("reporter", "global", true);

			const local = await filesystem.getUserSetting("reporter", false);
			const global = await filesystem.getUserSetting("reporter", true);

			expect(local).toBe("local");
			expect(global).toBe("global");
		});
	});

	describe("directory accessors", () => {
		it("should provide correct directory paths", () => {
			expect(filesystem.tasksDir).toBe(join(TEST_DIR, "backlog", "tasks"));
			expect(filesystem.archiveTasksDir).toBe(join(TEST_DIR, "backlog", "archive", "tasks"));
			expect(filesystem.decisionsDir).toBe(join(TEST_DIR, "backlog", "decisions"));
			expect(filesystem.docsDir).toBe(join(TEST_DIR, "backlog", "docs"));
		});
	});

	describe("decision log operations", () => {
		const sampleDecision: Decision = {
			id: "decision-1",
			title: "Use TypeScript",
			date: "2025-06-07",
			status: "accepted",
			context: "Need type safety",
			decision: "Use TypeScript",
			consequences: "Better DX",
		};

		it("should save and load a decision log", async () => {
			await filesystem.saveDecision(sampleDecision);

			const loadedDecision = await filesystem.loadDecision("decision-1");
			expect(loadedDecision?.id).toBe(sampleDecision.id);
			expect(loadedDecision?.title).toBe(sampleDecision.title);
			expect(loadedDecision?.status).toBe(sampleDecision.status);
			expect(loadedDecision?.context).toBe(sampleDecision.context);
		});

		it("should return null for non-existent decision log", async () => {
			const decision = await filesystem.loadDecision("non-existent");
			expect(decision).toBeNull();
		});

		it("should save decision log with alternatives", async () => {
			const decisionWithAlternatives: Decision = {
				...sampleDecision,
				id: "decision-2",
				alternatives: "Considered JavaScript",
			};

			await filesystem.saveDecision(decisionWithAlternatives);
			const loaded = await filesystem.loadDecision("decision-2");

			expect(loaded?.alternatives).toBe("Considered JavaScript");
		});

		it("should list decision logs", async () => {
			await filesystem.saveDecision(sampleDecision);
			const list = await filesystem.listDecisions();
			expect(list).toHaveLength(1);
			expect(list[0]?.id).toBe(sampleDecision.id);
		});
	});

	describe("document operations", () => {
		const sampleDocument: Document = {
			id: "doc-1",
			title: "API Guide",
			type: "guide",
			createdDate: "2025-06-07",
			updatedDate: "2025-06-08",
			body: "This is the API guide content.",
			tags: ["api", "guide"],
		};

		it("should save a document", async () => {
			await filesystem.saveDocument(sampleDocument);

			// Check that file was created
			const docsFiles = await readdir(filesystem.docsDir);
			expect(docsFiles.some((f) => f.includes("API-Guide"))).toBe(true);
		});

		it("should save document without optional fields", async () => {
			const minimalDoc: Document = {
				id: "doc-2",
				title: "Simple Doc",
				type: "readme",
				createdDate: "2025-06-07",
				body: "Simple content.",
			};

			await filesystem.saveDocument(minimalDoc);

			const docsFiles = await readdir(filesystem.docsDir);
			expect(docsFiles.some((f) => f.includes("Simple-Doc"))).toBe(true);
		});

		it("should list documents", async () => {
			await filesystem.saveDocument(sampleDocument);
			const list = await filesystem.listDocuments();
			expect(list.some((d) => d.id === sampleDocument.id)).toBe(true);
		});
	});

	describe("edge cases", () => {
		it("should handle task with task- prefix in id", async () => {
			const taskWithPrefix: Task = {
				id: "task-prefixed",
				title: "Already Prefixed",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				body: "Task with task- prefix",
			};

			await filesystem.saveTask(taskWithPrefix);
			const loaded = await filesystem.loadTask("task-prefixed");

			expect(loaded?.id).toBe("task-prefixed");
		});

		it("should handle task without task- prefix in id", async () => {
			const taskWithoutPrefix: Task = {
				id: "no-prefix",
				title: "No Prefix",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				body: "Task without prefix",
			};

			await filesystem.saveTask(taskWithoutPrefix);
			const loaded = await filesystem.loadTask("no-prefix");

			expect(loaded?.id).toBe("no-prefix");
		});

		it("should return empty array when listing tasks in empty directory", async () => {
			const tasks = await filesystem.listTasks();
			expect(tasks).toEqual([]);
		});

		it("should return false when archiving non-existent task", async () => {
			const result = await filesystem.archiveTask("non-existent");
			expect(result).toBe(false);
		});

		it("should handle config with all optional fields", async () => {
			const fullConfig: BacklogConfig = {
				projectName: "Full Project",
				defaultAssignee: "@admin",
				defaultStatus: "To Do",
				defaultReporter: undefined,
				statuses: ["To Do", "In Progress", "Done"],
				labels: ["bug", "feature", "enhancement"],
				milestones: ["v1.0", "v1.1", "v2.0"],
				dateFormat: "yyyy-mm-dd",
			};

			await filesystem.saveConfig(fullConfig);
			const loaded = await filesystem.loadConfig();

			expect(loaded).toEqual(fullConfig);
		});

		it("should handle config with minimal fields", async () => {
			const minimalConfig: BacklogConfig = {
				projectName: "Minimal Project",
				statuses: ["To Do", "Done"],
				labels: [],
				milestones: [],
				dateFormat: "yyyy-mm-dd",
			};

			await filesystem.saveConfig(minimalConfig);
			const loaded = await filesystem.loadConfig();

			expect(loaded?.projectName).toBe("Minimal Project");
			expect(loaded?.defaultAssignee).toBeUndefined();
			expect(loaded?.defaultStatus).toBeUndefined();
		});

		it("should sanitize filenames correctly", async () => {
			const taskWithSpecialChars: Task = {
				id: "task-special",
				title: "Task/with\\special:chars?",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				body: "Task with special characters in title",
			};

			await filesystem.saveTask(taskWithSpecialChars);
			const loaded = await filesystem.loadTask("task-special");

			expect(loaded?.title).toBe("Task/with\\special:chars?");
		});

		it("should preserve case in filenames", async () => {
			const taskWithMixedCase: Task = {
				id: "task-mixed",
				title: "Fix Task List Ordering",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				body: "Task with mixed case title",
			};

			await filesystem.saveTask(taskWithMixedCase);

			// Check that the file exists with preserved case
			const files = await readdir(filesystem.tasksDir);
			const taskFile = files.find((f) => f.startsWith("task-mixed -"));
			expect(taskFile).toBe("task-mixed - Fix-Task-List-Ordering.md");

			// Verify the task can be loaded
			const loaded = await filesystem.loadTask("task-mixed");
			expect(loaded?.title).toBe("Fix Task List Ordering");
		});

		it("should avoid double dashes in filenames", async () => {
			const weirdTask: Task = {
				id: "task-dashes",
				title: "Task -- with  -- multiple   dashes",
				status: "To Do",
				assignee: [],
				createdDate: "2025-06-07",
				labels: [],
				dependencies: [],
				body: "Check double dashes",
			};

			await filesystem.saveTask(weirdTask);
			const files = await readdir(filesystem.tasksDir);
			const filename = files.find((f) => f.startsWith("task-dashes -"));
			expect(filename).toBeDefined();
			expect(filename?.includes("--")).toBe(false);
		});
	});
});
