import { describe, expect, test } from "bun:test";
import type { Task } from "../types/index.ts";
import { createTaskSearchIndex } from "../utils/task-search.ts";

const tasks: Task[] = [
	{
		id: "task-1",
		title: "Add auth",
		status: "To Do",
		labels: ["backend", "security"],
		assignee: [],
		createdDate: "2025-01-01",
		dependencies: [],
		modifiedFiles: ["src/server/auth.ts"],
	},
	{
		id: "task-2",
		title: "Fix button",
		status: "To Do",
		labels: ["ui"],
		assignee: [],
		createdDate: "2025-01-01",
		dependencies: [],
		modifiedFiles: ["src/web/components/Button.tsx"],
	},
	{
		id: "task-3",
		title: "Docs",
		status: "Done",
		labels: ["docs", "ui"],
		assignee: [],
		createdDate: "2025-01-01",
		dependencies: [],
		modifiedFiles: ["docs/search.md"],
	},
];

describe("createTaskSearchIndex label filtering", () => {
	test("filters tasks by single label", () => {
		const index = createTaskSearchIndex(tasks);
		const results = index.search({ labels: ["ui"] });
		expect(results.map((t) => t.id)).toEqual(["task-2", "task-3"]);
	});

	test("matches any of the selected labels", () => {
		const index = createTaskSearchIndex(tasks);
		const results = index.search({ labels: ["ui", "docs"] });
		expect(results.map((t) => t.id)).toEqual(["task-2", "task-3"]);
	});

	test("finds tasks by modified file query", () => {
		const index = createTaskSearchIndex(tasks);
		const results = index.search({ query: "components/Button.tsx" });
		expect(results.map((t) => t.id)).toEqual(["task-2"]);
	});

	test("filters tasks by modified file substring", () => {
		const index = createTaskSearchIndex(tasks);
		const results = index.search({ modifiedFiles: ["button"] });
		expect(results.map((t) => t.id)).toEqual(["task-2"]);
	});
});
