import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { parseMilestone, parseTask } from "../markdown/parser.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { normalizeDueDate } from "../utils/due-date.ts";
import { pinTimeZone } from "./pin-timezone.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

describe("date-only due date model", () => {
	it("normalizes a due date to the day alone", () => {
		expect(normalizeDueDate("2026-08-10")).toBe("2026-08-10");
		expect(normalizeDueDate("  2026-08-10  ")).toBe("2026-08-10");
		expect(normalizeDueDate(undefined)).toBeUndefined();
		expect(normalizeDueDate("")).toBeUndefined();
	});

	it("keeps the written day of a value that still carries a time", () => {
		// Due dates were UTC datetimes before, so stored records can carry a time. Reading one
		// takes the day it was written with: converting an offset here could move it.
		expect(normalizeDueDate("2026-08-10 14:30")).toBe("2026-08-10");
		expect(normalizeDueDate("2026-08-10T14:30")).toBe("2026-08-10");
		expect(normalizeDueDate("2026-08-10T16:30:45+02:00")).toBe("2026-08-10");
		expect(normalizeDueDate("2026-08-10T14:30:59.999Z")).toBe("2026-08-10");
		expect(normalizeDueDate("2026-08-10T14:30-0800")).toBe("2026-08-10");
	});

	it("rejects a legacy timestamp whose time or offset is out of range", () => {
		// Tolerating a real timestamp is the point; turning malformed input into an apparently
		// valid due date is not, and the CLI, MCP and web API all reach this.
		expect(() => normalizeDueDate("2026-08-10T99:99", "Due date")).toThrow("YYYY-MM-DD");
		expect(() => normalizeDueDate("2026-08-10T14:30:60Z", "Due date")).toThrow("YYYY-MM-DD");
		expect(() => normalizeDueDate("2026-08-10T14:30+99:99", "Due date")).toThrow("YYYY-MM-DD");
		expect(() => normalizeDueDate("2026-08-10T14:30+15:00", "Due date")).toThrow("YYYY-MM-DD");
		// +14:00 is the largest real offset, and only on the hour.
		expect(normalizeDueDate("2026-08-10T14:30+14:00", "Due date")).toBe("2026-08-10");
		expect(() => normalizeDueDate("2026-08-10T14:30+14:30", "Due date")).toThrow("YYYY-MM-DD");
	});

	it("rejects values that name no calendar day", () => {
		expect(() => normalizeDueDate("2026-02-30", "Due date")).toThrow("YYYY-MM-DD");
		expect(() => normalizeDueDate("2026-13-01", "Due date")).toThrow("YYYY-MM-DD");
		expect(() => normalizeDueDate("10/08/2026", "Due date")).toThrow("YYYY-MM-DD");
		expect(() => normalizeDueDate("next friday", "Due date")).toThrow("YYYY-MM-DD");
	});

	it("round-trips task and milestone due dates through Markdown", () => {
		const task: Task = {
			id: "TASK-1",
			title: "Due task",
			status: "To Do",
			assignee: [],
			createdDate: "2026-08-01 09:00",
			dueDate: "2026-08-10",
			labels: [],
			dependencies: [],
		};
		const serialized = serializeTask(task);
		expect(serialized).toContain("due_date:");
		expect(parseTask(serialized).dueDate).toBe("2026-08-10");

		const milestone = parseMilestone(`---
id: m-1
title: Release
due_date: 2026-08-10
---

## Description

Release milestone
`);
		expect(milestone.dueDate).toBe("2026-08-10");
	});

	it("reads a stored due date that still carries a time as its day", () => {
		const task = parseTask(`---
id: TASK-1
title: Legacy due date
status: To Do
assignee: []
created_date: 2026-08-01 09:00
due_date: 2026-08-10 14:30
labels: []
dependencies: []
---
`);
		expect(task.dueDate).toBe("2026-08-10");

		const milestone = parseMilestone(`---
id: m-1
title: Legacy release
due_date: 2026-08-10T16:30+02:00
---
`);
		expect(milestone.dueDate).toBe("2026-08-10");
	});

	it("reads an unquoted due_date as a string rather than a YAML date", () => {
		const task = parseTask(`---
id: TASK-1
title: Unquoted due date
status: To Do
assignee: []
created_date: 2026-08-01
due_date: 2026-08-10
labels: []
dependencies: []
---
`);
		expect(task.dueDate).toBe("2026-08-10");
	});

	it("treats YAML null due_date values as absent", () => {
		for (const value of ["null", "NULL", "~"]) {
			const task = parseTask(`---
id: TASK-1
title: No due date
status: To Do
assignee: []
created_date: 2026-08-01
due_date: ${value}
labels: []
dependencies: []
---
`);
			expect(task.dueDate).toBeUndefined();

			const milestone = parseMilestone(`---
id: m-1
title: No due date
due_date: ${value}
---
`);
			expect(milestone.dueDate).toBeUndefined();
		}
	});
});

