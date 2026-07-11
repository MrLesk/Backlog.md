import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DuplicateRepairPlan } from "../core/duplicate-task-repair.ts";
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
		type: "Bug",
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
	{
		id: "TASK-PREFIXED",
		title: "Legacy prefixed task",
		status: "To Do",
		assignee: [],
		labels: [],
		dependencies: [],
		createdDate: "2026-07-10",
	},
];

const searchResults: SearchResult[] = tasks.map((task) => ({ type: "task", task, score: 1 }));

const defaultConfig = {
	projectName: "Route QA",
	statuses: ["To Do", "In Progress", "Done"],
	labels: ["web"],
	types: ["Bug", "Feature", "Customer Request"],
	milestones: [],
	dateFormat: "YYYY-MM-DD",
	remoteOperations: false,
	prefixes: { task: "BACK" },
	zeroPaddedIds: 3,
};

type ResponseFactory = () => Response | Promise<Response>;

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
let duplicatePlanResponse: (() => Promise<Response>) | null = null;

const emptyDuplicatePlan = (): DuplicateRepairPlan => ({
	groups: [],
	crossBranchFindings: [],
	changes: [],
	references: [],
	referenceScanComplete: true,
	blockedReasons: [],
	repairable: false,
	fingerprint: "empty",
});
let activeWebSocket: FakeWebSocket | null = null;
let queuedConfigResponses: ResponseFactory[] = [];
let queuedSearchResponses: ResponseFactory[] = [];

class FakeWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 3;
	static instances: FakeWebSocket[] = [];
	readyState = FakeWebSocket.OPEN;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;

	constructor() {
		FakeWebSocket.instances.push(this);
		activeWebSocket = this;
	}

	emit(data: string) {
		this.onmessage?.({ data });
	}

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
			const queuedResponse = queuedConfigResponses.shift();
			return queuedResponse ? await queuedResponse() : json(defaultConfig);
		}
		if (url.pathname === "/api/search") {
			const queuedResponse = queuedSearchResponses.shift();
			if (queuedResponse) {
				return await queuedResponse();
			}
			return json(
				url.searchParams.has("query")
					? searchResults.map((result) => ({ ...result, score: 0.1 }))
					: searchResults,
			);
		}
		if (url.pathname === "/api/milestones" || url.pathname === "/api/milestones/archived") {
			return json([]);
		}
		if (url.pathname === "/api/tasks/duplicates") {
			return duplicatePlanResponse ? await duplicatePlanResponse() : json(emptyDuplicatePlan());
		}
		if (url.pathname === "/api/version") {
			return json({ version: "test" });
		}
		if (url.pathname.startsWith("/api/task/")) {
			const routeId = decodeURIComponent(url.pathname.slice("/api/task/".length));
			await beforeTaskResponse?.(routeId);
			if (routeId === "BACK-1") {
				return json({ error: "Active branch task identity collision" }, 409);
			}
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

const setInputValue = async (input: HTMLInputElement, value: string) => {
	await act(async () => {
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
		input.focus();
		valueSetter?.call(input, value);
		input.dispatchEvent(new window.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
		input.dispatchEvent(new window.Event("change", { bubbles: true }));
		const reactPropsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
		if (reactPropsKey) {
			const reactProps = (input as unknown as Record<string, { onChange?: (event: { target: HTMLInputElement }) => void }>)[
				reactPropsKey
			];
			reactProps?.onChange?.({ target: input });
		}
		await Promise.resolve();
	});
};

const press = async (element: Element, key: string, init: KeyboardEventInit = {}) => {
	await act(async () => {
		(element as HTMLElement).focus();
		element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, ...init }));
		await Promise.resolve();
	});
};

