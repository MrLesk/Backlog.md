import { describe, expect, it } from "bun:test";
import type { AcceptanceCriterion, Task } from "../types/index.ts";
import { formatAcceptanceCriteriaProgress } from "../ui/acceptance-criteria-progress.ts";
import { formatTaskListItem } from "../ui/board.ts";
import { formatTaskViewerListItem } from "../ui/task-viewer-with-search.ts";
import { stripBlessedFgTags } from "../ui/utils/strip-tags.ts";

function makeCriteria(total: number, checked: number): AcceptanceCriterion[] {
	return Array.from({ length: total }, (_, index) => ({
		index: index + 1,
		text: `Criterion ${index + 1}`,
		checked: index < checked,
	}));
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: "BACK-551",
		title: "Show progress",
		status: "In Progress",
		assignee: [],
		createdDate: "2026-07-17",
		labels: [],
		dependencies: [],
		acceptanceCriteriaItems: makeCriteria(7, 4),
		...overrides,
	};
}

describe("TUI acceptance-criteria progress", () => {
	it("renders the exact wide and constrained bars from live checklist state", () => {
		const task = makeTask();

		expect(formatAcceptanceCriteriaProgress(task, 40)).toBe("[██████░░░░] 4/7");
		expect(formatAcceptanceCriteriaProgress(task, 39)).toBe("[███░░] 4/7");
		if (task.acceptanceCriteriaItems?.[4]) task.acceptanceCriteriaItems[4].checked = true;
		expect(formatAcceptanceCriteriaProgress(task, 40)).toBe("[███████░░░] 5/7");
	});

	it("omits progress when criteria are absent or the task is not in progress", () => {
		expect(formatAcceptanceCriteriaProgress(makeTask({ acceptanceCriteriaItems: [] }), 40)).toBe("");
		expect(formatAcceptanceCriteriaProgress(makeTask({ status: "To Do" }), 40)).toBe("");
		expect(formatAcceptanceCriteriaProgress(makeTask({ status: "Done" }), 40)).toBe("");
	});

	it("keeps fully checked work visibly In Progress without color-dependent meaning", () => {
		const task = makeTask({ acceptanceCriteriaItems: makeCriteria(2, 2) });
		const progress = formatAcceptanceCriteriaProgress(task, 40);
		const listItem = stripBlessedFgTags(formatTaskViewerListItem(task, 40));

		expect(progress).toBe("[██████████] 2/2");
		expect(progress).not.toContain("AC");
		expect(progress).not.toContain("%");
		expect(progress).not.toContain("{");
		expect(task.status).toBe("In Progress");
		expect(listItem).toContain("◒ [██████████] 2/2");
		expect(listItem).not.toContain("✔");
	});

	it("normalizes configured status casing before choosing the active-work icon", () => {
		const task = makeTask({ status: " IN PROGRESS " });
		const listItem = stripBlessedFgTags(formatTaskViewerListItem(task, 40));

		expect(listItem).toContain("◒ [██████░░░░] 4/7");
	});

	it("reuses the same responsive indicator in board cards and task-list summaries", () => {
		const task = makeTask();
		const wideBoardCard = stripBlessedFgTags(formatTaskListItem(task, false, 40));
		const compactBoardCard = stripBlessedFgTags(formatTaskListItem(task, false, 20));
		const compactListItem = stripBlessedFgTags(formatTaskViewerListItem(task, 20));

		expect(wideBoardCard).toContain("[██████░░░░] 4/7 {bold}BACK-551{/bold}");
		expect(compactBoardCard).toContain("[███░░] 4/7 {bold}BACK-551{/bold}");
		expect(compactListItem).toContain("◒ [███░░] 4/7 {bold}BACK-551{/bold}");
	});
});
