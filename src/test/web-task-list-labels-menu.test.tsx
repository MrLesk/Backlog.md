import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskList from "../web/components/TaskList.tsx";

const createTask = (overrides: Partial<Task>): Task => ({
	id: "task-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

const tasks: Task[] = [
	createTask({ id: "task-101", title: "Fix labels dropdown", labels: ["bug"] }),
	createTask({ id: "task-102", title: "Ship docs", labels: ["docs"] }),
];

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

const LocationProbe = () => {
	const location = useLocation();
	return <div data-testid="location-search">{location.search}</div>;
};

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;

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

const renderTaskList = (
	initialEntries?: string[],
	options: { tasks?: Task[]; availableStatuses?: string[] } = {},
): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	const renderedTasks = options.tasks ?? tasks;
	const renderedStatuses = options.availableStatuses ?? ["To Do", "In Progress", "Done"];
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<MemoryRouter initialEntries={initialEntries}>
				<TaskList
					tasks={renderedTasks}
					availableStatuses={renderedStatuses}
					availableLabels={["bug", "docs"]}
					availableMilestones={[]}
					milestoneEntities={[]}
					archivedMilestones={[]}
					onEditTask={() => {}}
					onNewTask={() => {}}
				/>
				<LocationProbe />
			</MemoryRouter>,
		);
	});
	return container as HTMLElement;
};

const clickElement = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const getSelectByFirstOption = (container: HTMLElement, firstOptionText: string): HTMLSelectElement => {
	const select = Array.from(container.querySelectorAll("select")).find(
		(element) => element.options[0]?.textContent === firstOptionText,
	);
	expect(select).toBeTruthy();
	return select as HTMLSelectElement;
};

const setSelectValue = async (select: HTMLSelectElement, value: string) => {
	await act(async () => {
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
		valueSetter?.call(select, value);
		select.dispatchEvent(new window.Event("change", { bubbles: true }));
		await Promise.resolve();
	});
};

const waitFor = async (predicate: () => boolean) => {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		if (predicate()) {
			return;
		}
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
};

const getLabelsButton = (container: HTMLElement): HTMLButtonElement => {
	const button = container.querySelector("button[aria-controls='task-list-labels-menu']");
	expect(button).toBeTruthy();
	return button as HTMLButtonElement;
};

const getExcludeStatusButton = (container: HTMLElement): HTMLButtonElement => {
	const button = container.querySelector("button[aria-controls='task-list-exclude-status-menu']");
	expect(button).toBeTruthy();
	return button as HTMLButtonElement;
};

const getZIndexClass = (element: Element): number | null => {
	const match = element.className.match(/\bz-(\d+)\b/);
	const value = match?.[1];
	return value ? Number.parseInt(value, 10) : null;
};

const getRenderedTaskIds = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll("tbody tr td:first-child")).map((cell) => cell.textContent?.trim() ?? "");

