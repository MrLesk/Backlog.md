import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { findDirectSubtasks, findParentTask, summarizeSubtaskProgress } from "../utils/task-subtasks.ts";

const STATUSES = ["To Do", "In Progress", "Done"] as const;

function makeTask(id: string, status: string, parentTaskId?: string): Task {
	return {
		id,
		title: `Task ${id}`,
		status,
		assignee: [],
		createdDate: "2026-08-17",
		labels: [],
		dependencies: [],
		rawContent: "",
		...(parentTaskId ? { parentTaskId } : {}),
	} as Task;
}

describe("summarizeSubtaskProgress", () => {
	it("returns null when the task has no subtasks", () => {
		const tasks = [makeTask("TASK-1", "To Do"), makeTask("TASK-2", "Done")];
		expect(summarizeSubtaskProgress(tasks[0] as Task, tasks, STATUSES)).toBeNull();
	});

	it("counts only direct children, not grandchildren", () => {
		const tasks = [
			makeTask("TASK-2", "In Progress"),
			makeTask("TASK-2.1", "Done", "TASK-2"),
			makeTask("TASK-2.2", "Done", "TASK-2"),
			makeTask("TASK-2.3", "Done", "TASK-2"),
			makeTask("TASK-2.4", "Done", "TASK-2"),
			makeTask("TASK-2.5", "Done", "TASK-2"),
			makeTask("TASK-2.6", "To Do", "TASK-2"),
			makeTask("TASK-2.6.1", "Done", "TASK-2.6"),
			makeTask("TASK-2.6.2", "To Do", "TASK-2.6"),
			makeTask("TASK-2.6.3", "To Do", "TASK-2.6"),
			makeTask("TASK-2.6.4", "To Do", "TASK-2.6"),
		];
		expect(summarizeSubtaskProgress(tasks[0] as Task, tasks, STATUSES)).toEqual({ total: 6, completed: 5 });
		expect(summarizeSubtaskProgress(tasks[6] as Task, tasks, STATUSES)).toEqual({ total: 4, completed: 1 });
	});

	it("treats only the configured terminal status as complete", () => {
		const tasks = [
			makeTask("TASK-1", "To Do"),
			makeTask("TASK-1.1", "Done", "TASK-1"),
			makeTask("TASK-1.2", "In Progress", "TASK-1"),
			makeTask("TASK-1.3", "To Do", "TASK-1"),
		];
		expect(summarizeSubtaskProgress(tasks[0] as Task, tasks, STATUSES)).toEqual({ total: 3, completed: 1 });
	});

	it("honours a custom terminal status from project config", () => {
		const customStatuses = ["Backlog", "Doing", "Shipped"] as const;
		const tasks = [
			makeTask("TASK-1", "Doing"),
			makeTask("TASK-1.1", "Shipped", "TASK-1"),
			makeTask("TASK-1.2", "Done", "TASK-1"),
		];
		expect(summarizeSubtaskProgress(tasks[0] as Task, tasks, customStatuses)).toEqual({ total: 2, completed: 1 });
	});

	it("matches parent ids that differ only by zero padding or case", () => {
		const tasks = [
			makeTask("TASK-7", "To Do"),
			makeTask("TASK-7.1", "Done", "task-007"),
			makeTask("TASK-7.2", "To Do", "TASK-7"),
		];
		expect(summarizeSubtaskProgress(tasks[0] as Task, tasks, STATUSES)).toEqual({ total: 2, completed: 1 });
	});
});

describe("findDirectSubtasks", () => {
	it("returns only direct children, sorted hierarchically", () => {
		const tasks = [
			makeTask("TASK-5", "To Do"),
			makeTask("TASK-5.10", "To Do", "TASK-5"),
			makeTask("TASK-5.2", "Done", "TASK-5"),
			makeTask("TASK-5.2.1", "Done", "TASK-5.2"),
			makeTask("TASK-6", "To Do"),
		];
		expect(findDirectSubtasks(tasks[0] as Task, tasks).map((t) => t.id)).toEqual(["TASK-5.2", "TASK-5.10"]);
	});

	it("returns an empty array when there are no children", () => {
		const tasks = [makeTask("TASK-1", "To Do")];
		expect(findDirectSubtasks(tasks[0] as Task, tasks)).toEqual([]);
	});
});

describe("findParentTask", () => {
	it("resolves the parent task", () => {
		const tasks = [makeTask("TASK-3", "To Do"), makeTask("TASK-3.1", "To Do", "TASK-3")];
		expect(findParentTask(tasks[1] as Task, tasks)?.id).toBe("TASK-3");
	});

	it("returns null when the task has no parent", () => {
		const tasks = [makeTask("TASK-3", "To Do")];
		expect(findParentTask(tasks[0] as Task, tasks)).toBeNull();
	});

	it("returns null when the parent is missing from the corpus", () => {
		const tasks = [makeTask("TASK-3.1", "To Do", "TASK-3")];
		expect(findParentTask(tasks[0] as Task, tasks)).toBeNull();
	});
});
