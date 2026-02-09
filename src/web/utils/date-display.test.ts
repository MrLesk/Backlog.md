import { describe, expect, it } from "bun:test";
import { formatStoredUtcDateForDisplay, parseStoredUtcDate } from "./date-display";

describe("parseStoredUtcDate", () => {
	it("parses stored UTC datetime strings", () => {
		const parsed = parseStoredUtcDate("2026-02-09 06:01");
		expect(parsed).not.toBeNull();
		expect(parsed?.toISOString()).toBe("2026-02-09T06:01:00.000Z");
	});

	it("parses date-only strings as UTC midnight", () => {
		const parsed = parseStoredUtcDate("2026-02-09");
		expect(parsed).not.toBeNull();
		expect(parsed?.toISOString()).toBe("2026-02-09T00:00:00.000Z");
	});

	it("returns null for invalid date values", () => {
		expect(parseStoredUtcDate("2026-02-31 06:01")).toBeNull();
		expect(parseStoredUtcDate("not-a-date")).toBeNull();
	});
});

describe("formatStoredUtcDateForDisplay", () => {
	it("formats datetime values in local timezone", () => {
		const expected = new Date(Date.UTC(2026, 1, 9, 6, 1, 0)).toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		});
		expect(formatStoredUtcDateForDisplay("2026-02-09 06:01")).toBe(expected);
	});

	it("formats date-only values as local dates", () => {
		const expected = new Date(Date.UTC(2026, 1, 9, 0, 0, 0)).toLocaleDateString();
		expect(formatStoredUtcDateForDisplay("2026-02-09")).toBe(expected);
	});

	it("falls back to original value when parsing fails", () => {
		expect(formatStoredUtcDateForDisplay("not-a-date")).toBe("not-a-date");
	});
});
