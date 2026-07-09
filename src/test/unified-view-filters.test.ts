import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import {
	createKanbanSharedFilters,
	createUnifiedViewFilters,
	filterTasksForKanban,
	mergeUnifiedViewFilters,
	type UnifiedViewFilters,
} from "../ui/unified-view.ts";
import { NO_MILESTONE_FILTER_VALUE } from "../utils/milestone-filter.ts";
import { applyTaskFilters } from "../utils/task-search.ts";

describe("unified view filter state", () => {
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
		expect(filters.statusFilter).toBe("In Progress");
		expect(filters.excludeStatus).toEqual(["Done"]);
		expect(filters.priorityFilter).toBe("high");
		expect(filters.labelFilter).toEqual(["backend"]);
		expect(filters.labelMatch).toBe("all");
		expect(filters.milestoneFilter).toBe("Release 1");
		expect(filters.limit).toBe(2);
		expect(filters.labelFilter).not.toBe(labels);
	});

	it("preserves milestone filter when merging filter updates", () => {
		const initial = createUnifiedViewFilters({
			searchQuery: "api",
			status: "To Do",
			priority: "",
			labels: [],
		});

		const updated: UnifiedViewFilters = {
			searchQuery: "api",
			statusFilter: "To Do",
			excludeStatus: [],
			priorityFilter: "",
			labelFilter: ["infra"],
			milestoneFilter: "Sprint 7",
		};

		const merged = mergeUnifiedViewFilters(initial, updated);
		expect(merged.milestoneFilter).toBe("Sprint 7");
		expect(merged.labelFilter).toEqual(["infra"]);
		expect(merged.labelFilter).not.toBe(updated.labelFilter);
		expect(initial.milestoneFilter).toBe("");
	});

	it("preserves label match mode when merging unrelated filter updates", () => {
		const initial = createUnifiedViewFilters({
			searchQuery: "api",
			priority: "high",
			labels: ["frontend", "bug"],
			labelMatch: "all",
		});

		const updated: UnifiedViewFilters = {
			searchQuery: "api auth",
			statusFilter: "",
			excludeStatus: [],
			priorityFilter: "high",
			labelFilter: ["frontend", "bug"],
			milestoneFilter: "",
		};

		const merged = mergeUnifiedViewFilters(initial, updated);
		expect(merged.labelMatch).toBe("all");
	});

	it("preserves excluded statuses when merging task-list filter updates", () => {
		const initial = createUnifiedViewFilters({
			searchQuery: "api",
			excludeStatus: ["Done"],
		});

		const updated = {
			searchQuery: "api auth",
			statusFilter: "",
			priorityFilter: "",
			labelFilter: [],
			milestoneFilter: "",
		};

		const merged = mergeUnifiedViewFilters(initial, updated);
		expect(merged.excludeStatus).toEqual(["Done"]);
	});

	it("preserves task limit when merging filter updates", () => {
		const initial = createUnifiedViewFilters({
			labels: ["frontend", "bug"],
			labelMatch: "all",
			limit: 1,
		});

		const updated: UnifiedViewFilters = {
			searchQuery: "auth",
			statusFilter: "",
			excludeStatus: [],
			priorityFilter: "",
			labelFilter: ["frontend", "bug"],
			milestoneFilter: "",
		};

		const merged = mergeUnifiedViewFilters(initial, updated);
		expect(merged.limit).toBe(1);
	});

	it("uses label match mode from task-list filter updates", () => {
		const initial = createUnifiedViewFilters({
			labels: ["frontend", "bug"],
			labelMatch: "all",
		});

		const updated: UnifiedViewFilters = {
			searchQuery: "",
			statusFilter: "",
			excludeStatus: [],
			priorityFilter: "",
			labelFilter: ["frontend", "bug"],
			labelMatch: "any",
			milestoneFilter: "",
		};

		const merged = mergeUnifiedViewFilters(initial, updated);
		expect(merged.labelMatch).toBe("any");
	});

	it("excludes status from kanban shared filters", () => {
		const unified = createUnifiedViewFilters({
			searchQuery: "sync",
			status: "Done",
			excludeStatus: ["Done"],
			priority: "high",
			labels: ["ui"],
			milestone: "Sprint 1",
		});

		const shared = createKanbanSharedFilters(unified);
		expect(shared.searchQuery).toBe("sync");
		expect(shared.excludeStatus).toEqual(["Done"]);
		expect(shared.priorityFilter).toBe("high");
		expect(shared.labelFilter).toEqual(["ui"]);
		expect(shared.milestoneFilter).toBe("Sprint 1");
		expect(shared.limit).toBeUndefined();
		expect("statusFilter" in shared).toBe(false);
	});

	it("carries task limit into kanban shared filters", () => {
		const unified = createUnifiedViewFilters({
			searchQuery: "sync",
			labels: ["ui"],
			limit: 1,
		});

		const shared = createKanbanSharedFilters(unified);
		expect(shared.limit).toBe(1);
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
		const results = filterTasksForKanban(tasks, shared).map((task) => task.id);

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

		const kanbanResults = filterTasksForKanban(tasks, shared).map((task) => task.id);
		const listResults = applyTaskFilters(tasks, { excludeStatus: ["Done"] }).map((task) => task.id);

		expect(kanbanResults).toEqual(["task-1"]);
		expect(listResults).toEqual(["task-1"]);
	});

	it("applies kanban shared limit without dropping seeded label filters", () => {
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
				title: "Frontend bug 2",
				status: "Done",
				labels: ["frontend", "bug"],
				assignee: [],
				createdDate: "2026-01-02",
				dependencies: [],
			},
			{
				id: "task-3",
				title: "Frontend only",
				status: "To Do",
				labels: ["frontend"],
				assignee: [],
				createdDate: "2026-01-03",
				dependencies: [],
			},
		];
		const shared = createKanbanSharedFilters(
			createUnifiedViewFilters({
				labels: ["frontend", "bug"],
				labelMatch: "all",
				limit: 1,
			}),
		);

		const results = filterTasksForKanban(tasks, shared).map((task) => task.id);

		expect(results).toEqual(["task-1"]);
	});

	it("applies kanban shared limit when it is the only seeded filter", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "First",
				status: "To Do",
				labels: [],
				assignee: [],
				createdDate: "2026-01-01",
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Second",
				status: "Done",
				labels: [],
				assignee: [],
				createdDate: "2026-01-02",
				dependencies: [],
			},
		];

		const results = filterTasksForKanban(tasks, {
			searchQuery: "",
			excludeStatus: [],
			priorityFilter: "",
			labelFilter: [],
			milestoneFilter: "",
			limit: 1,
		}).map((task) => task.id);

		expect(results).toEqual(["task-1"]);
	});

	it("keeps shared filter results consistent between task list and kanban", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "UI polish",
				status: "To Do",
				priority: "high",
				labels: ["ui"],
				milestone: "m-1",
				assignee: [],
				createdDate: "2026-01-01",
				dependencies: [],
			},
			{
				id: "task-2",
				title: "UI review",
				status: "Done",
				priority: "high",
				labels: ["ui"],
				milestone: "m-1",
				assignee: [],
				createdDate: "2026-01-02",
				dependencies: [],
			},
			{
				id: "task-3",
				title: "Backend migration",
				status: "To Do",
				priority: "low",
				labels: ["backend"],
				milestone: "m-2",
				assignee: [],
				createdDate: "2026-01-03",
				dependencies: [],
			},
		];
		const resolveMilestoneLabel = (milestone: string) => {
			if (milestone.toLowerCase() === "m-1") return "Sprint 1";
			if (milestone.toLowerCase() === "m-2") return "Sprint 2";
			return milestone;
		};

		const sharedFilters = {
			searchQuery: "",
			excludeStatus: [],
			priorityFilter: "high",
			labelFilter: ["ui"],
			milestoneFilter: "Sprint 1",
		};

		const kanbanResults = filterTasksForKanban(tasks, sharedFilters, resolveMilestoneLabel).map((task) => task.id);
		const listSharedResults = applyTaskFilters(tasks, {
			priority: "high",
			labels: ["ui"],
			milestone: "Sprint 1",
			resolveMilestoneLabel,
		}).map((task) => task.id);
		const listStatusResults = applyTaskFilters(tasks, {
			status: "To Do",
			priority: "high",
			labels: ["ui"],
			milestone: "Sprint 1",
			resolveMilestoneLabel,
		}).map((task) => task.id);

		expect(kanbanResults).toEqual(["task-1", "task-2"]);
		expect(listSharedResults).toEqual(["task-1", "task-2"]);
		expect(listStatusResults).toEqual(["task-1"]);
	});

	it("filters unassigned milestone tasks with the shared No milestone value", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "Unassigned release task",
				status: "To Do",
				labels: [],
				assignee: [],
				createdDate: "2026-01-01",
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Empty milestone task",
				status: "To Do",
				labels: [],
				milestone: "  ",
				assignee: [],
				createdDate: "2026-01-02",
				dependencies: [],
			},
			{
				id: "task-3",
				title: "Assigned release task",
				status: "To Do",
				labels: [],
				milestone: "m-1",
				assignee: [],
				createdDate: "2026-01-03",
				dependencies: [],
			},
			{
				id: "task-4",
				title: "Literal sentinel title task",
				status: "To Do",
				labels: [],
				milestone: "__none",
				assignee: [],
				createdDate: "2026-01-04",
				dependencies: [],
			},
		];

		const sharedFilters = {
			searchQuery: "",
			excludeStatus: [],
			priorityFilter: "",
			labelFilter: [],
			milestoneFilter: NO_MILESTONE_FILTER_VALUE,
		};

		const kanbanResults = filterTasksForKanban(tasks, sharedFilters).map((task) => task.id);
		const listResults = applyTaskFilters(tasks, { milestone: NO_MILESTONE_FILTER_VALUE }).map((task) => task.id);
		const literalMilestoneResults = applyTaskFilters(tasks, { milestone: "__none" }).map((task) => task.id);

		expect(kanbanResults).toEqual(["task-1", "task-2"]);
		expect(listResults).toEqual(["task-1", "task-2"]);
		expect(literalMilestoneResults).toEqual(["task-4"]);
	});
});
