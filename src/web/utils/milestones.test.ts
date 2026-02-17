import { describe, expect, it } from "bun:test";
import type { Milestone, Task } from "../../types";
import { buildMilestoneBuckets, collectMilestoneIds, validateMilestoneName } from "./milestones";

const makeTask = (overrides: Partial<Task>): Task => ({
	id: "task-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2024-01-01",
	...overrides,
});

describe("buildMilestoneBuckets", () => {
	const tasks = [
		makeTask({ id: "task-1", milestone: "M1", status: "To Do" }),
		makeTask({ id: "task-2", milestone: "M2", status: "In Progress" }),
		makeTask({ id: "task-3", status: "Done" }),
	];

	it("returns buckets for file milestones, discovered milestones, and no-milestone", () => {
		const milestones: Milestone[] = [{ id: "M1", title: "M1", description: "", rawContent: "" }];
		const buckets = buildMilestoneBuckets(tasks, milestones, ["To Do", "In Progress", "Done"]);
		const labels = buckets.map((b) => b.label);
		expect(labels).toEqual(["Tasks without milestone", "M1", "M2"]);
	});

	it("calculates status counts per bucket", () => {
		const milestones: Milestone[] = [{ id: "M1", title: "M1", description: "", rawContent: "" }];
		const buckets = buildMilestoneBuckets(tasks, milestones, ["To Do", "In Progress", "Done"]);
		const m1 = buckets.find((b) => b.label === "M1");
		const none = buckets.find((b) => b.isNoMilestone);
		expect(m1?.statusCounts["To Do"]).toBe(1);
		expect(none?.statusCounts.Done).toBe(1);
	});

	it("marks milestones completed when all tasks are done", () => {
		const completedTasks = [
			makeTask({ id: "task-1", milestone: "M1", status: "Done" }),
			makeTask({ id: "task-2", milestone: "M1", status: "Done" }),
		];
		const milestones: Milestone[] = [{ id: "M1", title: "M1", description: "", rawContent: "" }];
		const buckets = buildMilestoneBuckets(completedTasks, milestones, ["To Do", "In Progress", "Done"]);
		const m1 = buckets.find((b) => b.label === "M1");
		expect(m1?.isCompleted).toBe(true);
	});

	it("keeps active milestones when archived titles are reused", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "m-2", status: "To Do" })];
		const milestones: Milestone[] = [
			{ id: "m-1", title: "Release 1", description: "", rawContent: "" },
			{ id: "m-2", title: "Release 1", description: "", rawContent: "" },
		];
		const buckets = buildMilestoneBuckets(tasks, milestones, ["To Do", "Done"], {
			archivedMilestoneIds: ["m-1", "Release 1"],
		});
		const active = buckets.find((bucket) => bucket.milestone === "m-2");
		expect(active?.label).toBe("Release 1");
	});

	it("canonicalizes reused archived titles to the active milestone ID", () => {
		const tasks = [
			makeTask({ id: "task-1", milestone: "Release 1", status: "To Do" }),
			makeTask({ id: "task-2", milestone: "m-2", status: "Done" }),
		];
		const milestones: Milestone[] = [{ id: "m-2", title: "Release 1", description: "", rawContent: "" }];
		const archivedMilestones: Milestone[] = [{ id: "m-1", title: "Release 1", description: "", rawContent: "" }];

		const buckets = buildMilestoneBuckets(tasks, milestones, ["To Do", "Done"], {
			archivedMilestoneIds: ["m-1"],
			archivedMilestones,
		});
		const releaseBuckets = buckets.filter((bucket) => bucket.label === "Release 1");
		expect(releaseBuckets).toHaveLength(1);
		expect(releaseBuckets[0]?.milestone).toBe("m-2");
		expect(releaseBuckets[0]?.tasks.map((task) => task.id)).toEqual(["task-1", "task-2"]);
	});

	it("canonicalizes numeric milestone aliases to milestone IDs", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "1", status: "To Do" })];
		const milestones: Milestone[] = [{ id: "m-1", title: "Release 1", description: "", rawContent: "" }];
		const buckets = buildMilestoneBuckets(tasks, milestones, ["To Do", "Done"]);
		const releaseBucket = buckets.find((bucket) => bucket.milestone === "m-1");
		expect(releaseBucket?.tasks.map((task) => task.id)).toEqual(["task-1"]);
	});

	it("canonicalizes zero-padded milestone ID aliases to canonical IDs", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "m-01", status: "To Do" })];
		const milestones: Milestone[] = [{ id: "m-1", title: "Release 1", description: "", rawContent: "" }];
		const buckets = buildMilestoneBuckets(tasks, milestones, ["To Do", "Done"]);
		const releaseBucket = buckets.find((bucket) => bucket.milestone === "m-1");
		expect(releaseBucket?.tasks.map((task) => task.id)).toEqual(["task-1"]);
	});

	it("keeps active-title aliases when an archived milestone ID shares the same key", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "m-0", status: "To Do" })];
		const milestones: Milestone[] = [{ id: "m-2", title: "m-0", description: "", rawContent: "" }];
		const archivedMilestones: Milestone[] = [{ id: "m-0", title: "Historical", description: "", rawContent: "" }];
		const buckets = buildMilestoneBuckets(tasks, milestones, ["To Do", "Done"], {
			archivedMilestones,
			archivedMilestoneIds: ["m-0"],
		});
		const noMilestoneBucket = buckets.find((bucket) => bucket.isNoMilestone);
		expect(noMilestoneBucket?.tasks.map((task) => task.id)).toEqual(["task-1"]);
	});

	it("prefers real milestone IDs over numeric title aliases", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "1", status: "To Do" })];
		const milestones: Milestone[] = [
			{ id: "m-1", title: "Release 1", description: "", rawContent: "" },
			{ id: "m-2", title: "1", description: "", rawContent: "" },
		];
		const buckets = buildMilestoneBuckets(tasks, milestones, ["To Do", "Done"]);
		const idBucket = buckets.find((bucket) => bucket.milestone === "m-1");
		const titleBucket = buckets.find((bucket) => bucket.milestone === "m-2");
		expect(idBucket?.tasks.map((task) => task.id)).toEqual(["task-1"]);
		expect(titleBucket?.tasks.map((task) => task.id) ?? []).toHaveLength(0);
	});
});

