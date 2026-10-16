import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Task References", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-references");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Test References Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("Create task with references", () => {
		it("should create a task without references", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task without refs",
			});

			expect(task.references).toEqual([]);
		});
	});

	describe("Update task references", () => {
		it("should not add duplicate references", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with refs",
				references: ["file1.ts", "file2.ts"],
			});

			const updated = await core.updateTaskFromInput(task.id, {
				addReferences: ["file2.ts", "file3.ts"],
			});

			expect(updated.references).toEqual(["file1.ts", "file2.ts", "file3.ts"]);
		});

		it("should replace references when setting directly", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with refs to replace",
				references: ["old1.ts", "old2.ts"],
			});

			const updated = await core.updateTaskFromInput(task.id, {
				references: ["new1.ts", "new2.ts"],
			});

			expect(updated.references).toEqual(["new1.ts", "new2.ts"]);
		});
	});

	describe("References in markdown", () => {
		it("should not include empty references in frontmatter", async () => {
			const { filePath } = await core.createTaskFromInput({
				title: "Task without refs",
			});

			const content = await Bun.file(filePath as string).text();
			expect(content).not.toContain("references:");
		});
	});

	describe("Archive", () => {
		it("keeps every reference to an archived task, in the working copy and in the archive", async () => {
			const { task: archiveTarget } = await core.createTaskFromInput({
				title: "Archive target",
			});
			const references = ["task-1", "TASK-1", "https://example.com/tasks/task-1", "docs/task-1.md", "task-12"];
			const { task: activeTask } = await core.createTaskFromInput({
				title: "Active referencing task",
				references,
			});
			const { task: archivedTask } = await core.createTaskFromInput({
				title: "Archived referencing task",
				status: "Done",
				references: ["task-1", "https://example.com/tasks/task-1"],
			});
			await core.archiveTask(archivedTask.id, false);

			expect(await core.archiveTask(archiveTarget.id, false)).toBe(true);

			// The archived task keeps its ID, so no reference to it has to change.
			expect((await core.loadTaskById(activeTask.id))?.references).toEqual(references);
			const archivedTasks = await core.filesystem.listArchivedTasks();
			expect(archivedTasks.find((task) => task.id === archivedTask.id)?.references).toEqual([
				"task-1",
				"https://example.com/tasks/task-1",
			]);
		});
	});

	describe("Demotion cleanup", () => {
		it("removes only exact-ID references when demoting, in the working copy and the archive", async () => {
			const { task: demoteTarget } = await core.createTaskFromInput({
				title: "Demote target",
			});

			const { task: activeTask } = await core.createTaskFromInput({
				title: "Active referencing task",
				references: [
					"task-1",
					"TASK-1",
					"https://example.com/tasks/task-1",
					"docs/task-1.md",
					"prefix-task-1-suffix",
					"1",
					"JIRA-1",
					"task-12",
				],
			});

			const { task: archivedTask } = await core.createTaskFromInput({
				title: "Archived referencing task",
				status: "Done",
				references: ["task-1", "https://example.com/tasks/task-1"],
			});
			await core.archiveTask(archivedTask.id, false);

			expect((await core.demoteTask(demoteTarget.id, false)).success).toBe(true);

			const updatedActive = await core.loadTaskById(activeTask.id);
			const archivedTasks = await core.filesystem.listArchivedTasks();
			const updatedArchived = archivedTasks.find((task) => task.id === archivedTask.id);

			expect(updatedActive?.references).toEqual([
				"https://example.com/tasks/task-1",
				"docs/task-1.md",
				"prefix-task-1-suffix",
				"1",
				"JIRA-1",
				"task-12",
			]);
			// The archive is cleaned too: the demoted ID is free for reallocation, so a reference
			// kept there would rebind to whatever task is created next.
			expect(updatedArchived?.references).toEqual(["https://example.com/tasks/task-1"]);
		});
	});
});
