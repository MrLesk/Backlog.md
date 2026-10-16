import { describe, expect, test } from "bun:test";
import { formatHeading } from "../ui/heading.ts";

describe("Heading component", () => {
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
});
