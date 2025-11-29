import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("task id generation", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-start-id");
		const core = new Core(TEST_DIR);
		await core.initializeProject("ID Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("starts numbering tasks at 1", async () => {
		const result = await $`bun ${CLI_PATH} task create First`.cwd(TEST_DIR).quiet();
		expect(result.exitCode).toBe(0);

		const files = await readdir(join(TEST_DIR, "backlog", "tasks"));
		const first = files.find((f) => f.startsWith("task-1 -"));
		expect(first).toBeDefined();
	});
});
