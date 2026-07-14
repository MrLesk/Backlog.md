import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Draft creation consistency", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-create-consistency");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Draft Consistency Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("keeps IDs and filenames consistent between draft create and task create --draft", async () => {
		const first = await $`bun ${CLI_PATH} draft create "Hallo"`.cwd(TEST_DIR).quiet();
		const second = await $`bun ${CLI_PATH} task create --draft "Goodbye"`.cwd(TEST_DIR).quiet();

		// Drafts are allocated out of the task ID pool, so they carry task IDs.
		expect(first.stdout.toString()).toContain("Created draft TASK-1");
		expect(second.stdout.toString()).toContain("Created draft TASK-2");
		expect(second.stdout.toString()).toContain("task-2 - Goodbye.md");
		expect(second.stdout.toString()).not.toContain("draft-task-");

		const draftFiles = await readdir(join(TEST_DIR, "backlog", "drafts"));
		expect(draftFiles).toContain("task-1 - Hallo.md");
		expect(draftFiles).toContain("task-2 - Goodbye.md");
		// No draft- prefixed filenames survive anywhere (guards the old draft-task-N bug).
		expect(draftFiles.some((file) => file.startsWith("draft-"))).toBe(false);

		const core = new Core(TEST_DIR);
		const secondDraft = await core.filesystem.loadDraft("task-2");
		expect(secondDraft).not.toBeNull();
		expect(secondDraft?.id).toBe("TASK-2");
	});

	it("uses task IDs in plain output for task create --draft", async () => {
		const result = await $`bun ${CLI_PATH} task create --draft "Plain sample" --plain`.cwd(TEST_DIR).quiet();
		const output = result.stdout.toString();

		expect(output).toContain("task-1 - Plain-sample.md");
		expect(output).toContain("Task TASK-1 - Plain sample");
		expect(output).not.toContain("DRAFT-1");
	});
});
