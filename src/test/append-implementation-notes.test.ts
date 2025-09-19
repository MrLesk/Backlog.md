import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { extractStructuredSection } from "../markdown/structured-sections.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Append Implementation Notes via task edit --append-notes", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-append-notes");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("Append Notes Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// ignore
		}
	});

	it("appends to existing Implementation Notes with single blank line separation", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-1",
				title: "Existing notes",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				rawContent: "Test description\n\n## Implementation Notes\n\nOriginal notes",
			},
			false,
		);

		// Append twice in one call and once again afterwards
		let res = await $`bun ${CLI_PATH} task edit 1 --append-notes "First addition" --append-notes "Second addition"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		res = await $`bun ${CLI_PATH} task edit 1 --append-notes "Third addition"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		const updated = await core.filesystem.loadTask("task-1");
		expect(updated).not.toBeNull();

		const body = extractStructuredSection(updated?.rawContent || "", "implementationNotes") || "";
		expect(body).toBe("Original notes\n\nFirst addition\n\nSecond addition\n\nThird addition");
	});

	it("creates Implementation Notes at correct position when missing (after Plan)", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask(
			{
				id: "task-2",
				title: "No notes yet",
				status: "To Do",
				assignee: [],
				createdDate: "2025-09-10 00:00",
				labels: [],
				dependencies: [],
				rawContent:
					"## Description\n\nDesc here\n\n## Acceptance Criteria\n\n- [ ] Do X\n\n## Implementation Plan\n\n1. A\n2. B",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 2 --append-notes "Notes after plan"`.cwd(TEST_DIR).quiet().nothrow();
		expect(res.exitCode).toBe(0);

		const updated = await core.filesystem.loadTask("task-2");
		const content = updated?.rawContent || "";
		const notesContent = extractStructuredSection(content, "implementationNotes") || "";
		expect(notesContent).toBe("Notes after plan");
		const planMarker = "<!-- SECTION:PLAN:BEGIN -->";
		const notesMarker = "<!-- SECTION:NOTES:BEGIN -->";
		expect(content.indexOf(planMarker)).toBeGreaterThan(-1);
		expect(content.indexOf(notesMarker)).toBeGreaterThan(content.indexOf(planMarker));
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
				rawContent: "Simple description",
			},
			false,
		);

		// Pass a JS string containing real newlines as an argument
		const multiline = "Line1\nLine2\n\nPara2";
		const res = await $`bun ${[CLI_PATH, "task", "edit", "3", "--append-notes", multiline]}`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();
		expect(res.exitCode).toBe(0);

		const updated = await core.filesystem.loadTask("task-3");
		const body = extractStructuredSection(updated?.rawContent || "", "implementationNotes") || "";
		expect(body).toContain("Line1\nLine2\n\nPara2");
	});

	it("rejects mixing --notes (replace) with --append-notes (append)", async () => {
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
				rawContent: "Description only",
			},
			false,
		);

		const res = await $`bun ${CLI_PATH} task edit 4 --notes "Replace" --append-notes "Append"`
			.cwd(TEST_DIR)
			.quiet()
			.nothrow();

		expect(res.exitCode).not.toBe(0);
		expect(res.stderr.toString()).toContain("Cannot use --notes (replace) together with --append-notes (append)");
	});
});
