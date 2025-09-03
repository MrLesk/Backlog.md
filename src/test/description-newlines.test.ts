import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI description newline handling", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-desc-newlines");
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {}
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Desc Newlines Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	it("should preserve literal newlines when creating task", async () => {
		const desc = "First line\nSecond line\n\nThird paragraph";
		await $`bun ${[cliPath, "task", "create", "Multi-line", "--desc", desc]}`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		const task = await core.filesystem.loadTask("task-1");
		expect(task?.body).toContain(desc);
	});

	it("should preserve literal newlines when editing task", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Edit me",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-04",
				labels: [],
				dependencies: [],
				body: "## Description\n\nOriginal",
			},
			false,
		);

		const desc = "First line\nSecond line\n\nThird paragraph";
		await $`bun ${[cliPath, "task", "edit", "1", "--desc", desc]}`.cwd(TEST_DIR).quiet();

		const updated = await core.filesystem.loadTask("task-1");
		expect(updated?.body).toContain(desc);
	});

	it("should not interpret \\n sequences as newlines", async () => {
		const literal = "First line\\nSecond line";
		await $`bun ${[cliPath, "task", "create", "Literal", "--desc", literal]}`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		const task = await core.filesystem.loadTask("task-1");
		expect(task?.body).toContain("First line\\nSecond line");
	});
});
