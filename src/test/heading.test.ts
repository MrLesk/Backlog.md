import { describe, expect, test } from "bun:test";
import { type HeadingLevel, formatHeading, getHeadingStyle } from "../ui/heading.ts";

describe("Heading component", () => {
	describe("getHeadingStyle", () => {
		test("should return correct style for level 1", () => {
			const style = getHeadingStyle(1);
			expect(style.color).toBe("bright-white");
			expect(style.bold).toBe(true);
		});

		test("should return correct style for level 2", () => {
			const style = getHeadingStyle(2);
			expect(style.color).toBe("cyan");
			expect(style.bold).toBe(false);
		});

		test("should return correct style for level 3", () => {
			const style = getHeadingStyle(3);
			expect(style.color).toBe("white");
			expect(style.bold).toBe(false);
		});
	});

	describe("formatHeading", () => {
		test("should format level 1 heading with bold and bright-white", () => {
			const formatted = formatHeading("Main Title", 1);
			expect(formatted).toBe("{bold}{brightwhite-fg}Main Title{/brightwhite-fg}{/bold}");
		});

		test("should format level 2 heading with cyan", () => {
			const formatted = formatHeading("Section Title", 2);
			expect(formatted).toBe("{cyan-fg}Section Title{/cyan-fg}");
		});

		test("should format level 3 heading with white", () => {
			const formatted = formatHeading("Subsection Title", 3);
			expect(formatted).toBe("{white-fg}Subsection Title{/white-fg}");
		});

		test("should handle empty text", () => {
			const formatted = formatHeading("", 1);
			expect(formatted).toBe("{bold}{brightwhite-fg}{/brightwhite-fg}{/bold}");
		});

		test("should handle special characters", () => {
			const formatted = formatHeading("Title with @#$%", 2);
			expect(formatted).toBe("{cyan-fg}Title with @#$%{/cyan-fg}");
		});
	});

	describe("heading levels", () => {
		test("should accept valid heading levels", () => {
			const levels: HeadingLevel[] = [1, 2, 3];

			for (const level of levels) {
				const style = getHeadingStyle(level);
				expect(style).toBeDefined();
				expect(typeof style.color).toBe("string");
				expect(typeof style.bold).toBe("boolean");
			}
		});

		test("should have distinct styles for each level", () => {
			const style1 = getHeadingStyle(1);
			const style2 = getHeadingStyle(2);
			const style3 = getHeadingStyle(3);

			// Level 1 should be the only bold one
			expect(style1.bold).toBe(true);
			expect(style2.bold).toBe(false);
			expect(style3.bold).toBe(false);

			// Each level should have different colors
			expect(style1.color).not.toBe(style2.color);
			expect(style2.color).not.toBe(style3.color);
			expect(style1.color).not.toBe(style3.color);
		});
	});

	describe("blessed tag formatting", () => {
		test("should produce valid blessed tags", () => {
			const level1 = formatHeading("Test", 1);
			const level2 = formatHeading("Test", 2);
			const level3 = formatHeading("Test", 3);

			// Should contain valid blessed tag syntax
			expect(level1).toMatch(/^\{.*\}.*\{\/.*\}$/);
			expect(level2).toMatch(/^\{.*\}.*\{\/.*\}$/);
			expect(level3).toMatch(/^\{.*\}.*\{\/.*\}$/);

			// Level 1 should have both bold and color tags
			expect(level1).toContain("{bold}");
			expect(level1).toContain("{/bold}");
			expect(level1).toContain("-fg}");

			// Level 2 and 3 should only have color tags
			expect(level2).not.toContain("{bold}");
			expect(level3).not.toContain("{bold}");
		});
	});
});
