import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type TaskDetail, toTaskDetail } from "../core/task-detail.ts";
import type { BacklogConfig, SearchResult, Task } from "../types/index.ts";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";
import { apiClient } from "../web/lib/api.ts";

const statuses = ["To Do", "In Progress", "Done"];

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;
const restore: Array<() => void> = [];

function makeTask(id: string, status: string, dependencies: string[] = []): Task {
	return {
		id,
		title: `Task ${id}`,
		status,
		dependencies,
		assignee: [],
		labels: [],
		createdDate: new Date().toISOString().slice(0, 10),
		rawContent: "",
	};
}

/** The one message the app listens to for "the records on disk changed". */
type FakeSocket = { onmessage: ((event: { data: string }) => void) | null; onclose: (() => void) | null; close(): void };

/**
 * Everything this file plants on the global object, restored afterwards. Bun runs test files in one
 * runtime, so a stub left behind here (a fake WebSocket above all) would break the suites that open
 * real sockets.
 */
function assignGlobals(values: Record<string, unknown>) {
	const globals = globalThis as unknown as Record<string, unknown>;
	const previous = Object.fromEntries(Object.keys(values).map((key) => [key, globals[key]]));
	Object.assign(globals, values);
	restore.push(() => Object.assign(globals, previous));
}

function setupDom(url: string): { container: HTMLElement; sockets: FakeSocket[] } {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url });
	const jsdomWindow = activeDom.window;
	assignGlobals({
		IS_REACT_ACT_ENVIRONMENT: true,
		window: jsdomWindow,
		document: jsdomWindow.document,
		navigator: jsdomWindow.navigator,
		localStorage: jsdomWindow.localStorage,
		Element: jsdomWindow.Element,
		HTMLElement: jsdomWindow.HTMLElement,
		HTMLInputElement: jsdomWindow.HTMLInputElement,
		HTMLTextAreaElement: jsdomWindow.HTMLTextAreaElement,
		HTMLSelectElement: jsdomWindow.HTMLSelectElement,
		// The app and its component libraries construct and dispatch DOM events, which jsdom only
		// accepts from its own constructors.
		Event: jsdomWindow.Event,
		CustomEvent: jsdomWindow.CustomEvent,
		MouseEvent: jsdomWindow.MouseEvent,
		KeyboardEvent: jsdomWindow.KeyboardEvent,
		Node: jsdomWindow.Node,
		MutationObserver: jsdomWindow.MutationObserver,
		getComputedStyle: jsdomWindow.getComputedStyle.bind(jsdomWindow),
		requestAnimationFrame: (callback: FrameRequestCallback) => jsdomWindow.setTimeout(callback, 0),
		cancelAnimationFrame: (handle: number) => jsdomWindow.clearTimeout(handle),
	});
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
	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	htmlElementPrototype.attachEvent ??= () => {};
	htmlElementPrototype.detachEvent ??= () => {};

	const sockets: FakeSocket[] = [];
	class SocketStub implements FakeSocket {
		onmessage: ((event: { data: string }) => void) | null = null;
		onclose: (() => void) | null = null;
		onopen: (() => void) | null = null;
		onerror: ((error: unknown) => void) | null = null;
		readyState = 1;
		static readonly OPEN = 1;
		static readonly CONNECTING = 0;
		constructor() {
			sockets.push(this);
		}
		close() {
			this.readyState = 3;
		}
		send() {}
	}
	assignGlobals({ WebSocket: SocketStub });
	const windowGlobals = window as unknown as Record<string, unknown>;
	windowGlobals.WebSocket = SocketStub;

	return { container: document.getElementById("root") as HTMLElement, sockets };
}

