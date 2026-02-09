import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Draft creation consistency", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-create-consistency");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Draft Consistency Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("keeps IDs and filenames consistent between draft create and task create --draft", async () => {
		const first = await $`bun ${CLI_PATH} draft create "Hallo"`.cwd(TEST_DIR).quiet();
		const second = await $`bun ${CLI_PATH} task create --draft "Goodbye"`.cwd(TEST_DIR).quiet();

		expect(first.stdout.toString()).toContain("Created draft DRAFT-1");
		expect(second.stdout.toString()).toContain("Created draft DRAFT-2");
		expect(second.stdout.toString()).toContain("draft-2 - Goodbye.md");
		expect(second.stdout.toString()).not.toContain("draft-task-");

		const draftFiles = await readdir(join(TEST_DIR, "backlog", "drafts"));
		expect(draftFiles).toContain("draft-1 - Hallo.md");
		expect(draftFiles).toContain("draft-2 - Goodbye.md");
		expect(draftFiles.some((file) => file.startsWith("draft-task-"))).toBe(false);

		const core = new Core(TEST_DIR);
		const secondDraft = await core.filesystem.loadDraft("draft-2");
		expect(secondDraft).not.toBeNull();
		expect(secondDraft?.id).toBe("DRAFT-2");
	});

	it("uses DRAFT IDs in plain output for task create --draft", async () => {
		const result = await $`bun ${CLI_PATH} task create --draft "Plain sample" --plain`.cwd(TEST_DIR).quiet();
		const output = result.stdout.toString();

		expect(output).toContain("draft-1 - Plain-sample.md");
		expect(output).toContain("Task DRAFT-1 - Plain sample");
		expect(output).not.toContain("Task TASK-1");
	});
});
