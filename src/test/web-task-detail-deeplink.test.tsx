import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DuplicateRepairPlan } from "../core/duplicate-task-repair.ts";
import type { SearchResult, Task } from "../types/index.ts";
import { isValidTaskId, resolveTaskById } from "../utils/task-id.ts";
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
let controlledTimerCleanup: (() => void) | null = null;
const historyWaitCleanups = new Set<() => void>();

type FetchSettlePoint = "body" | "response";

type FetchExpectation = {
	label: string;
	match: (url: URL, init?: RequestInit) => boolean;
	manual?: boolean;
	settleOn?: FetchSettlePoint;
};

type FetchCall = FetchExpectation & {
	url: string;
	started: boolean;
	settled: boolean;
	readerDepth: number;
	response: Promise<Response>;
	resolveResponse: (response: Response) => void;
	settledSignal: Promise<void>;
	resolveSettled: () => void;
};

const fetchOperations = new Set<FetchOperation>();
let activeFetchOperation: FetchOperation | null = null;

class FetchOperation {
	label: string;
	expectations: FetchExpectation[];
	calls: FetchCall[] = [];
	startedSignals = new Map<string, { promise: Promise<void>; resolve: () => void }>();

	constructor(label: string, expectations: FetchExpectation[]) {
		if (activeFetchOperation) {
			throw new Error(`Cannot start fetch operation "${label}" while "${activeFetchOperation.label}" is active`);
		}
		this.label = label;
		this.expectations = expectations;
		for (const expectation of expectations) {
			let resolve = () => {};
			const promise = new Promise<void>((started) => {
				resolve = started;
			});
			this.startedSignals.set(expectation.label, { promise, resolve });
		}
		activeFetchOperation = this;
		fetchOperations.add(this);
	}

	start(url: URL, init?: RequestInit): FetchCall {
		const expectation = this.expectations.find(
			(candidate) => !this.calls.some((call) => call.label === candidate.label) && candidate.match(url, init),
		) ?? {
			label: `unplanned ${init?.method ?? "GET"} ${url.pathname}${url.search}`,
			match: () => true,
		};
		let resolveResponse = (_response: Response) => {};
		const response = new Promise<Response>((resolve) => {
			resolveResponse = resolve;
		});
		let resolveSettled = () => {};
		const settledSignal = new Promise<void>((resolve) => {
			resolveSettled = resolve;
		});
		const call: FetchCall = {
			...expectation,
			url: `${url.pathname}${url.search}`,
			started: true,
			settled: false,
			readerDepth: 0,
			response,
			resolveResponse,
			settledSignal,
			resolveSettled,
		};
		this.calls.push(call);
		this.startedSignals.get(call.label)?.resolve();
		return call;
	}

	trackResponse(call: FetchCall, response: Response): Response {
		if (call.settleOn === "response") this.markSettled(call);
		for (const readerName of ["json", "text"] as const) {
			const read = response[readerName].bind(response);
			response[readerName] = (async (...args: []) => {
				call.readerDepth += 1;
				try {
					return await read(...args);
				} finally {
					call.readerDepth -= 1;
					if (call.readerDepth === 0) this.markSettled(call);
				}
			}) as typeof response[typeof readerName];
		}
		return response;
	}

	markSettled(call: FetchCall) {
		if (call.settled) return;
		call.settled = true;
		call.resolveSettled();
	}

	async settle(...labels: string[]) {
		await Promise.all(
			labels.map((label) => {
				const signal = this.startedSignals.get(label);
				if (!signal) throw new Error(`Fetch operation "${this.label}" does not expect "${label}"`);
				return signal.promise;
			}),
		);
		const calls = labels.map((label) => {
			const call = this.calls.find((candidate) => candidate.label === label);
			if (!call) throw new Error(`Fetch operation "${this.label}" lost started call "${label}"`);
			return call;
		});
		await Promise.all(calls.map((call) => call.settledSignal));
	}

	respond(label: string, response: Response) {
		const call = this.calls.find((candidate) => candidate.label === label);
		if (!call) throw new Error(`Fetch operation "${this.label}" has not started "${label}"`);
		if (!call.manual) throw new Error(`Fetch call "${this.label}:${label}" is not manual`);
		call.resolveResponse(response);
	}

	finish() {
		if (activeFetchOperation === this) activeFetchOperation = null;
	}

