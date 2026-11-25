import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Task } from "../types/index.ts";
import DraftsList from "../web/components/DraftsList.tsx";
import TaskDetails from "../web/components/TaskDetails.tsx";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

function draft(id: string, title: string): Task {
	return {
		id,
		title,
		status: "Draft",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-08-15 10:00",
	};
}

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as typeof globalThis.document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.Element = dom.window.Element;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.HTMLInputElement = dom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => dom.window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle: number) => dom.window.clearTimeout(handle);
	window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never;
	const htmlElementPrototype = dom.window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	htmlElementPrototype.attachEvent = () => {};
	htmlElementPrototype.detachEvent = () => {};
	return dom.window.document.getElementById("root") as unknown as HTMLElement;
}

function serveJson(body: () => unknown): void {
	globalThis.fetch = (async () =>
		new Response(JSON.stringify(body()), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})) as unknown as typeof globalThis.fetch;
}

/** Serves /api/drafts from a mutable list so a reload can observe a saved edit. */
function serveDrafts(current: () => Task[]): void {
	serveJson(current);
}

function serveStatuses(): void {
	serveJson(() => ["To Do", "In Progress", "Done"]);
}

let currentLocation: { pathname: string; state: unknown } = { pathname: "", state: null };

function LocationProbe() {
	const location = useLocation();
	currentLocation = { pathname: location.pathname, state: location.state };
	return null;
}

async function renderDrafts(): Promise<HTMLElement> {
	const container = setupDom();
	activeRoot = createRoot(container);
	await act(async () => {
		activeRoot?.render(
			<MemoryRouter initialEntries={["/drafts"]}>
				<LocationProbe />
				<ThemeProvider>
					<DraftsList onNewDraft={() => {}} />
				</ThemeProvider>
			</MemoryRouter>,
		);
		await Promise.resolve();
	});
	return container;
}

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	globalThis.fetch = originalFetch;
});

describe("Web drafts list", () => {
	it("opens the clicked draft through its task route, returning to Drafts when it closes", async () => {
		serveDrafts(() => [draft("DRAFT-1", "First draft"), draft("DRAFT-2", "Second draft")]);
		const container = await renderDrafts();

		const headings = Array.from(container.querySelectorAll("h3"));
		const target = headings.find((heading) => heading.textContent === "Second draft");
		expect(target).toBeTruthy();

		await act(async () => {
			target?.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
			await Promise.resolve();
		});

		expect(currentLocation).toEqual({
			pathname: "/board/DRAFT-2/second-draft",
			state: { background: { pathname: "/drafts", search: "" } },
		});
	});

	// App.refreshData fires this event after every save, so a draft edit shows up without a reload.
	it("reloads the drafts when a drafts-updated event fires", async () => {
		let drafts = [draft("DRAFT-1", "First draft")];
		serveDrafts(() => drafts);
		const container = await renderDrafts();
		expect(container.textContent).toContain("First draft");

		drafts = [draft("DRAFT-1", "Reviewed scope")];
		await act(async () => {
			window.dispatchEvent(new window.Event("drafts-updated"));
			await Promise.resolve();
		});

		expect(container.textContent).toContain("Reviewed scope");
		expect(container.textContent).not.toContain("First draft");
	});
});

describe("Task view status field", () => {
	async function renderPage(task: Task): Promise<HTMLElement> {
		const container = setupDom();
		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<MemoryRouter initialEntries={["/"]}>
					<ThemeProvider>
						<TaskIdIndexProvider tasks={[task]}>
							<TaskDetails task={task} onClose={() => {}} />
						</TaskIdIndexProvider>
					</ThemeProvider>
				</MemoryRouter>,
			);
			await Promise.resolve();
		});
		return container;
	}

	function statusField(container: HTMLElement): { options: string[]; selected?: string; disabled?: boolean } {
		const select = container.querySelector("select[aria-label='Task status']") as HTMLSelectElement | null;
		expect(select).toBeTruthy();
		return {
			options: Array.from(select?.options ?? []).map((option) => option.value),
			selected: select?.value,
			disabled: select?.disabled,
		};
	}

	it("shows the status a draft actually has, and offers no other", async () => {
		serveStatuses();
		const container = await renderPage(draft("DRAFT-1", "Draft under review"));

		// Promotion stays on the Drafts page action, which is the only place that reports the new ID.
		expect(container.querySelector("select[aria-label='Task status']")).toBeNull();
		const statusRow = Array.from(container.querySelectorAll("dt")).find((term) => term.textContent === "Status");
		expect(statusRow?.nextElementSibling?.textContent).toBe("Draft");
	});

	it("offers only the configured statuses for a task", async () => {
		serveStatuses();
		const container = await renderPage({
			id: "TASK-1",
			title: "Ordinary task",
			status: "To Do",
			assignee: [],
			labels: [],
			dependencies: [],
			createdDate: "2026-08-15 10:00",
		});

		const { options, selected, disabled } = statusField(container);
		expect(options).toEqual(["To Do", "In Progress", "Done"]);
		expect(selected).toBe("To Do");
		expect(disabled).toBe(false);
	});
});
