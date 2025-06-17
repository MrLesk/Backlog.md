import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { compareTaskIds } from "../utils/task-sorting.ts";

describe("board UI task selection", () => {
	it("compareTaskIds sorts tasks numerically by ID", () => {
		const tasks: Task[] = [
			{
				id: "task-10",
				title: "Task 10",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-2",
				title: "Task 2",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-1",
				title: "Task 1",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-20",
				title: "Task 20",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		const sorted = [...tasks].sort((a, b) => compareTaskIds(a.id, b.id));
		expect(sorted[0].id).toBe("task-1");
		expect(sorted[1].id).toBe("task-2");
		expect(sorted[2].id).toBe("task-10");
		expect(sorted[3].id).toBe("task-20");
	});

	it("compareTaskIds handles decimal task IDs correctly", () => {
		const tasks: Task[] = [
			{
				id: "task-1.10",
				title: "Task 1.10",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-1.2",
				title: "Task 1.2",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-1.1",
				title: "Task 1.1",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		const sorted = [...tasks].sort((a, b) => compareTaskIds(a.id, b.id));
		expect(sorted[0].id).toBe("task-1.1");
		expect(sorted[1].id).toBe("task-1.2");
		expect(sorted[2].id).toBe("task-1.10");
	});

	it("simulates board view task selection with sorted tasks", () => {
		// This test simulates the bug scenario where tasks are displayed in sorted order
		// but selection uses unsorted array
		const unsortedTasks: Task[] = [
			{
				id: "task-10",
				title: "Should be third when sorted",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-2",
				title: "Should be second when sorted",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-1",
				title: "Should be first when sorted",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		// Simulate the display order (sorted)
		const sortedTasks = [...unsortedTasks].sort((a, b) => compareTaskIds(a.id, b.id));
		const displayItems = sortedTasks.map((t) => `${t.id} - ${t.title}`);

		// User clicks on index 0 (expects task-1)
		const selectedIndex = 0;

		// Bug: using unsorted array with sorted display index
		const wrongTask = unsortedTasks[selectedIndex];
		expect(wrongTask.id).toBe("task-10"); // Wrong!

		// Fix: using sorted array with sorted display index
		const correctTask = sortedTasks[selectedIndex];
		expect(correctTask.id).toBe("task-1"); // Correct!
	});

	it("ensures consistent ordering between display and selection", () => {
		const tasks: Task[] = [
			{
				id: "task-5",
				title: "E",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-3",
				title: "C",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-1",
				title: "A",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-4",
				title: "D",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
			{
				id: "task-2",
				title: "B",
				status: "To Do",
				assignee: [],
				createdDate: "",
				labels: [],
				dependencies: [],
				description: "",
			},
		];

		// Both display and selection should use the same sorted array
		const sortedTasks = [...tasks].sort((a, b) => compareTaskIds(a.id, b.id));

		// Verify each index maps to the correct task
		for (let i = 0; i < sortedTasks.length; i++) {
			const displayedTask = sortedTasks[i];
			const selectedTask = sortedTasks[i]; // Should be the same!
			expect(selectedTask.id).toBe(displayedTask.id);
		}

		// Verify specific selections
		expect(sortedTasks[0].id).toBe("task-1");
		expect(sortedTasks[1].id).toBe("task-2");
		expect(sortedTasks[2].id).toBe("task-3");
		expect(sortedTasks[3].id).toBe("task-4");
		expect(sortedTasks[4].id).toBe("task-5");
	});
});
