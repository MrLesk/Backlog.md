import { describe, expect, it } from "bun:test";
import { isReadOnlyTask, isWorkingCopyTask, type Task } from "../types/index.ts";

const task = (overrides: Partial<Task>): Task => ({
	id: "TASK-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	createdDate: "2025-01-01",
	labels: [],
	dependencies: [],
	...overrides,
});

describe("task read-only rule", () => {
	it.each([
		["a board task with no source", {}, true, false],
		["a board task", { source: "local" }, true, false],
		["an archived task", { source: "archived" }, true, true],
		["a task from another local branch", { source: "local-branch", branch: "feature" }, false, true],
		["a task from a remote branch", { source: "remote", branch: "feature" }, false, true],
		["a record that names another branch", { branch: "feature" }, true, true],
	] as const)("classifies %s", (_name, overrides, inWorkingCopy, readOnly) => {
		expect(isWorkingCopyTask(task(overrides))).toBe(inWorkingCopy);
		expect(isReadOnlyTask(task(overrides))).toBe(readOnly);
	});
});
