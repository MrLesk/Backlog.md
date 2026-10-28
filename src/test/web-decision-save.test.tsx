import { afterEach, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Decision } from "../types/index.ts";
import DecisionDetail from "../web/components/DecisionDetail.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { setNativeInputValue } from "./react-dom-input.ts";

const originalFetch = globalThis.fetch;
const globals = ["window", "document", "navigator", "localStorage", "Element", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT"];
const originalGlobals = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let root: Root | undefined;
let dom: JSDOM | undefined;
afterEach(() => {
	act(() => root?.unmount());
	dom?.window.close();
	globalThis.fetch = originalFetch;
	for (const [name, descriptor] of originalGlobals) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

it("shows marked decisions and saves only changed section fields as JSON", async () => {
	dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.Element = dom.window.Element;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.HTMLInputElement = dom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
	globalThis.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
	window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;
	const prototype = dom.window.HTMLElement.prototype as unknown as { attachEvent: () => void; detachEvent: () => void };
	prototype.attachEvent = () => {};
	prototype.detachEvent = () => {};
	const record: Decision = {
		id: "decision-1", title: "Database", date: "2026-01-01", status: "accepted",
		context: "Old context", decision: "Keep this choice", consequences: "",
		rawContent: "## Context\n\n<!-- SECTION:CONTEXT:BEGIN -->\nOld context\n<!-- SECTION:CONTEXT:END -->\n\n## Revisit trigger\nReview next year.\n\n## Decision\n\n<!-- SECTION:DECISION:BEGIN -->\nKeep this choice\n<!-- SECTION:DECISION:END -->\n",
	};
	const writes: RequestInit[] = [];
	globalThis.fetch = (async (_input, init) => {
		if (init?.method === "PUT") {
			writes.push(init);
			return Response.json({ success: true });
		}
		return Response.json(record);
	}) as typeof fetch;
	const container = document.getElementById("root")!;
	root = createRoot(container);
	await act(async () => {
		root?.render(<ThemeProvider><MemoryRouter initialEntries={["/decisions/1/database?edit=true"]}><Routes>
			<Route path="/decisions/:id/:title" element={<DecisionDetail decisions={[]} onRefreshData={async () => {}} />} />
		</Routes></MemoryRouter></ThemeProvider>);
	});
	async function click(label: string) {
		const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent?.trim() === label);
		expect(button).toBeDefined();
		await act(async () => { button?.click(); });
	}
	const textarea = container.querySelector("textarea");
	expect(textarea).not.toBeNull();
	await act(async () => {
		setNativeInputValue(textarea!, record.rawContent.replace("Old context", "New context"));
	});
	await click("Save");
	expect(container.textContent).toContain("New context");
	expect(container.textContent).toContain("Review next year.");
	expect(container.textContent).not.toContain("SECTION:");
	expect(writes).toHaveLength(1);
	expect(new Headers(writes[0]?.headers).get("Content-Type")).toBe("application/json");
	expect(JSON.parse(String(writes[0]?.body))).toEqual({ context: "New context" });
});
