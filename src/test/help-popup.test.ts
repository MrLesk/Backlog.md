import { describe, expect, it } from "bun:test";
import { getHelpPopupHeight, getHelpShortcuts, openHelpPopup } from "../ui/components/help-popup.ts";
import { createScreen } from "../ui/tui.ts";

type TestWidget = {
	atop?: number;
	childBase?: number;
	children?: unknown[];
	content?: string;
	emit?: (event: string, ...args: unknown[]) => void;
	getScrollHeight?: () => number;
	height?: number;
	options?: { label?: string };
	type?: string;
};

function collectWidgets(root: { children?: unknown[] }): TestWidget[] {
	const widgets: TestWidget[] = [];
	const visit = (node: TestWidget) => {
		widgets.push(node);
		for (const child of node.children ?? []) visit(child as TestWidget);
	};
	visit(root as TestWidget);
	return widgets;
}

function pressKey(widget: TestWidget | undefined, name: string, ch = ""): void {
	const key = { name, full: name, shift: false };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

async function settleHelpPopup(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

const keysFor = (context: "board" | "task-list") => getHelpShortcuts(context).map((shortcut) => shortcut.key);

describe("help popup shortcuts", () => {
	it("keeps board-specific shortcuts in the board help menu", () => {
		const keys = keysFor("board");

		expect(keys).toContain("F");
		expect(keys).toContain("T");
		expect(keys).toContain("Space/M");
		expect(keys).toContain("N");
		expect(keys).toContain("←→");
	});

	it("uses task-list shortcuts in the task viewer help menu", () => {
		const keys = keysFor("task-list");

		expect(keys).toContain("S");
		expect(keys).toContain("T");
		expect(keys).toContain("L");
		expect(keys).not.toContain("F");
		expect(keys).not.toContain("M");
	});

	it("shows every shortcut row when the terminal has room, and stays on-screen when it does not", () => {
		for (const context of ["board", "task-list"] as const) {
			const count = getHelpShortcuts(context).length;
			// 4 rows of chrome (borders, top spacer, help line) leave one row per shortcut.
			expect(getHelpPopupHeight(count, 40) - 4).toBe(count);
			expect(getHelpPopupHeight(count, 24) - 4).toBe(count);
			for (const screenHeight of [4, 6, 10, 14, 18, 24, 30]) {
				expect(getHelpPopupHeight(count, screenHeight)).toBeLessThanOrEqual(screenHeight);
			}
		}
	});

	it("reflows an open popup and recomputes its scroll bounds after terminal resizes", async () => {
		const screen = createScreen({ smartCSR: false });
		const mutableScreen = screen as unknown as {
			focused?: TestWidget;
			width: number;
			height: number;
			emit(event: string): void;
		};
		Object.defineProperty(screen, "width", { configurable: true, value: 80, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 24, writable: true });
		try {
			const result = openHelpPopup(screen);
			await settleHelpPopup();

			mutableScreen.height = 10;
			mutableScreen.emit("resize");
			let widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			const popup = widgets.find((widget) => widget.options?.label === " Keyboard Shortcuts ");
			const help = widgets.find((widget) => widget.content?.includes("Close Help"));
			const viewport = widgets.find((widget) => widget.type === "scrollable-box");
			expect(popup).toBeDefined();
			expect(popup?.height).toBeLessThanOrEqual(10);
			expect(popup?.atop).toBeGreaterThanOrEqual(0);
			expect((popup?.atop ?? 0) + (popup?.height ?? 0)).toBeLessThanOrEqual(10);
			expect(help?.atop).toBeGreaterThanOrEqual(0);
			expect(help?.atop).toBeLessThan(10);

			const shortMaxOffset = (viewport?.getScrollHeight?.() ?? 0) - (viewport?.height ?? 0);
			expect(shortMaxOffset).toBeGreaterThan(0);
			for (let index = 0; index <= shortMaxOffset; index += 1) pressKey(mutableScreen.focused, "down");
			expect(viewport?.childBase).toBe(shortMaxOffset);

			mutableScreen.height = 24;
			mutableScreen.emit("resize");
			widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			const expandedViewport = widgets.find((widget) => widget.type === "scrollable-box");
			expect(expandedViewport?.childBase).toBe(0);

			pressKey(mutableScreen.focused, "escape", "\x1b");
			await result;
		} finally {
			screen.destroy();
		}
	});

	it("scrolls through wrapped board shortcuts to the final rendered line at 30x24", async () => {
		const screen = createScreen({ smartCSR: false });
		const eventScreen = screen as unknown as { focused?: TestWidget };
		Object.defineProperty(screen, "width", { configurable: true, value: 30, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 24, writable: true });
		try {
			const result = openHelpPopup(screen, "board");
			await settleHelpPopup();
			const widgets = collectWidgets(screen as unknown as { children?: unknown[] });
			const viewport = widgets.find((widget) => widget.type === "scrollable-box");
			const renderedLineCount = viewport?.getScrollHeight?.() ?? 0;
			const visibleLineCount = viewport?.height ?? 0;
			const maxOffset = renderedLineCount - visibleLineCount;

			expect(renderedLineCount).toBeGreaterThan(getHelpShortcuts("board").length);
			expect(maxOffset).toBeGreaterThan(0);
			expect(widgets.some((widget) => widget.content?.includes("Scroll"))).toBe(true);
			for (let index = 0; index <= maxOffset; index += 1) pressKey(eventScreen.focused, "down");
			expect(viewport?.childBase).toBe(maxOffset);

			pressKey(eventScreen.focused, "escape", "\x1b");
			await result;
		} finally {
			screen.destroy();
		}
	});
});
