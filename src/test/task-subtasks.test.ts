import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { createTaskHierarchy, findTopLevelTasks, type TaskHierarchy } from "../utils/task-subtasks.ts";

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

const ids = (tasks: readonly Task[]) => tasks.map((task) => task.id);

/** The tasks of a group a person can reach by opening every level under its top-level tasks, in that order. */
function reachableFrom(topLevel: readonly Task[], groupTasks: readonly Task[], hierarchy: TaskHierarchy): string[] {
	const inGroup = new Set(groupTasks);
	const reached = new Set<Task>();
	const open = (task: Task) => {
		if (reached.has(task)) return;
		reached.add(task);
		for (const subtask of hierarchy.subtasksOf(task)) if (inGroup.has(subtask)) open(subtask);
	};
	for (const task of topLevel) open(task);
	return ids([...reached]);
}

describe("createTaskHierarchy", () => {
	it("lists only direct subtasks, in task ID order", () => {
		const tasks = [
			makeTask("TASK-5", "To Do"),
			makeTask("TASK-5.10", "To Do", "TASK-5"),
			makeTask("TASK-5.2", "Done", "TASK-5"),
			makeTask("TASK-5.2.1", "Done", "TASK-5.2"),
			makeTask("TASK-6", "To Do"),
		];
		const hierarchy = createTaskHierarchy(tasks);

		expect(ids(hierarchy.subtasksOf(tasks[0] as Task))).toEqual(["TASK-5.2", "TASK-5.10"]);
		expect(ids(hierarchy.subtasksOf(tasks[2] as Task))).toEqual(["TASK-5.2.1"]);
		expect(hierarchy.subtasksOf(tasks[4] as Task)).toEqual([]);
	});

	it("matches parent IDs that differ only by zero padding or letter case", () => {
		const tasks = [
			makeTask("TASK-7", "To Do"),
			makeTask("TASK-7.1", "Done", "task-007"),
			makeTask("TASK-7.2", "To Do", "TASK-7"),
		];
		const hierarchy = createTaskHierarchy(tasks);

		expect(ids(hierarchy.subtasksOf(tasks[0] as Task))).toEqual(["TASK-7.1", "TASK-7.2"]);
		expect(hierarchy.parentOf(tasks[1] as Task)).toBe(tasks[0] as Task);
	});

	it("matches a parent ID written without its prefix by the subtask's own prefix", () => {
		// Archived task files keep the IDs they were written with, so an old file can name its parent by number only.
		const tasks = [makeTask("JIRA-5", "To Do"), makeTask("BACK-5", "To Do"), makeTask("BACK-5.1", "Done", "5")];
		const hierarchy = createTaskHierarchy(tasks);

		expect(ids(hierarchy.subtasksOf(tasks[1] as Task))).toEqual(["BACK-5.1"]);
		expect(hierarchy.subtasksOf(tasks[0] as Task)).toEqual([]);
		expect(hierarchy.parentOf(tasks[2] as Task)).toBe(tasks[1] as Task);
	});

	it("has no parent for a task whose parent is not in the list", () => {
		const orphan = makeTask("TASK-4.1", "To Do", "TASK-4");
		expect(createTaskHierarchy([orphan]).parentOf(orphan)).toBeNull();
	});
});

describe("findTopLevelTasks", () => {
	it("keeps grandchildren of the same status reachable under their parent (#1260)", () => {
		const group = [
			makeTask("TASK-1", "To Do"),
			makeTask("TASK-1.1", "To Do", "TASK-1"),
			makeTask("TASK-1.1.1", "To Do", "TASK-1.1"),
		];
		const hierarchy = createTaskHierarchy(group);
		const topLevel = findTopLevelTasks(group, hierarchy);

		expect(ids(topLevel)).toEqual(["TASK-1"]);
		expect(reachableFrom(topLevel, group, hierarchy)).toEqual(["TASK-1", "TASK-1.1", "TASK-1.1.1"]);
		// Tasks are matched by canonical ID, not by object, so a group of copies nests the same way.
		expect(
			ids(
				findTopLevelTasks(
					group.map((task) => ({ ...task })),
					hierarchy,
				),
			),
		).toEqual(["TASK-1"]);
	});

	it("reaches every level of a chain five levels deep", () => {
		const chain = ["TASK-2", "TASK-2.1", "TASK-2.1.1", "TASK-2.1.1.1", "TASK-2.1.1.1.1", "TASK-2.1.1.1.1.1"];
		const group = chain.map((id, index) => makeTask(id, "To Do", index === 0 ? undefined : chain[index - 1]));
		const hierarchy = createTaskHierarchy(group);
		const topLevel = findTopLevelTasks(group, hierarchy);

		expect(ids(topLevel)).toEqual(["TASK-2"]);
		expect(reachableFrom(topLevel, group, hierarchy)).toEqual(chain);
	});

	it("keeps a task at the top level when its parent is in another group or filtered out", () => {
		const parent = makeTask("TASK-3", "To Do");
		const otherStatus = makeTask("TASK-3.1", "In Progress", "TASK-3");
		const sameStatus = makeTask("TASK-3.2", "In Progress", "TASK-3.1");
		const hierarchy = createTaskHierarchy([parent, otherStatus, sameStatus]);

		expect(ids(findTopLevelTasks([otherStatus, sameStatus], hierarchy))).toEqual(["TASK-3.1"]);
		// TASK-3.1 is filtered out of the group, so TASK-3.2 has no parent in it.
		expect(ids(findTopLevelTasks([sameStatus], hierarchy))).toEqual(["TASK-3.2"]);
	});

	it("shows every task of a hand-edited loop of parents", () => {
		const group = [
			makeTask("TASK-8", "To Do", "TASK-9"),
			makeTask("TASK-9", "To Do", "TASK-8"),
			makeTask("TASK-9.1", "To Do", "TASK-9"),
		];
		const hierarchy = createTaskHierarchy(group);
		const topLevel = findTopLevelTasks(group, hierarchy);

		expect(new Set(reachableFrom(topLevel, group, hierarchy))).toEqual(new Set(ids(group)));
	});
});
