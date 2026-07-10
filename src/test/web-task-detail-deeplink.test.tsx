import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { SearchResult, Task } from "../types/index.ts";
import { resolveTaskById } from "../utils/task-id.ts";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";

const tasks: Task[] = [
	{
		id: "BACK-101",
		title: "Fix labels / café & docs?",
		status: "To Do",
		assignee: [],
		labels: ["web"],
		dependencies: [],
		createdDate: "2026-07-10",
	},
	{
		id: "BACK-001.02",
		title: "Padded subtask",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-07-10",
	},
	{
		id: "BACK-7",
		title: "Backlog task",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-07-10",
	},
	{
		id: "JIRA-007",
		title: "Jira task",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-07-10",
	},
];

const searchResults: SearchResult[] = tasks.map((task) => ({ type: "task", task, score: 1 }));

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;
const originalResizeObserver = globalThis.ResizeObserver;
const originalEvent = globalThis.Event;
const originalCustomEvent = globalThis.CustomEvent;
const originalElement = globalThis.Element;
const originalHTMLElement = globalThis.HTMLElement;
const originalNode = globalThis.Node;
let beforeTaskResponse: ((id: string) => Promise<void>) | null = null;

class FakeWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 3;
	readyState = FakeWebSocket.OPEN;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;

	close() {
		this.readyState = FakeWebSocket.CLOSED;
	}
}

class FakeResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

const installFetchMock = () => {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const value = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		const url = new URL(value, window.location.origin);

		if (url.pathname === "/api/status") {
			return json({ initialized: true, projectPath: "/tmp/project" });
		}
		if (url.pathname === "/api/statuses") {
			return json(["To Do", "In Progress", "Done"]);
		}
		if (url.pathname === "/api/config") {
			return json({
				projectName: "Route QA",
				statuses: ["To Do", "In Progress", "Done"],
				labels: ["web"],
				milestones: [],
				dateFormat: "YYYY-MM-DD",
				remoteOperations: false,
				prefixes: { task: "BACK" },
				zeroPaddedIds: 3,
			});
		}
		if (url.pathname === "/api/search") {
			return json(searchResults);
		}
		if (url.pathname === "/api/milestones" || url.pathname === "/api/milestones/archived") {
			return json([]);
		}
		if (url.pathname === "/api/tasks/duplicates") {
			return json([]);
		}
		if (url.pathname === "/api/version") {
			return json({ version: "test" });
		}
		if (url.pathname.startsWith("/api/task/")) {
			const routeId = decodeURIComponent(url.pathname.slice("/api/task/".length));
			await beforeTaskResponse?.(routeId);
			const resolution = resolveTaskById(tasks, routeId);
			if (resolution.status === "found") {
				return json(resolution.task);
			}
			if (resolution.status === "invalid") {
				return json({ error: `Invalid task ID: ${routeId}` }, 400);
			}
			return json({ error: `Task ${routeId} not found` }, resolution.status === "ambiguous" ? 409 : 404);
		}

		return json([]);
	}) as typeof fetch;
};

const setupDom = (path: string) => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
		pretendToBeVisual: true,
	});
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document;
	globalThis.navigator = activeDom.window.navigator;
	globalThis.localStorage = activeDom.window.localStorage;
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
	globalThis.Event = activeDom.window.Event;
	globalThis.CustomEvent = activeDom.window.CustomEvent;
	globalThis.Element = activeDom.window.Element;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.Node = activeDom.window.Node;
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

	window.matchMedia = () =>
		({
			matches: false,
			media: "",
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList;
	window.scrollTo = () => {};
	window.confirm = () => true;

	const elementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	elementPrototype.attachEvent ??= () => {};
	elementPrototype.detachEvent ??= () => {};
	installFetchMock();
};

const waitFor = async (predicate: () => boolean, message: string) => {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
		});
	}
	throw new Error(`Timed out waiting for ${message}`);
};

const renderApp = async (path: string): Promise<HTMLElement> => {
	setupDom(path);
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	await act(async () => {
		activeRoot?.render(
			<StrictMode>
				<HealthCheckProvider>
					<App />
				</HealthCheckProvider>
			</StrictMode>,
		);
		await Promise.resolve();
	});
	return container as HTMLElement;
};

const click = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const press = async (element: Element, key: string) => {
	await act(async () => {
		(element as HTMLElement).focus();
		element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
		await Promise.resolve();
	});
};

