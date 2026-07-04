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
	it("renders datetime values as stored (UTC), not in the browser locale", () => {
		expect(formatStoredUtcDateForDisplay("2026-02-09 06:01")).toBe("2026-02-09 06:01");
	});

	it("renders date-only values as stored", () => {
		expect(formatStoredUtcDateForDisplay("2026-02-09")).toBe("2026-02-09");
	});

	it("applies a custom display format when provided", () => {
		expect(formatStoredUtcDateForDisplay("2026-02-09 06:01", "dd/mm/yyyy")).toBe("09/02/2026 06:01");
		expect(formatStoredUtcDateForDisplay("2026-02-09", "mm/dd/yyyy")).toBe("02/09/2026");
	});

	it("falls back to canonical output for invalid formats", () => {
		expect(formatStoredUtcDateForDisplay("2026-02-09 06:01", "banana")).toBe("2026-02-09 06:01");
	});

	it("falls back to original value when parsing fails", () => {
		expect(formatStoredUtcDateForDisplay("not-a-date")).toBe("not-a-date");
		expect(formatStoredUtcDateForDisplay("not-a-date", "dd/mm/yyyy")).toBe("not-a-date");
	});
});

describe("formatStoredUtcDateForCompactDisplay", () => {
	const now = new Date(Date.UTC(2026, 1, 21, 12, 0, 0));

	it("formats recent values as relative days", () => {
		expect(formatStoredUtcDateForCompactDisplay("2026-02-21", undefined, now)).toBe("today");
		expect(formatStoredUtcDateForCompactDisplay("2026-02-20", undefined, now)).toBe("yesterday");
		expect(formatStoredUtcDateForCompactDisplay("2026-02-18", undefined, now)).toBe("3d ago");
	});

	it("formats older values as a compact date", () => {
		expect(formatStoredUtcDateForCompactDisplay("2026-02-10", undefined, now)).toBe("2026-02-10");
		expect(formatStoredUtcDateForCompactDisplay("2026-02-10 06:01", undefined, now)).toBe("2026-02-10");
	});

	it("applies a custom display format to the compact date fallback", () => {
		expect(formatStoredUtcDateForCompactDisplay("2026-02-10", "dd/mm/yyyy", now)).toBe("10/02/2026");
		expect(formatStoredUtcDateForCompactDisplay("2026-02-10 06:01", "dd/mm/yyyy", now)).toBe("10/02/2026");
	});

	it("handles missing and invalid values gracefully", () => {
		expect(formatStoredUtcDateForCompactDisplay("", undefined, now)).toBe("—");
		expect(formatStoredUtcDateForCompactDisplay("not-a-date", undefined, now)).toBe("not-a-date");
	});
});
