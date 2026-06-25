import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createTaskPlatformAware, editTaskPlatformAware } from "./test-helpers.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI description newline handling", () => {
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
		await initializeTestProject(core, "Desc Newlines Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {}
	});

	it("should preserve literal newlines when creating task", async () => {
		const desc = "First line\nSecond line\n\nThird paragraph";
		await createTaskPlatformAware({ title: "Multi-line", description: desc }, TEST_DIR);

		const core = new Core(TEST_DIR);
		const body = await core.getTaskContent("task-1");
		expect(body).toContain(desc);
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
				description: "Original",
			},
			false,
		);

		const desc = "First line\nSecond line\n\nThird paragraph";
		await editTaskPlatformAware({ taskId: "1", description: desc }, TEST_DIR);

		const updatedBody = await core.getTaskContent("task-1");
		expect(updatedBody).toContain(desc);
	});

	it("should not interpret \\n sequences as newlines", async () => {
		const literal = "First line\\nSecond line";
		await createTaskPlatformAware({ title: "Literal", description: literal }, TEST_DIR);

		const core = new Core(TEST_DIR);
		const body = await core.getTaskContent("task-1");
		expect(body).toContain("First line\\nSecond line");
	});
});
