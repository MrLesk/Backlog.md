import { describe, expect, it } from "bun:test";
import {
	type PendingSearchWrap,
	resolveSearchExitTargetIndex,
	shouldMoveFromListBoundaryToSearch,
} from "../ui/task-viewer-with-search.ts";

describe("task viewer boundary navigation", () => {
	it("moves from first list row to search on up", () => {
		expect(shouldMoveFromListBoundaryToSearch("up", 0, 4)).toBe(true);
		expect(shouldMoveFromListBoundaryToSearch("up", 1, 4)).toBe(false);
	});

	it("moves from last list row to search on down", () => {
		expect(shouldMoveFromListBoundaryToSearch("down", 3, 4)).toBe(true);
		expect(shouldMoveFromListBoundaryToSearch("down", 2, 4)).toBe(false);
	});

	it("does not move to search when there are no rows", () => {
		expect(shouldMoveFromListBoundaryToSearch("up", 0, 0)).toBe(false);
		expect(shouldMoveFromListBoundaryToSearch("down", 0, 0)).toBe(false);
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
});
