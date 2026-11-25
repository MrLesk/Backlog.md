import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TasksPage from "../web/components/TasksPage.tsx";

// The configured final status is "Shipped", so a subtask in "Done" is not finished.
const STATUSES = ["Backlog", "Doing", "Shipped"];

const createTask = (id: string, title: string, overrides: Partial<Task> = {}): Task => ({
	id,
	title,
	status: "Backlog",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

// TASK-2 has a subtask five levels below it, and direct subtasks in every status.
const TASKS: Task[] = [
	createTask("TASK-1", "Plain task"),
	createTask("TASK-2", "Orbit root"),
	createTask("TASK-2.1", "Orbit level one", { parentTaskId: "TASK-2" }),
	createTask("TASK-2.1.1", "Orbit level two", { parentTaskId: "TASK-2.1" }),
	createTask("TASK-2.1.1.1", "Orbit level three", { parentTaskId: "TASK-2.1.1" }),
	createTask("TASK-2.1.1.1.1", "Orbit level four", { parentTaskId: "TASK-2.1.1.1" }),
	createTask("TASK-2.1.1.1.1.1", "Zeppelin at level five", { parentTaskId: "TASK-2.1.1.1.1", assignee: ["@deep"] }),
	createTask("TASK-2.2", "Second child in progress", { parentTaskId: "TASK-2", status: "Doing" }),
	createTask("TASK-2.3", "Third child shipped", { parentTaskId: "TASK-2", status: "Shipped" }),
	createTask("TASK-2.4", "Fourth child done by name only", { parentTaskId: "TASK-2", status: "Done" }),
	createTask("TASK-5", "Labeled parent", { labels: ["ui"] }),
	createTask("TASK-5.1", "Unlabeled child", { parentTaskId: "TASK-5" }),
];

// GitHub #1260: a grandchild with the status of its parent and grandparent.
const ISSUE_1260_TASKS: Task[] = [
	createTask("TASK-1", "Repro root", { status: "To Do" }),
	createTask("TASK-1.1", "Repro child", { status: "To Do", parentTaskId: "TASK-1" }),
	createTask("TASK-1.1.1", "Repro grandchild", { status: "To Do", parentTaskId: "TASK-1.1" }),
];

let activeRoot: Root | null = null;

interface PageOptions {
	tasks?: Task[];
	statuses?: string[];
	onEditTask?: (task: Task) => void;
}

const pageRoutes = (options: PageOptions) => {
	const page = (layout: "list" | "board") => (
		<TasksPage
			layout={layout}
			tasks={options.tasks ?? TASKS}
			statuses={options.statuses ?? STATUSES}
			availableLabels={["ui"]}
			milestones={[]}
			milestoneEntities={[]}
			archivedMilestones={[]}
			availableTypes={[]}
			availableProjects={[]}
			isLoading={false}
			hideEmptyColumns={false}
			onEditTask={options.onEditTask ?? (() => {})}
			onNewTask={() => {}}
			onRefreshData={async () => {}}
			onTasksUpdated={() => {}}
		/>
	);
	return (
		// As in the app, a task route shows the page of its layout, so a task link keeps the page on screen.
		<Routes>
			<Route path="/tasks/*" element={page("list")} />
			<Route path="/board/*" element={page("board")} />
		</Routes>
	);
};

const setupDom = (path: string) => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: `http://localhost${path}`,
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;
};

const renderPage = (path: string, options: PageOptions = {}): HTMLElement => {
	setupDom(path);
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(<BrowserRouter>{pageRoutes(options)}</BrowserRouter>);
	});
	return container;
};

/**
 * The page rendered once to HTML. A level that opened without end would overflow the stack at once, where a live
 * render would grow until the test runs out of memory.
 */
const renderPageToFragment = (path: string, options: PageOptions = {}): DocumentFragment => {
	setupDom(path);
	return JSDOM.fragment(renderToString(<MemoryRouter initialEntries={[path]}>{pageRoutes(options)}</MemoryRouter>));
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

const click = async (element: Element, init: MouseEventInit = {}) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
		await Promise.resolve();
	});
};

