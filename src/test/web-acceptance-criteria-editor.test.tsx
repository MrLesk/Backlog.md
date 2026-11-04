import { afterEach, beforeEach, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { AcceptanceCriterion } from "../types/index.ts";
import AcceptanceCriteriaEditor from "../web/components/AcceptanceCriteriaEditor.tsx";
import { setNativeInputValue } from "./react-dom-input.ts";

const globals = [
	"window",
	"document",
	"navigator",
	"Element",
	"HTMLElement",
	"HTMLInputElement",
	"HTMLTextAreaElement",
	"IS_REACT_ACT_ENVIRONMENT",
];
const originals = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let dom: JSDOM;
let root: Root;
let container: HTMLElement;

beforeEach(() => {
	dom = new JSDOM("<div id='root'></div>");
	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
		navigator: dom.window.navigator,
		Element: dom.window.Element,
		HTMLElement: dom.window.HTMLElement,
		HTMLInputElement: dom.window.HTMLInputElement,
		HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	const prototype = dom.window.HTMLElement.prototype as unknown as { attachEvent: () => void; detachEvent: () => void };
	prototype.attachEvent = () => {};
	prototype.detachEvent = () => {};
	container = document.getElementById("root")!;
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	dom.window.close();
	for (const [name, descriptor] of originals) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

it("keeps wrapping textareas and rejects Enter, pasted line breaks and multiline input without losing valid text", async () => {
	let saved: AcceptanceCriterion[] = [{ index: 1, text: "Keep this criterion", checked: true }];
	await act(async () => {
		root.render(
			<AcceptanceCriteriaEditor
				criteria={saved}
				onChange={(items) => {
					saved = items;
				}}
			/>,
		);
	});
	const [existing, draft] = Array.from(container.querySelectorAll("textarea"));
	expect(existing).toBeDefined();
	expect(draft).toBeDefined();
	for (const field of [existing!, draft!]) {
		const longText = "A long acceptance criterion that wraps in a narrow field. ".repeat(8).trim();
		await act(async () => {
			setNativeInputValue(field, longText);
		});
		expect(field.value).toBe(longText);
		const enter = new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
		await act(async () => {
			field.dispatchEvent(enter);
		});
		expect(enter.defaultPrevented).toBe(true);
		expect(container.querySelector('[role="alert"]')?.textContent).toContain("single line");
		expect(field.value).toBe(longText);
		const paste = new window.Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(paste, "clipboardData", { value: { getData: () => "First\nSecond" } });
		await act(async () => {
			field.dispatchEvent(paste);
		});
		expect(paste.defaultPrevented).toBe(true);
		expect(field.value).toBe(longText);
		await act(async () => {
			setNativeInputValue(field, "First\nSecond");
		});
		expect(field.value).toBe(longText);
		await act(async () => {
			setNativeInputValue(field, "Valid replacement");
		});
		expect(container.querySelector('[role="alert"]')).toBeNull();
	}
	await act(async () => {
		Array.from(container.querySelectorAll("button"))
			.find((button) => button.textContent === "Add")!
			.click();
	});
	expect(saved).toEqual([
		{ index: 1, text: "Valid replacement", checked: true },
		{ index: 2, text: "Valid replacement", checked: false },
	]);
});

it("preserves multiline input when used for Definition of Done", async () => {
	let saved: AcceptanceCriterion[] = [];
	await act(async () => {
		root.render(
			<AcceptanceCriteriaEditor
				criteria={[]}
				onChange={(items) => {
					saved = items;
				}}
				label="Definition of Done"
				singleLine={false}
			/>,
		);
	});
	const field = container.querySelector("textarea")!;
	const enter = new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
	await act(async () => {
		field.dispatchEvent(enter);
	});
	expect(enter.defaultPrevented).toBe(false);
	await act(async () => {
		setNativeInputValue(field, "First\nSecond");
	});
	await act(async () => {
		container.querySelector("button")!.click();
	});
	expect(saved).toEqual([{ index: 1, text: "First\nSecond", checked: false }]);
	expect(container.querySelector('[role="alert"]')).toBeNull();
});
