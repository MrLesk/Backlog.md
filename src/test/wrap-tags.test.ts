import { describe, expect, it } from "bun:test";
import { wrapBlessedText } from "../ui/utils/wrap-tags.ts";

const visible = (line: string) => line.replace(/\{\/?[^{}]*\}/g, "");

describe("wrapBlessedText", () => {
	it("returns a single line when the content already fits", () => {
		expect(wrapBlessedText("short title", 40)).toEqual(["short title"]);
	});

	it("breaks long plain text on word boundaries", () => {
		const lines = wrapBlessedText("one two three four five", 10);
		expect(lines.every((line) => visible(line).length <= 10)).toBe(true);
		expect(lines.join(" ")).toBe("one two three four five");
	});

	it("measures visible width without counting markup", () => {
		// 11 visible chars wrapped in tags that are far longer than the limit.
		const lines = wrapBlessedText("{bold}{cyan-fg}hello world{/}{/}", 20);
		expect(lines).toHaveLength(1);
	});

	it("re-opens tags that were still active when the line broke", () => {
		const lines = wrapBlessedText("{bold}alpha beta gamma delta{/bold}", 12);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) {
			expect(line).toContain("{bold}");
		}
		expect(lines.map(visible).join(" ")).toBe("alpha beta gamma delta");
	});

	it("indents continuation lines without indenting the first", () => {
		const lines = wrapBlessedText("alpha beta gamma delta", 12, "    ");
		expect(lines[0]?.startsWith(" ")).toBe(false);
		for (const line of lines.slice(1)) {
			expect(line.startsWith("    ")).toBe(true);
		}
	});

	it("splits a single word that cannot fit on one line", () => {
		const lines = wrapBlessedText("supercalifragilistic", 8);
		expect(lines.every((line) => visible(line).length <= 8)).toBe(true);
		expect(lines.map(visible).join("")).toBe("supercalifragilistic");
	});

	it("preserves all visible text for a realistic task row", () => {
		const row = "{bold}TASK-001{/bold} - Review promo-tester with Opus 5 and rank what needs fixing";
		const lines = wrapBlessedText(row, 24, "  ");
		expect(lines.map((line) => visible(line).trim()).join(" ")).toBe(
			"TASK-001 - Review promo-tester with Opus 5 and rank what needs fixing",
		);
		expect(lines.every((line) => visible(line).length <= 24)).toBe(true);
	});

	it("does not emit trailing rows that contain only markup", () => {
		const lines = wrapBlessedText("{yellow-fg}alpha beta{/yellow-fg}", 10);
		expect(lines.every((line) => visible(line).trim().length > 0)).toBe(true);
	});

	it("falls back to the original string for a non-positive width", () => {
		expect(wrapBlessedText("anything", 0)).toEqual(["anything"]);
	});
});
