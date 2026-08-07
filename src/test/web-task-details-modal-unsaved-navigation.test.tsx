import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";

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

const mountModal = async (): Promise<HTMLElement> => {
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
						<TaskDetailsModal
							task={task}
							isOpen={true}
							onClose={() => {}}
							availableTasks={[task, dependency]}
						/>
					</TaskIdIndexProvider>
				</ThemeProvider>
			</MemoryRouter>,
		);
		await Promise.resolve();
	});
	return container as HTMLElement;
};

const click = async (element: Element): Promise<MouseEvent> => {
	const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
	await act(async () => {
		element.dispatchEvent(event);
		await Promise.resolve();
	});
	return event;
};

const typeInto = async (element: HTMLInputElement, value: string) => {
	const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
	await act(async () => {
		setter?.call(element, value);
		element.dispatchEvent(new window.Event("input", { bubbles: true }));
		await Promise.resolve();
	});
};

const startEditingWithUnsavedChanges = async (container: HTMLElement) => {
	const editButton = Array.from(container.querySelectorAll("button")).find(
		(button) => button.textContent?.trim() === "Edit",
	);
	expect(editButton).toBeTruthy();
	await click(editButton as Element);

	const titleInput = Array.from(container.querySelectorAll("input")).find((input) => input.value === task.title);
	expect(titleInput).toBeTruthy();
	await typeInto(titleInput as HTMLInputElement, "Task being edited with unsaved work");
};

const findLinkByText = (container: HTMLElement, text: string): HTMLAnchorElement => {
	const link = Array.from(container.querySelectorAll('a[href="/tasks/BACK-2"]')).find(
		(candidate) => candidate.textContent === text,
	);
	expect(link, `link "${text}"`).toBeTruthy();
	return link as HTMLAnchorElement;
};

/** Dependency chip: a react-router link that changes the route in place. */
const findChipLink = (container: HTMLElement) => findLinkByText(container, `${dependency.id} - ${dependency.title}`);
/** Auto-linked task ID in a comment: a plain anchor that would reload the page. */
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

describe("Task details modal navigation with unsaved edits", () => {
	it("keeps the editor open when a dependency chip is clicked and the discard prompt is declined", async () => {
		const container = await mountModal();
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
		const container = await mountModal();
		await startEditingWithUnsavedChanges(container);

		window.confirm = () => true;

		await click(findChipLink(container));

		expect(currentPath).toBe("/tasks/BACK-2");
	});

	it("blocks an auto-linked task ID in a comment when the discard prompt is declined", async () => {
		const container = await mountModal();
		await startEditingWithUnsavedChanges(container);

		window.confirm = () => false;

		const event = await click(findCommentLink(container));

		expect(event.defaultPrevented).toBe(true);
	});

	it("lets links through while there is nothing unsaved to lose", async () => {
		const container = await mountModal();

		let prompts = 0;
		window.confirm = () => {
			prompts += 1;
			return false;
		};

		await click(findChipLink(container));

		expect(prompts).toBe(0);
		expect(currentPath).toBe("/tasks/BACK-2");
	});
});
