import { describe, expect, it, mock } from "bun:test";
import { BacklogClient } from "./backlog.ts";

describe("BacklogClient", () => {
	describe("parseTaskList", () => {
		it("should parse task list output correctly", async () => {
			const client = new BacklogClient();
			const mockOutput = `task-1 - First Task (To Do) [@alice] [frontend,bug] [high]
task-2 - Second Task (In Progress) [@bob]
task-3 - Third Task (Done)`;

			// Access private method through type assertion for testing
			const tasks = (client as unknown as { parseTaskList: (output: string) => unknown[] }).parseTaskList(mockOutput);

			expect(tasks).toHaveLength(3);
			expect(tasks[0]).toMatchObject({
				id: "task-1",
				title: "First Task",
				status: "To Do",
				assignee: "alice",
				labels: ["frontend", "bug"],
				priority: "high",
			});
		});

		it("should handle empty output", async () => {
			const client = new BacklogClient();
			const tasks = (client as unknown as { parseTaskList: (output: string) => unknown[] }).parseTaskList("");
			expect(tasks).toHaveLength(0);
		});
	});

	describe("parseTaskDetail", () => {
		it("should parse task detail output correctly", async () => {
			const client = new BacklogClient();
			const mockOutput = `Task task-42 - Test Task
==================================================

Status: ○ To Do
Assignee: @alice
Labels: backend, api
Priority: high
Created: 2025-01-01 10:00
Updated: 2025-01-02 15:30

Description:
--------------------------------------------------
This is a test task

Acceptance Criteria:
--------------------------------------------------
- [ ] #1 First criterion
- [x] #2 Second criterion
- [ ] #3 Third criterion

Implementation Plan:
--------------------------------------------------
1. Step one
2. Step two`;

			const task = (client as unknown as { parseTaskDetail: (output: string) => unknown }).parseTaskDetail(mockOutput);

			expect(task).toMatchObject({
				id: "task-42",
				title: "Test Task",
				status: "To Do",
				assignee: "alice",
				labels: ["backend", "api"],
				priority: "high",
				description: "This is a test task",
			});
		});

		it("should parse acceptance criteria correctly", async () => {
			const client = new BacklogClient();
			const mockOutput = `Task task-1 - Test
==================================================

Status: ○ To Do

Acceptance Criteria:
--------------------------------------------------
- [ ] #1 First criterion
- [x] #2 Second criterion`;

			const task = (
				client as unknown as { parseTaskDetail: (output: string) => { acceptanceCriteria: unknown[] } }
			).parseTaskDetail(mockOutput);

			expect(task.acceptanceCriteria).toHaveLength(2);
			expect(task.acceptanceCriteria?.[0]).toMatchObject({
				index: 1,
				text: "First criterion",
				checked: false,
			});
			expect(task.acceptanceCriteria?.[1]).toMatchObject({
				index: 2,
				text: "Second criterion",
				checked: true,
			});
		});
	});

	describe("updateTask", () => {
		it("should build correct command arguments", async () => {
			const client = new BacklogClient();

			// Mock the execute method
			const executeMock = mock(() => Promise.resolve(""));
			(client as unknown as { execute: unknown }).execute = executeMock;

			await client.updateTask("task-1", {
				title: "New Title",
				status: "In Progress",
				assignee: "alice",
				checkAc: [1, 2],
				uncheckAc: [3],
			});

			expect(executeMock).toHaveBeenCalledWith([
				"task",
				"edit",
				"task-1",
				"-t",
				"New Title",
				"-s",
				"In Progress",
				"-a",
				"alice",
				"--check-ac",
				"1",
				"--check-ac",
				"2",
				"--uncheck-ac",
				"3",
			]);
		});
	});

	describe("listTasks", () => {
		it("should build correct command with filters", async () => {
			const client = new BacklogClient();

			const executeMock = mock(() => Promise.resolve(""));
			(client as unknown as { execute: unknown }).execute = executeMock;

			await client.listTasks({
				status: "To Do",
				assignee: "alice",
				labels: ["backend", "api"],
				priority: "high",
			});

			expect(executeMock).toHaveBeenCalledWith([
				"task",
				"list",
				"--plain",
				"-s",
				"To Do",
				"-a",
				"alice",
				"-l",
				"backend,api",
				"--priority",
				"high",
			]);
		});
	});
});
