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
		activeRoot?.render(<TaskCard task={task} onUpdate={() => {}} onEdit={() => {}} />);
	});
	return container;
};

const rerenderList = (...tasks: Task[]) => {
	act(() => {
		activeRoot?.render(
			<MemoryRouter>
				<TaskList
					tasks={tasks}
					availableStatuses={STATUSES}
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
};

const renderList = (...tasks: Task[]): HTMLElement => {
	const container = setupDom();
	rerenderList(...tasks);
	return container;
};

const getProgress = (container: HTMLElement): HTMLElement | null =>
	container.querySelector("[data-acceptance-criteria-progress]");

// The header row is the metadata line that precedes the card title. jsdom has no layout, so the
// check pins the class that lets the row wrap instead of squeezing the type and project badges.
const getHeaderRow = (container: HTMLElement): HTMLElement => {
	const header = container.querySelector("h4")?.previousElementSibling as HTMLElement | null;
	expect(header?.className).toContain("flex-wrap");
	return header as HTMLElement;
};

// The title button of one All Tasks row. The ring slot, when the list has one, is the element
// right before it in the title cell's flex row.
const getListTitle = (container: HTMLElement, taskId: string): HTMLElement => {
	const title = container.querySelector<HTMLElement>(`tbody button[aria-label^="Open ${taskId}:"]`);
	expect(title?.parentElement?.className).toContain("flex");
	return title as HTMLElement;
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
		const card = container.querySelector("[role='button']");

		expect(card?.getAttribute("aria-label")).toBe("Open task-1: Task summary. Acceptance criteria progress: 4 of 7");
	});

	it.each(statusCases)("renders the card ring in the %s status (%s)", (_position, status, checked, total) => {
		const container = renderCard(createTask({ status, acceptanceCriteriaItems: createCriteria(checked, total) }));

		expectRing(getProgress(container), checked, total);
	});

	it("does not render progress on a card for a task without criteria", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: [] }));

		expect(getProgress(container)).toBeNull();
	});

	it("renders the card ring in the header row beside the priority badge", () => {
		const container = renderCard(createTask({ priority: "high", acceptanceCriteriaItems: createCriteria(4, 7) }));
		const header = getHeaderRow(container);
		const progress = getProgress(container);

		expect(container.querySelectorAll("[data-acceptance-criteria-progress]").length).toBe(1);
		expect(header.contains(progress)).toBe(true);
		expectRing(progress, 4, 7);

		// The ring joins the priority badge in a group that never shrinks. The group is pushed flush
		// right, so the badge sits where cards without progress already put it: on the first header
		// line, or alone on a second one when the id and badges need the first.
		const rightGroup = header.lastElementChild as HTMLElement;
		expect(rightGroup.className).toContain("shrink-0");
		expect(rightGroup.className).toContain("ml-auto");
		expect(rightGroup.contains(progress)).toBe(true);
		expect(rightGroup.lastElementChild?.textContent).toBe("High");
	});

	it("renders the card ring in the header row when the task has no priority", () => {
		const container = renderCard(createTask({ acceptanceCriteriaItems: createCriteria(2, 3) }));
		const header = getHeaderRow(container);
		const progress = getProgress(container);

		expect(header.contains(progress)).toBe(true);
		expect(header.textContent).toBe("task-12/3");
	});

	it("keeps the priority badge alone in the header row when the task has no criteria", () => {
		const container = renderCard(createTask({ priority: "medium" }));
		const header = getHeaderRow(container);

		expect(getProgress(container)).toBeNull();
		expect(header.textContent).toBe("task-1Med");
	});

	it("renders nothing beside the id when the task has neither criteria nor priority", () => {
		const container = renderCard(createTask());
		const header = getHeaderRow(container);

		expect(getProgress(container)).toBeNull();
		expect(header.children.length).toBe(1);
		expect(header.textContent).toBe("task-1");
	});

	it("renders a partial progress ring at list density in the wide list summary", () => {
		const container = renderList(createTask({ acceptanceCriteriaItems: createCriteria(4, 7) }));
		const progress = getProgress(container);

		expect(progress).toBeTruthy();
		expect(progress?.dataset.density).toBe("list");
		expect(progress?.querySelector("svg")?.getAttribute("class")).toContain("h-3.5 w-3.5");
		expectRing(progress, 4, 7);
	});

	it("renders the list ring on the title line, before the title", () => {
		const container = renderList(createTask({ acceptanceCriteriaItems: createCriteria(4, 7) }));
		const title = getListTitle(container, "task-1");
		const slot = title.previousElementSibling;

		// The ring shares the title's flex row, so it adds no line to the row. The slot never
		// shrinks, so a long title is what truncates.
		expect(slot?.contains(getProgress(container))).toBe(true);
		expect(slot?.className).toContain("shrink-0");
		expect(title.className).toContain("truncate");
		expect(title.getAttribute("aria-label")).toBe("Open task-1: Task summary");
	});

	it("keeps titles aligned in a mixed list by giving every row the ring slot", () => {
		const container = renderList(
			createTask({ id: "task-1", acceptanceCriteriaItems: createCriteria(1, 2) }),
			createTask({ id: "task-2" }),
		);
		const slotWithRing = getListTitle(container, "task-1").previousElementSibling;
		const slotWithoutRing = getListTitle(container, "task-2").previousElementSibling;

		expect(container.querySelectorAll("[data-acceptance-criteria-progress]").length).toBe(1);
		expect(slotWithRing?.className).toContain("min-w-12");
		expect(slotWithoutRing?.className).toBe(slotWithRing?.className);
		expect(slotWithoutRing?.childElementCount).toBe(0);
	});

	it("shares enough ring space for larger counts and restores small-count spacing when they leave", () => {
		const smallTasks = [
			createTask({ id: "task-1", acceptanceCriteriaItems: createCriteria(1, 2) }),
			createTask({ id: "task-2", acceptanceCriteriaItems: createCriteria(99, 99) }),
			createTask({ id: "task-3" }),
		];
		const container = renderList(...smallTasks);
		const getSlot = (id: string) => getListTitle(container, id).previousElementSibling as HTMLElement;
		const smallWidth = getSlot("task-1").style.width;
		expect(smallWidth).not.toBe("");

		for (const total of [100, 1000]) {
			rerenderList(...smallTasks, createTask({ id: "task-4", acceptanceCriteriaItems: createCriteria(total, total) }));
			const wideWidth = getSlot("task-4").style.width;
			expect(wideWidth).not.toBe(smallWidth);
			for (const id of ["task-1", "task-2", "task-3", "task-4"]) {
				expect(getSlot(id).style.width).toBe(wideWidth);
			}
			expectRing(getSlot("task-1").querySelector("[data-acceptance-criteria-progress]"), 1, 2);
			expectRing(getSlot("task-2").querySelector("[data-acceptance-criteria-progress]"), 99, 99);
			expect(getSlot("task-3").childElementCount).toBe(0);
			expectRing(getSlot("task-4").querySelector("[data-acceptance-criteria-progress]"), total, total);

			rerenderList(...smallTasks);
			expect(container.querySelector('button[aria-label^="Open task-4:"]')).toBeNull();
			for (const task of smallTasks) {
				expect(getSlot(task.id).style.width).toBe(smallWidth);
			}
		}
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

	it.each(statusCases)("renders the list ring in the %s status (%s)", (_position, status, checked, total) => {
		const container = renderList(createTask({ status, acceptanceCriteriaItems: createCriteria(checked, total) }));

		expectRing(getProgress(container), checked, total);
		expect(container.querySelector("tbody tr td:nth-child(3)")?.textContent?.trim()).toBe(status);
	});

	it("renders no ring and reserves no slot in a list without criteria", () => {
		const container = renderList(createTask({ acceptanceCriteriaItems: [] }));

		expect(getProgress(container)).toBeNull();
		expect(getListTitle(container, "task-1").previousElementSibling).toBeNull();
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
