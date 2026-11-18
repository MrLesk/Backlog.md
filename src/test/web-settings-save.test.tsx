import { afterEach, expect, it, jest } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { BacklogConfig } from "../types/index.ts";
import Settings from "../web/components/Settings.tsx";

const originalFetch = globalThis.fetch;
const globals = ["window", "document", "navigator", "Element", "HTMLElement", "Event", "IS_REACT_ACT_ENVIRONMENT"];
const originalGlobals = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
let root: Root | undefined;
let dom: JSDOM | undefined;

afterEach(() => {
	jest.useRealTimers();
	act(() => root?.unmount());
	dom?.window.close();
	globalThis.fetch = originalFetch;
	for (const [name, descriptor] of originalGlobals) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

it("offers no editor command field and saves an empty checklist after its last item is removed", async () => {
	dom = new JSDOM("<div id='root'></div>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.Element = dom.window.Element;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.Event = dom.window.Event;
	const config: BacklogConfig = {
		projectName: "Settings test",
		statuses: ["To Do", "Done"],
		labels: [],
		dateFormat: "YYYY-MM-DD",
		definitionOfDone: ["Old item"],
		defaultEditor: "vim",
	};
	const writes: Record<string, unknown>[] = [];
	globalThis.fetch = (async (input, init) => {
		const path = String(input);
		if (path.endsWith("/statuses")) return Response.json(config.statuses);
		if (init?.method === "PUT") {
			const body = JSON.parse(String(init.body)) as Record<string, unknown>;
			writes.push(body);
			return Response.json({ ...config, ...body });
		}
		return Response.json(config);
	}) as typeof fetch;
	const container = document.getElementById("root")!;
	root = createRoot(container);
	await act(async () => root?.render(<Settings />));
	expect(container.querySelector("#defaultEditor")).toBeNull();
	const remove = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Remove");
	await act(async () => remove?.click());
	const save = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Save Changes");
	// A successful save starts a 3 second timer that hides its message. Fake timers let the test
	// finish that timer without waiting for it.
	jest.useFakeTimers();
	await act(async () => save?.click());
	expect(writes).toHaveLength(1);
	expect(writes[0]?.definitionOfDone).toEqual([]);
	await act(async () => jest.runAllTimers());
});
