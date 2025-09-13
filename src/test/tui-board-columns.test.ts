import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";

describe("TUI Board Column Logic", () => {
	const createTestTask = (id: string, status = "To Do"): Task => ({
		id,
		title: `Test Task ${id}`,
		status,
		assignee: [],
		createdDate: "2025-01-08",
		labels: ["test"],
		dependencies: [],
		body: `This is test task ${id}`,
	});

	it("should include all configured statuses even when empty", () => {
		const tasks: Task[] = [createTestTask("task-1", "In Progress")];
		const statuses = ["To Do", "In Progress", "Done"];

		// Build case-insensitive mapping from configured statuses to their canonical display value
		const canonicalByLower = new Map<string, string>();
		for (const s of statuses) {
			if (!s) continue;
			canonicalByLower.set(s.toLowerCase(), s);
		}

		const tasksByStatus = new Map<string, Task[]>(); // key is display/canonical status label
		// Initialize configured statuses
		for (const s of statuses) tasksByStatus.set(s, []);

		for (const t of tasks) {
			const raw = (t.status || "").trim();
			if (!raw) continue;
			const canonical = canonicalByLower.get(raw.toLowerCase()) || raw;
			const list = tasksByStatus.get(canonical) || [];
			list.push(t);
			tasksByStatus.set(canonical, list);
		}

		// NEW LOGIC: ALL configured statuses first, then any unknown statuses with tasks
		const unknownWithTasks = Array.from(tasksByStatus.keys()).filter(
			(s) => !statuses.includes(s) && (tasksByStatus.get(s) ?? []).length > 0,
		);
		const displayedStatuses = [...statuses, ...unknownWithTasks];

		// Should include all configured statuses
		expect(displayedStatuses).toContain("To Do"); // Empty column
		expect(displayedStatuses).toContain("In Progress"); // Has tasks
		expect(displayedStatuses).toContain("Done"); // Empty column
		expect(displayedStatuses).toHaveLength(3);

		// Check empty columns have empty arrays
		expect(tasksByStatus.get("To Do")).toEqual([]);
		expect(tasksByStatus.get("In Progress")).toHaveLength(1);
		expect(tasksByStatus.get("Done")).toEqual([]);
	});

	it("should preserve configured order and add unknown statuses at end", () => {
		const tasks: Task[] = [
			createTestTask("task-1", "To Do"),
			createTestTask("task-2", "Custom Status"), // Unknown status
			createTestTask("task-3", "Done"),
		];
		const statuses = ["To Do", "In Progress", "Done"];

		// Build case-insensitive mapping from configured statuses to their canonical display value
		const canonicalByLower = new Map<string, string>();
		for (const s of statuses) {
			if (!s) continue;
			canonicalByLower.set(s.toLowerCase(), s);
		}

		const tasksByStatus = new Map<string, Task[]>(); // key is display/canonical status label
		// Initialize configured statuses
		for (const s of statuses) tasksByStatus.set(s, []);

		for (const t of tasks) {
			const raw = (t.status || "").trim();
			if (!raw) continue;
			const canonical = canonicalByLower.get(raw.toLowerCase()) || raw;
			const list = tasksByStatus.get(canonical) || [];
			list.push(t);
			tasksByStatus.set(canonical, list);
		}

		// NEW LOGIC: ALL configured statuses first, then any unknown statuses with tasks
		const unknownWithTasks = Array.from(tasksByStatus.keys()).filter(
			(s) => !statuses.includes(s) && (tasksByStatus.get(s) ?? []).length > 0,
		);
		const displayedStatuses = [...statuses, ...unknownWithTasks];

		// Should preserve order: configured statuses first, unknown after
		expect(displayedStatuses).toEqual(["To Do", "In Progress", "Done", "Custom Status"]);

		// Check task distribution
		expect(tasksByStatus.get("To Do")).toHaveLength(1);
		expect(tasksByStatus.get("In Progress")).toEqual([]); // Empty but shown
		expect(tasksByStatus.get("Done")).toHaveLength(1);
		expect(tasksByStatus.get("Custom Status")).toHaveLength(1);
	});

	it("should show all columns even when no tasks exist at all", () => {
		const tasks: Task[] = []; // No tasks
		const statuses = ["To Do", "In Progress", "Done"];

		// Build case-insensitive mapping from configured statuses to their canonical display value
		const canonicalByLower = new Map<string, string>();
		for (const s of statuses) {
			if (!s) continue;
			canonicalByLower.set(s.toLowerCase(), s);
		}

		const tasksByStatus = new Map<string, Task[]>(); // key is display/canonical status label
		// Initialize configured statuses
		for (const s of statuses) tasksByStatus.set(s, []);

		for (const t of tasks) {
			const raw = (t.status || "").trim();
			if (!raw) continue;
			const canonical = canonicalByLower.get(raw.toLowerCase()) || raw;
			const list = tasksByStatus.get(canonical) || [];
			list.push(t);
			tasksByStatus.set(canonical, list);
		}

		// NEW LOGIC: ALL configured statuses first, then any unknown statuses with tasks
		const unknownWithTasks = Array.from(tasksByStatus.keys()).filter(
			(s) => !statuses.includes(s) && (tasksByStatus.get(s) ?? []).length > 0,
		);
		const displayedStatuses = [...statuses, ...unknownWithTasks];

		// Should still show all configured statuses
		expect(displayedStatuses).toEqual(["To Do", "In Progress", "Done"]);
		expect(displayedStatuses).toHaveLength(3);

		// All columns should be empty
		expect(tasksByStatus.get("To Do")).toEqual([]);
		expect(tasksByStatus.get("In Progress")).toEqual([]);
		expect(tasksByStatus.get("Done")).toEqual([]);
	});

	it("should handle case-insensitive status matching correctly", () => {
		const tasks: Task[] = [
			createTestTask("task-1", "to do"), // Lowercase variant
			createTestTask("task-2", "IN PROGRESS"), // Uppercase variant
		];
		const statuses = ["To Do", "In Progress", "Done"];

		// Build case-insensitive mapping from configured statuses to their canonical display value
		const canonicalByLower = new Map<string, string>();
		for (const s of statuses) {
			if (!s) continue;
			canonicalByLower.set(s.toLowerCase(), s);
		}

		const tasksByStatus = new Map<string, Task[]>(); // key is display/canonical status label
		// Initialize configured statuses
		for (const s of statuses) tasksByStatus.set(s, []);

		for (const t of tasks) {
			const raw = (t.status || "").trim();
			if (!raw) continue;
			const canonical = canonicalByLower.get(raw.toLowerCase()) || raw;
			const list = tasksByStatus.get(canonical) || [];
			list.push(t);
			tasksByStatus.set(canonical, list);
		}

		// NEW LOGIC: ALL configured statuses first, then any unknown statuses with tasks
		const unknownWithTasks = Array.from(tasksByStatus.keys()).filter(
			(s) => !statuses.includes(s) && (tasksByStatus.get(s) ?? []).length > 0,
		);
		const displayedStatuses = [...statuses, ...unknownWithTasks];

		// Should normalize to configured casing and show all columns
		expect(displayedStatuses).toEqual(["To Do", "In Progress", "Done"]);

		// Tasks should be properly grouped by canonical status
		expect(tasksByStatus.get("To Do")).toHaveLength(1);
		expect(tasksByStatus.get("In Progress")).toHaveLength(1);
		expect(tasksByStatus.get("Done")).toEqual([]); // Empty but shown
	});
});
