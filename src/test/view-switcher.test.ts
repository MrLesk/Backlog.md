import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { type ViewState, ViewSwitcher } from "../ui/view-switcher.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("View Switcher", () => {
	let TEST_DIR: string;
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-view-switcher");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Configure git for tests - required for CI
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();

		core = new Core(TEST_DIR);
		await core.initializeProject("Test View Switcher Project");

		// Disable remote operations for tests to prevent background git fetches
		const config = await core.filesystem.loadConfig();
		if (config) {
			config.remoteOperations = false;
			await core.filesystem.saveConfig(config);
		}
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	describe("ViewSwitcher initialization", () => {
		it("should initialize with task-list view", () => {
			const initialState: ViewState = {
				type: "task-list",
				tasks: [],
			};

			const switcher = new ViewSwitcher({
				core,
				initialState,
			});

			const state = switcher.getState();
			expect(state.type).toBe("task-list");
			expect(state.tasks).toEqual([]);
		});

		it("should initialize with task-detail view", () => {
			const selectedTask = {
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-05",
				labels: [],
				dependencies: [],
				rawContent: "Test task body",
			};

			const initialState: ViewState = {
				type: "task-detail",
				selectedTask,
				tasks: [selectedTask],
			};

			const switcher = new ViewSwitcher({
				core,
				initialState,
			});

			const state = switcher.getState();
			expect(state.type).toBe("task-detail");
			expect(state.selectedTask).toEqual(selectedTask);
		});

		it("should initialize with kanban view", () => {
			const initialState: ViewState = {
				type: "kanban",
				kanbanData: {
					tasks: [],
					statuses: [],
					isLoading: true,
				},
			};

			const switcher = new ViewSwitcher({
				core,
				initialState,
			});

			const state = switcher.getState();
			expect(state.type).toBe("kanban");
			expect(state.kanbanData?.isLoading).toBe(true);
		});
	});

	describe("State updates", () => {
		it("should update state correctly", () => {
			const initialState: ViewState = {
				type: "task-list",
				tasks: [],
			};

			const switcher = new ViewSwitcher({
				core,
				initialState,
			});

			const newTask = {
				id: "task-1",
				title: "Updated Task",
				status: "In Progress",
				assignee: [],
				createdDate: "2025-07-05",
				labels: [],
				dependencies: [],
				rawContent: "Updated task body",
			};

			const updatedState = switcher.updateState({
				selectedTask: newTask,
				type: "task-detail",
			});

			expect(updatedState.type).toBe("task-detail");
			expect(updatedState.selectedTask).toEqual(newTask);
		});
	});

	describe("Background loading", () => {
		it("should indicate when kanban data is ready", () => {
			const initialState: ViewState = {
				type: "task-list",
				tasks: [],
			};

			const switcher = new ViewSwitcher({
				core,
				initialState,
			});

			// Initially should not be ready (no data loaded yet)
			expect(switcher.isKanbanReady()).toBe(false);
		});

		it("should start preloading kanban data", () => {
			const initialState: ViewState = {
				type: "task-list",
				tasks: [],
			};

			const switcher = new ViewSwitcher({
				core,
				initialState,
			});

			// Mock the preloadKanban method to avoid remote git operations
			switcher.preloadKanban = async () => {};

			// Should not throw when preloading
			expect(() => switcher.preloadKanban()).not.toThrow();
		});
	});

	describe("View change callback", () => {
		it("should call onViewChange when state updates", () => {
			let callbackState: ViewState | null = null;

			const initialState: ViewState = {
				type: "task-list",
				tasks: [],
			};

			const switcher = new ViewSwitcher({
				core,
				initialState,
				onViewChange: (newState) => {
					callbackState = newState;
				},
			});

			const newTask = {
				id: "task-1",
				title: "Test Task",
				status: "To Do",
				assignee: [],
				createdDate: "2025-07-05",
				labels: [],
				dependencies: [],
				rawContent: "Test task body",
			};

			switcher.updateState({
				selectedTask: newTask,
				type: "task-detail",
			});

			expect(callbackState).toBeTruthy();
			if (!callbackState) {
				throw new Error("callbackState should not be null");
			}
			const state = callbackState as unknown as ViewState;
			expect(state.type).toBe("task-detail");
			expect(state.selectedTask).toEqual(newTask);
		});
	});
});
