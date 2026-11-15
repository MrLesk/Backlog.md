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
	createTask({ id: "task-101", title: "Web task", project: "Web" }),
	createTask({ id: "task-102", title: "API task", project: "API" }),
	createTask({ id: "task-103", title: "Unprojected task" }),
];

let activeRoot: Root | null = null;
const originalFetch = globalThis.fetch;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
};

const LocationSearch = () => {
	const location = useLocation();
	return <output data-testid="location-search">{location.search}</output>;
};

const renderTaskList = (initialEntries: string[] | undefined, availableProjects: string[] | undefined): HTMLElement => {
	setupDom();
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<MemoryRouter initialEntries={initialEntries}>
				<TaskList
					tasks={tasks}
					availableStatuses={["To Do", "In Progress", "Done"]}
					availableLabels={[]}
					availableMilestones={[]}
					availableProjects={availableProjects}
					milestoneEntities={[]}
					archivedMilestones={[]}
					onEditTask={() => {}}
					onNewTask={() => {}}
				/>
				<LocationSearch />
			</MemoryRouter>,
		);
	});
	return container;
};

const getProjectSelect = (container: HTMLElement): HTMLSelectElement | null =>
	container.querySelector("select[aria-label='Filter tasks by project']");

const getHeaders = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll("thead th")).map((th) => th.textContent?.replace(/[↕▲▼]/g, "").trim() ?? "");

const getRenderedTaskIds = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll("tbody tr td:first-child")).map((cell) => cell.textContent?.trim() ?? "");

const getLocationProject = (container: HTMLElement): string | null =>
	new URLSearchParams(container.querySelector("[data-testid='location-search']")?.textContent ?? "").get("project");

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

afterEach(() => {
	globalThis.fetch = originalFetch;
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("TaskList project filter and column", () => {
	it("renders no project filter or Project column when no projects are configured", () => {
		const container = renderTaskList(undefined, undefined);

		expect(getProjectSelect(container)).toBeNull();
		expect(getHeaders(container)).not.toContain("Project");
		expect(container.querySelector("[data-task-project]")).toBeNull();
		expect(getRenderedTaskIds(container)).toEqual(["task-103", "task-102", "task-101"]);
	});

	it("clears a project URL value when no projects are configured", async () => {
		const container = renderTaskList(["/?project=Web"], []);
		await waitFor(() => getLocationProject(container) === null);

		expect(getLocationProject(container)).toBeNull();
		expect(getRenderedTaskIds(container)).toEqual(["task-103", "task-102", "task-101"]);
	});

	it("shows a Project column with each task's project", () => {
		const container = renderTaskList(undefined, ["Web", "API"]);
		const headers = getHeaders(container);

		expect(headers).toContain("Project");
		expect(headers.indexOf("Project")).toBe(headers.indexOf("Milestone") - 1);
		const [headerTable, bodyTable] = Array.from(container.querySelectorAll("table"));
		expect(headerTable?.querySelectorAll("col")).toHaveLength(headers.length);
		expect(bodyTable?.querySelectorAll("col")).toHaveLength(headers.length);
		expect(container.querySelector("tbody tr")?.querySelectorAll("td")).toHaveLength(headers.length);

		const projectCells = Array.from(container.querySelectorAll("tbody tr")).map(
			(row) => row.querySelectorAll("td")[headers.indexOf("Project")]?.textContent?.trim(),
		);
		expect(projectCells).toEqual(["—", "API", "Web"]);
	});

	it("sorts by the Project column", async () => {
		const container = renderTaskList(undefined, ["Web", "API"]);
		const projectButton = Array.from(container.querySelectorAll("thead button")).find(
			(button) => button.textContent?.replace(/[↕▲▼]/g, "").trim() === "Project",
		);
		expect(projectButton).toBeTruthy();

		await act(async () => {
			projectButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});

		expect(getRenderedTaskIds(container)).toEqual(["task-103", "task-102", "task-101"]);
		expect(container.querySelector("th[aria-sort='ascending']")?.textContent).toContain("Project");
	});

	it("filters by project, keeps it in the URL, and shows every task for All projects", async () => {
		const container = renderTaskList(undefined, ["Web", "API"]);
		const projectSelect = getProjectSelect(container) as HTMLSelectElement;
		expect(projectSelect).toBeTruthy();
		expect(Array.from(projectSelect.options).map((option) => option.textContent)).toEqual([
			"All projects",
			"Web",
			"API",
		]);

		await setSelectValue(projectSelect, "Web");
		await waitFor(() => getRenderedTaskIds(container).join(",") === "task-101");
		expect(getRenderedTaskIds(container)).toEqual(["task-101"]);
		expect(getLocationProject(container)).toBe("Web");

		await setSelectValue(projectSelect, "");
		await waitFor(() => getRenderedTaskIds(container).length === 3);
		expect(getRenderedTaskIds(container)).toEqual(["task-103", "task-102", "task-101"]);
		expect(getLocationProject(container)).toBeNull();
	});

	it("canonicalizes mixed-case project URL values and resets on Clear filters", async () => {
		const container = renderTaskList(["/?project=api"], ["Web", "API"]);
		await waitFor(() => getLocationProject(container) === "API");

		expect(getLocationProject(container)).toBe("API");
		expect(getProjectSelect(container)?.value).toBe("API");
		expect(getRenderedTaskIds(container)).toEqual(["task-102"]);

		const clearButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Clear filters",
		);
		expect(clearButton).toBeTruthy();
		await act(async () => {
			clearButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});

		expect(getLocationProject(container)).toBeNull();
		expect(getProjectSelect(container)?.value).toBe("");
		expect(getRenderedTaskIds(container)).toEqual(["task-103", "task-102", "task-101"]);
	});

	it("clears unsupported project URL values", async () => {
		const container = renderTaskList(["/?project=mobile"], ["Web", "API"]);
		await waitFor(() => getLocationProject(container) === null);

		expect(getLocationProject(container)).toBeNull();
		expect(getProjectSelect(container)?.value).toBe("");
		expect(getRenderedTaskIds(container)).toEqual(["task-103", "task-102", "task-101"]);
	});

	it("applies the project filter to API-backed filter results", async () => {
		const fetchCalls: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
			fetchCalls.push(url);
			return {
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => tasks.map((task) => ({ type: "task", score: 0, task })),
			} as Response;
		}) as typeof fetch;

		const container = renderTaskList(["/?status=To%20Do&project=Web"], ["Web", "API"]);
		await waitFor(() => fetchCalls.length > 0 && getRenderedTaskIds(container).join(",") === "task-101");

		expect(fetchCalls.length).toBeGreaterThan(0);
		expect(new URL(fetchCalls[0] ?? "", "http://localhost").searchParams.getAll("status")).toEqual(["To Do"]);
		expect(getRenderedTaskIds(container)).toEqual(["task-101"]);
	});
});
