import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import BoardPage from "../web/components/BoardPage.tsx";

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
	createTask({
		id: "task-101",
		title: "Fix login bug",
		assignee: ["alice"],
		labels: ["bug"],
		milestone: "m-1",
		priority: "high",
	}),
	createTask({
		id: "task-102",
		title: "Write docs",
		assignee: ["bob"],
		labels: ["docs"],
		milestone: "m-2",
		priority: "medium",
	}),
	createTask({
		id: "task-103",
		title: "Improve board",
		status: "In Progress",
		assignee: ["alice"],
		labels: ["enhancement"],
		milestone: "m-1",
		priority: "low",
	}),
	createTask({
		id: "task-104",
		title: "Triage unassigned issue",
		labels: ["bug"],
		priority: "medium",
	}),
];

let activeRoot: Root | null = null;

const setupDom = (url = "http://localhost/board") => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url });
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

const renderBoardPage = (
	url?: string,
	options: { tasks?: Task[]; statuses?: string[]; availableLabels?: string[] } = {},
): HTMLElement => {
	setupDom(url);
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	const renderedTasks = options.tasks ?? tasks;
	const renderedStatuses = options.statuses ?? ["To Do", "In Progress", "Done"];
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<BrowserRouter>
				<BoardPage
					tasks={renderedTasks}
					statuses={renderedStatuses}
					milestones={[]}
					availableLabels={options.availableLabels ?? ["bug", "docs", "enhancement"]}
					milestoneEntities={[]}
					archivedMilestones={[]}
					isLoading={false}
					onEditTask={() => {}}
					onNewTask={() => {}}
				/>
			</BrowserRouter>,
		);
	});
	return container as HTMLElement;
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

