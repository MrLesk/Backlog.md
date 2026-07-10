import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import {
	detectDuplicateTaskIds,
	formatDuplicateTaskIdSummary,
	formatDuplicateTaskIdWarning,
} from "../utils/duplicate-detection.ts";

function makeTask(id: string, title: string): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
	};
}

function makeTaskWithPath(id: string, title: string, filePath: string): Task {
	return {
		...makeTask(id, title),
		filePath,
	};
}

describe("detectDuplicateTaskIds", () => {
	it("returns empty array when no tasks", () => {
		expect(detectDuplicateTaskIds([])).toEqual([]);
	});

	it("returns empty array when all IDs are unique", () => {
		const tasks = [makeTask("TASK-1", "A"), makeTask("TASK-2", "B"), makeTask("TASK-3", "C")];
		expect(detectDuplicateTaskIds(tasks)).toEqual([]);
	});

	it("detects two tasks with the same ID", () => {
		const tasks = [makeTask("TASK-123", "Fix the thing"), makeTask("TASK-123", "Add new feature")];
		const groups = detectDuplicateTaskIds(tasks);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.id).toBe("TASK-123");
		expect(groups[0]?.tasks).toHaveLength(2);
	});

	it("detects multiple duplicate groups", () => {
		const tasks = [
			makeTask("TASK-81", "Task A"),
			makeTask("TASK-81", "Task B"),
			makeTask("TASK-123", "Task C"),
			makeTask("TASK-123", "Task D"),
			makeTask("TASK-200", "Task E"),
		];
		const groups = detectDuplicateTaskIds(tasks);
		expect(groups).toHaveLength(2);
		const ids = groups.map((g) => g.id.toLowerCase());
		expect(ids).toContain("task-81");
		expect(ids).toContain("task-123");
	});

	it("treats IDs case-insensitively", () => {
		const tasks = [makeTask("TASK-1", "Uppercase"), makeTask("task-1", "Lowercase")];
		const groups = detectDuplicateTaskIds(tasks);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.tasks).toHaveLength(2);
	});

	it("treats zero-padded numeric IDs as the same identity", () => {
		const tasks = [makeTask("TASK-1", "Plain"), makeTask("TASK-01", "Padded")];
		const groups = detectDuplicateTaskIds(tasks);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.id).toBe("TASK-1");
		expect(groups[0]?.tasks).toHaveLength(2);
	});

	it("keeps adjacent huge IDs distinct while grouping their padded spelling", () => {
		const groups = detectDuplicateTaskIds([
			makeTask("TASK-9007199254740992", "Huge"),
			makeTask("TASK-09007199254740992", "Huge padded"),
			makeTask("TASK-9007199254740993", "Huge neighbor"),
		]);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.id).toBe("TASK-9007199254740992");
		expect(groups[0]?.tasks.map((task) => task.title).sort()).toEqual(["Huge", "Huge padded"]);
	});

	it("does not flag three unique tasks as duplicates", () => {
		const tasks = [makeTask("TASK-1", "A"), makeTask("TASK-2", "B"), makeTask("TASK-3", "C")];
		expect(detectDuplicateTaskIds(tasks)).toHaveLength(0);
	});

	it("handles three tasks sharing the same ID", () => {
		const tasks = [makeTask("TASK-5", "A"), makeTask("TASK-5", "B"), makeTask("TASK-5", "C")];
		const groups = detectDuplicateTaskIds(tasks);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.tasks).toHaveLength(3);
	});
});

describe("formatDuplicateTaskIdWarning", () => {
	it("lists exact paths and points humans to the canonical CLI repair", () => {
		const groups = [
			{
				id: "TASK-1",
				tasks: [
					makeTaskWithPath("TASK-1", "A", "/repo/backlog/tasks/task-1 - A.md"),
					makeTaskWithPath("TASK-1", "B", "/repo/backlog/tasks/task-1 - B.md"),
				],
			},
		];
		const warning = formatDuplicateTaskIdWarning(groups);
		expect(warning).toContain("TASK-1");
		expect(warning).toContain("/repo/backlog/tasks/task-1 - A.md");
		expect(warning).toContain("/repo/backlog/tasks/task-1 - B.md");
		expect(warning).toContain("backlog doctor");
		expect(warning).not.toContain("prompt");
		expect(warning).not.toContain("agent");
	});

	it("provides a concise TUI summary", () => {
		const groups = [{ id: "TASK-1", tasks: [makeTask("TASK-1", "A"), makeTask("TASK-01", "B")] }];
		expect(formatDuplicateTaskIdSummary(groups)).toBe(
			"Duplicate task IDs detected: TASK-1. Run 'backlog doctor' to preview a safe repair.",
		);
	});
});
