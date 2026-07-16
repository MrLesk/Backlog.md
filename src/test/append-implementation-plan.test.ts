import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Append Implementation Plan via task edit --append-plan", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-append-plan");
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Append Plan Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("appends to existing Implementation Plan with single blank line separation", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Existing plan",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Test description",
				implementationPlan: "Original plan",
			},
			false,
		);

		let res = await $`bun ${CLI_PATH} task edit 1 --append-plan "First addition" --append-plan "Second addition"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		res = await $`bun ${CLI_PATH} task edit 1 --append-plan "Third addition"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		const updatedBody = await core.getTaskContent("task-1");
		expect(updatedBody).not.toBeNull();

		const body = extractStructuredSection(updatedBody ?? "", "implementationPlan") || "";
		expect(body).toBe("Original plan\n\nFirst addition\n\nSecond addition\n\nThird addition");
	});

	it("creates Implementation Plan when missing", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-2",
				title: "No plan yet",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Desc here",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 2 --append-plan "Plan from scratch"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		const content = (await core.getTaskContent("task-2")) ?? "";
		expect(extractStructuredSection(content, "implementationPlan") || "").toBe("Plan from scratch");
	});

	it("supports multi-line appended content and preserves literal newlines", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-3",
				title: "Multiline append",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Simple description",
			},
			false,
		);

		const multiline = "Step1\nStep2\n\nPhase2";
		const res = await $`bun ${[CLI_PATH, "task", "edit", "3", "--append-plan", multiline]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		const updatedBody = await core.getTaskContent("task-3");
		expect(extractStructuredSection(updatedBody ?? "", "implementationPlan") || "").toContain("Step1\nStep2\n\nPhase2");
	});

	it("allows combining --plan (replace) with --append-plan (append)", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-4",
				title: "Mix flags",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Description only",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 4 --plan "Replace" --append-plan "Append"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();

		expect(res.exitCode).toBe(0);
		const updatedBody = await core.getTaskContent("task-4");
		expect(extractStructuredSection(updatedBody ?? "", "implementationPlan") || "").toBe("Replace\n\nAppend");
	});

	it("--append-plan alone counts as an edit (does not fall through to the editor)", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-5",
				title: "Only append",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				description: "Desc",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 5 --append-plan "Sole edit"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);
		expect(extractStructuredSection((await core.getTaskContent("task-5")) ?? "", "implementationPlan") || "").toBe(
			"Sole edit",
		);
	});
});
