import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

describe("task id generation", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-start-id");
		await mkdir(TEST_DIR, { recursive: true });
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "ID Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("starts numbering tasks at 1", async () => {
		const result = await $`bun ${CLI_PATH} task create First`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const files = await readdir(join(TEST_DIR, "backlog", "tasks"));
		const first = files.find((f) => f.startsWith("task-1 -"));
		expect(first).toBeDefined();
	});
});
