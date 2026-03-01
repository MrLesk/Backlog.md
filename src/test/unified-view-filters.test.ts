import { describe, expect, it } from "bun:test";
import { createUnifiedViewFilters, mergeUnifiedViewFilters, type UnifiedViewFilters } from "../ui/unified-view.ts";

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
});
