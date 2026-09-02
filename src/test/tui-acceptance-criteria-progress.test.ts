import { describe, expect, it } from "bun:test";
import blessed from "neo-neo-bblessed";
import type { AcceptanceCriterion, Task } from "../types/index.ts";
import { formatAcceptanceCriteriaProgressColumn } from "../ui/acceptance-criteria-progress.ts";
import { formatTaskListItem } from "../ui/board.ts";
import { formatTaskViewerListItem } from "../ui/task-viewer-with-search.ts";
import { stripBlessedFgTags } from "../ui/utils/strip-tags.ts";

const unicode = (blessed as unknown as { unicode: { strWidth(s: string): number } }).unicode;

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

const column = (total: number, checked: number) =>
	formatAcceptanceCriteriaProgressColumn(makeTask({ acceptanceCriteriaItems: makeCriteria(total, checked) }));

/** What the terminal actually shows once blessed has consumed every tag. */
const rendered = (row: string) => row.replace(/\{\/?[\w\-,;!#]*\}/g, "");
const idColumn = (row: string) => rendered(row).indexOf("BACK-");

describe("TUI acceptance-criteria progress", () => {
	it("renders one pie glyph and the live count from checklist state", () => {
		const task = makeTask();

		expect(formatAcceptanceCriteriaProgressColumn(task)).toBe("{yellow-fg}◑{/} 4/7   ");
		if (task.acceptanceCriteriaItems?.[4]) task.acceptanceCriteriaItems[4].checked = true;
		expect(formatAcceptanceCriteriaProgressColumn(task)).toBe("{yellow-fg}◕{/} 5/7   ");
	});

	it("fills the pie as the checklist fills", () => {
		const glyph = (total: number, checked: number) => stripBlessedFgTags(column(total, checked)).trim().split(" ")[0];

		expect(glyph(9, 0)).toBe("○");
		expect(glyph(9, 1)).toBe("◔");
		// The thirds are inclusive boundaries: 3/9 is still a quarter pie, 6/9 still a half.
		expect(glyph(9, 3)).toBe("◔");
		expect(glyph(9, 4)).toBe("◑");
		expect(glyph(9, 6)).toBe("◑");
		expect(glyph(9, 7)).toBe("◕");
		expect(glyph(9, 9)).toBe("●");
	});

	it("reserves the empty and full pies for the exact counts", () => {
		// One checked criterion out of twenty must not read as untouched, and nineteen must
		// not read as finished.
		expect(stripBlessedFgTags(column(20, 1))).toBe("◔ 1/20  ");
		expect(stripBlessedFgTags(column(20, 19))).toBe("◕ 19/20 ");
	});

	it("colors the glyph by completion ratio using the TUI's red/yellow/green semantics", () => {
		expect(column(4, 0)).toBe("{red-fg}○{/} 0/4   ");
		expect(column(3, 1)).toBe("{red-fg}◔{/} 1/3   ");
		expect(column(7, 4)).toBe("{yellow-fg}◑{/} 4/7   ");
		expect(column(5, 4)).toBe("{yellow-fg}◕{/} 4/5   ");
		expect(column(2, 2)).toBe("{green-fg}●{/} 2/2   ");
	});

	it("blanks the column instead of dropping it when a row has no progress to show", () => {
		const blank = " ".repeat(8);

		expect(formatAcceptanceCriteriaProgressColumn(makeTask({ acceptanceCriteriaItems: [] }))).toBe(blank);
		expect(formatAcceptanceCriteriaProgressColumn(makeTask({ status: "To Do" }))).toBe(blank);
		expect(formatAcceptanceCriteriaProgressColumn(makeTask({ status: "Done" }))).toBe(blank);
	});

	it("lines task ids up on the board whether or not a row shows progress", () => {
		const withProgress = formatTaskListItem(makeTask());
		const noCriteria = formatTaskListItem(makeTask({ id: "BACK-552", acceptanceCriteriaItems: [] }));
		const otherStatus = formatTaskListItem(makeTask({ id: "BACK-553", status: "To Do" }));
		const twoDigitCounts = formatTaskListItem(
			makeTask({ id: "BACK-554", acceptanceCriteriaItems: makeCriteria(13, 10) }),
		);

		expect(rendered(withProgress)).toBe("◑ 4/7   BACK-551 - Show progress");
		expect(rendered(noCriteria)).toBe("        BACK-552 - Show progress");
		expect(idColumn(withProgress)).toBe(idColumn(noCriteria));
		expect(idColumn(withProgress)).toBe(idColumn(otherStatus));
		expect(idColumn(withProgress)).toBe(idColumn(twoDigitCounts));
	});

	it("lines task ids up in the task list behind a single-cell status icon", () => {
		const withProgress = formatTaskViewerListItem(makeTask());
		const done = formatTaskViewerListItem(makeTask({ id: "BACK-552", status: "Done" }));

		expect(rendered(withProgress)).toBe("◒ ◑ 4/7   BACK-551 - Show progress");
		expect(rendered(done)).toBe("✔         BACK-552 - Show progress");
		expect(idColumn(withProgress)).toBe(idColumn(done));
	});

	it("keeps the moving marker and cross-branch dimming outside the reserved column", () => {
		const moving = formatTaskListItem(makeTask(), true);
		const crossBranch = formatTaskListItem(makeTask({ branch: "feature/x" } as Partial<Task>));

		// The column precedes the row tags, so its own {/} cannot close the highlight or the
		// dim, and the column itself never moves.
		expect(moving).toBe("{yellow-fg}◑{/} 4/7   {magenta-fg}► {bold}BACK-551{/bold} - Show progress{/}");
		expect(crossBranch.startsWith("{yellow-fg}◑{/} 4/7   {gray-fg}")).toBe(true);
		expect(formatTaskViewerListItem(makeTask({ branch: "feature/x" } as Partial<Task>))).toContain(
			"◑{/} 4/7   {gray-fg}",
		);
	});

	it("measures every pie as one cell in the patched blessed width table", () => {
		// Geometric Shapes, the block the TUI already renders (see status-icon.ts). Block
		// Elements would blank out on fonts without them and blessed cannot ACS-route them.
		for (const glyph of ["○", "◔", "◑", "◕", "●"]) {
			expect(unicode.strWidth(glyph)).toBe(1);
		}
		for (const [total, checked] of [
			[4, 0],
			[7, 4],
			[13, 10],
			[3, 3],
		] as const) {
			const cells = stripBlessedFgTags(column(total, checked));
			expect(unicode.strWidth(cells)).toBe(cells.length);
			expect(cells).toMatch(/^[○◔◑◕●] \d+\/\d+ *$/);
		}
	});

	it("keeps fully checked work visibly In Progress without color-dependent meaning", () => {
		const task = makeTask({ acceptanceCriteriaItems: makeCriteria(2, 2) });
		const progress = formatAcceptanceCriteriaProgressColumn(task);
		const listItem = rendered(formatTaskViewerListItem(task));

		expect(stripBlessedFgTags(progress)).toBe("● 2/2   ");
		expect(progress).not.toContain("AC");
		expect(progress).not.toContain("%");
		expect(task.status).toBe("In Progress");
		expect(listItem).toContain("◒ ● 2/2");
		expect(listItem).not.toContain("✔");
	});

	it("normalizes configured status casing before choosing the active-work icon", () => {
		const listItem = rendered(formatTaskViewerListItem(makeTask({ status: " IN PROGRESS " })));

		expect(listItem).toContain("◑ 4/7   BACK-551");
	});

	it("reuses the same indicator in board cards and task-list summaries", () => {
		const task = makeTask();

		expect(formatTaskListItem(task)).toContain("{yellow-fg}◑{/} 4/7   {bold}BACK-551{/bold}");
		expect(formatTaskViewerListItem(task)).toContain("{yellow-fg}◑{/} 4/7   {bold}BACK-551{/bold}");
	});
});
