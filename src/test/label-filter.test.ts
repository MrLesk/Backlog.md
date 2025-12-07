import { describe, expect, test } from "bun:test";
import type { Task } from "../types/index.ts";
import { collectAvailableLabels, formatLabelSummary, labelsToLower } from "../utils/label-filter.ts";

describe("label filter utilities", () => {
	test("collectAvailableLabels merges configured labels and task labels without duplicates", () => {
		const tasks: Task[] = [
			{
				id: "task-1",
				title: "One",
				status: "To Do",
				labels: ["bug", "UI"],
				assignee: [],
				createdDate: "2025-01-01",
				dependencies: [],
			},
			{
				id: "task-2",
				title: "Two",
				status: "To Do",
				labels: ["infra", "bug"],
				assignee: [],
				createdDate: "2025-01-01",
				dependencies: [],
			},
		];
		const configured = ["backend", "bug"];

		const labels = collectAvailableLabels(tasks, configured);

		expect(labels).toEqual(["backend", "bug", "UI", "infra"]);
	});

	test("formatLabelSummary produces concise summaries", () => {
		expect(formatLabelSummary([])).toBe("Labels: All");
		expect(formatLabelSummary(["bug"])).toBe("Labels: bug");
		expect(formatLabelSummary(["bug", "ui"])).toBe("Labels: bug, ui");
		expect(formatLabelSummary(["bug", "ui", "infra"])).toBe("Labels: bug, ui +1");
	});

	test("labelsToLower normalizes labels for filtering", () => {
		expect(labelsToLower([" Bug ", "UI"])).toEqual(["bug", "ui"]);
	});
});