const clickElement = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const toggleCheckbox = async (checkbox: HTMLInputElement) => {
	await act(async () => {
		checkbox.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const expectVisibleTasks = (container: HTMLElement, expected: string[]) => {
	const text = container.textContent ?? "";
	for (const title of expected) {
		expect(text).toContain(title);
	}
	for (const task of tasks) {
		if (!expected.includes(task.title)) {
			expect(text).not.toContain(task.title);
		}
	}
};

const expectBoardFiltersInHeader = (container: HTMLElement) => {
	const toolbar = container.querySelector("[aria-label='Board view controls']");
	expect(toolbar).toBeTruthy();
	expect(toolbar?.textContent).toContain("All Tasks");
	expect(toolbar?.textContent).toContain("Milestone");

	const boardFilters = toolbar?.querySelector("[aria-label='Board filters']");
	expect(boardFilters).toBeTruthy();

	for (const ariaLabel of ["Filter board by assignee", "Filter board by priority"]) {
		const select = container.querySelector(`select[aria-label='${ariaLabel}']`) as HTMLSelectElement | null;
		expect(select).toBeTruthy();
		expect(toolbar?.contains(select)).toBe(true);
		expect(select?.className).toContain("min-w-[140px]");
		expect(select?.className).toContain("h-10");
		expect(select?.className).toContain("rounded-lg");
		expect(select?.className).toContain("border-gray-300");
		expect(select?.className).toContain("focus:ring-stone-500");
	}

	expect(container.querySelector("select[aria-label='Filter board by label']")).toBeNull();
	const labelsButton = getBoardLabelsButton(container);
	expect(toolbar?.contains(labelsButton)).toBe(true);
	expect(labelsButton.className).toContain("min-w-[200px]");
	expect(labelsButton.className).toContain("rounded-lg");
	expect(labelsButton.className).toContain("border-gray-300");
	expect(labelsButton.className).toContain("focus:ring-stone-500");
};

const getBoardLabelsButton = (container: HTMLElement): HTMLButtonElement => {
	const button = container.querySelector("button[aria-controls='board-labels-filter-menu']");
	expect(button).toBeTruthy();
	return button as HTMLButtonElement;
};

const getBoardLabelCheckbox = (container: HTMLElement, label: string): HTMLInputElement => {
	const labelElement = Array.from(container.querySelectorAll("#board-labels-filter-menu label")).find(
		(element) => element.textContent?.trim() === label,
	);
	expect(labelElement).toBeTruthy();
	const checkbox = labelElement?.querySelector("input[type='checkbox']");
	expect(checkbox).toBeTruthy();
	return checkbox as HTMLInputElement;
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("Web board filters", () => {
	it("filters board cards by assignee, label, and priority while updating URL params", async () => {
		const container = renderBoardPage();

		expectBoardFiltersInHeader(container);
		expectVisibleTasks(container, ["Fix login bug", "Write docs", "Improve board", "Triage unassigned issue"]);

		await setSelectValue(getSelectByFirstOption(container, "All assignees"), "alice");
		expect(new URLSearchParams(window.location.search).get("assignee")).toBe("alice");
		expectVisibleTasks(container, ["Fix login bug", "Improve board"]);

		await clickElement(getBoardLabelsButton(container));
		await toggleCheckbox(getBoardLabelCheckbox(container, "bug"));
		expect(new URLSearchParams(window.location.search).getAll("label")).toEqual(["bug"]);
		expectVisibleTasks(container, ["Fix login bug"]);

		await toggleCheckbox(getBoardLabelCheckbox(container, "enhancement"));
		expect(new URLSearchParams(window.location.search).getAll("label")).toEqual(["bug", "enhancement"]);
		expect(getBoardLabelsButton(container).textContent).toContain("2 selected");
		expectVisibleTasks(container, ["Fix login bug", "Improve board"]);

		await setSelectValue(getSelectByFirstOption(container, "All priorities"), "high");
		expect(new URLSearchParams(window.location.search).get("priority")).toBe("high");
		expectVisibleTasks(container, ["Fix login bug"]);
	});

	it("matches configured label casing against task labels", async () => {
		const container = renderBoardPage(undefined, {
			availableLabels: ["Bug", "Docs", "enhancement"],
		});

		await clickElement(getBoardLabelsButton(container));
		await toggleCheckbox(getBoardLabelCheckbox(container, "Bug"));

		expect(new URLSearchParams(window.location.search).getAll("label")).toEqual(["Bug"]);
		expect(getBoardLabelsButton(container).textContent).toContain("Bug");
		expectVisibleTasks(container, ["Fix login bug", "Triage unassigned issue"]);
	});

	it("reads filters from URL params and clears them", async () => {
		const container = renderBoardPage("http://localhost/board?assignee=alice&label=bug&priority=high");

		expect(getSelectByFirstOption(container, "All assignees").value).toBe("alice");
		expect(getBoardLabelsButton(container).textContent).toContain("bug");
		expect(getSelectByFirstOption(container, "All priorities").value).toBe("high");
		expectVisibleTasks(container, ["Fix login bug"]);

		const clearButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Clear filters"),
		);
		expect(clearButton).toBeTruthy();
		await clickElement(clearButton as HTMLButtonElement);

		const searchParams = new URLSearchParams(window.location.search);
		expect(searchParams.get("assignee")).toBeNull();
		expect(searchParams.getAll("label")).toEqual([]);
		expect(searchParams.get("priority")).toBeNull();
		expectVisibleTasks(container, ["Fix login bug", "Write docs", "Improve board", "Triage unassigned issue"]);
	});

	it("uses active board filters for milestone lane metadata", async () => {
		const container = renderBoardPage("http://localhost/board?lane=milestone");

		expect(container.textContent).toContain("m-1");
		expect(container.textContent).toContain("m-2");

		await setSelectValue(getSelectByFirstOption(container, "All assignees"), "alice");

		const text = container.textContent ?? "";
		expect(text).toContain("Fix login bug");
		expect(text).toContain("Improve board");
		expect(text).not.toContain("m-2");
		expect(text).not.toContain("Write docs");
	});

	it("shows cleanup on the final configured status column when it is not named Done", () => {
		const container = renderBoardPage(undefined, {
			statuses: ["To Do", "Review", "Closed"],
			tasks: [createTask({ id: "task-200", title: "Closed task", status: "Closed" })],
		});

		const cleanupButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
			button.textContent?.includes("Clean Up Old Tasks"),
		);
		expect(cleanupButtons).toHaveLength(1);
	});
});
