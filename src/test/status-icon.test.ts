import { describe, expect, test } from "bun:test";
import { formatStatusWithIcon, getStatusColor, getStatusIcon, getStatusStyle } from "../ui/status-icon.ts";

describe("Status Icon Component", () => {
	describe("getStatusStyle", () => {
		test("returns correct style for Done status", () => {
			const style = getStatusStyle("Done");
			expect(style.icon).toBe("✔");
			expect(style.color).toBe("green");
		});

		test("returns correct style for In Progress status", () => {
			const style = getStatusStyle("In Progress");
			expect(style.icon).toBe("◒");
			expect(style.color).toBe("yellow");
		});

		test("returns correct style for Blocked status", () => {
			const style = getStatusStyle("Blocked");
			expect(style.icon).toBe("●");
			expect(style.color).toBe("red");
		});

		test("returns correct style for To Do status", () => {
			const style = getStatusStyle("To Do");
			expect(style.icon).toBe("○");
			expect(style.color).toBe("white");
		});

		test("returns correct style for Review status", () => {
			const style = getStatusStyle("Review");
			expect(style.icon).toBe("◆");
			expect(style.color).toBe("blue");
		});

		test("returns correct style for Testing status", () => {
			const style = getStatusStyle("Testing");
			expect(style.icon).toBe("▣");
			expect(style.color).toBe("cyan");
		});

		test("returns default style for unknown status", () => {
			const style = getStatusStyle("Unknown Status");
			expect(style.icon).toBe("○");
			expect(style.color).toBe("white");
		});
	});

	describe("getStatusColor", () => {
		test("returns correct color for each status", () => {
			expect(getStatusColor("Done")).toBe("green");
			expect(getStatusColor("In Progress")).toBe("yellow");
			expect(getStatusColor("Blocked")).toBe("red");
			expect(getStatusColor("To Do")).toBe("white");
			expect(getStatusColor("Review")).toBe("blue");
			expect(getStatusColor("Testing")).toBe("cyan");
		});

		test("returns default color for unknown status", () => {
			expect(getStatusColor("Unknown")).toBe("white");
		});
	});

	describe("getStatusIcon", () => {
		test("returns correct icon for each status", () => {
			expect(getStatusIcon("Done")).toBe("✔");
			expect(getStatusIcon("In Progress")).toBe("◒");
			expect(getStatusIcon("Blocked")).toBe("●");
			expect(getStatusIcon("To Do")).toBe("○");
			expect(getStatusIcon("Review")).toBe("◆");
			expect(getStatusIcon("Testing")).toBe("▣");
		});

		test("returns default icon for unknown status", () => {
			expect(getStatusIcon("Unknown")).toBe("○");
		});
	});

	describe("formatStatusWithIcon", () => {
		test("formats status with correct icon", () => {
			expect(formatStatusWithIcon("Done")).toBe("✔ Done");
			expect(formatStatusWithIcon("In Progress")).toBe("◒ In Progress");
			expect(formatStatusWithIcon("Blocked")).toBe("● Blocked");
			expect(formatStatusWithIcon("To Do")).toBe("○ To Do");
			expect(formatStatusWithIcon("Review")).toBe("◆ Review");
			expect(formatStatusWithIcon("Testing")).toBe("▣ Testing");
		});

		test("formats unknown status with default icon", () => {
			expect(formatStatusWithIcon("Custom Status")).toBe("○ Custom Status");
		});
	});
});
