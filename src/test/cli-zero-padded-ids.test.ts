import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI Zero Padded IDs Feature", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-zero-padded-ids");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git and backlog project
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Padding Test", false); // No auto-commit for init

		// Enable zero padding in the config
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.zeroPaddedIds = 3;
			config.autoCommit = false; // Disable auto-commit for easier testing
			await core.filesystem.saveConfig(config);
		}
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	test("should create a task with a zero-padded ID", async () => {
		const result = await createTaskPlatformAware({ title: "Padded Task" }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("task-001");
	});

	test("should create a document with a zero-padded ID", async () => {
		// CLI-CONTRACT: verifies doc create respects zeroPaddedIds config (doc creation not in Core helper)
		const CLI_PATH = join(process.cwd(), "src/cli.ts");
		const result = await $`bun ${CLI_PATH} doc create "Padded Doc"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const docsDir = join(TEST_DIR, "backlog", "docs");
		const files = await readdir(docsDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("doc-001");
	});

	test("should create a decision with a zero-padded ID", async () => {
		// CLI-CONTRACT: verifies decision create respects zeroPaddedIds config (decision creation not in Core helper)
		const CLI_PATH = join(process.cwd(), "src/cli.ts");
		const result = await $`bun ${CLI_PATH} decision create "Padded Decision"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const decisionsDir = join(TEST_DIR, "backlog", "decisions");
		const files = await readdir(decisionsDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("decision-001");
	});

	test("should correctly increment a padded task ID", async () => {
		await createTaskPlatformAware({ title: "First Padded Task" }, TEST_DIR);
		const result = await createTaskPlatformAware({ title: "Second Padded Task" }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(2);
		expect(files.some((file) => file.startsWith("task-002"))).toBe(true);
	});

	test("should create a sub-task with a zero-padded ID", async () => {
		// Create parent task first
		await createTaskPlatformAware({ title: "Parent Task" }, TEST_DIR);

		// Create sub-task - use parent with zero-padded ID
		const result = await createTaskPlatformAware({ title: "Padded Sub-task", parent: "001" }, TEST_DIR);
		expect(result.exitCode).toBe(0);

		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(2);
		expect(files.some((file) => file.startsWith("task-001.01"))).toBe(true);
	});
});
