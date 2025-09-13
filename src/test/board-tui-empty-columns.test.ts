import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";

// Mock the blessed library since we can't test the actual TUI rendering
// But we can test the logic for determining which columns to display

describe("TUI board empty column handling", () => {
	// Helper function to simulate the column determination logic from board.ts
	function getDisplayedColumns(tasks: Task[], configuredStatuses: string[]): string[] {
		const canonicalByLower = new Map<string, string>();
		for (const s of configuredStatuses) {
			if (!s) continue;
			canonicalByLower.set(s.toLowerCase(), s);
		}

		const tasksByStatus = new Map<string, Task[]>();
		// Initialize configured statuses
		for (const s of configuredStatuses) tasksByStatus.set(s, []);

		for (const t of tasks) {
			const raw = (t.status || "").trim();
			if (!raw) continue;
			const canonical = canonicalByLower.get(raw.toLowerCase()) || raw;
			const list = tasksByStatus.get(canonical) || [];
			list.push(t);
			tasksByStatus.set(canonical, list);
		}

		// Determine displayed columns: all configured statuses (regardless of task count), then any unknown statuses with tasks
		const unknownWithTasks = Array.from(tasksByStatus.keys()).filter(
			(s) => !configuredStatuses.includes(s) && (tasksByStatus.get(s) ?? []).length > 0,
		);
		return [...configuredStatuses, ...unknownWithTasks];
	}

	it("shows all configured statuses even when empty", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Test task",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];
		const configuredStatuses = ["To Do", "In Progress", "Done"];

		const displayedColumns = getDisplayedColumns(tasks, configuredStatuses);

		// Should show all configured statuses, even empty ones
		expect(displayedColumns).toEqual(["To Do", "In Progress", "Done"]);
		expect(displayedColumns.includes("In Progress")).toBe(true);
		expect(displayedColumns.includes("Done")).toBe(true);
	});

	it("preserves configured column order", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Done task",
				status: "Done",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-2",
				title: "Todo task",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];
		const configuredStatuses = ["To Do", "In Progress", "Review", "Done"];

		const displayedColumns = getDisplayedColumns(tasks, configuredStatuses);

		// Should maintain the configured order
		expect(displayedColumns).toEqual(["To Do", "In Progress", "Review", "Done"]);
		expect(displayedColumns.indexOf("To Do")).toBeLessThan(displayedColumns.indexOf("In Progress"));
		expect(displayedColumns.indexOf("In Progress")).toBeLessThan(displayedColumns.indexOf("Review"));
		expect(displayedColumns.indexOf("Review")).toBeLessThan(displayedColumns.indexOf("Done"));
	});

	it("adds unknown statuses after configured ones", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Blocked task",
				status: "Blocked",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-2",
				title: "Testing task",
				status: "Testing",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-3",
				title: "Done task",
				status: "Done",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];
		const configuredStatuses = ["To Do", "In Progress", "Done"];

		const displayedColumns = getDisplayedColumns(tasks, configuredStatuses);

		// Should have configured statuses first, then unknown ones
		expect(displayedColumns.length).toBe(5); // 3 configured + 2 unknown
		expect(displayedColumns.slice(0, 3)).toEqual(["To Do", "In Progress", "Done"]);
		expect(displayedColumns.slice(3)).toEqual(expect.arrayContaining(["Blocked", "Testing"]));
	});

	it("handles case-insensitive status matching", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Test task",
				status: "to do", // lowercase
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
			{
				id: "task-2",
				title: "Test task 2",
				status: "IN PROGRESS", // uppercase
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];
		const configuredStatuses = ["To Do", "In Progress", "Done"];

		const displayedColumns = getDisplayedColumns(tasks, configuredStatuses);

		// Should only show configured statuses (case-insensitive matching)
		expect(displayedColumns).toEqual(["To Do", "In Progress", "Done"]);
	});

	it("handles no tasks at all", () => {
		const tasks: Task[] = [];
		const configuredStatuses = ["To Do", "In Progress", "Done"];

		const displayedColumns = getDisplayedColumns(tasks, configuredStatuses);

		// Should still show all configured columns even with no tasks
		expect(displayedColumns).toEqual(["To Do", "In Progress", "Done"]);
	});

	it("handles empty configuration", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Test task",
				status: "Some Status",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];
		const configuredStatuses: string[] = [];

		const displayedColumns = getDisplayedColumns(tasks, configuredStatuses);

		// Should only show unknown statuses that have tasks
		expect(displayedColumns).toEqual(["Some Status"]);
	});

	it("filters out empty unknown statuses while preserving configured empty ones", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Todo task",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				body: "",
			},
		];
		const configuredStatuses = ["To Do", "In Progress", "Done"];

		// Mock scenario where some unknown status exists but has no tasks
		const displayedColumns = getDisplayedColumns(tasks, configuredStatuses);

		// Should show all configured (even empty) but not unknown empty ones
		expect(displayedColumns).toEqual(["To Do", "In Progress", "Done"]);
	});
});
