import { describe, expect, test } from "bun:test";
import {
	buildFilenameIdRegex,
	buildGlobPattern,
	buildIdRegex,
	DEFAULT_PREFIX_CONFIG,
	extractIdBody,
	extractIdNumbers,
	generateNextId,
	generateNextSubtaskId,
	getDefaultPrefixConfig,
	hasPrefix,
	idsEqual,
	mergePrefixConfig,
	normalizeId,
} from "../utils/prefix-config.ts";

describe("prefix-config", () => {
	describe("getDefaultPrefixConfig", () => {
		test("returns default task and draft prefixes", () => {
			const config = getDefaultPrefixConfig();
			expect(config.task).toBe("task");
			expect(config.draft).toBe("draft");
		});

		test("returns a new object each time", () => {
			const config1 = getDefaultPrefixConfig();
			const config2 = getDefaultPrefixConfig();
			expect(config1).not.toBe(config2);
			expect(config1).toEqual(config2);
		});
	});

	describe("mergePrefixConfig", () => {
		test("returns defaults when no config provided", () => {
			const config = mergePrefixConfig();
			expect(config).toEqual(DEFAULT_PREFIX_CONFIG);
		});

		test("returns defaults when empty object provided", () => {
			const config = mergePrefixConfig({});
			expect(config).toEqual(DEFAULT_PREFIX_CONFIG);
		});

		test("merges partial config with defaults", () => {
			const config = mergePrefixConfig({ task: "JIRA" });
			expect(config.task).toBe("JIRA");
			expect(config.draft).toBe("draft");
		});

		test("uses all custom values when provided", () => {
			const config = mergePrefixConfig({ task: "issue", draft: "idea" });
			expect(config.task).toBe("issue");
			expect(config.draft).toBe("idea");
		});
	});

	describe("normalizeId", () => {
		test("adds prefix to numeric ID", () => {
			expect(normalizeId("123", "task")).toBe("task-123");
			expect(normalizeId("456", "draft")).toBe("draft-456");
		});

		test("preserves existing prefix", () => {
			expect(normalizeId("task-123", "task")).toBe("task-123");
			expect(normalizeId("draft-456", "draft")).toBe("draft-456");
		});

		test("normalizes case of prefix", () => {
			expect(normalizeId("TASK-123", "task")).toBe("task-123");
			expect(normalizeId("Task-456", "task")).toBe("task-456");
		});

		test("works with custom prefixes", () => {
			expect(normalizeId("789", "JIRA")).toBe("JIRA-789");
			expect(normalizeId("JIRA-789", "JIRA")).toBe("JIRA-789");
			expect(normalizeId("jira-789", "JIRA")).toBe("JIRA-789");
		});

		test("handles hierarchical IDs", () => {
			expect(normalizeId("5.2.1", "task")).toBe("task-5.2.1");
			expect(normalizeId("task-5.2.1", "task")).toBe("task-5.2.1");
		});

		test("trims whitespace", () => {
			expect(normalizeId("  123  ", "task")).toBe("task-123");
			expect(normalizeId("  task-123  ", "task")).toBe("task-123");
		});
	});

	describe("extractIdBody", () => {
		test("extracts body from prefixed ID", () => {
			expect(extractIdBody("task-123", "task")).toBe("123");
			expect(extractIdBody("draft-456", "draft")).toBe("456");
		});

		test("handles hierarchical IDs", () => {
			expect(extractIdBody("task-5.2.1", "task")).toBe("5.2.1");
		});

		test("returns original if no prefix match", () => {
			expect(extractIdBody("123", "task")).toBe("123");
			expect(extractIdBody("draft-123", "task")).toBe("draft-123");
		});

		test("is case-insensitive for prefix", () => {
			expect(extractIdBody("TASK-123", "task")).toBe("123");
			expect(extractIdBody("Task-123", "task")).toBe("123");
		});

		test("works with custom prefixes", () => {
			expect(extractIdBody("JIRA-789", "JIRA")).toBe("789");
			expect(extractIdBody("issue-42", "issue")).toBe("42");
		});
	});

	describe("extractIdNumbers", () => {
		test("extracts single number", () => {
			expect(extractIdNumbers("task-123", "task")).toEqual([123]);
		});

		test("extracts hierarchical numbers", () => {
			expect(extractIdNumbers("task-5.2.1", "task")).toEqual([5, 2, 1]);
			expect(extractIdNumbers("task-10.20.30", "task")).toEqual([10, 20, 30]);
		});

		test("handles non-numeric body", () => {
			expect(extractIdNumbers("task-abc", "task")).toEqual([0]);
		});

		test("handles mixed numeric/non-numeric", () => {
			// Each segment is parsed independently
			expect(extractIdNumbers("task-5.abc.3", "task")).toEqual([5, 0, 3]);
		});

		test("works with custom prefixes", () => {
			expect(extractIdNumbers("JIRA-456", "JIRA")).toEqual([456]);
		});
	});

	describe("buildGlobPattern", () => {
		test("builds correct glob pattern", () => {
			expect(buildGlobPattern("task")).toBe("task-*.md");
			expect(buildGlobPattern("draft")).toBe("draft-*.md");
			expect(buildGlobPattern("JIRA")).toBe("JIRA-*.md");
		});
	});

	describe("buildIdRegex", () => {
		test("matches simple IDs", () => {
			const regex = buildIdRegex("task");
			expect("task-123".match(regex)).toBeTruthy();
			expect("task-123".match(regex)?.[1]).toBe("123");
		});

		test("matches hierarchical IDs", () => {
			const regex = buildIdRegex("task");
			expect("task-5.2.1".match(regex)?.[1]).toBe("5.2.1");
		});

		test("is case-insensitive", () => {
			const regex = buildIdRegex("task");
			expect("TASK-123".match(regex)).toBeTruthy();
			expect("Task-456".match(regex)).toBeTruthy();
		});

		test("does not match wrong prefix", () => {
			const regex = buildIdRegex("task");
			expect("draft-123".match(regex)).toBeFalsy();
		});

		test("works with custom prefixes", () => {
			const regex = buildIdRegex("JIRA");
			expect("JIRA-789".match(regex)?.[1]).toBe("789");
			expect("jira-789".match(regex)?.[1]).toBe("789");
		});

		test("only matches at start of string", () => {
			const regex = buildIdRegex("task");
			expect("prefix-task-123".match(regex)).toBeFalsy();
		});
	});

	describe("buildFilenameIdRegex", () => {
		test("extracts ID from filename", () => {
			const regex = buildFilenameIdRegex("task");
			const match = "task-123 - Some Title.md".match(regex);
			expect(match?.[1]).toBe("123");
		});

		test("handles hierarchical IDs in filenames", () => {
			const regex = buildFilenameIdRegex("task");
			const match = "task-5.2 - Subtask Title.md".match(regex);
			expect(match?.[1]).toBe("5.2");
		});
	});

	describe("hasPrefix", () => {
		test("returns true for matching prefix", () => {
			expect(hasPrefix("task-123", "task")).toBe(true);
			expect(hasPrefix("draft-456", "draft")).toBe(true);
		});

		test("is case-insensitive", () => {
			expect(hasPrefix("TASK-123", "task")).toBe(true);
			expect(hasPrefix("Task-456", "task")).toBe(true);
		});

		test("returns false for non-matching prefix", () => {
			expect(hasPrefix("draft-123", "task")).toBe(false);
			expect(hasPrefix("123", "task")).toBe(false);
		});

		test("trims whitespace", () => {
			expect(hasPrefix("  task-123  ", "task")).toBe(true);
		});
	});

	describe("idsEqual", () => {
		test("returns true for identical IDs", () => {
			expect(idsEqual("task-123", "task-123", "task")).toBe(true);
		});

		test("is case-insensitive for prefix", () => {
			expect(idsEqual("task-123", "TASK-123", "task")).toBe(true);
			expect(idsEqual("TASK-123", "task-123", "task")).toBe(true);
		});

		test("returns false for different IDs", () => {
			expect(idsEqual("task-123", "task-456", "task")).toBe(false);
		});

		test("handles IDs without prefix", () => {
			expect(idsEqual("123", "task-123", "task")).toBe(true);
		});
	});

	describe("generateNextId", () => {
		test("generates next ID in sequence", () => {
			expect(generateNextId(["task-1", "task-2", "task-3"], "task")).toBe("task-4");
		});

		test("handles gaps in sequence", () => {
			expect(generateNextId(["task-1", "task-5", "task-10"], "task")).toBe("task-11");
		});

		test("returns task-1 for empty list", () => {
			expect(generateNextId([], "task")).toBe("task-1");
		});

		test("ignores subtasks when finding max", () => {
			expect(generateNextId(["task-1", "task-1.1", "task-1.2", "task-2"], "task")).toBe("task-3");
		});

		test("handles zero padding", () => {
			expect(generateNextId(["task-001", "task-002"], "task", 3)).toBe("task-003");
		});

		test("works with custom prefixes", () => {
			expect(generateNextId(["JIRA-100", "JIRA-101"], "JIRA")).toBe("JIRA-102");
		});

		test("ignores IDs with wrong prefix", () => {
			expect(generateNextId(["task-5", "draft-10", "task-3"], "task")).toBe("task-6");
		});
	});

	describe("generateNextSubtaskId", () => {
		test("generates next subtask ID", () => {
			expect(generateNextSubtaskId(["task-5", "task-5.1", "task-5.2"], "task-5", "task")).toBe("task-5.3");
		});

		test("returns .1 for first subtask", () => {
			expect(generateNextSubtaskId(["task-5"], "task-5", "task")).toBe("task-5.1");
		});

		test("handles gaps in subtask sequence", () => {
			expect(generateNextSubtaskId(["task-5", "task-5.1", "task-5.5"], "task-5", "task")).toBe("task-5.6");
		});

		test("handles zero padding", () => {
			expect(generateNextSubtaskId(["task-5", "task-5.01"], "task-5", "task", 2)).toBe("task-5.02");
		});

		test("works with custom prefixes", () => {
			expect(generateNextSubtaskId(["JIRA-100", "JIRA-100.1"], "JIRA-100", "JIRA")).toBe("JIRA-100.2");
		});

		test("handles unnormalized parent ID", () => {
			expect(generateNextSubtaskId(["task-5", "task-5.1"], "5", "task")).toBe("task-5.2");
		});
	});
});
