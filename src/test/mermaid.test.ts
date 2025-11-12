import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { JSDOM } from "jsdom";
import { renderMermaidIn } from "../web/utils/mermaid";

let dom: JSDOM;

function createContainerWithMermaid(code = "graph TD\nA --> B") {
	const container = dom.window.document.createElement("div");
	const pre = dom.window.document.createElement("pre");
	const codeEl = dom.window.document.createElement("code");
	codeEl.className = "language-mermaid";
	codeEl.textContent = code;
	pre.appendChild(codeEl);
	container.appendChild(pre);
	dom.window.document.body.appendChild(container);
	return { container, codeEl };
}

describe("renderMermaidIn", () => {
	beforeEach(async () => {
		const { JSDOM } = await import("jsdom");
		dom = new JSDOM("<!doctype html><html><body></body></html>");
		// attach globals
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment setup
		globalThis.window = dom.window as any;
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment setup
		globalThis.document = dom.window.document as any;
		// remove any mock if present
		// biome-ignore lint/suspicious/noExplicitAny: Mock cleanup
		delete (globalThis as any).__MERMAID_MOCK__;
	});

	afterEach(() => {
		// cleanup
		// biome-ignore lint/suspicious/noExplicitAny: Mock cleanup
		delete (globalThis as any).__MERMAID_MOCK__;
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment cleanup
		delete (globalThis as any).window;
		// biome-ignore lint/suspicious/noExplicitAny: Testing environment cleanup
		delete (globalThis as any).document;
		dom.window.close();
	});

	it("uses run API when available", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: Mock needed for testing
		(globalThis as any).__MERMAID_MOCK__ = {
			default: {
				// biome-ignore lint/suspicious/noExplicitAny: Mock signature flexibility
				run: async ({ nodes }: any) => {
					const el = nodes?.[0] || dom.window.document.querySelector(".mermaid");
					if (el) {
						el.innerHTML = "<svg><text>mock-run</text></svg>";
					}
				},
				initialize: () => {},
			},
		};

		const { container } = createContainerWithMermaid();
		await renderMermaidIn(container as HTMLElement);

		const mermaidDiv = container.querySelector(".mermaid");
		expect(mermaidDiv).toBeTruthy();
		expect(mermaidDiv?.innerHTML).toContain("mock-run");
	});

	it("falls back to render API when run is not available", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: Mock needed for testing
		(globalThis as any).__MERMAID_MOCK__ = {
			default: {
				render: async (_id: string, _txt: string) => ({
					svg: "<svg>rendered</svg>",
				}),
				initialize: () => {},
			},
		};

		const { container } = createContainerWithMermaid();
		await renderMermaidIn(container as HTMLElement);

		const mermaidDiv = container.querySelector(".mermaid");
		expect(mermaidDiv).toBeTruthy();
		expect(mermaidDiv?.innerHTML).toContain("rendered");
	});

	it("does not throw when mermaid is missing", async () => {
		const { container } = createContainerWithMermaid();
		await expect(renderMermaidIn(container as HTMLElement)).resolves.toBeUndefined();
		const mermaidDiv = container.querySelector(".mermaid");
		expect(mermaidDiv).toBeTruthy();
	});
});