	verifyDrained() {
		const missing = this.expectations.filter(
			(expectation) => !this.calls.some((call) => call.label === expectation.label),
		);
		const pending = this.calls.filter((call) => !call.settled);
		if (missing.length === 0 && pending.length === 0) return;
		const details = [
			...missing.map((expectation) => `missing ${expectation.label}`),
			...pending.map((call) => `pending ${call.label} (${call.url}, readers=${call.readerDepth})`),
		];
		throw new Error(`Fetch operation "${this.label}" was not drained: ${details.join(", ")}`);
	}

	cancel() {
		for (const signal of this.startedSignals.values()) signal.resolve();
		for (const call of this.calls) {
			if (call.manual) call.resolveResponse(json({ error: `Cancelled ${this.label}:${call.label}` }, 500));
			this.markSettled(call);
		}
		this.finish();
	}
}

const expectFetch = (
	label: string,
	path: string | RegExp,
	options: Pick<FetchExpectation, "manual" | "settleOn"> = {},
): FetchExpectation => ({
	label,
	match: (url) => (typeof path === "string" ? url.pathname === path : path.test(url.pathname)),
	...options,
});

const controlTimer = (delay: number) => {
	if (controlledTimerCleanup) throw new Error(`Cannot control ${delay}ms timer while another timer is controlled`);
	const callbacks = new Map<number, () => void>();
	let nextTimerId = -1;
	const originalSetTimeout = globalThis.setTimeout;
	const originalClearTimeout = globalThis.clearTimeout;
	globalThis.setTimeout = ((handler: Parameters<typeof setTimeout>[0], timeout?: number, ...args: unknown[]) => {
		if (timeout === delay && typeof handler === "function") {
			const timerId = nextTimerId;
			nextTimerId -= 1;
			callbacks.set(timerId, () => (handler as (...values: unknown[]) => void)(...args));
			return timerId as unknown as ReturnType<typeof setTimeout>;
		}
		return originalSetTimeout(handler, timeout, ...args as never[]);
	}) as typeof setTimeout;
	globalThis.clearTimeout = ((timerId) => {
		if (typeof timerId === "number" && callbacks.delete(timerId)) return;
		(originalClearTimeout as (handle: typeof timerId) => void)(timerId);
	}) as typeof clearTimeout;
	const restore = () => {
		globalThis.setTimeout = originalSetTimeout;
		globalThis.clearTimeout = originalClearTimeout;
		controlledTimerCleanup = null;
	};
	controlledTimerCleanup = restore;
	return {
		advance() {
			if (callbacks.size === 0) throw new Error(`No ${delay}ms timer was scheduled`);
			for (const callback of callbacks.values()) callback();
			callbacks.clear();
		},
		restore,
	};
};

const nextHistoryChange = (expectedPath?: string) => {
	const previousUrl = window.location.href;
	return new Promise<void>((resolve) => {
		const onPopState = () => {
			if (expectedPath ? window.location.pathname !== expectedPath : window.location.href === previousUrl) return;
			cleanup();
			resolve();
		};
		const cleanup = () => {
			window.removeEventListener("popstate", onPopState);
			historyWaitCleanups.delete(cleanup);
		};
		historyWaitCleanups.add(cleanup);
		window.addEventListener("popstate", onPopState);
	});
};

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
	}

	deliver(data: string) {
		if (!this.onmessage) throw new Error(`Cannot deliver ${data}: WebSocket message handler is not installed`);
		this.onmessage({ data });
	}

	close() {
		this.readyState = FakeWebSocket.CLOSED;
	}
}

const getAppDataWebSocket = (): FakeWebSocket => {
	const socket = FakeWebSocket.instances.findLast(
		(candidate) => candidate.readyState === FakeWebSocket.OPEN && candidate.onmessage !== null,
	);
	if (socket) return socket;
	const diagnostics = FakeWebSocket.instances
		.map(
			(candidate, index) =>
				`#${index} readyState=${candidate.readyState} onmessage=${candidate.onmessage ? "installed" : "missing"}`,
		)
		.join(", ");
	throw new Error(`No live App data WebSocket found; instances: ${diagnostics || "none"}`);
};

const assertHealthSocketDoesNotShadowDataSocket = (): FakeWebSocket => {
	const dataSocket = getAppDataWebSocket();
	const latestSocket = FakeWebSocket.instances.at(-1);
	expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
	expect(latestSocket?.onmessage).toBeNull();
	expect(dataSocket).not.toBe(latestSocket);
	return dataSocket;
};

class FakeResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

const resolveMockResponse = async (url: URL): Promise<Response> => {
		if (url.pathname === "/api/status") {
			return json({ initialized: true, projectPath: "/tmp/project" });
		}
		if (url.pathname === "/api/statuses") {
			return json(["To Do", "In Progress", "Done"]);
		}
		if (url.pathname === "/api/config") {
			return json(defaultConfig);
		}
		if (url.pathname === "/api/search") {
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
			return json(emptyDuplicatePlan());
		}
		if (url.pathname === "/api/version") {
			return json({ version: "test" });
		}
		if (url.pathname.startsWith("/api/task/")) {
			const routeId = decodeURIComponent(url.pathname.slice("/api/task/".length));
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
	};

const installFetchMock = () => {
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const value = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		const url = new URL(value, window.location.origin);
		const operation = activeFetchOperation;
		const call = operation?.start(url, init);
		const response = call?.manual ? await call.response : await resolveMockResponse(url);
		return call && operation ? operation.trackResponse(call, response) : response;
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

const renderApp = async (
	path: string,
	options: {
		advanceHealthSocket?: boolean;
		manualDuplicatePlan?: boolean;
		operationRef?: { current?: FetchOperation };
	} = {},
): Promise<HTMLElement> => {
	setupDom(path);
	const requestedUrl = new URL(path, window.location.origin);
	const pathname = requestedUrl.pathname;
	const routeMatch = pathname.match(/^\/(?:tasks|board)\/([^/]+)(?:\/[^/]+)?$/);
	const routeId = routeMatch?.[1]
		? decodeURIComponent(routeMatch[1])
		: requestedUrl.searchParams.get("highlight")?.trim() || null;
	const controlledTimer =
		requestedUrl.searchParams.has("highlight") || options.advanceHealthSocket ? controlTimer(100) : null;
	const operation = new FetchOperation(`render ${path}`, [
		expectFetch("initial status", "/api/status"),
		expectFetch("initial search", "/api/search"),
		...(options.manualDuplicatePlan
			? [expectFetch("initial duplicate plan", "/api/tasks/duplicates", { manual: true })]
			: []),
		...(routeId && isValidTaskId(routeId)
			? [expectFetch("routed task", `/api/task/${encodeURIComponent(routeId)}`)]
			: []),
	]);
	if (options.operationRef) options.operationRef.current = operation;
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
	await act(async () => operation.settle("initial status"));
	await act(async () => operation.settle("initial search"));
	if (controlledTimer) {
		await act(async () => controlledTimer.advance());
		controlledTimer.restore();
	}
	if (routeId && isValidTaskId(routeId)) {
		await act(async () => operation.settle("routed task"));
	}
	operation.finish();
	return container as HTMLElement;
};

const runOperation = async (label: string, expectations: FetchExpectation[], trigger: () => void | Promise<void>) => {
	const operation = expectations.length > 0 ? new FetchOperation(label, expectations) : null;
	await act(async () => {
		await trigger();
		await Promise.resolve();
	});
	if (!operation) return;
	await act(async () => operation.settle(...expectations.map((expectation) => expectation.label)));
	operation.finish();
};

const click = async (element: Element, expectations: FetchExpectation[] = []) => {
	await runOperation(`click ${element.textContent?.trim() || element.tagName}`, expectations, () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
};

const clickWithHistory = async (element: Element, expectations: FetchExpectation[] = []) => {
	const expectedPath = window.location.pathname.startsWith("/board") ? "/board" : "/tasks";
	const navigated = nextHistoryChange(expectedPath);
	await click(element, expectations);
	await act(async () => navigated);
};

const setInputValue = async (input: HTMLInputElement, value: string, expectations: FetchExpectation[] = []) => {
	await runOperation(`set input to ${JSON.stringify(value)}`, expectations, () => {
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
		valueSetter?.call(input, value);
		input.dispatchEvent(new window.Event("input", { bubbles: true }));
	});
};

const press = async (element: Element, key: string, init: KeyboardEventInit = {}) => {
	await act(async () => {
		(element as HTMLElement).focus();
		element.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true, ...init }));
		await Promise.resolve();
	});
};

const pressWithHistory = async (element: Element, key: string, init: KeyboardEventInit = {}) => {
	const expectedPath = window.location.pathname.startsWith("/board") ? "/board" : "/tasks";
	const navigated = nextHistoryChange(expectedPath);
	await press(element, key, init);
	await act(async () => navigated);
};