const idOf = (label: string | null): string => label?.match(/^Open ([^:]+):/)?.[1] ?? "";

/** The tasks the list shows, top to bottom, with the levels opened so far. */
const listedIds = (scope: ParentNode): string[] =>
	Array.from(scope.querySelectorAll("li a[aria-label^='Open ']"), (title) =>
		idOf(title.getAttribute("aria-label")),
	);

/** The link that opens a task, in a list row, a tree row or on a card. */
const titleOf = (scope: ParentNode, taskId: string): HTMLAnchorElement => {
	const title = scope.querySelector<HTMLAnchorElement>(`a[aria-label^="Open ${taskId}:"]`);
	expect(title, `title of ${taskId}`).toBeTruthy();
	return title as HTMLAnchorElement;
};

/** The marker beside a task's title, in a list row or a tree row. */
const markerOf = (scope: ParentNode, taskId: string): HTMLButtonElement => {
	const marker = titleOf(scope, taskId).parentElement?.querySelector<HTMLButtonElement>("button[aria-expanded]");
	expect(marker, `marker of ${taskId}`).toBeTruthy();
	return marker as HTMLButtonElement;
};

const groupHeader = (container: HTMLElement, status: string): HTMLButtonElement => {
	const header = Array.from(container.querySelectorAll<HTMLButtonElement>("h3 button")).find((button) =>
		button.textContent?.startsWith(status),
	);
	expect(header, `group ${status}`).toBeTruthy();
	return header as HTMLButtonElement;
};

/** The count a group header shows: its last text. */
const groupCount = (header: HTMLButtonElement): string | undefined => header.lastElementChild?.textContent ?? undefined;

/** The rows of a status group: the list its header opens. */
const groupRows = (container: HTMLElement, status: string): HTMLElement => {
	const rows = document.getElementById(groupHeader(container, status).getAttribute("aria-controls") ?? "");
	expect(rows, `rows of ${status}`).toBeTruthy();
	return rows as HTMLElement;
};

/** The task IDs of the cards on the board: each card's title is the link that opens it. */
const cardIds = (scope: ParentNode): string[] =>
	Array.from(scope.querySelectorAll("[role='group'] h4 a[aria-label^='Open ']"), (title) =>
		idOf(title.getAttribute("aria-label")),
	);

const cardOf = (container: HTMLElement, taskId: string): HTMLElement => {
	const title = container.querySelector(`[role='group'] h4 a[aria-label^="Open ${taskId}:"]`);
	const card = title?.closest<HTMLElement>("[aria-selected]");
	expect(card, `card of ${taskId}`).toBeTruthy();
	return card as HTMLElement;
};

const column = (container: HTMLElement, status: string): HTMLElement => {
	const heading = Array.from(container.querySelectorAll("h3")).find((element) => element.textContent === status);
	const group = heading?.closest<HTMLElement>("[role='group']");
	expect(group, `column ${status}`).toBeTruthy();
	return group as HTMLElement;
};

