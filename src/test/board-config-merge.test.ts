import { describe, expect, it } from "bun:test";
import type { BoardColumnConfig, BoardConfig, CardConfig } from "../types/index.ts";
import { mergeBoardWithCard, mergeBoardWithColumns } from "../utils/board-config-merge.ts";

const cols: BoardColumnConfig[] = [{ status: "To Do" }, { status: "Done" }];
const card: CardConfig = { hide: ["assignee"] };

describe("mergeBoardWithColumns", () => {
	it("preserves sibling card when editing columns", () => {
		const prev: BoardConfig = { card };
		const next = mergeBoardWithColumns(prev, cols);
		expect(next).toEqual({ card, columns: cols });
	});

	it("clears columns when next columns is undefined; keeps card", () => {
		const prev: BoardConfig = { columns: cols, card };
		expect(mergeBoardWithColumns(prev, undefined)).toEqual({ card });
	});

	it("preserves empty-array columns as the explicit hide-all state", () => {
		expect(mergeBoardWithColumns({ card }, [])).toEqual({ card, columns: [] });
	});

	it("returns undefined when both columns and card end up absent", () => {
		expect(mergeBoardWithColumns(undefined, undefined)).toBeUndefined();
		expect(mergeBoardWithColumns({}, undefined)).toBeUndefined();
	});

	it("returns columns-only when prev has no card", () => {
		expect(mergeBoardWithColumns(undefined, cols)).toEqual({ columns: cols });
	});
});

describe("mergeBoardWithCard", () => {
	it("preserves sibling columns when editing card", () => {
		const prev: BoardConfig = { columns: cols };
		const next = mergeBoardWithCard(prev, card);
		expect(next).toEqual({ columns: cols, card });
	});

	it("clears card when next card is undefined; keeps columns", () => {
		const prev: BoardConfig = { columns: cols, card };
		expect(mergeBoardWithCard(prev, undefined)).toEqual({ columns: cols });
	});

	it("preserves explicit empty columns alongside card edits", () => {
		expect(mergeBoardWithCard({ columns: [] }, card)).toEqual({ columns: [], card });
	});

	it("returns undefined when both columns and card end up absent", () => {
		expect(mergeBoardWithCard(undefined, undefined)).toBeUndefined();
		expect(mergeBoardWithCard({}, undefined)).toBeUndefined();
	});

	it("returns card-only when prev has no columns", () => {
		expect(mergeBoardWithCard(undefined, card)).toEqual({ card });
	});
});
