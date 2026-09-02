import { describe, expect, it } from "bun:test";
import blessed from "neo-neo-bblessed";
import type { AcceptanceCriterion, Task } from "../types/index.ts";
import { formatAcceptanceCriteriaProgress } from "../ui/acceptance-criteria-progress.ts";
import { formatTaskListItem } from "../ui/board.ts";
import { createTaskRowPrefix } from "../ui/task-row-prefix.ts";
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

const withCriteria = (total: number, checked: number, overrides: Partial<Task> = {}) =>
	makeTask({ acceptanceCriteriaItems: makeCriteria(total, checked), ...overrides });

const cell = (total: number, checked: number) => formatAcceptanceCriteriaProgress(withCriteria(total, checked));

/** What the terminal actually shows once blessed has consumed every tag. */
const rendered = (row: string) => row.replace(/\{\/?[\w\-,;!#]*\}/g, "");
/** Cells before the task id, measured the way blessed lays the row out. */
const idColumn = (row: string) => unicode.strWidth(rendered(row).split("BACK-")[0] ?? "");

function renderList(tasks: Task[]): string[] {
	const formatPrefix = createTaskRowPrefix(tasks, { showStatus: true });
	return tasks.map((task) => formatTaskViewerListItem(task, undefined, undefined, formatPrefix));
}

function renderBoardColumn(tasks: Task[]): string[] {
	const formatPrefix = createTaskRowPrefix(tasks, { showStatus: false });
	return tasks.map((task) => formatTaskListItem(task, false, undefined, undefined, formatPrefix));
}

describe("TUI acceptance-criteria progress", () => {
	it("renders one pie glyph and the live count from checklist state", () => {
		const task = makeTask();

		expect(formatAcceptanceCriteriaProgress(task)).toBe("{yellow-fg}◑{/} 4/7");
		if (task.acceptanceCriteriaItems?.[4]) task.acceptanceCriteriaItems[4].checked = true;
		expect(formatAcceptanceCriteriaProgress(task)).toBe("{yellow-fg}◕{/} 5/7");
	});

	it("fills the pie as the checklist fills", () => {
		const glyph = (total: number, checked: number) => stripBlessedFgTags(cell(total, checked)).split(" ")[0];

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
		expect(stripBlessedFgTags(cell(20, 1))).toBe("◔ 1/20");
		expect(stripBlessedFgTags(cell(20, 19))).toBe("◕ 19/20");
	});

	it("colors the glyph by completion ratio using the TUI's red/yellow/green semantics", () => {
		expect(cell(4, 0)).toBe("{red-fg}○{/} 0/4");
		expect(cell(3, 1)).toBe("{red-fg}◔{/} 1/3");
		expect(cell(7, 4)).toBe("{yellow-fg}◑{/} 4/7");
		expect(cell(5, 4)).toBe("{yellow-fg}◕{/} 4/5");
		expect(cell(2, 2)).toBe("{green-fg}●{/} 2/2");
	});

	it("shows progress only for In Progress tasks that have criteria", () => {
		expect(formatAcceptanceCriteriaProgress(makeTask({ acceptanceCriteriaItems: [] }))).toBe("");
		expect(formatAcceptanceCriteriaProgress(makeTask({ status: "To Do" }))).toBe("");
		expect(formatAcceptanceCriteriaProgress(makeTask({ status: "Done" }))).toBe("");
	});

	it("lines every task id up across custom statuses, three-digit counts and rows without progress", () => {
		const rows = renderList([
			withCriteria(4, 0, { id: "BACK-1" }),
			withCriteria(100, 100, { id: "BACK-2" }),
			withCriteria(100, 10, { id: "BACK-3" }),
			makeTask({ id: "BACK-4", acceptanceCriteriaItems: [] }),
			makeTask({ id: "BACK-5", status: "Waiting" }),
			makeTask({ id: "BACK-6", status: "Ready" }),
			makeTask({ id: "BACK-7", status: "Done" }),
		]);

		expect(new Set(rows.map(idColumn)).size).toBe(1);
		expect(rendered(rows[1] ?? "")).toBe("◒ In Progress ● 100/100 BACK-2 - Show progress");
		expect(rendered(rows[3] ?? "")).toBe("◒ In Progress           BACK-4 - Show progress");
		expect(rendered(rows[5] ?? "")).toBe("○ Ready                 BACK-6 - Show progress");
	});

	it("keeps the status word so unmapped custom statuses stay distinguishable", () => {
		// getStatusStyle maps six statuses; everything else shares the default ○ and color, so
		// the word is the only thing telling Ready from Waiting.
		const rows = renderList([
			makeTask({ id: "BACK-1", status: "Ready", acceptanceCriteriaItems: [] }),
			makeTask({ id: "BACK-2", status: "Waiting", acceptanceCriteriaItems: [] }),
		]);

		expect(rendered(rows[0] ?? "")).toContain("○ Ready  ");
		expect(rendered(rows[1] ?? "")).toContain("○ Waiting");
		expect(rendered(rows[0] ?? "")).not.toBe(rendered(rows[1] ?? ""));
	});

	it("charges a render only for the columns something on it fills", () => {
		// Board columns already name the status, so a column where no row has criteria spends
		// nothing on a prefix, and single-digit counts never pay for the three-digit case.
		const queued = renderBoardColumn([
			makeTask({ id: "BACK-1", status: "To Do" }),
			makeTask({ id: "BACK-2", status: "To Do" }),
		]);
		expect(queued.map(idColumn)).toEqual([0, 0]);

		const active = renderBoardColumn([
			withCriteria(7, 4, { id: "BACK-1" }),
			makeTask({ id: "BACK-2", acceptanceCriteriaItems: [] }),
		]);
		expect(rendered(active[0] ?? "")).toBe("◑ 4/7 BACK-1 - Show progress");
		expect(rendered(active[1] ?? "")).toBe("      BACK-2 - Show progress");
		expect(new Set(active.map(idColumn)).size).toBe(1);
	});

	it("keeps the move marker and cross-branch dim outside the prefix", () => {
		const formatPrefix = createTaskRowPrefix([makeTask()], { showStatus: false });
		const moving = formatTaskListItem(makeTask(), true, undefined, undefined, formatPrefix);
		const crossBranch = formatTaskViewerListItem(makeTask({ branch: "feature/x" } as Partial<Task>));

		// blessed reads a bare {/} as a full reset, so a prefix inside these tags would cancel
		// the highlight and the dim for the rest of the row.
		expect(moving).toBe("{yellow-fg}◑{/} 4/7 {magenta-fg}► {bold}BACK-551{/bold} - Show progress{/}");
		expect(crossBranch).toContain("{yellow-fg}◑{/} 4/7 {gray-fg}{bold}BACK-551{/bold}");
	});

	it("measures every composed prefix in whole cells", () => {
		// Geometric Shapes, the block the TUI already renders (see status-icon.ts). Block
		// Elements would blank out on fonts without them and blessed cannot ACS-route them.
		for (const glyph of ["○", "◔", "◑", "◕", "●"]) {
			expect(unicode.strWidth(glyph)).toBe(1);
		}

		const rows = renderList([
			withCriteria(4, 0, { id: "BACK-1" }),
			withCriteria(100, 100, { id: "BACK-2" }),
			makeTask({ id: "BACK-3", status: "Waiting", acceptanceCriteriaItems: [] }),
		]);
		for (const row of rows) {
			const prefix = rendered(row).split("BACK-")[0] ?? "";
			// Every glyph is single-width, so the cells blessed lays out match the characters
			// the padding counted.
			expect(unicode.strWidth(prefix)).toBe(prefix.length);
			expect(prefix).toMatch(/^[○◒✔◆▣●] [\w ]+?(?: [○◔◑◕●] \d+\/\d+)? *$/);
		}
	});

	it("keeps fully checked work visibly In Progress without color-dependent meaning", () => {
		const task = withCriteria(2, 2);
		const progress = formatAcceptanceCriteriaProgress(task);
		const listItem = rendered(formatTaskViewerListItem(task));

		expect(stripBlessedFgTags(progress)).toBe("● 2/2");
		expect(progress).not.toContain("AC");
		expect(progress).not.toContain("%");
		expect(task.status).toBe("In Progress");
		expect(listItem).toContain("◒ In Progress ● 2/2");
		expect(listItem).not.toContain("✔");
	});

	it("normalizes configured status casing before choosing the active-work icon", () => {
		const listItem = rendered(formatTaskViewerListItem(makeTask({ status: " IN PROGRESS " })));

		expect(listItem).toContain("◒  IN PROGRESS  ◑ 4/7 BACK-551");
	});

	it("reuses the same indicator in board cards and task-list summaries", () => {
		const task = makeTask();

		expect(formatTaskListItem(task)).toContain("{yellow-fg}◑{/} 4/7 {bold}BACK-551{/bold}");
		expect(formatTaskViewerListItem(task)).toContain("{yellow-fg}◑{/} 4/7 {bold}BACK-551{/bold}");
	});
});
