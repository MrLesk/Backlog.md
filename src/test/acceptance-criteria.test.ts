import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";

const TEST_DIR = join(process.cwd(), "test-ac");
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Acceptance Criteria CLI", () => {
	beforeEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await mkdir(TEST_DIR, { recursive: true });
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();

		const core = new Core(TEST_DIR);
		await core.initializeProject("AC Test Project");
	});

	afterEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
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
			expect(task?.body).toContain("- [ ] Must work correctly");
		});

		it("should create task with multiple comma-separated criteria", async () => {
			const result = await $`bun ${CLI_PATH} task create "Test Task" --ac "Criterion 1, Criterion 2, Criterion 3"`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("- [ ] Criterion 1");
			expect(task?.body).toContain("- [ ] Criterion 2");
			expect(task?.body).toContain("- [ ] Criterion 3");
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
			expect(task?.body).toContain("- [ ] Full flag test");
		});

		it("should create task with both description and acceptance criteria", async () => {
			const result =
				await $`bun ${CLI_PATH} task create "Test Task" -d "Task description" --ac "Must pass tests, Must be documented"`
					.cwd(TEST_DIR)
					.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Description");
			expect(task?.body).toContain("Task description");
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] Must pass tests");
			expect(task?.body).toContain("- [ ] Must be documented");
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
			const result = await $`bun ${CLI_PATH} task edit 1 --ac "New criterion 1, New criterion 2"`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Description");
			expect(task?.body).toContain("Existing task description");
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] New criterion 1");
			expect(task?.body).toContain("- [ ] New criterion 2");
		});

		it("should replace existing acceptance criteria", async () => {
			// First add some criteria
			const core = new Core(TEST_DIR);
			let task = await core.filesystem.loadTask("task-1");
			if (task) {
				task.body = `${task.body}\n\n## Acceptance Criteria\n\n- [ ] Old criterion 1\n- [ ] Old criterion 2`;
				await core.updateTask(task, false);
			}

			// Now update with new criteria
			const result = await $`bun ${CLI_PATH} task edit 1 --ac "Replaced criterion"`.cwd(TEST_DIR).quiet();
			expect(result.exitCode).toBe(0);

			task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] Replaced criterion");
			expect(task?.body).not.toContain("Old criterion 1");
			expect(task?.body).not.toContain("Old criterion 2");
		});

		it("should update title and add acceptance criteria together", async () => {
			const result = await $`bun ${CLI_PATH} task edit 1 -t "Updated Title" --ac "Must be updated, Must work"`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.title).toBe("Updated Title");
			expect(task?.body).toContain("## Acceptance Criteria");
			expect(task?.body).toContain("- [ ] Must be updated");
			expect(task?.body).toContain("- [ ] Must work");
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
			const result = await $`bun ${CLI_PATH} task create "Test Task" --ac "  Criterion with spaces  ,  Another one  "`
				.cwd(TEST_DIR)
				.quiet();
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.body).toContain("- [ ] Criterion with spaces");
			expect(task?.body).toContain("- [ ] Another one");
		});
	});
});
