import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("CLI Board Integration", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = await createTestDir("test-cli-board-integration");
		// Configure git for tests - required for CI

		core = new Core(TEST_DIR);
		await core.initializeProject("Test CLI Board Project");

		// Disable remote operations for tests to prevent background git fetches
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.remoteOperations = false;
			await core.filesystem.saveConfig(config);
		}

		// Create test tasks
		const tasksDir = core.filesystem.tasksDir;
		await writeFile(
			join(tasksDir, "task-1 - Board Test Task.md"),
			`---
id: task-1
title: Board Test Task
status: To Do
assignee: []
created_date: '2025-07-05'
labels: []
dependencies: []
---

## Description

Test task for board CLI integration.`,
		);
	});

	afterEach(async () => {
		// Wait a bit to ensure any background operations from listTasksWithMetadata complete
		await new Promise((resolve) => setTimeout(resolve, 100));
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should handle board command logic without crashing", async () => {
		// Test the main board loading logic that was failing
		const config = await core.filesystem.loadConfig();
		const statuses = config?.statuses || [];

		// Load tasks like the CLI does
		const [localTasks, _remoteTasks] = await Promise.all([
			core.listTasksWithMetadata(),
			// Remote tasks would normally be loaded but will fail in test env - that's OK
			Promise.resolve([]),
		]);

		// Verify basic functionality
		expect(localTasks.length).toBe(1);
		expect(localTasks[0]?.id).toBe("task-1");
		expect(localTasks[0]?.status).toBe("To Do");
		expect(statuses).toContain("To Do");

		// Test that we can create the task map
		const tasksById = new Map(localTasks.map((t) => [t.id, { ...t, source: "local" as const }]));
		expect(tasksById.size).toBe(1);
		expect(tasksById.get("task-1")?.title).toBe("Board Test Task");
	});

	it("should properly handle cross-branch task resolution", async () => {
		// Test the function that was missing filesystem parameter
		const { getLatestTaskStatesForIds } = await import("../core/cross-branch-tasks.ts");

		const tasks = await core.filesystem.listTasks();
		const taskIds = tasks.map((t) => t.id);

		// This should not throw "fs is not defined" or parameter errors
		const result = await getLatestTaskStatesForIds(core.gitOps, core.filesystem, taskIds);

		expect(result).toBeInstanceOf(Map);
		// The result may be empty in test environment without branches, but it shouldn't crash
	});

	it("should create ViewSwitcher with kanban view successfully", async () => {
		// Test the specific ViewSwitcher initialization that was failing
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

		// Immediately cleanup to prevent background operations
		viewSwitcher.cleanup();

		// Verify the ViewSwitcher has the required methods
		expect(typeof viewSwitcher.getKanbanData).toBe("function");
		expect(typeof viewSwitcher.switchView).toBe("function");
		expect(typeof viewSwitcher.isKanbanReady).toBe("function");

		// Mock the getKanbanData method to avoid remote git operations
		viewSwitcher.getKanbanData = async () => {
			// Mock config since it's not fully available in this test environment
			const config = await core.filesystem.loadConfig();
			const statuses = config?.statuses || ["To Do", "In Progress"];
			return {
				tasks: await core.filesystem.listTasks(),
				statuses: statuses || [],
			};
		};

		// Test that getKanbanData method exists and can be called
		const kanbanData = await viewSwitcher.getKanbanData();
		expect(kanbanData).toBeDefined();
		expect(Array.isArray(kanbanData.tasks)).toBe(true);
		expect(Array.isArray(kanbanData.statuses)).toBe(true);

		// Clean up again to be sure
		viewSwitcher.cleanup();
	});
});
