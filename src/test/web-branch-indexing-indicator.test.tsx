import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BranchIndexingIndicator } from "../web/components/BranchIndexingIndicator";

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const APPEAR_MS = 20;
const EXIT_MS = 20;

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

const wait = async (ms: number) => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, ms));
	});
};

const renderIndicator = (container: HTMLElement, message: string | null) => {
	if (!activeRoot) activeRoot = createRoot(container);
	const root = activeRoot;
	act(() => {
		root.render(<BranchIndexingIndicator message={message} appearDelayMs={APPEAR_MS} exitDurationMs={EXIT_MS} />);
	});
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	activeDom = null;
});

describe("BranchIndexingIndicator", () => {
	it("appears only after the indexing state persists and announces the real progress message", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 35 other local branches...");

		// Not mounted before the appear delay elapses.
		expect(container.querySelector('[role="status"]')).toBeNull();

		await wait(APPEAR_MS * 3);

		const chip = container.querySelector('[role="status"]');
		expect(chip).not.toBeNull();
		expect(chip?.textContent).toContain("Indexing branches");
		expect(chip?.getAttribute("title")).toBe("Indexing 35 other local branches...");
		expect(chip?.querySelector(".sr-only")?.textContent).toBe("Indexing 35 other local branches...");
		expect(container.querySelector(".animate-indexing-sweep")).not.toBeNull();
	});

	it("never flashes when indexing completes before the appear delay", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 2 other local branches...");
		renderIndicator(container, null);

		await wait(APPEAR_MS * 3);

		expect(container.querySelector('[role="status"]')).toBeNull();
		expect(container.querySelector(".animate-indexing-sweep")).toBeNull();
	});

	it("fades out and unmounts cleanly when indexing completes", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 35 other local branches...");
		await wait(APPEAR_MS * 3);
		expect(container.querySelector('[role="status"]')).not.toBeNull();

		renderIndicator(container, null);

		// Still mounted while the exit fade runs, already transitioning to hidden.
		const fading = container.querySelector('[role="status"]');
		expect(fading).not.toBeNull();
		expect(fading?.className).toContain("opacity-0");

		await wait(EXIT_MS * 3);

		expect(container.querySelector('[role="status"]')).toBeNull();
		expect(container.querySelector(".animate-indexing-sweep")).toBeNull();
	});

	it("stays visible when consecutive progress messages replace each other", async () => {
		const container = setupDom();
		renderIndicator(container, "Indexing 3 recent remote branches...");
		await wait(APPEAR_MS * 3);
		renderIndicator(container, "Indexing 35 other local branches...");
		await wait(5);

		const chip = container.querySelector('[role="status"]');
		expect(chip).not.toBeNull();
		expect(chip?.className).toContain("opacity-100");
		expect(chip?.getAttribute("title")).toBe("Indexing 35 other local branches...");
	});
});
