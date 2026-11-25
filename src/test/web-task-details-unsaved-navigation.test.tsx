import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskDetails from "../web/components/TaskDetails";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { setNativeInputValue } from "./react-dom-input.ts";

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;
let currentPath = "";

const dependency: Task = {
	id: "BACK-2",
	title: "Dependency task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-07",
	labels: [],
	dependencies: [],
};

const task: Task = {
	id: "BACK-1",
	title: "Task being edited",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-07",
	labels: [],
	dependencies: ["BACK-2"],
	references: [],
	comments: [{ index: 1, body: "Blocked by BACK-2 until it lands.", createdDate: "2026-08-07" }],
};

// A subtask of the task being edited, for the task page's parent link and Subtasks tree.
const subtask: Task = {
	id: "BACK-1.1",
	title: "Subtask being edited",
	status: "To Do",
	assignee: [],
	createdDate: "2026-08-07",
	labels: [],
	dependencies: [],
	parentTaskId: "BACK-1",
};

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document as Document;
	globalThis.navigator = activeDom.window.navigator as Navigator;
	globalThis.localStorage = activeDom.window.localStorage;
	globalThis.Element = activeDom.window.Element;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.HTMLInputElement = activeDom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = activeDom.window.HTMLTextAreaElement;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);

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

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	htmlElementPrototype.attachEvent = () => {};
	htmlElementPrototype.detachEvent = () => {};
};

function LocationProbe() {
	currentPath = useLocation().pathname;
	return null;
}

// The task view inside the app's router, with a link outside it that stands for the sidebar.
const renderTask = async (
	shownTask: Task | undefined,
	options: { availableTasks?: Task[]; onClose?: () => void } = {},
): Promise<HTMLElement> => {
	setupDom();
	currentPath = "";
	const container = document.getElementById("root");
	activeRoot = createRoot(container as HTMLElement);
	await act(async () => {
		activeRoot?.render(
			<MemoryRouter initialEntries={["/tasks/BACK-1"]}>
				<ThemeProvider>
					<TaskIdIndexProvider tasks={[task, dependency]}>
						<LocationProbe />
						<Link to="/milestones">Milestones</Link>
						<TaskDetails
							task={shownTask}
							onClose={options.onClose ?? (() => {})}
							availableTasks={options.availableTasks ?? [task, dependency]}
						/>
					</TaskIdIndexProvider>
				</ThemeProvider>
			</MemoryRouter>,
		);
		await Promise.resolve();
	});
	return container as HTMLElement;
};

/** Existing task, opens in preview mode. */
const mountPage = () => renderTask(task);
/** No task, opens in create mode. */
const mountCreateDialog = () => renderTask(undefined);

const click = async (element: Element): Promise<MouseEvent> => {
	const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
	await act(async () => {
		element.dispatchEvent(event);
		await Promise.resolve();
	});
	return event;
};

const typeInto = async (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
	await act(async () => {
		setNativeInputValue(element, value);
		await Promise.resolve();
	});
};

const pressEnter = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
};

const startEditing = async (container: HTMLElement) => {
	const editButton = Array.from(container.querySelectorAll("button")).find(
		(button) => button.textContent?.trim() === "Edit",
	);
	expect(editButton).toBeTruthy();
	await click(editButton as Element);
};

const declineOnConfirm = () => {
	const prompts: string[] = [];
	window.confirm = (message?: string) => {
		prompts.push(message ?? "");
		return false;
	};
	return prompts;
};

const startEditingWithUnsavedChanges = async (container: HTMLElement, editedTask: Task = task) => {
	await startEditing(container);

	const titleInput = Array.from(container.querySelectorAll("input")).find((input) => input.value === editedTask.title);
	expect(titleInput).toBeTruthy();
	await typeInto(titleInput as HTMLInputElement, `${editedTask.title} with unsaved work`);
};

const findLinkByText = (container: HTMLElement, text: string): HTMLAnchorElement => {
	const link = Array.from(container.querySelectorAll('a[href^="/tasks/BACK-2/"]')).find(
		(candidate) => candidate.textContent === text,
	);
	expect(link, `link "${text}"`).toBeTruthy();
	return link as HTMLAnchorElement;
};

/** Dependency chip: a task link. */
const findChipLink = (container: HTMLElement) => findLinkByText(container, `${dependency.id} - ${dependency.title}`);
/** Auto-linked task ID in a comment: a task link too. */
const findCommentLink = (container: HTMLElement) => findLinkByText(container, dependency.id);

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

