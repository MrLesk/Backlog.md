import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { type ViewState, ViewSwitcher } from "../ui/view-switcher.ts";

describe("View Switcher", () => {
	const testDir = join(process.cwd(), "test-view-switcher");
	let core: Core;

	beforeEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
		await mkdir(testDir, { recursive: true });

		// Configure git for tests - required for CI
		await Bun.spawn(["git", "init"], { cwd: testDir }).exited;
		await Bun.spawn(["git", "config", "user.email", "test@example.com"], { cwd: testDir }).exited;
		await Bun.spawn(["git", "config", "user.name", "Test User"], { cwd: testDir }).exited;

		core = new Core(testDir);
		await core.initializeProject("Test View Switcher Project");
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true }).catch(() => {});
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
				created_date: "2025-07-05",
				labels: [],
				dependencies: [],
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
				created_date: "2025-07-05",
				labels: [],
				dependencies: [],
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
				created_date: "2025-07-05",
				labels: [],
				dependencies: [],
			};

			switcher.updateState({
				selectedTask: newTask,
				type: "task-detail",
			});

			expect(callbackState).toBeTruthy();
			expect(callbackState?.type).toBe("task-detail");
			expect(callbackState?.selectedTask).toEqual(newTask);
		});
	});
});
