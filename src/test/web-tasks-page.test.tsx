import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import TasksPage from "../web/components/TasksPage.tsx";
import { apiClient } from "../web/lib/api.ts";
import type { TaskLayout } from "../web/lib/task-view.ts";
import { pinTimeZone } from "./pin-timezone.ts";
import { ORDER_FIXTURE_PRIORITIES, ORDER_FIXTURE_TASKS } from "./task-list-order-fixture.ts";

const STATUSES = ["To Do", "In Progress", "Done"];
const TYPES = ["Bug", "Docs", "Enhancement"];
const PROJECTS = ["Web", "API"];
const MILESTONES: Milestone[] = [
	{ id: "m-1", title: "Release 1", description: "", rawContent: "" },
	{ id: "m-2", title: "Release 2", description: "", rawContent: "" },
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

// Every filter keeps a different set of these tasks, so a filter one layout ignores changes what it shows.
const TASKS: Task[] = [
	createTask({
		id: "task-101",
		title: "Fix login bug",
		assignee: ["alice"],
		labels: ["bug"],
		milestone: "m-1",
		priority: "high",
		type: "Bug",
		project: "Web",
	}),
	createTask({
		id: "task-102",
		title: "Write docs",
		status: "In Progress",
		assignee: ["bob"],
		labels: ["docs"],
		milestone: "m-2",
		priority: "medium",
		type: "Docs",
		project: "API",
	}),
	createTask({
		id: "task-103",
		title: "Improve board",
		status: "In Progress",
		assignee: ["alice"],
		labels: ["enhancement"],
		milestone: "m-1",
		priority: "low",
		type: "Enhancement",
	}),
	createTask({ id: "task-104", title: "Triage unassigned issue", status: "Done", labels: ["bug"], priority: "medium" }),
];

interface PageOptions {
	tasks?: Task[];
	statuses?: string[];
	priorities?: string[];
	types?: string[];
	projects?: string[];
	isLoading?: boolean;
	dateFormat?: string;
	onRefreshData?: () => Promise<void>;
	onTasksUpdated?: (tasks: Task[], requestTask: Task) => void;
}

let activeRoot: Root | null = null;

const renderPage = (path: string, options: PageOptions = {}): HTMLElement => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;

	const page = (layout: TaskLayout) => (
		<TasksPage
			layout={layout}
			tasks={options.tasks ?? TASKS}
			statuses={options.statuses ?? STATUSES}
			availableLabels={["Bug", "docs", "enhancement"]}
			milestones={MILESTONES.map((milestone) => milestone.id)}
			milestoneEntities={MILESTONES}
			archivedMilestones={[]}
			availablePriorities={options.priorities}
			availableTypes={options.types ?? TYPES}
			availableProjects={options.projects ?? PROJECTS}
			isLoading={options.isLoading ?? false}
			hideEmptyColumns={false}
			dateFormat={options.dateFormat}
			onEditTask={() => {}}
			onNewTask={() => {}}
			onRefreshData={options.onRefreshData ?? (async () => {})}
			onTasksUpdated={options.onTasksUpdated ?? (() => {})}
		/>
	);
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<BrowserRouter>
				<Routes>
					<Route path="/tasks" element={page("list")} />
					<Route path="/board" element={page("board")} />
				</Routes>
			</BrowserRouter>,
		);
	});
	return container;
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

const click = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
};

const setSelectValue = async (select: HTMLSelectElement, value: string) => {
	await act(async () => {
		Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set?.call(select, value);
		select.dispatchEvent(new window.Event("change", { bubbles: true }));
		await Promise.resolve();
	});
};

const typeInto = async (input: HTMLInputElement, value: string) => {
	await act(async () => {
		Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set?.call(input, value);
		input.dispatchEvent(new window.Event("input", { bubbles: true }));
		await Promise.resolve();
	});
};

const WAIT_FOR_TIMEOUT_MS = 4000;

const waitFor = async (predicate: () => boolean) => {
	const deadline = Date.now() + WAIT_FOR_TIMEOUT_MS;
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error(`Timed out after ${WAIT_FOR_TIMEOUT_MS}ms waiting for ${predicate}`);
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
		});
	}
};

