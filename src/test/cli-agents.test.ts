import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let NON_BACKLOG_DIR: string | undefined;

describe("CLI agents command", () => {
	const cliPath = getTestCliPath();

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-agents-cli");
		NON_BACKLOG_DIR = undefined;
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first
		await $`git init`.cwd(TEST_DIR).quiet();

		// Initialize backlog project using Core
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Agents Test Project");
	});

	afterEach(async () => {
		await Promise.all([
			...(NON_BACKLOG_DIR ? [rm(NON_BACKLOG_DIR, { recursive: true, force: true })] : []),
			safeCleanup(TEST_DIR),
		]);
	});

	it("should show help when no options are provided", async () => {
		const result = await $`bun ${cliPath} agents`.cwd(TEST_DIR).quiet();

		expect(result.exitCode).toBe(0);
	});

	it("should show help text with agents --help", async () => {
		const result = await $`bun ${cliPath} agents --help`.cwd(TEST_DIR).quiet();
		const output = result.stdout.toString();

		expect(result.exitCode).toBe(0);
		expect(output).toContain("manage the short Backlog.md CLI nudge in agent instruction files");
		expect(output).toContain("--update-instructions");
		expect(output).toContain("preserving existing content");
		expect(output).toContain("Input schema:");
		expect(output).toContain("--update-instructions: Boolean");
		expect(output).toContain("Reads:");
		expect(output).toContain("Project config and existing agent instruction files");
		expect(output).toContain("Writes:");
		expect(output).toContain("preserves existing content outside the managed block");
		expect(output).toContain("Output:");
		expect(output).toContain("Examples:");
		expect(output).toContain("backlog agents --update-instructions");
	});

	it("should fail when not in a backlog project", async () => {
		// Use OS temp directory to ensure complete isolation from project
		const tempDir = await import("node:os").then((os) => os.tmpdir());
		NON_BACKLOG_DIR = join(tempDir, `test-non-backlog-${Date.now()}-${Math.random().toString(36).substring(7)}`);

		// Create a temporary directory that's not a backlog project
		await mkdir(NON_BACKLOG_DIR, { recursive: true });

		// Initialize git repo
		await $`git init`.cwd(NON_BACKLOG_DIR).quiet();

		const result = await $`bun ${cliPath} agents --update-instructions`.cwd(NON_BACKLOG_DIR).nothrow().quiet();

		expect(result.exitCode).toBe(1);
	});
});
