import { describe, expect, it } from "bun:test";
import type { Task } from "../../types";
import {
	buildLanes,
	DEFAULT_LANE_KEY,
	groupTasksByLaneAndStatus,
	laneKeyFromMilestone,
	sortTasksForStatus,
} from "./lanes";

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

describe("buildLanes", () => {
	it("creates milestone lanes including No milestone and task-discovered milestones", () => {
		const tasks = [
			makeTask({ id: "task-1", milestone: "M1" }),
			makeTask({ id: "task-2", milestone: "Extra" }),
			makeTask({ id: "task-3" }),
		];
		const lanes = buildLanes("milestone", tasks, ["M1"]);
		expect(lanes.map((lane) => lane.label)).toEqual(["No milestone", "M1", "Extra"]);
	});

	it("falls back to a single lane when mode is none", () => {
		const lanes = buildLanes("none", [], ["M1"]);
		expect(lanes).toHaveLength(1);
		expect(lanes[0]?.key).toBe(DEFAULT_LANE_KEY);
	});

	it("excludes archived milestones from lane definitions", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "M1" })];
		const lanes = buildLanes("milestone", tasks, ["M1"], [], { archivedMilestoneIds: ["M1"] });
		expect(lanes.map((lane) => lane.label)).toEqual(["No milestone"]);
	});
});

describe("groupTasksByLaneAndStatus", () => {
	const tasks = [
		makeTask({ id: "task-1", status: "To Do", milestone: "M1" }),
		makeTask({ id: "task-2", status: "In Progress" }),
		makeTask({ id: "task-3", status: "To Do", milestone: "Extra", ordinal: 5 }),
	];

	it("groups tasks under their milestone lanes", () => {
		const lanes = buildLanes("milestone", tasks, ["M1"]);
		const grouped = groupTasksByLaneAndStatus("milestone", lanes, ["To Do", "In Progress"], tasks);

		expect((grouped.get(laneKeyFromMilestone("M1"))?.get("To Do") ?? []).map((t) => t.id)).toEqual(["task-1"]);
		expect((grouped.get(laneKeyFromMilestone(null))?.get("In Progress") ?? []).map((t) => t.id)).toEqual(["task-2"]);
		expect((grouped.get(laneKeyFromMilestone("Extra"))?.get("To Do") ?? []).map((t) => t.id)).toEqual(["task-3"]);
	});

	it("places all tasks into the default lane when lane mode is none", () => {
		const lanes = buildLanes("none", tasks, []);
		const grouped = groupTasksByLaneAndStatus("none", lanes, ["To Do", "In Progress"], tasks);
		const defaultLaneTasks = grouped.get(DEFAULT_LANE_KEY);

		expect(defaultLaneTasks?.get("To Do")?.map((t) => t.id)).toEqual(["task-3", "task-1"]);
		expect(defaultLaneTasks?.get("In Progress")?.map((t) => t.id)).toEqual(["task-2"]);
	});

	it("normalizes archived milestone tasks to no milestone", () => {
		const lanes = buildLanes("milestone", tasks, ["M1"], [], { archivedMilestoneIds: ["M1"] });
		const grouped = groupTasksByLaneAndStatus("milestone", lanes, ["To Do", "In Progress"], tasks, {
			archivedMilestoneIds: ["M1"],
		});
		expect((grouped.get(laneKeyFromMilestone(null))?.get("To Do") ?? []).map((t) => t.id)).toEqual([
			"task-3",
			"task-1",
		]);
	});
});

describe("sortTasksForStatus", () => {
	it("prioritizes ordinal when present and falls back to updatedDate for done statuses", () => {
		const tasks = [
			makeTask({ id: "task-1", status: "Done", updatedDate: "2024-01-02", createdDate: "2024-01-01" }),
			makeTask({ id: "task-2", status: "Done", ordinal: 1, updatedDate: "2024-01-01" }),
			makeTask({ id: "task-3", status: "Done", updatedDate: "2024-01-03", createdDate: "2024-01-01" }),
		];

		const sorted = sortTasksForStatus(tasks, "Done").map((t) => t.id);
		expect(sorted).toEqual(["task-2", "task-3", "task-1"]);
	});
});
