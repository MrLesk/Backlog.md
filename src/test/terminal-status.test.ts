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
});
