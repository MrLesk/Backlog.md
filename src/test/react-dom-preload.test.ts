import { describe, expect, it } from "bun:test";
import { initializeReactDomForTests } from "./react-dom-preload.ts";

const DOM_GLOBALS = ["window", "document", "navigator"] as const;

describe("React DOM test preload", () => {
	it("restores Bun's pre-existing navigator descriptor and value exactly", async () => {
		const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
		const sentinelNavigator = { userAgent: "sentinel-navigator" } as Navigator;
		const sentinelDescriptor: PropertyDescriptor = {
			value: sentinelNavigator,
			writable: false,
			enumerable: false,
			configurable: true,
		};
		Object.defineProperty(globalThis, "navigator", sentinelDescriptor);

		try {
			await initializeReactDomForTests(async () => {
				expect(globalThis.navigator).not.toBe(sentinelNavigator);
			});

			expect(Object.getOwnPropertyDescriptor(globalThis, "navigator")).toEqual(sentinelDescriptor);
			expect(globalThis.navigator).toBe(sentinelNavigator);
		} finally {
			if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
			else Reflect.deleteProperty(globalThis, "navigator");
		}
	});

	it("restores every global and closes JSDOM when the loader rejects", async () => {
		const descriptors = new Map(
			DOM_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const),
		);
		const loadError = new Error("React DOM import failed");
		let temporaryWindow: Window | undefined;

		await expect(
			initializeReactDomForTests(async () => {
				temporaryWindow = globalThis.window;
				throw loadError;
			}),
		).rejects.toBe(loadError);

		for (const name of DOM_GLOBALS) {
			expect(Object.getOwnPropertyDescriptor(globalThis, name)).toEqual(descriptors.get(name));
		}
		expect(temporaryWindow?.document).toBeUndefined();
	});
});
