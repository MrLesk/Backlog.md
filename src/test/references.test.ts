import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Task References", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-references");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await core.initializeProject("Test References Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("Create task with references", () => {
		it("should create a task with references", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with refs",
				references: ["https://github.com/example/issue/123", "src/components/Button.tsx"],
			});

			expect(task.references).toEqual(["https://github.com/example/issue/123", "src/components/Button.tsx"]);

			// Verify persistence
			const loaded = await core.loadTaskById(task.id);
			expect(loaded?.references).toEqual(["https://github.com/example/issue/123", "src/components/Button.tsx"]);
		});

		it("should create a task without references", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task without refs",
			});

			expect(task.references).toEqual([]);
		});

		it("should handle empty references array", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with empty refs",
				references: [],
			});

			expect(task.references).toEqual([]);
		});
	});

	describe("Update task references", () => {
		it("should set references on existing task", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task to update",
			});

			const updated = await core.updateTaskFromInput(task.id, {
				references: ["https://docs.example.com/api", "README.md"],
			});

			expect(updated.references).toEqual(["https://docs.example.com/api", "README.md"]);
		});

		it("should add references to existing task", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with initial refs",
				references: ["file1.ts"],
			});

			const updated = await core.updateTaskFromInput(task.id, {
				addReferences: ["file2.ts", "file3.ts"],
			});

			expect(updated.references).toEqual(["file1.ts", "file2.ts", "file3.ts"]);
		});

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

		it("should remove references from existing task", async () => {
			const { task } = await core.createTaskFromInput({
				title: "Task with refs to remove",
				references: ["file1.ts", "file2.ts", "file3.ts"],
			});

			const updated = await core.updateTaskFromInput(task.id, {
				removeReferences: ["file2.ts"],
			});

			expect(updated.references).toEqual(["file1.ts", "file3.ts"]);
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
		it("should persist references in markdown frontmatter", async () => {
			const { filePath } = await core.createTaskFromInput({
				title: "Task with markdown refs",
				references: ["https://example.com", "src/index.ts"],
			});

			expect(filePath).toBeTruthy();

			// Read the file directly to check frontmatter
			const content = await Bun.file(filePath as string).text();
			expect(content).toContain("references:");
			expect(content).toContain("https://example.com");
			expect(content).toContain("src/index.ts");
		});

		it("should not include empty references in frontmatter", async () => {
			const { filePath } = await core.createTaskFromInput({
				title: "Task without refs",
			});

			const content = await Bun.file(filePath as string).text();
			expect(content).not.toContain("references:");
		});
	});
});
