import { describe, expect, it } from "bun:test";
import { resolveVimMotionIndex } from "../ui/task-viewer-with-search.ts";

describe("resolveVimMotionIndex", () => {
	const visibleHeight = 10; // half-page = 5

	it("top always returns the first index", () => {
		expect(resolveVimMotionIndex("top", 7, 20, visibleHeight)).toBe(0);
		expect(resolveVimMotionIndex("top", 0, 20, visibleHeight)).toBe(0);
	});

	it("bottom always returns the last index", () => {
		expect(resolveVimMotionIndex("bottom", 0, 20, visibleHeight)).toBe(19);
		expect(resolveVimMotionIndex("bottom", 19, 20, visibleHeight)).toBe(19);
	});

	it("halfPageDown advances by half the visible height and clamps at the end", () => {
		expect(resolveVimMotionIndex("halfPageDown", 0, 20, visibleHeight)).toBe(5);
		expect(resolveVimMotionIndex("halfPageDown", 17, 20, visibleHeight)).toBe(19);
		expect(resolveVimMotionIndex("halfPageDown", 19, 20, visibleHeight)).toBe(19);
	});

	it("halfPageUp retreats by half the visible height and clamps at the start", () => {
		expect(resolveVimMotionIndex("halfPageUp", 19, 20, visibleHeight)).toBe(14);
		expect(resolveVimMotionIndex("halfPageUp", 3, 20, visibleHeight)).toBe(0);
		expect(resolveVimMotionIndex("halfPageUp", 0, 20, visibleHeight)).toBe(0);
	});

	it("returns 0 for an empty list regardless of motion", () => {
		expect(resolveVimMotionIndex("top", 0, 0, visibleHeight)).toBe(0);
		expect(resolveVimMotionIndex("bottom", 0, 0, visibleHeight)).toBe(0);
		expect(resolveVimMotionIndex("halfPageDown", 0, 0, visibleHeight)).toBe(0);
		expect(resolveVimMotionIndex("halfPageUp", 0, 0, visibleHeight)).toBe(0);
	});

	it("rounds the half-page size down for odd visible heights", () => {
		// floor(9 / 2) = 4
		expect(resolveVimMotionIndex("halfPageDown", 0, 20, 9)).toBe(4);
		expect(resolveVimMotionIndex("halfPageUp", 10, 20, 9)).toBe(6);
	});

	it("moves by at least one row when the visible height is tiny", () => {
		// floor(1 / 2) = 0, but the step is clamped to a minimum of 1
		expect(resolveVimMotionIndex("halfPageDown", 0, 20, 1)).toBe(1);
		expect(resolveVimMotionIndex("halfPageUp", 5, 20, 1)).toBe(4);
		expect(resolveVimMotionIndex("halfPageDown", 0, 20, 0)).toBe(1);
	});
});
