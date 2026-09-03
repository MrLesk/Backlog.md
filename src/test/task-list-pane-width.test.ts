import { describe, expect, it } from "bun:test";
import { DEFAULT_TASK_LIST_PANE_WIDTH, resolveTaskListPaneWidth } from "../ui/task-viewer-with-search.ts";

describe("resolveTaskListPaneWidth", () => {
	it("defaults to 40 when unset", () => {
		expect(resolveTaskListPaneWidth(undefined)).toBe(DEFAULT_TASK_LIST_PANE_WIDTH);
		expect(DEFAULT_TASK_LIST_PANE_WIDTH).toBe(40);
	});

	it("passes through valid percentages", () => {
		expect(resolveTaskListPaneWidth(10)).toBe(10);
		expect(resolveTaskListPaneWidth(55)).toBe(55);
		expect(resolveTaskListPaneWidth(90)).toBe(90);
	});

	it("clamps out-of-range values", () => {
		expect(resolveTaskListPaneWidth(5)).toBe(10);
		expect(resolveTaskListPaneWidth(95)).toBe(90);
		expect(resolveTaskListPaneWidth(0)).toBe(10);
	});

	it("falls back to the default for non-finite values", () => {
		expect(resolveTaskListPaneWidth(Number.NaN)).toBe(DEFAULT_TASK_LIST_PANE_WIDTH);
		expect(resolveTaskListPaneWidth(Number.POSITIVE_INFINITY)).toBe(DEFAULT_TASK_LIST_PANE_WIDTH);
	});
});
