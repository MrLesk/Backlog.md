import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard.tsx";
import TaskList from "../web/components/TaskList.tsx";

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
		activeRoot?.render(<TaskCard task={task} onUpdate={() => {}} onEdit={() => {}} />);
	});
	return container;
};

const renderList = (task: Task): HTMLElement => {
	const container = setupDom();
	act(() => {
		activeRoot?.render(
			<MemoryRouter>
				<TaskList
					tasks={[task]}
					availableStatuses={["To Do", "In Progress", "Done"]}
					availableLabels={[]}
					availableMilestones={[]}
					milestoneEntities={[]}
					archivedMilestones={[]}
					onEditTask={() => {}}
					onNewTask={() => {}}
				/>
			</MemoryRouter>,
		);
	});
	return container;
};

const getProgress = (container: HTMLElement): HTMLElement | null =>
	container.querySelector("[data-acceptance-criteria-progress]");

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
		const card = container.querySelector("[role='button']");

		expect(card?.getAttribute("aria-label")).toBe("Open task-1: Task summary. Acceptance criteria progress: 4 of 7");
	});

	it("does not render progress for an In Progress task without criteria", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: [] }));

		expect(getProgress(container)).toBeNull();
	});

	it("renders a partial progress ring at list density in the wide list summary", () => {
		const container = renderList(createTask({ acceptanceCriteriaItems: createCriteria(4, 7) }));
		const progress = getProgress(container);

		expect(progress).toBeTruthy();
		expect(progress?.dataset.density).toBe("list");
		expect(progress?.querySelector("svg")?.getAttribute("class")).toContain("h-3.5 w-3.5");
		expectRing(progress, 4, 7);
	});

	it("keeps an all-checked task visibly In Progress in the wide list summary", () => {
		const container = renderList(createTask({ acceptanceCriteriaItems: createCriteria(3, 3) }));
		const progress = getProgress(container);
		const statusCell = container.querySelector("tbody tr td:nth-child(3)");

		expect(progress).toBeTruthy();
		expect(progress?.dataset.density).toBe("list");
		expectRing(progress, 3, 3);
		expect(progress?.className).toContain("text-blue-600");
		expect(statusCell?.textContent?.trim()).toBe("In Progress");
	});

	it("derives progress again when the task criteria change", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: createCriteria(2, 5) }));
		expectRing(getProgress(container), 2, 5);

		act(() => {
			activeRoot?.render(
				<TaskCard
					task={createTask({ acceptanceCriteriaItems: createCriteria(4, 5) })}
					onUpdate={() => {}}
					onEdit={() => {}}
				/>,
			);
		});

		expectRing(getProgress(container), 4, 5);
	});
});
