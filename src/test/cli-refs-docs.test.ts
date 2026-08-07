import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI --ref and --doc flags", () => {
	const cliPath = getTestCliPath();

	// Runs the CLI with stdio reported as a TTY so interactive-only behavior (the edit wizard) applies.
	async function runCliWithInteractiveTty(cwd: string, args: string[]) {
		const entryPath = join(cwd, "interactive-cli-entry.ts");
		await writeFile(
			entryPath,
			`Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true });
await import(${JSON.stringify(pathToFileURL(cliPath).href)});
`,
		);
		return await $`bun ${entryPath} ${args}`.cwd(cwd).quiet().nothrow();
	}

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-refs-docs");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "CLI Refs Docs Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	describe("task create with --ref flag", () => {
		it("creates task with single reference", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --ref https://github.com/issue/123 --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: https://github.com/issue/123");
		});

		it("creates task with multiple references", async () => {
			const result =
				await $`bun ${cliPath} task create "Feature" --ref https://github.com/issue/123 --ref src/api.ts --plain`
					.cwd(TEST_DIR)
					.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: https://github.com/issue/123, src/api.ts");
		});

		it("creates task with comma-separated references", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --ref "file1.ts,file2.ts" --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: file1.ts, file2.ts");
		});
	});

	describe("task create with --doc flag", () => {
		it("creates task with single documentation", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --doc https://design-docs.example.com --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: https://design-docs.example.com");
		});

		it("creates task with multiple documentation entries", async () => {
			const result =
				await $`bun ${cliPath} task create "Feature" --doc https://design-docs.example.com --doc docs/spec.md --plain`
					.cwd(TEST_DIR)
					.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: https://design-docs.example.com, docs/spec.md");
		});

		it("creates task with comma-separated documentation", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --doc "doc1.md,doc2.md" --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: doc1.md, doc2.md");
		});
	});

	describe("task create with both --ref and --doc flags", () => {
		it("creates task with both references and documentation", async () => {
			const result =
				await $`bun ${cliPath} task create "Feature" --ref src/api.ts --doc https://design-docs.example.com --plain`
					.cwd(TEST_DIR)
					.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: src/api.ts");
			expect(out).toContain("Documentation: https://design-docs.example.com");
		});
	});

	describe("task create with --modified-file flag", () => {
		it("creates task with multiple modified files", async () => {
			const result =
				await $`bun ${cliPath} task create "Feature" --modified-file src/api.ts --modified-file src/ui.ts --plain`
					.cwd(TEST_DIR)
					.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Modified files: src/api.ts, src/ui.ts");
		});
	});

	describe("task edit with --ref flag", () => {
		it("sets references on existing task", async () => {
			await $`bun ${cliPath} task create "Feature"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --ref https://github.com/issue/456 --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: https://github.com/issue/456");
		});

		it("sets multiple references on existing task", async () => {
			await $`bun ${cliPath} task create "Feature"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --ref file1.ts --ref file2.ts --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("References: file1.ts, file2.ts");
		});
	});

	describe("task edit with --doc flag", () => {
		it("sets documentation on existing task", async () => {
			await $`bun ${cliPath} task create "Feature"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --doc https://api-docs.example.com --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: https://api-docs.example.com");
		});

		it("sets multiple documentation entries on existing task", async () => {
			await $`bun ${cliPath} task create "Feature"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --doc doc1.md --doc doc2.md --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Documentation: doc1.md, doc2.md");
		});
	});

	describe("task edit with --modified-file flag", () => {
		it("sets modified files on existing task", async () => {
			await $`bun ${cliPath} task create "Feature"`.cwd(TEST_DIR).quiet();

			const result = await $`bun ${cliPath} task edit 1 --modified-file src/api.ts --modified-file src/ui.ts --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			const out = result.stdout.toString();
			expect(out).toContain("Modified files: src/api.ts, src/ui.ts");
		});
	});

	describe("task edit with --clear-refs and --clear-docs", () => {
		async function createTaskWithRefsAndDocs() {
			await $`bun ${cliPath} task create "Feature" --ref a --ref b --doc doc-a --doc doc-b`.cwd(TEST_DIR).quiet();
		}

		it("clears references with --clear-refs", async () => {
			await createTaskWithRefsAndDocs();

			const result = await $`bun ${cliPath} task edit 1 --clear-refs --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			const task = await new Core(TEST_DIR).filesystem.loadTask("TASK-1");
			expect(task?.references).toEqual([]);
			expect(task?.documentation).toEqual(["doc-a", "doc-b"]);
		});

		it("clears documentation with --clear-docs", async () => {
			await createTaskWithRefsAndDocs();

			const result = await $`bun ${cliPath} task edit 1 --clear-docs --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			const task = await new Core(TEST_DIR).filesystem.loadTask("TASK-1");
			expect(task?.documentation).toEqual([]);
			expect(task?.references).toEqual(["a", "b"]);
		});

		it("clears references with --clear-refs in an interactive terminal", async () => {
			await createTaskWithRefsAndDocs();

			const result = await runCliWithInteractiveTty(TEST_DIR, ["task", "edit", "1", "--clear-refs"]);

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("Updated task TASK-1");
			expect((await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.references).toEqual([]);
		});

		it("clears documentation with --clear-docs in an interactive terminal", async () => {
			await createTaskWithRefsAndDocs();

			const result = await runCliWithInteractiveTty(TEST_DIR, ["task", "edit", "1", "--clear-docs"]);

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("Updated task TASK-1");
			expect((await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.documentation).toEqual([]);
		});

		it("rejects empty and conflicting reference edits without changing references", async () => {
			await createTaskWithRefsAndDocs();

			const empty = await $`bun ${cliPath} task edit 1 --ref ""`.cwd(TEST_DIR).quiet().nothrow();
			expect(empty.exitCode).toBe(1);
			expect(empty.stderr.toString()).toContain("Cannot use an empty value with --ref");
			expect(empty.stdout.toString()).not.toContain("Updated task");

			const emptyAlongsideValue = await $`bun ${cliPath} task edit 1 --ref "" --ref c`.cwd(TEST_DIR).quiet().nothrow();
			expect(emptyAlongsideValue.exitCode).toBe(1);
			expect(emptyAlongsideValue.stderr.toString()).toContain("Cannot use an empty value with --ref");

			const conflicting = await $`bun ${cliPath} task edit 1 --clear-refs --ref c`.cwd(TEST_DIR).quiet().nothrow();
			expect(conflicting.exitCode).toBe(1);
			expect(conflicting.stderr.toString()).toContain("Cannot combine --clear-refs with --ref");

			expect((await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.references).toEqual(["a", "b"]);
		});

		it("rejects empty and conflicting documentation edits without changing documentation", async () => {
			await createTaskWithRefsAndDocs();

			const empty = await $`bun ${cliPath} task edit 1 --doc ""`.cwd(TEST_DIR).quiet().nothrow();
			expect(empty.exitCode).toBe(1);
			expect(empty.stderr.toString()).toContain("Cannot use an empty value with --doc");
			expect(empty.stdout.toString()).not.toContain("Updated task");

			const emptyAlongsideValue = await $`bun ${cliPath} task edit 1 --doc "" --doc doc-c`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(emptyAlongsideValue.exitCode).toBe(1);
			expect(emptyAlongsideValue.stderr.toString()).toContain("Cannot use an empty value with --doc");

			const conflicting = await $`bun ${cliPath} task edit 1 --clear-docs --doc doc-c`.cwd(TEST_DIR).quiet().nothrow();
			expect(conflicting.exitCode).toBe(1);
			expect(conflicting.stderr.toString()).toContain("Cannot combine --clear-docs with --doc");

			expect((await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.documentation).toEqual(["doc-a", "doc-b"]);
		});

		it("documents --clear-refs and --clear-docs in task edit help", async () => {
			const result = await $`bun ${cliPath} task edit --help`.cwd(TEST_DIR).quiet();

			expect(result.stdout.toString()).toContain("--clear-refs");
			expect(result.stdout.toString()).toContain("--clear-docs");
		});
	});

	describe("persistence in markdown files", () => {
		it("persists references in task markdown file", async () => {
			await $`bun ${cliPath} task create "Feature" --ref https://example.com --ref src/index.ts`.cwd(TEST_DIR).quiet();

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("references:");
			expect(taskFile).toContain("https://example.com");
			expect(taskFile).toContain("src/index.ts");
		});

		it("persists documentation in task markdown file", async () => {
			await $`bun ${cliPath} task create "Feature" --doc https://docs.example.com --doc spec.md`.cwd(TEST_DIR).quiet();

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("documentation:");
			expect(taskFile).toContain("https://docs.example.com");
			expect(taskFile).toContain("spec.md");
		});

		it("persists modified files in task markdown file", async () => {
			await $`bun ${cliPath} task create "Feature" --modified-file src/index.ts --modified-file src/ui.ts`
				.cwd(TEST_DIR)
				.quiet();

			const taskFile = await Bun.file(join(TEST_DIR, "backlog/tasks/task-1 - Feature.md")).text();
			expect(taskFile).toContain("modified_files:");
			expect(taskFile).toContain("src/index.ts");
			expect(taskFile).toContain("src/ui.ts");
		});
	});
});
