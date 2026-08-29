import { describe, expect, it } from "bun:test";
import { normalizeStatusSet, statusMatchesSet } from "../utils/status-filter.ts";

describe("normalizeStatusSet", () => {
	it("lowercases and trims each status", () => {
		expect([...normalizeStatusSet(["To Do", "  DONE "])]).toEqual(["to do", "done"]);
	});

	it("accepts a single status string", () => {
		expect([...normalizeStatusSet("In Progress")]).toEqual(["in progress"]);
	});

	it("drops blank entries and deduplicates case-insensitively", () => {
		const set = normalizeStatusSet(["To Do", "", "   ", "TO DO"]);
		expect(set.size).toBe(1);
		expect(set.has("to do")).toBe(true);
	});

	it("returns an empty set for missing values", () => {
		expect(normalizeStatusSet(undefined).size).toBe(0);
	});
});

describe("statusMatchesSet", () => {
	it("matches task statuses case-insensitively", () => {
		const wanted = normalizeStatusSet(["to do", "done"]);
		expect(statusMatchesSet(wanted, "To Do")).toBe(true);
		expect(statusMatchesSet(wanted, "DONE")).toBe(true);
		expect(statusMatchesSet(wanted, "In Progress")).toBe(false);
	});

	it("treats missing task statuses as no match", () => {
		const wanted = normalizeStatusSet(["done"]);
		expect(statusMatchesSet(wanted, undefined)).toBe(false);
		expect(statusMatchesSet(wanted, null)).toBe(false);
	});

	it("matches nothing when the selection is empty", () => {
		const wanted = normalizeStatusSet([]);
		expect(statusMatchesSet(wanted, "Done")).toBe(false);
	});
});
