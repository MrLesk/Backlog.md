import { describe, expect, it } from "bun:test";
import { buildBoardEditorRows } from "../utils/build-board-editor-rows.ts";

const statuses = ["To Do", "In Progress", "Done"];

describe("buildBoardEditorRows", () => {
	it("returns every status as visible when board is undefined", () => {
		expect(buildBoardEditorRows(statuses, undefined)).toEqual([
			{ status: "To Do", color: undefined, visible: true },
			{ status: "In Progress", color: undefined, visible: true },
			{ status: "Done", color: undefined, visible: true },
		]);
	});

	it("returns every status as visible when board has no columns key", () => {
		expect(buildBoardEditorRows(statuses, {})).toEqual([
			{ status: "To Do", color: undefined, visible: true },
			{ status: "In Progress", color: undefined, visible: true },
			{ status: "Done", color: undefined, visible: true },
		]);
	});

	it("ROUND-TRIPS HIDE-ALL: board.columns === [] renders every row hidden", () => {
		// This is the regression case from review-13 finding #1. Using
		// `configured.length > 0` would incorrectly mark every row visible,
		// making the saved hide-all state invisible to the user.
		expect(buildBoardEditorRows(statuses, { columns: [] })).toEqual([
			{ status: "To Do", color: undefined, visible: false },
			{ status: "In Progress", color: undefined, visible: false },
			{ status: "Done", color: undefined, visible: false },
		]);
	});

	it("visible rows come first in user-specified order, then hidden rows", () => {
		expect(
			buildBoardEditorRows(statuses, { columns: [{ status: "Done" }, { status: "To Do" }] }),
		).toEqual([
			{ status: "Done", color: undefined, visible: true },
			{ status: "To Do", color: undefined, visible: true },
			// In Progress was omitted by the user → appended as hidden.
			{ status: "In Progress", color: undefined, visible: false },
		]);
	});

	it("preserves colors on visible rows", () => {
		expect(
			buildBoardEditorRows(statuses, {
				columns: [{ status: "To Do", color: "#abc" }, { status: "Done", color: "green" }],
			}),
		).toEqual([
			{ status: "To Do", color: "#abc", visible: true },
			{ status: "Done", color: "green", visible: true },
			{ status: "In Progress", color: undefined, visible: false },
		]);
	});

	it("ignores configured columns whose status is no longer in statuses", () => {
		expect(
			buildBoardEditorRows(statuses, { columns: [{ status: "Removed" }, { status: "To Do" }] }),
		).toEqual([
			{ status: "To Do", color: undefined, visible: true },
			// Remaining statuses appended as hidden (because user explicitly
			// configured a list, even if one of its entries was stale).
			{ status: "In Progress", color: undefined, visible: false },
			{ status: "Done", color: undefined, visible: false },
		]);
	});

	it("deduplicates a status that appears twice in configured columns", () => {
		expect(
			buildBoardEditorRows(statuses, {
				columns: [{ status: "To Do" }, { status: "To Do", color: "#ignored" }, { status: "Done" }],
			}),
		).toEqual([
			{ status: "To Do", color: undefined, visible: true },
			{ status: "Done", color: undefined, visible: true },
			{ status: "In Progress", color: undefined, visible: false },
		]);
	});
});