const pushRoute = async (path: string, expectations: FetchExpectation[] = []) => {
	await runOperation(`push route ${path}`, expectations, () => {
		window.history.pushState({}, "", path);
		window.dispatchEvent(new window.PopStateEvent("popstate"));
	});
};

const travel = async (direction: "back" | "forward", expectations: FetchExpectation[] = []) => {
	const navigated = nextHistoryChange();
	await runOperation(`history ${direction}`, expectations, async () => {
		window.history[direction]();
		await navigated;
	});
};

const assertState = (predicate: () => boolean, message: string) => {
	expect(predicate(), message).toBe(true);
};

afterEach(async () => {
	const fetchErrors: Error[] = [];
	controlledTimerCleanup?.();
	for (const cleanup of historyWaitCleanups) cleanup();
	for (const operation of fetchOperations) {
		try {
			operation.verifyDrained();
		} catch (error) {
			fetchErrors.push(error as Error);
		}
	}
	await act(async () => {
		for (const operation of fetchOperations) operation.cancel();
		await Promise.resolve();
	});
	fetchOperations.clear();
	activeFetchOperation = null;
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
	FakeWebSocket.instances = [];
	if (fetchErrors.length > 0) throw new AggregateError(fetchErrors, "Fetch mock lifecycle verification failed");
});