describe("collectMilestoneIds", () => {
	const tasks = [
		makeTask({ id: "task-1", milestone: "M1" }),
		makeTask({ id: "task-2", milestone: "New" }),
		makeTask({ id: "task-3" }),
	];
	const milestones: Milestone[] = [{ id: "M1", title: "M1", description: "", rawContent: "" }];

	it("merges file milestones and discovered task milestones without duplicates", () => {
		expect(collectMilestoneIds(tasks, milestones)).toEqual(["M1", "New"]);
	});

	it("normalizes whitespace and casing", () => {
		const variantTasks = [
			makeTask({ id: "task-1", milestone: "  m1  " }),
			makeTask({ id: "task-2", milestone: "New" }),
		];
		const result = collectMilestoneIds(variantTasks, milestones);
		expect(result).toEqual(["M1", "New"]);
	});
});

describe("validateMilestoneName", () => {
	it("rejects empty names", () => {
		expect(validateMilestoneName("   ", [])).toBe("Milestone name cannot be empty.");
	});

	it("rejects duplicates case-insensitively", () => {
		expect(validateMilestoneName("Alpha", ["alpha", "Beta"])).toBe("Milestone already exists.");
		expect(validateMilestoneName(" beta  ", ["alpha", "Beta"])).toBe("Milestone already exists.");
	});

	it("allows unique names", () => {
		expect(validateMilestoneName("Release", ["alpha", "Beta"])).toBeNull();
	});
});
