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

	describe("task create with empty --ref and --doc values", () => {
		it("rejects an empty reference without creating the task", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --ref ""`.cwd(TEST_DIR).quiet().nothrow();

			expect(result.exitCode).toBe(1);
			// Create has nothing to clear, so the empty value stays an error here even though task edit clears.
			expect(result.stderr.toString()).toContain(
				"Cannot use an empty value with --ref. Omit the flag to leave references unset.",
			);
			expect(await new Core(TEST_DIR).filesystem.loadTask("TASK-1")).toBeNull();
		});

		it("rejects an empty reference alongside a valid one", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --ref "" --ref src/api.ts`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();

			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --ref");
		});

		it("rejects an empty documentation entry without creating the task", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --doc ""`.cwd(TEST_DIR).quiet().nothrow();

			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain(
				"Cannot use an empty value with --doc. Omit the flag to leave documentation unset.",
			);
			expect(await new Core(TEST_DIR).filesystem.loadTask("TASK-1")).toBeNull();
		});

		it("rejects an empty reference on task create --draft without creating the draft", async () => {
			const result = await $`bun ${cliPath} task create "Feature" --draft --ref ""`.cwd(TEST_DIR).quiet().nothrow();

			expect(result.exitCode).toBe(1);
			expect(result.stderr.toString()).toContain("Cannot use an empty value with --ref");
			expect(await new Core(TEST_DIR).filesystem.listDrafts()).toHaveLength(0);
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

		// On edit an explicit empty value is the second spelling of --clear-refs/--clear-docs, matching `-a ""`.
		it("clears references with an explicit empty --ref value", async () => {
			await createTaskWithRefsAndDocs();

			const result = await $`bun ${cliPath} task edit 1 --ref ${""} --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			const task = await new Core(TEST_DIR).filesystem.loadTask("TASK-1");
			expect(task?.references).toEqual([]);
			expect(task?.documentation).toEqual(["doc-a", "doc-b"]);
		});

		it("clears documentation with an explicit empty --doc value", async () => {
			await createTaskWithRefsAndDocs();

			const result = await $`bun ${cliPath} task edit 1 --doc ${""} --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			const task = await new Core(TEST_DIR).filesystem.loadTask("TASK-1");
			expect(task?.documentation).toEqual([]);
			expect(task?.references).toEqual(["a", "b"]);
		});

		it("accepts an explicit empty value together with the matching clear flag", async () => {
			await createTaskWithRefsAndDocs();

			const refs = await $`bun ${cliPath} task edit 1 --clear-refs --ref ${""} --plain`.cwd(TEST_DIR).quiet().nothrow();
			expect(refs.exitCode).toBe(0);
			expect((await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.references).toEqual([]);

			const docs = await $`bun ${cliPath} task edit 1 --clear-docs --doc ${""} --plain`.cwd(TEST_DIR).quiet().nothrow();
			expect(docs.exitCode).toBe(0);
			expect((await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.documentation).toEqual([]);
		});

		// Blank values normalize away exactly as they do inside one value (`--ref "a,"`) and for `-a ""`,
		// so a real value alongside a blank one still sets that value.
		it("ignores an empty value when a real value is also given", async () => {
			await createTaskWithRefsAndDocs();

			const refs = await $`bun ${cliPath} task edit 1 --ref ${""} --ref c --plain`.cwd(TEST_DIR).quiet();
			expect(refs.exitCode).toBe(0);
			expect((await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.references).toEqual(["c"]);

			const docs = await $`bun ${cliPath} task edit 1 --doc ${""} --doc doc-c --plain`.cwd(TEST_DIR).quiet();
			expect(docs.exitCode).toBe(0);
			expect((await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.documentation).toEqual(["doc-c"]);
		});

		it("rejects conflicting reference and documentation edits without changing them", async () => {
			await createTaskWithRefsAndDocs();

			const conflictingRefs = await $`bun ${cliPath} task edit 1 --clear-refs --ref c`.cwd(TEST_DIR).quiet().nothrow();
			expect(conflictingRefs.exitCode).toBe(1);
			expect(conflictingRefs.stderr.toString()).toContain("Cannot combine --clear-refs with --ref");

			const conflictingDocs = await $`bun ${cliPath} task edit 1 --clear-docs --doc doc-c`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(conflictingDocs.exitCode).toBe(1);
			expect(conflictingDocs.stderr.toString()).toContain("Cannot combine --clear-docs with --doc");

			const task = await new Core(TEST_DIR).filesystem.loadTask("TASK-1");
			expect(task?.references).toEqual(["a", "b"]);
			expect(task?.documentation).toEqual(["doc-a", "doc-b"]);
		});

		it("documents --clear-refs and --clear-docs in task edit help", async () => {
			const result = await $`bun ${cliPath} task edit --help`.cwd(TEST_DIR).quiet();

			expect(result.stdout.toString()).toContain("--clear-refs");
			expect(result.stdout.toString()).toContain("--clear-docs");
		});
	});

	describe("task edit with --add-ref and --remove-ref", () => {
		async function createTaskWithReferences() {
			await $`bun ${cliPath} task create "Feature" --ref seed:a --ref seed:b --doc doc-a`.cwd(TEST_DIR).quiet();
		}

		async function loadReferences() {
			return (await new Core(TEST_DIR).filesystem.loadTask("TASK-1"))?.references;
		}

		it("adds references without replacing existing ones and skips duplicates", async () => {
			await createTaskWithReferences();

			const result = await $`bun ${cliPath} task edit 1 --add-ref added:c --add-ref seed:a --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("References: seed:a, seed:b, added:c");
			expect(await loadReferences()).toEqual(["seed:a", "seed:b", "added:c"]);
		});

		it("removes references by value and leaves unrelated references unchanged", async () => {
			await createTaskWithReferences();

			const result = await $`bun ${cliPath} task edit 1 --remove-ref seed:a --remove-ref missing:x --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			expect(await loadReferences()).toEqual(["seed:b"]);
			const task = await new Core(TEST_DIR).filesystem.loadTask("TASK-1");
			expect(task?.documentation).toEqual(["doc-a"]);
		});

		it("accepts comma-separated values for both flags", async () => {
			await createTaskWithReferences();

			const added = await $`bun ${cliPath} task edit 1 --add-ref "added:c,added:d" --plain`.cwd(TEST_DIR).quiet();
			expect(added.exitCode).toBe(0);
			expect(await loadReferences()).toEqual(["seed:a", "seed:b", "added:c", "added:d"]);

			const removed = await $`bun ${cliPath} task edit 1 --remove-ref "seed:a,added:d"`.cwd(TEST_DIR).quiet();
			expect(removed.exitCode).toBe(0);
			expect(await loadReferences()).toEqual(["seed:b", "added:c"]);
		});

		it("removes a reference that is added in the same command", async () => {
			// Pins the shared model order used by MCP task_edit: additions apply first, then removals.
			await createTaskWithReferences();

			const result = await $`bun ${cliPath} task edit 1 --add-ref same:x --remove-ref same:x --plain`
				.cwd(TEST_DIR)
				.quiet();

			expect(result.exitCode).toBe(0);
			expect(await loadReferences()).toEqual(["seed:a", "seed:b"]);
		});

		it("adds a reference in an interactive terminal", async () => {
			await createTaskWithReferences();

			const result = await runCliWithInteractiveTty(TEST_DIR, ["task", "edit", "1", "--add-ref", "added:c"]);

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("Updated task TASK-1");
			expect(await loadReferences()).toEqual(["seed:a", "seed:b", "added:c"]);
		});

		it("rejects empty values and conflicting flags without changing references", async () => {
			await createTaskWithReferences();

			const emptyAdd = await $`bun ${cliPath} task edit 1 --add-ref ""`.cwd(TEST_DIR).quiet().nothrow();
			expect(emptyAdd.exitCode).toBe(1);
			expect(emptyAdd.stderr.toString()).toContain(
				"Cannot use an empty value with --add-ref. Use --clear-refs to remove all references.",
			);
			expect(emptyAdd.stdout.toString()).not.toContain("Updated task");

			const emptyRemove = await $`bun ${cliPath} task edit 1 --remove-ref seed:a --remove-ref ""`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(emptyRemove.exitCode).toBe(1);
			expect(emptyRemove.stderr.toString()).toContain("Cannot use an empty value with --remove-ref");

			const clearConflict = await $`bun ${cliPath} task edit 1 --clear-refs --add-ref added:c`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(clearConflict.exitCode).toBe(1);
			expect(clearConflict.stderr.toString()).toContain("Cannot combine --clear-refs with --add-ref");

			const clearRemoveConflict = await $`bun ${cliPath} task edit 1 --clear-refs --remove-ref seed:a`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(clearRemoveConflict.exitCode).toBe(1);
			expect(clearRemoveConflict.stderr.toString()).toContain("Cannot combine --clear-refs with --remove-ref");

			const replacementConflict = await $`bun ${cliPath} task edit 1 --ref only:c --add-ref added:c`
				.cwd(TEST_DIR)
				.quiet()
				.nothrow();
			expect(replacementConflict.exitCode).toBe(1);
			expect(replacementConflict.stderr.toString()).toContain("Cannot combine --ref with --add-ref or --remove-ref");

			expect(await loadReferences()).toEqual(["seed:a", "seed:b"]);
		});

		it("keeps --ref as the replace-all operation", async () => {
			await createTaskWithReferences();

			const result = await $`bun ${cliPath} task edit 1 --ref only:c --plain`.cwd(TEST_DIR).quiet();

			expect(result.exitCode).toBe(0);
			expect(await loadReferences()).toEqual(["only:c"]);
		});

		it("documents --add-ref and --remove-ref in task edit help", async () => {
			const result = await $`bun ${cliPath} task edit --help`.cwd(TEST_DIR).quiet();

			const out = result.stdout.toString();
			expect(out).toContain("--add-ref");
			expect(out).toContain("--remove-ref");
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
