import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DuplicateRepairPlan } from "../core/duplicate-task-repair.ts";
import type { Milestone, SearchResult, Task } from "../types/index.ts";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";

const makeTask = (id: string, title: string, status: string, overrides: Partial<Task> = {}): Task => ({
	id,
	title,
	status,
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-07-10",
	ordinal: 1000,
	...overrides,
});

const defaultConfig = {
	projectName: "In-place QA",
	statuses: ["To Do", "In Progress", "Done"],
	labels: [],
	milestones: [],
	dateFormat: "YYYY-MM-DD",
	remoteOperations: false,
};

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

let tasks: Task[] = [];
let milestones: Milestone[] = [];
let failNextSearch = false;
let requestLog: string[] = [];

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
	if (!socket) throw new Error("No live App data WebSocket found");
	return socket;
};

class FakeResizeObserver {
	disconnect() {}
	observe() {}
	unobserve() {}
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

const respond = async (url: URL): Promise<Response> => {
	if (url.pathname === "/api/status") return json({ initialized: true, projectPath: "/tmp/project" });
	if (url.pathname === "/api/statuses") return json(defaultConfig.statuses);
	if (url.pathname === "/api/config") return json(defaultConfig);
	if (url.pathname === "/api/search") {
		if (failNextSearch) {
			failNextSearch = false;
			// 4xx so the api client surfaces the failure without retrying.
			return json({ error: "search unavailable" }, 400);
		}
		const results: SearchResult[] = tasks.map((task) => ({ type: "task", task, score: 1 }));
		return json(results);
	}
	if (url.pathname === "/api/milestones") return json(milestones);
	if (url.pathname === "/api/milestones/archived") return json([]);
	if (url.pathname === "/api/tasks/duplicates") return json(emptyDuplicatePlan());
	if (url.pathname === "/api/version") return json({ version: "test" });
	return json([]);
};

const installFetchMock = () => {
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const value = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		const url = new URL(value, window.location.origin);
		requestLog.push(url.pathname);
		return respond(url);
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
	installFetchMock();
};

const waitFor = async (predicate: () => boolean, description: string) => {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
		});
	}
	throw new Error(`Timed out waiting for ${description}`);
};

const settle = async () => {
	await act(async () => {
		for (let turn = 0; turn < 5; turn++) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}
	});
};

const renderBoard = async (): Promise<HTMLElement> => {
	setupDom("/board");
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
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
	await waitFor(() => (container.textContent ?? "").includes(tasks[0]?.title ?? ""), "initial board content");
	await settle();
	requestLog = [];
	return container;
};

const requestedPaths = () => Array.from(new Set(requestLog)).sort();

const hasLoadingShell = (container: HTMLElement) =>
	container.querySelector('[role="status"][aria-label="Loading tasks"]') !== null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	FakeWebSocket.instances = [];
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
	globalThis.ResizeObserver = originalResizeObserver;
	globalThis.Event = originalEvent;
	globalThis.CustomEvent = originalCustomEvent;
	globalThis.Element = originalElement;
	globalThis.HTMLElement = originalHTMLElement;
	globalThis.Node = originalNode;
	activeDom = null;
	tasks = [];
	milestones = [];
	failNextSearch = false;
	requestLog = [];
});

describe("in-place data refresh", () => {
	it("applies an external task edit in place through a single search refetch", async () => {
		tasks = [makeTask("TASK-1", "Original title", "To Do"), makeTask("TASK-2", "Neighbor card", "To Do")];
		const container = await renderBoard();
		const neighborBefore = Array.from(container.querySelectorAll("h4")).find(
			(node) => node.textContent === "Neighbor card",
		);
		expect(neighborBefore).toBeTruthy();

		tasks = [makeTask("TASK-1", "Renamed title", "To Do"), tasks[1] as Task];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await waitFor(() => (container.textContent ?? "").includes("Renamed title"), "renamed card");
		await settle();

		// Only the search corpus is refetched: no statuses, config, milestone, or
		// duplicate-plan burst, and no loading shell.
		expect(requestedPaths()).toEqual(["/api/search"]);
		expect(hasLoadingShell(container)).toBe(false);
		// The unchanged card kept its DOM node: the view updated in place.
		const neighborAfter = Array.from(container.querySelectorAll("h4")).find(
			(node) => node.textContent === "Neighbor card",
		);
		expect(neighborAfter).toBe(neighborBefore as HTMLHeadingElement);
	});

	it("moves a card between columns in place when its status changes externally", async () => {
		tasks = [makeTask("TASK-1", "Moving card", "To Do")];
		const container = await renderBoard();

		// The nearest ancestor that carries an h3 heading is the task's column,
		// and that heading is the column's status title.
		const columnOf = (title: string): string | null => {
			const card = Array.from(container.querySelectorAll("h4")).find((node) => node.textContent === title);
			let node: Element | null = card ?? null;
			while (node && node !== container) {
				const heading = node.querySelector("h3");
				if (heading?.textContent) return heading.textContent;
				node = node.parentElement;
			}
			return null;
		};
		expect(columnOf("Moving card")).toBe("To Do");

		tasks = [makeTask("TASK-1", "Moving card", "In Progress")];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await waitFor(() => columnOf("Moving card") === "In Progress", "card in the In Progress column");
		await settle();

		expect(requestedPaths()).toEqual(["/api/search"]);
		expect(hasLoadingShell(container)).toBe(false);
	});

	it("shows an externally created task without a full reload", async () => {
		tasks = [makeTask("TASK-1", "Existing card", "To Do")];
		const container = await renderBoard();

		tasks = [...tasks, makeTask("TASK-2", "Brand new card", "To Do")];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await waitFor(() => (container.textContent ?? "").includes("Brand new card"), "externally created card");
		await settle();

		// A new task ID can introduce a duplicate, so only this path also
		// refreshes the duplicate repair plan.
		expect(requestedPaths()).toEqual(["/api/search", "/api/tasks/duplicates"]);
		expect(hasLoadingShell(container)).toBe(false);
	});

	it("treats a broadcast that echoes already-applied data as a no-op", async () => {
		tasks = [makeTask("TASK-1", "Stable card", "To Do")];
		await renderBoard();

		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await settle();

		// The echo after a surgical drag update costs exactly one search read.
		expect(requestedPaths()).toEqual(["/api/search"]);
	});

	it("refetches milestone entities incrementally on a milestone-scoped broadcast", async () => {
		tasks = [makeTask("TASK-1", "Milestone card", "To Do")];
		await renderBoard();

		milestones = [
			{ id: "m-1", title: "Launch", description: "", rawContent: "", createdDate: "2026-07-10" } as Milestone,
		];
		await act(async () => {
			getAppDataWebSocket().deliver("milestones-updated");
		});
		await settle();

		expect(requestedPaths()).toEqual(["/api/milestones", "/api/milestones/archived", "/api/search"]);
	});

	it("falls back to the full reload when the incremental refresh fails", async () => {
		tasks = [makeTask("TASK-1", "Fallback card", "To Do")];
		const container = await renderBoard();

		failNextSearch = true;
		tasks = [makeTask("TASK-1", "Fallback card renamed", "To Do")];
		await act(async () => {
			getAppDataWebSocket().deliver("tasks-updated");
		});
		await waitFor(() => (container.textContent ?? "").includes("Fallback card renamed"), "card after fallback reload");
		await settle();

		expect(requestedPaths()).toEqual([
			"/api/config",
			"/api/milestones",
			"/api/milestones/archived",
			"/api/search",
			"/api/statuses",
			"/api/tasks/duplicates",
		]);
	});
});
