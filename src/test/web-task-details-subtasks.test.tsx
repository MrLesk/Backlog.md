import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskDetails from "../web/components/TaskDetails";
import { ThemeProvider } from "../web/contexts/ThemeContext";

// The configured final status is "Shipped", so a subtask in "Done" is not finished.
const STATUSES = ["Backlog", "Doing", "Shipped"];

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
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
};

const makeTask = (id: string, status: string, parentTaskId?: string, title?: string): Task =>
	({
		id,
		title: title ?? `Task ${id}`,
		status,
		assignee: [],
		createdDate: "2026-08-17",
		labels: [],
		dependencies: [],
		...(parentTaskId ? { parentTaskId } : {}),
	}) as Task;

// A parent whose subtasks are spread across statuses; one of them has subtasks of its own, one level deeper again.
const nestedCorpus = (): Task[] => [
	makeTask("TASK-2", "Doing", undefined, "Parent with six subtasks"),
	makeTask("TASK-2.1", "Shipped", "TASK-2"),
	makeTask("TASK-2.2", "Shipped", "TASK-2"),
	makeTask("TASK-2.3", "Shipped", "TASK-2"),
	makeTask("TASK-2.4", "Shipped", "TASK-2"),
	makeTask("TASK-2.5", "Done", "TASK-2"),
	makeTask("TASK-2.6", "Backlog", "TASK-2", "Subtask that has subtasks"),
	makeTask("TASK-2.6.1", "Shipped", "TASK-2.6"),
	makeTask("TASK-2.6.2", "Backlog", "TASK-2.6"),
	makeTask("TASK-2.6.2.1", "Backlog", "TASK-2.6.2"),
];

let currentPath = "";

function LocationProbe() {
	currentPath = useLocation().pathname;
	return null;
}

const renderPage = (task: Task, availableTasks: Task[]) => {
	setupDom();
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<MemoryRouter initialEntries={[`/tasks/${task.id}`]}>
				<LocationProbe />
				<ThemeProvider>
					<TaskDetails task={task} onClose={() => {}} availableTasks={availableTasks} availableStatuses={STATUSES} />
				</ThemeProvider>
			</MemoryRouter>,
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

const subtasksSection = (container: HTMLElement): HTMLElement | null =>
	Array.from(container.querySelectorAll("section")).find(
		(section) => section.querySelector("h3")?.textContent === "Subtasks",
	) ?? null;

const listedIds = (scope: ParentNode): string[] =>
	Array.from(
		scope.querySelectorAll("a[aria-label^='Open ']"),
		(title) => title.getAttribute("aria-label")?.match(/^Open ([^:]+):/)?.[1] ?? "",
	);

const markerOf = (scope: ParentNode, taskId: string): HTMLButtonElement => {
	const marker = scope
		.querySelector(`a[aria-label^="Open ${taskId}:"]`)
		?.parentElement?.querySelector<HTMLButtonElement>("button[aria-expanded]");
	expect(marker, `marker of ${taskId}`).toBeTruthy();
	return marker as HTMLButtonElement;
};

describe("Task page parent and Subtasks", () => {
	it("shows neither a parent nor a Subtasks section for a task without them", () => {
		const tasks = [makeTask("TASK-1", "Backlog"), makeTask("TASK-9", "Shipped")];
		const container = renderPage(tasks[0] as Task, tasks);

		expect(subtasksSection(container)).toBeNull();
		expect(container.querySelector("a[aria-label^='Parent task']")).toBeNull();
	});

	it("lists the direct subtasks and opens each deeper level from its marker", async () => {
		const tasks = nestedCorpus();
		const container = renderPage(tasks[0] as Task, tasks);
		const section = subtasksSection(container) as HTMLElement;

		expect(listedIds(section)).toEqual(["TASK-2.1", "TASK-2.2", "TASK-2.3", "TASK-2.4", "TASK-2.5", "TASK-2.6"]);

		await click(markerOf(section, "TASK-2.6"));
		expect(listedIds(section)).toContain("TASK-2.6.2");
		expect(listedIds(section)).not.toContain("TASK-2.6.2.1");

		await click(markerOf(section, "TASK-2.6.2"));
		expect(listedIds(section)).toContain("TASK-2.6.2.1");
	});

	it("counts the subtasks in the configured final status as done", () => {
		const tasks = nestedCorpus();
		const container = renderPage(tasks[0] as Task, tasks);
		const section = subtasksSection(container) as HTMLElement;

		// TASK-2.5 is in "Done", which is not the final status here.
		const count = section.querySelector("[role='progressbar']");
		expect(count?.getAttribute("aria-label")).toBe("6 subtasks, 4 done");
		expect(count?.getAttribute("aria-valuenow")).toBe("4");
		expect(markerOf(section, "TASK-2.6").getAttribute("aria-label")).toBe("2 subtasks, 1 done");
	});

	it("links each subtask to its task route", async () => {
		const tasks = nestedCorpus();
		const container = renderPage(tasks[0] as Task, tasks);

		await click(subtasksSection(container)?.querySelector("a[aria-label^='Open TASK-2.1:']") as Element);
		expect(currentPath).toBe("/tasks/TASK-2.1/task-task-21");
	});

	it.each([
		["Ctrl", { ctrlKey: true }],
		["Cmd", { metaKey: true }],
	] as const)("leaves a %s-click on a subtask's link and on its row to the browser", (_key, modifier) => {
		const tasks = nestedCorpus();
		const container = renderPage(tasks[0] as Task, tasks);
		const link = subtasksSection(container)?.querySelector("a[aria-label^='Open TASK-2.1:']") as HTMLAnchorElement;
		const row = link.closest("li > div") as HTMLElement;
		// A listener on the window runs after the app's own handlers: it records whether the app took the click, then
		// stops jsdom from trying to follow the link, which it cannot do.
		const preventedByApp: boolean[] = [];
		window.addEventListener("click", (event) => {
			preventedByApp.push(event.defaultPrevented);
			event.preventDefault();
		});

		for (const target of [link, row]) {
			act(() => {
				target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, ...modifier }));
			});
		}

		expect(preventedByApp).toEqual([false, false]);
		expect(currentPath).toBe("/tasks/TASK-2");
	});

	it("links the Parent row to the parent's task route", async () => {
		const tasks = nestedCorpus();
		const container = renderPage(tasks[6] as Task, tasks);

		const parentLink = container.querySelector("a[aria-label^='Parent task']");
		expect(parentLink?.getAttribute("aria-label")).toBe("Parent task TASK-2: Parent with six subtasks");
		await click(parentLink as Element);
		expect(currentPath).toBe("/tasks/TASK-2/parent-with-six-subtasks");
	});
});
