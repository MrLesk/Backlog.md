import { describe, expect, it } from "bun:test";
import type { McpServer } from "../mcp/server.ts";
import { TaskHandlers } from "../mcp/tools/tasks/handlers.ts";
import type { Task } from "../types/index.ts";

const localTask: Task = {
	id: "task-1",
	title: "Local task",
	status: "To Do",
	assignee: [],
	createdDate: "2025-12-03",
	labels: [],
	dependencies: [],
	source: "local",
};

const remoteTask: Task = {
	id: "task-2",
	title: "Remote task",
	status: "To Do",
	assignee: [],
	createdDate: "2025-12-03",
	labels: [],
	dependencies: [],
	source: "remote",
};

const completedTask: Task = {
	id: "task-3",
	title: "Completed task",
	status: "Done",
	assignee: [],
	createdDate: "2025-12-03",
	labels: [],
	dependencies: [],
	source: "completed",
};

describe("MCP task tools local filtering", () => {
	const mockConfig = { statuses: ["To Do", "In Progress", "Done"] };

	it("filters cross-branch tasks out of task_list", async () => {
		const handlers = new TaskHandlers({
			queryTasks: async () => [localTask, remoteTask],
			filesystem: {
				loadConfig: async () => mockConfig,
			},
		} as unknown as McpServer);

		const result = await handlers.listTasks({});
		const text = (result.content ?? [])
			.map((c) => (typeof c === "object" && c && "text" in c ? c.text : ""))
			.join("\n");

		expect(text).toContain("task-1 - Local task");
		expect(text).not.toContain("task-2 - Remote task");
	});

	it("searches active and completed working-copy tasks without loading branches", async () => {
		let crossBranchLoads = 0;
		let includeCompleted = false;
		const laterActiveTask = { ...localTask, id: "task-20" };
		const earlierCompletedTask = { ...completedTask, id: "task-1" };
		const handlers = new TaskHandlers({
			loadTasks: async () => {
				crossBranchLoads++;
				return [localTask, remoteTask];
			},
			loadWorkingCopyTasks: async (requestedIncludeCompleted = false) => {
				includeCompleted = requestedIncludeCompleted;
				return [earlierCompletedTask, laterActiveTask];
			},
		} as unknown as McpServer);

		const results = [await handlers.searchTasks({ query: "task" }), await handlers.searchTasks({ query: "task" })];
		const texts = results.map((result) =>
			(result.content ?? []).map((c) => (typeof c === "object" && c && "text" in c ? c.text : "")).join("\n"),
		);

		for (const text of texts) {
			expect(text).toContain("task-20 - Local task");
			expect(text).toContain("task-1 - Completed task");
			expect(text).not.toContain("task-2 - Remote task");
		}

		const limitedResult = await handlers.searchTasks({ query: "task", limit: 1 });
		const limitedText = (limitedResult.content ?? [])
			.map((c) => (typeof c === "object" && c && "text" in c ? c.text : ""))
			.join("\n");
		expect(limitedText).toContain("task-1 - Completed task");
		expect(limitedText).not.toContain("task-20 - Local task");
		expect(crossBranchLoads).toBe(0);
		expect(includeCompleted).toBe(true);
	});
});
