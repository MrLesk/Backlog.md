import { describe, expect, test } from "bun:test";
import {
	alignAcceptanceCriteria,
	CHECKBOX_PATTERNS,
	type ChecklistItem,
	extractAndFormatAcceptanceCriteria,
	formatChecklist,
	formatChecklistItem,
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

	describe("formatChecklistItem", () => {
		test("should format checked item with default options", () => {
			const item: ChecklistItem = { text: "Test item", checked: true };
			const result = formatChecklistItem(item);
			expect(result).toBe(" [x] Test item");
		});

		test("should format unchecked item with default options", () => {
			const item: ChecklistItem = { text: "Test item", checked: false };
			const result = formatChecklistItem(item);
			expect(result).toBe(" [ ] Test item");
		});

		test("should use custom symbols", () => {
			const item: ChecklistItem = { text: "Test item", checked: true };
			const result = formatChecklistItem(item, {
				checkedSymbol: "☑",
				uncheckedSymbol: "☐",
			});
			expect(result).toBe(" ☑ Test item");
		});

		test("should use custom padding", () => {
			const item: ChecklistItem = { text: "Test item", checked: false };
			const result = formatChecklistItem(item, {
				padding: "  ",
			});
			expect(result).toBe("  [ ] Test item");
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

	describe("formatChecklist", () => {
		test("should format multiple items consistently", () => {
			const items: ChecklistItem[] = [
				{ text: "First item", checked: true },
				{ text: "Second item", checked: false },
				{ text: "Third item", checked: true },
			];

			const result = formatChecklist(items);
			expect(result).toEqual([" [x] First item", " [ ] Second item", " [x] Third item"]);
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

		test("should handle empty or whitespace-only lines", () => {
			const criteriaSection = `- [x] First item

- [ ] Second item
   
- [x] Third item`;

			const result = alignAcceptanceCriteria(criteriaSection);
			expect(result).toEqual([" [x] First item", " [ ] Second item", " [x] Third item"]);
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

	describe("alignment consistency", () => {
		test("all formatted items should start at the same column", () => {
			const items: ChecklistItem[] = [
				{ text: "Short", checked: true },
				{ text: "Much longer item text here", checked: false },
				{ text: "Medium length item", checked: true },
			];

			const formatted = formatChecklist(items);

			// All items should start with the same padding
			for (const line of formatted) {
				expect(line.startsWith(" ")).toBe(true);
				expect(line.charAt(0)).toBe(" ");
			}

			// All checkbox positions should be the same
			const checkboxPositions = formatted.map((line) => line.indexOf("["));
			const firstPosition = checkboxPositions[0] ?? -1;
			for (const position of checkboxPositions) {
				expect(position).toBe(firstPosition);
			}
		});
	});
});
