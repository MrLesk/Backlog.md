import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import {
	createKanbanSharedFilters,
	createUnifiedViewFilters,
	filterTasksForKanban,
	mergeUnifiedViewFilters,
	type UnifiedViewFilters,
} from "../ui/unified-view.ts";
import { applyTaskFilters } from "../utils/task-search.ts";

describe("unified view filter state", () => {
	it("initializes milestone filter from options", () => {
		const labels = ["backend"];
		const filters = createUnifiedViewFilters({
			searchQuery: "sync",
			status: "In Progress",
			priority: "high",
			labels,
			milestone: "Release 1",
		});

		expect(filters.searchQuery).toBe("sync");
		expect(filters.statusFilter).toBe("In Progress");
		expect(filters.priorityFilter).toBe("high");
		expect(filters.labelFilter).toEqual(["backend"]);
		expect(filters.milestoneFilter).toBe("Release 1");
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

	it("excludes status from kanban shared filters", () => {
		const unified = createUnifiedViewFilters({
			searchQuery: "sync",
			status: "Done",
			priority: "high",
			labels: ["ui"],
			milestone: "Sprint 1",
		});

		const shared = createKanbanSharedFilters(unified);
		expect(shared.searchQuery).toBe("sync");
		expect(shared.priorityFilter).toBe("high");
		expect(shared.labelFilter).toEqual(["ui"]);
		expect(shared.milestoneFilter).toBe("Sprint 1");
		expect("statusFilter" in shared).toBe(false);
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
});