describe("task detail routes", () => {
	it("uses the canonical board route for task clicks and browser Back", async () => {
		const container = await renderApp("/");
		assertState(() => container.textContent?.includes(tasks[0]?.title ?? "") ?? false, "board task");
		expect(window.location.pathname).toBe("/board");
		const boardLink = Array.from(container.querySelectorAll("a")).find(
			(element) => element.textContent?.includes("Kanban Board"),
		);
		expect(boardLink?.getAttribute("aria-current")).toBe("page");

		const title = Array.from(container.querySelectorAll("h4")).find((element) => element.textContent === tasks[0]?.title);
		const card = title?.closest("[draggable='true']");
		expect(card).toBeTruthy();
		await click(card as HTMLElement, [expectFetch("opened task", "/api/task/BACK-101")]);

		assertState(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"canonical board task route",
		);

		await travel("back");
		assertState(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"Back to the canonical board",
		);
	});

	it("preserves a type filter through board task Back, Forward, and close navigation", async () => {
		const container = await renderApp("/board?type=bug&lane=none");
		assertState(
			() =>
				new URLSearchParams(window.location.search).get("type") === "Bug" &&
				(container.textContent?.includes(tasks[0]?.title ?? "") ?? false),
			"canonical filtered board",
		);
		const filteredSearch = window.location.search;

		const title = Array.from(container.querySelectorAll("h4")).find((element) => element.textContent === tasks[0]?.title);
		const card = title?.closest("[draggable='true']");
		expect(card).toBeTruthy();
		await click(card as HTMLElement, [expectFetch("opened task", "/api/task/BACK-101")]);

		assertState(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"filtered board task route",
		);
		expect(window.location.search).toBe(filteredSearch);

		await travel("back");
		assertState(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"filtered board Back",
		);
		expect(window.location.search).toBe(filteredSearch);

		await travel("forward", [expectFetch("reopened task", "/api/task/BACK-101")]);
		assertState(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"filtered board Forward",
		);
		expect(window.location.search).toBe(filteredSearch);

		await clickWithHistory(container.querySelector("button[aria-label='Close modal']") as HTMLButtonElement);
		assertState(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"filtered board close",
		);
		expect(window.location.search).toBe(filteredSearch);
	});

	it("preserves a type filter when closing a direct board task route", async () => {
		const container = await renderApp("/board/BACK-101/fix-labels-caf-docs?type=Bug&lane=none");
		assertState(() => Boolean(container.querySelector("[role='dialog']")), "direct filtered board task");

		await click(container.querySelector("button[aria-label='Close modal']") as HTMLButtonElement);
		assertState(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"direct filtered board close",
		);
		expect(window.location.search).toBe("?type=Bug&lane=none");
	});

	it("keeps the latest config and tasks when overlapping refreshes resolve out of order", async () => {
		const container = await renderApp("/board?type=Customer%20Request", { advanceHealthSocket: true });
		const dataSocket = assertHealthSocketDoesNotShadowDataSocket();
		expect(new URLSearchParams(window.location.search).get("type")).toBe("Customer Request");

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

		const staleRefresh = new FetchOperation("stale config refresh", [
			expectFetch("stale config", "/api/config", { manual: true }),
			expectFetch("stale search", "/api/search"),
		]);
		await act(async () => {
			dataSocket.deliver("config-updated");
			await Promise.resolve();
		});
		staleRefresh.finish();

		const newerRefresh = new FetchOperation("newer task refresh", [
			expectFetch("newer config", "/api/config"),
			expectFetch("newer search", "/api/search", { manual: true }),
		]);
		await act(async () => {
			dataSocket.deliver("tasks-updated");
			await Promise.resolve();
		});
		await act(async () => {
			newerRefresh.respond(
				"newer search",
				json([{ type: "task", task: customerTask, score: 1 } satisfies SearchResult]),
			);
			await newerRefresh.settle("newer config", "newer search");
		});
		newerRefresh.finish();

		expect(container.textContent).toContain(customerTask.title);
		expect(new URLSearchParams(window.location.search).get("type")).toBe("Customer Request");

		await act(async () => {
			staleRefresh.respond("stale config", json({ ...defaultConfig, types: ["Bug"] }));
			await staleRefresh.settle("stale config", "stale search");
		});

		expect(container.textContent).toContain(customerTask.title);
		expect(container.textContent).not.toContain(tasks[0]?.title ?? "");
		expect(new URLSearchParams(window.location.search).get("type")).toBe("Customer Request");
		const typeSelect = container.querySelector("select[aria-label='Filter board by type']") as HTMLSelectElement;
		expect(Array.from(typeSelect.options).map((option) => option.value)).toContain("Customer Request");
	});

	it("keeps a filtered board query when a sidebar search result opens and closes", async () => {
		const container = await renderApp("/board?type=bug&lane=none");
		assertState(
			() =>
				new URLSearchParams(window.location.search).get("type") === "Bug" &&
				(container.textContent?.includes(tasks[0]?.title ?? "") ?? false),
			"filtered board before sidebar search",
		);
		const filteredSearch = window.location.search;
		const searchInput = container.querySelector("input[placeholder='Search (⌘K)...']") as HTMLInputElement | null;
		expect(searchInput).toBeTruthy();
		await setInputValue(searchInput as HTMLInputElement, "Fix labels", [
			expectFetch("sidebar search", "/api/search"),
		]);

		assertState(
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
		await click(resultLink as HTMLAnchorElement, [expectFetch("opened sidebar task", "/api/task/BACK-101")]);

		assertState(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"sidebar filtered task route",
		);
		expect(window.location.search).toBe(filteredSearch);

		await clickWithHistory(container.querySelector("button[aria-label='Close modal']") as HTMLButtonElement);
		assertState(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"sidebar return to filtered board",
		);
		expect(window.location.search).toBe(filteredSearch);
	});

	it("keeps legacy highlight links while canonicalizing and closing them cleanly", async () => {
		const container = await renderApp("/?highlight=BACK-101&lane=none&type=bug");
		assertState(
			() =>
				window.location.pathname === "/board/BACK-101/fix-labels-caf-docs" &&
				Boolean(container.querySelector("[role='dialog']")),
			"legacy highlight route",
		);
		expect(window.location.search).toBe("?lane=none&type=Bug");

		const closeButton = container.querySelector("button[aria-label='Close modal']");
		expect(closeButton).toBeTruthy();
		await clickWithHistory(closeButton as HTMLButtonElement);
		expect(window.location.pathname).toBe("/board");
		expect(container.querySelector("[role='dialog']")).toBeNull();
		expect(window.location.search).toBe("?lane=none&type=Bug");
	});

	it("pushes a stable list URL and keeps close, Back, and Forward coherent", async () => {
		const container = await renderApp("/tasks?status=To%20Do");
		assertState(() => container.textContent?.includes(tasks[0]?.title ?? "") ?? false, "task list");
		const ownerDocument = container.ownerDocument;

		// The expanded sidebar must not claim focus on mount.
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
		await click(title as HTMLButtonElement, [expectFetch("opened task", "/api/task/BACK-101")]);

		assertState(
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
		assertState(
			() => window.location.pathname === "/tasks" && container.querySelector("[role='dialog']") === null,
			"Back to close the modal",
		);
		expect(ownerDocument.activeElement).toBe(title as HTMLButtonElement);

		await travel("forward", [expectFetch("reopened task", "/api/task/BACK-101")]);
		assertState(
			() =>
				window.location.pathname === "/tasks/BACK-101/fix-labels-caf-docs" &&
				container.querySelector("[role='dialog']") !== null,
			"Forward to reopen the modal",
		);
		const reopenedDialog = container.querySelector("[role='dialog']");
		expect(reopenedDialog).toBeTruthy();
		expect(reopenedDialog?.ownerDocument.activeElement).toBe(reopenedDialog);

		await pressWithHistory(container.querySelector("[role='dialog']") as HTMLElement, "Escape");
		assertState(
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
			assertState(() => Boolean(container.querySelector("[role='dialog']")), "initial routed task modal");
			expect(container.querySelector("#modal-title")?.textContent).toContain(tasks[0]?.title ?? "");
			expect(container.ownerDocument.activeElement).toBe(container.querySelector("[role='dialog']"));

			const scenarioId = scenario.path.split("/")[2] ?? "";
			await pushRoute(scenario.path, [
				expectFetch("failed routed task", `/api/task/${encodeURIComponent(scenarioId)}`),
			]);
			assertState(
				() => window.location.pathname === "/tasks" && Boolean(container.querySelector("[role='alert']")),
				`${scenario.name} route fallback`,
			);
			const alert = container.querySelector("[role='alert']");
			expect(container.querySelector("[role='dialog']")).toBeNull();
			expect(alert?.textContent).toContain(scenario.message);
			expect(container.ownerDocument.activeElement).toBe(alert);

			await travel("back", [expectFetch("restored routed task", "/api/task/BACK-101")]);
			assertState(
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
		assertState(
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
		assertState(() => container.textContent?.includes("Jira task") ?? false, "cross-prefix task list");

		const title = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === "Jira task",
		);
		expect(title).toBeTruthy();
		await click(title as HTMLButtonElement, [expectFetch("opened Jira task", "/api/task/JIRA-007")]);

		assertState(
			() =>
				window.location.pathname === "/tasks/JIRA-007/jira-task" &&
				container.querySelector("#modal-title")?.textContent?.includes("Jira task") === true,
			"unambiguous cross-prefix task route",
		);
		expect(container.querySelector("[role='alert']")).toBeNull();
	});

	it("opens an exact legacy task ID from an ordinary list click", async () => {
		const container = await renderApp("/tasks");
		assertState(() => container.textContent?.includes("Legacy prefixed task") ?? false, "legacy task list row");

		const title = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === "Legacy prefixed task",
		);
		expect(title).toBeTruthy();
		await click(title as HTMLButtonElement, [expectFetch("opened legacy task", "/api/task/TASK-PREFIXED")]);

		assertState(
			() =>
				window.location.pathname === "/tasks/TASK-PREFIXED/legacy-prefixed-task" &&
				container.querySelector("#modal-title")?.textContent?.includes("Legacy prefixed task") === true,
			"legacy task route",
		);
		expect(container.querySelector("[role='alert']")).toBeNull();
	});

	it("opens an exact legacy task ID from a direct route", async () => {
		const container = await renderApp("/board/task-prefixed/cosmetic-slug");
		assertState(() => Boolean(container.querySelector("[role='dialog']")), "direct legacy task modal");
		expect(container.querySelector("#modal-title")?.textContent).toContain("Legacy prefixed task");
		expect(container.querySelector("[role='alert']")).toBeNull();
	});

	it("returns a missing legacy task route to the list with a focused not-found error", async () => {
		const container = await renderApp("/tasks/TASK-MISSING");
		assertState(
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
		assertState(
			() => window.location.pathname === "/tasks" && container.textContent?.includes(tasks[0]?.title ?? "") === true,
			"task list navigation",
		);

		const title = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === tasks[0]?.title,
		);
		expect(title).toBeTruthy();
		await click(title as HTMLButtonElement, [expectFetch("opened task", "/api/task/BACK-101")]);
		assertState(
			() =>
				window.location.pathname.startsWith("/tasks/BACK-101/") &&
				Boolean(container.querySelector("[role='dialog']")),
			"routed task modal",
		);

		const archiveButton = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent?.includes("Archive Task"),
		);
		expect(archiveButton).toBeTruthy();
		await clickWithHistory(archiveButton as HTMLButtonElement, [
			expectFetch("archive response", "/api/tasks/BACK-101", { settleOn: "response" }),
			expectFetch("archive refresh", "/api/search"),
		]);
		assertState(
			() => window.location.pathname === "/tasks" && container.querySelector("[role='dialog']") === null,
			"single archive close",
		);
		expect(window.location.pathname).toBe("/tasks");
	});

	it("ignores a stale route response when a newer task wins the navigation race", async () => {
		const container = await renderApp("/tasks");
		assertState(() => container.textContent?.includes(tasks[0]?.title ?? "") ?? false, "task list");

		const firstTitle = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === tasks[0]?.title,
		);
		const staleRoute = new FetchOperation("stale task route", [
			expectFetch("stale task", "/api/task/BACK-101", { manual: true }),
		]);
		await click(firstTitle as HTMLButtonElement);
		staleRoute.finish();
		expect(window.location.pathname).toStartWith("/tasks/BACK-101/");

		const secondTitle = Array.from(container.querySelectorAll("button")).find(
			(element) => element.textContent === tasks[1]?.title,
		);
		await click(secondTitle as HTMLButtonElement, [expectFetch("newer task", "/api/task/BACK-001.02")]);
		assertState(
			() =>
				window.location.pathname === "/tasks/BACK-001.02/padded-subtask" &&
				container.querySelector("#modal-title")?.textContent?.includes("Padded subtask") === true,
			"newer task modal",
		);

		await act(async () => {
			staleRoute.respond("stale task", json(tasks[0]));
			await staleRoute.settle("stale task");
		});
		expect(window.location.pathname).toBe("/tasks/BACK-001.02/padded-subtask");
		expect(container.querySelector("#modal-title")?.textContent).toContain("Padded subtask");

		const closeButton = container.querySelector("button[aria-label='Close modal']");
		await clickWithHistory(closeButton as HTMLButtonElement);
		assertState(
			() => window.location.pathname === "/tasks" && container.querySelector("[role='dialog']") === null,
			"race winner close",
		);
	});

	it("ignores a stale duplicate repair plan when a newer data load wins", async () => {
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
		const initialLoadRef: { current?: FetchOperation } = {};
		const container = await renderApp("/tasks", {
			advanceHealthSocket: true,
			manualDuplicatePlan: true,
			operationRef: initialLoadRef,
		});
		const dataSocket = assertHealthSocketDoesNotShadowDataSocket();
		const newerLoad = new FetchOperation("newer data load", [
			expectFetch("newer search", "/api/search"),
			expectFetch("newer duplicate plan", "/api/tasks/duplicates"),
		]);
		await act(async () => {
			dataSocket.deliver("tasks-updated");
			await Promise.resolve();
		});
		await act(async () => {
			await newerLoad.settle("newer search", "newer duplicate plan");
		});
		newerLoad.finish();
		assertState(() => container.textContent?.includes(tasks[0]?.title ?? "") ?? false, "newer data load");
		const initialLoad = initialLoadRef.current;
		if (!initialLoad) throw new Error("Initial data-load operation was not captured");
		await act(async () => {
			initialLoad.respond("initial duplicate plan", json(stalePlan));
			await initialLoad.settle("initial duplicate plan");
		});

		expect(container.textContent).not.toContain("Duplicate task IDs:");
	});

	it("opens a padded custom-prefix subtask directly and closes to the board", async () => {
		const container = await renderApp("/board/001.02/cosmetic-slug");
		assertState(() => Boolean(container.querySelector("[role='dialog']")), "direct board modal");
		expect(container.querySelector("#modal-title")?.textContent).toContain("Padded subtask");

		const closeButton = container.querySelector("button[aria-label='Close modal']");
		expect(closeButton).toBeTruthy();
		await click(closeButton as HTMLButtonElement);
		assertState(
			() => window.location.pathname === "/board" && container.querySelector("[role='dialog']") === null,
			"direct route close",
		);
	});

	it("returns a malformed legacy route to the list with a focused human-readable error", async () => {
		const container = await renderApp("/tasks/TASK-..%2Fsecret");
		assertState(
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
		assertState(
			() => window.location.pathname === "/board" && Boolean(container.querySelector("[role='alert']")),
			"malformed route fallback",
		);
		expect(window.location.search).toBe("?lane=none");
		expect(container.querySelector("[role='alert']")?.textContent).toContain("That task link is not valid.");
		expect(container.querySelector("[role='dialog']")).toBeNull();
	});
});
