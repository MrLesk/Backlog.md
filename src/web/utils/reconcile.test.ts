import { describe, expect, it } from "bun:test";
import { deepEqual, reconcileById } from "./reconcile.ts";

describe("deepEqual", () => {
	it("ignores key order and undefined-valued keys", () => {
		expect(deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
		expect(deepEqual({ a: 1, milestone: undefined }, { a: 1 })).toBe(true);
		expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
		expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
		expect(deepEqual({ a: { b: null } }, { a: { b: null } })).toBe(true);
	});
});

describe("reconcileById", () => {
	const record = (id: string, value: number) => ({ id, value });

	it("keeps the current array when nothing changed", () => {
		const current = [record("a", 1), record("b", 2)];
		expect(reconcileById(current, [record("a", 1), record("b", 2)])).toBe(current);
	});

	it("keeps unchanged records by identity when one record changes", () => {
		const current = [record("a", 1), record("b", 2)];
		const next = reconcileById(current, [record("a", 1), record("b", 3)]);
		expect(next).not.toBe(current);
		expect(next[0]).toBe(current[0] as { id: string; value: number });
		expect(next[1]).toEqual(record("b", 3));
	});

	it("treats reorders, additions, and removals as changes", () => {
		const current = [record("a", 1), record("b", 2)];
		const reordered = reconcileById(current, [record("b", 2), record("a", 1)]);
		expect(reordered).not.toBe(current);
		expect(reordered[0]).toBe(current[1] as { id: string; value: number });
		expect(reconcileById(current, [record("a", 1)])).toEqual([record("a", 1)]);
		expect(reconcileById(current, [record("a", 1), record("b", 2), record("c", 3)])).toHaveLength(3);
	});
});
