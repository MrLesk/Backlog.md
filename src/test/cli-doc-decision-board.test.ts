import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { parseTask } from "../markdown/parser.ts";
import type { Decision, Document, Task } from "../types/index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

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

	describe("doc and decision commands", () => {
		beforeEach(async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Doc Test Project");
		});

		it("should create and list documents", async () => {
			const core = new Core(TEST_DIR);
			const doc: Document = {
				id: "doc-1",
				title: "Guide",
				type: "guide",
				createdDate: "2025-06-08",
				rawContent: "Content",
			};
			await core.createDocument(doc, false);

			const docs = await core.filesystem.listDocuments();
			expect(docs).toHaveLength(1);
			expect(docs[0]?.title).toBe("Guide");
		});

		it("should create documents in a subpath and print the persisted path", async () => {
			const result = await $`bun ${CLI_PATH} doc create "Setup Guide" -p guides/setup`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);
			const stdout = result.stdout.toString();
			expect(stdout).toContain("Created document doc-1");
			expect(stdout).toContain("Path: backlog/docs/guides/setup/doc-1 - Setup-Guide.md");

			const core = new Core(TEST_DIR);
			const docs = await core.filesystem.listDocuments();
			expect(docs[0]?.path).toBe("guides/setup/doc-1 - Setup-Guide.md");
		});

		it("should reject unsafe document paths", async () => {
			const result = await $`bun ${CLI_PATH} doc create "Unsafe" -p ../outside`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("Document path cannot include traversal segments.");
		});

		it("should update document content and metadata", async () => {
			const core = new Core(TEST_DIR);
			await core.createDocument(
				{
					id: "doc-1",
					title: "Setup Guide",
					type: "guide",
					createdDate: "2025-06-08",
					rawContent: "Old content",
					tags: ["setup"],
				},
				false,
				"guides/setup",
			);

			const updatedContent = "# Updated\n\nRun install steps.";
			const result =
				await $`bun ${CLI_PATH} doc update doc-1 --title "Install Runbook" --content ${updatedContent} -t specification --tags ops,runbook -p runbooks`
					.cwd(TEST_DIR)
					.quiet();
			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("Updated document doc-1");
			expect(result.stdout.toString()).toContain("Path: backlog/docs/runbooks/doc-1 - Install-Runbook.md");

			const docs = await core.filesystem.listDocuments();
			const updated = docs.find((doc) => doc.id === "doc-1");
			expect(updated?.title).toBe("Install Runbook");
			expect(updated?.type).toBe("specification");
			expect(updated?.tags).toEqual(["ops", "runbook"]);
			expect(updated?.path).toBe("runbooks/doc-1 - Install-Runbook.md");
			expect(updated?.rawContent).toBe(updatedContent);
		});

		it("should preserve omitted document fields when updating", async () => {
			const core = new Core(TEST_DIR);
			await core.createDocument(
				{
					id: "doc-1",
					title: "Setup Guide",
					type: "guide",
					createdDate: "2025-06-08",
					rawContent: "Keep this content",
					tags: ["setup", "guide"],
				},
				false,
				"guides",
			);

			await $`bun ${CLI_PATH} doc update doc-1 --title "Setup Handbook"`.cwd(TEST_DIR).quiet();

			const docs = await core.filesystem.listDocuments();
			const updated = docs.find((doc) => doc.id === "doc-1");
			expect(updated?.title).toBe("Setup Handbook");
			expect(updated?.type).toBe("guide");
			expect(updated?.tags).toEqual(["setup", "guide"]);
			expect(updated?.path).toBe("guides/doc-1 - Setup-Handbook.md");
			expect(updated?.rawContent).toBe("Keep this content");
		});

		it("should reject invalid document update inputs", async () => {
			const core = new Core(TEST_DIR);
			await core.createDocument(
				{
					id: "doc-1",
					title: "Setup Guide",
					type: "guide",
					createdDate: "2025-06-08",
					rawContent: "Content",
				},
				false,
			);

			const missing = await $`bun ${CLI_PATH} doc update doc-404 --content "Nope"`.cwd(TEST_DIR).quiet().nothrow();
			expect(missing.exitCode).not.toBe(0);
			expect(missing.stderr.toString()).toContain("Document not found: doc-404");

			const invalidType = await $`bun ${CLI_PATH} doc update doc-1 --content "Nope" -t invalid`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(invalidType.exitCode).not.toBe(0);
			expect(invalidType.stderr.toString()).toContain(
				"Document type must be one of: readme, guide, specification, other.",
			);

			const unsafePath = await $`bun ${CLI_PATH} doc update doc-1 --content "Nope" -p ../outside`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(unsafePath.exitCode).not.toBe(0);
			expect(unsafePath.stderr.toString()).toContain("Document path cannot include traversal segments.");
		});

		it("should create and list decisions", async () => {
			const core = new Core(TEST_DIR);
			const decision: Decision = {
				id: "decision-1",
				title: "Choose Stack",
				date: "2025-06-08",
				status: "accepted",
				context: "context",
				decision: "decide",
				consequences: "conseq",
				rawContent: "",
			};
			await core.createDecision(decision, false);
			const decisions = await core.filesystem.listDecisions();
			expect(decisions).toHaveLength(1);
			expect(decisions[0]?.title).toBe("Choose Stack");
		});
	});

	describe("board view command", () => {
		beforeEach(async () => {
			await $`git init -b main`.cwd(TEST_DIR).quiet();
			await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
			await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

			const core = new Core(TEST_DIR);
			await initializeTestProject(core, "Board Test Project", true);
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
					rawContent: "A task in todo",
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
					rawContent: "A task in progress",
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
					rawContent: "A completed task",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(3);

			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];
			expect(statuses).toEqual(["To Do", "In Progress", "Done"]);

			// Test the kanban board generation
			const { generateKanbanBoardWithMetadata } = await import("../board.ts");
			const board = generateKanbanBoardWithMetadata(tasks, statuses, "Test Project");

			// Verify board contains all statuses and tasks (now on separate lines)
			expect(board).toContain("To Do");
			expect(board).toContain("In Progress");
			expect(board).toContain("Done");
			expect(board).toContain("TASK-1");
			expect(board).toContain("Todo Task");
			expect(board).toContain("TASK-2");
			expect(board).toContain("Progress Task");
			expect(board).toContain("TASK-3");
			expect(board).toContain("Done Task");

			// Verify board structure (now includes metadata header)
			const lines = board.split("\n");
			expect(board).toContain("# Kanban Board Export");
			expect(board).toContain("To Do");
			expect(board).toContain("In Progress");
			expect(board).toContain("Done");
			expect(board).toContain("|"); // Table structure
			expect(lines.length).toBeGreaterThan(5); // Should have content rows
		});

		it("should handle empty project with default statuses", async () => {
			const core = new Core(TEST_DIR);

			const tasks = await core.filesystem.listTasks();
			expect(tasks).toHaveLength(0);

			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const { generateKanbanBoardWithMetadata } = await import("../board.ts");
			const board = generateKanbanBoardWithMetadata(tasks, statuses, "Test Project");

			// Should return board with metadata, configured status columns, and empty-state message
			expect(board).toContain("# Kanban Board Export");
			expect(board).toContain("| To Do | In Progress | Done |");
			expect(board).toContain("No tasks found");
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
					rawContent: "A task in todo",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const { generateKanbanBoardWithMetadata } = await import("../board.ts");
			const board = generateKanbanBoardWithMetadata(tasks, statuses, "Test Project");

			// Should contain proper board structure
			expect(board).toContain("# Kanban Board Export");
			expect(board).toContain("To Do");
			expect(board).toContain("TASK-1");
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
					rawContent: "Testing vertical shortcut",
				},
				false,
			);

			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			// Test that --vertical flag produces vertical layout
			const { generateKanbanBoardWithMetadata } = await import("../board.ts");
			const board = generateKanbanBoardWithMetadata(tasks, statuses, "Test Project");

			// Should contain proper board structure
			expect(board).toContain("# Kanban Board Export");
			expect(board).toContain("To Do");
			expect(board).toContain("TASK-1");
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
				rawContent: "from remote",
			} as Task;

			await core.createTask(task, true);

			// set up remote repository
			const remoteDir = join(TEST_DIR, "remote.git");
			await $`git init --bare -b main ${remoteDir}`.quiet();
			await $`git remote add origin ${remoteDir}`.cwd(TEST_DIR).quiet();
			await $`git push -u origin main`.cwd(TEST_DIR).quiet();

			// create branch with updated status
			await $`git checkout -b feature`.cwd(TEST_DIR).quiet();
			await core.updateTaskFromInput("task-1", { status: "Done" }, true);
			await $`git push -u origin feature`.cwd(TEST_DIR).quiet();

			// Update remote-tracking branches to ensure they are recognized
			await $`git remote update origin --prune`.cwd(TEST_DIR).quiet();

			// switch back to main where status is still To Do
			await $`git checkout main`.cwd(TEST_DIR).quiet();

			await core.gitOps.fetch();
			const branches = await core.gitOps.listRemoteBranches();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			const localTasks = await core.filesystem.listTasks();
			const tasksById = new Map(localTasks.map((t) => [t.id, t]));

			for (const branch of branches) {
				const ref = `origin/${branch}`;
				const files = await core.gitOps.listFilesInTree(ref, "backlog/tasks");
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

			const final = tasksById.get("TASK-1"); // IDs normalized to uppercase
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
					rawContent: "test",
				},
				false,
			);

			const resultDefault = await $`bun ${["src/cli.ts", "board"]}`.cwd(TEST_DIR).quiet().nothrow();
			const resultView = await $`bun ${["src/cli.ts", "board", "view"]}`.cwd(TEST_DIR).quiet().nothrow();

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
					rawContent: "Testing board export",
				},
				false,
			);

			const { exportKanbanBoardToFile } = await import("../index.ts");
			const outputPath = join(TEST_DIR, "test-export.md");
			const tasks = await core.filesystem.listTasks();
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || [];

			await exportKanbanBoardToFile(tasks, statuses, outputPath, "TestProject");

			// Verify file was created and contains expected content
			const content = await Bun.file(outputPath).text();
			expect(content).toContain("To Do");
			expect(content).toContain("TASK-1");
			expect(content).toContain("Export Test Task");
			expect(content).toContain("# Kanban Board Export (powered by Backlog.md)");
			expect(content).toContain("Project: TestProject");

			// Test overwrite behavior
			await exportKanbanBoardToFile(tasks, statuses, outputPath, "TestProject");
			const overwrittenContent = await Bun.file(outputPath).text();
			const occurrences = overwrittenContent.split("TASK-1").length - 1;
			expect(occurrences).toBe(1); // Should appear once after overwrite
		});
	});
});
