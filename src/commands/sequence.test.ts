import { describe, expect, it, mock } from "bun:test";
import type { Core } from "../core/backlog.ts";
import type { Sequence, Task } from "../types/index.ts";
import { displaySequencesPlain, listSequences } from "./sequence.ts";

describe("sequence command", () => {
	describe("displaySequencesPlain", () => {
		it("should display message when no sequences", () => {
			const consoleSpy = mock();
			const originalLog = console.log;
			console.log = consoleSpy;

			displaySequencesPlain([]);

			expect(consoleSpy).toHaveBeenCalledWith("No tasks found to compute sequences.");

			console.log = originalLog;
		});

		it("should display sequences with tasks", () => {
			const consoleSpy = mock();
			const originalLog = console.log;
			console.log = consoleSpy;

			const sequences: Sequence[] = [
				{
					number: 1,
					tasks: [
						{ id: "task-1", title: "First task", priority: "high" } as Task,
						{ id: "task-2", title: "Second task" } as Task,
					],
				},
				{
					number: 2,
					tasks: [{ id: "task-3", title: "Third task", priority: "medium" } as Task],
				},
			];

			displaySequencesPlain(sequences);

			expect(consoleSpy).toHaveBeenCalledWith("Task Sequences:");
			expect(consoleSpy).toHaveBeenCalledWith("Sequence 1:");
			expect(consoleSpy).toHaveBeenCalledWith("  [HIGH] task-1 - First task");
			expect(consoleSpy).toHaveBeenCalledWith("  task-2 - Second task");
			expect(consoleSpy).toHaveBeenCalledWith("Sequence 2:");
			expect(consoleSpy).toHaveBeenCalledWith("  [MEDIUM] task-3 - Third task");

			console.log = originalLog;
		});
	});

	describe("listSequences", () => {
		it("should display message when no tasks found", async () => {
			const consoleSpy = mock();
			const originalLog = console.log;
			console.log = consoleSpy;

			const mockCore = {
				filesystem: {
					listTasks: () => Promise.resolve([]),
				},
			} as unknown as Core;

			await listSequences(mockCore, { plain: true });

			expect(consoleSpy).toHaveBeenCalledWith("No tasks found.");

			console.log = originalLog;
		});

		it("should compute and display sequences in plain mode", async () => {
			const consoleSpy = mock();
			const originalLog = console.log;
			console.log = consoleSpy;

			const tasks: Task[] = [
				{
					id: "task-1",
					title: "Task 1",
					dependencies: [],
					status: "To Do",
					assignee: [],
					createdDate: "2025-01-01",
					labels: [],
					body: "",
				},
				{
					id: "task-2",
					title: "Task 2",
					dependencies: ["task-1"],
					status: "To Do",
					assignee: [],
					createdDate: "2025-01-01",
					labels: [],
					body: "",
				},
			];

			const mockCore = {
				filesystem: {
					listTasks: () => Promise.resolve(tasks),
				},
			} as unknown as Core;

			await listSequences(mockCore, { plain: true });

			expect(consoleSpy).toHaveBeenCalledWith("Task Sequences:");
			expect(consoleSpy).toHaveBeenCalledWith("Sequence 1:");
			expect(consoleSpy).toHaveBeenCalledWith("  task-1 - Task 1");
			expect(consoleSpy).toHaveBeenCalledWith("Sequence 2:");
			expect(consoleSpy).toHaveBeenCalledWith("  task-2 - Task 2");

			console.log = originalLog;
		});
	});
});