afterEach(() => {
	globalThis.fetch = originalFetch;
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("TaskList labels filter menu", () => {
	it("does not render a duplicate local task search input", () => {
		const container = renderTaskList(["/?query=docs"]);

		expect(container.querySelector("input[placeholder='Search tasks']")).toBeNull();
	});

	it("renders and sorts by ordinal with task ID as the tie-breaker", async () => {
		const container = renderTaskList(undefined, {
			tasks: [
				createTask({ id: "task-1", title: "No ordinal" }),
				createTask({ id: "task-2", title: "Tied ordinal A", ordinal: 20 }),
				createTask({ id: "task-3", title: "First ordinal", ordinal: 10 }),
				createTask({ id: "task-4", title: "Tied ordinal B", ordinal: 20 }),
			],
		});

		const ordinalButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Ordinal"),
		);
		expect(ordinalButton).toBeTruthy();

		await clickElement(ordinalButton as HTMLButtonElement);
		await waitFor(() => getRenderedTaskIds(container)[0] === "task-3");

		expect(getRenderedTaskIds(container)).toEqual(["task-3", "task-2", "task-4", "task-1"]);
		expect(container.querySelector("th[aria-sort='ascending']")?.textContent).toContain("Ordinal");

		await clickElement(ordinalButton as HTMLButtonElement);
		await waitFor(() => getRenderedTaskIds(container)[0] === "task-2");

		expect(getRenderedTaskIds(container)).toEqual(["task-2", "task-4", "task-3", "task-1"]);
		expect(container.querySelector("th[aria-sort='descending']")?.textContent).toContain("Ordinal");
	});

	it("renders the labels menu above the sticky table header", async () => {
		const container = renderTaskList();
		const labelsButton = getLabelsButton(container);

		await clickElement(labelsButton);

		const labelsMenu = container.querySelector("#task-list-labels-menu");
		const stickyHeader = container.querySelector("div.sticky");

		expect(labelsMenu).toBeTruthy();
		expect(stickyHeader).toBeTruthy();
		expect(labelsMenu?.textContent).toContain("bug");
		expect(labelsButton.getAttribute("aria-haspopup")).toBeNull();
		expect(labelsMenu?.getAttribute("role")).toBeNull();
		expect(getZIndexClass(labelsMenu as Element)).toBeGreaterThan(getZIndexClass(stickyHeader as Element) ?? 0);
	});

	it("allows selecting and clearing a label filter", async () => {
		const fetchCalls: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			fetchCalls.push(url);
			expect(url).toContain("/api/search");
			expect(url).toContain("label=bug");
			return {
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => [{ type: "task", score: 0, task: tasks[0] }],
			} as Response;
		}) as typeof fetch;

		const container = renderTaskList(["/?label=bug"]);
		const labelsButton = getLabelsButton(container);
		await waitFor(() => fetchCalls.length === 1);

		expect(labelsButton.textContent).toContain("bug");
		expect(fetchCalls).toHaveLength(1);

		await clickElement(labelsButton);

		const clearButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Clear label filter"),
		);
		expect(clearButton).toBeTruthy();
		await clickElement(clearButton as HTMLButtonElement);

		expect(labelsButton.textContent).toContain("All");
		expect(container.querySelector("#task-list-labels-menu")).toBeNull();
	});

	it("persists excluded statuses and sends them to task search", async () => {
		const filteredTasks = [
			createTask({ id: "task-101", title: "Todo visible", status: "To Do" }),
			createTask({ id: "task-102", title: "Progress visible", status: "In Progress" }),
			createTask({ id: "task-103", title: "Done hidden", status: "Done" }),
		];
		const fetchCalls: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			fetchCalls.push(url);
			const searchParams = new URL(url, "http://localhost").searchParams;
			expect(url).toContain("/api/search");
			expect(searchParams.getAll("excludeStatus")).toEqual(["Done"]);
			return {
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => [
					{ type: "task", score: 0, task: filteredTasks[1] },
					{ type: "task", score: 0, task: filteredTasks[0] },
				],
			} as Response;
		}) as typeof fetch;

		const container = renderTaskList(undefined, {
			tasks: filteredTasks,
			availableStatuses: ["To Do", "In Progress", "Done"],
		});
		const excludeStatusButton = getExcludeStatusButton(container);

		await clickElement(excludeStatusButton);
		const doneLabel = Array.from(container.querySelectorAll("#task-list-exclude-status-menu label")).find((label) =>
			label.textContent?.includes("Done"),
		);
		const doneCheckbox = doneLabel?.querySelector("input");
		expect(doneCheckbox).toBeTruthy();
		await clickElement(doneCheckbox as HTMLInputElement);
		await waitFor(() => fetchCalls.length === 1 && getRenderedTaskIds(container).includes("task-102"));

		expect(excludeStatusButton.textContent).toContain("Done");
		const locationSearch = container.querySelector("[data-testid='location-search']")?.textContent ?? "";
		expect(new URLSearchParams(locationSearch).getAll("excludeStatus")).toEqual(["Done"]);
		expect(getRenderedTaskIds(container)).toEqual(["task-102", "task-101"]);
		expect(container.textContent).not.toContain("Done hidden");
	});

	it("shows cleanup when filtering by the final configured status", async () => {
		const closedTask = createTask({ id: "task-201", title: "Closed task", status: "Closed" });
		const fetchCalls: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			fetchCalls.push(url);
			expect(url).toContain("/api/search");
			expect(url).toContain("status=Closed");
			return {
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => [{ type: "task", score: 0, task: closedTask }],
			} as Response;
		}) as typeof fetch;

		const container = renderTaskList(undefined, {
			tasks: [closedTask],
			availableStatuses: ["To Do", "Review", "Closed"],
		});
		await setSelectValue(getSelectByFirstOption(container, "All statuses"), "Closed");
		await waitFor(() => fetchCalls.length === 1 && (container.textContent ?? "").includes("Clean Up"));

		expect(container.textContent).toContain("Clean Up");
	});

	it("does not show cleanup when filtering by a non-terminal status", async () => {
		const reviewTask = createTask({ id: "task-202", title: "Review task", status: "Review" });
		const fetchCalls: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			fetchCalls.push(url);
			expect(url).toContain("/api/search");
			expect(url).toContain("status=Review");
			return {
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => [{ type: "task", score: 0, task: reviewTask }],
			} as Response;
		}) as typeof fetch;

		const container = renderTaskList(undefined, {
			tasks: [reviewTask],
			availableStatuses: ["To Do", "Review", "Closed"],
		});
		await setSelectValue(getSelectByFirstOption(container, "All statuses"), "Review");
		await waitFor(() => fetchCalls.length === 1 && (container.textContent ?? "").includes("Review task"));

		expect(container.textContent).not.toContain("Clean Up");
	});
});