const button = (container: HTMLElement, name: string): HTMLButtonElement => {
	const match = Array.from(container.querySelectorAll("button")).find(
		(element) => element.getAttribute("aria-label") === name || element.textContent?.trim() === name,
	);
	expect(match).toBeTruthy();
	return match as HTMLButtonElement;
};

const layoutLink = (container: HTMLElement, name: "List" | "Board"): HTMLAnchorElement => {
	const link = Array.from(container.querySelectorAll("nav[aria-label='Layout'] a")).find(
		(element) => element.textContent?.trim() === name,
	);
	expect(link).toBeTruthy();
	return link as HTMLAnchorElement;
};

const select = (container: HTMLElement, name: string): HTMLSelectElement => {
	const match = container.querySelector(`select[aria-label='${name}']`);
	expect(match).toBeTruthy();
	return match as HTMLSelectElement;
};

const idOf = (openLabel: string | null): string => openLabel?.match(/^Open ([^:]+):/)?.[1] ?? "";

/** The task IDs the list shows, group by group, after opening every closed group. */
const listedTaskIds = async (container: HTMLElement): Promise<string[]> => {
	for (const header of Array.from(container.querySelectorAll("h3 button[aria-expanded='false']"))) {
		await click(header);
	}
	return Array.from(container.querySelectorAll("li button[aria-label^='Open ']"), (title) =>
		idOf(title.getAttribute("aria-label")),
	);
};

/** The task IDs of the cards on the board, column by column: each card's title is the button that opens it. */
const boardTaskIds = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll("[role='group'] h4 button[aria-label^='Open ']"), (title) =>
		idOf(title.getAttribute("aria-label")),
	);

const search = () => new URLSearchParams(window.location.search);

