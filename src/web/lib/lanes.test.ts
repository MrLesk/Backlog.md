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

	it("canonicalizes numeric milestone aliases to configured milestone IDs", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "1" })];
		const lanes = buildLanes(
			"milestone",
			tasks,
			[],
			[{ id: "m-1", title: "Release 1", description: "", rawContent: "" }],
		);
		expect(lanes.map((lane) => lane.milestone)).toContain("m-1");
		expect(lanes.map((lane) => lane.milestone)).not.toContain("1");
	});

	it("canonicalizes zero-padded milestone ID aliases to configured milestone IDs", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "m-01" })];
		const lanes = buildLanes(
			"milestone",
			tasks,
			[],
			[{ id: "m-1", title: "Release 1", description: "", rawContent: "" }],
		);
		expect(lanes.map((lane) => lane.milestone)).toContain("m-1");
		expect(lanes.map((lane) => lane.milestone)).not.toContain("m-01");
	});

	it("filters archived numeric milestone aliases from lane definitions", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "1" })];
		const lanes = buildLanes("milestone", tasks, [], [], {
			archivedMilestoneIds: ["m-1"],
			archivedMilestones: [{ id: "m-1", title: "Archived", description: "", rawContent: "" }],
		});
		expect(lanes.map((lane) => lane.label)).toEqual(["No milestone"]);
	});

	it("prefers active title aliases when archived milestones reuse the same title", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "Shared" })];
		const lanes = buildLanes(
			"milestone",
			tasks,
			[],
			[{ id: "m-2", title: "Shared", description: "", rawContent: "" }],
			{
				archivedMilestoneIds: ["m-0"],
				archivedMilestones: [{ id: "m-0", title: "Shared", description: "", rawContent: "" }],
			},
		);
		expect(lanes.map((lane) => lane.milestone)).toContain("m-2");
		expect(lanes.map((lane) => lane.milestone)).not.toContain("Shared");
	});

	it("prefers real milestone IDs over numeric title aliases in lane definitions", () => {
		const tasks = [makeTask({ id: "task-1", milestone: "1" })];
		const lanes = buildLanes(
			"milestone",
			tasks,
			[],
			[
				{ id: "m-1", title: "Release 1", description: "", rawContent: "" },
				{ id: "m-2", title: "1", description: "", rawContent: "" },
			],
		);
		expect(lanes.map((lane) => lane.milestone)).toContain("m-1");
		expect(lanes.map((lane) => lane.milestone)).not.toContain("m-2");
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
		expect((grouped.get(laneKeyFromMilestone(null))?.get("To Do") ?? []).map((t) => t.id)).toEqual(["task-1"]);
	});

	it("normalizes numeric aliases for archived milestones to no milestone", () => {
		const archivedMilestones = [{ id: "m-1", title: "Archived", description: "", rawContent: "" }];
		const archivedAliasTasks = [makeTask({ id: "task-1", status: "To Do", milestone: "1" })];
		const lanes = buildLanes("milestone", archivedAliasTasks, [], []);
		const grouped = groupTasksByLaneAndStatus("milestone", lanes, ["To Do"], archivedAliasTasks, {
			archivedMilestoneIds: ["m-1"],
			archivedMilestones,
		});
		expect((grouped.get(laneKeyFromMilestone(null))?.get("To Do") ?? []).map((t) => t.id)).toEqual(["task-1"]);
	});

	it("prefers real milestone IDs over numeric title aliases when grouping tasks", () => {
		const tasksWithNumericTitleCollision = [makeTask({ id: "task-1", status: "To Do", milestone: "1" })];
		const milestones = [
			{ id: "m-1", title: "Release 1", description: "", rawContent: "" },
			{ id: "m-2", title: "1", description: "", rawContent: "" },
		];
		const lanes = buildLanes("milestone", tasksWithNumericTitleCollision, [], milestones);
		const grouped = groupTasksByLaneAndStatus("milestone", lanes, ["To Do"], tasksWithNumericTitleCollision, {
			milestoneEntities: milestones,
		});
		expect((grouped.get(laneKeyFromMilestone("m-1"))?.get("To Do") ?? []).map((task) => task.id)).toEqual(["task-1"]);
		expect((grouped.get(laneKeyFromMilestone("m-2"))?.get("To Do") ?? []).map((task) => task.id) ?? []).toHaveLength(0);
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
