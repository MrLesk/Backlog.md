import { describe, expect, it } from "bun:test";
import { getHelpShortcuts } from "../ui/components/help-popup.ts";

const keysFor = (context: "board" | "task-list") => getHelpShortcuts(context).map((shortcut) => shortcut.key);

describe("help popup shortcuts", () => {
	it("keeps board-specific shortcuts in the board help menu", () => {
		const keys = keysFor("board");

		expect(keys).toContain("F");
		expect(keys).toContain("M");
		expect(keys).toContain("←→");
	});

	it("uses task-list shortcuts in the task viewer help menu", () => {
		const keys = keysFor("task-list");

		expect(keys).toContain("s");
		expect(keys).toContain("l");
		expect(keys).not.toContain("F");
		expect(keys).not.toContain("M");
	});
});
