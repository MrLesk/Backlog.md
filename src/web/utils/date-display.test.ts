import { describe, expect, it } from "bun:test";
import { formatStoredDateForCompactDisplay, formatStoredDateForDisplay, parseStoredUtcDate } from "./date-display";

// Every case passes an explicit timeZone so results never depend on the machine running the tests.
const TOKYO = "Asia/Tokyo"; // UTC+9, no DST
const LOS_ANGELES = "America/Los_Angeles"; // UTC-8/-7

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

describe("formatStoredDateForDisplay", () => {
	it("renders stored timestamps in the viewer's timezone", () => {
		expect(formatStoredDateForDisplay("2026-02-09 06:01", { timeZone: TOKYO })).toEqual({
			text: "2026-02-09 15:01",
			title: "2026-02-09 06:01 (UTC)",
		});
		expect(formatStoredDateForDisplay("2026-02-09 06:01", { timeZone: LOS_ANGELES })).toEqual({
			text: "2026-02-08 22:01",
			title: "2026-02-09 06:01 (UTC)",
		});
	});

	it("keeps the same instant when the viewer is in UTC", () => {
		expect(formatStoredDateForDisplay("2026-02-09 06:01", { timeZone: "UTC" })).toEqual({
			text: "2026-02-09 06:01",
			title: "2026-02-09 06:01 (UTC)",
		});
	});

	it("renders midnight without rolling the local hour to 24", () => {
		expect(formatStoredDateForDisplay("2026-02-09 15:00", { timeZone: TOKYO })).toEqual({
			text: "2026-02-10 00:00",
			title: "2026-02-09 15:00 (UTC)",
		});
	});

	it("leaves date-only values unconverted and without a misleading hover", () => {
		expect(formatStoredDateForDisplay("2026-02-09", { timeZone: TOKYO })).toEqual({ text: "2026-02-09" });
		expect(formatStoredDateForDisplay("2026-02-09", { timeZone: LOS_ANGELES })).toEqual({ text: "2026-02-09" });
	});

	it("applies the configured date format to both the local value and the UTC hover", () => {
		expect(formatStoredDateForDisplay("2026-02-09 06:01", { dateFormat: "dd/mm/yyyy", timeZone: TOKYO })).toEqual({
			text: "09/02/2026 15:01",
			title: "09/02/2026 06:01 (UTC)",
		});
		expect(
			formatStoredDateForDisplay("2026-02-09 06:01", { dateFormat: "mm/dd/yyyy hh:mm", timeZone: LOS_ANGELES }),
		).toEqual({
			text: "02/08/2026 22:01",
			title: "02/09/2026 06:01 (UTC)",
		});
		expect(formatStoredDateForDisplay("2026-02-09", { dateFormat: "mm/dd/yyyy", timeZone: LOS_ANGELES })).toEqual({
			text: "02/09/2026",
		});
	});

	it("falls back to canonical output for invalid formats", () => {
		expect(formatStoredDateForDisplay("2026-02-09 06:01", { dateFormat: "banana", timeZone: "UTC" })).toEqual({
			text: "2026-02-09 06:01",
			title: "2026-02-09 06:01 (UTC)",
		});
	});

	it("falls back to the original value when parsing fails", () => {
		expect(formatStoredDateForDisplay("not-a-date", { timeZone: TOKYO })).toEqual({ text: "not-a-date" });
		expect(formatStoredDateForDisplay("not-a-date", { dateFormat: "dd/mm/yyyy", timeZone: TOKYO })).toEqual({
			text: "not-a-date",
		});
		expect(formatStoredDateForDisplay(undefined, { timeZone: TOKYO })).toEqual({ text: "" });
	});
});

describe("formatStoredDateForCompactDisplay", () => {
	const now = new Date(Date.UTC(2026, 1, 21, 12, 0, 0));

	it("formats recent values as relative days", () => {
		expect(formatStoredDateForCompactDisplay("2026-02-21", { timeZone: TOKYO }, now).text).toBe("today");
		expect(formatStoredDateForCompactDisplay("2026-02-20", { timeZone: TOKYO }, now).text).toBe("yesterday");
		expect(formatStoredDateForCompactDisplay("2026-02-18", { timeZone: TOKYO }, now).text).toBe("3d ago");
	});

	it("keeps the canonical UTC value on hover for relative timestamps", () => {
		expect(formatStoredDateForCompactDisplay("2026-02-21 06:01", { timeZone: TOKYO }, now)).toEqual({
			text: "today",
			title: "2026-02-21 06:01 (UTC)",
		});
		expect(formatStoredDateForCompactDisplay("2026-02-21", { timeZone: TOKYO }, now).title).toBeUndefined();
	});

	it("formats older values as a compact date in the viewer's timezone", () => {
		expect(formatStoredDateForCompactDisplay("2026-02-10", { timeZone: LOS_ANGELES }, now).text).toBe("2026-02-10");
		expect(formatStoredDateForCompactDisplay("2026-02-10 06:01", { timeZone: LOS_ANGELES }, now).text).toBe(
			"2026-02-09",
		);
		expect(formatStoredDateForCompactDisplay("2026-02-10 06:01", { timeZone: TOKYO }, now).text).toBe("2026-02-10");
	});

	it("applies a custom display format to the compact date fallback", () => {
		expect(
			formatStoredDateForCompactDisplay("2026-02-10", { dateFormat: "dd/mm/yyyy", timeZone: TOKYO }, now).text,
		).toBe("10/02/2026");
		expect(
			formatStoredDateForCompactDisplay("2026-02-10 20:01", { dateFormat: "dd/mm/yyyy", timeZone: TOKYO }, now).text,
		).toBe("11/02/2026");
	});

	it("names the day by the viewer's calendar, not by elapsed hours", () => {
		// 17:00 on Feb 20 in Los Angeles. The stored value is 19 hours old but fell on Feb 19 locally.
		const lateEvening = new Date(Date.UTC(2026, 1, 21, 1, 0, 0));
		expect(formatStoredDateForCompactDisplay("2026-02-20 06:00", { timeZone: LOS_ANGELES }, lateEvening).text).toBe(
			"yesterday",
		);

		// The same trap the other way round the globe: 01:00 on Feb 22 in Tokyo, 6 hours after a Feb 21 stamp.
		const pastMidnight = new Date(Date.UTC(2026, 1, 21, 16, 0, 0));
		expect(formatStoredDateForCompactDisplay("2026-02-21 10:00", { timeZone: TOKYO }, pastMidnight).text).toBe(
			"yesterday",
		);

		// A UTC viewer reads calendar days too: 19 hours earlier is still the previous day.
		expect(formatStoredDateForCompactDisplay("2026-02-20 06:00", { timeZone: "UTC" }, lateEvening).text).toBe(
			"yesterday",
		);
	});

	it("counts older values in whole local days", () => {
		const lateEvening = new Date(Date.UTC(2026, 1, 21, 1, 0, 0));
		// Locally Feb 17 against a local today of Feb 20.
		expect(formatStoredDateForCompactDisplay("2026-02-18 06:00", { timeZone: LOS_ANGELES }, lateEvening).text).toBe(
			"3d ago",
		);
	});

	it("handles missing and invalid values gracefully", () => {
		expect(formatStoredDateForCompactDisplay("", { timeZone: TOKYO }, now)).toEqual({ text: "—" });
		expect(formatStoredDateForCompactDisplay("not-a-date", { timeZone: TOKYO }, now)).toEqual({ text: "not-a-date" });
	});
});
