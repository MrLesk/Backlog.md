import { describe, expect, it } from "bun:test";
import type { Task } from "../types/index.ts";
import {
	createMilestoneFilterValueResolver,
	normalizeMilestoneFilterValue,
	resolveClosestMilestoneFilterValue,
	resolveMilestoneFilterTitle,
} from "../utils/milestone-filter.ts";
import { applyTaskFilters } from "../utils/task-search.ts";

describe("milestone filter matching", () => {
	it("normalizes punctuation and case", () => {
		expect(normalizeMilestoneFilterValue("  Release-1 / Alpha ")).toBe("release 1 alpha");
	});

	it("preserves non-ASCII milestone identity", () => {
		const resolveMilestone = createMilestoneFilterValueResolver([
			{ id: "m-1", title: "发布", description: "", rawContent: "" },
			{ id: "m-2", title: "测试", description: "", rawContent: "" },
		]);
		const tasks = [{ id: "task-1", milestone: "m-1" }, { id: "task-2", milestone: "m-2" }, { id: "task-3" }];
		const milestoneFilter = normalizeMilestoneFilterValue(
			resolveMilestoneFilterTitle(
				"m-1",
				tasks.map((task) => task.milestone ?? ""),
				resolveMilestone,
			),
		);
		const matchingTaskIds = tasks
			.filter((task) => normalizeMilestoneFilterValue(resolveMilestone(task.milestone ?? "")) === milestoneFilter)
			.map((task) => task.id);

		expect(matchingTaskIds).toEqual(["task-1"]);
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

	it("gives milestone IDs precedence over colliding milestone titles", () => {
		const resolveMilestone = createMilestoneFilterValueResolver([
			{ id: "m-0", title: "Alpha", description: "", rawContent: "" },
			{ id: "m-1", title: "m-0", description: "", rawContent: "" },
		]);

		expect(resolveMilestone("0")).toBe("Alpha");
		expect(resolveMilestone("m-0")).toBe("Alpha");
		expect(resolveMilestone("m-1")).toBe("m-0");
	});
});

describe("milestone filter title resolution", () => {
	const resolveMilestone = createMilestoneFilterValueResolver([
		{ id: "m-1", title: "Release-1", description: "", rawContent: "" },
		{ id: "m-2", title: "Roadmap Alpha", description: "", rawContent: "" },
	]);
	const storedValues = ["m-1", "m-2"];
	const resolveTitle = (query: string) => resolveMilestoneFilterTitle(query, storedValues, resolveMilestone);

	it("resolves milestone ID queries to the milestone title", () => {
		expect(resolveTitle("1")).toBe("Release-1");
		expect(resolveTitle("m-1")).toBe("Release-1");
		expect(resolveTitle("M-1")).toBe("Release-1");
		expect(resolveTitle("2")).toBe("Roadmap Alpha");
	});

	it("does not fuzzy-match a recognized ID to a different assigned milestone", () => {
		const resolveSimilarMilestones = createMilestoneFilterValueResolver([
			{ id: "m-1", title: "Release 1", description: "", rawContent: "" },
			{ id: "m-2", title: "Release 2", description: "", rawContent: "" },
		]);

		expect(resolveMilestoneFilterTitle("1", ["m-2"], resolveSimilarMilestones)).toBe("Release 1");
		expect(resolveMilestoneFilterTitle("m-1", ["m-2"], resolveSimilarMilestones)).toBe("Release 1");

		const resolveIdShapedTitles = createMilestoneFilterValueResolver([
			{ id: "m-1", title: "m-1", description: "", rawContent: "" },
			{ id: "m-2", title: "m-2", description: "", rawContent: "" },
		]);
		expect(resolveMilestoneFilterTitle("m-1", ["m-2"], resolveIdShapedTitles)).toBe("m-1");
	});

	it("returns the stored title for punctuated titles rather than a normalized value", () => {
		// Title-based matchers compare raw titles, so "release 1" would not match.
		expect(resolveTitle("Release-1")).toBe("Release-1");
		expect(resolveTitle("release-1")).toBe("Release-1");
	});

	it("still resolves typo and partial queries to the closest title", () => {
		expect(resolveTitle("releas-1")).toBe("Release-1");
		expect(resolveTitle("roadmp")).toBe("Roadmap Alpha");
	});

	it("returns the query unchanged when nothing matches", () => {
		expect(resolveTitle("zzz-unrelated-milestone")).toBe("zzz-unrelated-milestone");
	});

	it("works without a resolver by matching titles directly", () => {
		expect(resolveMilestoneFilterTitle("roadmp", ["Release-1", "Roadmap Alpha"])).toBe("Roadmap Alpha");
	});

	// The interactive view compares raw milestone titles, so the value the CLI seeds it with has to
	// survive that comparison. Guards against handing it a normalized value again.
	it("produces a value the interactive view's matcher accepts", () => {
		const tasks = [
			{ id: "task-1", title: "One", status: "To Do", milestone: "m-1" },
			{ id: "task-2", title: "Two", status: "To Do", milestone: "m-2" },
		] as unknown as Task[];
		const seedFilter = (query: string) =>
			resolveMilestoneFilterTitle(
				query,
				tasks.map((task) => task.milestone ?? ""),
				resolveMilestone,
			);
		const listed = (query: string) =>
			applyTaskFilters(tasks, {
				milestone: seedFilter(query),
				resolveMilestoneLabel: resolveMilestone,
			}).map((task) => task.id);

		for (const query of ["1", "m-1", "M-1", "Release-1", "releas-1"]) {
			expect(listed(query)).toEqual(["task-1"]);
		}
		expect(listed("roadmp")).toEqual(["task-2"]);
		expect(listed("zzz-unrelated-milestone")).toEqual([]);
	});
});
