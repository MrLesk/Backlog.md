import { describe, expect, test } from "bun:test";
import { sanitizeBackticks, sanitizeOptions } from "../utils/sanitize-backticks.ts";

describe("sanitizeBackticks", () => {
	test("should detect and replace backlog command output", () => {
		const input = "backlog init\nSelect agent type:\n1. Claude\n2. GitHub Copilot";
		const result = sanitizeBackticks(input);
		expect(result).toBe(
			"[backticks were here but command was executed - please use single quotes to include literal backticks]",
		);
	});

	test("should detect prompt patterns", () => {
		const input = "Select your option:";
		const result = sanitizeBackticks(input);
		expect(result).toBe("[command substitution detected - please escape backticks]");
	});

	test("should leave normal text unchanged", () => {
		const input = "This is a normal task description";
		const result = sanitizeBackticks(input);
		expect(result).toBe(input);
	});

	test("should handle undefined input", () => {
		expect(sanitizeBackticks(undefined)).toBe(undefined);
	});
});

describe("sanitizeOptions", () => {
	test("should sanitize description field", () => {
		const options = {
			description: "backlog task list output here",
			otherField: "unchanged",
		};
		const result = sanitizeOptions(options);
		expect(result.description).toBe(
			"[backticks were here but command was executed - please use single quotes to include literal backticks]",
		);
		expect(result.otherField).toBe("unchanged");
	});

	test("should sanitize array fields", () => {
		const options = {
			ac: ["normal criteria", "Select type:", "another normal one"],
		};
		const result = sanitizeOptions(options);
		expect(result.ac[0]).toBe("normal criteria");
		expect(result.ac[1]).toBe("[command substitution detected - please escape backticks]");
		expect(result.ac[2]).toBe("another normal one");
	});

	test("should handle mixed option types", () => {
		const options = {
			description: "Enter your name:",
			plan: "Normal plan text",
			notes: undefined,
			labels: ["label1", "label2"],
		};
		const result = sanitizeOptions(options);
		expect(result.description).toBe("[command substitution detected - please escape backticks]");
		expect(result.plan).toBe("Normal plan text");
		expect(result.notes).toBe(undefined);
		expect(result.labels).toEqual(["label1", "label2"]);
	});
});