describe("Tasks page layouts", () => {
	it("switches between List and Board without losing the filters, and remembers the layout", async () => {
		const query = "?type=Bug&label=bug&lane=milestone";
		const container = renderPage(`/tasks${query}`);
		expect(await listedTaskIds(container)).toEqual(["task-101"]);
		expect(localStorage.getItem("backlog.tasks.layout")).toBe("list");

		await click(layoutLink(container, "Board"));
		expect(window.location.pathname).toBe("/board");
		expect(window.location.search).toBe(query);
		expect(layoutLink(container, "Board").getAttribute("aria-current")).toBe("page");
		expect(boardTaskIds(container)).toEqual(["task-101"]);
		expect(localStorage.getItem("backlog.tasks.layout")).toBe("board");

		await click(layoutLink(container, "List"));
		expect(window.location.pathname).toBe("/tasks");
		expect(window.location.search).toBe(query);
	});

	it("restores the layout and the filters from a URL opened afresh", async () => {
		const board = renderPage("/board?assignee=alice&priority=high");
		expect(boardTaskIds(board)).toEqual(["task-101"]);
		const filterButton = board.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement;
		expect(filterButton.textContent).toBe("Filter2 active");
		await click(filterButton);
		expect(select(board, "Filter by assignee").value).toBe("alice");
		expect(select(board, "Filter by priority").value).toBe("high");
		act(() => activeRoot?.unmount());

		const list = renderPage("/tasks?status=In%20Progress");
		expect(await listedTaskIds(list)).toEqual(["task-102", "task-103"]);
		await click(list.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement);
		expect(list.querySelector("button[aria-controls='task-filters-status']")?.textContent).toContain("In Progress");
	});

	const filterCases: Array<[filter: string, query: string, expected: string[]]> = [
		["status", "status=In%20Progress", ["task-102", "task-103"]],
		["excluded status", "excludeStatus=In%20Progress", ["task-101", "task-104"]],
		["assignee", "assignee=alice", ["task-101", "task-103"]],
		["unassigned", "assignee=__unassigned__", ["task-104"]],
		["label in its configured casing", "label=Bug", ["task-101", "task-104"]],
		["type", "type=Docs", ["task-102"]],
		["project", "project=Web", ["task-101"]],
		["priority", "priority=medium", ["task-102", "task-104"]],
		["milestone", "milestone=m-1", ["task-101", "task-103"]],
		["no milestone", "milestone=__none", ["task-104"]],
	];

	const expectSameTasksInBothLayouts = async (query: string, expected: string[], tasks?: Task[]) => {
		const container = renderPage(`/tasks?${query}`, { tasks });
		expect((await listedTaskIds(container)).sort()).toEqual(expected);

		await click(layoutLink(container, "Board"));
		expect(boardTaskIds(container).sort()).toEqual(expected);
		return container;
	};

	it.each(filterCases)("shows the same tasks in both layouts for the %s filter", async (_filter, query, expected) => {
		await expectSameTasksInBothLayouts(query, expected);
	});

	// Labels and assignees that once made the board and the list disagree.
	const MATCHING_TASKS: Task[] = [
		createTask({ id: "task-201", title: "Labelled bug", labels: ["bug"], assignee: ["@Alex"] }),
		createTask({ id: "task-202", title: "Labelled docs", status: "In Progress", labels: ["docs"], assignee: ["@alex"] }),
		createTask({ id: "task-203", title: "Labelled support", status: "Done", labels: ["support"], assignee: ["@alexa"] }),
		createTask({ id: "task-204", title: "Labelled otherwise", status: "Done", labels: ["frontend"] }),
	];

	it("reads every label of the old comma-separated form in both layouts", async () => {
		await expectSameTasksInBothLayouts("labels=bug&labels=docs,support", ["task-201", "task-202", "task-203"], MATCHING_TASKS);
	});

	it("matches an assignee in any letter case, but only the whole name, in both layouts", async () => {
		const container = await expectSameTasksInBothLayouts("assignee=%40Alex", ["task-201", "task-202"], MATCHING_TASKS);

		// One option per name: @Alex and @alex select the same tasks, @alexa is another person.
		await click(container.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement);
		const assignee = select(container, "Filter by assignee");
		expect(Array.from(assignee.options, (option) => option.textContent)).toEqual([
			"All",
			"Unassigned",
			"@Alex",
			"@alexa",
		]);
		expect(assignee.value).toBe("@Alex");
	});

	it("searches task descriptions through the shared task search in both layouts", async () => {
		const container = renderPage("/tasks", { tasks: ORDER_FIXTURE_TASKS, priorities: ORDER_FIXTURE_PRIORITIES });
		const field = container.querySelector("input[aria-label='Search tasks']") as HTMLInputElement;

		// Only the descriptions of the To Do tasks say "orchard"; a search of titles alone would find nothing.
		await typeInto(field, "orchard");
		expect(search().get("search")).toBe("orchard");
		expect(await listedTaskIds(container)).toEqual(["TASK-3", "TASK-1", "TASK-6", "TASK-5"]);

		await click(layoutLink(container, "Board"));
		expect(boardTaskIds(container).sort()).toEqual(["TASK-1", "TASK-3", "TASK-5", "TASK-6"]);
	});

	it("writes the configured spelling of filter values once the configuration is known", async () => {
		const container = renderPage(
			"/board?type=customer%20request&priority=VeRy%20HiGh&status=in%20progress&labels=bug,docs&excludeStatuses=done",
			{ types: ["Bug", "Customer Request"], priorities: ["Very High", "High", "Medium", "Low"] },
		);

		await waitFor(() => search().get("type") === "Customer Request");
		expect(search().get("priority")).toBe("very high");
		expect(search().getAll("status")).toEqual(["In Progress"]);
		expect(search().getAll("label")).toEqual(["bug", "docs"]);
		expect(search().getAll("excludeStatus")).toEqual(["Done"]);
		expect(search().has("labels")).toBe(false);
		expect(search().has("excludeStatuses")).toBe(false);
		await click(container.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement);
		const priority = select(container, "Filter by priority");
		expect(Array.from(priority.options, (option) => option.textContent)).toEqual([
			"All",
			"Very High",
			"High",
			"Medium",
			"Low",
		]);
		expect(priority.value).toBe("very high");
	});

	it("drops filter values that are not configured", async () => {
		const container = renderPage("/board?type=unsupported&priority=urgent&project=mobile&view=compact");

		await waitFor(() => window.location.search === "?view=compact");
		expect(boardTaskIds(container).sort()).toEqual(["task-101", "task-102", "task-103", "task-104"]);
	});

	it("keeps a project that is not resolved yet when a filter changes before the configuration loads", async () => {
		const container = renderPage("/tasks?project=Web&status=In%20Progress", { projects: [], isLoading: true });

		await typeInto(container.querySelector("input[aria-label='Search tasks']") as HTMLInputElement, "doc");
		await click(container.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement);
		await setSelectValue(select(container, "Filter by priority"), "low");

		expect(window.location.search).toBe("?project=Web&status=In+Progress&search=doc&priority=low");
	});

	it("says when the filters match nothing, in both layouts and with milestone lanes", async () => {
		const container = renderPage("/tasks?search=zzqqxx&lane=milestone");
		expect(container.textContent).toContain("No tasks match these filters");

		await click(layoutLink(container, "Board"));
		expect(container.textContent).toContain("No tasks match these filters");
		expect(boardTaskIds(container)).toEqual([]);
	});

	it("clears every filter and the search but keeps the lanes and unrelated parameters", async () => {
		const container = renderPage(
			"/board?assignee=alice&label=bug&priority=high&type=Bug&search=login&lane=milestone&view=compact",
		);
		expect(boardTaskIds(container)).toEqual(["task-101"]);

		await click(button(container, "Clear filters"));

		expect(window.location.search).toBe("?lane=milestone&view=compact");
		expect(boardTaskIds(container).sort()).toEqual(["task-101", "task-102", "task-103", "task-104"]);
	});

	it("writes the choices of the filter panel to the URL", async () => {
		const container = renderPage("/tasks");
		const filterButton = container.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement;
		expect(filterButton.getAttribute("aria-expanded")).toBe("false");
		await click(filterButton);

		await setSelectValue(select(container, "Filter by type"), "Docs");
		expect(search().get("type")).toBe("Docs");
		expect(await listedTaskIds(container)).toEqual(["task-102"]);
		expect(filterButton.textContent).toBe("Filter1 active");
		await setSelectValue(select(container, "Filter by type"), "");

		const choose = async (menu: string, option: string) => {
			const toggle = container.querySelector(`button[aria-controls='task-filters-${menu}']`) as HTMLButtonElement;
			if (toggle.getAttribute("aria-expanded") === "false") await click(toggle);
			const checkbox = Array.from(container.querySelectorAll(`#task-filters-${menu} label`))
				.find((label) => label.textContent?.trim() === option)
				?.querySelector("input");
			expect(checkbox).toBeTruthy();
			await click(checkbox as HTMLInputElement);
		};
		await choose("status", "To Do");
		await choose("status", "Done");
		expect(search().getAll("status")).toEqual(["To Do", "Done"]);
		expect(await listedTaskIds(container)).toEqual(["task-101", "task-104"]);

		await choose("labels", "Bug");
		await choose("labels", "enhancement");
		expect(search().getAll("label")).toEqual(["Bug", "enhancement"]);
		expect(container.querySelector("button[aria-controls='task-filters-labels']")?.textContent).toContain("2 selected");
		await click(button(container, "Clear label filter"));
		expect(search().has("label")).toBe(false);
	});

	it("offers the Project filter only while projects are configured", async () => {
		const withProjects = renderPage("/tasks?project=Web");
		await click(withProjects.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement);
		expect(select(withProjects, "Filter by project").value).toBe("Web");
		act(() => activeRoot?.unmount());

		const withoutProjects = renderPage("/tasks", { projects: [] });
		await click(withoutProjects.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement);
		expect(withoutProjects.querySelector("select[aria-label='Filter by project']")).toBeNull();
	});
});

