import { describe, expect, it } from "bun:test";
import type { Core } from "../../core/backlog.ts";
import type { Task } from "../../types/index.ts";

// Mock Core with filesystem operations
const mockCore: Partial<Core> = {
	filesystem: {
		async listTasks(filter) {
			// Mock tasks for testing
			const mockTasks: Task[] = [
				{
					id: "task-1",
					title: "High priority task",
					status: "To Do",
					priority: "high",
					assignee: [],
					labels: [],
					acceptanceCriteria: [],
					createdDate: "2025-01-01",
				},
				{
					id: "task-2",
					title: "Medium priority task",
					status: "In Progress",
					priority: "medium",
					assignee: [],
					labels: [],
					acceptanceCriteria: [],
					createdDate: "2025-01-01",
				},
				{
					id: "task-3",
					title: "Low priority task",
					status: "Done",
					priority: "low",
					assignee: [],
					labels: [],
					acceptanceCriteria: [],
					createdDate: "2025-01-01",
				},
				{
					id: "task-4",
					title: "No priority task",
					status: "To Do",
					assignee: [],
					labels: [],
					acceptanceCriteria: [],
					createdDate: "2025-01-01",
				},
			];

			// Apply filters
			let filtered = [...mockTasks];

			if (filter?.status) {
				filtered = filtered.filter((t) => t.status.toLowerCase() === filter.status?.toLowerCase());
			}

			if (filter?.priority) {
				filtered = filtered.filter((t) => t.priority?.toLowerCase() === filter.priority?.toLowerCase());
			}

			return filtered;
		},
	} as any,
};

describe("Task filtering", () => {
	it("should filter by status", async () => {
		const result = await mockCore.filesystem?.listTasks({ status: "To Do" });
		expect(result).toHaveLength(2);
		expect(result?.[0]?.status).toBe("To Do");
		expect(result?.[1]?.status).toBe("To Do");
	});

	it("should filter by priority", async () => {
		const result = await mockCore.filesystem?.listTasks({ priority: "high" });
		expect(result).toHaveLength(1);
		expect(result?.[0]?.priority).toBe("high");
	});

	it("should filter by both status and priority", async () => {
		const result = await mockCore.filesystem?.listTasks({
			status: "In Progress",
			priority: "medium",
		});
		expect(result).toHaveLength(1);
		expect(result?.[0]?.status).toBe("In Progress");
		expect(result?.[0]?.priority).toBe("medium");
	});

	it("should return all tasks when no filter is applied", async () => {
		const result = await mockCore.filesystem?.listTasks();
		expect(result).toHaveLength(4);
	});

	it("should return empty array when filter matches no tasks", async () => {
		const result = await mockCore.filesystem?.listTasks({ status: "Nonexistent" });
		expect(result).toHaveLength(0);
	});
});
