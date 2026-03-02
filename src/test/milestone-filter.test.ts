import { describe, expect, it } from "bun:test";
import { normalizeMilestoneFilterValue, resolveClosestMilestoneFilterValue } from "../utils/milestone-filter.ts";

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
});
