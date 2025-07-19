import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";

const CLI_PATH = join(process.cwd(), "src/cli.ts");

describe("CLI Zero Padded IDs Feature", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = await mkdtemp(join(tmpdir(), "backlog-test-padding-"));

		// Initialize git and backlog project
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		const core = new Core(testDir);
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
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	test("should create a task with a zero-padded ID", async () => {
		const result = await $`bun ${CLI_PATH} task create "Padded Task"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const tasksDir = join(testDir, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("task-001");
	});

	test("should create a document with a zero-padded ID", async () => {
		const result = await $`bun ${CLI_PATH} doc create "Padded Doc"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const docsDir = join(testDir, "backlog", "docs");
		const files = await readdir(docsDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("doc-001");
	});

	test("should create a decision with a zero-padded ID", async () => {
		const result = await $`bun ${CLI_PATH} decision create "Padded Decision"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const decisionsDir = join(testDir, "backlog", "decisions");
		const files = await readdir(decisionsDir);
		expect(files.length).toBe(1);
		expect(files[0]).toStartWith("decision-001");
	});

	test("should correctly increment a padded task ID", async () => {
		await $`bun ${CLI_PATH} task create "First Padded Task"`.cwd(testDir).quiet();
		const result = await $`bun ${CLI_PATH} task create "Second Padded Task"`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const tasksDir = join(testDir, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(2);
		expect(files.some((file) => file.startsWith("task-002"))).toBe(true);
	});

	test("should create a sub-task with a zero-padded ID", async () => {
		// Create parent task first
		await $`bun ${CLI_PATH} task create "Parent Task"`.cwd(testDir).quiet();

		// Create sub-task
		const result = await $`bun ${CLI_PATH} task create "Padded Sub-task" -p task-001`.cwd(testDir).quiet();
		expect(result.exitCode).toBe(0);

		const tasksDir = join(testDir, "backlog", "tasks");
		const files = await readdir(tasksDir);
		expect(files.length).toBe(2);
		expect(files.some((file) => file.startsWith("task-001.01"))).toBe(true);
	});
});