const pushRoute = async (path: string) => {
	await act(async () => {
		window.history.pushState({}, "", path);
		window.dispatchEvent(new window.PopStateEvent("popstate"));
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
	duplicatePlanResponse = null;
	FakeWebSocket.instances = [];
	activeWebSocket = null;
	queuedConfigResponses = [];
	queuedSearchResponses = [];
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

	it("preserves a type filter through board task Back, Forward, and close navigation", async () => {
		const container = await renderApp("/board?type=bug&lane=none");
		await waitFor(
			() =>
				new URLSearchParams(window.location.search).get("type") === "Bug" &&
				(container.textContent?.includes(tasks[0]?.title ?? "") ?? false),
			"canonical filtered board",
		);
		const filteredSearch = window.location.search;

		const title = Array.from(container.querySelectorAll("h4")).find((element) => element.textContent === tasks[0]?.title);
		const card = title?.closest("[draggable='true']");
		expect(card).toBeTruthy();
		await click(card as HTMLElement);

		await waitFor(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"filtered board task route",
		);
		expect(window.location.search).toBe(filteredSearch);

		await travel("back");
		await waitFor(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"filtered board Back",
		);
		expect(window.location.search).toBe(filteredSearch);

		await travel("forward");
		await waitFor(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"filtered board Forward",
		);
		expect(window.location.search).toBe(filteredSearch);

		await click(container.querySelector("button[aria-label='Close modal']") as HTMLButtonElement);
		await waitFor(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"filtered board close",
		);
		expect(window.location.search).toBe(filteredSearch);
	});

	it("preserves a type filter when closing a direct board task route", async () => {
		const container = await renderApp("/board/BACK-101/fix-labels-caf-docs?type=Bug&lane=none");
		await waitFor(() => Boolean(container.querySelector("[role='dialog']")), "direct filtered board task");

		await click(container.querySelector("button[aria-label='Close modal']") as HTMLButtonElement);
		await waitFor(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"direct filtered board close",
		);
		expect(window.location.search).toBe("?type=Bug&lane=none");
	});

	it("keeps the latest config and tasks when overlapping refreshes resolve out of order", async () => {
		const container = await renderApp("/board?type=Customer%20Request");
		await waitFor(
			() =>
				new URLSearchParams(window.location.search).get("type") === "Customer Request" &&
				activeWebSocket?.onmessage !== null,
			"initial typed board and WebSocket",
		);

		let releaseFirstConfig: (() => void) | undefined;
		let markFirstConfigStarted: (() => void) | undefined;
		const firstConfigGate = new Promise<void>((resolve) => {
			releaseFirstConfig = resolve;
		});
		const firstConfigStarted = new Promise<void>((resolve) => {
			markFirstConfigStarted = resolve;
		});
		let markNewerSearchBodyRead: (() => void) | undefined;
		const newerSearchBodyRead = new Promise<void>((resolve) => {
			markNewerSearchBodyRead = resolve;
		});
		const customerTask: Task = {
			id: "BACK-202",
			title: "Newest customer request",
			status: "To Do",
			assignee: [],
			labels: ["web"],
			dependencies: [],
			createdDate: "2026-07-10",
			type: "Customer Request",
		};

		queuedConfigResponses.push(
			async () => {
				markFirstConfigStarted?.();
				await firstConfigGate;
				return json({ ...defaultConfig, types: ["Bug"] });
			},
			() => json(defaultConfig),
		);
		queuedSearchResponses.push(
			() => json(searchResults),
			() => {
				const response = json([{ type: "task", task: customerTask, score: 1 } satisfies SearchResult]);
				const readBody = response.json.bind(response);
				response.json = async () => {
					const body = await readBody();
					markNewerSearchBodyRead?.();
					return body;
				};
				return response;
			},
		);

		await act(async () => {
			activeWebSocket?.emit("config-updated");
			await Promise.resolve();
		});
		await firstConfigStarted;
		await act(async () => {
			activeWebSocket?.emit("tasks-updated");
			await newerSearchBodyRead;
			await Promise.resolve();
		});

		expect(container.textContent).toContain(customerTask.title);
		expect(new URLSearchParams(window.location.search).get("type")).toBe("Customer Request");

		await act(async () => {
			releaseFirstConfig?.();
			await firstConfigGate;
			await new Promise((resolve) => setTimeout(resolve, 10));
		});

		expect(container.textContent).toContain(customerTask.title);
		expect(container.textContent).not.toContain(tasks[0]?.title ?? "");
		expect(new URLSearchParams(window.location.search).get("type")).toBe("Customer Request");
		const typeSelect = container.querySelector("select[aria-label='Filter board by type']") as HTMLSelectElement;
		expect(Array.from(typeSelect.options).map((option) => option.value)).toContain("Customer Request");
	});

	it("keeps a filtered board query when a sidebar search result opens and closes", async () => {
		const container = await renderApp("/board?type=bug&lane=none");
		await waitFor(
			() =>
				new URLSearchParams(window.location.search).get("type") === "Bug" &&
				(container.textContent?.includes(tasks[0]?.title ?? "") ?? false),
			"filtered board before sidebar search",
		);
		const filteredSearch = window.location.search;
		const searchInput = container.querySelector("input[placeholder='Search (⌘K)...']") as HTMLInputElement | null;
		expect(searchInput).toBeTruthy();
		await setInputValue(searchInput as HTMLInputElement, "Fix labels");

		await waitFor(
			() =>
				Array.from(container.querySelectorAll("a")).some(
					(link) => link.textContent?.includes(tasks[0]?.title ?? "") ?? false,
				),
			"sidebar task search result",
		);
		const resultLink = Array.from(container.querySelectorAll("a")).find(
			(link) => link.textContent?.includes(tasks[0]?.title ?? "") ?? false,
		);
		expect(resultLink?.getAttribute("href")).toContain(filteredSearch);
		await click(resultLink as HTMLAnchorElement);

		await waitFor(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"sidebar filtered task route",
		);
		expect(window.location.search).toBe(filteredSearch);

		await click(container.querySelector("button[aria-label='Close modal']") as HTMLButtonElement);
		await waitFor(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"sidebar return to filtered board",
		);
		expect(window.location.search).toBe(filteredSearch);
	});

	it("keeps legacy highlight links while canonicalizing and closing them cleanly", async () => {
		const container = await renderApp("/?highlight=BACK-101&lane=none&type=bug");
		await waitFor(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"legacy highlight route",
		);
		expect(window.location.search).toBe("?lane=none&type=Bug");

		const closeButton = container.querySelector("button[aria-label='Close modal']");
		expect(closeButton).toBeTruthy();
		await click(closeButton as HTMLButtonElement);
		await waitFor(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"legacy highlight close",
		);
		expect(window.location.search).toBe("?lane=none&type=Bug");
	});

	it("pushes a stable list URL and keeps close, Back, and Forward coherent", async () => {
		const container = await renderApp("/tasks?status=To%20Do");
		await waitFor(() => container.textContent?.includes(tasks[0]?.title ?? "") ?? false, "task list");
		const ownerDocument = container.ownerDocument;

		// The expanded sidebar must not claim focus on mount.
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 125));
		});
		const initialSearch = container.querySelector("input[placeholder='Search (⌘K)...']");
		expect(ownerDocument.activeElement).not.toBe(initialSearch);

		const collapseButton = container.querySelector("button[aria-label='Collapse sidebar']");
		expect(collapseButton).toBeTruthy();
		await click(collapseButton as HTMLButtonElement);
		const collapsedSearch = container.querySelector("button[title='Search (⌘K)']");
		expect(collapsedSearch).toBeTruthy();
		await click(collapsedSearch as HTMLButtonElement);
		const expandedSearch = container.querySelector("input[placeholder='Search (⌘K)...']");
		expect(expandedSearch).toBeTruthy();
		expect(ownerDocument.activeElement).toBe(expandedSearch);

		await click(container.querySelector("button[aria-label='Collapse sidebar']") as HTMLButtonElement);
		expect(container.querySelector("button[aria-label='Expand sidebar']")).toBeTruthy();
		await press(ownerDocument.body, "k", { ctrlKey: true });
		const shortcutSearch = container.querySelector("input[placeholder='Search (⌘K)...']");
		expect(shortcutSearch).toBeTruthy();
		expect(ownerDocument.activeElement).toBe(shortcutSearch);

		const title = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === tasks[0]?.title,
		);
		expect(title).toBeTruthy();
		(title as HTMLButtonElement).focus();
		await click(title as HTMLButtonElement);

		await waitFor(
			() =>
				window.location.pathname === "/tasks/BACK-101/fix-labels-caf-docs" &&
				container.querySelector("[role='dialog']") !== null,
			"stable task route and modal",
		);
		const initialDialog = container.querySelector("[role='dialog']");
		expect(initialDialog).toBeTruthy();
		expect(initialDialog?.ownerDocument.activeElement).toBe(initialDialog);
		expect(window.location.search).toBe("?status=To%20Do");

		await press(initialDialog as HTMLElement, "k", { ctrlKey: true });
		expect(ownerDocument.activeElement).toBe(initialDialog);
		await press(shortcutSearch as HTMLInputElement, "Tab");
		expect(initialDialog?.contains(ownerDocument.activeElement)).toBe(true);
		expect(ownerDocument.activeElement).not.toBe(shortcutSearch);

		await travel("back");
		await waitFor(
			() => window.location.pathname === "/tasks" && container.querySelector("[role='dialog']") === null,
			"Back to close the modal",
		);
		expect(ownerDocument.activeElement).toBe(title as HTMLButtonElement);

		await travel("forward");
		await waitFor(
			() =>
				window.location.pathname === "/tasks/BACK-101/fix-labels-caf-docs" &&
				container.querySelector("[role='dialog']") !== null,
			"Forward to reopen the modal",
		);
		const reopenedDialog = container.querySelector("[role='dialog']");
		expect(reopenedDialog).toBeTruthy();
		expect(reopenedDialog?.ownerDocument.activeElement).toBe(reopenedDialog);

		await press(container.querySelector("[role='dialog']") as HTMLElement, "Escape");
		await waitFor(
			() => window.location.pathname === "/tasks" && container.querySelector("[role='dialog']") === null,
			"close button to return to list",
		);
		expect(ownerDocument.activeElement).toBe(title as HTMLButtonElement);
	});

	for (const scenario of [
		{
			name: "a missing task",
			path: "/tasks/BACK-999/missing",
			message: 'Task "BACK-999" was not found.',
		},
		{
			name: "an ambiguous task",
			path: "/tasks/7/ambiguous",
			message: 'Task "7" is ambiguous. Repair duplicate task IDs before opening this link.',
		},
		{
			name: "an active-branch collision",
			path: "/tasks/BACK-1/collision-shadow",
			message: 'Task "BACK-1" is ambiguous. Repair duplicate task IDs before opening this link.',
		},
	]) {
		it(`clears the previous modal when routing to ${scenario.name} and preserves Back`, async () => {
			const container = await renderApp("/tasks/BACK-101/original");
			await waitFor(() => Boolean(container.querySelector("[role='dialog']")), "initial routed task modal");
			expect(container.querySelector("#modal-title")?.textContent).toContain(tasks[0]?.title ?? "");
			expect(container.ownerDocument.activeElement).toBe(container.querySelector("[role='dialog']"));

			await pushRoute(scenario.path);
			await waitFor(
				() => window.location.pathname === "/tasks" && Boolean(container.querySelector("[role='alert']")),
				`${scenario.name} route fallback`,
			);
			const alert = container.querySelector("[role='alert']");
			expect(container.querySelector("[role='dialog']")).toBeNull();
			expect(alert?.textContent).toContain(scenario.message);
			expect(container.ownerDocument.activeElement).toBe(alert);

			await travel("back");
			await waitFor(
				() =>
					window.location.pathname === "/tasks/BACK-101/original" &&
					Boolean(container.querySelector("[role='dialog']")),
				"Back to the previous routed task modal",
			);
			expect(container.querySelector("#modal-title")?.textContent).toContain(tasks[0]?.title ?? "");
			expect(container.ownerDocument.activeElement).toBe(container.querySelector("[role='dialog']"));
		});
	}

	it("renders a focused repair alert instead of a modal for a direct active-branch collision link", async () => {
		const container = await renderApp("/tasks/BACK-1/collision-shadow");
		await waitFor(
			() => window.location.pathname === "/tasks" && Boolean(container.querySelector("[role='alert']")),
			"active-branch collision repair alert",
		);
		const alert = container.querySelector("[role='alert']");
		expect(alert?.textContent).toContain(
			'Task "BACK-1" is ambiguous. Repair duplicate task IDs before opening this link.',
		);
		expect(container.querySelector("[role='dialog']")).toBeNull();
		expect(container.ownerDocument.activeElement).toBe(alert);
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

	it("opens an exact legacy task ID from an ordinary list click", async () => {
		const container = await renderApp("/tasks");
		await waitFor(() => container.textContent?.includes("Legacy prefixed task") ?? false, "legacy task list row");

		const title = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === "Legacy prefixed task",
		);
		expect(title).toBeTruthy();
		await click(title as HTMLButtonElement);

		await waitFor(
			() =>
				window.location.pathname === "/tasks/TASK-PREFIXED/legacy-prefixed-task" &&
				container.querySelector("#modal-title")?.textContent?.includes("Legacy prefixed task") === true,
			"legacy task route",
		);
		expect(container.querySelector("[role='alert']")).toBeNull();
	});

	it("opens an exact legacy task ID from a direct route", async () => {
		const container = await renderApp("/board/task-prefixed/cosmetic-slug");
		await waitFor(() => Boolean(container.querySelector("[role='dialog']")), "direct legacy task modal");
		expect(container.querySelector("#modal-title")?.textContent).toContain("Legacy prefixed task");
		expect(container.querySelector("[role='alert']")).toBeNull();
	});

	it("returns a missing legacy task route to the list with a focused not-found error", async () => {
		const container = await renderApp("/tasks/TASK-MISSING");
		await waitFor(
			() => window.location.pathname === "/tasks" && Boolean(container.querySelector("[role='alert']")),
			"missing legacy route fallback",
		);

		const alert = container.querySelector("[role='alert']");
		expect(alert?.textContent).toContain('Task "TASK-MISSING" was not found.');
		expect(document.activeElement).toBe(alert);
		expect(container.querySelector("[role='dialog']")).toBeNull();
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

	it("ignores a stale duplicate repair plan when a newer data load wins", async () => {
		let requestCount = 0;
		let releaseStalePlan = (_response: Response) => {};
		const staleResponse = new Promise<Response>((resolve) => {
			releaseStalePlan = resolve;
		});
		const stalePlan: DuplicateRepairPlan = {
			...emptyDuplicatePlan(),
			groups: [
				{
					id: "BACK-101",
					tasks: [
						{ ...tasks[0], filePath: "backlog/tasks/back-101 - Alpha.md" } as Task,
						{ ...tasks[0], title: "Duplicate", filePath: "backlog/tasks/back-0101 - Duplicate.md" } as Task,
					],
				},
			],
			repairable: true,
			fingerprint: "stale-plan",
		};
		duplicatePlanResponse = async () => {
			requestCount += 1;
			return requestCount === 1 ? await staleResponse : json(emptyDuplicatePlan());
		};

		const container = await renderApp("/tasks");
		await waitFor(
			() => FakeWebSocket.instances.some((socket) => socket.onmessage !== null),
			"data refresh socket",
		);
		await act(async () => {
			FakeWebSocket.instances.findLast((socket) => socket.onmessage !== null)?.onmessage?.({ data: "tasks-updated" });
			await Promise.resolve();
		});
		await waitFor(
			() => requestCount >= 2 && (container.textContent?.includes(tasks[0]?.title ?? "") ?? false),
			"newer data load",
		);
		releaseStalePlan(json(stalePlan));
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(container.textContent).not.toContain("Duplicate task IDs:");
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

	it("returns a malformed legacy route to the list with a focused human-readable error", async () => {
		const container = await renderApp("/tasks/TASK-..%2Fsecret");
		await waitFor(
			() => window.location.pathname === "/tasks" && Boolean(container.querySelector("[role='alert']")),
			"invalid route fallback",
		);

		const alert = container.querySelector("[role='alert']");
		expect(alert?.textContent).toContain('"TASK-../secret" is not a valid task ID.');
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
