import { describe, expect, it } from "bun:test";
import {
	type PendingSearchWrap,
	resolveFilterExitPane,
	resolveListBoundaryNavigation,
	resolveSearchExitTargetIndex,
	resolveTaskListSelection,
	shouldMoveFromDetailBoundaryToSearch,
} from "../ui/task-viewer-with-search.ts";

describe("task viewer boundary navigation", () => {
	it("moves from first list row to search on arrow up", () => {
		expect(resolveListBoundaryNavigation("up", 0, 4, "arrow")).toBe("search");
		expect(resolveListBoundaryNavigation("up", 1, 4, "arrow")).toBe("move");
	});

	it("moves from last list row to search on arrow down", () => {
		expect(resolveListBoundaryNavigation("down", 3, 4, "arrow")).toBe("search");
		expect(resolveListBoundaryNavigation("down", 2, 4, "arrow")).toBe("move");
	});

	it("keeps vim keys inside the list at both boundaries", () => {
		expect(resolveListBoundaryNavigation("up", 0, 4, "vim")).toBe("stay");
		expect(resolveListBoundaryNavigation("down", 3, 4, "vim")).toBe("stay");
	});

	it("moves vim keys like arrows away from the boundaries", () => {
		expect(resolveListBoundaryNavigation("up", 1, 4, "vim")).toBe("move");
		expect(resolveListBoundaryNavigation("down", 2, 4, "vim")).toBe("move");
	});

	it("treats an empty list as a boundary for both key families", () => {
		expect(resolveListBoundaryNavigation("up", 0, 0, "arrow")).toBe("search");
		expect(resolveListBoundaryNavigation("down", 0, 0, "arrow")).toBe("search");
		expect(resolveListBoundaryNavigation("up", 0, 0, "vim")).toBe("stay");
		expect(resolveListBoundaryNavigation("down", 0, 0, "vim")).toBe("stay");
	});

	it("moves from detail pane to search only on arrow up at the top boundary", () => {
		expect(shouldMoveFromDetailBoundaryToSearch(0, "arrow")).toBe(true);
		expect(shouldMoveFromDetailBoundaryToSearch(2, "arrow")).toBe(false);
		expect(shouldMoveFromDetailBoundaryToSearch(0, "vim")).toBe(false);
	});

	it("resolves search exit target to last row after top-boundary handoff", () => {
		const pending: PendingSearchWrap = "to-last";
		expect(resolveSearchExitTargetIndex("up", pending, 5, 2)).toBe(4);
	});

	it("resolves search exit target to first row after bottom-boundary handoff", () => {
		const pending: PendingSearchWrap = "to-first";
		expect(resolveSearchExitTargetIndex("down", pending, 5, 2)).toBe(0);
	});

	it("preserves current selection when no boundary wrap is pending", () => {
		expect(resolveSearchExitTargetIndex("down", null, 5, 2)).toBe(2);
		expect(resolveSearchExitTargetIndex("escape", null, 5, 3)).toBe(3);
	});

	it("restores filter exit to preferred pane when available", () => {
		expect(resolveFilterExitPane("detail", true, true)).toBe("detail");
		expect(resolveFilterExitPane("list", true, true)).toBe("list");
	});

	it("falls back filter exit to an available pane", () => {
		expect(resolveFilterExitPane("detail", true, false)).toBe("list");
		expect(resolveFilterExitPane("list", false, true)).toBe("detail");
		expect(resolveFilterExitPane("list", false, false)).toBeNull();
	});

	it("resolves the selected task from a list index", () => {
		const tasks = [{ id: "TASK-1" }, { id: "TASK-2" }];
		expect(resolveTaskListSelection(tasks, 1)?.id).toBe("TASK-2");
		expect(resolveTaskListSelection(tasks, [0])?.id).toBe("TASK-1");
	});

	it("falls back when the selected list index is unavailable", () => {
		const fallback = { id: "TASK-1" };
		expect(resolveTaskListSelection([], undefined, fallback)).toBe(fallback);
		expect(resolveTaskListSelection([], 0, fallback)).toBe(fallback);
		expect(resolveTaskListSelection([{ id: "TASK-2" }], -1, fallback)).toBe(fallback);
	});
});
