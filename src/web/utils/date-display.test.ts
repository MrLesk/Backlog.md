import { describe, expect, it } from "bun:test";
import {
	formatStoredUtcDateForCompactDisplay,
	formatStoredUtcDateForDisplay,
	parseStoredUtcDate,
} from "./date-display";

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

describe("formatStoredUtcDateForCompactDisplay", () => {
	const now = new Date(Date.UTC(2026, 1, 21, 12, 0, 0));

	it("formats recent values as relative days", () => {
		expect(formatStoredUtcDateForCompactDisplay("2026-02-21", now)).toBe("today");
		expect(formatStoredUtcDateForCompactDisplay("2026-02-20", now)).toBe("yesterday");
		expect(formatStoredUtcDateForCompactDisplay("2026-02-18", now)).toBe("3d ago");
	});

	it("formats older values as short date", () => {
		const expected = new Date(Date.UTC(2026, 1, 10, 0, 0, 0)).toLocaleDateString();
		expect(formatStoredUtcDateForCompactDisplay("2026-02-10", now)).toBe(expected);
	});

	it("handles missing and invalid values gracefully", () => {
		expect(formatStoredUtcDateForCompactDisplay("", now)).toBe("—");
		expect(formatStoredUtcDateForCompactDisplay("not-a-date", now)).toBe("not-a-date");
	});
});
