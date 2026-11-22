import { describe, expect, it } from "bun:test";
import { deepEqual } from "./reconcile.ts";

describe("deepEqual", () => {
	it("ignores key order and undefined-valued keys", () => {
		expect(deepEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
		expect(deepEqual({ a: 1, milestone: undefined }, { a: 1 })).toBe(true);
		expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
		expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
		expect(deepEqual({ a: { b: null } }, { a: { b: null } })).toBe(true);
	});
});
