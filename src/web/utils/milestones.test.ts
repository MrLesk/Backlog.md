import { describe, expect, it } from "bun:test";
import type { Task } from "../../types";
import { buildMilestoneBucketsFromConfig, collectMilestones, validateMilestoneName } from "./milestones";

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

describe("buildMilestoneBucketsFromConfig", () => {
	const tasks = [
		makeTask({ id: "task-1", milestone: "M1", status: "To Do" }),
		makeTask({ id: "task-2", milestone: "M2", status: "In Progress" }),
		makeTask({ id: "task-3", status: "Done" }),
	];

	it("returns buckets for configured milestones, discovered milestones, and no-milestone", () => {
		const buckets = buildMilestoneBucketsFromConfig(tasks, ["M1"], ["To Do", "In Progress", "Done"]);
		const labels = buckets.map((b) => b.label);
		expect(labels).toEqual(["Tasks without milestone", "M1", "M2"]);
	});

	it("calculates status counts per bucket", () => {
		const buckets = buildMilestoneBucketsFromConfig(tasks, ["M1"], ["To Do", "In Progress", "Done"]);
		const m1 = buckets.find((b) => b.label === "M1");
		const none = buckets.find((b) => b.isNoMilestone);

		expect(m1?.statusCounts["To Do"]).toBe(1);
		expect(none?.statusCounts.Done).toBe(1);
	});
});

describe("collectMilestones", () => {
	const tasks = [
		makeTask({ id: "task-1", milestone: "M1" }),
		makeTask({ id: "task-2", milestone: "New" }),
		makeTask({ id: "task-3" }),
	];

	it("merges configured and discovered milestones without duplicates", () => {
		expect(collectMilestones(tasks, ["M1", "M2"])).toEqual(["M1", "M2", "New"]);
	});

	it("normalizes whitespace and casing", () => {
		const result = collectMilestones(tasks, ["  m1  "]);
		expect(result).toEqual(["m1", "New"]);
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
