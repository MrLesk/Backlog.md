import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";

const TEST_DIR = join(process.cwd(), "test-notes");
const CLI_PATH = join(process.cwd(), "src", "cli.ts");

describe("Implementation Notes CLI", () => {
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
		await core.initializeProject("Implementation Notes Test Project");
	});

	afterEach(async () => {
		try {
			await rm(TEST_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("task edit with implementation notes", () => {
		it("should add implementation notes to existing task", async () => {
			const core = new Core(TEST_DIR);
			const task: Task = {
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Test description",
			};
			await core.createTask(task, false);

			const result = spawnSync(
				"bun",
				[CLI_PATH, "task", "edit", "1", "--notes", "Fixed the bug by updating the validation logic"],
				{
					cwd: TEST_DIR,
					encoding: "utf8",
					timeout: 10000, // 10 second timeout
				},
			);

			if (result.status !== 0) {
				console.error("CLI Error:", result.stderr || result.stdout);
				console.error("Exit code:", result.status);
			}
			expect(result.status).toBe(0);

			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask).not.toBeNull();
			expect(updatedTask?.description).toContain("## Implementation Notes");
			expect(updatedTask?.description).toContain("Fixed the bug by updating the validation logic");
		});

		it("should append to existing implementation notes", async () => {
			const core = new Core(TEST_DIR);
			const task: Task = {
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Test description\n\n## Implementation Notes\n\nInitial implementation completed",
			};
			await core.createTask(task, false);

			const result = spawnSync("bun", [CLI_PATH, "task", "edit", "1", "--notes", "Added error handling"], {
				cwd: TEST_DIR,
				encoding: "utf8",
				timeout: 10000, // 10 second timeout
			});

			if (result.status !== 0) {
				console.error("CLI Error:", result.stderr || result.stdout);
				console.error("Exit code:", result.status);
			}
			expect(result.status).toBe(0);

			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask).not.toBeNull();
			expect(updatedTask?.description).toContain("Initial implementation completed");
			expect(updatedTask?.description).toContain("Added error handling");
			// Check that both notes are present in the section
			const notesSection = updatedTask?.description.match(/## Implementation Notes\s*\n([\s\S]*?)(?=\n## |$)/i);
			expect(notesSection?.[1]).toContain("Initial implementation completed");
			expect(notesSection?.[1]).toContain("Added error handling");
		});

		it("should work together with status update when marking as Done", async () => {
			const core = new Core(TEST_DIR);
			const task: Task = {
				id: "task-1",
				title: "Feature Implementation",
				status: "In Progress",
				assignee: ["@dev"],
				createdDate: "2025-07-03",
				labels: ["feature"],
				dependencies: [],
				description: "Implement new feature\n\n## Acceptance Criteria\n\n- [ ] Feature works\n- [ ] Tests pass",
			};
			await core.createTask(task, false);

			const result = spawnSync(
				"bun",
				[
					CLI_PATH,
					"task",
					"edit",
					"1",
					"-s",
					"Done",
					"--notes",
					"Implemented using the factory pattern\nAdded unit tests\nUpdated documentation",
				],
				{
					cwd: TEST_DIR,
					encoding: "utf8",
					timeout: 10000, // 10 second timeout
				},
			);
			expect(result.status).toBe(0);

			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask).not.toBeNull();
			expect(updatedTask?.status).toBe("Done");
			expect(updatedTask?.description).toContain("## Implementation Notes");
			expect(updatedTask?.description).toContain("Implemented using the factory pattern");
			expect(updatedTask?.description).toContain("Added unit tests");
			expect(updatedTask?.description).toContain("Updated documentation");
		});

		it("should handle multi-line notes with proper formatting", async () => {
			const core = new Core(TEST_DIR);
			const task: Task = {
				id: "task-1",
				title: "Complex Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Complex task description",
			};
			await core.createTask(task, false);

			const multiLineNotes = `Completed the following:
- Refactored the main module
- Added error boundaries
- Improved performance by 30%

Technical decisions:
- Used memoization for expensive calculations
- Implemented lazy loading`;

			const result = spawnSync("bun", [CLI_PATH, "task", "edit", "1", "--notes", multiLineNotes], {
				cwd: TEST_DIR,
				encoding: "utf8",
				timeout: 10000, // 10 second timeout
			});

			if (result.status !== 0) {
				console.error("CLI Error:", result.stderr || result.stdout);
				console.error("Exit code:", result.status);
				console.error("Multi-line notes:", JSON.stringify(multiLineNotes));
			}
			expect(result.status).toBe(0);

			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask).not.toBeNull();
			expect(updatedTask?.description).toContain("Refactored the main module");
			expect(updatedTask?.description).toContain("Technical decisions:");
			expect(updatedTask?.description).toContain("Implemented lazy loading");
		});

		it("should position implementation notes after implementation plan if present", async () => {
			const core = new Core(TEST_DIR);
			const task: Task = {
				id: "task-1",
				title: "Planned Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description:
					"Task with plan\n\n## Acceptance Criteria\n\n- [ ] Works\n\n## Implementation Plan\n\n1. Design\n2. Build\n3. Test",
			};
			await core.createTask(task, false);

			const result = spawnSync("bun", [CLI_PATH, "task", "edit", "1", "--notes", "Followed the plan successfully"], {
				cwd: TEST_DIR,
				encoding: "utf8",
				timeout: 10000, // 10 second timeout
			});
			expect(result.status).toBe(0);

			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask).not.toBeNull();
			const desc = updatedTask?.description || "";

			// Check that Implementation Notes comes after Implementation Plan
			const planIndex = desc.indexOf("## Implementation Plan");
			const notesIndex = desc.indexOf("## Implementation Notes");
			expect(planIndex).toBeGreaterThan(0);
			expect(notesIndex).toBeGreaterThan(planIndex);
		});

		it("should handle empty notes gracefully", async () => {
			const core = new Core(TEST_DIR);
			const task: Task = {
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-03",
				labels: [],
				dependencies: [],
				description: "Test description",
			};
			await core.createTask(task, false);

			const result = spawnSync("bun", [CLI_PATH, "task", "edit", "1", "--notes", ""], {
				cwd: TEST_DIR,
				encoding: "utf8",
				timeout: 10000, // 10 second timeout
			});
			expect(result.status).toBe(0);

			const updatedTask = await core.filesystem.loadTask("task-1");
			expect(updatedTask).not.toBeNull();
			// Should not add Implementation Notes section for empty notes
			expect(updatedTask?.description).not.toContain("## Implementation Notes");
		});
	});
});
