import { describe, expect, it } from "bun:test";
import type { McpServer } from "../mcp/server.ts";
import { TaskHandlers } from "../mcp/tools/tasks/handlers.ts";
import type { Task, TaskSearchResult } from "../types/index.ts";

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

	it("filters cross-branch tasks out of task_search", async () => {
		const searchResults: TaskSearchResult[] = [
			{ type: "task", task: localTask, score: 0.1 },
			{ type: "task", task: remoteTask, score: 0.2 },
		];

		const handlers = new TaskHandlers({
			getSearchService: async () => ({
				search: () => searchResults,
			}),
			filesystem: {
				loadConfig: async () => mockConfig,
			},
		} as unknown as McpServer);

		const result = await handlers.searchTasks({ query: "task" });
		const text = (result.content ?? [])
			.map((c) => (typeof c === "object" && c && "text" in c ? c.text : ""))
			.join("\n");

		expect(text).toContain("task-1 - Local task");
		expect(text).not.toContain("task-2 - Remote task");
	});
});
