import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, type NavigateFunction, Route, Routes, useNavigate } from "react-router-dom";
import type { Decision, Document } from "../types/index.ts";
import DecisionDetail from "../web/components/DecisionDetail.tsx";
import DocumentationDetail from "../web/components/DocumentationDetail.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

type ArchiveAnswer = { status: number; body: Record<string, unknown> } | "pending";

/** The two pages with the Archive button, and the record each one shows. */
const PAGES = [
	{
		kind: "document",
		noun: "document",
		detailPath: "/documentation/1/retired-runbook",
		detailPattern: "/documentation/:id/:title",
		newPath: "/documentation/new",
		newPattern: "/documentation/:id",
		listPath: "/documentation",
		recordPath: "/api/docs/doc-1",
		archivePath: "/api/docs/doc-1/archive",
		restoreCommand: "backlog doc restore doc-1",
		record: (archived: boolean): Document => ({
			id: "doc-1",
			title: "Retired runbook",
			type: "other",
			createdDate: "2026-01-01 00:00",
			rawContent: "Runbook steps.",
			path: "doc-1 - Retired-runbook.md",
			...(archived ? { archived: true } : {}),
		}),
		otherDetailPath: "/documentation/2/current-runbook",
		otherRecordPath: "/api/docs/doc-2",
		otherRecord: (): Document => ({
			id: "doc-2",
			title: "Current runbook",
			type: "other",
			createdDate: "2026-01-01 00:00",
			rawContent: "Current steps.",
			path: "doc-2 - Current-runbook.md",
		}),
		render: (onRefreshData: () => Promise<void>) => (
			<DocumentationDetail docs={[]} onRefreshData={onRefreshData} />
		),
	},
	{
		kind: "decision",
		noun: "decision",
		detailPath: "/decisions/1/retired-runbook",
		detailPattern: "/decisions/:id/:title",
		newPath: "/decisions/new",
		newPattern: "/decisions/:id",
		listPath: "/decisions",
		recordPath: "/api/decisions/decision-1",
		archivePath: "/api/decisions/decision-1/archive",
		restoreCommand: "backlog decision restore decision-1",
		record: (archived: boolean): Decision => ({
			id: "decision-1",
			title: "Retired runbook",
			date: "2026-01-01 00:00",
			status: "accepted",
			context: "",
			decision: "",
			consequences: "",
			rawContent: "Runbook steps.",
			...(archived ? { archived: true } : {}),
		}),
		otherDetailPath: "/decisions/2/current-runbook",
		otherRecordPath: "/api/decisions/decision-2",
		otherRecord: (): Decision => ({
			id: "decision-2",
			title: "Current runbook",
			date: "2026-01-01 00:00",
			status: "accepted",
			context: "",
			decision: "",
			consequences: "",
			rawContent: "Current steps.",
		}),
		render: (onRefreshData: () => Promise<void>) => (
			<DecisionDetail decisions={[]} onRefreshData={onRefreshData} />
		),
	},
] as const;

type Page = (typeof PAGES)[number];

/** What the page asked the server, and how often the app's data was refreshed. */
interface Session {
	container: HTMLElement;
	requests: string[];
	refreshes: number;
	confirmations: string[];
	alerts: string[];
	/** Moves the router inside the app, as a link would. */
	navigate: NavigateFunction;
	resolveArchive: (answer: { status: number; body: Record<string, unknown> }) => void;
}

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	// The Markdown preview schedules its diagram pass for the next frame.
	globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
		setTimeout(() => callback(0), 0)) as unknown as typeof requestAnimationFrame;
	globalThis.cancelAnimationFrame = ((handle: number) => clearTimeout(handle)) as typeof cancelAnimationFrame;
	if (!window.matchMedia) {
		window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	}
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

async function flush(): Promise<void> {
	await act(async () => {
		for (let round = 0; round < 5; round += 1) await new Promise((resolve) => setTimeout(resolve, 0));
	});
}

