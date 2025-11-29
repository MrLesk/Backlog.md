import { afterEach, beforeEach, describe, expect, it, test } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { AcceptanceCriteriaManager } from "../markdown/structured-sections.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Acceptance Criteria CLI", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-acceptance-criteria");
		const core = new Core(TEST_DIR);
		await core.initializeProject("AC Test Project");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("task create with acceptance criteria", () => {
		it("should create task with single acceptance criterion using -ac", async () => {
			const result = await $`bun ${CLI_PATH} task create "Test Task" --ac "Must work correctly"`.cwd(TEST_DIR).quiet();
			if (result.exitCode !== 0) {
				console.error("STDOUT:", result.stdout.toString());
				console.error("STDERR:", result.stderr.toString());
			}
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 Must work correctly");
		});

		it("should create task with multiple criteria using multiple --ac flags", async () => {
			const result =
				await $`bun ${CLI_PATH} task create "Test Task" --ac "Criterion 1" --ac "Criterion 2" --ac "Criterion 3"`
					.cwd(TEST_DIR)
					.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("- [ ] #1 Criterion 1");
			expect(task?.rawContent).toContain("- [ ] #2 Criterion 2");
			expect(task?.rawContent).toContain("- [ ] #3 Criterion 3");
		});

		it("should treat comma-separated text as single criterion", async () => {
			const result = await $`bun ${CLI_PATH} task create "Test Task" --ac "Criterion 1, Criterion 2, Criterion 3"`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			// Should create single criterion with commas intact
			expect(task?.rawContent).toContain("- [ ] #1 Criterion 1, Criterion 2, Criterion 3");
			// Should NOT create multiple criteria
			expect(task?.rawContent).not.toContain("- [ ] #2");
		});

		it("should create task with criteria using --acceptance-criteria", async () => {
			const result = await $`bun ${CLI_PATH} task create "Test Task" --acceptance-criteria "Full flag test"`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 Full flag test");
		});

		it("should create task with both description and acceptance criteria", async () => {
			const result =
				await $`bun ${CLI_PATH} task create "Test Task" -d "Task description" --ac "Must pass tests" --ac "Must be documented"`
					.cwd(TEST_DIR)
					.quiet();
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

		it("should add acceptance criteria to existing task", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --ac "New criterion 1" --ac "New criterion 2"`
				.cwd(TEST_DIR)
				.quiet();
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

		it("consolidates duplicate Acceptance Criteria sections with markers into one", async () => {
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

			// Add a new criterion via CLI; this triggers consolidation
			const result = await $`bun ${CLI_PATH} task edit 9 --ac "New C"`.cwd(TEST_DIR).quiet();
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

		it("consolidates legacy and marked AC sections to a single marked section", async () => {
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

			const result = await $`bun ${CLI_PATH} task edit 10 --ac "Marked 2"`.cwd(TEST_DIR).quiet();
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

		it("should add to existing acceptance criteria", async () => {
			// First add some criteria via CLI to avoid direct body mutation
			const res = await $`bun ${CLI_PATH} task edit 1 --ac "Old criterion 1" --ac "Old criterion 2"`
				.cwd(TEST_DIR)
				.quiet();
			expect(res.exitCode).toBe(0);

			// Now add new criterion
			const result = await $`bun ${CLI_PATH} task edit 1 --ac "New criterion"`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.rawContent).toContain("## Acceptance Criteria");
			expect(task?.rawContent).toContain("- [ ] #1 Old criterion 1");
			expect(task?.rawContent).toContain("- [ ] #2 Old criterion 2");
			expect(task?.rawContent).toContain("- [ ] #3 New criterion");
		});

		it("should update title and add acceptance criteria together", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 -t "Updated Title" --ac "Must be updated" --ac "Must work"`
				.cwd(TEST_DIR)
				.quiet();
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
		it("should handle empty criteria gracefully", async () => {
			// Skip the --ac flag entirely when empty, as the shell API doesn't handle empty strings the same way
			const result = await $`bun ${CLI_PATH} task create "Test Task"`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			// Should not add acceptance criteria section for empty input
			expect(task?.rawContent).not.toContain("## Acceptance Criteria");
		});

		it("should trim whitespace from criteria", async () => {
			const result =
				await $`bun ${CLI_PATH} task create "Test Task" --ac "  Criterion with spaces  " --ac "  Another one  "`
					.cwd(TEST_DIR)
					.quiet();
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

		it("should add new acceptance criteria with --ac", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --ac "Fourth criterion" --ac "Fifth criterion"`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [ ] #1 First criterion");
			expect(task?.rawContent).toContain("- [ ] #2 Second criterion");
			expect(task?.rawContent).toContain("- [ ] #3 Third criterion");
			expect(task?.rawContent).toContain("- [ ] #4 Fourth criterion");
			expect(task?.rawContent).toContain("- [ ] #5 Fifth criterion");
		});

		it("should remove acceptance criterion by index with --remove-ac", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac 2`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [ ] #1 First criterion");
			expect(task?.rawContent).not.toContain("Second criterion");
			expect(task?.rawContent).toContain("- [ ] #2 Third criterion"); // Renumbered
		});

		it("removes acceptance criteria section after deleting all items", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac 1 --remove-ac 2 --remove-ac 3`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			const body = task?.rawContent || "";
			expect(body).not.toContain("## Acceptance Criteria");
			expect(body).not.toContain("<!-- AC:BEGIN -->");
			expect(body).not.toContain("<!-- AC:END -->");
		});

		it("should check acceptance criterion by index with --check-ac", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --check-ac 2`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [ ] #1 First criterion");
			expect(task?.rawContent).toContain("- [x] #2 Second criterion");
			expect(task?.rawContent).toContain("- [ ] #3 Third criterion");
		});

		it("should uncheck acceptance criterion by index with --uncheck-ac", async () => {
			// First check a criterion
			await $`bun ${CLI_PATH} task edit 1 --check-ac 1`.cwd(TEST_DIR).quiet();

			// Then uncheck it
			const result = await $`bun ${CLI_PATH} task edit 1 --uncheck-ac 1`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [ ] #1 First criterion");
		});

		it("should handle multiple operations in one command", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --check-ac 1 --remove-ac 2 --ac "New criterion"`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.rawContent).toContain("- [x] #1 First criterion");
			expect(task?.rawContent).not.toContain("Second criterion");
			expect(task?.rawContent).toContain("- [ ] #2 Third criterion"); // Renumbered
			expect(task?.rawContent).toContain("- [ ] #3 New criterion");
		});

		it("should error on invalid index for --remove-ac", async () => {
			try {
				await $`bun ${CLI_PATH} task edit 1 --remove-ac 10`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: unknown) {
				const e = error as { exitCode?: number; stderr?: unknown };
				expect(e.exitCode).not.toBe(0);
				const msg = e.stderr == null ? "" : String(e.stderr);
				expect(msg).toContain("Acceptance criterion #10 not found");
			}
		});

		it("should error on invalid index for --check-ac", async () => {
			try {
				await $`bun ${CLI_PATH} task edit 1 --check-ac 10`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: unknown) {
				const e = error as { exitCode?: number; stderr?: unknown };
				expect(e.exitCode).not.toBe(0);
				const msg = e.stderr == null ? "" : String(e.stderr);
				expect(msg).toContain("Acceptance criterion #10 not found");
			}
		});

		it("should error on non-numeric index", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac abc`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("Invalid index");
		});

		it("should error on zero index", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac 0`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("Invalid index");
		});

		it("should error on negative index", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac=-1`.cwd(TEST_DIR).quiet().nothrow();
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr.toString()).toContain("Invalid index");
		});
	});

	describe("stable format migration", () => {
		it("should convert old format to stable format when editing", async () => {
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

			const result = await $`bun ${CLI_PATH} task edit 2 --ac "New criterion"`.cwd(TEST_DIR).quiet();
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
		TEST_DIR_UNIT = await createTestDir("test-acceptance-criteria-unit");
		const core = new Core(TEST_DIR_UNIT);
		await core.initializeProject("AC Unit Test Project");
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
		it("should support multiple --ac flags in task create", async () => {
			const result =
				await $`bun run ${CLI_PATH_UNIT} task create "Multi AC Test" --ac "First" --ac "Second" --ac "Third"`.cwd(
					TEST_DIR_UNIT,
				);
			expect(result.exitCode).toBe(0);

			// Parse task ID from output
			const taskId = result.stdout.toString().match(/Created task (task-\d+)/)?.[1];
			expect(taskId).toBeTruthy();

			// Verify ACs were created
			const taskResult = await $`bun run ${CLI_PATH_UNIT} task ${taskId} --plain`.cwd(TEST_DIR_UNIT);
			expect(taskResult.stdout.toString()).toContain("- [ ] #1 First");
			expect(taskResult.stdout.toString()).toContain("- [ ] #2 Second");
			expect(taskResult.stdout.toString()).toContain("- [ ] #3 Third");
		});

		it("should support multiple --check-ac flags in single command", async () => {
			// Create task with multiple ACs
			const createResult =
				await $`bun run ${CLI_PATH_UNIT} task create "Check Test" --ac "First" --ac "Second" --ac "Third" --ac "Fourth"`.cwd(
					TEST_DIR_UNIT,
				);
			const taskId = createResult.stdout.toString().match(/Created task (task-\d+)/)?.[1];

			// Check multiple ACs at once
			const checkResult = await $`bun run ${CLI_PATH_UNIT} task edit ${taskId} --check-ac 1 --check-ac 3`.cwd(
				TEST_DIR_UNIT,
			);
			expect(checkResult.exitCode).toBe(0);

			// Verify correct ACs were checked
			const taskResult = await $`bun run ${CLI_PATH_UNIT} task ${taskId} --plain`.cwd(TEST_DIR_UNIT);
			expect(taskResult.stdout.toString()).toContain("- [x] #1 First");
			expect(taskResult.stdout.toString()).toContain("- [ ] #2 Second");
			expect(taskResult.stdout.toString()).toContain("- [x] #3 Third");
			expect(taskResult.stdout.toString()).toContain("- [ ] #4 Fourth");
		});

		it("should support mixed AC operations in single command", async () => {
			// Create task with multiple ACs
			const createResult =
				await $`bun run ${CLI_PATH_UNIT} task create "Mixed Test" --ac "First" --ac "Second" --ac "Third" --ac "Fourth"`.cwd(
					TEST_DIR_UNIT,
				);
			const taskId = createResult.stdout.toString().match(/Created task (task-\d+)/)?.[1];

			// Check some ACs first
			await $`bun run ${CLI_PATH_UNIT} task edit ${taskId} --check-ac 1 --check-ac 2 --check-ac 3`.cwd(TEST_DIR_UNIT);

			// Now do mixed operations: uncheck 1, keep 2 checked, check 4
			const mixedResult = await $`bun run ${CLI_PATH_UNIT} task edit ${taskId} --uncheck-ac 1 --check-ac 4`.cwd(
				TEST_DIR_UNIT,
			);
			expect(mixedResult.exitCode).toBe(0);

			// Verify final state
			const taskResult = await $`bun run ${CLI_PATH_UNIT} task ${taskId} --plain`.cwd(TEST_DIR_UNIT);
			expect(taskResult.stdout.toString()).toContain("- [ ] #1 First"); // unchecked
			expect(taskResult.stdout.toString()).toContain("- [x] #2 Second"); // remained checked
			expect(taskResult.stdout.toString()).toContain("- [x] #3 Third"); // remained checked
			expect(taskResult.stdout.toString()).toContain("- [x] #4 Fourth"); // newly checked
		});

		it("should support multiple --remove-ac flags with proper renumbering", async () => {
			// Create task with 5 ACs
			const createResult =
				await $`bun run ${CLI_PATH_UNIT} task create "Remove Test" --ac "First" --ac "Second" --ac "Third" --ac "Fourth" --ac "Fifth"`.cwd(
					TEST_DIR_UNIT,
				);
			const taskId = createResult.stdout.toString().match(/Created task (task-\d+)/)?.[1];

			// Remove ACs 2 and 4 (should be processed in descending order to avoid index shifting)
			const removeResult = await $`bun run ${CLI_PATH_UNIT} task edit ${taskId} --remove-ac 2 --remove-ac 4`.cwd(
				TEST_DIR_UNIT,
			);
			expect(removeResult.exitCode).toBe(0);

			// Verify remaining ACs are properly renumbered
			const taskResult = await $`bun run ${CLI_PATH_UNIT} task ${taskId} --plain`.cwd(TEST_DIR_UNIT);
			expect(taskResult.stdout.toString()).toContain("- [ ] #1 First"); // original #1
			expect(taskResult.stdout.toString()).toContain("- [ ] #2 Third"); // original #3 -> #2
			expect(taskResult.stdout.toString()).toContain("- [ ] #3 Fifth"); // original #5 -> #3
			expect(taskResult.stdout.toString()).not.toContain("Second"); // removed
			expect(taskResult.stdout.toString()).not.toContain("Fourth"); // removed
		});

		it("should handle invalid indices gracefully in multi-value operations", async () => {
			// Create task with 2 ACs
			const createResult = await $`bun run ${CLI_PATH_UNIT} task create "Invalid Test" --ac "First" --ac "Second"`.cwd(
				TEST_DIR_UNIT,
			);
			const taskId = createResult.stdout.toString().match(/Created task (task-\d+)/)?.[1];

			// Try to check valid and invalid indices
			const checkResult = await $`bun run ${CLI_PATH_UNIT} task edit ${taskId} --check-ac 1 --check-ac 5`
				.cwd(TEST_DIR_UNIT)
				.nothrow();
			expect(checkResult.exitCode).toBe(1);
			expect(checkResult.stderr.toString()).toContain("Acceptance criterion #5 not found");
		});
	});
});
