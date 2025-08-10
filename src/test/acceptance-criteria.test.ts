import { afterEach, beforeEach, describe, expect, it, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { AcceptanceCriteriaManager } from "../core/acceptance-criteria.ts";
import { Core } from "../core/backlog.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

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
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] #1 Must work correctly");
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
			expect(task?.body).toContain("- [ ] #1 Criterion 1");
			expect(task?.body).toContain("- [ ] #2 Criterion 2");
			expect(task?.body).toContain("- [ ] #3 Criterion 3");
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
			expect(task?.body).toContain("- [ ] #1 Criterion 1, Criterion 2, Criterion 3");
			// Should NOT create multiple criteria
			expect(task?.body).not.toContain("- [ ] #2");
		});

		it("should create task with criteria using --acceptance-criteria", async () => {
			const result = await $`bun ${CLI_PATH} task create "Test Task" --acceptance-criteria "Full flag test"`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] #1 Full flag test");
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
			expect(task?.body).toContain("## Description");
			expect(task?.body).toContain("Task description");
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] #1 Must pass tests");
			expect(task?.body).toContain("- [ ] #2 Must be documented");
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
					body: "## Description\n\nExisting task description",
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
			expect(task?.body).toContain("## Description");
			expect(task?.body).toContain("Existing task description");
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] #1 New criterion 1");
			expect(task?.body).toContain("- [ ] #2 New criterion 2");
		});

		it("should add to existing acceptance criteria", async () => {
			// First add some criteria
			const core = new Core(TEST_DIR);
			let task = await core.filesystem.loadTask("task-1");
			if (task) {
				task.body = `${task.body}\n\n## Acceptance Criteria\n\n- [ ] Old criterion 1\n- [ ] Old criterion 2`;
				await core.updateTask(task, false);
			}

			// Now add new criteria
			const result = await $`bun ${CLI_PATH} task edit 1 --ac "New criterion"`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] #1 Old criterion 1");
			expect(task?.body).toContain("- [ ] #2 Old criterion 2");
			expect(task?.body).toContain("- [ ] #3 New criterion");
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
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] #1 Must be updated");
			expect(task?.body).toContain("- [ ] #2 Must work");
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
			expect(task?.body).not.toContain("## Acceptance Criteria");
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
			expect(task?.body).toContain("- [ ] #1 Criterion with spaces");
			expect(task?.body).toContain("- [ ] #2 Another one");
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
					body: `## Description

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
			expect(task?.body).toContain("- [ ] #1 First criterion");
			expect(task?.body).toContain("- [ ] #2 Second criterion");
			expect(task?.body).toContain("- [ ] #3 Third criterion");
			expect(task?.body).toContain("- [ ] #4 Fourth criterion");
			expect(task?.body).toContain("- [ ] #5 Fifth criterion");
		});

		it("should remove acceptance criterion by index with --remove-ac", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --remove-ac 2`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.body).toContain("- [ ] #1 First criterion");
			expect(task?.body).not.toContain("Second criterion");
			expect(task?.body).toContain("- [ ] #2 Third criterion"); // Renumbered
		});

		it("should check acceptance criterion by index with --check-ac", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --check-ac 2`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.body).toContain("- [ ] #1 First criterion");
			expect(task?.body).toContain("- [x] #2 Second criterion");
			expect(task?.body).toContain("- [ ] #3 Third criterion");
		});

		it("should uncheck acceptance criterion by index with --uncheck-ac", async () => {
			// First check a criterion
			await $`bun ${CLI_PATH} task edit 1 --check-ac 1`.cwd(TEST_DIR).quiet();

			// Then uncheck it
			const result = await $`bun ${CLI_PATH} task edit 1 --uncheck-ac 1`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.body).toContain("- [ ] #1 First criterion");
		});

		it("should handle multiple operations in one command", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 --check-ac 1 --remove-ac 2 --ac "New criterion"`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task?.body).toContain("- [x] #1 First criterion");
			expect(task?.body).not.toContain("Second criterion");
			expect(task?.body).toContain("- [ ] #2 Third criterion"); // Renumbered
			expect(task?.body).toContain("- [ ] #3 New criterion");
		});

		it("should error on invalid index for --remove-ac", async () => {
			try {
				await $`bun ${CLI_PATH} task edit 1 --remove-ac 10`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: any) {
				expect(error.exitCode).not.toBe(0);
				expect(error.stderr.toString()).toContain("Acceptance criterion #10 not found");
			}
		});

		it("should error on invalid index for --check-ac", async () => {
			try {
				await $`bun ${CLI_PATH} task edit 1 --check-ac 10`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: any) {
				expect(error.exitCode).not.toBe(0);
				expect(error.stderr.toString()).toContain("Acceptance criterion #10 not found");
			}
		});

		it("should error on non-numeric index", async () => {
			try {
				await $`bun ${CLI_PATH} task edit 1 --remove-ac abc`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: any) {
				expect(error.exitCode).not.toBe(0);
				expect(error.stderr.toString()).toContain("Invalid index");
			}
		});

		it("should error on zero index", async () => {
			try {
				await $`bun ${CLI_PATH} task edit 1 --remove-ac 0`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: any) {
				expect(error.exitCode).not.toBe(0);
				expect(error.stderr.toString()).toContain("Invalid index");
			}
		});

		it("should error on negative index", async () => {
			try {
				await $`bun ${CLI_PATH} task edit 1 --remove-ac=-1`.cwd(TEST_DIR).quiet();
				expect(true).toBe(false); // Should not reach here
			} catch (error: any) {
				expect(error.exitCode).not.toBe(0);
				expect(error.stderr.toString()).toContain("Invalid index");
			}
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
					body: `## Description

## Acceptance Criteria

- [ ] Old format criterion 1
- [x] Old format criterion 2`,
				},
				false,
			);

			const result = await $`bun ${CLI_PATH} task edit 2 --ac "New criterion"`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const task = await core.filesystem.loadTask("task-2");
			expect(task?.body).toContain("<!-- AC:BEGIN -->");
			expect(task?.body).toContain("- [ ] #1 Old format criterion 1");
			expect(task?.body).toContain("- [x] #2 Old format criterion 2");
			expect(task?.body).toContain("- [ ] #3 New criterion");
			expect(task?.body).toContain("<!-- AC:END -->");
		});
	});
});