/**
 * Renders a page at `path` with a list page behind it, answers the record fetch with the record and
 * the archive request with `archive`, and records the confirmation and alert texts. `confirm` is
 * the answer the confirmation gives.
 */
async function open(
	page: Page,
	options: { path?: string; pattern?: string; archived?: boolean; confirm?: boolean; archive?: ArchiveAnswer },
): Promise<Session> {
	const container = setupDom();
	const session: Session = {
		container,
		requests: [],
		refreshes: 0,
		confirmations: [],
		alerts: [],
		navigate: () => {},
		resolveArchive: () => {},
	};
	window.confirm = (message?: string) => {
		session.confirmations.push(String(message));
		return options.confirm ?? true;
	};
	window.alert = (message?: string) => {
		session.alerts.push(String(message));
	};
	const json = (status: number, body: unknown) =>
		new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input), "http://localhost");
		session.requests.push(`${init?.method ?? "GET"} ${url.pathname}`);
		if (url.pathname === page.archivePath) {
			const answer = options.archive ?? { status: 200, body: { success: true } };
			if (answer === "pending") {
				return await new Promise<Response>((resolve) => {
					session.resolveArchive = ({ status, body }) => resolve(json(status, body));
				});
			}
			return json(answer.status, answer.body);
		}
		if (url.pathname === page.recordPath) return json(200, page.record(options.archived ?? false));
		if (url.pathname === page.otherRecordPath) return json(200, page.otherRecord());
		return json(404, { error: "Not found" });
	}) as unknown as typeof globalThis.fetch;

	const onRefreshData = async () => {
		session.refreshes += 1;
	};
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<ThemeProvider>
				<MemoryRouter initialEntries={[options.path ?? page.detailPath]}>
					<NavigateHandle
						onNavigate={(navigate) => {
							session.navigate = navigate;
						}}
					/>
					<Routes>
						<Route path={options.pattern ?? page.detailPattern} element={page.render(onRefreshData)} />
						<Route path={page.listPath} element={<div data-testid="list-page">List</div>} />
					</Routes>
				</MemoryRouter>
			</ThemeProvider>,
		);
	});
	await flush();
	return session;
}

function NavigateHandle({ onNavigate }: { onNavigate: (navigate: NavigateFunction) => void }) {
	onNavigate(useNavigate());
	return null;
}

const buttonNamed = (container: HTMLElement, label: string) =>
	Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === label) as
		| HTMLButtonElement
		| undefined;

async function click(button: HTMLButtonElement | undefined): Promise<void> {
	expect(button).toBeTruthy();
	await act(async () => {
		button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
	await flush();
}

const archiveRequests = (session: Session, page: Page) =>
	session.requests.filter((request) => request === `POST ${page.archivePath}`);

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	globalThis.fetch = originalFetch;
});

