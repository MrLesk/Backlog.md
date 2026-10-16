import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { DuplicateRepairPlan } from "../core/duplicate-task-repair.ts";
import type { SearchResult, Task } from "../types/index.ts";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";

/**
 * Demoting a task rewrites other tasks, so the web UI reports which ones lost a reference. The
 * report is the only trace a viewer gets, so it must survive a slow refresh and must not be cut
 * short by the previous report's expiry. Archiving rewrites no other task and reports nothing.
 */

/** The notice's display window, and the only delay this file takes control of. */
const NOTICE_MS = 4000;

const makeTask = (id: string, title: string): Task => ({
	id,
	title,
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-07-10",
	ordinal: 1000,
});

const defaultConfig = {
	projectName: "Cleanup notice QA",
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
/** Cleaned IDs the demote endpoint reports, per demoted task. */
let cleanedTaskIds: Record<string, string[]> = {};
/** Held open to keep a refresh in flight while the test inspects the page. */
let searchHold: Promise<void> | null = null;
let reportArchiveMoved = false;
/** When set, the archive endpoint refuses with this message, as core does for a task it will not archive. */
let archiveRefusal: string | null = null;
let failRefreshSearch = false;
let archiveRecoveryEvents: string[] = [];

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
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

class FakeWebSocket {
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

const respond = async (url: URL, init?: RequestInit): Promise<Response> => {
	if (url.pathname === "/api/status") return json({ initialized: true, projectPath: "/tmp/project" });
	if (url.pathname === "/api/statuses") return json(defaultConfig.statuses);
	if (url.pathname === "/api/config") return json(defaultConfig);
	if (url.pathname === "/api/search") {
		if (failRefreshSearch) {
			archiveRecoveryEvents.push("refresh");
			// A client error is not retried, so the failed refresh is over before the test is: a
			// retry left waiting on its backoff would wake up inside a later test.
			return json({ error: "Search failed" }, 400);
		}
		if (searchHold) await searchHold;
		return json(tasks.map((task) => ({ type: "task", task, score: 1 })) satisfies SearchResult[]);
	}
	if (url.pathname === "/api/milestones" || url.pathname === "/api/milestones/archived") return json([]);
	if (url.pathname === "/api/tasks/duplicates") return json(emptyDuplicatePlan());
	if (url.pathname === "/api/version") return json({ version: "test" });
	if (url.pathname.startsWith("/api/task/")) {
		const id = decodeURIComponent(url.pathname.slice("/api/task/".length));
		const task = tasks.find((candidate) => candidate.id === id);
		return task ? json(task) : json({ error: `Task ${id} not found` }, 404);
	}
	const lifecycleRoute = init?.method === "POST" ? url.pathname.match(/^\/api\/tasks\/([^/]+)\/(archive|demote)$/) : null;
	if (lifecycleRoute) {
		const id = decodeURIComponent(lifecycleRoute[1] ?? "");
		if (lifecycleRoute[2] === "archive" && archiveRefusal) {
			return json({ error: archiveRefusal }, 400);
		}
		tasks = tasks.filter((task) => task.id !== id);
		if (lifecycleRoute[2] === "demote") {
			return json({ success: true, cleanedTaskIds: cleanedTaskIds[id] ?? [] });
		}
		if (reportArchiveMoved) {
			return json({ error: "commit failed", archiveState: "moved" }, 500);
		}
		return json({ success: true });
	}
	return json([]);
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

	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const value = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
		return await respond(new URL(value, window.location.origin), init);
	}) as typeof fetch;
};

/**
 * Take control of the notice's expiry timer only. Every other timeout keeps running normally, so
 * React's own scheduling is untouched and the test never waits on wall-clock time.
 */
type NoticeTimer = { run: () => void; cancelled: boolean };
let noticeTimers: NoticeTimer[] = [];

