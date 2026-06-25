import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTaskPlatformAware, editTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI --ref and --doc flags", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-refs-docs");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "CLI Refs Docs Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	describe("task create with --ref flag", () => {
		it("creates task with single reference", async () => {
			const result = await createTaskPlatformAware(
				{ title: "Feature", ref: ["https://github.com/issue/123"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("References: https://github.com/issue/123");
		});

		it("creates task with multiple references", async () => {
			const result = await createTaskPlatformAware(
				{ title: "Feature", ref: ["https://github.com/issue/123", "src/api.ts"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("References: https://github.com/issue/123, src/api.ts");
		});

		it("creates task with comma-separated references", async () => {
			const result = await createTaskPlatformAware(
				{ title: "Feature", ref: ["file1.ts,file2.ts"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("References: file1.ts, file2.ts");
		});
	});

	describe("task create with --doc flag", () => {
		it("creates task with single documentation", async () => {
			const result = await createTaskPlatformAware(
				{ title: "Feature", doc: ["https://design-docs.example.com"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Documentation: https://design-docs.example.com");
		});

		it("creates task with multiple documentation entries", async () => {
			const result = await createTaskPlatformAware(
				{ title: "Feature", doc: ["https://design-docs.example.com", "docs/spec.md"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Documentation: https://design-docs.example.com, docs/spec.md");
		});

		it("creates task with comma-separated documentation", async () => {
			const result = await createTaskPlatformAware(
				{ title: "Feature", doc: ["doc1.md,doc2.md"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Documentation: doc1.md, doc2.md");
		});
	});

	describe("task create with both --ref and --doc flags", () => {
		it("creates task with both references and documentation", async () => {
			const result = await createTaskPlatformAware(
				{ title: "Feature", ref: ["src/api.ts"], doc: ["https://design-docs.example.com"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("References: src/api.ts");
			expect(result.stdout).toContain("Documentation: https://design-docs.example.com");
		});
	});

	describe("task create with --modified-file flag", () => {
		it("creates task with multiple modified files", async () => {
			const result = await createTaskPlatformAware(
				{ title: "Feature", modifiedFile: ["src/api.ts", "src/ui.ts"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Modified files: src/api.ts, src/ui.ts");
		});
	});

	describe("task edit with --ref flag", () => {
		it("sets references on existing task", async () => {
			await createTaskPlatformAware({ title: "Feature" }, TEST_DIR);

			const result = await editTaskPlatformAware(
				{ taskId: "1", ref: ["https://github.com/issue/456"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("References: https://github.com/issue/456");
		});

		it("sets multiple references on existing task", async () => {
			await createTaskPlatformAware({ title: "Feature" }, TEST_DIR);

			const result = await editTaskPlatformAware({ taskId: "1", ref: ["file1.ts", "file2.ts"], plain: true }, TEST_DIR);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("References: file1.ts, file2.ts");
		});
	});

	describe("task edit with --doc flag", () => {
		it("sets documentation on existing task", async () => {
			await createTaskPlatformAware({ title: "Feature" }, TEST_DIR);

			const result = await editTaskPlatformAware(
				{ taskId: "1", doc: ["https://api-docs.example.com"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Documentation: https://api-docs.example.com");
		});

		it("sets multiple documentation entries on existing task", async () => {
			await createTaskPlatformAware({ title: "Feature" }, TEST_DIR);

			const result = await editTaskPlatformAware({ taskId: "1", doc: ["doc1.md", "doc2.md"], plain: true }, TEST_DIR);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Documentation: doc1.md, doc2.md");
		});
	});

	describe("task edit with --modified-file flag", () => {
		it("sets modified files on existing task", async () => {
			await createTaskPlatformAware({ title: "Feature" }, TEST_DIR);

			const result = await editTaskPlatformAware(
				{ taskId: "1", modifiedFile: ["src/api.ts", "src/ui.ts"], plain: true },
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(result.stdout).toContain("Modified files: src/api.ts, src/ui.ts");
		});
	});

	describe("persistence in markdown files", () => {
		it("persists references in task markdown file", async () => {
			await createTaskPlatformAware({ title: "Feature", ref: ["https://example.com", "src/index.ts"] }, TEST_DIR);

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("references:");
			expect(taskFile).toContain("https://example.com");
			expect(taskFile).toContain("src/index.ts");
		});

		it("persists documentation in task markdown file", async () => {
			await createTaskPlatformAware({ title: "Feature", doc: ["https://docs.example.com", "spec.md"] }, TEST_DIR);

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("documentation:");
			expect(taskFile).toContain("https://docs.example.com");
			expect(taskFile).toContain("spec.md");
		});

		it("persists modified files in task markdown file", async () => {
			await createTaskPlatformAware({ title: "Feature", modifiedFile: ["src/index.ts", "src/ui.ts"] }, TEST_DIR);

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("modified_files:");
			expect(taskFile).toContain("src/index.ts");
			expect(taskFile).toContain("src/ui.ts");
		});
	});
});
