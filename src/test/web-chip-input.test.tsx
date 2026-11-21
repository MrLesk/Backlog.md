import { afterEach, describe, expect, it, mock } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import ChipInput from "../web/components/ChipInput";

let dom: JSDOM;
let root: Root | undefined;
const originalGlobals = {
	window: globalThis.window,
	document: globalThis.document,
	navigator: globalThis.navigator,
};

const suggestions = ["Bug", "Feature", "UI"];
const onChange = mock((_values: string[]) => {});

const mount = async (value: string[] = []) => {
	dom = new JSDOM("<html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document;
	globalThis.navigator = dom.window.navigator;
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	root = createRoot(document.getElementById("root") as HTMLElement);
	await act(async () => {
		root?.render(
			<ChipInput
				name="labels"
				label="Labels"
				value={value}
				onChange={onChange}
				placeholder="Type label and press Enter or comma"
				suggestions={suggestions}
			/>,
		);
	});
	return document.getElementById("chip-input-labels") as HTMLInputElement;
};

const type = async (input: HTMLInputElement, text: string) => {
	const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")?.set;
	await act(async () => {
		setter?.call(input, text);
		input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
	});
};

const press = async (input: HTMLInputElement, key: string) => {
	await act(async () => {
		input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
	});
};

const option = (label: string) =>
	Array.from(document.querySelectorAll('[role="option"]')).find((item) => item.textContent?.trim() === label);

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	dom?.window.close();
	Object.assign(globalThis, originalGlobals);
	mock.restore();
	onChange.mockClear();
});

describe("ChipInput label suggestions", () => {
	it("suggests configured labels case-insensitively and inserts the exact casing on Enter", async () => {
		const input = await mount();
		await type(input, "bug");
		expect(option("Bug")).toBeDefined();
		await press(input, "Enter");
		expect(onChange).toHaveBeenCalledWith(["Bug"]);
	});

	it("moves the highlighted suggestion with the arrow keys", async () => {
		const input = await mount();
		await type(input, "u");
		expect(option("Bug")).toBeDefined();
		expect(option("UI")).toBeDefined();
		await press(input, "ArrowDown");
		await press(input, "ArrowDown");
		await press(input, "Enter");
		expect(onChange).toHaveBeenCalledWith(["UI"]);
	});

	it("inserts a clicked suggestion", async () => {
		const input = await mount();
		await type(input, "fea");
		const target = option("Feature")?.querySelector("button");
		expect(target).toBeDefined();
		await act(async () => target?.click());
		expect(onChange).toHaveBeenCalledWith(["Feature"]);
	});

	it("does not suggest a label that is already selected", async () => {
		const input = await mount(["Bug"]);
		await type(input, "bug");
		expect(option("Bug")).toBeUndefined();
	});

	it("refuses duplicate free-text labels with different casing", async () => {
		const input = await mount(["Bug"]);
		await type(input, "bug");
		await press(input, "Enter");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("still accepts a genuinely new label as free text", async () => {
		const input = await mount();
		await type(input, "urgent");
		expect(option("Bug")).toBeUndefined();
		await press(input, "Enter");
		expect(onChange).toHaveBeenCalledWith(["urgent"]);
	});
});
