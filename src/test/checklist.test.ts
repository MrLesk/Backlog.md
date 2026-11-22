import { describe, expect, test } from "bun:test";
import {
	alignAcceptanceCriteria,
	CHECKBOX_PATTERNS,
	extractAndFormatAcceptanceCriteria,
	parseCheckboxLine,
	parseCheckboxLines,
} from "../ui/checklist.ts";

describe("Checklist utilities", () => {
	describe("CHECKBOX_PATTERNS", () => {
		test("should match checked checkbox lines", () => {
			const testCases = [
				"- [x] Checked item",
				"  - [x] Indented checked item",
				"- [x]   Item with extra spaces",
				"-[x] No space after dash",
			];

			for (const testCase of testCases) {
				expect(CHECKBOX_PATTERNS.CHECKBOX_LINE.test(testCase)).toBe(true);
			}
		});

		test("should match unchecked checkbox lines", () => {
			const testCases = [
				"- [ ] Unchecked item",
				"  - [ ] Indented unchecked item",
				"- [ ]   Item with extra spaces",
				"-[ ] No space after dash",
			];

			for (const testCase of testCases) {
				expect(CHECKBOX_PATTERNS.CHECKBOX_LINE.test(testCase)).toBe(true);
			}
		});

		test("should not match non-checkbox lines", () => {
			const testCases = [
				"Regular text",
				"- Regular bullet point",
				"- [ Missing closing bracket",
				"- [y] Invalid checkbox state",
				"[x] Missing dash prefix",
				"## Header",
			];

			for (const testCase of testCases) {
				expect(CHECKBOX_PATTERNS.CHECKBOX_LINE.test(testCase)).toBe(false);
			}
		});

		test("should match checkbox prefix pattern", () => {
			expect(CHECKBOX_PATTERNS.CHECKBOX_PREFIX.test("- [x] ")).toBe(true);
			expect(CHECKBOX_PATTERNS.CHECKBOX_PREFIX.test("- [ ] ")).toBe(true);
			expect(CHECKBOX_PATTERNS.CHECKBOX_PREFIX.test("-[x] ")).toBe(true);
			expect(CHECKBOX_PATTERNS.CHECKBOX_PREFIX.test("- [x]")).toBe(true);
		});
	});

	describe("parseCheckboxLine", () => {
		test("should parse checked checkbox lines", () => {
			const result = parseCheckboxLine("- [x] This is checked");
			expect(result).toEqual({
				text: "This is checked",
				checked: true,
			});
		});

		test("should parse unchecked checkbox lines", () => {
			const result = parseCheckboxLine("- [ ] This is unchecked");
			expect(result).toEqual({
				text: "This is unchecked",
				checked: false,
			});
		});

		test("should handle indented checkboxes", () => {
			const result = parseCheckboxLine("  - [x] Indented checkbox");
			expect(result).toEqual({
				text: "Indented checkbox",
				checked: true,
			});
		});

		test("should handle extra whitespace", () => {
			const result = parseCheckboxLine("- [x]   Extra spaces around text   ");
			expect(result).toEqual({
				text: "Extra spaces around text",
				checked: true,
			});
		});

		test("should return null for non-checkbox lines", () => {
			expect(parseCheckboxLine("Regular text")).toBe(null);
			expect(parseCheckboxLine("- Regular bullet")).toBe(null);
			expect(parseCheckboxLine("## Header")).toBe(null);
		});
	});

	describe("parseCheckboxLines", () => {
		test("should parse multiple checkbox lines", () => {
			const text = `- [x] First item
- [ ] Second item
- [x] Third item`;

			const result = parseCheckboxLines(text);
			expect(result).toEqual([
				{ text: "First item", checked: true },
				{ text: "Second item", checked: false },
				{ text: "Third item", checked: true },
			]);
		});

		test("should ignore non-checkbox lines", () => {
			const text = `- [x] Checkbox item
Regular text
- [ ] Another checkbox
## Header`;

			const result = parseCheckboxLines(text);
			expect(result).toEqual([
				{ text: "Checkbox item", checked: true },
				{ text: "Another checkbox", checked: false },
			]);
		});
	});

	describe("alignAcceptanceCriteria", () => {
		test("should align checkbox items consistently", () => {
			const criteriaSection = `- [x] First criterion
- [ ] Second criterion
- [x] Third criterion`;

			const result = alignAcceptanceCriteria(criteriaSection);
			expect(result).toEqual([" [x] First criterion", " [ ] Second criterion", " [x] Third criterion"]);
		});

		test("should handle mixed content with consistent padding", () => {
			const criteriaSection = `- [x] Checkbox item
Regular note
- [ ] Another checkbox`;

			const result = alignAcceptanceCriteria(criteriaSection);
			expect(result).toEqual([" [x] Checkbox item", " Regular note", " [ ] Another checkbox"]);
		});
	});

	describe("extractAndFormatAcceptanceCriteria", () => {
		test("should extract and format acceptance criteria from markdown", () => {
			const content = `## Description
Some description here.

## Acceptance Criteria
- [x] First criterion is done
- [ ] Second criterion pending
- [x] Third criterion complete

## Implementation Notes
Some notes here.`;

			const result = extractAndFormatAcceptanceCriteria(content);
			expect(result).toEqual([
				" [x] First criterion is done",
				" [ ] Second criterion pending",
				" [x] Third criterion complete",
			]);
		});

		test("should return empty array when no acceptance criteria section exists", () => {
			const content = `## Description
Some description here.

## Implementation Notes
Some notes here.`;

			const result = extractAndFormatAcceptanceCriteria(content);
			expect(result).toEqual([]);
		});

		test("should handle case-insensitive section headers", () => {
			const content = `## acceptance criteria
- [x] Test item
- [ ] Another test`;

			const result = extractAndFormatAcceptanceCriteria(content);
			expect(result).toEqual([" [x] Test item", " [ ] Another test"]);
		});
	});
});
