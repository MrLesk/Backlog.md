import { describe, expect, it } from "bun:test";
import { shouldScrollDetailPaneFromShortcut } from "../ui/task-viewer-with-search.ts";

describe("task viewer detail scroll shortcut", () => {
	it("scrolls the detail pane from the task list without moving focus", () => {
		expect(shouldScrollDetailPaneFromShortcut("list", false, false, true)).toBe(true);
	});

	it("scrolls the detail pane while it is focused", () => {
		expect(shouldScrollDetailPaneFromShortcut("detail", false, false, true)).toBe(true);
	});

	it("does not scroll while the filter header is focused", () => {
		expect(shouldScrollDetailPaneFromShortcut("filters", false, false, true)).toBe(false);
	});

	it("does not scroll while a modal is open", () => {
		expect(shouldScrollDetailPaneFromShortcut("list", true, false, true)).toBe(false);
	});

	it("does not scroll while a filter popup is open", () => {
		expect(shouldScrollDetailPaneFromShortcut("list", false, true, true)).toBe(false);
	});

	it("does not scroll when there is no detail pane", () => {
		expect(shouldScrollDetailPaneFromShortcut("list", false, false, false)).toBe(false);
	});
});
