import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import { calculateNewOrdinal, DEFAULT_ORDINAL_STEP, resolveOrdinalConflicts } from "../core/reorder.ts";
import type { Task } from "../types/index.ts";
import { createTestDir, safeCleanup } from "./test-utils.ts";

const item = (id: string, ordinal?: number) => ({ id, ordinal });

let TEST_DIR: string;
let core: Core;

const FIXED_DATE = "2025-01-01 00:00";

const buildTask = (id: string, status: string, ordinal?: number): Task => ({
	id,
	title: `Task ${id}`,
	status,
	assignee: [],
	createdDate: FIXED_DATE,
	labels: [],
	dependencies: [],
	...(ordinal !== undefined ? { ordinal } : {}),
});

beforeEach(async () => {
	TEST_DIR = await createTestDir("reorder-utils");
	await mkdir(TEST_DIR, { recursive: true });

	core = new Core(TEST_DIR);
	await core.initializeProject("Reorder Utilities Test Project");
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
});

describe("calculateNewOrdinal", () => {
	it("returns default step when no neighbors exist", () => {
		const result = calculateNewOrdinal({});
		expect(result.ordinal).toBe(DEFAULT_ORDINAL_STEP);
		expect(result.requiresRebalance).toBe(false);
	});

	it("averages ordinals when both neighbors exist", () => {
		const result = calculateNewOrdinal({
			previous: item("a", 1000),
			next: item("b", 3000),
		});
		expect(result.ordinal).toBe(2000);
		expect(result.requiresRebalance).toBe(false);
	});

	it("flags rebalance when there is no gap between neighbors", () => {
		const result = calculateNewOrdinal({
			previous: item("a", 2000),
			next: item("b", 2000),
		});
		expect(result.requiresRebalance).toBe(true);
	});

	it("appends step when dropping after the last task", () => {
		const result = calculateNewOrdinal({
			previous: item("a", 4000),
		});
		expect(result.ordinal).toBe(4000 + DEFAULT_ORDINAL_STEP);
		expect(result.requiresRebalance).toBe(false);
	});
});

describe("resolveOrdinalConflicts", () => {
	it("returns empty array when ordinals are already increasing", () => {
		const updates = resolveOrdinalConflicts([item("a", 1000), item("b", 2000), item("c", 3000)]);
		expect(updates).toHaveLength(0);
	});

	it("reassigns duplicate or descending ordinals", () => {
		const updates = resolveOrdinalConflicts([item("a", 1000), item("b", 1000), item("c", 2000)]);
		expect(updates).toHaveLength(2);
		expect(updates[0]).toEqual({ id: "b", ordinal: 2000 });
		expect(updates[1]).toEqual({ id: "c", ordinal: 3000 });
	});

	it("fills in missing ordinals with default spacing", () => {
		const updates = resolveOrdinalConflicts([item("a"), item("b"), item("c", 1500)]);
		expect(updates).toHaveLength(3);
		expect(updates[0]).toEqual({ id: "a", ordinal: DEFAULT_ORDINAL_STEP });
		expect(updates[1]).toEqual({ id: "b", ordinal: DEFAULT_ORDINAL_STEP * 2 });
		expect(updates[2]).toEqual({ id: "c", ordinal: DEFAULT_ORDINAL_STEP * 3 });
	});

	it("can force sequential reassignment when requested", () => {
		const updates = resolveOrdinalConflicts([item("a", 1000), item("b", 2500), item("c", 4500)], {
			forceSequential: true,
		});
		expect(updates).toHaveLength(2);
		expect(updates[0]).toEqual({ id: "b", ordinal: 2000 });
		expect(updates[1]).toEqual({ id: "c", ordinal: 3000 });
	});
});

describe("Core.reorderTask", () => {
	const createTasks = async (tasks: Array<[string, string, number?]>) => {
		for (const [id, status, ordinal] of tasks) {
			await core.createTask(buildTask(id, status, ordinal), false);
		}
	};

	it("reorders within a column without touching unaffected tasks", async () => {
		await createTasks([
			["task-1", "To Do", 1000],
			["task-2", "To Do", 2000],
			["task-3", "To Do", 3000],
		]);

		const result = await core.reorderTask({
			taskId: "task-3",
			targetStatus: "To Do",
			orderedTaskIds: ["task-1", "task-3", "task-2"],
		});

		expect(result.updatedTask.id).toBe("task-3");
		expect(result.updatedTask.ordinal).toBeGreaterThan(1000);
		expect(result.updatedTask.ordinal).toBeLessThan(2000);
		expect(result.changedTasks.map((task) => task.id)).toEqual(["task-3"]);

		const task2 = await core.filesystem.loadTask("task-2");
		expect(task2?.ordinal).toBe(2000);
	});

	it("rebalances ordinals when collisions exist", async () => {
		await createTasks([
			["task-1", "To Do", 1000],
			["task-2", "To Do", 1000],
			["task-3", "To Do", 1000],
		]);

		const result = await core.reorderTask({
			taskId: "task-3",
			targetStatus: "To Do",
			orderedTaskIds: ["task-1", "task-3", "task-2"],
		});

		expect(result.changedTasks.map((task) => task.id).sort()).toEqual(["task-2", "task-3"]);

		const task1 = await core.filesystem.loadTask("task-1");
		const task2 = await core.filesystem.loadTask("task-2");
		const task3 = await core.filesystem.loadTask("task-3");
		expect(task1?.ordinal).toBe(1000);
		expect(task2?.ordinal).toBe(3000);
		expect(task3?.ordinal).toBe(2000);
	});

	it("updates status and ordinal when moving across columns", async () => {
		await createTasks([
			["task-1", "To Do", 1000],
			["task-2", "In Progress", 1000],
			["task-3", "In Progress", 2000],
		]);

		const result = await core.reorderTask({
			taskId: "task-1",
			targetStatus: "In Progress",
			orderedTaskIds: ["task-1", "task-2", "task-3"],
		});

		expect(result.updatedTask.status).toBe("In Progress");
		expect(result.updatedTask.ordinal).toBeGreaterThan(0);
		expect(result.changedTasks.map((task) => task.id)).toContain("task-1");

		const task2 = await core.filesystem.loadTask("task-2");
		const task3 = await core.filesystem.loadTask("task-3");
		expect(task2?.ordinal).toBe(1000);
		expect(task3?.ordinal).toBe(2000);
	});
});
