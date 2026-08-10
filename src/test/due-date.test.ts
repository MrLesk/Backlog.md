import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { parseMilestone, parseTask } from "../markdown/parser.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { normalizeUtcDateTime } from "../utils/utc-datetime.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

describe("UTC due date model", () => {
	it("normalizes supported datetimes to minute-precision UTC", () => {
		expect(normalizeUtcDateTime("2026-08-10 14:30")).toBe("2026-08-10 14:30");
		expect(normalizeUtcDateTime("2026-08-10T14:30")).toBe("2026-08-10 14:30");
		expect(normalizeUtcDateTime("2026-08-10T16:30:45+02:00")).toBe("2026-08-10 14:30");
		expect(normalizeUtcDateTime("2026-08-10T14:30:59.999Z")).toBe("2026-08-10 14:30");
	});

	it("rejects date-only and invalid datetimes", () => {
		expect(() => normalizeUtcDateTime("2026-08-10", "Due date")).toThrow("Date-only values are not supported");
		expect(() => normalizeUtcDateTime("2026-02-30 12:00", "Due date")).toThrow("valid UTC datetime");
		expect(() => normalizeUtcDateTime("2026-08-10T14:30+15:00", "Due date")).toThrow("valid UTC datetime");
		expect(() => normalizeUtcDateTime("9999-12-31T23:59-14:00", "Due date")).toThrow("valid UTC datetime");
	});

	it("keeps offset-normalized four-digit years round-trippable", () => {
		const normalized = normalizeUtcDateTime("0100-01-01T00:00+14:00", "Due date");
		expect(normalized).toBe("0099-12-31 10:00");
		expect(normalizeUtcDateTime(normalized, "Due date")).toBe(normalized);
	});

	it("round-trips task and milestone due dates through Markdown", () => {
		const task: Task = {
			id: "TASK-1",
			title: "Due task",
			status: "To Do",
			assignee: [],
			createdDate: "2026-08-01 09:00",
			dueDate: "2026-08-10 14:30",
			labels: [],
			dependencies: [],
		};
		const serialized = serializeTask(task);
		expect(serialized).toContain("due_date:");
		expect(parseTask(serialized).dueDate).toBe("2026-08-10 14:30");

		const milestone = parseMilestone(`---
id: m-1
title: Release
due_date: 2026-08-10T16:30+02:00
---

## Description

Release milestone
`);
		expect(milestone.dueDate).toBe("2026-08-10 14:30");
	});

	it("rejects date-only due_date frontmatter instead of accepting YAML dates", () => {
		expect(() =>
			parseTask(`---
id: TASK-1
title: Invalid due date
status: To Do
assignee: []
created_date: 2026-08-01
due_date: 2026-08-10
labels: []
dependencies: []
---
`),
		).toThrow("Date-only values are not supported");
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
			dueDate: "2026-08-10T16:30+02:00",
		});
		expect(task.dueDate).toBe("2026-08-10 14:30");

		const updated = await core.updateTaskFromInput(task.id, { dueDate: "2026-08-12T09:15Z" });
		expect(updated.dueDate).toBe("2026-08-12 09:15");
		expect((await core.filesystem.loadTask(task.id))?.dueDate).toBe("2026-08-12 09:15");

		const cleared = await core.updateTaskFromInput(task.id, { dueDate: null });
		expect(cleared.dueDate).toBeUndefined();
		expect(await Bun.file(cleared.filePath ?? "").text()).not.toContain("due_date:");
	});

	it("creates, updates, and clears a milestone due date", async () => {
		const milestone = await core.filesystem.createMilestone("Release", undefined, "2026-09-01T12:00Z");
		expect(milestone.dueDate).toBe("2026-09-01 12:00");

		const updated = await core.filesystem.renameMilestone(milestone.id, milestone.title, "2026-09-02T13:30Z");
		expect(updated.milestone?.dueDate).toBe("2026-09-02 13:30");

		const cleared = await core.filesystem.renameMilestone(milestone.id, milestone.title, null);
		expect(cleared.milestone?.dueDate).toBeUndefined();
		const path = await core.filesystem.getMilestoneFilePath(milestone.id);
		expect(await Bun.file(path ?? "").text()).not.toContain("due_date:");
	});

	it("does not hide valid milestones when another file has an invalid due date", async () => {
		await core.filesystem.createMilestone("Valid release", undefined, "2026-09-01T12:00Z");
		await Bun.write(
			join(testDir, "backlog", "milestones", "m-1 - Invalid-release.md"),
			`---
id: m-1
title: "Invalid release"
due_date: 2026-09-01
---

## Description

Invalid release
`,
		);

		expect((await core.filesystem.listMilestones()).map((milestone) => milestone.title)).toEqual(["Valid release"]);
	});
});
