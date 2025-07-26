import { describe, expect, test } from "bun:test";
import { getTaskStatistics } from "../core/statistics.ts";
import type { Task } from "../types/index.ts";

describe("getTaskStatistics", () => {
	const statuses = ["To Do", "In Progress", "Done"];

	test("handles empty task list", () => {
		const stats = getTaskStatistics([], [], statuses);

		expect(stats.totalTasks).toBe(0);
		expect(stats.completedTasks).toBe(0);
		expect(stats.completionPercentage).toBe(0);
		expect(stats.draftCount).toBe(0);
		expect(stats.statusCounts.get("To Do")).toBe(0);
		expect(stats.statusCounts.get("In Progress")).toBe(0);
		expect(stats.statusCounts.get("Done")).toBe(0);
	});

	test("counts tasks by status correctly", () => {
		const tasks: Task[] = [
			{ id: "task-1", title: "Task 1", status: "To Do", assignee: [], labels: [], dependencies: [] },
			{ id: "task-2", title: "Task 2", status: "To Do", assignee: [], labels: [], dependencies: [] },
			{ id: "task-3", title: "Task 3", status: "In Progress", assignee: [], labels: [], dependencies: [] },
			{ id: "task-4", title: "Task 4", status: "Done", assignee: [], labels: [], dependencies: [] },
			{ id: "task-5", title: "Task 5", status: "Done", assignee: [], labels: [], dependencies: [] },
		];

		const stats = getTaskStatistics(tasks, [], statuses);

		expect(stats.totalTasks).toBe(5);
		expect(stats.completedTasks).toBe(2);
		expect(stats.completionPercentage).toBe(40);
		expect(stats.statusCounts.get("To Do")).toBe(2);
		expect(stats.statusCounts.get("In Progress")).toBe(1);
		expect(stats.statusCounts.get("Done")).toBe(2);
	});

	test("counts tasks by priority correctly", () => {
		const tasks: Task[] = [
			{ id: "task-1", title: "Task 1", status: "To Do", priority: "high", assignee: [], labels: [], dependencies: [] },
			{ id: "task-2", title: "Task 2", status: "To Do", priority: "high", assignee: [], labels: [], dependencies: [] },
			{
				id: "task-3",
				title: "Task 3",
				status: "In Progress",
				priority: "medium",
				assignee: [],
				labels: [],
				dependencies: [],
			},
			{ id: "task-4", title: "Task 4", status: "Done", priority: "low", assignee: [], labels: [], dependencies: [] },
			{ id: "task-5", title: "Task 5", status: "Done", assignee: [], labels: [], dependencies: [] }, // No priority
		];

		const stats = getTaskStatistics(tasks, [], statuses);

		expect(stats.priorityCounts.get("high")).toBe(2);
		expect(stats.priorityCounts.get("medium")).toBe(1);
		expect(stats.priorityCounts.get("low")).toBe(1);
		expect(stats.priorityCounts.get("none")).toBe(1);
	});

	test("counts drafts correctly", () => {
		const tasks: Task[] = [
			{ id: "task-1", title: "Task 1", status: "To Do", assignee: [], labels: [], dependencies: [] },
		];
		const drafts: Task[] = [
			{ id: "task-2", title: "Draft 1", status: "", assignee: [], labels: [], dependencies: [] },
			{ id: "task-3", title: "Draft 2", status: "", assignee: [], labels: [], dependencies: [] },
		];

		const stats = getTaskStatistics(tasks, drafts, statuses);

		expect(stats.totalTasks).toBe(1);
		expect(stats.draftCount).toBe(2);
	});

	test("identifies recent activity correctly", () => {
		const now = new Date();
		const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
		const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Recent Task",
				status: "To Do",
				createdDate: fiveDaysAgo.toISOString().split("T")[0],
				assignee: [],
				labels: [],
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Old Task",
				status: "To Do",
				createdDate: tenDaysAgo.toISOString().split("T")[0],
				assignee: [],
				labels: [],
				dependencies: [],
			},
			{
				id: "task-3",
				title: "Updated Task",
				status: "In Progress",
				createdDate: tenDaysAgo.toISOString().split("T")[0],
				updatedDate: fiveDaysAgo.toISOString().split("T")[0],
				assignee: [],
				labels: [],
				dependencies: [],
			},
		];

		const stats = getTaskStatistics(tasks, [], statuses);

		expect(stats.recentActivity.created.length).toBe(1);
		expect(stats.recentActivity.created[0].id).toBe("task-1");
		expect(stats.recentActivity.updated.length).toBe(1);
		expect(stats.recentActivity.updated[0].id).toBe("task-3");
	});

	test("identifies stale tasks correctly", () => {
		const now = new Date();
		const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Stale Task",
				status: "To Do",
				createdDate: twoMonthsAgo.toISOString().split("T")[0],
				assignee: [],
				labels: [],
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Recent Task",
				status: "To Do",
				createdDate: oneWeekAgo.toISOString().split("T")[0],
				assignee: [],
				labels: [],
				dependencies: [],
			},
			{
				id: "task-3",
				title: "Old but Done",
				status: "Done",
				createdDate: twoMonthsAgo.toISOString().split("T")[0],
				assignee: [],
				labels: [],
				dependencies: [],
			},
		];

		const stats = getTaskStatistics(tasks, [], statuses);

		expect(stats.projectHealth.staleTasks.length).toBe(1);
		expect(stats.projectHealth.staleTasks[0].id).toBe("task-1");
	});

	test("identifies blocked tasks correctly", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Blocking Task",
				status: "In Progress",
				assignee: [],
				labels: [],
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Blocked Task",
				status: "To Do",
				assignee: [],
				labels: [],
				dependencies: ["task-1"], // Depends on task-1 which is not done
			},
			{
				id: "task-3",
				title: "Not Blocked",
				status: "To Do",
				assignee: [],
				labels: [],
				dependencies: ["task-4"], // Depends on task-4 which is done
			},
			{
				id: "task-4",
				title: "Done Task",
				status: "Done",
				assignee: [],
				labels: [],
				dependencies: [],
			},
		];

		const stats = getTaskStatistics(tasks, [], statuses);

		expect(stats.projectHealth.blockedTasks.length).toBe(1);
		expect(stats.projectHealth.blockedTasks[0].id).toBe("task-2");
	});

	test("calculates average task age correctly", () => {
		const now = new Date();
		const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
		const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Task 1",
				status: "To Do",
				createdDate: tenDaysAgo.toISOString().split("T")[0],
				assignee: [],
				labels: [],
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Task 2",
				status: "Done",
				createdDate: twentyDaysAgo.toISOString().split("T")[0],
				assignee: [],
				labels: [],
				dependencies: [],
			},
		];

		const stats = getTaskStatistics(tasks, [], statuses);

		// Average of 10 and 20 days = 15 days
		expect(stats.projectHealth.averageTaskAge).toBe(15);
	});

	test("handles 100% completion correctly", () => {
		const tasks: Task[] = [
			{ id: "task-1", title: "Task 1", status: "Done", assignee: [], labels: [], dependencies: [] },
			{ id: "task-2", title: "Task 2", status: "Done", assignee: [], labels: [], dependencies: [] },
			{ id: "task-3", title: "Task 3", status: "Done", assignee: [], labels: [], dependencies: [] },
		];

		const stats = getTaskStatistics(tasks, [], statuses);

		expect(stats.completionPercentage).toBe(100);
		expect(stats.completedTasks).toBe(3);
		expect(stats.totalTasks).toBe(3);
	});
});
