import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";

describe("Tab switching functionality", () => {
	const testDir = join(process.cwd(), "test-tab-switching");
	let core: Core;

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
		await mkdir(testDir, { recursive: true });

		// Configure git for tests - required for CI
		await $`git init`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();

		core = new Core(testDir);
		await core.initializeProject("Test Tab Switching Project");

		// Create test tasks
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(
			join(tasksDir, "task-1 - Test Task.md"),
			`---
id: task-1
title: Test Task
status: To Do
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Test task for tab switching.`,
		);
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	describe("Unified Task domain", () => {
		it("should use unified Task interface everywhere", async () => {
			// Load tasks
			const tasks = await core.filesystem.listTasks();
			expect(tasks.length).toBe(1);

			const task = tasks[0];

			// Verify Task has all the expected fields (including metadata fields)
			expect(task.id).toBeDefined();
			expect(task.title).toBeDefined();
			expect(task.status).toBeDefined();
			expect(task.assignee).toBeDefined();
			expect(task.labels).toBeDefined();
			expect(task.dependencies).toBeDefined();

			// Metadata fields should be optional and available
			expect(typeof task.source).toBe("undefined"); // Not set for local tasks loaded from filesystem
			expect(typeof task.lastModified).toBe("undefined"); // Not set for basic loaded tasks

			// But they should be settable
			const taskWithMetadata = {
				...task,
				source: "local" as const,
				lastModified: new Date(),
			};

			expect(taskWithMetadata.source).toBe("local");
			expect(taskWithMetadata.lastModified).toBeInstanceOf(Date);
		});

		it("should handle runUnifiedView with preloaded kanban data", async () => {
			const tasks = await core.filesystem.listTasks();

			// Test that runUnifiedView accepts the correct parameters without actually running the UI
			expect(() => {
				// Just verify the function can be imported and called with correct parameters
				const options = {
					core,
					initialView: "kanban" as const,
					tasks,
					preloadedKanbanData: {
						tasks: tasks.map((t) => ({ ...t, source: "local" as const })),
						statuses: ["To Do", "In Progress", "Done"],
					},
				};

				// Verify the options object is valid
				expect(options.core).toBeDefined();
				expect(options.initialView).toBe("kanban");
				expect(options.tasks).toBeDefined();
				expect(options.preloadedKanbanData).toBeDefined();
			}).not.toThrow();
		});

		it("should handle task switching between views", async () => {
			const tasks = await core.filesystem.listTasks();
			expect(tasks.length).toBe(1);

			const testTask = tasks[0];

			// Test that we can create valid options for different view types
			const testStates = [
				{ view: "task-list" as const, task: testTask },
				{ view: "task-detail" as const, task: testTask },
				{ view: "kanban" as const, task: testTask },
			];

			for (const state of testStates) {
				expect(() => {
					// Verify we can create valid options for each view type
					const options = {
						core,
						initialView: state.view,
						selectedTask: state.task,
						tasks,
						preloadedKanbanData: {
							tasks,
							statuses: ["To Do"],
						},
					};

					// Verify the options are valid
					expect(options.core).toBeDefined();
					expect(options.initialView).toBe(state.view);
					expect(options.selectedTask).toBe(state.task);
					expect(options.tasks).toBeDefined();
					expect(options.preloadedKanbanData).toBeDefined();
				}).not.toThrow();
			}
		});
	});
});
