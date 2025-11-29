import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src/cli.ts");

let TEST_DIR: string;

describe("CLI Zero Padded IDs Feature", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-zero-padded-ids");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}

		// Initialize git and backlog project

		const core = new Core(TEST_DIR);
		await core.initializeProject("Padding Test", false); // No auto-commit for init

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
		const result = await $`bun ${CLI_PATH} task create "Padded Task"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("task-001");
	});

	test("should create a document with a zero-padded ID", async () => {
		const result = await $`bun ${CLI_PATH} doc create "Padded Doc"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const docsDir = join(TEST_DIR, "backlog", "docs");
		const files = await readdir(docsDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("doc-001");
	});

	test("should create a decision with a zero-padded ID", async () => {
		const result = await $`bun ${CLI_PATH} decision create "Padded Decision"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const decisionsDir = join(TEST_DIR, "backlog", "decisions");
		const files = await readdir(decisionsDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("decision-001");
	});

	test("should correctly increment a padded task ID", async () => {
		await $`bun ${CLI_PATH} task create "First Padded Task"`.cwd(TEST_DIR).quiet();
		const result = await $`bun ${CLI_PATH} task create "Second Padded Task"`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(2);
		expect(files.some((file) => file.startsWith("task-002"))).toBe(true);
	});

	test("should create a sub-task with a zero-padded ID", async () => {
		// Create parent task first
		await $`bun ${CLI_PATH} task create "Parent Task"`.cwd(TEST_DIR).quiet();

		// Create sub-task
		const result = await $`bun ${CLI_PATH} task create "Padded Sub-task" -p task-001`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const tasksDir = join(TEST_DIR, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(2);
		expect(files.some((file) => file.startsWith("task-001.01"))).toBe(true);
	});
});
