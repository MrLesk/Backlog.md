import { describe, expect, it } from "bun:test";
import type { Milestone } from "../types/index.ts";
import { buildTaskViewerMilestoneFilterModel } from "../ui/task-viewer-with-search.ts";

describe("task viewer milestone filter model", () => {
	it("builds filter options from active milestones", () => {
		const milestones: Milestone[] = [
			{ id: "m-1", title: "Release 1", description: "", rawContent: "" },
			{ id: "m-2", title: "Release 2", description: "", rawContent: "" },
		];

		const model = buildTaskViewerMilestoneFilterModel(milestones);
		expect(model.availableMilestoneTitles).toEqual(["Release 1", "Release 2"]);
	});

	it("resolves only configured milestone aliases and leaves unknown milestone ids unchanged", () => {
		const milestones: Milestone[] = [{ id: "m-3", title: "Sprint 3", description: "", rawContent: "" }];
		const model = buildTaskViewerMilestoneFilterModel(milestones);

		expect(model.resolveMilestoneLabel("m-3")).toBe("Sprint 3");
		expect(model.resolveMilestoneLabel("3")).toBe("Sprint 3");
		expect(model.resolveMilestoneLabel("m-99")).toBe("m-99");
	});
});
