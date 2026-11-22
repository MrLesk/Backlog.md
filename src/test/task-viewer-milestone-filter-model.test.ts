import { describe, expect, it } from "bun:test";
import type { Milestone } from "../types/index.ts";
import { buildTaskViewerMilestoneFilterModel } from "../ui/task-viewer-with-search.ts";

describe("task viewer milestone filter model", () => {
	it("resolves only configured milestone aliases and leaves unknown milestone ids unchanged", () => {
		const milestones: Milestone[] = [{ id: "m-3", title: "Sprint 3", description: "", rawContent: "" }];
		const model = buildTaskViewerMilestoneFilterModel(milestones);

		expect(model.resolveMilestoneLabel("m-3")).toBe("Sprint 3");
		expect(model.resolveMilestoneLabel("3")).toBe("Sprint 3");
		expect(model.resolveMilestoneLabel("m-99")).toBe("m-99");
	});
});
