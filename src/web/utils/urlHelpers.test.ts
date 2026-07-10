import { describe, expect, it } from "bun:test";
import { createUrlPath, sanitizeUrlTitle } from "./urlHelpers.ts";

describe("task URL helpers", () => {
	it("keeps the numeric padded subtask ID and sanitizes a cosmetic title", () => {
		expect(createUrlPath("/tasks", "BACK-001.02", "Fix labels / café & docs?")).toBe(
			"/tasks/001.02/fix-labels-caf-docs",
		);
	});

	it("omits an empty cosmetic slug without leaving a trailing slash", () => {
		expect(sanitizeUrlTitle("🚀")).toBe("");
		expect(createUrlPath("/board", "TASK-7", "🚀")).toBe("/board/7");
	});
});
