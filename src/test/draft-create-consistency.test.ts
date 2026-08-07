import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

describe("Draft creation consistency", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-draft-create-consistency");
		await mkdir(TEST_DIR, { recursive: true });

		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Draft Consistency Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
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

	it("splits comma-separated and repeated assignees on draft create", async () => {
		await $`bun ${CLI_PATH} draft create "Comma assignees" -a "@alice,@bob"`.cwd(TEST_DIR).quiet();
		await $`bun ${CLI_PATH} draft create "Repeated assignees" -a @alice -a @bob,@carol`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		expect((await core.filesystem.loadDraft("draft-1"))?.assignee).toEqual(["@alice", "@bob"]);
		expect((await core.filesystem.loadDraft("draft-2"))?.assignee).toEqual(["@alice", "@bob", "@carol"]);
	});

	it("uses DRAFT IDs in plain output for task create --draft", async () => {
		const result = await $`bun ${CLI_PATH} task create --draft "Plain sample" --plain`.cwd(TEST_DIR).quiet();
		const output = result.stdout.toString();

		expect(output).toContain("draft-1 - Plain-sample.md");
		expect(output).toContain("Task DRAFT-1 - Plain sample");
		expect(output).not.toContain("Task TASK-1");
	});
});
