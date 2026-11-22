import { describe, expect, it } from "bun:test";
import type { Milestone, Task } from "../../types";
import { buildMilestoneBuckets } from "./milestones";

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