const captureNoticeTimers = () => {
	noticeTimers = [];
	globalThis.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
		if (delay === NOTICE_MS && typeof handler === "function") {
			const timer: NoticeTimer = { run: () => handler(), cancelled: false };
			noticeTimers.push(timer);
			return timer as unknown as ReturnType<typeof setTimeout>;
		}
		return originalSetTimeout(handler, delay, ...args);
	}) as typeof setTimeout;
	globalThis.clearTimeout = ((handle?: unknown) => {
		const timer = noticeTimers.find((candidate) => candidate === handle);
		if (timer) {
			timer.cancelled = true;
			return;
		}
		return originalClearTimeout(handle as Parameters<typeof clearTimeout>[0]);
	}) as typeof clearTimeout;
};

const settle = async () => {
	await act(async () => {
		for (let turn = 0; turn < 6; turn++) {
			await new Promise((resolve) => originalSetTimeout(resolve, 5));
		}
	});
};

const waitFor = async (predicate: () => boolean, description: string) => {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => originalSetTimeout(resolve, 5));
		});
	}
	throw new Error(`Timed out waiting for ${description}`);
};

const click = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const renderTaskList = async (): Promise<HTMLElement> => {
	setupDom("/tasks");
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
	await waitFor(() => (container.textContent ?? "").includes(tasks[0]?.title ?? ""), "task list");
	await settle();
	return container;
};

const findButton = (container: HTMLElement, matches: (text: string) => boolean): HTMLButtonElement => {
	const button = Array.from(container.querySelectorAll("button")).find((element) =>
		matches(element.textContent ?? ""),
	);
	expect(button).toBeTruthy();
	return button as HTMLButtonElement;
};

/** Open a task's details from the list and press its archive action. */
const openTaskModal = async (container: HTMLElement, title: string) => {
	await waitFor(() => (container.textContent ?? "").includes(title), `${title} in the list`);
	await click(findButton(container, (text) => text === title));
	await waitFor(() => container.querySelector("[role='dialog']") !== null, `${title} details modal`);
};

// Closing the modal pops the history entry the task route pushed, so the list is only ready for
// the next open once that has landed.
const waitForModalClosed = async (container: HTMLElement, title: string) => {
	await waitFor(
		() => container.querySelector("[role='dialog']") === null && window.location.pathname === "/tasks",
		`${title} details modal closed`,
	);
	await settle();
};

const archiveFromModal = async (container: HTMLElement, title: string) => {
	await openTaskModal(container, title);
	await click(findButton(container, (text) => text.includes("Archive Task")));
	await waitForModalClosed(container, title);
};

/** Starts the demotion; the modal stays open until the refresh that follows it has landed. */
const demoteFromModal = async (container: HTMLElement, title: string, beforeDemote: () => void = () => {}) => {
	await openTaskModal(container, title);
	// Let the detail read land first, as it has by the time a person reaches for the button.
	await settle();
	beforeDemote();
	await click(findButton(container, (text) => text.includes("Demote to draft")));
};

afterEach(() => {
	globalThis.setTimeout = originalSetTimeout;
	globalThis.clearTimeout = originalClearTimeout;
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
	cleanedTaskIds = {};
	searchHold = null;
	reportArchiveMoved = false;
	archiveRefusal = null;
	failRefreshSearch = false;
	archiveRecoveryEvents = [];
	noticeTimers = [];
});

