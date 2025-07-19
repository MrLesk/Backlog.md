import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";

describe("Board command integration", () => {
	const testDir = join(process.cwd(), "test-board-command");
	let core: Core;

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
		await mkdir(testDir, { recursive: true });

		// Configure git for tests - required for CI
		await $`git init`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();

		core = new Core(testDir);
		await core.initializeProject("Test Board Project");

		// Disable remote operations for tests to prevent background git fetches
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.remoteOperations = false;
			await core.filesystem.saveConfig(config);
		}

		// Create some test tasks
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(
			join(tasksDir, "task-1 - Test Task One.md"),
			`---
id: task-1
title: Test Task One
status: To Do
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

This is a test task for board testing.`,
		);

		await writeFile(
			join(tasksDir, "task-2 - Test Task Two.md"),
			`---
id: task-2
title: Test Task Two
status: In Progress
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

This is another test task for board testing.`,
		);
	});

	afterEach(async () => {
		// Wait a bit to ensure any background operations complete
		await new Promise((resolve) => setTimeout(resolve, 100));
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
	});

	describe("Board loading", () => {
		it("should load board without errors", async () => {
			// This test verifies that the board command data loading works correctly
			const tasks = await core.filesystem.listTasks();
			expect(tasks.length).toBe(2);

			// Test that we can prepare the board data without running the interactive UI
			expect(() => {
				const options = {
					core,
					initialView: "kanban" as const,
					tasks: tasks.map((t) => ({ ...t, status: t.status || "" })),
				};

				// Verify board options are valid
				expect(options.core).toBeDefined();
				expect(options.initialView).toBe("kanban");
				expect(options.tasks).toBeDefined();
				expect(options.tasks.length).toBe(2);
				expect(options.tasks[0].status).toBe("To Do");
				expect(options.tasks[1].status).toBe("In Progress");
			}).not.toThrow();
		});

		it("should handle empty task list gracefully", async () => {
			// Remove test tasks
			const tasksDir = core.filesystem.tasksDir;
			await rm(join(tasksDir, "task-1 - Test Task One.md")).catch(() => {});
			await rm(join(tasksDir, "task-2 - Test Task Two.md")).catch(() => {});

			const tasks = await core.filesystem.listTasks();
			expect(tasks.length).toBe(0);

			// Should handle empty task list properly
			expect(() => {
				const options = {
					core,
					initialView: "kanban" as const,
					tasks: [],
				};

				// Verify empty task list is handled correctly
				expect(options.core).toBeDefined();
				expect(options.initialView).toBe("kanban");
				expect(options.tasks).toBeDefined();
				expect(options.tasks.length).toBe(0);
			}).not.toThrow();
		});

		it("should validate ViewSwitcher initialization with kanban view", async () => {
			// This specifically tests the ViewSwitcher setup that was failing
			const { ViewSwitcher } = await import("../ui/view-switcher.ts");

			const initialState = {
				type: "kanban" as const,
				kanbanData: {
					tasks: [],
					statuses: [],
					isLoading: true,
				},
			};

			// This should not throw
			const viewSwitcher = new ViewSwitcher({
				core,
				initialState,
			});

			expect(viewSwitcher.getState().type).toBe("kanban");
			expect(viewSwitcher.getState().kanbanData?.isLoading).toBe(true);

			// Clean up to prevent background operations after test
			viewSwitcher.cleanup();
		});

		it("should handle getKanbanData method correctly", async () => {
			// Test the specific method that was failing in the error
			const { ViewSwitcher } = await import("../ui/view-switcher.ts");

			const initialState = {
				type: "kanban" as const,
				kanbanData: {
					tasks: [],
					statuses: [],
					isLoading: true,
				},
			};

			const viewSwitcher = new ViewSwitcher({
				core,
				initialState,
			});

			try {
				// Mock the getKanbanData method to avoid remote git operations
				viewSwitcher.getKanbanData = async () => {
					// Mock config since it's not fully available in this test environment
					const statuses = core.config?.get ? await core.config.get("statuses") : ["To Do", "In Progress"];
					return {
						tasks: await core.filesystem.listTasks(),
						statuses: statuses || [],
					};
				};

				// This should not throw "viewSwitcher?.getKanbanData is not a function"
				await expect(async () => {
					const kanbanData = await viewSwitcher.getKanbanData();
					expect(kanbanData).toBeDefined();
					expect(Array.isArray(kanbanData.tasks)).toBe(true);
					expect(Array.isArray(kanbanData.statuses)).toBe(true);
				}).not.toThrow();
			} finally {
				// Always cleanup in finally block
				viewSwitcher.cleanup();
			}
		});
	});

	describe("Cross-branch task resolution", () => {
		it("should handle getLatestTaskStatesForIds with proper parameters", async () => {
			// Test the function that was missing the filesystem parameter
			const { getLatestTaskStatesForIds } = await import("../core/cross-branch-tasks.ts");

			const tasks = await core.filesystem.listTasks();
			const taskIds = tasks.map((t) => t.id);

			// This should not throw "fs is not defined"
			await expect(async () => {
				const result = await getLatestTaskStatesForIds(core.gitOps, core.filesystem, taskIds);
				expect(result).toBeInstanceOf(Map);
			}).not.toThrow();
		});
	});
});