function stubApi(handlers: {
	search: () => SearchResult[];
	fetchTask: (id: string) => Promise<TaskDetail>;
	/** The drafts page reads this endpoint directly rather than through the API client. */
	drafts?: () => Task[];
}) {
	if (handlers.drafts) {
		const drafts = handlers.drafts;
		assignGlobals({
			fetch: async (input: RequestInfo | URL) =>
				String(input).includes("/api/drafts")
					? new Response(JSON.stringify(drafts()), { headers: { "content-type": "application/json" } })
					: new Response("{}", { headers: { "content-type": "application/json" } }),
		});
	}
	const originals = {
		checkStatus: apiClient.checkStatus.bind(apiClient),
		fetchStatuses: apiClient.fetchStatuses.bind(apiClient),
		fetchConfig: apiClient.fetchConfig.bind(apiClient),
		fetchMilestones: apiClient.fetchMilestones.bind(apiClient),
		fetchArchivedMilestones: apiClient.fetchArchivedMilestones.bind(apiClient),
		search: apiClient.search.bind(apiClient),
		fetchDuplicateTaskRepairPlan: apiClient.fetchDuplicateTaskRepairPlan.bind(apiClient),
		fetchTask: apiClient.fetchTask.bind(apiClient),
	};
	restore.push(() => Object.assign(apiClient, originals));

	apiClient.checkStatus = async () => ({ initialized: true, projectName: "Readiness" }) as never;
	apiClient.fetchStatuses = async () => statuses;
	apiClient.fetchConfig = async () => ({ projectName: "Readiness", statuses }) as BacklogConfig;
	apiClient.fetchMilestones = async () => [];
	apiClient.fetchArchivedMilestones = async () => [];
	apiClient.search = async () => handlers.search();
	apiClient.fetchDuplicateTaskRepairPlan = async () => ({ groups: [] }) as never;
	apiClient.fetchTask = async (id: string) => handlers.fetchTask(id);
}

const settle = async (rounds = 6) => {
	for (let round = 0; round < rounds; round += 1) {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
		});
	}
};

const waitForText = async (container: HTMLElement, text: string) => {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if (container.textContent?.includes(text)) return;
		await settle(1);
	}
	throw new Error(`Timed out waiting for ${JSON.stringify(text)}`);
};

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	while (restore.length > 0) restore.pop()?.();
	activeDom?.window.close();
	activeDom = null;
});

/**
 * The browser only ever receives the active task corpus. Readiness is derived from more than that:
 * the completed records, the configured terminal status, and the identities the store knows are
 * contested. A refresh that shows no visible change can still follow one of those moving, so the
 * open task's detail is read again whenever the data refreshes, and only the newest read may land.
 */
