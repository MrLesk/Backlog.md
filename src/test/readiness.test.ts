import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { getTaskReadiness } from "../utils/readiness.ts";

const statuses = ["To Do", "In Progress", "Done"];

function makeTask(id: string, status: string, dependencies: string[] = []): Task {
	return {
		id,
		title: `Task ${id}`,
		status,
		dependencies,
		assignee: [],
		labels: [],
		createdDate: "2026-07-24",
		rawContent: "",
	};
}

describe("getTaskReadiness", () => {
	it("returns ready for a task with no dependencies", () => {
		const task = makeTask("BACK-1", "To Do");
		const readiness = getTaskReadiness(task, [task], statuses);

		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
		expect(readiness.blockingDependencies).toEqual([]);
	});

	it("returns ready when all dependencies are in terminal status", () => {
		const dep = makeTask("BACK-1", "Done");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness = getTaskReadiness(task, [dep, task], statuses);

		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
	});

	it("returns blocked when a dependency is in non-terminal status", () => {
		const dep = makeTask("BACK-1", "In Progress");
		const task = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness = getTaskReadiness(task, [dep, task], statuses);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(true);
		expect(readiness.blockingDependencies).toEqual(["BACK-1"]);
	});

	it("returns blocked when a dependency is missing", () => {
		const task = makeTask("BACK-2", "To Do", ["BACK-99"]);
		const readiness = getTaskReadiness(task, [task], statuses);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(true);
		expect(readiness.missingDependencies).toEqual(["BACK-99"]);
	});

	it("returns not ready and not blocked for tasks already in terminal status", () => {
		const task = makeTask("BACK-1", "Done");
		const readiness = getTaskReadiness(task, [task], statuses);

		expect(readiness.isReady).toBe(false);
		expect(readiness.isBlocked).toBe(false);
	});

	it("handles dependency cycles safely without infinite recursion", () => {
		const task1 = makeTask("BACK-1", "To Do", ["BACK-2"]);
		const task2 = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const readiness1 = getTaskReadiness(task1, [task1, task2], statuses);
		const readiness2 = getTaskReadiness(task2, [task1, task2], statuses);

		expect(readiness1.isReady).toBe(false);
		expect(readiness1.isBlocked).toBe(true);
		expect(readiness1.blockingDependencies).toEqual(["BACK-2"]);

		expect(readiness2.isReady).toBe(false);
		expect(readiness2.isBlocked).toBe(true);
		expect(readiness2.blockingDependencies).toEqual(["BACK-1"]);
	});

	it("respects custom configured terminal statuses (e.g. Closed)", () => {
		const customStatuses = ["Open", "In Review", "Closed"];
		const dep = makeTask("BACK-1", "Closed");
		const task = makeTask("BACK-2", "Open", ["BACK-1"]);

		const readiness = getTaskReadiness(task, [dep, task], customStatuses);
		expect(readiness.isReady).toBe(true);
		expect(readiness.isBlocked).toBe(false);
	});
});
