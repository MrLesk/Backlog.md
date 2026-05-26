import { describe, expect, it } from "bun:test";
import type { BacklogConfig } from "../types/index.ts";
import { resolveBoardColumns } from "../utils/resolve-board-config.ts";

const base: BacklogConfig = {
	projectName: "x",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	dateFormat: "yyyy-mm-dd",
};

describe("resolveBoardColumns", () => {
	it("falls back to config.statuses when board is absent", () => {
		expect(resolveBoardColumns(base)).toEqual([{ status: "To Do" }, { status: "In Progress" }, { status: "Done" }]);
	});

	it("falls back to config.statuses when board.columns is undefined", () => {
		expect(resolveBoardColumns({ ...base, board: {} })).toEqual([
			{ status: "To Do" },
			{ status: "In Progress" },
			{ status: "Done" },
		]);
	});

	it("preserves an explicit empty board.columns as [] (hide-all intent, not a fallback trigger)", () => {
		expect(resolveBoardColumns({ ...base, board: { columns: [] } })).toEqual([]);
	});

	it("preserves [] even when all configured columns get filtered as stale", () => {
		// User had board.columns referencing statuses that no longer exist
		// in config.statuses. The resolver filters them down to []. That
		// state must NOT silently restore the full default board — the
		// user's explicit board:.columns wins even when its effective
		// content is empty.
		const config: BacklogConfig = {
			...base,
			board: { columns: [{ status: "Removed Status" }] },
		};
		expect(resolveBoardColumns(config)).toEqual([]);
	});

	it("honors user-specified order when board.columns is provided", () => {
		const config: BacklogConfig = {
			...base,
			board: { columns: [{ status: "Done" }, { status: "To Do" }] },
		};
		expect(resolveBoardColumns(config)).toEqual([{ status: "Done" }, { status: "To Do" }]);
	});

	it("filters out columns whose status is not in config.statuses", () => {
		const config: BacklogConfig = {
			...base,
			board: { columns: [{ status: "To Do" }, { status: "Stale Removed Status" }] },
		};
		expect(resolveBoardColumns(config)).toEqual([{ status: "To Do" }]);
	});

	it("deduplicates a status that appears twice (keeps the first)", () => {
		const config: BacklogConfig = {
			...base,
			board: {
				columns: [
					{ status: "To Do", color: "#aaa" },
					{ status: "To Do", color: "#bbb" },
					{ status: "Done" },
				],
			},
		};
		expect(resolveBoardColumns(config)).toEqual([{ status: "To Do", color: "#aaa" }, { status: "Done" }]);
	});

	it("preserves the color when provided and drops it when absent", () => {
		const config: BacklogConfig = {
			...base,
			board: {
				columns: [{ status: "To Do", color: "#cccccc" }, { status: "In Progress" }],
			},
		};
		expect(resolveBoardColumns(config)).toEqual([{ status: "To Do", color: "#cccccc" }, { status: "In Progress" }]);
	});

	it("ignores entries with falsy status (defensive)", () => {
		const config: BacklogConfig = {
			...base,
			board: {
				// runtime-shaped junk; resolver should silently skip
				columns: [{ status: "" }, { status: "To Do" }] as never,
			},
		};
		expect(resolveBoardColumns(config)).toEqual([{ status: "To Do" }]);
	});
});