describe("Tasks page list", () => {
	const groupHeaders = (container: HTMLElement) =>
		Array.from(container.querySelectorAll("h3 button"), (header) => ({
			name: header.textContent ?? "",
			open: header.getAttribute("aria-expanded"),
		}));

	it("groups tasks by status in workflow order and keeps the order of `backlog task list` in each group", async () => {
		const container = renderPage("/tasks", { tasks: ORDER_FIXTURE_TASKS, priorities: ORDER_FIXTURE_PRIORITIES });

		// The final status starts closed: its header shows the count and no row is drawn.
		expect(groupHeaders(container)).toEqual([
			{ name: "To Do4", open: "true" },
			{ name: "In Progress1", open: "true" },
			{ name: "Done1", open: "false" },
		]);
		expect(container.textContent).not.toContain("Delta");

		// The same sections and order as `backlog task list --plain` prints for this fixture.
		expect(await listedTaskIds(container)).toEqual(["TASK-3", "TASK-1", "TASK-6", "TASK-5", "TASK-2", "TASK-4"]);
		expect(groupHeaders(container)[2]?.open).toBe("true");
	});

	it("opens the final status group when the Status filter selects it", () => {
		const container = renderPage("/tasks?status=Done", {
			tasks: ORDER_FIXTURE_TASKS,
			priorities: ORDER_FIXTURE_PRIORITIES,
		});

		expect(groupHeaders(container)).toEqual([{ name: "Done1", open: "true" }]);
		expect(container.querySelector("li button[aria-label^='Open TASK-4:']")).toBeTruthy();
	});

	it("names the status and priority marks of a row and shows the branch of a task from another branch", () => {
		const container = renderPage("/tasks", {
			tasks: [
				createTask({ id: "TASK-1", title: "Ranked", status: "In Progress", priority: "now" }),
				createTask({ id: "TASK-2", title: "Elsewhere", branch: "feature/login" }),
			],
			priorities: ORDER_FIXTURE_PRIORITIES,
		});
		const row = (id: string) =>
			container.querySelector(`li button[aria-label^='Open ${id}:']`)?.closest("li") as HTMLElement;
		const markNames = (id: string) =>
			Array.from(row(id).querySelectorAll("[role='img']"), (mark) => mark.getAttribute("aria-label"));

		expect(markNames("TASK-1")).toEqual(["now priority", "In Progress"]);
		expect(markNames("TASK-2")).toEqual(["No priority", "To Do"]);
		expect(row("TASK-2").textContent).toContain("Branch: feature/login");
	});
});

