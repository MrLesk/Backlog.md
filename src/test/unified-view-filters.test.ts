import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import { createKanbanSharedFilters, createUnifiedViewFilters } from "../ui/unified-view.ts";
import { applyTaskFilters } from "../utils/task-search.ts";

describe("unified view filter state", () => {
	it("carries task type filters into the kanban shared filters, and the task filter honours them", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Epic task",
				status: "To Do",
				type: "Epic",
				assignee: [],
				createdDate: "2026-07-10",
				labels: [],
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Bug task",
				status: "To Do",
				type: "Bug",
				assignee: [],
				createdDate: "2026-07-10",
				labels: [],
				dependencies: [],
			},
			{
				id: "task-3",
				title: "Untyped task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-07-10",
				labels: [],
				dependencies: [],
			},
		];
		const unified = createUnifiedViewFilters({ type: ["Epic"] });
		const shared = createKanbanSharedFilters(unified);

		expect(unified.typeFilter).toEqual(["Epic"]);
		expect(shared.typeFilter).toEqual(["Epic"]);
		expect(applyTaskFilters(tasks, { type: shared.typeFilter }).map((task) => task.id)).toEqual(["task-1"]);
	});

	it("carries project filters into the kanban shared filters, and the task filter honours them", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Web task",
				status: "To Do",
				project: "Web",
				assignee: [],
				createdDate: "2026-07-10",
				labels: [],
				dependencies: [],
			},
			{
				id: "task-2",
				title: "API task",
				status: "To Do",
				project: "API",
				assignee: [],
				createdDate: "2026-07-10",
				labels: [],
				dependencies: [],
			},
			{
				id: "task-3",
				title: "Unprojected task",
				status: "To Do",
				assignee: [],
				createdDate: "2026-07-10",
				labels: [],
				dependencies: [],
			},
		];
		const unified = createUnifiedViewFilters({ project: ["Web"] });
		const shared = createKanbanSharedFilters(unified);

		expect(unified.projectFilter).toEqual(["Web"]);
		expect(shared.projectFilter).toEqual(["Web"]);
		expect(applyTaskFilters(tasks, { project: shared.projectFilter }).map((task) => task.id)).toEqual(["task-1"]);
	});

	it("initializes milestone filter from options", () => {
		const labels = ["backend"];
		const filters = createUnifiedViewFilters({
			searchQuery: "sync",
			status: "In Progress",
			priority: "high",
			labels,
			labelMatch: "all",
			milestone: "Release 1",
			excludeStatus: ["Done"],
			limit: 2,
		});

		expect(filters.searchQuery).toBe("sync");
		expect(filters.statusFilter).toEqual(["In Progress"]);
		expect(filters.excludeStatus).toEqual(["Done"]);
		expect(filters.priorityFilter).toBe("high");
		expect(filters.labelFilter).toEqual(["backend"]);
		expect(filters.labelMatch).toBe("all");
		expect(filters.milestoneFilter).toBe("Release 1");
		expect(filters.limit).toBe(2);
		expect(filters.labelFilter).not.toBe(labels);
	});

	it("seeds several selected statuses without sharing the caller's array", () => {
		const status = ["To Do", "Done"];
		const filters = createUnifiedViewFilters({ status });
		expect(filters.statusFilter).toEqual(["To Do", "Done"]);
		expect(filters.statusFilter).not.toBe(status);
	});

	it("preserves all-label matching in kanban shared filters", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Frontend bug",
				status: "To Do",
				labels: ["frontend", "bug"],
				assignee: [],
				createdDate: "2026-01-01",
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Frontend feature",
				status: "To Do",
				labels: ["frontend"],
				assignee: [],
				createdDate: "2026-01-02",
				dependencies: [],
			},
		];
		const unified = createUnifiedViewFilters({
			labels: ["frontend", "bug"],
			labelMatch: "all",
		});

		const shared = createKanbanSharedFilters(unified);
		const results = applyTaskFilters(tasks, { labels: shared.labelFilter, labelMatch: shared.labelMatch }).map(
			(task) => task.id,
		);

		expect(shared.labelMatch).toBe("all");
		expect(results).toEqual(["task-1"]);
	});

	it("applies excluded statuses in kanban shared filters", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Active task",
				status: "To Do",
				labels: [],
				assignee: [],
				createdDate: "2026-01-01",
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Completed task",
				status: "Done",
				labels: [],
				assignee: [],
				createdDate: "2026-01-02",
				dependencies: [],
			},
		];
		const shared = createKanbanSharedFilters(createUnifiedViewFilters({ excludeStatus: ["Done"] }));

		const kanbanResults = applyTaskFilters(tasks, { excludeStatus: shared.excludeStatus }).map((task) => task.id);
		const listResults = applyTaskFilters(tasks, { excludeStatus: ["Done"] }).map((task) => task.id);

		expect(kanbanResults).toEqual(["task-1"]);
		expect(listResults).toEqual(["task-1"]);
	});
});
