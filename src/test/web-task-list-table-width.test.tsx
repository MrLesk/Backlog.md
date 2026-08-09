import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskList from "../web/components/TaskList.tsx";

// jsdom performs no layout, so these tests cannot show that the rendered table fits a
// viewport or that no scrollbar appears. They pin the width budget the browser then has
// to honour: every column still renders, only Title flexes, and the table's declared
// minimum width stays inside the narrowest laptop content area we support.
//
// Narrowest supported case: a 1440px viewport with the side navigation expanded leaves
// 1440 - 320 (sidebar) - 1 (border) - ~15 (vertical scrollbar) - 32 (page padding) ~= 1072px,
// which is 67rem. 66rem keeps a rem of slack.
const CONTENT_BUDGET_REM = 66;

const EXPECTED_HEADERS = [
	"ID",
	"Title",
	"Status",
	"Priority",
	"Ordinal",
	"Labels",
	"Assignee",
	"Milestone",
	"Created",
];

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

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
};

const renderTaskList = (): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<MemoryRouter>
				<TaskList
					tasks={[createTask({ id: "task-101", title: "Fit the task table", labels: ["ui"], assignee: ["@alex"] })]}
					availableStatuses={["To Do", "In Progress", "Done"]}
					availableLabels={["ui"]}
					availableMilestones={[]}
					milestoneEntities={[]}
					archivedMilestones={[]}
					onEditTask={() => {}}
					onNewTask={() => {}}
				/>
			</MemoryRouter>,
		);
	});
	return container as HTMLElement;
};

const getTables = (container: HTMLElement): HTMLTableElement[] =>
	Array.from(container.querySelectorAll("table")) as HTMLTableElement[];

const getColumnWidths = (table: HTMLTableElement): (string | null)[] =>
	Array.from(table.querySelectorAll("col")).map((col) => (col as HTMLElement).style.width || null);

const parseRem = (value: string): number => {
	expect(value.endsWith("rem")).toBe(true);
	return Number.parseFloat(value);
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("TaskList table width budget", () => {
	it("renders every column", () => {
		const container = renderTaskList();
		const headers = Array.from(container.querySelectorAll("thead th")).map(
			(th) => th.textContent?.replace(/[↕▲▼]/g, "").trim() ?? "",
		);

		expect(headers).toEqual(EXPECTED_HEADERS);
		expect(container.querySelectorAll("tbody tr td")).toHaveLength(EXPECTED_HEADERS.length);
	});

	it("leaves Title as the only flexible column", () => {
		const container = renderTaskList();
		const widths = getColumnWidths(getTables(container)[0] as HTMLTableElement);

		expect(widths).toHaveLength(EXPECTED_HEADERS.length);
		expect(widths.filter((width) => width === null)).toEqual([null]);
		expect(widths[EXPECTED_HEADERS.indexOf("Title")]).toBeNull();
	});

	it("keeps the header and body tables on the same column widths", () => {
		const container = renderTaskList();
		const [header, body] = getTables(container);

		expect(getColumnWidths(header as HTMLTableElement)).toEqual(getColumnWidths(body as HTMLTableElement));
		expect((header as HTMLTableElement).style.minWidth).toBe((body as HTMLTableElement).style.minWidth);
	});

	it("keeps the table minimum width inside the narrowest laptop content area", () => {
		const container = renderTaskList();
		const table = getTables(container)[0] as HTMLTableElement;
		const minWidthRem = parseRem(table.style.minWidth);
		const fixedWidthsRem = getColumnWidths(table)
			.filter((width): width is string => width !== null)
			.map(parseRem);
		const fixedTotalRem = fixedWidthsRem.reduce((total, width) => total + width, 0);

		expect(minWidthRem).toBeLessThanOrEqual(CONTENT_BUDGET_REM);
		// The minimum has to come from the columns themselves, plus room for the title.
		expect(minWidthRem).toBeGreaterThan(fixedTotalRem);
	});
});