describe("Nested tasks in the List", () => {
	it("keeps a grandchild with its ancestors' status under them and counts it (#1260)", async () => {
		const container = renderPage("/tasks", { tasks: ISSUE_1260_TASKS, statuses: ["To Do", "In Progress", "Done"] });

		expect(groupCount(groupHeader(container, "To Do"))).toBe("3");
		expect(listedIds(container)).toEqual(["TASK-1"]);

		await click(markerOf(container, "TASK-1"));
		expect(listedIds(container)).toEqual(["TASK-1", "TASK-1.1"]);

		await click(markerOf(container, "TASK-1.1"));
		expect(listedIds(container)).toEqual(["TASK-1", "TASK-1.1", "TASK-1.1.1"]);
	});

	it("counts finished subtasks against the configured final status, and marks only tasks with subtasks", () => {
		const container = renderPage("/tasks");

		expect(markerOf(container, "TASK-2").getAttribute("aria-label")).toBe("4 subtasks, 1 done");
		expect(markerOf(container, "TASK-2").getAttribute("aria-expanded")).toBe("false");
		expect(titleOf(container, "TASK-1").parentElement?.querySelector("button[aria-expanded]")).toBeNull();
	});

	it("opens each level on its own and brings back the levels below when a level opens again", async () => {
		const container = renderPage("/tasks");

		await click(markerOf(container, "TASK-2"));
		expect(listedIds(container)).toContain("TASK-2.1");
		expect(listedIds(container)).not.toContain("TASK-2.1.1");

		await click(markerOf(container, "TASK-2.1"));
		expect(listedIds(container)).toContain("TASK-2.1.1");
		expect(markerOf(container, "TASK-2.1").getAttribute("aria-expanded")).toBe("true");

		await click(markerOf(container, "TASK-2"));
		expect(listedIds(container)).not.toContain("TASK-2.1");
		expect(listedIds(container)).not.toContain("TASK-2.1.1");

		await click(markerOf(container, "TASK-2"));
		expect(listedIds(container)).toContain("TASK-2.1.1");
	});

	it("reaches a subtask five levels down, and every level keeps its details", async () => {
		const container = renderPage("/tasks");

		for (const id of ["TASK-2", "TASK-2.1", "TASK-2.1.1", "TASK-2.1.1.1", "TASK-2.1.1.1.1"]) {
			await click(markerOf(container, id));
		}

		const deepest = titleOf(container, "TASK-2.1.1.1.1.1");
		const row = deepest.closest("li")?.firstElementChild;
		expect(row?.textContent).toContain("@deep");
		// The row sits in one list per level above it.
		let lists = 0;
		for (let element = deepest.closest("ul"); element; element = element.parentElement?.closest("ul") ?? null) {
			lists += 1;
		}
		expect(lists).toBe(6);
	});

	it("lists a subtask with another status in its own group, linked to its parent, and under the opened parent", async () => {
		const opened: string[] = [];
		const container = renderPage("/tasks", { onEditTask: (task) => opened.push(task.id) });
		const doingGroup = groupRows(container, "Doing");

		expect(listedIds(doingGroup)).toEqual(["TASK-2.2"]);
		const parentLink = doingGroup.querySelector("a[aria-label^='Parent task TASK-2:']");
		expect(parentLink?.getAttribute("href")).toBe("/tasks/TASK-2/orbit-root");
		await click(parentLink as Element);
		expect(window.location.pathname).toBe("/tasks/TASK-2/orbit-root");
		expect(opened).toEqual([]);

		await click(markerOf(container, "TASK-2"));
		const backlogGroup = groupRows(container, "Backlog");
		expect(listedIds(backlogGroup)).toContain("TASK-2.2");
	});

	it("opens a subtask from a click anywhere on its row, never its parent", async () => {
		const opened: string[] = [];
		const container = renderPage("/tasks", { onEditTask: (task) => opened.push(task.id) });
		await click(markerOf(container, "TASK-2"));

		const row = titleOf(container, "TASK-2.1").closest("li")?.firstElementChild;
		await click(row as Element);

		expect(opened).toEqual(["TASK-2.1"]);
	});
});

