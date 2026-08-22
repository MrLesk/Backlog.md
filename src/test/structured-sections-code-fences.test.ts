import { describe, expect, it } from "bun:test";
import { extractStructuredSection, updateStructuredSections } from "../markdown/structured-sections.ts";

function roundTripNotes(notes: string): string {
	const content = updateStructuredSections("# Task\n\nInitial description", { implementationNotes: notes });
	const extracted = extractStructuredSection(content, "implementationNotes");
	expect(extracted).toBeDefined();
	return extracted ?? "";
}

describe("structured sections blank-line normalization with code fences", () => {
	it("preserves consecutive blank lines inside backtick fences byte-for-byte", () => {
		const notes = [
			"intro",
			"",
			"```python",
			"def a():",
			"    pass",
			"",
			"",
			"",
			"def b():",
			"    pass",
			"```",
			"outro",
		].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("preserves consecutive blank lines inside tilde fences byte-for-byte", () => {
		const notes = ["~~~", "line one", "", "", "", "line two", "~~~"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("preserves blank lines directly after the opening fence", () => {
		const notes = ["```", "", "", "code", "```"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("preserves blank lines directly before the closing fence", () => {
		const notes = ["```", "code", "", "", "```"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("preserves the rest of the text after an unterminated backtick fence", () => {
		const notes = ["intro", "", "```", "opened", "", "", "still fenced", "", "", "also fenced"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("preserves the rest of the text after an unterminated tilde fence", () => {
		const notes = ["~~~", "", "", "still fenced"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("keeps a fence open when the closing run is shorter than the opening run", () => {
		const notes = ["````", "", "", "```", "", "", "code"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("keeps a fence open when a different fence character appears", () => {
		const notes = ["~~~", "", "", "```", "", "", "code"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("treats fences indented up to three spaces as fenced code blocks", () => {
		const notes = ["text", "", "   ```", "", "", "x", "   ```"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("does not treat four-space indentation as a fence opener", () => {
		const notes = ["text", "", "    ```", "", "", "x"].join("\n");
		expect(roundTripNotes(notes)).toBe("text\n\n    ```\n\nx");
	});

	it("does not treat a backtick info string containing backticks as a fence opener", () => {
		const notes = ["```js `example`", "", "", "x"].join("\n");
		expect(roundTripNotes(notes)).toBe("```js `example`\n\nx");
	});

	it("allows backticks in tilde fence info strings", () => {
		const notes = ["~~~js ```", "", "", "x"].join("\n");
		expect(roundTripNotes(notes)).toBe(notes);
	});

	it("still collapses consecutive blank lines in prose around fences", () => {
		const notes = [
			"before",
			"",
			"",
			"",
			"```",
			"code",
			"",
			"",
			"code2",
			"```",
			"",
			"",
			"",
			"after",
			"",
			"",
			"",
			"",
		].join("\n");
		const expected = ["before", "", "```", "code", "", "", "code2", "```", "", "after"].join("\n");
		expect(roundTripNotes(notes)).toBe(expected);
	});

	it("normalizes prose without fences exactly as before", () => {
		expect(roundTripNotes(["a", "", "", "", "b"].join("\n"))).toBe("a\n\nb");
		expect(roundTripNotes(["a", "", "b"].join("\n"))).toBe("a\n\nb");
	});

	it("is idempotent across repeated edits", () => {
		const notes = ["```", "", "", "kept", "```", "", "", "collapsed once"].join("\n");
		const once = roundTripNotes(notes);
		expect(roundTripNotes(once)).toBe(once);
	});
});
