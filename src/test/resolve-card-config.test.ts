import { describe, expect, it } from "bun:test";
import type { BacklogConfig } from "../types/index.ts";
import { resolveCardHiddenFields } from "../utils/resolve-card-config.ts";

const base: BacklogConfig = {
	projectName: "x",
	statuses: ["To Do", "Done"],
	labels: [],
	dateFormat: "yyyy-mm-dd",
};

describe("resolveCardHiddenFields", () => {
	it("returns an empty set when board is absent", () => {
		expect(resolveCardHiddenFields(base).size).toBe(0);
	});

	it("returns an empty set when board.card is absent", () => {
		expect(resolveCardHiddenFields({ ...base, board: { columns: [] } }).size).toBe(0);
	});

	it("returns an empty set when card.hide is undefined", () => {
		expect(resolveCardHiddenFields({ ...base, board: { card: {} } }).size).toBe(0);
	});

	it("returns an empty set when card.hide is []", () => {
		expect(resolveCardHiddenFields({ ...base, board: { card: { hide: [] } } }).size).toBe(0);
	});

	it("returns the set of fields to hide", () => {
		const set = resolveCardHiddenFields({
			...base,
			board: { card: { hide: ["id", "labels"] } },
		});
		expect(set.has("id")).toBe(true);
		expect(set.has("labels")).toBe(true);
		expect(set.has("assignee")).toBe(false);
		expect(set.size).toBe(2);
	});
});
