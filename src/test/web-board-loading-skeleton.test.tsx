import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BoardLoadingSkeleton } from "../web/components/BoardLoadingSkeleton";

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
		pretendToBeVisual: true,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document as Document;
	globalThis.navigator = activeDom.window.navigator as Navigator;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.requestAnimationFrame = activeDom.window.requestAnimationFrame.bind(activeDom.window);
	globalThis.cancelAnimationFrame = activeDom.window.cancelAnimationFrame.bind(activeDom.window);
	return activeDom.window.document.getElementById("root") as HTMLElement;
};

const renderSkeleton = (container: HTMLElement, message: string | null, columnCount?: number) => {
	if (!activeRoot) activeRoot = createRoot(container);
	const root = activeRoot;
	act(() => {
		root.render(<BoardLoadingSkeleton message={message} columnCount={columnCount} />);
	});
};

const countGhostColumns = (container: HTMLElement) =>
	container.querySelector('[aria-hidden="true"].overflow-x-auto')?.querySelectorAll(".min-w-\\[16rem\\]").length;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	activeDom = null;
});

describe("BoardLoadingSkeleton", () => {
	it("announces a compact loading status without visible copy by default", () => {
		const container = setupDom();
		renderSkeleton(container, null);

		const status = container.querySelector('[role="status"]');
		expect(status).not.toBeNull();
		expect(status?.getAttribute("aria-label")).toBe("Loading tasks");
		expect(status?.querySelector(".sr-only")?.textContent).toBe("Loading tasks");

		// The spinner is the shared ring design: circular, motion-reduce aware,
		// and never the dead `rounded-full` utility (excluded from compiled CSS).
		const ring = status?.querySelector(".animate-spin");
		expect(ring).not.toBeNull();
		expect(ring?.className).toContain("rounded-circle");
		expect(ring?.className).toContain("motion-reduce:animate-none");
		expect(container.innerHTML).not.toContain("rounded-full");
	});

	it("shows the progress message in the chip when provided", () => {
		const container = setupDom();
		renderSkeleton(container, "Indexing 3 recent remote branches...");

		const status = container.querySelector('[role="status"]');
		expect(status?.textContent).toContain("Indexing 3 recent remote branches...");
		expect(status?.querySelector(".sr-only")?.textContent).toBe("Indexing 3 recent remote branches...");
		expect(status?.querySelector(".animate-spin")).not.toBeNull();
	});

	it("renders ghost columns hidden from assistive tech that mirror the board geometry", () => {
		const container = setupDom();
		renderSkeleton(container, null);

		const ghosts = container.querySelector('[aria-hidden="true"].overflow-x-auto');
		expect(ghosts).not.toBeNull();
		expect(ghosts?.querySelectorAll(".min-w-\\[16rem\\]").length).toBe(3);
		for (const pulse of Array.from(ghosts?.querySelectorAll(".animate-pulse") ?? [])) {
			expect(pulse.className).toContain("motion-reduce:animate-none");
		}
		expect(ghosts?.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
	});

	it("matches the configured status count so the real board mounts without a column jump", () => {
		const container = setupDom();
		renderSkeleton(container, null, 5);
		expect(countGhostColumns(container)).toBe(5);

		renderSkeleton(container, null, 2);
		expect(countGhostColumns(container)).toBe(2);
	});

	it("falls back to three ghost columns before the statuses are known", () => {
		const container = setupDom();
		renderSkeleton(container, null, 0);
		expect(countGhostColumns(container)).toBe(3);
	});
});