describe("dependency cleanup notice", () => {
	it("reports the cleaned tasks while the refresh is still in flight", async () => {
		tasks = [makeTask("TASK-1", "Demote target"), makeTask("TASK-2", "Dependent one")];
		cleanedTaskIds = { "TASK-1": ["TASK-2"] };
		const container = await renderTaskList();

		// The refresh that follows the demotion never resolves during this check, so the notice can
		// only be on screen if it was recorded from the demote response itself.
		let releaseSearch = () => {};
		await demoteFromModal(container, "Demote target", () => {
			searchHold = new Promise<void>((resolve) => {
				releaseSearch = resolve;
			});
		});
		await waitFor(
			() => (container.textContent ?? "").includes("Removed references to TASK-1 from TASK-2"),
			"cleanup notice while the refresh is pending",
		);

		searchHold = null;
		releaseSearch();
		await waitForModalClosed(container, "Demote target");
		expect(container.textContent).toContain("Removed references to TASK-1 from TASK-2");
	});

	it("keeps a second notice on screen when the first one's timer expires", async () => {
		tasks = [makeTask("TASK-1", "First target"), makeTask("TASK-2", "Second target")];
		cleanedTaskIds = { "TASK-1": ["TASK-3"], "TASK-2": ["TASK-4"] };
		const container = await renderTaskList();

		captureNoticeTimers();

		await demoteFromModal(container, "First target");
		await waitFor(
			() => (container.textContent ?? "").includes("Removed references to TASK-1 from TASK-3"),
			"first cleanup notice",
		);
		await waitForModalClosed(container, "First target");

		await demoteFromModal(container, "Second target");
		await waitFor(
			() => (container.textContent ?? "").includes("Removed references to TASK-2 from TASK-4"),
			"second cleanup notice",
		);
		await waitForModalClosed(container, "Second target");

		// Exactly one expiry per notice, and the first one now falls due.
		expect(noticeTimers).toHaveLength(2);
		const firstTimer = noticeTimers[0] as NoticeTimer;
		await act(async () => {
			if (!firstTimer.cancelled) firstTimer.run();
			await Promise.resolve();
		});

		expect(container.textContent).toContain("Removed references to TASK-2 from TASK-4");
	});

	it("archives without rewriting other tasks, so it shows no cleanup notice", async () => {
		tasks = [makeTask("TASK-1", "Archive target"), makeTask("TASK-2", "Dependent one")];
		cleanedTaskIds = { "TASK-1": ["TASK-2"] };
		const container = await renderTaskList();

		await archiveFromModal(container, "Archive target");

		expect(container.textContent).not.toContain("Archive target");
		expect(container.textContent).toContain("Dependent one");
		expect(container.textContent).not.toContain("Removed references");
	});

	it("shows core's refusal in the task dialog when the archive endpoint answers 400", async () => {
		tasks = [makeTask("TASK-1", "Archive target")];
		const container = await renderTaskList();
		archiveRefusal =
			"Task TASK-1 cannot be archived: the archive already has a file named task-1 - Archive-target.md.";
		const originalConsoleError = console.error;
		console.error = () => {};

		try {
			await openTaskModal(container, "Archive target");
			await click(findButton(container, (text) => text.includes("Archive Task")));
			await waitFor(
				() => container.querySelector("[role='dialog'] [role='alert']")?.textContent === archiveRefusal,
				"the refusal in the dialog's alert",
			);
		} finally {
			console.error = originalConsoleError;
		}

		// Nothing was archived, so the dialog stays open on the task the refusal is about.
		expect(container.querySelector("[role='dialog']")?.textContent).toContain("Archive target");
		expect(tasks.map((task) => task.id)).toEqual(["TASK-1"]);
	});

	it("warns that an archive moved before starting a refresh that can fail", async () => {
		tasks = [makeTask("TASK-1", "Archive target")];
		const container = await renderTaskList();
		reportArchiveMoved = true;
		failRefreshSearch = true;
		let alertMessage = "";
		window.alert = (message) => {
			archiveRecoveryEvents.push("alert");
			alertMessage = String(message);
		};
		const originalConsoleError = console.error;
		console.error = () => {};

		try {
			await archiveFromModal(container, "Archive target");
			await waitFor(() => archiveRecoveryEvents.includes("alert"), "archive recovery warning");
			await settle();
		} finally {
			console.error = originalConsoleError;
		}

		expect(alertMessage).toContain("The task was archived, but committing the change failed");
		expect(archiveRecoveryEvents[0]).toBe("alert");
	});
});
