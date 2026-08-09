import { describe, expect, it } from "bun:test";
import { getHelpShortcuts } from "../ui/components/help-popup.ts";
import { BOARD_FOOTER_CONTENT, formatFooterContent, TASK_LIST_FOOTER_CONTENT } from "../ui/footer-content.ts";

/** Filter letters advertised by a footer, e.g. "T/P/I/F" -> ["T", "P", "I", "F"]. */
function filterHintKeys(footer: string): string[] {
	const hint = footer.match(/\[([^\]]+)\]\{\/\} Filter\b/)?.[1];
	if (!hint) throw new Error(`footer has no filter hint: ${footer}`);
	return hint.split("/");
}

/** The keys a hint maps to: uppercase letters are indicators, the bound key is lowercase. */
function boundKeys(footer: string): string[] {
	return filterHintKeys(footer).map((key) => key.toLowerCase());
}

function helpFilterKeys(context: "board" | "task-list"): string[] {
	return getHelpShortcuts(context)
		.filter((shortcut) => shortcut.desc.startsWith("Filter by "))
		.map((shortcut) => shortcut.key);
}

describe("TUI footer filter hint", () => {
	// The board has no status filter (its columns are the statuses) and uses F for labels
	// because L navigates columns there. Both views list the letters in filter-header order:
	// status, type, priority, milestone, labels.
	it("maps to the filter keys each view actually binds", () => {
		expect(boundKeys(BOARD_FOOTER_CONTENT)).toEqual(["t", "p", "i", "f"]);
		expect(boundKeys(TASK_LIST_FOOTER_CONTENT)).toEqual(["s", "t", "p", "i", "l"]);
	});

	it("uses the same uppercase slash-separated indicator convention in both views", () => {
		for (const footer of [BOARD_FOOTER_CONTENT, TASK_LIST_FOOTER_CONTENT]) {
			expect(footer).toMatch(/\{cyan-fg\}\[[A-Z](?:\/[A-Z])+\]\{\/\} Filter \|/);
		}
	});

	it("keeps the help popup filter rows in step with the footer hint", () => {
		expect(helpFilterKeys("board")).toEqual(filterHintKeys(BOARD_FOOTER_CONTENT));
		expect(helpFilterKeys("task-list")).toEqual(filterHintKeys(TASK_LIST_FOOTER_CONTENT));
	});
});

describe("formatFooterContent", () => {
	it("keeps footer on one line when terminal width is sufficient", () => {
		const content = " {cyan-fg}[Tab]{/} Switch View | {cyan-fg}[/]{/} Search | {cyan-fg}[q/Esc]{/} Quit";

		const result = formatFooterContent(content, 120);

		expect(result.height).toBe(1);
		expect(result.content.includes("\n")).toBe(false);
	});

	it("wraps footer into two lines by splitting on separators", () => {
		const content =
			" {cyan-fg}[Tab]{/} Switch View | {cyan-fg}[/]{/} Search | {cyan-fg}[p]{/} Priority | {cyan-fg}[i]{/} Milestone | {cyan-fg}[l]{/} Labels | {cyan-fg}[q/Esc]{/} Quit";

		const result = formatFooterContent(content, 52);
		const lines = result.content.split("\n");

		expect(result.height).toBe(2);
		expect(lines).toHaveLength(2);
		expect(lines[0]?.includes("|")).toBe(true);
		expect(lines[1]?.includes("|")).toBe(true);
	});

	it("fills the first line progressively so the second line grows as width shrinks", () => {
		const content = " one | two | three | four | five";

		const wider = formatFooterContent(content, 28);
		const narrower = formatFooterContent(content, 22);

		expect(wider.height).toBe(2);
		expect(narrower.height).toBe(2);
		expect(wider.content).toBe(" one | two | three | four\n five");
		expect(narrower.content).toBe(" one | two | three\n four | five");
	});

	it("returns original content for messages without separators", () => {
		const content = " {red-fg}Failed to open editor.{/}";

		const result = formatFooterContent(content, 24);

		expect(result.height).toBe(1);
		expect(result.content).toBe(content);
	});
});
