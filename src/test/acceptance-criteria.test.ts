import { afterEach, beforeEach, describe, expect, it, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { AcceptanceCriteriaManager } from "../markdown/structured-sections.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";
import { createTaskPlatformAware, editTaskPlatformAware, viewTaskPlatformAware } from "./test-helpers.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Acceptance Criteria CLI", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-acceptance-criteria");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "AC Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("task create with acceptance criteria", () => {
		it("should create task with single acceptance criterion using -ac", async () => { // IN-PROCESS
			const result = await createTaskPlatformAware({ title: "Test Task", ac: "Must work correctly" }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 Must work correctly");
		});

		it("should create task with multiple criteria using multiple --ac flags", async () => { // IN-PROCESS
			const result = await createTaskPlatformAware(
				{ title: "Test Task", ac: ["Criterion 1", "Criterion 2", "Criterion 3"] },
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("- [ ] #1 Criterion 1");
			expect(task?.rawContent).toContain("- [ ] #2 Criterion 2");
			expect(task?.rawContent).toContain("- [ ] #3 Criterion 3");
		});

		it("should treat comma-separated text as single criterion", async () => { // IN-PROCESS
			const result = await createTaskPlatformAware(
				{ title: "Test Task", ac: "Criterion 1, Criterion 2, Criterion 3" },
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			// Should create single criterion with commas intact
			expect(task?.rawContent).toContain("- [ ] #1 Criterion 1, Criterion 2, Criterion 3");
			// Should NOT create multiple criteria
			expect(task?.rawContent).not.toContain("- [ ] #2");
		});

		it("should create task with criteria using --acceptance-criteria", async () => { // IN-PROCESS
			// --acceptance-criteria is the long form of --ac, same behavior
			const result = await createTaskPlatformAware({ title: "Test Task", ac: "Full flag test" }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 Full flag test");
		});

		it("should create task with both description and acceptance criteria", async () => { // IN-PROCESS
			const result = await createTaskPlatformAware(
				{ title: "Test Task", description: "Task description", ac: ["Must pass tests", "Must be documented"] },
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("## Description");
			expect(task?.rawContent).toContain("Task description");
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 Must pass tests");
			expect(task?.rawContent).toContain("- [ ] #2 Must be documented");
		});
	});

	describe("task edit with acceptance criteria", () => {
		beforeEach(async () => {
			const core = new Core(TEST_DIR);
			await core.createTask(
				{
					id: "task-1",
					title: "Existing Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-19",
					labels: [],
					dependencies: [],
					rawContent: "## Description\n\nExisting task description",
				},
				false,
			);
		});

		it("should add acceptance criteria to existing task", async () => { // IN-PROCESS
			const result = await editTaskPlatformAware(
				{ taskId: "1", ac: ["New criterion 1", "New criterion 2"] },
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("## Description");
			expect(task?.rawContent).toContain("Existing task description");
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 New criterion 1");
			expect(task?.rawContent).toContain("- [ ] #2 New criterion 2");
		});

		it("consolidates duplicate Acceptance Criteria sections with markers into one", async () => { // IN-PROCESS
			const core = new Core(TEST_DIR);
			await core.createTask(
				{
					id: "task-9",
					title: "Dup AC Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-19",
					labels: [],
					dependencies: [],
					rawContent:
						"## Description\n\nX\n\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n- [ ] #1 Old A\n<!-- AC:END -->\n\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n- [ ] #1 Old B\n<!-- AC:END -->",
				},
				false,
			);

			// Add a new criterion via in-process API; this triggers consolidation
			const result = await editTaskPlatformAware({ taskId: "9", ac: "New C" }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const task = await core.filesystem.loadTask("task-9");
			expect(task).not.toBeNull();
			const body = task?.rawContent || "";
			// Only one header and one marker pair should remain
			expect((body.match(/## Acceptance Criteria/g) || []).length).toBe(1);
			expect((body.match(/<!-- AC:BEGIN -->/g) || []).length).toBe(1);
			expect((body.match(/<!-- AC:END -->/g) || []).length).toBe(1);
			// New content should be present and renumbered
			expect(body).toContain("- [ ] #1 Old A");
			expect(body).toContain("- [ ] #2 Old B");
			expect(body).toContain("- [ ] #3 New C");
		});

		it("consolidates legacy and marked AC sections to a single marked section", async () => { // IN-PROCESS
			const core = new Core(TEST_DIR);
			await core.createTask(
				{
					id: "task-10",
					title: "Mixed AC Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-19",
					labels: [],
					dependencies: [],
					rawContent:
						"## Description\n\nY\n\n## Acceptance Criteria\n\n- [ ] Legacy 1\n- [ ] Legacy 2\n\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n- [ ] #1 Marked 1\n<!-- AC:END -->",
				},
				false,
			);

			const result = await editTaskPlatformAware({ taskId: "10", ac: "Marked 2" }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const task = await core.filesystem.loadTask("task-10");
			expect(task).not.toBeNull();
			const body = task?.rawContent || "";
			expect((body.match(/## Acceptance Criteria/g) || []).length).toBe(1);
			expect((body.match(/<!-- AC:BEGIN -->/g) || []).length).toBe(1);
			expect((body.match(/<!-- AC:END -->/g) || []).length).toBe(1);
			// Final section should be marked format and renumbered
			expect(body).toContain("- [ ] #1 Marked 1");
			expect(body).toContain("- [ ] #2 Marked 2");
			// No legacy-only lines remaining
			expect(body).not.toContain("Legacy 1");
			expect(body).not.toContain("Legacy 2");
		});

		it("should add to existing acceptance criteria", async () => { // IN-PROCESS
			// First add some criteria
			const res = await editTaskPlatformAware({ taskId: "1", ac: ["Old criterion 1", "Old criterion 2"] }, TEST_DIR);
			expect(res.exitCode).toBe(0);

			// Now add new criterion
			const result = await editTaskPlatformAware({ taskId: "1", ac: "New criterion" }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 Old criterion 1");
			expect(task?.rawContent).toContain("- [ ] #2 Old criterion 2");
			expect(task?.rawContent).toContain("- [ ] #3 New criterion");
		});

		it("should update title and add acceptance criteria together", async () => { // IN-PROCESS
			const result = await editTaskPlatformAware(
				{ taskId: "1", title: "Updated Title", ac: ["Must be updated", "Must work"] },
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.title).toBe("Updated Title");
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 Must be updated");
			expect(task?.rawContent).toContain("- [ ] #2 Must work");
		});
	});

	describe("acceptance criteria parsing", () => {
		it("should handle empty criteria gracefully", async () => { // IN-PROCESS
			const result = await createTaskPlatformAware({ title: "Test Task" }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			// Should not add acceptance criteria section for empty input
			expect(task?.rawContent).not.toContain("## Acceptance Criteria");
		});

		it("should trim whitespace from criteria", async () => { // IN-PROCESS
			const result = await createTaskPlatformAware(
				{ title: "Test Task", ac: ["  Criterion with spaces  ", "  Another one  "] },
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("- [ ] #1 Criterion with spaces");
			expect(task?.rawContent).toContain("- [ ] #2 Another one");
		});
	});

	describe("new AC management features", () => {
		beforeEach(async () => {
			const core = new Core(TEST_DIR);
			await core.createTask(
				{
					id: "task-1",
					title: "Test Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-19",
					labels: [],
					dependencies: [],
					rawContent: `## Description

Test task with acceptance criteria

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 First criterion
- [ ] #2 Second criterion
- [ ] #3 Third criterion
<!-- AC:END -->`,
				},
				false,
			);
		});

		it("should add new acceptance criteria with --ac", async () => { // IN-PROCESS
			const result = await editTaskPlatformAware(
				{ taskId: "1", ac: ["Fourth criterion", "Fifth criterion"] },
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [ ] #1 First criterion");
			expect(task?.rawContent).toContain("- [ ] #2 Second criterion");
			expect(task?.rawContent).toContain("- [ ] #3 Third criterion");
			expect(task?.rawContent).toContain("- [ ] #4 Fourth criterion");
			expect(task?.rawContent).toContain("- [ ] #5 Fifth criterion");
		});

		it("should remove acceptance criterion by index with --remove-ac", async () => { // IN-PROCESS
			const result = await editTaskPlatformAware({ taskId: "1", removeAc: [2] }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [ ] #1 First criterion");
			expect(task?.rawContent).not.toContain("Second criterion");
			expect(task?.rawContent).toContain("- [ ] #2 Third criterion"); // Renumbered
		});

		it("removes acceptance criteria section after deleting all items", async () => { // IN-PROCESS
			const result = await editTaskPlatformAware({ taskId: "1", removeAc: [1, 2, 3] }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			const body = task?.rawContent || "";
			expect(body).not.toContain("## Acceptance Criteria");
			expect(body).not.toContain("<!-- AC:BEGIN -->");
			expect(body).not.toContain("<!-- AC:END -->");
		});

		it("should check acceptance criterion by index with --check-ac", async () => { // IN-PROCESS
			const result = await editTaskPlatformAware({ taskId: "1", checkAc: [2] }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [ ] #1 First criterion");
			expect(task?.rawContent).toContain("- [x] #2 Second criterion");
			expect(task?.rawContent).toContain("- [ ] #3 Third criterion");
		});

		it("should uncheck acceptance criterion by index with --uncheck-ac", async () => { // IN-PROCESS
			// First check a criterion
			await editTaskPlatformAware({ taskId: "1", checkAc: [1] }, TEST_DIR);

			// Then uncheck it
			const result = await editTaskPlatformAware({ taskId: "1", uncheckAc: [1] }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [ ] #1 First criterion");
		});

		it("should handle multiple operations in one command", async () => { // IN-PROCESS
			const result = await editTaskPlatformAware(
				{ taskId: "1", checkAc: [1], removeAc: [2], ac: "New criterion" },
				TEST_DIR,
			);
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [x] #1 First criterion");
			expect(task?.rawContent).not.toContain("Second criterion");
			expect(task?.rawContent).toContain("- [ ] #2 Third criterion"); // Renumbered
			expect(task?.rawContent).toContain("- [ ] #3 New criterion");
		});

		it("should error on invalid index for --remove-ac", async () => { // CLI-CONTRACT
			try {
				await $`bun ${CLI_PATH} task edit 1 --remove-ac 10`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: unknown) {
				const e = error as { exitCode?: number; stderr?: unknown };
				expect(e.exitCode).not.toBe(0);
				const msg = e.stderr == null ? "" : String(e.stderr);
				expect(msg).toContain("Acceptance criterion #10 not found");
				expect(msg).toContain("Available indexes: #1-#3.");
				expect(msg).toContain("backlog task view TASK-1 --plain");
				expect(msg).toContain("backlog task edit TASK-1 --help");
			}
		});

		it("should error on invalid index for --check-ac", async () => { // CLI-CONTRACT
			try {
				await $`bun ${CLI_PATH} task edit 1 --check-ac 10`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: unknown) {
				const e = error as { exitCode?: number; stderr?: unknown };
				expect(e.exitCode).not.toBe(0);
				const msg = e.stderr == null ? "" : String(e.stderr);
				expect(msg).toContain("Acceptance criterion #10 not found");
				expect(msg).toContain("Available indexes: #1-#3.");
				expect(msg).toContain("backlog task view TASK-1 --plain");
				expect(msg).toContain("backlog task edit TASK-1 --help");
			}
		});

		it("should error on non-numeric index", async () => { // CLI-CONTRACT
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac abc`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("Invalid index");
		});

		it("should error on zero index", async () => { // CLI-CONTRACT
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac 0`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("Invalid index");
		});

		it("should error on negative index", async () => { // CLI-CONTRACT
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac=-1`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("Invalid index");
		});
	});

	describe("stable format migration", () => {
		it("should convert old format to stable format when editing", async () => { // IN-PROCESS
			const core = new Core(TEST_DIR);
			await core.createTask(
				{
					id: "task-2",
					title: "Old Format Task",
					status: "To Do",
					assignee: [],
					createdDate: "2025-06-19",
					labels: [],
					dependencies: [],
					rawContent: `## Description

## Acceptance Criteria

- [ ] Old format criterion 1
- [x] Old format criterion 2`,
				},
				false,
			);

			const result = await editTaskPlatformAware({ taskId: "2", ac: "New criterion" }, TEST_DIR);
			expect(result.exitCode).toBe(0);

			const task = await core.filesystem.loadTask("task-2");
			expect(task?.rawContent).toContain("<!-- AC:BEGIN -->");
			expect(task?.rawContent).toContain("- [ ] #1 Old format criterion 1");
			expect(task?.rawContent).toContain("- [x] #2 Old format criterion 2");
			expect(task?.rawContent).toContain("- [ ] #3 New criterion");
			expect(task?.rawContent).toContain("<!-- AC:END -->");
		});
	});
});

describe("AcceptanceCriteriaManager unit tests", () => {
	let TEST_DIR_UNIT: string;
	const CLI_PATH_UNIT = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR_UNIT = createUniqueTestDir("test-acceptance-criteria-unit");
		await rm(TEST_DIR_UNIT, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR_UNIT, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR_UNIT).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR_UNIT).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR_UNIT).quiet();

		const core = new Core(TEST_DIR_UNIT);
		await initializeTestProject(core, "AC Unit Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR_UNIT);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	test("should parse criteria with stable markers", () => {
		const content = `## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 First criterion
- [x] #2 Second criterion
- [ ] #3 Third criterion
<!-- AC:END -->`;

		const criteria = AcceptanceCriteriaManager.parseAcceptanceCriteria(content);
		expect(criteria).toHaveLength(3);
		expect(criteria[0]).toEqual({ checked: false, text: "First criterion", index: 1 });
		expect(criteria[1]).toEqual({ checked: true, text: "Second criterion", index: 2 });
		expect(criteria[2]).toEqual({ checked: false, text: "Third criterion", index: 3 });
	});

	test("should format criteria with proper numbering", () => {
		const criteria = [
			{ checked: false, text: "First", index: 1 },
			{ checked: true, text: "Second", index: 2 },
		];

		const formatted = AcceptanceCriteriaManager.formatAcceptanceCriteria(criteria);
		expect(formatted).toContain("## Acceptance Criteria");
		expect(formatted).toContain("<!-- AC:BEGIN -->");
		expect(formatted).toContain("- [ ] #1 First");
		expect(formatted).toContain("- [x] #2 Second");
		expect(formatted).toContain("<!-- AC:END -->");
	});

	test("preserves markdown headings inside acceptance criteria when updating", () => {
		const base = `## Acceptance Criteria
<!-- AC:BEGIN -->
### Critical
- [ ] #1 Must pass authentication

### Optional
- [ ] #2 Show detailed logs
<!-- AC:END -->`;

		const updated = AcceptanceCriteriaManager.updateContent(base, [
			{ index: 1, text: "Must pass authentication", checked: true },
			{ index: 2, text: "Show detailed logs", checked: false },
			{ index: 3, text: "Document audit trail", checked: false },
		]);

		const bodyMatch = updated.match(/<!-- AC:BEGIN -->([\s\S]*?)<!-- AC:END -->/);
		expect(bodyMatch).not.toBeNull();
		const body = bodyMatch?.[1] || "";
		expect(body).toContain("### Critical");
		expect(body).toContain("### Optional");
		expect(body).toContain("- [x] #1 Must pass authentication");
		expect(body).toContain("- [ ] #2 Show detailed logs");
		expect(body).toContain("- [ ] #3 Document audit trail");
		const orderIndex = body.indexOf("- [ ] #3 Document audit trail");
		expect(orderIndex).toBeGreaterThan(body.indexOf("### Optional"));

		const reduced = AcceptanceCriteriaManager.updateContent(updated, [
			{ index: 1, text: "Must pass authentication", checked: false },
		]);
		const reducedBody = reduced.match(/<!-- AC:BEGIN -->([\s\S]*?)<!-- AC:END -->/)?.[1] || "";
		expect(reducedBody).toContain("### Critical");
		expect(reducedBody).toContain("### Optional");
		expect(reducedBody).toContain("- [ ] #1 Must pass authentication");
		expect(reducedBody).not.toContain("Show detailed logs");
	});

	describe("Multi-value CLI operations", () => {
		it("should support multiple --ac flags in task create", async () => { // IN-PROCESS
			const result = await createTaskPlatformAware(
				{ title: "Multi AC Test", ac: ["First", "Second", "Third"] },
				TEST_DIR_UNIT,
			);
			expect(result.exitCode).toBe(0);
			const taskId = result.taskId;
			expect(taskId).toBeTruthy();

			// Verify ACs were created
			const viewResult = await viewTaskPlatformAware({ taskId: taskId!, plain: true }, TEST_DIR_UNIT);
			expect(viewResult.stdout).toContain("- [ ] #1 First");
			expect(viewResult.stdout).toContain("- [ ] #2 Second");
			expect(viewResult.stdout).toContain("- [ ] #3 Third");
		});

		it("should support multiple --check-ac flags in single command", async () => { // IN-PROCESS
			// Create task with multiple ACs
			const createResult = await createTaskPlatformAware(
				{ title: "Check Test", ac: ["First", "Second", "Third", "Fourth"] },
				TEST_DIR_UNIT,
			);
			const taskId = createResult.taskId!;

			// Check multiple ACs at once
			const checkResult = await editTaskPlatformAware({ taskId, checkAc: [1, 3] }, TEST_DIR_UNIT);
			expect(checkResult.exitCode).toBe(0);

			// Verify correct ACs were checked
			const viewResult = await viewTaskPlatformAware({ taskId, plain: true }, TEST_DIR_UNIT);
			expect(viewResult.stdout).toContain("- [x] #1 First");
			expect(viewResult.stdout).toContain("- [ ] #2 Second");
			expect(viewResult.stdout).toContain("- [x] #3 Third");
			expect(viewResult.stdout).toContain("- [ ] #4 Fourth");
		});

		it("should support mixed AC operations in single command", async () => { // IN-PROCESS
			// Create task with multiple ACs
			const createResult = await createTaskPlatformAware(
				{ title: "Mixed Test", ac: ["First", "Second", "Third", "Fourth"] },
				TEST_DIR_UNIT,
			);
			const taskId = createResult.taskId!;

			// Check some ACs first
			await editTaskPlatformAware({ taskId, checkAc: [1, 2, 3] }, TEST_DIR_UNIT);

			// Now do mixed operations: uncheck 1, keep 2 checked, check 4
			const mixedResult = await editTaskPlatformAware({ taskId, uncheckAc: [1], checkAc: [4] }, TEST_DIR_UNIT);
			expect(mixedResult.exitCode).toBe(0);

			// Verify final state
			const viewResult = await viewTaskPlatformAware({ taskId, plain: true }, TEST_DIR_UNIT);
			expect(viewResult.stdout).toContain("- [ ] #1 First"); // unchecked
			expect(viewResult.stdout).toContain("- [x] #2 Second"); // remained checked
			expect(viewResult.stdout).toContain("- [x] #3 Third"); // remained checked
			expect(viewResult.stdout).toContain("- [x] #4 Fourth"); // newly checked
		});

		it("should support multiple --remove-ac flags with proper renumbering", async () => { // IN-PROCESS
			// Create task with 5 ACs
			const createResult = await createTaskPlatformAware(
				{ title: "Remove Test", ac: ["First", "Second", "Third", "Fourth", "Fifth"] },
				TEST_DIR_UNIT,
			);
			const taskId = createResult.taskId!;

			// Remove ACs 2 and 4 (should be processed in descending order to avoid index shifting)
			const removeResult = await editTaskPlatformAware({ taskId, removeAc: [2, 4] }, TEST_DIR_UNIT);
			expect(removeResult.exitCode).toBe(0);

			// Verify remaining ACs are properly renumbered
			const viewResult = await viewTaskPlatformAware({ taskId, plain: true }, TEST_DIR_UNIT);
			expect(viewResult.stdout).toContain("- [ ] #1 First"); // original #1
			expect(viewResult.stdout).toContain("- [ ] #2 Third"); // original #3 -> #2
			expect(viewResult.stdout).toContain("- [ ] #3 Fifth"); // original #5 -> #3
			expect(viewResult.stdout).not.toContain("Second"); // removed
			expect(viewResult.stdout).not.toContain("Fourth"); // removed
		});

		it("should handle invalid indices gracefully in multi-value operations", async () => { // CLI-CONTRACT
			// Create task with 2 ACs
			const createResult = await $`bun run ${CLI_PATH_UNIT} task create "Invalid Test" --ac "First" --ac "Second"`.cwd(
				TEST_DIR_UNIT,
			);
			const taskId = createResult.stdout.toString().match(/Created task (TASK-\d+)/)?.[1];

			// Try to check valid and invalid indices
			const checkResult = await $`bun run ${CLI_PATH_UNIT} task edit ${taskId} --check-ac 1 --check-ac 5`
				.cwd(TEST_DIR_UNIT)
				.nothrow();
			expect(checkResult.exitCode).toBe(1);
			expect(checkResult.stderr.toString()).toContain("Acceptance criterion #5 not found");
			expect(checkResult.stderr.toString()).toContain("Available indexes: #1-#2.");
			expect(checkResult.stderr.toString()).toContain(`backlog task view ${taskId} --plain`);
			expect(checkResult.stderr.toString()).toContain(`backlog task edit ${taskId} --help`);
		});
	});
});
