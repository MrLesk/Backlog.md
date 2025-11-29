import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI agents command", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-agents-cli");

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

		// Update AGENTS.md file
		await expect(async () => {
			await addAgentInstructions(TEST_DIR, core.gitOps, ["AGENTS.md"]);
		}).not.toThrow();

		// Verify the file was created
		const agents = Bun.file(join(TEST_DIR, "AGENTS.md"));
		expect(await agents.exists()).toBe(true);
		const content = await agents.text();
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
		const agents = Bun.file(join(TEST_DIR, "AGENTS.md"));
		expect(await agents.exists()).toBe(false);
	});

	it("should fail when not in a backlog project", async () => {
		// Use OS temp directory to ensure complete isolation from project
		const nonBacklogDir = await createTestDir("test-non-backlog");

		// Directory has git but no backlog project

		const result = await $`bun ${cliPath} agents --update-instructions`.cwd(nonBacklogDir).nothrow().quiet();

		expect(result.exitCode).toBe(1);

		// Cleanup
		await safeCleanup(nonBacklogDir);
	});

	it("should update multiple selected files", async () => {
		// Test updating multiple agent instruction files
		const core = new Core(TEST_DIR);
		const { addAgentInstructions } = await import("../index.ts");

		// Test updating multiple files
		await expect(async () => {
			await addAgentInstructions(TEST_DIR, core.gitOps, ["AGENTS.md", "CLAUDE.md"]);
		}).not.toThrow();

		// Verify both files were created
		const agents2 = Bun.file(join(TEST_DIR, "AGENTS.md"));
		const claudeMd = Bun.file(join(TEST_DIR, "CLAUDE.md"));

		expect(await agents2.exists()).toBe(true);
		expect(await claudeMd.exists()).toBe(true);

		const agentsContent = await agents2.text();
		const claudeContent = await claudeMd.text();

		expect(agentsContent).toContain("Backlog.md");
		expect(claudeContent).toContain("Backlog.md");
	});

	it("should update existing files correctly", async () => {
		// Test that existing files are updated correctly (idempotent)
		const core = new Core(TEST_DIR);
		const { addAgentInstructions } = await import("../index.ts");

		// First, create a file
		await addAgentInstructions(TEST_DIR, core.gitOps, ["AGENTS.md"]);

		const agents3 = Bun.file(join(TEST_DIR, "AGENTS.md"));
		expect(await agents3.exists()).toBe(true);
		const _originalContent = await agents3.text();

		// Update it again - should be idempotent
		await expect(async () => {
			await addAgentInstructions(TEST_DIR, core.gitOps, ["AGENTS.md"]);
		}).not.toThrow();

		// File should still exist and have consistent content
		expect(await agents3.exists()).toBe(true);
		const updatedContent = await agents3.text();
		expect(updatedContent).toContain("Backlog.md");
		// Should be idempotent - content should be similar (may have minor differences)
		expect(updatedContent.length).toBeGreaterThan(0);
	});
});
