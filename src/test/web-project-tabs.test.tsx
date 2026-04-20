import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import App from "../web/App.tsx";
import { HealthCheckProvider } from "../web/contexts/HealthCheckContext.tsx";

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

class MockWebSocket {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readyState = MockWebSocket.OPEN;
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: Event) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;

	constructor(public readonly url: string) {
		setTimeout(() => {
			this.onopen?.(new Event("open"));
		}, 0);
	}

	send(): void {}

	close(): void {
		this.readyState = MockWebSocket.CLOSED;
	}
}

const projectConfigs = {
	web: {
		projectName: "Web Project",
		statuses: ["To Do", "In Progress", "Done"],
		taskTitle: "Ship web tabs",
	},
	ops: {
		projectName: "Ops Project",
		statuses: ["Queued", "Doing", "Done"],
		taskTitle: "Prepare ops rollout",
	},
};

const jsonResponse = (data: unknown): Response =>
	({
		ok: true,
		status: 200,
		statusText: "OK",
		json: async () => data,
		text: async () => JSON.stringify(data),
	}) as Response;

const setupDom = (url = "http://localhost/?project=ops") => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
	globalThis.history = dom.window.history as unknown as History;
	globalThis.location = dom.window.location as unknown as Location;
	globalThis.Event = dom.window.Event as unknown as typeof Event;
	globalThis.CustomEvent = dom.window.CustomEvent as unknown as typeof CustomEvent;
	globalThis.MouseEvent = dom.window.MouseEvent as unknown as typeof MouseEvent;
	globalThis.KeyboardEvent = dom.window.KeyboardEvent as unknown as typeof KeyboardEvent;
	globalThis.MessageEvent = dom.window.MessageEvent as unknown as typeof MessageEvent;
	globalThis.MutationObserver = dom.window.MutationObserver as unknown as typeof MutationObserver;

	if (!window.matchMedia) {
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
	}

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
	}
	if (typeof htmlElementPrototype.detachEvent !== "function") {
		htmlElementPrototype.detachEvent = () => {};
	}
};

const waitFor = async (predicate: () => boolean) => {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if (predicate()) {
			return;
		}
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
	}
	throw new Error("Timed out waiting for condition");
};

const clickElement = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

afterEach(() => {
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
	if (activeRoot) {
		const root = activeRoot;
		act(() => {
			root.unmount();
		});
		activeRoot = null;
	}
});

describe("Web project tabs", () => {
	it("reads the initial project from the URL and reloads scoped data when tabs change", async () => {
		const fetchCalls: string[] = [];
		setupDom();
		globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			const requestUrl = new URL(rawUrl, "http://localhost");
			fetchCalls.push(`${requestUrl.pathname}${requestUrl.search}`);

			if (requestUrl.pathname === "/api/version") {
				return jsonResponse({ version: "1.0.0" });
			}
			if (requestUrl.pathname === "/api/status") {
				return jsonResponse({ initialized: true, projectPath: "/tmp/project" });
			}
			if (requestUrl.pathname === "/api/projects") {
				return jsonResponse({
					defaultProject: "web",
					projects: [
						{ key: "web", projectName: "Web Project" },
						{ key: "ops", projectName: "Ops Project" },
					],
				});
			}

			const projectKey = requestUrl.searchParams.get("project") ?? "web";
			const project = projectConfigs[projectKey as keyof typeof projectConfigs];
			if (!project) {
				throw new Error(`Unexpected project key: ${projectKey}`);
			}

			if (requestUrl.pathname === "/api/statuses") {
				return jsonResponse(project.statuses);
			}
			if (requestUrl.pathname === "/api/config") {
				return jsonResponse({
					projectName: project.projectName,
					statuses: project.statuses,
					labels: [],
					milestones: [],
					dateFormat: "YYYY-MM-DD",
				});
			}
			if (requestUrl.pathname === "/api/search") {
				return jsonResponse([
					{
						type: "task",
						score: 0,
						task: {
							id: `task-${projectKey}-1`,
							title: project.taskTitle,
							status: project.statuses[0],
							assignee: [],
							labels: [],
							dependencies: [],
							createdDate: "2026-04-20",
						},
					},
				]);
			}
			if (requestUrl.pathname === "/api/milestones" || requestUrl.pathname === "/api/milestones/archived") {
				return jsonResponse([]);
			}

			throw new Error(`Unexpected fetch: ${requestUrl.pathname}${requestUrl.search}`);
		}) as typeof fetch;

		const container = document.getElementById("root");
		expect(container).toBeTruthy();
		activeRoot = createRoot(container as HTMLElement);
		await act(async () => {
			activeRoot?.render(
				<HealthCheckProvider>
					<App />
				</HealthCheckProvider>,
			);
			await Promise.resolve();
		});

		await waitFor(() => (container?.textContent ?? "").includes("Ops Project"));

		expect(window.location.search).toBe("?project=ops");
		expect(container?.textContent).toContain("Web Project");
		expect(container?.textContent).toContain("Ops Project");
		expect(fetchCalls).toContain("/api/statuses?project=ops");
		expect(fetchCalls).toContain("/api/config?project=ops");
		expect(fetchCalls).toContain("/api/search?project=ops");

		const webTab = Array.from(container?.querySelectorAll("button") ?? []).find((button) =>
			button.textContent?.includes("Web Project"),
		);
		expect(webTab).toBeTruthy();
		await clickElement(webTab as HTMLButtonElement);

		await waitFor(() => window.location.search === "?project=web");
		await waitFor(() => fetchCalls.filter((call) => call === "/api/config?project=web").length > 0);
		await waitFor(() => (container?.textContent ?? "").includes("Ship web tabs"));

		expect(fetchCalls).toContain("/api/statuses?project=web");
		expect(fetchCalls).toContain("/api/search?project=web");
		expect(container?.textContent).toContain("Ship web tabs");
	});
});
