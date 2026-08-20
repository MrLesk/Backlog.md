import type { JSDOM } from "jsdom";

/**
 * Copies the globals a rendered component expects from a JSDOM window onto
 * globalThis.
 *
 * Each web test builds its own JSDOM and used to hand-pick the handful of
 * globals it needed. That works until a component reaches for one nobody
 * listed. Lexical, which the task editor is built on, calls
 * `new MutationObserver(...)` at the moment it attaches to a root element, and
 * with no global for it every test that renders the task modal died with
 * "MutationObserver is not defined" from inside node_modules.
 *
 * Rather than let the list drift per file, everything a DOM component is
 * likely to touch is installed here in one place.
 */
export function installDomGlobals(dom: JSDOM): void {
	const win = dom.window as unknown as Window & typeof globalThis & Record<string, unknown>;
	const target = globalThis as unknown as Record<string, unknown>;

	const names = [
		"MutationObserver",
		"ResizeObserver",
		"IntersectionObserver",
		"Node",
		"Text",
		"Element",
		"HTMLElement",
		"HTMLInputElement",
		"HTMLTextAreaElement",
		"HTMLAnchorElement",
		"Range",
		"Selection",
		"DOMRect",
		"Event",
		"CustomEvent",
		"MouseEvent",
		"KeyboardEvent",
		"InputEvent",
		"CompositionEvent",
		"ClipboardEvent",
		"DragEvent",
		"FocusEvent",
		"DataTransfer",
		"getComputedStyle",
	];

	for (const name of names) {
		const value = win[name];
		if (value === undefined) continue;
		target[name] = typeof value === "function" && name === "getComputedStyle" ? value.bind(win) : value;
	}

	// Lexical reads the caret through the document's own selection.
	if (typeof win.getSelection === "function") {
		target.getSelection = win.getSelection.bind(win);
	}

	// jsdom has no layout, so anything measuring an element gets zeroes rather
	// than a crash.
	if (win.Element && !win.Element.prototype.getBoundingClientRect) {
		win.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
			return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) } as DOMRect;
		};
	}
}
