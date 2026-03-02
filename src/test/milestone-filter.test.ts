import { describe, expect, it } from "bun:test";
import {
	createMilestoneFilterValueResolver,
	normalizeMilestoneFilterValue,
	resolveClosestMilestoneFilterValue,
} from "../utils/milestone-filter.ts";

describe("milestone filter matching", () => {
	it("normalizes punctuation and case", () => {
		expect(normalizeMilestoneFilterValue("  Release-1 / Alpha ")).toBe("release 1 alpha");
	});

	it("returns exact normalized milestone when available", () => {
		const resolved = resolveClosestMilestoneFilterValue("RELEASE-1", ["Release-1", "Roadmap Alpha"]);
		expect(resolved).toBe("release 1");
	});

	it("returns closest milestone for typo input", () => {
		const resolved = resolveClosestMilestoneFilterValue("releas-1", ["Release-1", "Release-2", "Roadmap Alpha"]);
		expect(resolved).toBe("release 1");
	});

	it("returns closest milestone for partial input", () => {
		const resolved = resolveClosestMilestoneFilterValue("roadmp", ["Release-1", "Roadmap Alpha"]);
		expect(resolved).toBe("roadmap alpha");
	});

	it("resolves milestone IDs to titles for filtering", () => {
		const resolveMilestone = createMilestoneFilterValueResolver([
			{
				id: "m-7",
				title: "New Milestones UI",
				description: "",
				rawContent: "",
			},
		]);

		expect(resolveMilestone("m-7")).toBe("New Milestones UI");
		expect(resolveMilestone("7")).toBe("New Milestones UI");
		expect(resolveMilestone("New Milestones UI")).toBe("New Milestones UI");
		expect(resolveMilestone("m-99")).toBe("m-99");
	});
});
