import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import type { Decision as BacklogDecision, Document as BacklogDocument } from "../types/index.ts";
import DecisionDetail from "../web/components/DecisionDetail.tsx";
import DocumentationDetail from "../web/components/DocumentationDetail.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

const AMBIGUOUS_DOCUMENT_MESSAGE = [
	"Document ID doc-1 is ambiguous; 2 files match:",
	"  - doc-1 - Alpha.md",
	"  - nested/doc-01 - Beta.md",
	"Run 'backlog doctor' to review the conflicting files.",
].join("\n");

const AMBIGUOUS_DECISION_MESSAGE = [
	"Decision ID decision-1 is ambiguous; 2 files match:",
	"  - decision-01 - Beta.md",
	"  - decision-1 - Alpha.md",
	"Run 'backlog doctor' to review the conflicting files.",
].join("\n");

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	if (!window.matchMedia) {
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	}
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

function respondWithConflict(message: string): void {
	globalThis.fetch = (async () =>
		new Response(JSON.stringify({ error: message }), {
			status: 409,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof globalThis.fetch;
}

async function renderRoute(path: string, pattern: string, element: React.ReactElement): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<ThemeProvider>
				<MemoryRouter initialEntries={[path]}>
					<Routes>
						<Route path={pattern} element={element} />
					</Routes>
				</MemoryRouter>
			</ThemeProvider>,
		);
		await Promise.resolve();
	});
	return container;
}

function NavigateButton({ to }: { to: string }): React.ReactElement {
	const navigate = useNavigate();
	return (
		<button type="button" data-testid="navigate" onClick={() => navigate(to)}>
			navigate
		</button>
	);
}

/**
 * Renders one route pattern with a sibling navigation button so a param change keeps the same
 * component instance mounted, which is how the create route is reached in the real app.
 */
async function renderReusableRoute(
	path: string,
	pattern: string,
	createPath: string,
	element: React.ReactElement,
): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<ThemeProvider>
				<MemoryRouter initialEntries={[path]}>
					<NavigateButton to={createPath} />
					<Routes>
						<Route path={pattern} element={element} />
					</Routes>
				</MemoryRouter>
			</ThemeProvider>,
		);
		await Promise.resolve();
	});
	return container;
}

async function clickNavigate(container: HTMLElement): Promise<void> {
	const button = container.querySelector('[data-testid="navigate"]') as HTMLButtonElement;
	expect(button).toBeTruthy();
	await act(async () => {
		button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
}

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	globalThis.fetch = originalFetch;
});

describe("web ambiguous ID handling", () => {
	it("shows the ambiguity instead of the cached document entry", async () => {
		respondWithConflict(AMBIGUOUS_DOCUMENT_MESSAGE);
		const cached: BacklogDocument = {
			id: "doc-1",
			title: "Cached Alpha",
			type: "other",
			createdDate: "2026-01-01 00:00",
			rawContent: "Cached body that must not be shown",
			path: "doc-1 - Alpha.md",
		};

		const container = await renderRoute(
			"/documentation/1/cached-alpha",
			"/documentation/:id/:title",
			<DocumentationDetail docs={[cached]} onRefreshData={async () => {}} />,
		);

		expect(container.textContent).toContain("This ID matches more than one file");
		expect(container.textContent).toContain("nested/doc-01 - Beta.md");
		expect(container.textContent).toContain("backlog doctor");
		expect(container.textContent).not.toContain("Cached body that must not be shown");
		expect(container.textContent).not.toContain("Cached Alpha");
	});

	it("shows the ambiguity instead of the cached decision entry", async () => {
		respondWithConflict(AMBIGUOUS_DECISION_MESSAGE);
		const cached: BacklogDecision = {
			id: "decision-1",
			title: "Cached Alpha",
			date: "2026-01-01 00:00",
			status: "proposed",
			context: "",
			decision: "",
			consequences: "",
			rawContent: "Cached body that must not be shown",
		};

		const container = await renderRoute(
			"/decisions/1/cached-alpha",
			"/decisions/:id/:title",
			<DecisionDetail decisions={[cached]} onRefreshData={async () => {}} />,
		);

		expect(container.textContent).toContain("This ID matches more than one file");
		expect(container.textContent).toContain("decision-01 - Beta.md");
		expect(container.textContent).toContain("backlog doctor");
		expect(container.textContent).not.toContain("Cached body that must not be shown");
		expect(container.textContent).not.toContain("Cached Alpha");
	});
});

describe("create route after an ambiguity error", () => {
	it("renders the document create editor instead of the stale notice", async () => {
		respondWithConflict(AMBIGUOUS_DOCUMENT_MESSAGE);
		const cached: BacklogDocument = {
			id: "doc-1",
			title: "Cached Alpha",
			type: "other",
			createdDate: "2026-01-01 00:00",
			rawContent: "Cached body",
			path: "doc-1 - Alpha.md",
		};

		const container = await renderReusableRoute(
			"/documentation/1",
			"/documentation/:id",
			"/documentation/new",
			<DocumentationDetail docs={[cached]} onRefreshData={async () => {}} />,
		);
		expect(container.textContent).toContain("This ID matches more than one file");

		await clickNavigate(container);

		expect(container.textContent).not.toContain("This ID matches more than one file");
		expect(container.querySelector('input[placeholder="Document title"]')).toBeTruthy();
	});

	it("renders the decision create editor instead of the stale notice", async () => {
		respondWithConflict(AMBIGUOUS_DECISION_MESSAGE);
		const cached: BacklogDecision = {
			id: "decision-1",
			title: "Cached Alpha",
			date: "2026-01-01 00:00",
			status: "proposed",
			context: "",
			decision: "",
			consequences: "",
			rawContent: "Cached body",
		};

		const container = await renderReusableRoute(
			"/decisions/1",
			"/decisions/:id",
			"/decisions/new",
			<DecisionDetail decisions={[cached]} onRefreshData={async () => {}} />,
		);
		expect(container.textContent).toContain("This ID matches more than one file");

		await clickNavigate(container);

		expect(container.textContent).not.toContain("This ID matches more than one file");
		expect(container.querySelector('input[placeholder="Decision title"]')).toBeTruthy();
	});
});
