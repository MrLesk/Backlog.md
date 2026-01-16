import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI --ref and --doc flags", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

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
		await core.initializeProject("CLI Refs Docs Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
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
	});
});
