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
