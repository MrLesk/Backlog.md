import { JSDOM } from "jsdom";

const DOM_GLOBALS = ["window", "document", "navigator"] as const;
type DomGlobal = (typeof DOM_GLOBALS)[number];

export async function initializeReactDomForTests(loadReactDom: () => Promise<unknown>): Promise<void> {
	const descriptors = new Map<DomGlobal, PropertyDescriptor | undefined>(
		DOM_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
	);
	const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });

	try {
		Object.defineProperties(globalThis, {
			window: { value: dom.window, writable: true, enumerable: true, configurable: true },
			document: { value: dom.window.document, writable: true, enumerable: true, configurable: true },
			navigator: { value: dom.window.navigator, writable: true, enumerable: true, configurable: true },
		});
		await loadReactDom();
	} finally {
		try {
			dom.window.close();
		} finally {
			for (const name of DOM_GLOBALS) {
				const descriptor = descriptors.get(name);
				if (descriptor) Object.defineProperty(globalThis, name, descriptor);
				else Reflect.deleteProperty(globalThis, name);
			}
		}
	}
}

await initializeReactDomForTests(async () => await import("react-dom/client"));
