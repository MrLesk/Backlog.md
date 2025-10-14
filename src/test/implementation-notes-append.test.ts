import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

const CLI_PATH = join(process.cwd(), "src", "cli.ts");
let TEST_DIR: string;

describe("Implementation Notes - append", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-notes-append");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Append Notes Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR).catch(() => {});
	});

	it("appends to existing Implementation Notes with single blank line", async () => {
		const core = new Core(TEST_DIR);
		const task: Task = {
			id: "task-1",
			title: "Task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-07-03",
			labels: [],
			dependencies: [],
			description: "Test description",
			implementationNotes: "First block",
		};
		await core.createTask(task, false);

		const result = await $`bun ${[CLI_PATH, "task", "edit", "1", "--append-notes", "Second block"]}`
			.cwd(TEST_DIR)
			.quiet();
		expect(result.exitCode).toBe(0);

		const updatedBody = await core.getTaskContent("task-1");
		expect(extractStructuredSection(updatedBody ?? "", "implementationNotes")).toBe("First block\n\nSecond block");
	});

	it("creates Implementation Notes at correct position when missing (after plan, else AC, else Description)", async () => {
		const core = new Core(TEST_DIR);
		const t: Task = {
			id: "task-1",
			title: "Planned",
			status: "To Do",
			assignee: [],
			createdDate: "2025-07-03",
			labels: [],
			dependencies: [],
			description: "Desc here",
			acceptanceCriteriaItems: [{ index: 1, text: "A", checked: false }],
			implementationPlan: "1. Do A\n2. Do B",
		};
		await core.createTask(t, false);

		const res = await $`bun ${[CLI_PATH, "task", "edit", "1", "--append-notes", "Followed plan"]}`
			.cwd(TEST_DIR)
			.quiet();
		expect(res.exitCode).toBe(0);

		const body = (await core.getTaskContent("task-1")) ?? "";
		const planIdx = body.indexOf("## Implementation Plan");
		const notesContent = extractStructuredSection(body, "implementationNotes") || "";
		expect(planIdx).toBeGreaterThan(0);
		expect(notesContent).toContain("Followed plan");
	});

	it("supports multiple --append-notes flags in order", async () => {
		const core = new Core(TEST_DIR);
		const task: Task = {
			id: "task-1",
			title: "Task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-07-03",
			labels: [],
			dependencies: [],
			description: "Some description",
		};
		await core.createTask(task, false);

		const res = await $`bun ${[CLI_PATH, "task", "edit", "1", "--append-notes", "First", "--append-notes", "Second"]}`
			.cwd(TEST_DIR)
			.quiet();
		expect(res.exitCode).toBe(0);

		const updatedBody = await core.getTaskContent("task-1");
		expect(extractStructuredSection(updatedBody ?? "", "implementationNotes")).toBe("First\n\nSecond");
	});

	it("edit --append-notes works and allows combining with --notes", async () => {
		const resOk = await $`bun ${[CLI_PATH, "task", "create", "T", "--plan", "1. A\n2. B"]}`.cwd(TEST_DIR).quiet();
		expect(resOk.exitCode).toBe(0);

		const res1 = await $`bun ${[CLI_PATH, "task", "edit", "1", "--append-notes", "Alpha", "--append-notes", "Beta"]}`
			.cwd(TEST_DIR)
			.quiet();
		expect(res1.exitCode).toBe(0);

		const core = new Core(TEST_DIR);
		let taskBody = await core.getTaskContent("task-1");
		expect(extractStructuredSection(taskBody ?? "", "implementationNotes")).toBe("Alpha\n\nBeta");

		// Combining --notes (replace) with --append-notes (append) should work
		const combined = await $`bun ${[CLI_PATH, "task", "edit", "1", "--notes", "Y", "--append-notes", "X"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(combined.exitCode).toBe(0);

		taskBody = await core.getTaskContent("task-1");
		expect(extractStructuredSection(taskBody ?? "", "implementationNotes")).toBe("Y\n\nX");
	});
});
