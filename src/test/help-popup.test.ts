import { describe, expect, it } from "bun:test";
import { getHelpPopupHeight, getHelpShortcuts } from "../ui/components/help-popup.ts";

const keysFor = (context: "board" | "task-list") => getHelpShortcuts(context).map((shortcut) => shortcut.key);

describe("help popup shortcuts", () => {
	it("keeps board-specific shortcuts in the board help menu", () => {
		const keys = keysFor("board");

		expect(keys).toContain("F");
		expect(keys).toContain("T");
		expect(keys).toContain("M");
		expect(keys).toContain("N");
		expect(keys).toContain("←→");
	});

	it("uses task-list shortcuts in the task viewer help menu", () => {
		const keys = keysFor("task-list");

		expect(keys).toContain("S");
		expect(keys).toContain("T");
		expect(keys).toContain("L");
		expect(keys).not.toContain("F");
		expect(keys).not.toContain("M");
	});

	it("shows every shortcut row when the terminal has room, and stays on-screen when it does not", () => {
		for (const context of ["board", "task-list"] as const) {
			const count = getHelpShortcuts(context).length;
			// 4 rows of chrome (borders, top spacer, help line) leave one row per shortcut.
			expect(getHelpPopupHeight(count, 40) - 4).toBe(count);
			expect(getHelpPopupHeight(count, 24) - 4).toBe(count);
			for (const screenHeight of [10, 14, 18, 24, 30]) {
				expect(getHelpPopupHeight(count, screenHeight)).toBeLessThanOrEqual(screenHeight);
			}
		}
	});
});
