import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";

const TEST_DIR = join(process.cwd(), "test-plan");
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Implementation Plan CLI", () => {
	beforeEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		await Bun.spawn(["mkdir", "-p", TEST_DIR]).exited;
		await Bun.spawn(["git", "init", "-b", "main"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: TEST_DIR }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: TEST_DIR }).exited;

		const core = new Core(TEST_DIR);
		await core.initializeProject("Implementation Plan Test Project");
	});

	afterEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("task create with implementation plan", () => {
		it("should create task with implementation plan using --plan", async () => {
			const p = Bun.spawn(
				["bun", CLI_PATH, "task", "create", "Test Task", "--plan", "Step 1: Analyze\nStep 2: Implement"],
				{
					cwd: TEST_DIR,
					stdout: "inherit",
					stderr: "inherit",
				},
			);
			expect(await p.exited).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.description).toContain("## Implementation Plan");
			expect(task?.description).toContain("Step 1: Analyze");
			expect(task?.description).toContain("Step 2: Implement");
		});

		it("should create task with both description and implementation plan", async () => {
			const p = Bun.spawn(
				[
					"bun",
					CLI_PATH,
					"task",
					"create",
					"Test Task",
					"-d",
					"Task description",
					"--plan",
					"1. First step\n2. Second step",
				],
				{
					cwd: TEST_DIR,
					stdout: "inherit",
					stderr: "inherit",
				},
			);
			expect(await p.exited).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.description).toContain("## Description");
			expect(task?.description).toContain("Task description");
			expect(task?.description).toContain("## Implementation Plan");
			expect(task?.description).toContain("1. First step");
			expect(task?.description).toContain("2. Second step");
		});

		it("should create task with acceptance criteria and implementation plan", async () => {
			const result = Bun.spawnSync(
				[
					"bun",
					CLI_PATH,
					"task",
					"create",
					"Test Task",
					"--ac",
					"Must work correctly, Must be tested",
					"--plan",
					"Phase 1: Setup\nPhase 2: Testing",
				],
				{
					cwd: TEST_DIR,
				},
			);

			if (result.exitCode !== 0) {
				console.error("CLI Error:", result.stderr?.toString() || result.stdout?.toString());
				console.error("Exit code:", result.exitCode);
			}
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.description).toContain("## Acceptance Criteria");
			expect(task?.description).toContain("- [ ] Must work correctly");
			expect(task?.description).toContain("- [ ] Must be tested");
			expect(task?.description).toContain("## Implementation Plan");
			expect(task?.description).toContain("Phase 1: Setup");
			expect(task?.description).toContain("Phase 2: Testing");
		});
	});

	describe("task edit with implementation plan", () => {
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
					description: "## Description\n\nExisting task description",
				},
				false,
			);
		});

		it("should add implementation plan to existing task", async () => {
			const p = Bun.spawn(["bun", CLI_PATH, "task", "edit", "1", "--plan", "New plan:\n- Step A\n- Step B"], {
				cwd: TEST_DIR,
				stdout: "inherit",
				stderr: "inherit",
			});
			expect(await p.exited).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.description).toContain("## Description");
			expect(task?.description).toContain("Existing task description");
			expect(task?.description).toContain("## Implementation Plan");
			expect(task?.description).toContain("New plan:");
			expect(task?.description).toContain("- Step A");
			expect(task?.description).toContain("- Step B");
		});

		it("should replace existing implementation plan", async () => {
			// First add a plan
			const core = new Core(TEST_DIR);
			let task = await core.filesystem.loadTask("task-1");
			if (task) {
				task.description = `${task.description}\n\n## Implementation Plan\n\nOld plan:\n1. Old step 1\n2. Old step 2`;
				await core.updateTask(task, false);
			}

			// Now update with new plan
			const p2 = Bun.spawn(
				["bun", CLI_PATH, "task", "edit", "1", "--plan", "Updated plan:\n1. New step 1\n2. New step 2"],
				{
					cwd: TEST_DIR,
					stdout: "inherit",
					stderr: "inherit",
				},
			);
			expect(await p2.exited).toBe(0);

			task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.description).toContain("## Implementation Plan");
			expect(task?.description).toContain("Updated plan:");
			expect(task?.description).toContain("1. New step 1");
			expect(task?.description).toContain("2. New step 2");
			expect(task?.description).not.toContain("Old plan:");
			expect(task?.description).not.toContain("Old step 1");
		});

		it("should update both title and implementation plan", async () => {
			const result = Bun.spawnSync(
				[
					"bun",
					CLI_PATH,
					"task",
					"edit",
					"1",
					"-t",
					"Updated Title",
					"--plan",
					"Implementation:\n- Do this\n- Then that",
				],
				{
					cwd: TEST_DIR,
				},
			);

			if (result.exitCode !== 0) {
				console.error("CLI Error:", result.stderr?.toString() || result.stdout?.toString());
				console.error("Exit code:", result.exitCode);
			}
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			expect(task?.title).toBe("Updated Title");
			expect(task?.description).toContain("## Implementation Plan");
			expect(task?.description).toContain("Implementation:");
			expect(task?.description).toContain("- Do this");
			expect(task?.description).toContain("- Then that");
		});
	});

	describe("implementation plan positioning", () => {
		it("should place implementation plan after acceptance criteria when both exist", async () => {
			const result = Bun.spawnSync(
				[
					"bun",
					CLI_PATH,
					"task",
					"create",
					"Test Task",
					"-d",
					"Description text",
					"--ac",
					"Criterion 1",
					"--plan",
					"Plan text",
				],
				{
					cwd: TEST_DIR,
				},
			);

			if (result.exitCode !== 0) {
				console.error("CLI Error:", result.stderr?.toString() || result.stdout?.toString());
				console.error("Exit code:", result.exitCode);
			}
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();

			const description = task?.description || "";
			const descIndex = description.indexOf("## Description");
			const acIndex = description.indexOf("## Acceptance Criteria");
			const planIndex = description.indexOf("## Implementation Plan");

			// Verify order: Description -> Acceptance Criteria -> Implementation Plan
			expect(descIndex).toBeLessThan(acIndex);
			expect(acIndex).toBeLessThan(planIndex);
		});

		it("should handle empty plan gracefully", async () => {
			const result = Bun.spawnSync(["bun", CLI_PATH, "task", "create", "Test Task", "--plan", ""], {
				cwd: TEST_DIR,
			});

			if (result.exitCode !== 0) {
				console.error("CLI Error:", result.stderr?.toString() || result.stdout?.toString());
				console.error("Exit code:", result.exitCode);
			}
			expect(result.exitCode).toBe(0);

			const core = new Core(TEST_DIR);
			const task = await core.filesystem.loadTask("task-1");
			expect(task).not.toBeNull();
			// Should NOT add the section with empty content
			expect(task?.description).not.toContain("## Implementation Plan");
		});
	});
});
