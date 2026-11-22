import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { detectDuplicateTaskIds } from "../utils/duplicate-detection.ts";

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

describe("detectDuplicateTaskIds", () => {
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
});
