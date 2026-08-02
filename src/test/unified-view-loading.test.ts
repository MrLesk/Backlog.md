import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import {
	createTaskFromBoard,
	createUnifiedTaskUpdateCallbacks,
	getDuplicateTaskStartupWarning,
	getEmptyUnifiedViewMessage,
	loadTasksForUnifiedView,
	type UnifiedTaskState,
} from "../ui/unified-view.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

describe("loadTasksForUnifiedView", () => {
	let testDir: string;
	let core: Core;

	beforeEach(() => {
		testDir = createUniqueTestDir("unified-view-load");
		core = new Core(testDir);
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("uses provided loader progress and closes the loading screen", async () => {
		const updates: string[] = [];
		let closed = false;

		const result = await loadTasksForUnifiedView(core, {
			tasksLoader: async (updateProgress) => {
				updateProgress("step one");
				return { tasks: [], statuses: ["To Do", "In Progress"] };
			},
			loadingScreenFactory: async () => ({
				update: (msg: string) => {
					updates.push(msg);
				},
				close: async () => {
					closed = true;
				},
			}),
		});

		expect(updates).toContain("step one");
		expect(closed).toBe(true);
		expect(result.statuses).toEqual(["To Do", "In Progress"]);
	});

	it("opens an unfiltered empty kanban but preserves other empty-result messages", () => {
		expect(getEmptyUnifiedViewMessage("kanban")).toBeNull();
		expect(getEmptyUnifiedViewMessage("task-list")).toBe("No tasks found.");
		expect(getEmptyUnifiedViewMessage("kanban", "TASK-9")).toBe("No child tasks found for parent task TASK-9.");
	});

	it("loads autoCommit when each board task is submitted", async () => {
		let currentAutoCommit = false;
		const observedAutoCommit: boolean[] = [];
		const boardCore = {
			filesystem: {
				loadConfig: async () => ({ autoCommit: currentAutoCommit }),
			},
			createTaskFromInput: async (_input: unknown, autoCommit: boolean) => {
				observedAutoCommit.push(autoCommit);
				return {
					task: {
						id: `TASK-${observedAutoCommit.length}`,
						title: "Created",
						status: "To Do",
						assignee: [],
						createdDate: "2026-07-17 00:00",
						labels: [],
						dependencies: [],
					},
				};
			},
		} as unknown as Core;

		await createTaskFromBoard(boardCore, { title: "First" });
		currentAutoCommit = true;
		await createTaskFromBoard(boardCore, { title: "Second" });

		expect(observedAutoCommit).toEqual([false, true]);
	});

	it("publishes a newly created board task to shared unified state before returning", async () => {
		let state: UnifiedTaskState = { tasks: [] };
		const callbacks = createUnifiedTaskUpdateCallbacks(
			() => state,
			(next) => {
				state = next;
			},
		);
		const created: Task = {
			id: "TASK-1",
			title: "First board task",
			status: "To Do",
			assignee: [],
			createdDate: "2026-07-18 00:00",
			labels: [],
			dependencies: [],
		};
		const boardCore = {
			filesystem: { loadConfig: async () => ({ autoCommit: false }) },
			createTaskFromInput: async () => ({ task: created }),
		} as unknown as Core;

		const result = await createTaskFromBoard(boardCore, { title: created.title }, callbacks.onTaskAdded);

		expect(result).toBe(created);
		expect(state.tasks).toEqual([created]);
		expect(state.selectedTask).toBeUndefined();
	});

	it("builds a concise board warning from active and completed collisions", async () => {
		await core.filesystem.ensureBacklogStructure();
		const makeTask = (id: string, title: string): Task => ({
			id,
			title,
			status: "To Do",
			assignee: [],
			createdDate: "2026-01-01",
			labels: [],
			dependencies: [],
			rawContent: "## Description\n\nTask body",
		});
		await Bun.write(join(core.filesystem.tasksDir, "task-1 - Active.md"), serializeTask(makeTask("TASK-1", "Active")));
		await Bun.write(
			join(core.filesystem.completedDir, "task-01 - Completed.md"),
			serializeTask(makeTask("TASK-01", "Completed")),
		);

		expect(await getDuplicateTaskStartupWarning(core)).toBe(
			"Duplicate task IDs detected: TASK-1. Run 'backlog doctor' to preview a safe repair.",
		);
	});

	it("reconciles watcher callbacks and keeps selection valid", async () => {
		const makeTask = (id: string, title: string, status = "To Do"): Task => ({
			id,
			title,
			status,
			assignee: [],
			createdDate: "2026-07-14",
			labels: [],
			dependencies: [],
		});
		const first = makeTask("task-1", "First");
		const selected = makeTask("task-2", "Selected");
		let state: UnifiedTaskState = { tasks: [first, selected], selectedTask: selected };
		const published: UnifiedTaskState[] = [];
		const callbacks = createUnifiedTaskUpdateCallbacks(
			() => state,
			(next) => {
				state = next;
				published.push(next);
			},
		);

		const moved = makeTask("task-2", "Selected edited", "In Progress");
		await callbacks.onTaskChanged?.(moved);
		expect(state.tasks).toEqual([first, moved]);
		expect(state.selectedTask).toBe(moved);

		const added = makeTask("task-3", "Added");
		await callbacks.onTaskAdded?.(added);
		expect(state.tasks).toEqual([first, moved, added]);

		await callbacks.onTaskRemoved?.("task-2");
		expect(state.tasks).toEqual([first, added]);
		expect(state.selectedTask).toBe(added);
		expect(published).toHaveLength(3);
	});
});
