import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Final Summary CLI", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-final-summary-cli");
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Final Summary CLI Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR).catch(() => {});
	});

	it("supports --final-summary on task create", async () => {
		const result = await $`bun ${[CLI_PATH, "task", "create", "Task A", "--final-summary", "PR-ready summary"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(result.exitCode).toBe(0);

		const core = new Core(TEST_DIR);
		const task = await core.filesystem.loadTask("task-1");
		expect(task).not.toBeNull();
		expect(task?.rawContent).toContain("## Final Summary");
		expect(extractStructuredSection(task?.rawContent ?? "", "finalSummary")).toBe("PR-ready summary");
	});

	it("supports set/append/clear flags on task edit", async () => {
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

		let res = await $`bun ${[CLI_PATH, "task", "edit", "1", "--final-summary", "Initial summary"]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		let body = await core.getTaskContent("task-1");
		expect(extractStructuredSection(body ?? "", "finalSummary")).toBe("Initial summary");

		res = await $`bun ${[
			CLI_PATH,
			"task",
			"edit",
			"1",
			"--append-final-summary",
			"Second",
			"--append-final-summary",
			"Third",
		]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		body = await core.getTaskContent("task-1");
		expect(extractStructuredSection(body ?? "", "finalSummary")).toBe("Initial summary\n\nSecond\n\nThird");

		res = await $`bun ${[CLI_PATH, "task", "edit", "1", "--clear-final-summary"]}`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		body = await core.getTaskContent("task-1");
		expect(extractStructuredSection(body ?? "", "finalSummary")).toBeUndefined();
		expect(body).not.toContain("## Final Summary");
	});

	it("renders Final Summary in plain output after Implementation Notes when present", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Plain output task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Desc",
				implementationNotes: "Notes",
				finalSummary: "Summary",
			},
			false,
		);

		const result = await $`bun ${[CLI_PATH, "task", "view", "1", "--plain"]}`.cwd(TEST_DIR).quiet().nothrow();
		expect(result.exitCode).toBe(0);

		const output = result.stdout.toString();
		expect(output).toContain("Implementation Notes:");
		expect(output).toContain("Final Summary:");
		expect(output.indexOf("Final Summary:")).toBeGreaterThan(output.indexOf("Implementation Notes:"));
	});
});