describe("due date persistence operations", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("due-date");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		core = new Core(testDir);
		await core.filesystem.ensureBacklogStructure();
		await initializeTestProject(core, "Due date project");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("creates, updates, and clears a task due date", async () => {
		const { task } = await core.createTaskFromInput({
			title: "Deadline task",
			dueDate: "2026-08-10",
		});
		expect(task.dueDate).toBe("2026-08-10");

		const updated = await core.updateTaskFromInput(task.id, { dueDate: "2026-08-12" });
		expect(updated.dueDate).toBe("2026-08-12");
		expect((await core.filesystem.loadTask(task.id))?.dueDate).toBe("2026-08-12");

		const cleared = await core.updateTaskFromInput(task.id, { dueDate: null });
		expect(cleared.dueDate).toBeUndefined();
		expect(await Bun.file(cleared.filePath ?? "").text()).not.toContain("due_date:");
	});

	it("creates, updates, and clears a milestone due date", async () => {
		const milestone = await core.filesystem.createMilestone("Release", undefined, "2026-09-01");
		expect(milestone.dueDate).toBe("2026-09-01");

		const updated = await core.filesystem.renameMilestone(milestone.id, milestone.title, "2026-09-02");
		expect(updated.milestone?.dueDate).toBe("2026-09-02");

		const cleared = await core.filesystem.renameMilestone(milestone.id, milestone.title, null);
		expect(cleared.milestone?.dueDate).toBeUndefined();
		const path = await core.filesystem.getMilestoneFilePath(milestone.id);
		expect(await Bun.file(path ?? "").text()).not.toContain("due_date:");
	});

	it("does not hide valid milestones when another file has an invalid due date", async () => {
		await core.filesystem.createMilestone("Valid release", undefined, "2026-09-01");
		await Bun.write(
			join(testDir, "backlog", "milestones", "m-1 - Invalid-release.md"),
			`---
id: m-1
title: "Invalid release"
due_date: not-a-date
---

## Description

Invalid release
`,
		);

		expect((await core.filesystem.listMilestones()).map((milestone) => milestone.title)).toEqual(["Valid release"]);
	});
});

// A quoted key slips past the frontmatter preprocessing that quotes due_date values, so YAML
// resolves the unquoted timestamp to a real Date. Such a record is perfectly valid and must not
// fail to parse: a throw here drops the whole task or milestone out of every listing.
// Frontmatter no longer delivers a Date, but the normalizer still accepts unknown, so a Date
// reaching it must yield a day rather than a stringified locale timestamp the pattern rejects.
describe("due dates given as a Date value", () => {
	// UTC midnight reads as the previous day here, so a local-calendar reading would shift it.
	pinTimeZone("America/Los_Angeles");

	it("takes the UTC day of a Date carrying a time", () => {
		expect(normalizeDueDate(new Date("2026-08-10T14:30:00Z"))).toBe("2026-08-10");
		// 23:30 on the 10th in UTC+2 is still the 10th in UTC, and must not read as the 9th here.
		expect(normalizeDueDate(new Date("2026-08-10T23:30:00+02:00"))).toBe("2026-08-10");
		expect(normalizeDueDate(new Date(Date.UTC(2026, 7, 10)))).toBe("2026-08-10");
	});

	it("rejects a Date that names no instant", () => {
		expect(() => normalizeDueDate(new Date("nonsense"), "Due date")).toThrow("YYYY-MM-DD");
	});
});

// preprocessFrontmatter quotes due_date values so YAML hands the parser a string. A quoted key
// slipped past it, leaving js-yaml to resolve the timestamp to an instant -- and once it is a Date
// the written offset is gone, so the same stored value meant different days depending on how its
// key happened to be spelled, and saving the record persisted the shifted one.
describe("due dates under a quoted frontmatter key", () => {
	// This instant falls on the 4th in UTC and on the 4th locally here, so only preserving the
	// value as written can yield the 5th: no reading of a Date could pass by accident.
	pinTimeZone("America/Los_Angeles");

	// YAML permits whitespace before the colon, so each spelling is also tested in that form.
	const keys = ["due_date", '"due_date"', "'due_date'", "due_date ", '"due_date" '];
	const taskWith = (line: string) => `---
id: TASK-1
title: Legacy timestamp
status: To Do
assignee: []
created_date: 2026-08-01
${line}
labels: []
dependencies: []
---
`;
	const milestoneWith = (line: string) => `---
id: m-1
title: Release
${line}
---
`;

	it("reads the written day however the due_date key is spelled", () => {
		for (const key of keys) {
			const line = `${key}: 2026-09-05T00:30:00+14:00`;
			expect(parseTask(taskWith(line)).dueDate).toBe("2026-09-05");
			expect(parseMilestone(milestoneWith(line)).dueDate).toBe("2026-09-05");
		}
	});

	it("reads a bare day however the due_date key is spelled", () => {
		for (const key of keys) {
			const line = `${key}: 2026-08-10`;
			expect(parseTask(taskWith(line)).dueDate).toBe("2026-08-10");
			expect(parseMilestone(milestoneWith(line)).dueDate).toBe("2026-08-10");
		}
	});
});
