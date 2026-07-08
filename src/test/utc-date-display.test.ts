import { describe, expect, it } from "bun:test";
import { formatTaskPlainText } from "../formatters/task-plain-text.ts";
import type { Task } from "../types/index.ts";
import { formatUtcDateForDisplay } from "../utils/utc-date-display.ts";

describe("UTC date display", () => {
	it("formats stored UTC task dates without applying the local timezone", () => {
		expect(formatUtcDateForDisplay("2026-06-07 21:54")).toBe("2026-06-07 21:54");
		expect(formatUtcDateForDisplay("2026-06-07T21:54")).toBe("2026-06-07 21:54");
		expect(formatUtcDateForDisplay("2026-06-07")).toBe("2026-06-07");
	});

	it("normalizes explicit timezone datetimes to UTC display text", () => {
		expect(formatUtcDateForDisplay("2026-06-07T23:54+02:00")).toBe("2026-06-07 21:54");
		expect(formatUtcDateForDisplay("2026-06-07 16:24-0530")).toBe("2026-06-07 21:54");
	});

	it("appends a UTC label for plain text surfaces", () => {
		expect(formatUtcDateForDisplay("2026-06-07", { appendUtcLabel: true })).toBe("2026-06-07 (UTC)");
		expect(formatUtcDateForDisplay("2026-06-07 21:54", { appendUtcLabel: true })).toBe("2026-06-07 21:54 (UTC)");
	});

	it("rearranges dates using a custom display format", () => {
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "dd/mm/yyyy" })).toBe("04/07/2026 21:54");
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "mm/dd/yyyy hh:mm" })).toBe("07/04/2026 21:54");
		expect(formatUtcDateForDisplay("2026-07-04", { dateFormat: "dd/mm/yyyy" })).toBe("04/07/2026");
		expect(formatUtcDateForDisplay("2026-07-04", { dateFormat: "dd.mm.yyyy" })).toBe("04.07.2026");
	});

	it("keeps canonical output for canonical-equivalent formats", () => {
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "yyyy-mm-dd" })).toBe("2026-07-04 21:54");
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "YYYY-MM-DD" })).toBe("2026-07-04 21:54");
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "yyyy-mm-dd hh:mm" })).toBe("2026-07-04 21:54");
		expect(formatUtcDateForDisplay("2026-07-04", { dateFormat: "yyyy-mm-dd" })).toBe("2026-07-04");
		expect(formatUtcDateForDisplay("2026-07-04", { dateFormat: undefined })).toBe("2026-07-04");
	});

	it("never invents a time for date-only values but always shows stored times", () => {
		expect(formatUtcDateForDisplay("2026-07-04", { dateFormat: "dd/mm/yyyy hh:mm" })).toBe("04/07/2026");
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "dd/mm/yyyy" })).toBe("04/07/2026 21:54");
	});

	it("falls back to canonical output for invalid formats without throwing", () => {
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "banana" })).toBe("2026-07-04 21:54");
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "dd-mm" })).toBe("2026-07-04 21:54");
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "yyyy" })).toBe("2026-07-04 21:54");
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "" })).toBe("2026-07-04 21:54");
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "dd/mm/yyyy hh" })).toBe("2026-07-04 21:54");
	});

	it("returns unparseable stored values as-is even with a format", () => {
		expect(formatUtcDateForDisplay("not a date", { dateFormat: "dd/mm/yyyy" })).toBe("not a date");
	});

	it("normalizes explicit-offset values to UTC before applying the format", () => {
		expect(formatUtcDateForDisplay("2026-07-04T23:54+02:00", { dateFormat: "dd/mm/yyyy" })).toBe("04/07/2026 21:54");
	});

	it("combines the UTC label with a custom format", () => {
		expect(formatUtcDateForDisplay("2026-07-04 21:54", { dateFormat: "dd/mm/yyyy", appendUtcLabel: true })).toBe(
			"04/07/2026 21:54 (UTC)",
		);
	});

	it("adds UTC labels to plain task and comment date fields", () => {
		const task: Task = {
			id: "TASK-1",
			title: "UTC plain output",
			status: "To Do",
			assignee: [],
			createdDate: "2026-06-07",
			updatedDate: "2026-06-07 21:54",
			labels: [],
			dependencies: [],
			description: "Task description",
			comments: [
				{
					index: 1,
					author: "@reviewer",
					createdDate: "2026-06-07T23:54+02:00",
					body: "Review note",
				},
			],
		};

		const output = formatTaskPlainText(task);

		expect(output).toContain("Created: 2026-06-07 (UTC)");
		expect(output).toContain("Updated: 2026-06-07 21:54 (UTC)");
		expect(output).toContain("#1 - @reviewer - 2026-06-07 21:54 (UTC)");
	});
});
