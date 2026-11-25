import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
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

const renderModal = (task: Task, availableTasks: Task[], onNavigateToTask: (task: Task) => void = () => {}) => {
	setupDom();
	const container = document.getElementById("root") as HTMLElement;
	activeRoot = createRoot(container);
	act(() => {
		activeRoot?.render(
			<ThemeProvider>
				<TaskDetailsModal
					task={task}
					isOpen={true}
					onClose={() => {}}
					availableTasks={availableTasks}
					availableStatuses={STATUSES}
					onNavigateToTask={onNavigateToTask}
				/>
			</ThemeProvider>,
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
		scope.querySelectorAll("button[aria-label^='Open ']"),
		(title) => title.getAttribute("aria-label")?.match(/^Open ([^:]+):/)?.[1] ?? "",
	);

const markerOf = (scope: ParentNode, taskId: string): HTMLButtonElement => {
	const marker = scope
		.querySelector(`button[aria-label^="Open ${taskId}:"]`)
		?.parentElement?.querySelector<HTMLButtonElement>("button[aria-expanded]");
	expect(marker, `marker of ${taskId}`).toBeTruthy();
	return marker as HTMLButtonElement;
};

describe("Task dialog parent and Subtasks", () => {
	it("shows neither a parent nor a Subtasks section for a task without them", () => {
		const tasks = [makeTask("TASK-1", "Backlog"), makeTask("TASK-9", "Shipped")];
		const container = renderModal(tasks[0] as Task, tasks);

		expect(subtasksSection(container)).toBeNull();
		expect(container.querySelector("nav[aria-label='Task hierarchy']")).toBeNull();
	});

	it("lists the direct subtasks and opens each deeper level from its marker", async () => {
		const tasks = nestedCorpus();
		const container = renderModal(tasks[0] as Task, tasks);
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
		const container = renderModal(tasks[0] as Task, tasks);
		const section = subtasksSection(container) as HTMLElement;

		// TASK-2.5 is in "Done", which is not the final status here.
		expect(section.querySelector("h3")?.nextElementSibling?.textContent).toContain("6 subtasks, 4 done");
		expect(markerOf(section, "TASK-2.6").getAttribute("aria-label")).toBe("2 subtasks, 1 done");
	});

	it("opens a subtask through the task routes", async () => {
		const opened: string[] = [];
		const tasks = nestedCorpus();
		const container = renderModal(tasks[0] as Task, tasks, (task) => opened.push(task.id));

		await click(subtasksSection(container)?.querySelector("button[aria-label^='Open TASK-2.1:']") as Element);
		expect(opened).toEqual(["TASK-2.1"]);
	});

	it("opens the parent through the task routes", async () => {
		const opened: string[] = [];
		const tasks = nestedCorpus();
		const container = renderModal(tasks[6] as Task, tasks, (task) => opened.push(task.id));

		const parentLink = container.querySelector("nav[aria-label='Task hierarchy'] button");
		expect(parentLink?.getAttribute("aria-label")).toBe("Open parent task TASK-2: Parent with six subtasks (Doing)");
		await click(parentLink as Element);
		expect(opened).toEqual(["TASK-2"]);
	});
});
