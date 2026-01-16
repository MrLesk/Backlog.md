import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Task Documentation", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-documentation");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await core.initializeProject("Test Documentation Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("Create task with documentation", () => {
		it("should create a task with documentation", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with docs",
				documentation: ["https://docs.example.com/api", "docs/architecture.md"],
			});

			expect(task.documentation).toEqual(["https://docs.example.com/api", "docs/architecture.md"]);

			// Verify persistence
			const loaded = await core.loadTaskById(task.id);
			expect(loaded?.documentation).toEqual(["https://docs.example.com/api", "docs/architecture.md"]);
		});

		it("should create a task without documentation", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task without docs",
			});

			expect(task.documentation).toEqual([]);
		});

		it("should handle empty documentation array", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with empty docs",
				documentation: [],
			});

			expect(task.documentation).toEqual([]);
		});
	});

	describe("Update task documentation", () => {
		it("should set documentation on existing task", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task to update",
			});

			const updated = await core.updateTaskFromInput(task.id, {
				documentation: ["https://design-docs.example.com", "README.md"],
			});

			expect(updated.documentation).toEqual(["https://design-docs.example.com", "README.md"]);
		});

		it("should add documentation to existing task", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with initial docs",
				documentation: ["doc1.md"],
			});

			const updated = await core.updateTaskFromInput(task.id, {
				addDocumentation: ["doc2.md", "doc3.md"],
			});

			expect(updated.documentation).toEqual(["doc1.md", "doc2.md", "doc3.md"]);
		});

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

		it("should remove documentation from existing task", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with docs to remove",
				documentation: ["doc1.md", "doc2.md", "doc3.md"],
			});

			const updated = await core.updateTaskFromInput(task.id, {
				removeDocumentation: ["doc2.md"],
			});

			expect(updated.documentation).toEqual(["doc1.md", "doc3.md"]);
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
		it("should persist documentation in markdown frontmatter", async () => {
			const { filePath } = await core.createTaskFromInput({
				title: "Task with markdown docs",
				documentation: ["https://example.com/docs", "src/index.ts"],
			});

			expect(filePath).toBeTruthy();

			// Read the file directly to check frontmatter
			const content = await Bun.file(filePath as string).text();
			expect(content).toContain("documentation:");
			expect(content).toContain("https://example.com/docs");
			expect(content).toContain("src/index.ts");
		});

		it("should not include empty documentation in frontmatter", async () => {
			const { filePath } = await core.createTaskFromInput({
				title: "Task without docs",
			});

			const content = await Bun.file(filePath as string).text();
			expect(content).not.toContain("documentation:");
		});
	});
});
