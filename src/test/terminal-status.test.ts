import { describe, expect, it } from "bun:test";
import { getTerminalStatus, isTerminalStatus } from "../utils/terminal-status.ts";

describe("terminal status helpers", () => {
	it("uses the final configured status as terminal", () => {
		expect(getTerminalStatus(["To Do", "Review", "Closed"])).toBe("Closed");
	});

	it("compares terminal statuses case-insensitively for URL and user input values", () => {
		expect(isTerminalStatus("closed", ["To Do", "Review", "Closed"])).toBe(true);
		expect(isTerminalStatus("CLOSED", ["To Do", "Review", "Closed"])).toBe(true);
		expect(isTerminalStatus("review", ["To Do", "Review", "Closed"])).toBe(false);
	});

	it("preserves internal spaces when comparing status names", () => {
		expect(isTerminalStatus("InProgress", ["To Do", "In Progress", "InProgress"])).toBe(true);
		expect(isTerminalStatus("In Progress", ["To Do", "In Progress", "InProgress"])).toBe(false);
	});
});

describe("terminalStatuses override", () => {
	it("getTerminalStatus returns first terminalStatuses entry when provided", () => {
		expect(getTerminalStatus(["Offen", "Blockiert", "Fertig"], ["Fertig", "Abgebrochen"])).toBe("Fertig");
	});

	it("isTerminalStatus matches any entry in terminalStatuses", () => {
		const statuses = ["Offen", "In Arbeit", "Fertig"];
		const terminalStatuses = ["Fertig", "Abgebrochen"];
		expect(isTerminalStatus("Fertig", statuses, terminalStatuses)).toBe(true);
		expect(isTerminalStatus("Abgebrochen", statuses, terminalStatuses)).toBe(true);
		expect(isTerminalStatus("fertig", statuses, terminalStatuses)).toBe(true);
		expect(isTerminalStatus("Offen", statuses, terminalStatuses)).toBe(false);
		expect(isTerminalStatus("In Arbeit", statuses, terminalStatuses)).toBe(false);
	});

	it("falls back to last-element convention when terminalStatuses is absent", () => {
		const statuses = ["Offen", "In Arbeit", "Fertig"];
		expect(isTerminalStatus("Fertig", statuses)).toBe(true);
		expect(isTerminalStatus("Fertig", statuses, undefined)).toBe(true);
		expect(isTerminalStatus("Fertig", statuses, null)).toBe(true);
		expect(isTerminalStatus("Offen", statuses)).toBe(false);
	});

	it("falls back to last-element when terminalStatuses is empty array", () => {
		const statuses = ["Offen", "Fertig"];
		expect(isTerminalStatus("Fertig", statuses, [])).toBe(true);
		expect(isTerminalStatus("Offen", statuses, [])).toBe(false);
	});

	it("non-last status not treated as terminal when terminalStatuses overrides", () => {
		const statuses = ["Offen", "In Arbeit", "Fertig", "Blockiert"];
		const terminalStatuses = ["Fertig"];
		expect(isTerminalStatus("Fertig", statuses, terminalStatuses)).toBe(true);
		expect(isTerminalStatus("Blockiert", statuses, terminalStatuses)).toBe(false);
	});
});
