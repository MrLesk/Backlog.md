import { describe, expect, it } from "bun:test";
import { resolveSearchHorizontalNavigation } from "../ui/components/filter-header.ts";

describe("resolveSearchHorizontalNavigation", () => {
	it("cycles immediately when search is empty", () => {
		expect(resolveSearchHorizontalNavigation(0, 0, "left")).toBe("cycle-prev");
		expect(resolveSearchHorizontalNavigation(0, 0, "right")).toBe("cycle-next");
	});

	it("cycles prev only when cursor is at the start boundary", () => {
		expect(resolveSearchHorizontalNavigation(6, -6, "left")).toBe("cycle-prev");
		expect(resolveSearchHorizontalNavigation(6, -5, "left")).toBe("stay");
	});

	it("cycles next only when cursor is at the end boundary", () => {
		expect(resolveSearchHorizontalNavigation(6, 0, "right")).toBe("cycle-next");
		expect(resolveSearchHorizontalNavigation(6, -1, "right")).toBe("stay");
	});
});