describe("Tasks page board", () => {
	// The cleanup preview renders stored timestamps in the viewer's timezone, so pin one.
	pinTimeZone("Asia/Tokyo");

	it("publishes every returned reorder task without a foreground refresh", async () => {
		const originalReorderTask = apiClient.reorderTask.bind(apiClient);
		const [sourceTask, siblingTask] = TASKS;
		if (!sourceTask || !siblingTask) throw new Error("Expected source and sibling tasks");
		const movedTask: Task = { ...sourceTask, status: "In Progress", ordinal: 2000 };
		const rebalancedSibling: Task = { ...siblingTask, ordinal: 3000 };
		let refreshes = 0;
		const publishedTasks: Task[] = [];
		apiClient.reorderTask = async () => ({
			success: true,
			task: movedTask,
			changedTasks: [rebalancedSibling, movedTask],
		});

		try {
			const container = renderPage("/board", {
				onRefreshData: async () => {
					refreshes += 1;
				},
				onTasksUpdated: (changedTasks) => publishedTasks.push(...changedTasks),
			});
			const targetColumn = Array.from(container.querySelectorAll("h3"))
				.find((heading) => heading.textContent === "In Progress")
				?.closest("[role='group']");
			const dropEvent = new window.Event("drop", { bubbles: true, cancelable: true });
			Object.defineProperty(dropEvent, "dataTransfer", {
				value: {
					getData: (type: string) => (type === "text/plain" ? movedTask.id : type === "text/status" ? "To Do" : ""),
				},
			});

			await act(async () => {
				targetColumn?.dispatchEvent(dropEvent);
				await Promise.resolve();
			});
			await waitFor(() => publishedTasks.length === 2);

			expect(publishedTasks).toEqual([rebalancedSibling, movedTask]);
			expect(refreshes).toBe(0);
		} finally {
			apiClient.reorderTask = originalReorderTask;
		}
	});

	it("shows only the milestone lanes that keep tasks under the active filters", async () => {
		const container = renderPage("/board?lane=milestone");
		expect(container.querySelector("[role='group'][aria-label='Release 1']")).toBeTruthy();
		expect(container.querySelector("[role='group'][aria-label='Release 2']")).toBeTruthy();

		await click(container.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement);
		await setSelectValue(select(container, "Filter by assignee"), "alice");

		expect(boardTaskIds(container).sort()).toEqual(["task-101", "task-103"]);
		expect(container.querySelector("[role='group'][aria-label='Release 2']")).toBeNull();
	});

	it("shows the cards of a collapsed lane once a filter leaves it as the only lane", async () => {
		const container = renderPage("/board?lane=milestone");
		const releaseOne = container.querySelector("[role='group'][aria-label='Release 1']") as HTMLElement;
		await click(releaseOne.querySelector("button[aria-expanded='true']") as HTMLButtonElement);
		expect(boardTaskIds(container)).not.toContain("task-101");

		await click(container.querySelector("button[aria-controls='task-filters']") as HTMLButtonElement);
		await setSelectValue(select(container, "Filter by milestone"), "m-1");

		expect(boardTaskIds(container).sort()).toEqual(["task-101", "task-103"]);
	});

	it("lets milestone lanes be turned off when no task has a milestone", async () => {
		const container = renderPage("/board?lane=milestone", {
			tasks: [createTask({ id: "task-1" }), createTask({ id: "task-2", status: "Done" })],
		});
		const lanes = button(container, "Milestone lanes");
		expect(lanes.getAttribute("aria-pressed")).toBe("true");
		expect(lanes.disabled).toBe(false);

		await click(lanes);

		expect(search().has("lane")).toBe(false);
		expect(lanes.getAttribute("aria-pressed")).toBe("false");
		expect(lanes.disabled).toBe(true);
	});

	it("keeps the milestone filter when the lanes change", async () => {
		const container = renderPage("/board?milestone=m-1");

		await click(button(container, "Milestone lanes"));

		expect(search().get("lane")).toBe("milestone");
		expect(search().get("milestone")).toBe("m-1");
		expect(boardTaskIds(container).sort()).toEqual(["task-101", "task-103"]);
	});

	it("uses the configured final status for each milestone lane's progress", () => {
		const container = renderPage("/board?lane=milestone", {
			statuses: ["Open", "Done", "Closed"],
			tasks: [
				createTask({ id: "task-1", title: "Waiting for closure", milestone: "m-1", status: "DONE" }),
				createTask({ id: "task-2", title: "Ready to ship", milestone: "m-2", status: "CLOSED" }),
			],
		});
		const laneHeaders = Array.from(container.querySelectorAll("button[aria-expanded]"));
		for (const [milestone, progress] of [["Release 1", "0%"], ["Release 2", "100%"]] as const) {
			const header = laneHeaders.find((element) => element.textContent?.includes(milestone));
			expect(header?.textContent).toContain(progress);
		}
	});

	it("offers cleanup on the final configured status in both layouts when it is not named Done", async () => {
		const options = {
			statuses: ["To Do", "Review", "Closed"],
			tasks: [createTask({ id: "task-200", title: "Closed task", status: "Closed" })],
		};
		const board = renderPage("/board", options);
		expect(board.querySelectorAll("button[aria-label='Clean up old tasks']")).toHaveLength(1);

		await click(layoutLink(board, "List"));
		expect(board.querySelectorAll("button[aria-label='Clean up old tasks']")).toHaveLength(1);
		act(() => activeRoot?.unmount());

		// Without the final status on screen there is nothing to clean up.
		const reviewOnly = renderPage("/tasks?status=Review", options);
		expect(reviewOnly.querySelector("button[aria-label='Clean up old tasks']")).toBeNull();
	});

	it("uses the configured date format in the cleanup preview", async () => {
		const originalGetCleanupPreview = apiClient.getCleanupPreview.bind(apiClient);
		apiClient.getCleanupPreview = async (age) => {
			expect(age).toBe(1);
			return {
				count: 1,
				tasks: [{ id: "task-200", title: "Closed task", createdDate: "2026-02-09 06:01" }],
			};
		};

		try {
			const container = renderPage("/board", {
				statuses: ["To Do", "Review", "Closed"],
				tasks: [createTask({ id: "task-200", title: "Closed task", status: "Closed" })],
				dateFormat: "dd/mm/yyyy",
			});

			await click(button(container, "Clean up old tasks"));
			await click(button(container, "1 day"));

			await waitFor(() => (container.textContent ?? "").includes("09/02/2026 15:01"));
			expect(container.textContent).not.toContain("2026-02-09 06:01");
			const renderedDate = Array.from(container.querySelectorAll("span[title]")).find(
				(element) => element.textContent === "09/02/2026 15:01",
			);
			expect(renderedDate?.getAttribute("title")).toBe("09/02/2026 06:01 (UTC)");
		} finally {
			apiClient.getCleanupPreview = originalGetCleanupPreview;
		}
	});
});