describe("Nested tasks under filters", () => {
	it("lists a subtask that matches alone at the top of its group, linked to its parent", () => {
		const container = renderPage("/tasks?search=zeppelin");

		expect(listedIds(container)).toEqual(["TASK-2.1.1.1.1.1"]);
		expect(container.querySelector("a[aria-label^='Parent task TASK-2.1.1.1.1:']")).toBeTruthy();
	});

	it("opens parents by themselves when their subtasks match too", () => {
		const container = renderPage("/tasks?search=orbit");

		expect(listedIds(container)).toEqual(["TASK-2", "TASK-2.1", "TASK-2.1.1", "TASK-2.1.1.1", "TASK-2.1.1.1.1"]);
	});

	it("lists only the subtasks the filters keep, while markers count every subtask", async () => {
		const container = renderPage("/tasks?status=Backlog");

		// TASK-2 opened by itself: of its four subtasks only TASK-2.1 has the status Backlog.
		expect(markerOf(container, "TASK-2").getAttribute("aria-expanded")).toBe("true");
		expect(markerOf(container, "TASK-2").getAttribute("aria-label")).toBe("4 subtasks, 1 done");
		expect(listedIds(container)).toContain("TASK-2.1");
		expect(listedIds(container)).not.toContain("TASK-2.2");
	});

	it("opens a hand-edited loop of parents only once around while a search keeps it", () => {
		const loop = [
			createTask("TASK-8", "Loop one", { parentTaskId: "TASK-9" }),
			createTask("TASK-9", "Loop two", { parentTaskId: "TASK-8" }),
		];

		expect(listedIds(renderPageToFragment("/tasks?search=loop", { tasks: loop }))).toEqual(["TASK-8", "TASK-9", "TASK-8"]);
		expect(cardIds(renderPageToFragment("/board?search=loop", { tasks: loop }))).toEqual(["TASK-8", "TASK-9"]);
	});

	it("says so when an opened parent has no subtask that matches", async () => {
		const container = renderPage("/tasks?label=ui");

		expect(listedIds(container)).toEqual(["TASK-5"]);
		await click(markerOf(container, "TASK-5"));

		const level = document.getElementById(markerOf(container, "TASK-5").getAttribute("aria-controls") ?? "");
		expect(level?.textContent).toBe("No subtasks match these filters");
	});
});

