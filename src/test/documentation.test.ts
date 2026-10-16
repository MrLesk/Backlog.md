import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Task Documentation", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-documentation");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await initializeTestProject(core, "Test Documentation Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("Create task with documentation", () => {
		it("should create a task without documentation", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task without docs",
			});

			expect(task.documentation).toEqual([]);
		});
	});

	describe("Update task documentation", () => {
		it("should not add duplicate documentation", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with docs",
				documentation: ["doc1.md", "doc2.md"],
			});

			const updated = await core.updateTaskFromInput(task.id, {
				addDocumentation: ["doc2.md", "doc3.md"],
			});

			expect(updated.documentation).toEqual(["doc1.md", "doc2.md", "doc3.md"]);
		});

		it("should replace documentation when setting directly", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with docs to replace",
				documentation: ["old1.md", "old2.md"],
			});

			const updated = await core.updateTaskFromInput(task.id, {
				documentation: ["new1.md", "new2.md"],
			});

			expect(updated.documentation).toEqual(["new1.md", "new2.md"]);
		});
	});

	describe("Documentation in markdown", () => {
		it("should not include empty documentation in frontmatter", async () => {
			const { filePath } = await core.createTaskFromInput({
				title: "Task without docs",
			});

			const content = await Bun.file(filePath as string).text();
			expect(content).not.toContain("documentation:");
		});
	});
});