describe("Task details navigation with unsaved edits", () => {
	it("keeps the editor open when a dependency chip is clicked and the discard prompt is declined", async () => {
		const container = await mountPage();
		await startEditingWithUnsavedChanges(container);

		let prompts = 0;
		window.confirm = () => {
			prompts += 1;
			return false;
		};

		const event = await click(findChipLink(container));

		expect(prompts).toBe(1);
		expect(event.defaultPrevented).toBe(true);
		expect(currentPath).toBe("/tasks/BACK-1");
	});

	it("navigates from a dependency chip once the discard prompt is accepted", async () => {
		const container = await mountPage();
		await startEditingWithUnsavedChanges(container);

		window.confirm = () => true;

		await click(findChipLink(container));

		expect(currentPath).toStartWith("/tasks/BACK-2/");
	});

	it("protects a comment draft that is the only unsaved work", async () => {
		const container = await mountPage();
		await startEditing(container);

		const commentBox = container.querySelector('textarea[placeholder="Add a comment..."]');
		expect(commentBox).toBeTruthy();
		await typeInto(commentBox as HTMLTextAreaElement, "Draft comment nobody has submitted yet");

		const prompts = declineOnConfirm();
		const event = await click(findChipLink(container));

		expect(prompts.length).toBe(1);
		expect(event.defaultPrevented).toBe(true);
		expect(currentPath).toBe("/tasks/BACK-1");
	});

	it("protects create-mode metadata entered before any title", async () => {
		const container = await mountCreateDialog();

		const dependencyInput = container.querySelector("#dependency-input");
		expect(dependencyInput).toBeTruthy();
		await typeInto(dependencyInput as HTMLTextAreaElement, dependency.id);
		await pressEnter(dependencyInput as Element);

		const prompts = declineOnConfirm();
		const event = await click(findChipLink(container));

		expect(prompts.length).toBe(1);
		expect(event.defaultPrevented).toBe(true);
		expect(currentPath).toBe("/tasks/BACK-1");
	});

	it("blocks an auto-linked task ID in a comment when the discard prompt is declined", async () => {
		const container = await mountPage();
		await startEditingWithUnsavedChanges(container);

		window.confirm = () => false;

		const event = await click(findCommentLink(container));

		expect(event.defaultPrevented).toBe(true);
	});

	it("asks before a subtask in the Subtasks tree leaves unsaved edits, and stays when declined", async () => {
		const container = await renderTask(task, { availableTasks: [task, dependency, subtask] });
		await startEditingWithUnsavedChanges(container);
		const subtaskTitle = container.querySelector("a[aria-label^='Open BACK-1.1:']");
		expect(subtaskTitle).toBeTruthy();

		const prompts = declineOnConfirm();
		await click(subtaskTitle as Element);
		expect(prompts).toEqual(["Discard unsaved changes and leave this task?"]);
		expect(currentPath).toBe("/tasks/BACK-1");

		// A click elsewhere on the subtask's row asks the same question.
		await click(subtaskTitle?.closest("li")?.querySelector(".font-mono") as Element);
		expect(prompts).toHaveLength(2);
		expect(currentPath).toBe("/tasks/BACK-1");

		window.confirm = () => true;
		await click(subtaskTitle as Element);
		expect(currentPath).toStartWith("/tasks/BACK-1.1/");
	});

	it("asks before the Parent row leaves unsaved edits", async () => {
		const container = await renderTask(subtask, { availableTasks: [task, dependency, subtask] });
		await startEditingWithUnsavedChanges(container, subtask);

		const prompts = declineOnConfirm();
		await click(container.querySelector("a[aria-label^='Parent task BACK-1:']") as Element);

		expect(prompts.length).toBe(1);
		expect(currentPath).toBe("/tasks/BACK-1");
	});

	it("asks before a link outside the task, such as the sidebar's, leaves unsaved edits", async () => {
		const container = await mountPage();
		await startEditingWithUnsavedChanges(container);
		const sidebarLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent === "Milestones");

		const prompts = declineOnConfirm();
		const event = await click(sidebarLink as Element);

		expect(prompts).toEqual(["Discard unsaved changes and leave this task?"]);
		expect(event.defaultPrevented).toBe(true);
		expect(currentPath).toBe("/tasks/BACK-1");
	});

	it("asks before the close button leaves unsaved edits, and closes once accepted", async () => {
		let closes = 0;
		const container = await renderTask(task, { onClose: () => (closes += 1) });
		await startEditingWithUnsavedChanges(container);
		const closeButton = container.querySelector("button[aria-label='Close task']") as Element;

		const prompts = declineOnConfirm();
		await click(closeButton);
		expect(prompts).toHaveLength(1);
		expect(closes).toBe(0);

		window.confirm = () => true;
		await click(closeButton);
		expect(closes).toBe(1);
	});

	it("lets links through while there is nothing unsaved to lose", async () => {
		const container = await mountPage();

		let prompts = 0;
		window.confirm = () => {
			prompts += 1;
			return false;
		};

		await click(findChipLink(container));

		expect(prompts).toBe(0);
		expect(currentPath).toStartWith("/tasks/BACK-2/");
	});
});
