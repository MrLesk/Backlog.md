import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Final Summary", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-final-summary");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Final Summary Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR).catch(() => {});
	});

	it("creates tasks with Final Summary and persists section markers", async () => {
		const core = new Core(TEST_DIR);
		const { task } = await core.createTaskFromInput({
			title: "Task with summary",
			finalSummary: "Completed the core workflow",
		});

		expect(task.rawContent).toContain("## Final Summary");
		expect(task.rawContent).toContain("<!-- SECTION:FINAL_SUMMARY:BEGIN -->");
		expect(task.rawContent).toContain("<!-- SECTION:FINAL_SUMMARY:END -->");
		expect(extractStructuredSection(task.rawContent ?? "", "finalSummary")).toBe("Completed the core workflow");
	});

	it("sets, appends, and clears Final Summary via task edit operations", async () => {
		const core = new Core(TEST_DIR);
		const base: Task = {
			id: "task-1",
			title: "Editable task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-07-03",
			labels: [],
			dependencies: [],
			description: "Initial description",
		};
		await core.createTask(base, false);

		await core.updateTaskFromInput("task-1", { finalSummary: "Initial summary" }, false);
		let body = await core.getTaskContent("task-1");
		expect(extractStructuredSection(body ?? "", "finalSummary")).toBe("Initial summary");

		await core.updateTaskFromInput("task-1", { appendFinalSummary: ["Second", "Third"] }, false);
		body = await core.getTaskContent("task-1");
		expect(extractStructuredSection(body ?? "", "finalSummary")).toBe("Initial summary\n\nSecond\n\nThird");

		await core.updateTaskFromInput("task-1", { clearFinalSummary: true }, false);
		body = await core.getTaskContent("task-1");
		expect(extractStructuredSection(body ?? "", "finalSummary")).toBeUndefined();
		expect(body).not.toContain("## Final Summary");
	});

	it("orders Final Summary after Implementation Notes", async () => {
		const core = new Core(TEST_DIR);
		const task: Task = {
			id: "task-2",
			title: "Ordered task",
			status: "To Do",
			assignee: [],
			createdDate: "2025-07-03",
			labels: [],
			dependencies: [],
			description: "Desc",
			implementationPlan: "1. Plan",
			implementationNotes: "Notes",
			finalSummary: "Summary",
		};
		await core.createTask(task, false);

		const body = (await core.getTaskContent("task-2")) ?? "";
		const notesIndex = body.indexOf("## Implementation Notes");
		const summaryIndex = body.indexOf("## Final Summary");
		expect(summaryIndex).toBeGreaterThan(notesIndex);
	});

	it("does not persist empty Final Summary sections", async () => {
		const core = new Core(TEST_DIR);
		const { task } = await core.createTaskFromInput({
			title: "Task without summary",
		});

		expect(task.rawContent).not.toContain("## Final Summary");
	});
});
