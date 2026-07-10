import { describe, expect, it } from "bun:test";
import { createUrlPath, sanitizeUrlTitle } from "./urlHelpers.ts";

describe("task URL helpers", () => {
	it("keeps the canonical padded subtask ID and sanitizes a cosmetic title", () => {
		expect(createUrlPath("/tasks", "BACK-001.02", "Fix labels / café & docs?")).toBe(
			"/tasks/BACK-001.02/fix-labels-caf-docs",
		);
	});

	it("omits an empty cosmetic slug without leaving a trailing slash", () => {
		expect(sanitizeUrlTitle("🚀")).toBe("");
		expect(createUrlPath("/board", "TASK-7", "🚀")).toBe("/board/TASK-7");
	});

	it("preserves explicit prefixes that disambiguate equal numeric IDs", () => {
		expect(createUrlPath("/tasks", "BACK-7", "Backlog task")).toBe("/tasks/BACK-7/backlog-task");
		expect(createUrlPath("/tasks", "JIRA-007", "Jira task")).toBe("/tasks/JIRA-007/jira-task");
	});

	it("preserves an exact legacy ID in the route", () => {
		expect(createUrlPath("/tasks", "TASK-PREFIXED", "Legacy task")).toBe("/tasks/TASK-PREFIXED/legacy-task");
	});
});
