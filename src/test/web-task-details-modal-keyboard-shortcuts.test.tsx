import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { apiClient } from "../web/lib/api.ts";

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

const task: Task = {
	id: "BACK-558",
	title: "Keyboard shortcut task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-07-30",
	labels: [],
	dependencies: [],
	references: [],
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

const mountModal = async (modalTask: Task = task): Promise<HTMLElement> => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	await act(async () => {
		activeRoot?.render(
			<ThemeProvider>
				<TaskDetailsModal task={modalTask} isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);
		await Promise.resolve();
	});
	return container as HTMLElement;
};

const findButton = (container: HTMLElement, text: string): HTMLButtonElement | undefined =>
	Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes(text));

const press = async (element: Element, key: string, init: KeyboardEventInit = {}): Promise<KeyboardEvent> => {
	const event = new window.KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
		...init,
	});
	await act(async () => {
		(element as HTMLElement).focus();
		element.dispatchEvent(event);
		await Promise.resolve();
	});
	return event;
};

const click = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const waitFor = async (predicate: () => boolean) => {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
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

describe("Web task popup keyboard shortcuts", () => {
	it("leaves e and E available to every preview editor", async () => {
		const container = await mountModal();
		const dialog = container.querySelector("[role='dialog']");
		expect(dialog).toBeTruthy();
		const contentEditable = document.createElement("div");
		contentEditable.setAttribute("contenteditable", "true");
		(dialog as HTMLElement).append(contentEditable);

		const targets: Array<[string, Element | undefined | null, string]> = [
			["reference", container.querySelector("input[name='newRef']"), "e"],
			["assignee", container.querySelector("#chip-input-assignee"), "e"],
			["label", container.querySelector("#chip-input-labels"), "E"],
			[
				"title",
				Array.from(container.querySelectorAll("input")).find((input) => input.value === task.title),
				"e",
			],
			["dependency", container.querySelector("#dependency-input"), "e"],
			["select", container.querySelector("select"), "e"],
			["content editable", contentEditable, "e"],
		];

		for (const [name, target, key] of targets) {
			expect(target, `${name} target`).toBeTruthy();
			const event = await press(target as Element, key);
			expect(event.defaultPrevented, `${name} keydown`).toBe(false);
			expect(findButton(container, "Edit"), `${name} keeps preview mode`).toBeTruthy();
		}
	});

	it("leaves c available to preview editors on Done tasks", async () => {
		const container = await mountModal({ ...task, status: "Done" });
		window.confirm = () => false;
		const referenceInput = container.querySelector("input[name='newRef']");
		expect(referenceInput).toBeTruthy();

		const event = await press(referenceInput as Element, "c");

		expect(event.defaultPrevented).toBe(false);
		expect(findButton(container, "Edit")).toBeTruthy();
	});

	it("keeps e and E shortcuts active outside editable controls", async () => {
		for (const key of ["e", "E"]) {
			const container = await mountModal();
			const dialog = container.querySelector("[role='dialog']");
			expect(dialog).toBeTruthy();

			const event = await press(dialog as Element, key);

			expect(event.defaultPrevented).toBe(true);
			expect(findButton(container, "Save")).toBeTruthy();

			act(() => {
				activeRoot?.unmount();
			});
			activeRoot = null;
			activeDom?.window.close();
			activeDom = null;
		}
	});

	it("keeps Escape active inside full-edit inputs", async () => {
		const container = await mountModal();
		const editButton = findButton(container, "Edit");
		expect(editButton).toBeTruthy();
		await click(editButton as HTMLButtonElement);
		const titleInput = Array.from(container.querySelectorAll("input")).find((input) => input.value === task.title);
		expect(titleInput).toBeTruthy();

		const event = await press(titleInput as HTMLInputElement, "Escape");

		expect(event.defaultPrevented).toBe(true);
		expect(findButton(container, "Edit")).toBeTruthy();
	});

	it("keeps Cmd+S and Ctrl+S active inside full-edit inputs", async () => {
		const originalUpdateTask = apiClient.updateTask.bind(apiClient);
		apiClient.updateTask = async () => task;
		try {
			const container = await mountModal();
			for (const modifier of [{ metaKey: true }, { ctrlKey: true }]) {
				const editButton = findButton(container, "Edit");
				expect(editButton).toBeTruthy();
				await click(editButton as HTMLButtonElement);
				const titleInput = Array.from(container.querySelectorAll("input")).find(
					(input) => input.value === task.title,
				);
				expect(titleInput).toBeTruthy();

				const event = await press(titleInput as HTMLInputElement, "s", modifier);
				await waitFor(() => Boolean(findButton(container, "Edit")));

				expect(event.defaultPrevented).toBe(true);
				expect(findButton(container, "Edit")).toBeTruthy();
			}
		} finally {
			apiClient.updateTask = originalUpdateTask;
		}
	});
});