const travel = async (direction: "back" | "forward") => {
	await act(async () => {
		window.history[direction]();
		await new Promise((resolve) => setTimeout(resolve, 10));
	});
};

afterEach(async () => {
	if (activeRoot) {
		await act(async () => activeRoot?.unmount());
		activeRoot = null;
	}
	activeDom?.window.close();
	activeDom = null;
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
	globalThis.ResizeObserver = originalResizeObserver;
	globalThis.Event = originalEvent;
	globalThis.CustomEvent = originalCustomEvent;
	globalThis.Element = originalElement;
	globalThis.HTMLElement = originalHTMLElement;
	globalThis.Node = originalNode;
	beforeTaskResponse = null;
});

describe("task detail routes", () => {
	it("uses the canonical board route for task clicks and browser Back", async () => {
		const container = await renderApp("/");
		await waitFor(() => container.textContent?.includes(tasks[0]?.title ?? "") ?? false, "board task");
		expect(window.location.pathname).toBe("/board");
		const boardLink = Array.from(container.querySelectorAll("a")).find(
			(element) => element.textContent?.includes("Kanban Board"),
		);
		expect(boardLink?.getAttribute("aria-current")).toBe("page");

		const title = Array.from(container.querySelectorAll("h4")).find((element) => element.textContent === tasks[0]?.title);
		const card = title?.closest("[draggable='true']");
		expect(card).toBeTruthy();
		await click(card as HTMLElement);

		await waitFor(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"canonical board task route",
		);

		await travel("back");
		await waitFor(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"Back to the canonical board",
		);
	});

	it("keeps legacy highlight links while canonicalizing and closing them cleanly", async () => {
		const container = await renderApp("/?highlight=BACK-101&lane=none");
		await waitFor(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"legacy highlight route",
		);
		expect(window.location.search).toBe("?lane=none");

		const closeButton = container.querySelector("button[aria-label='Close modal']");
		expect(closeButton).toBeTruthy();
		await click(closeButton as HTMLButtonElement);
		await waitFor(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"legacy highlight close",
		);
		expect(window.location.search).toBe("?lane=none");
	});

	it("pushes a stable list URL and keeps close, Back, and Forward coherent", async () => {
		const container = await renderApp("/tasks?status=To%20Do");
		await waitFor(() => container.textContent?.includes(tasks[0]?.title ?? "") ?? false, "task list");

		const title = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === tasks[0]?.title,
		);
		expect(title).toBeTruthy();
		(title as HTMLButtonElement).focus();
		await click(title as HTMLButtonElement);

		await waitFor(
			() => {
				const dialog = container.querySelector("[role='dialog']");
				return (
					window.location.pathname === "/tasks/BACK-101/fix-labels-caf-docs" &&
					dialog !== null &&
					document.activeElement === dialog
				);
			},
			"stable task route and modal",
		);
		expect(window.location.search).toBe("?status=To%20Do");

		await travel("back");
		await waitFor(
			() => window.location.pathname === "/tasks" && container.querySelector("[role='dialog']") === null,
			"Back to close the modal",
		);

		await travel("forward");
		await waitFor(
			() => {
				const dialog = container.querySelector("[role='dialog']");
				return (
					window.location.pathname === "/tasks/BACK-101/fix-labels-caf-docs" &&
					dialog !== null &&
					document.activeElement === dialog
				);
			},
			"Forward to reopen the modal",
		);

		await press(container.querySelector("[role='dialog']") as HTMLElement, "Escape");
		await waitFor(
			() => window.location.pathname === "/tasks" && container.querySelector("[role='dialog']") === null,
			"close button to return to list",
		);
	});

	it("keeps an explicit task prefix when equal numeric IDs would be ambiguous", async () => {
		const container = await renderApp("/tasks");
		await waitFor(() => container.textContent?.includes("Jira task") ?? false, "cross-prefix task list");

		const title = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === "Jira task",
		);
		expect(title).toBeTruthy();
		await click(title as HTMLButtonElement);

		await waitFor(
			() =>
				window.location.pathname === "/tasks/JIRA-007/jira-task" &&
				container.querySelector("#modal-title")?.textContent?.includes("Jira task") === true,
			"unambiguous cross-prefix task route",
		);
		expect(container.querySelector("[role='alert']")).toBeNull();
	});

	it("archives a routed task with a single history close", async () => {
		const container = await renderApp("/milestones");
		const allTasksLink = Array.from(container.querySelectorAll("a")).find(
			(element) => element.textContent?.includes("All Tasks"),
		);
		expect(allTasksLink).toBeTruthy();
		await click(allTasksLink as HTMLAnchorElement);
		await waitFor(
			() => window.location.pathname === "/tasks" && container.textContent?.includes(tasks[0]?.title ?? "") === true,
			"task list navigation",
		);

		const title = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === tasks[0]?.title,
		);
		expect(title).toBeTruthy();
		await click(title as HTMLButtonElement);
		await waitFor(
			() =>
				window.location.pathname.startsWith("/tasks/BACK-101/") &&
				Boolean(container.querySelector("[role='dialog']")),
			"routed task modal",
		);

		const archiveButton = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent?.includes("Archive Task"),
		);
		expect(archiveButton).toBeTruthy();
		await click(archiveButton as HTMLButtonElement);
		await waitFor(
			() => window.location.pathname === "/tasks" && container.querySelector("[role='dialog']") === null,
			"single archive close",
		);
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
		expect(window.location.pathname).toBe("/tasks");
	});

	it("ignores a stale route response when a newer task wins the navigation race", async () => {
		let releaseFirstResponse = () => {};
		const firstResponse = new Promise<void>((resolve) => {
			releaseFirstResponse = resolve;
		});
		beforeTaskResponse = (id) => (id === "BACK-101" ? firstResponse : Promise.resolve());

		const container = await renderApp("/tasks");
		await waitFor(() => container.textContent?.includes(tasks[0]?.title ?? "") ?? false, "task list");

		const firstTitle = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === tasks[0]?.title,
		);
		await click(firstTitle as HTMLButtonElement);
		await waitFor(() => window.location.pathname.startsWith("/tasks/BACK-101/"), "first pending route");

		const secondTitle = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === tasks[1]?.title,
		);
		await click(secondTitle as HTMLButtonElement);
		await waitFor(
			() =>
				window.location.pathname === "/tasks/BACK-001.02/padded-subtask" &&
				container.querySelector("#modal-title")?.textContent?.includes("Padded subtask") === true,
			"newer task modal",
		);

		releaseFirstResponse();
		await act(async () => {
			await Promise.resolve();
		});
		expect(window.location.pathname).toBe("/tasks/BACK-001.02/padded-subtask");
		expect(container.querySelector("#modal-title")?.textContent).toContain("Padded subtask");

		const closeButton = container.querySelector("button[aria-label='Close modal']");
		await click(closeButton as HTMLButtonElement);
		await waitFor(() => window.location.pathname === "/tasks", "race winner close");
	});

	it("opens a padded custom-prefix subtask directly and closes to the board", async () => {
		const container = await renderApp("/board/001.02/cosmetic-slug");
		await waitFor(() => Boolean(container.querySelector("[role='dialog']")), "direct board modal");
		expect(container.querySelector("#modal-title")?.textContent).toContain("Padded subtask");

		const closeButton = container.querySelector("button[aria-label='Close modal']");
		expect(closeButton).toBeTruthy();
		await click(closeButton as HTMLButtonElement);
		await waitFor(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"direct route close",
		);
	});

	it("returns an invalid route to the list with a focused human-readable error", async () => {
		const container = await renderApp("/tasks/not-valid");
		await waitFor(
			() => window.location.pathname === "/tasks" && Boolean(container.querySelector("[role='alert']")),
			"invalid route fallback",
		);

		const alert = container.querySelector("[role='alert']");
		expect(alert?.textContent).toContain('"not-valid" is not a valid task ID.');
		expect(document.activeElement).toBe(alert);
		expect(container.querySelector("[role='dialog']")).toBeNull();
	});

	it("handles malformed deeper paths at the client SPA boundary", async () => {
		const container = await renderApp("/board/101/cosmetic/extra?lane=none");
		await waitFor(
			() => window.location.pathname === "/board" && Boolean(container.querySelector("[role='alert']")),
			"malformed route fallback",
		);
		expect(window.location.search).toBe("?lane=none");
		expect(container.querySelector("[role='alert']")?.textContent).toContain("That task link is not valid.");
		expect(container.querySelector("[role='dialog']")).toBeNull();
	});
});