describe.each([...PAGES])("the $kind page", (page) => {
	it("shows Archive in the header of a saved record in view mode, and not on the new page", async () => {
		const saved = await open(page, {});
		expect(buttonNamed(saved.container, "Archive")).toBeTruthy();
		expect(saved.container.textContent).not.toContain("Archived");

		const created = await open(page, { path: page.newPath, pattern: page.newPattern });
		expect(buttonNamed(created.container, "Archive")).toBeUndefined();
	});

	it("hides Archive while the record is being edited", async () => {
		const session = await open(page, { path: `${page.detailPath}?edit=true` });

		expect(buttonNamed(session.container, "Save")).toBeTruthy();
		expect(buttonNamed(session.container, "Archive")).toBeUndefined();
	});

	it("asks with the title, the sidebar and search, and the restore command, and sends nothing on cancel", async () => {
		const session = await open(page, { confirm: false });

		await click(buttonNamed(session.container, "Archive"));

		expect(session.confirmations).toEqual([
			`Archive "Retired runbook"? It leaves the sidebar and search. Restore it from the CLI with: ${page.restoreCommand}`,
		]);
		expect(archiveRequests(session, page)).toEqual([]);
		expect(session.refreshes).toBe(0);
		expect(session.container.querySelector('[data-testid="list-page"]')).toBeNull();
	});

	it("archives on confirm, refreshes the app's data and goes to the list page", async () => {
		const session = await open(page, {});

		await click(buttonNamed(session.container, "Archive"));

		expect(archiveRequests(session, page)).toEqual([`POST ${page.archivePath}`]);
		expect(session.refreshes).toBe(1);
		expect(session.container.querySelector('[data-testid="list-page"]')).toBeTruthy();
	});

	it("shows the server's message when the archive is refused, and stays on the record", async () => {
		const message = "Taken: the archive already has a file of that name.";
		const session = await open(page, { archive: { status: 400, body: { error: message } } });

		await click(buttonNamed(session.container, "Archive"));

		expect(session.container.querySelector('[role="alert"]')?.textContent).toBe(message);
		expect(session.refreshes).toBe(0);
		expect(session.container.querySelector('[data-testid="list-page"]')).toBeNull();
		// The button is back for a later try.
		expect(buttonNamed(session.container, "Archive")?.disabled).toBe(false);
	});

	it("clears the refusal when the page shows another record", async () => {
		const session = await open(page, { archive: { status: 400, body: { error: "Refused." } } });
		await click(buttonNamed(session.container, "Archive"));
		expect(session.container.querySelector('[role="alert"]')?.textContent).toBe("Refused.");

		await act(async () => {
			session.navigate(page.otherDetailPath);
		});
		await flush();

		expect(session.container.textContent).toContain("Current runbook");
		expect(session.container.querySelector('[role="alert"]')?.textContent).toBeUndefined();
	});

	it("says so in the sentence of the task Archive button and treats the record as archived when only the commit failed", async () => {
		const session = await open(page, {
			archive: {
				status: 500,
				body: { error: "Archived, but committing the change failed: index.lock", archiveState: "moved" },
			},
		});

		await click(buttonNamed(session.container, "Archive"));

		expect(session.alerts).toEqual([
			`The ${page.noun} was archived, but committing the change failed. Check the repository before retrying.`,
		]);
		expect(session.refreshes).toBe(1);
		expect(session.container.querySelector('[data-testid="list-page"]')).toBeTruthy();
	});

	it("starts one request at a time", async () => {
		const session = await open(page, { archive: "pending" });
		const button = buttonNamed(session.container, "Archive");

		await click(button);
		await click(button);

		expect(archiveRequests(session, page)).toHaveLength(1);
		expect(session.confirmations).toHaveLength(1);
		expect(button?.disabled).toBe(true);
		await act(async () => session.resolveArchive({ status: 200, body: { success: true } }));
		await flush();
		expect(session.container.querySelector('[data-testid="list-page"]')).toBeTruthy();
	});

	it("keeps an archived record out of edit mode when the URL asks for the editor", async () => {
		const session = await open(page, { path: `${page.detailPath}?edit=true`, archived: true });
		const expectReadOnly = () => {
			expect(session.container.textContent).toContain("Archived");
			expect(session.container.querySelector('input[type="text"]')).toBeNull();
			expect(buttonNamed(session.container, "Save")).toBeUndefined();
			expect(buttonNamed(session.container, "Cancel")).toBeUndefined();
		};
		expectReadOnly();

		// The same record, already open, asked again: no new load runs.
		await act(async () => {
			session.navigate(`${page.detailPath}?edit=true`);
		});
		await flush();
		expectReadOnly();
	});

	it("shows an archived record opened by its URL with the Archived label and neither Edit nor Archive", async () => {
		const session = await open(page, { archived: true });

		expect(session.container.textContent).toContain("Retired runbook");
		expect(session.container.textContent).toContain("Archived");
		expect(buttonNamed(session.container, "Archive")).toBeUndefined();
		expect(buttonNamed(session.container, "Edit")).toBeUndefined();
	});
});
