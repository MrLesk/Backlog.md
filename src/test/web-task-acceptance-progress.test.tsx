import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard.tsx";
import TaskList from "../web/components/TaskList.tsx";
import { createUnfilteredNesting } from "../web/lib/task-nesting.ts";
import { STANDALONE_CARD_NESTING } from "./task-card-nesting.ts";

const createCriteria = (checked: number, total: number) =>
	Array.from({ length: total }, (_, index) => ({
		index: index + 1,
		text: `Criterion ${index + 1}`,
		checked: index < checked,
	}));

const createTask = (overrides: Partial<Task> = {}): Task => ({
	id: "task-1",
	title: "Task summary",
	status: "In Progress",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

// A project's configured statuses, with a custom one between the defaults.
const STATUSES = ["To Do", "In Progress", "Awaiting test", "Done"];

// The ring does not depend on status. Each case names a position in STATUSES and has its own
// count, so the expected numbers can only come from that task's criteria.
const statusCases: [position: string, status: string, checked: number, total: number][] = [
	["first", "To Do", 0, 3],
	["custom middle", "Awaiting test", 4, 6],
	["final", "Done", 5, 5],
];

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const setupDom = (): HTMLElement => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document as unknown as Document;
	globalThis.navigator = activeDom.window.navigator as unknown as Navigator;
	globalThis.localStorage = activeDom.window.localStorage as unknown as Storage;

	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	return container as HTMLElement;
};

const renderCard = (task: Task): HTMLElement => {
	const container = setupDom();
	act(() => {
		activeRoot?.render(
			<MemoryRouter initialEntries={["/board"]}>
				<TaskCard task={task} onOpenTask={() => {}} {...STANDALONE_CARD_NESTING} />
			</MemoryRouter>,
		);
	});
	return container;
};

// The final status group is open, so a row in every status is on screen.
const renderList = (...tasks: Task[]): HTMLElement => {
	const container = setupDom();
	act(() => {
		activeRoot?.render(
			<MemoryRouter initialEntries={["/tasks"]}>
				<TaskList
					tasks={tasks}
					nesting={createUnfilteredNesting(tasks)}
					statuses={STATUSES}
					finalGroupOpenByDefault
					isLoading={false}
					onOpenTask={() => {}}
				/>
			</MemoryRouter>,
		);
	});
	return container;
};

const getProgress = (container: HTMLElement): HTMLElement | null =>
	container.querySelector("[data-acceptance-criteria-progress]");

// The header row is the line that precedes the card title: priority, ID and the ring.
const getHeaderRow = (container: HTMLElement): HTMLElement => {
	const header = container.querySelector("h4")?.previousElementSibling as HTMLElement | null;
	expect(header).toBeTruthy();
	return header as HTMLElement;
};

const getPriorityName = (element: HTMLElement): string | null | undefined =>
	element.querySelector("[role='img'][aria-label$='priority']")?.getAttribute("aria-label");

// One row of the list, found through the link that opens its task.
const getListRow = (container: HTMLElement, taskId: string): HTMLElement => {
	const row = container.querySelector<HTMLElement>(`a[aria-label^="Open ${taskId}:"]`)?.closest("li");
	expect(row).toBeTruthy();
	return row as HTMLElement;
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 5;

const expectRing = (progress: HTMLElement | null, checked: number, total: number) => {
	const svg = progress?.querySelector("svg");
	expect(svg).toBeTruthy();
	const circles = svg?.querySelectorAll("circle");
	if (checked === 0) {
		expect(circles?.length).toBe(1);
	} else {
		expect(circles?.length).toBe(2);
		expect(circles?.[1]?.getAttribute("stroke-dasharray")).toBe(
			`${(checked / total) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`,
		);
	}
	expect(progress?.textContent).toBe(`${checked}/${total}`);
	expect(progress?.textContent).not.toContain("█");
	expect(progress?.textContent).not.toContain("░");
	expect(progress?.textContent).not.toContain("[");
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	activeDom?.window.close();
	activeDom = null;
});

describe("browser task acceptance criteria progress", () => {
	it("renders a partial progress ring at card density on a board card", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: createCriteria(4, 7) }));
		const progress = getProgress(container);

		expect(progress).toBeTruthy();
		expect(progress?.dataset.density).toBe("card");
		expect(progress?.querySelector("svg")?.getAttribute("class")).toContain("h-3 w-3");
		expectRing(progress, 4, 7);
		expect(progress?.textContent).not.toContain("%");
		expect(progress?.textContent).not.toContain("Acceptance criteria");
	});

	it("renders only the ring track when no criteria are checked", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: createCriteria(0, 4) }));
		const progress = getProgress(container);

		expect(progress).toBeTruthy();
		expectRing(progress, 0, 4);
	});

	it("includes card progress in the accessible name", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: createCriteria(4, 7) }));
		const title = container.querySelector("h4 a");

		expect(title?.getAttribute("aria-label")).toBe("Open task-1: Task summary. Acceptance criteria progress: 4 of 7");
	});

	it.each(statusCases)("renders the card ring in the %s status (%s)", (_position, status, checked, total) => {
		const container = renderCard(createTask({ status, acceptanceCriteriaItems: createCriteria(checked, total) }));

		expectRing(getProgress(container), checked, total);
	});

	it("does not render progress on a card for a task without criteria", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: [] }));

		expect(getProgress(container)).toBeNull();
	});

	it("renders the card ring in the header row after the priority and the ID", () => {
		const container = renderCard(createTask({ priority: "high", acceptanceCriteriaItems: createCriteria(4, 7) }));
		const header = getHeaderRow(container);
		const progress = getProgress(container);

		expect(container.querySelectorAll("[data-acceptance-criteria-progress]").length).toBe(1);
		expect(header.contains(progress)).toBe(true);
		expectRing(progress, 4, 7);
		expect(getPriorityName(header)).toBe("High priority");
		expect(header.textContent).toBe("task-14/7");
	});

	it("renders the card ring in the header row when the task has no priority", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: createCriteria(2, 3) }));
		const header = getHeaderRow(container);
		const progress = getProgress(container);

		expect(header.contains(progress)).toBe(true);
		expect(getPriorityName(header)).toBe("No priority");
		expect(header.textContent).toBe("task-12/3");
	});

	it("shows only the priority and the ID in the header row when the task has no criteria", () => {
		const container = renderCard(createTask({ priority: "medium" }));
		const header = getHeaderRow(container);

		expect(getProgress(container)).toBeNull();
		expect(getPriorityName(header)).toBe("Medium priority");
		expect(header.textContent).toBe("task-1");
	});

	it("renders a partial progress ring at list density in a list row", () => {
		const container = renderList(createTask({ acceptanceCriteriaItems: createCriteria(4, 7) }));
		const progress = getProgress(container);

		expect(progress).toBeTruthy();
		expect(progress?.dataset.density).toBe("list");
		expect(progress?.querySelector("svg")?.getAttribute("class")).toContain("h-3.5 w-3.5");
		expect(getListRow(container, "task-1").contains(progress)).toBe(true);
		expectRing(progress, 4, 7);
	});

	it("keeps an all-checked task visibly In Progress in the list", () => {
		const container = renderList(createTask({ acceptanceCriteriaItems: createCriteria(3, 3) }));
		const row = getListRow(container, "task-1");

		expectRing(getProgress(container), 3, 3);
		expect(row.querySelector("[role='img'][aria-label='In Progress']")).toBeTruthy();
	});

	it.each(statusCases)("renders the list ring in the %s status (%s)", (_position, status, checked, total) => {
		const container = renderList(createTask({ status, acceptanceCriteriaItems: createCriteria(checked, total) }));
		const row = getListRow(container, "task-1");

		expectRing(getProgress(container), checked, total);
		expect(row.querySelector(`[role='img'][aria-label='${status}']`)).toBeTruthy();
	});

	it("renders no ring in a list row without criteria", () => {
		const container = renderList(createTask({ acceptanceCriteriaItems: [] }));

		expect(getListRow(container, "task-1")).toBeTruthy();
		expect(getProgress(container)).toBeNull();
	});

	it("derives progress again when the task criteria change", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: createCriteria(2, 5) }));
		expectRing(getProgress(container), 2, 5);

		act(() => {
			activeRoot?.render(
				<MemoryRouter initialEntries={["/board"]}>
					<TaskCard
						task={createTask({ acceptanceCriteriaItems: createCriteria(4, 5) })}
						onOpenTask={() => {}}
						{...STANDALONE_CARD_NESTING}
					/>
				</MemoryRouter>,
			);
		});

		expectRing(getProgress(container), 4, 5);
	});
});
