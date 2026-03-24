// Type definitions for Mermaid API
interface MermaidAPI {
	initialize: (config: MermaidConfig) => void;
	run?: (options?: MermaidRunOptions) => Promise<void>;
	render: (id: string, text: string) => Promise<MermaidRenderResult>;
}

interface MermaidConfig {
	startOnLoad?: boolean;
	securityLevel?: "strict" | "loose" | "antiscript" | "sandbox";
	theme?: "base" | "default" | "dark" | "forest" | "neutral" | "null";
	logLevel?: number;
	[key: string]: unknown;
}

interface MermaidRunOptions {
	nodes?: HTMLElement[];
	querySelector?: string;
	suppressErrors?: boolean;
}

interface MermaidRenderResult {
	svg: string;
	bindFunctions?: (element: HTMLElement) => void;
}

interface MermaidModule {
	default: MermaidAPI;
}

type MermaidGlobal = typeof globalThis & {
	__MERMAID_MOCK__?: MermaidModule;
};

let mermaidModule: MermaidModule | null = null;
let initializationPromise: Promise<void> | null = null;

export async function ensureMermaid(): Promise<MermaidModule> {
	const mock = (globalThis as MermaidGlobal).__MERMAID_MOCK__;
	if (mock) {
		// Reset cached initialization so each mock can configure itself.
		initializationPromise = null;
		return mock;
	}

	if (mermaidModule) return mermaidModule;

	// Dynamic import so client bundles can tree-shake and server doesn't need it
	mermaidModule = (await import("mermaid")) as unknown as MermaidModule;
	return mermaidModule;
}

async function initializeMermaid(mermaid: MermaidAPI): Promise<void> {
	if (initializationPromise) {
		return initializationPromise;
	}

	initializationPromise = (async () => {
		// Initialize with secure settings
		// Use 'strict' for production to prevent XSS attacks
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: "strict",
			theme: "default",
		});
	})();

	return initializationPromise;
}

export async function renderMermaidIn(element: HTMLElement): Promise<void> {
	// Check for mermaid blocks before touching the heavy library so plain markdown stays fast.
	const codeBlocks = Array.from(element.querySelectorAll("pre > code.language-mermaid")) as HTMLElement[];
	if (codeBlocks.length === 0) {
		return;
	}

	try {
		const m = await ensureMermaid();
		await initializeMermaid(m.default);

		// Find mermaid code blocks and render each into a generated div
		for (const codeEl of codeBlocks) {
			const parent = codeEl.parentElement as HTMLElement;
			if (!parent) continue;
			const diagramText = codeEl.textContent || "";

			// Create container for mermaid
			const wrapper = document.createElement("div");
			wrapper.className = "mermaid";
			wrapper.textContent = diagramText;

			// Replace the code block's parent (pre) with our wrapper so it's in the DOM
			parent.replaceWith(wrapper);

			// Ensure wrapper is attached to document before rendering
			if (!document.body.contains(wrapper)) {
				// try to append to the element as a last resort
				element.appendChild(wrapper);
			}

			try {
				if (m?.default?.run) {
					try {
						await m.default.run({ nodes: [wrapper] });
						continue;
					} catch {
						// Continue to render fallback if run fails
					}
				}

				if (m?.default?.render) {
					const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
					try {
						const result = await m.default.render(id, diagramText);
						wrapper.innerHTML = result.svg;

						// Bind interactive functions if available (for click events, etc.)
						if (result.bindFunctions) {
							result.bindFunctions(wrapper);
						}
						continue;
					} catch {
						// Continue to next fallback if render fails
					}
				}

				// If none of the above worked, log warning
				console.warn("mermaid: no compatible render method found, leaving raw code block");
			} catch (err) {
				console.warn("mermaid render failed", err);
			}
		}
	} catch (err) {
		console.warn("Failed to load mermaid", err);
	}
}