describe("Nested tasks on the Board", () => {
	it("keeps a grandchild with its ancestors' status as a card, and opens it inside the root's card (#1260)", async () => {
		const container = renderPage("/board", { tasks: ISSUE_1260_TASKS, statuses: ["To Do", "In Progress", "Done"] });
		const toDo = column(container, "To Do");

		expect(cardIds(toDo)).toEqual(["TASK-1", "TASK-1.1", "TASK-1.1.1"]);
		expect(toDo.querySelector("h3")?.nextElementSibling?.textContent).toBe("3");

		const root = cardOf(container, "TASK-1");
		await click(root.querySelector(":scope > button[aria-expanded]") as Element);
		await click(markerOf(root, "TASK-1.1"));
		expect(titleOf(root, "TASK-1.1.1")).toBeTruthy();
	});

	it("opens a parent's subtasks inside its card level by level, and each subtask keeps its card and parent link", async () => {
		const opened: string[] = [];
		const container = renderPage("/board", { onEditTask: (task) => opened.push(task.id) });
		const parent = cardOf(container, "TASK-2");
		const bar = parent.querySelector(":scope > button[aria-expanded]") as HTMLButtonElement;

		expect(bar.getAttribute("aria-label")).toBe("4 subtasks, 1 done");
		await click(bar);
		expect(bar.getAttribute("aria-expanded")).toBe("true");
		expect(titleOf(parent, "TASK-2.4")).toBeTruthy();
		expect(parent.querySelector("a[aria-label^='Open TASK-2.1.1:']")).toBeNull();

		await click(markerOf(parent, "TASK-2.1"));
		expect(titleOf(parent, "TASK-2.1.1")).toBeTruthy();

		// TASK-2.4 has a status the board has no column for, so it has no card.
		expect(cardIds(container)).toEqual(expect.arrayContaining(["TASK-2.1", "TASK-2.2", "TASK-2.3"]));
		const subtaskCard = cardOf(container, "TASK-2.2");
		await click(subtaskCard.querySelector("a[aria-label^='Parent task TASK-2:']") as Element);
		expect(window.location.pathname).toBe("/board/TASK-2/orbit-root");
		expect(opened).toEqual([]);
	});

	it("runs the bar, a subtask row and the parent link on a plain click, and never opens the card", async () => {
		const opened: string[] = [];
		const container = renderPage("/board", { onEditTask: (task) => opened.push(task.id) });
		const parent = cardOf(container, "TASK-2");
		const bar = parent.querySelector(":scope > button[aria-expanded]") as HTMLButtonElement;

		await click(bar);
		expect(bar.getAttribute("aria-expanded")).toBe("true");
		expect(opened).toEqual([]);

		await click(titleOf(parent, "TASK-2.3").closest("li")?.firstElementChild as Element);
		expect(opened).toEqual(["TASK-2.3"]);

		// The parent link is a link: it opens the parent through its own route, and the card does not open.
		await click(cardOf(container, "TASK-2.2").querySelector("a[aria-label^='Parent task TASK-2:']") as Element);
		expect(window.location.pathname).toBe("/board/TASK-2/orbit-root");
		expect(opened).toEqual(["TASK-2.3"]);
	});

	it("selects a card on a Ctrl-click anywhere on it, also on its bar, a subtask row or its parent link", async () => {
		const opened: string[] = [];
		const container = renderPage("/board", { onEditTask: (task) => opened.push(task.id) });
		const parent = cardOf(container, "TASK-2");
		const bar = parent.querySelector(":scope > button[aria-expanded]") as HTMLButtonElement;

		await click(bar, { ctrlKey: true });
		expect(parent.getAttribute("aria-selected")).toBe("true");
		expect(bar.getAttribute("aria-expanded")).toBe("false");

		await click(cardOf(container, "TASK-2.2").querySelector("a[aria-label^='Parent task']") as Element, {
			ctrlKey: true,
		});
		expect(cardOf(container, "TASK-2.2").getAttribute("aria-selected")).toBe("true");

		// The card is selected, so a Ctrl-click on one of its subtask rows deselects it instead of opening the subtask.
		await click(bar);
		await click(titleOf(parent, "TASK-2.3").closest("li")?.firstElementChild as Element, { ctrlKey: true });
		expect(parent.getAttribute("aria-selected")).toBe("false");
		expect(opened).toEqual([]);
	});

	it("selects a card with Ctrl+Enter on its title, leaves Enter to the link, and opens it once with Space", async () => {
		const opened: string[] = [];
		const container = renderPage("/board", { onEditTask: (task) => opened.push(task.id) });
		const title = container.querySelector("h4 a[aria-label^='Open TASK-1:']") as HTMLElement;
		const press = async (key: string, init: KeyboardEventInit = {}) => {
			const event = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
			await act(async () => {
				title.dispatchEvent(event);
				await Promise.resolve();
			});
			return event;
		};

		await press("Enter", { ctrlKey: true });
		expect(cardOf(container, "TASK-1").getAttribute("aria-selected")).toBe("true");
		expect(opened).toEqual([]);

		// Enter is the link's own key: the browser follows the link, so the card's handler leaves it alone.
		expect((await press("Enter")).defaultPrevented).toBe(false);
		expect(opened).toEqual([]);
		// Space opens the task too, once, and does not scroll the page.
		expect((await press(" ")).defaultPrevented).toBe(true);
		expect(opened).toEqual(["TASK-1"]);
	});

	it("cancels a drag that starts on a subtask row, so the card around it does not move", async () => {
		const container = renderPage("/board");
		const parent = cardOf(container, "TASK-2");
		await click(parent.querySelector(":scope > button[aria-expanded]") as Element);
		const dragFrom = async (element: Element) => {
			const carried: string[] = [];
			const event = new window.Event("dragstart", { bubbles: true, cancelable: true });
			Object.defineProperty(event, "dataTransfer", {
				value: { setData: (_type: string, value: string) => carried.push(value), effectAllowed: "" },
			});
			await act(async () => {
				element.dispatchEvent(event);
				await Promise.resolve();
			});
			return { cancelled: event.defaultPrevented, carried };
		};

		expect(await dragFrom(titleOf(parent, "TASK-2.1").closest("li")?.firstElementChild as Element)).toEqual({
			cancelled: true,
			carried: [],
		});
		// A drag from the card's own title still carries the card.
		expect((await dragFrom(parent.querySelector("h4 a") as Element)).carried).toContain("TASK-2");
	});
});
