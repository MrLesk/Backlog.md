import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { buildDuplicateCleanupPrompt, detectDuplicateTaskIds } from "../utils/duplicate-detection.ts";

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

describe("buildDuplicateCleanupPrompt", () => {
	it("includes all duplicate group IDs and titles in the prompt", () => {
		const groups = [
			{ id: "TASK-81", tasks: [makeTask("TASK-81", "Foo"), makeTask("TASK-81", "Bar")] },
			{ id: "TASK-123", tasks: [makeTask("TASK-123", "Baz"), makeTask("TASK-123", "Qux")] },
		];
		const prompt = buildDuplicateCleanupPrompt(groups);
		expect(prompt).toContain("TASK-81");
		expect(prompt).toContain("Foo");
		expect(prompt).toContain("Bar");
		expect(prompt).toContain("TASK-123");
		expect(prompt).toContain("Baz");
		expect(prompt).toContain("Qux");
	});

	it("mentions assigning new IDs in the prompt", () => {
		const groups = [{ id: "TASK-1", tasks: [makeTask("TASK-1", "A"), makeTask("TASK-1", "B")] }];
		const prompt = buildDuplicateCleanupPrompt(groups);
		expect(prompt.toLowerCase()).toContain("assign new unused ids");
	});

	it("includes file paths and repair workflow guidance in the prompt", () => {
		const groups = [
			{
				id: "TASK-1",
				tasks: [
					makeTaskWithPath("TASK-1", "A", "/repo/backlog/tasks/task-1 - A.md"),
					makeTaskWithPath("TASK-1", "B", "/repo/backlog/tasks/task-1 - B.md"),
				],
			},
		];
		const prompt = buildDuplicateCleanupPrompt(groups);
		expect(prompt).toContain("backlog instructions overview");
		expect(prompt).toContain("/repo/backlog/tasks/task-1 - A.md");
		expect(prompt).toContain("/repo/backlog/tasks/task-1 - B.md");
		expect(prompt).toContain("dependencies");
		expect(prompt).toContain("Do not delete");
	});
});