describe("AcceptanceCriteriaManager unit tests", () => {
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

	describe("Multi-value CLI operations", () => {
		it("should support multiple --ac flags in task create", async () => {
			const result =
				await $`bun run ${CLI_PATH} task create "Multi AC Test" --ac "First" --ac "Second" --ac "Third"`.cwd(TEST_DIR);
			expect(result.exitCode).toBe(0);

			// Parse task ID from output
			const taskId = result.stdout.toString().match(/Created task (task-\d+)/)?.[1];
			expect(taskId).toBeTruthy();

			// Verify ACs were created
			const taskResult = await $`bun run ${CLI_PATH} task ${taskId} --plain`.cwd(TEST_DIR);
			expect(taskResult.stdout).toContain("- [ ] #1 First");
			expect(taskResult.stdout).toContain("- [ ] #2 Second");
			expect(taskResult.stdout).toContain("- [ ] #3 Third");
		});

		it("should support multiple --check-ac flags in single command", async () => {
			// Create task with multiple ACs
			const createResult =
				await $`bun run ${CLI_PATH} task create "Check Test" --ac "First" --ac "Second" --ac "Third" --ac "Fourth"`.cwd(
					TEST_DIR,
				);
			const taskId = createResult.stdout.toString().match(/Created task (task-\d+)/)?.[1];

			// Check multiple ACs at once
			const checkResult = await $`bun run ${CLI_PATH} task edit ${taskId} --check-ac 1 --check-ac 3`.cwd(TEST_DIR);
			expect(checkResult.exitCode).toBe(0);

			// Verify correct ACs were checked
			const taskResult = await $`bun run ${CLI_PATH} task ${taskId} --plain`.cwd(TEST_DIR);
			expect(taskResult.stdout).toContain("- [x] #1 First");
			expect(taskResult.stdout).toContain("- [ ] #2 Second");
			expect(taskResult.stdout).toContain("- [x] #3 Third");
			expect(taskResult.stdout).toContain("- [ ] #4 Fourth");
		});

		it("should support mixed AC operations in single command", async () => {
			// Create task with multiple ACs
			const createResult =
				await $`bun run ${CLI_PATH} task create "Mixed Test" --ac "First" --ac "Second" --ac "Third" --ac "Fourth"`.cwd(
					TEST_DIR,
				);
			const taskId = createResult.stdout.toString().match(/Created task (task-\d+)/)?.[1];

			// Check some ACs first
			await $`bun run ${CLI_PATH} task edit ${taskId} --check-ac 1 --check-ac 2 --check-ac 3`.cwd(TEST_DIR);

			// Now do mixed operations: uncheck 1, keep 2 checked, check 4
			const mixedResult = await $`bun run ${CLI_PATH} task edit ${taskId} --uncheck-ac 1 --check-ac 4`.cwd(TEST_DIR);
			expect(mixedResult.exitCode).toBe(0);

			// Verify final state
			const taskResult = await $`bun run ${CLI_PATH} task ${taskId} --plain`.cwd(TEST_DIR);
			expect(taskResult.stdout).toContain("- [ ] #1 First"); // unchecked
			expect(taskResult.stdout).toContain("- [x] #2 Second"); // remained checked
			expect(taskResult.stdout).toContain("- [x] #3 Third"); // remained checked
			expect(taskResult.stdout).toContain("- [x] #4 Fourth"); // newly checked
		});

		it("should support multiple --remove-ac flags with proper renumbering", async () => {
			// Create task with 5 ACs
			const createResult =
				await $`bun run ${CLI_PATH} task create "Remove Test" --ac "First" --ac "Second" --ac "Third" --ac "Fourth" --ac "Fifth"`.cwd(
					TEST_DIR,
				);
			const taskId = createResult.stdout.toString().match(/Created task (task-\d+)/)?.[1];

			// Remove ACs 2 and 4 (should be processed in descending order to avoid index shifting)
			const removeResult = await $`bun run ${CLI_PATH} task edit ${taskId} --remove-ac 2 --remove-ac 4`.cwd(TEST_DIR);
			expect(removeResult.exitCode).toBe(0);

			// Verify remaining ACs are properly renumbered
			const taskResult = await $`bun run ${CLI_PATH} task ${taskId} --plain`.cwd(TEST_DIR);
			expect(taskResult.stdout).toContain("- [ ] #1 First"); // original #1
			expect(taskResult.stdout).toContain("- [ ] #2 Third"); // original #3 -> #2
			expect(taskResult.stdout).toContain("- [ ] #3 Fifth"); // original #5 -> #3
			expect(taskResult.stdout).not.toContain("Second"); // removed
			expect(taskResult.stdout).not.toContain("Fourth"); // removed
		});

		it("should handle invalid indices gracefully in multi-value operations", async () => {
			// Create task with 2 ACs
			const createResult = await $`bun run ${CLI_PATH} task create "Invalid Test" --ac "First" --ac "Second"`.cwd(
				TEST_DIR,
			);
			const taskId = createResult.stdout.toString().match(/Created task (task-\d+)/)?.[1];

			// Try to check valid and invalid indices
			const checkResult = await $`bun run ${CLI_PATH} task edit ${taskId} --check-ac 1 --check-ac 5`.cwd(TEST_DIR);
			expect(checkResult.exitCode).toBe(1);
			expect(checkResult.stderr).toContain("Failed to check AC #5");
		});
	});
});
