import { describe, expect, test } from "bun:test";
import type { Task } from "../types/index.ts";
import { collectAvailableLabels, formatLabelSummary, labelsToLower } from "../utils/label-filter.ts";

describe("label filter utilities", () => {
	test("collectAvailableLabels merges configured labels and task labels without duplicates sorted alphabetically", () => {
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
		const configured = ["backend", "BUG"];

		const labels = collectAvailableLabels(tasks, configured);

		expect(labels).toEqual(["backend", "BUG", "infra", "UI"]);
	});

	test("collectAvailableLabels sorts accented labels with locale-independent normalized keys", () => {
		const labels = collectAvailableLabels([], ["Zulu", "Öl", "Ärger"]);

		expect(labels).toEqual(["Ärger", "Öl", "Zulu"]);
	});

	test("collectAvailableLabels orders equivalent Unicode spellings independently of input order", () => {
		const composed = "café";
		const decomposed = "cafe\u0301";
		const expected = [decomposed, composed];

		expect(collectAvailableLabels([], [composed, decomposed])).toEqual(expected);
		expect(collectAvailableLabels([], [decomposed, composed])).toEqual(expected);
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