describe("open task detail across refreshes", () => {
	it("re-reads the detail on a refresh that changed nothing the browser can see", async () => {
		const dependent = makeTask("TASK-2", "To Do", ["TASK-9"]);
		// TASK-9 is a completed record: it never appears in the corpus the browser is sent.
		let completedDependency: Task | null = null;
		let detailReads = 0;

		const { container, sockets } = setupDom("http://localhost/tasks/TASK-2");
		stubApi({
			search: () => [{ type: "task", score: null, task: dependent }],
			fetchTask: async () => {
				detailReads += 1;
				return toTaskDetail(dependent, {
					tasks: [dependent],
					completedTasks: completedDependency ? [completedDependency] : [],
					statuses,
				});
			},
		});

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<HealthCheckProvider>
					<App />
				</HealthCheckProvider>,
			);
			await Promise.resolve();
		});
		await waitForText(container, "Unknown dependency TASK-9");
		const readsAfterOpen = detailReads;

		// Someone files the dependency as completed work. Nothing in the browser's corpus moves.
		completedDependency = makeTask("TASK-9", "Done");
		await act(async () => {
			for (const socket of sockets) socket.onmessage?.({ data: "tasks-updated" });
			await Promise.resolve();
		});

		await waitForText(container, "Ready to start");
		expect(detailReads).toBeGreaterThan(readsAfterOpen);
		expect(container.textContent).not.toContain("Unknown dependency TASK-9");
	});

	it("ignores a detail read that a newer one has already overtaken", async () => {
		const dependent = makeTask("TASK-2", "To Do", ["TASK-9"]);
		const blockedDetail = toTaskDetail(dependent, { tasks: [dependent], completedTasks: [], statuses });
		const readyDetail = toTaskDetail(dependent, {
			tasks: [dependent],
			completedTasks: [makeTask("TASK-9", "Done")],
			statuses,
		});

		// Every read after the modal is open is held open until the test releases it, so the two
		// refreshes below can be answered out of order.
		const pending: Array<(detail: TaskDetail) => void> = [];
		let opened = false;
		const { container, sockets } = setupDom("http://localhost/tasks/TASK-2");
		stubApi({
			search: () => [{ type: "task", score: null, task: dependent }],
			fetchTask: async () => {
				if (!opened) {
					opened = true;
					return blockedDetail;
				}
				return await new Promise<TaskDetail>((resolve) => pending.push(resolve));
			},
		});

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<HealthCheckProvider>
					<App />
				</HealthCheckProvider>,
			);
			await Promise.resolve();
		});
		await waitForText(container, "Unknown dependency TASK-9");

		const refresh = async () => {
			await act(async () => {
				for (const socket of sockets) socket.onmessage?.({ data: "tasks-updated" });
				await Promise.resolve();
			});
			await settle(2);
		};
		await refresh();
		await refresh();
		expect(pending.length).toBeGreaterThanOrEqual(2);

		// The newest read answers first with the dependency completed, then an older one answers with
		// the state it was asked about. The stale answer must not land on top of the fresh one.
		const newest = pending[pending.length - 1];
		const oldest = pending[0];
		expect(newest).not.toBe(oldest);
		await act(async () => {
			newest?.(readyDetail);
			await Promise.resolve();
		});
		await waitForText(container, "Ready to start");
		await act(async () => {
			oldest?.(blockedDetail);
			await Promise.resolve();
		});
		await settle(3);

		expect(container.textContent).toContain("Ready to start");
		expect(container.textContent).not.toContain("Unknown dependency TASK-9");
	});

	it("reads the detail of a draft opened from the drafts page", async () => {
		const blocker = makeTask("TASK-1", "In Progress");
		const draft: Task = { ...makeTask("DRAFT-1", "Draft", ["TASK-1"]), title: "Draft with dependency" };
		const requestedIds: string[] = [];

		const { container } = setupDom("http://localhost/drafts");
		stubApi({
			search: () => [{ type: "task", score: null, task: blocker }],
			drafts: () => [draft],
			fetchTask: async (id) => {
				requestedIds.push(id);
				return toTaskDetail(draft, { tasks: [blocker, draft], completedTasks: [], statuses });
			},
		});

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<HealthCheckProvider>
					<App />
				</HealthCheckProvider>,
			);
			await Promise.resolve();
		});
		await waitForText(container, "Draft with dependency");

		const row = Array.from(container.querySelectorAll("div.cursor-pointer")).find((element) =>
			element.textContent?.includes("Draft with dependency"),
		);
		expect(row).toBeTruthy();
		await act(async () => {
			row?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});

		// Drafts are not part of the task corpus the modal syncs against, so without a detail read
		// there is no verdict to render at all.
		await waitForText(container, "Blocked by TASK-1");
		expect(requestedIds).toContain("DRAFT-1");
	});

	it("drops a detail read left in flight when the modal is closed and reopened", async () => {
		const dependent = makeTask("TASK-2", "To Do", ["TASK-9"]);
		const blockedDetail = toTaskDetail(dependent, { tasks: [dependent], completedTasks: [], statuses });
		const readyDetail = toTaskDetail(dependent, {
			tasks: [dependent],
			completedTasks: [makeTask("TASK-9", "Done")],
			statuses,
		});

		const pending: Array<(detail: TaskDetail) => void> = [];
		let opened = false;
		const { container, sockets } = setupDom("http://localhost/tasks/TASK-2");
		stubApi({
			search: () => [{ type: "task", score: null, task: dependent }],
			fetchTask: async () => {
				if (!opened) {
					opened = true;
					return blockedDetail;
				}
				return await new Promise<TaskDetail>((resolve) => pending.push(resolve));
			},
		});

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<HealthCheckProvider>
					<App />
				</HealthCheckProvider>,
			);
			await Promise.resolve();
		});
		await waitForText(container, "Unknown dependency TASK-9");

		// A refresh leaves a read in flight, and the reader closes the modal before it answers.
		await act(async () => {
			for (const socket of sockets) socket.onmessage?.({ data: "tasks-updated" });
			await Promise.resolve();
		});
		await settle(2);
		const staleRead = pending[pending.length - 1];
		expect(staleRead).toBeTruthy();

		const close = Array.from(container.querySelectorAll("button")).find(
			(button) => button.getAttribute("aria-label") === "Close modal" || button.textContent?.trim() === "×",
		);
		expect(close).toBeTruthy();
		await act(async () => {
			close?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await settle(2);

		// Reopening from the list goes through the task route, which is the read whose answer counts.
		const reopen = Array.from(container.querySelectorAll("button")).find((button) =>
			button.getAttribute("aria-label")?.startsWith("Open TASK-2"),
		);
		expect(reopen).toBeTruthy();
		await act(async () => {
			reopen?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await settle(2);
		const routedRead = pending[pending.length - 1];
		expect(routedRead).not.toBe(staleRead);

		await act(async () => {
			routedRead?.(readyDetail);
			await Promise.resolve();
		});
		await waitForText(container, "Ready to start");

		// The read from before the modal closed answers last, and must not land on the reopened one.
		await act(async () => {
			staleRead?.(blockedDetail);
			await Promise.resolve();
		});
		await settle(3);
		expect(container.textContent).toContain("Ready to start");
		expect(container.textContent).not.toContain("Unknown dependency TASK-9");
	});
});
