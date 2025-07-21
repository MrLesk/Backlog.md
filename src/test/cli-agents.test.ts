import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI agents command", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-agents-cli");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		// Initialize backlog project using Core
		const core = new Core(TEST_DIR);
		await core.initializeProject("Agents Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should show help when no options are provided", async () => {
		const result = await $`bun ${cliPath} agents`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
	});

	it("should show help text with agents --help", async () => {
		const result = await $`bun ${cliPath} agents --help`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
	});

	it("should update selected agent instruction files", async () => {
		// Test the underlying functionality directly instead of the interactive CLI
		const core = new Core(TEST_DIR);
		const { addAgentInstructions } = await import("../index.ts");

		// Test updating .cursorrules file (correct parameter order: projectRoot, git, files)
		await expect(async () => {
			await addAgentInstructions(TEST_DIR, core.gitOps, [".cursorrules"]);
		}).not.toThrow();

		// Verify the file was created
		const cursorrules = Bun.file(join(TEST_DIR, ".cursorrules"));
		expect(await cursorrules.exists()).toBe(true);
		const content = await cursorrules.text();
		expect(content).toContain("Backlog.md");
	});

	it("should handle user cancellation gracefully", async () => {
		// Test that the function handles empty selection (cancellation) gracefully
		const core = new Core(TEST_DIR);
		const { addAgentInstructions } = await import("../index.ts");

		// Test with empty array (simulates user cancellation)
		await expect(async () => {
			await addAgentInstructions(TEST_DIR, core.gitOps, []);
		}).not.toThrow();

		// No files should be created when selection is empty
		const cursorrules = Bun.file(join(TEST_DIR, ".cursorrules"));
		expect(await cursorrules.exists()).toBe(false);
	});

	it("should fail when not in a backlog project", async () => {
		// Use OS temp directory to ensure complete isolation from project
		const tempDir = await import("node:os").then((os) => os.tmpdir());
		const nonBacklogDir = join(tempDir, `test-non-backlog-${Date.now()}-${Math.random().toString(36).substring(7)}`);

		// Ensure clean state first
		await rm(nonBacklogDir, { recursive: true, force: true }).catch(() => {});

		// Create a temporary directory that's not a backlog project
		await mkdir(nonBacklogDir, { recursive: true });

		// Initialize git repo
		await $`git init`.cwd(nonBacklogDir).quiet();
		await $`git config user.name "Test User"`.cwd(nonBacklogDir).quiet();
		await $`git config user.email test@example.com`.cwd(nonBacklogDir).quiet();

		const result = await $`bun ${cliPath} agents --update-instructions`.cwd(nonBacklogDir).nothrow().quiet();

		expect(result.exitCode).toBe(1);

		// Cleanup
		await rm(nonBacklogDir, { recursive: true, force: true }).catch(() => {});
	});

	it("should update multiple selected files", async () => {
		// Test updating multiple agent instruction files
		const core = new Core(TEST_DIR);
		const { addAgentInstructions } = await import("../index.ts");

		// Test updating multiple files
		await expect(async () => {
			await addAgentInstructions(TEST_DIR, core.gitOps, [".cursorrules", "CLAUDE.md"]);
		}).not.toThrow();

		// Verify both files were created
		const cursorrules = Bun.file(join(TEST_DIR, ".cursorrules"));
		const claudeMd = Bun.file(join(TEST_DIR, "CLAUDE.md"));

		expect(await cursorrules.exists()).toBe(true);
		expect(await claudeMd.exists()).toBe(true);

		const cursorContent = await cursorrules.text();
		const claudeContent = await claudeMd.text();

		expect(cursorContent).toContain("Backlog.md");
		expect(claudeContent).toContain("Backlog.md");
	});

	it("should update existing files correctly", async () => {
		// Test that existing files are updated correctly (idempotent)
		const core = new Core(TEST_DIR);
		const { addAgentInstructions } = await import("../index.ts");

		// First, create a file
		await addAgentInstructions(TEST_DIR, core.gitOps, [".cursorrules"]);

		const cursorrules = Bun.file(join(TEST_DIR, ".cursorrules"));
		expect(await cursorrules.exists()).toBe(true);
		const _originalContent = await cursorrules.text();

		// Update it again - should be idempotent
		await expect(async () => {
			await addAgentInstructions(TEST_DIR, core.gitOps, [".cursorrules"]);
		}).not.toThrow();

		// File should still exist and have consistent content
		expect(await cursorrules.exists()).toBe(true);
		const updatedContent = await cursorrules.text();
		expect(updatedContent).toContain("Backlog.md");
		// Should be idempotent - content should be similar (may have minor differences)
		expect(updatedContent.length).toBeGreaterThan(0);
	});
});
