import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import TaskDetails from "../web/components/TaskDetails";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { apiClient } from "../web/lib/api.ts";
import { setNativeInputValue } from "./react-dom-input.ts";

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

// The task page, with a button outside it that stands for the rest of the app (the sidebar, say).
const mountPage = async (
	pageTask: Task = task,
	props: {
		availableStatuses?: string[];
		availableLabels?: string[];
		availableTasks?: Task[];
		onArchive?: () => void;
		onClose?: () => void;
	} = {},
): Promise<HTMLElement> => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	await act(async () => {
		activeRoot?.render(
			<MemoryRouter initialEntries={[`/tasks/${pageTask.id}`]}>
				<ThemeProvider>
					<button type="button">Outside the task</button>
					<TaskDetails task={pageTask} onClose={() => {}} {...props} />
				</ThemeProvider>
			</MemoryRouter>,
		);
		await Promise.resolve();
	});
	return container as HTMLElement;
};

const taskPageOf = (container: HTMLElement) => container.querySelector("article") as HTMLElement;

// The add field of a file panel, found by its label, such as "Add reference".
const fieldLabelled = (container: HTMLElement, label: string) => {
	const element = Array.from(container.querySelectorAll("label")).find((candidate) => candidate.textContent === label);
	return element ? (container.ownerDocument.getElementById(element.htmlFor) as HTMLInputElement | null) : null;
};

const openMoreActions = async (container: HTMLElement) => {
	await click(container.querySelector("button[aria-label='More actions']") as HTMLButtonElement);
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

describe("Task page keyboard shortcuts", () => {
	it("leaves e and E available to every preview editor", async () => {
		const container = await mountPage();
		const page = taskPageOf(container);
		expect(page).toBeTruthy();
		const contentEditable = document.createElement("div");
		contentEditable.setAttribute("contenteditable", "true");
		const contentEditableChild = document.createElement("span");
		contentEditable.append(contentEditableChild);
		page.append(contentEditable);

		const targets: Array<[string, Element | undefined | null, string]> = [
			["reference", fieldLabelled(container, "Add reference"), "e"],
			["assignee", container.querySelector("#chip-input-assignee"), "e"],
			["label", container.querySelector("#chip-input-labels"), "E"],
			["dependency", container.querySelector("#dependency-input"), "e"],
			["select", container.querySelector("select"), "e"],
			["content editable descendant", contentEditableChild, "e"],
		];

		for (const [name, target, key] of targets) {
			expect(target, `${name} target`).toBeTruthy();
			const event = await press(target as Element, key);
			expect(event.defaultPrevented, `${name} keydown`).toBe(false);
			expect(findButton(container, "Edit"), `${name} keeps preview mode`).toBeTruthy();
		}
	});

	it("leaves c available to preview editors on Done tasks", async () => {
		const container = await mountPage({ ...task, status: "Done" });
		window.confirm = () => false;
		const referenceInput = fieldLabelled(container, "Add reference");
		expect(referenceInput).toBeTruthy();

		const event = await press(referenceInput as Element, "c");

		expect(event.defaultPrevented).toBe(false);
		expect(findButton(container, "Edit")).toBeTruthy();
	});

	it.each(["Done", "Closed"])("offers no complete action or shortcut in the final status %s", async (status) => {
		const container = await mountPage({ ...task, status }, { availableStatuses: ["To Do", status] });

		expect(findButton(container, "Move to completed")).toBeUndefined();
		expect(findButton(container, "Complete")).toBeUndefined();
		const event = await press(taskPageOf(container), "c");
		expect(event.defaultPrevented).toBe(false);
	});

	it.each([
		[
			"an archived task",
			{ status: "Done", source: "archived" } as const,
			"This task is archived, so it cannot be changed.",
		],
		[
			"a task from another branch",
			{ source: "local-branch", branch: "feature" } as const,
			"This task is on branch feature. Switch to that branch to edit it.",
		],
	])("shows %s read-only: one note, no edit, archive or demote control, no edit shortcut", async (_name, overrides, note) => {
		let archives = 0;
		const container = await mountPage({
			...task,
			...overrides,
			acceptanceCriteriaItems: [{ index: 1, text: "Acceptance criterion", checked: false }],
			definitionOfDoneItems: [{ index: 1, text: "Done item", checked: true }],
		}, {
			onArchive: () => {
				archives += 1;
			},
		});

		expect(container.textContent?.split(note)).toHaveLength(2);
		expect(findButton(container, "Edit")).toBeUndefined();
		expect(container.querySelector("button[aria-label='More actions']")).toBeNull();
		expect(findButton(container, "Demote")).toBeUndefined();
		// Its properties are plain values, not controls.
		expect(container.querySelector("select")).toBeNull();
		expect(container.querySelector("#chip-input-labels")).toBeNull();
		const event = await press(taskPageOf(container), "e");
		expect(event.defaultPrevented).toBe(false);
		expect(findButton(container, "Save")).toBeUndefined();
		expect(archives).toBe(0);
		const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='checkbox']"));
		expect(checkboxes).toHaveLength(2);
		for (const checkbox of checkboxes) {
			expect(checkbox.disabled).toBe(true);
			const checked = checkbox.checked;
			await act(async () => checkbox.click());
			expect(checkbox.checked).toBe(checked);
		}
	});

	it("says what archive keeps before running the action, in any status", async () => {
		let archives = 0;
		const container = await mountPage({ ...task, status: "Done" }, {
			onArchive: () => {
				archives += 1;
			},
		});
		window.confirm = (message) => {
			expect(message).toContain("It moves off the board.");
			expect(message).toContain("Its ID, record, dependencies, and references are kept.");
			return false;
		};
		await openMoreActions(container);
		await click(findButton(container, "Archive") as HTMLButtonElement);
		expect(archives).toBe(0);
		window.confirm = () => true;
		await openMoreActions(container);
		await click(findButton(container, "Archive") as HTMLButtonElement);
		expect(archives).toBe(1);
	});

	it("keeps e and E shortcuts active outside editable controls", async () => {
		for (const key of ["e", "E"]) {
			const container = await mountPage();

			const event = await press(taskPageOf(container), key);

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

	it("reuses configured labels by keyboard or mouse and keeps free-text labels", async () => {
		const update = spyOn(apiClient, "updateTask").mockImplementation(async (_id, updates) => ({
			...task,
			labels: updates.labels ?? [],
		}));
		try {
			const container = await mountPage(task, { availableLabels: ["Build", "Bug", "Docs"] });
			const input = container.querySelector<HTMLInputElement>("#chip-input-labels")!;
			const type = (value: string) => act(async () => setNativeInputValue(input, value));
			const options = () => Array.from(container.querySelectorAll('[role="option"]'));
			const selected = () => update.mock.lastCall?.[1].labels;

			await type("U");
			expect(options().map((option) => option.textContent)).toEqual(["Build", "Bug"]);
			await press(input, "ArrowDown");
			await press(input, "ArrowDown");
			await press(input, "Enter");
			expect(selected()).toEqual(["Bug"]);

			await type("u");
			expect(options().map((option) => option.textContent)).toEqual(["Build"]);
			await type("doc");
			await click(options()[0]!);
			expect(selected()).toEqual(["Bug", "Docs"]);

			await type("BUG,");
			expect(update).toHaveBeenCalledTimes(2);
			await type("bui");
			await press(input, "Enter");
			expect(selected()).toEqual(["Bug", "Docs", "bui"]);
			await type("build,");
			expect(selected()).toEqual(["Bug", "Docs", "bui", "Build"]);
		} finally {
			update.mockRestore();
		}
	});

	it("dismisses label suggestions before Escape cancels a full edit", async () => {
		const container = await mountPage(task, { availableLabels: ["Bug"] });
		await click(findButton(container, "Edit")!);
		const input = container.querySelector<HTMLInputElement>("#chip-input-labels")!;
		await act(async () => setNativeInputValue(input, "b"));
		await press(input, "ArrowUp");
		expect(container.querySelector('[role="option"][aria-selected="true"]')?.textContent).toBe("Bug");
		await press(input, "Escape");
		expect(container.querySelector('[role="listbox"]')).toBeNull();
		expect(findButton(container, "Save")).toBeTruthy();
		await press(input, "Escape");
		expect(findButton(container, "Edit")).toBeTruthy();
	});

	it("keeps Escape active inside full-edit inputs", async () => {
		const container = await mountPage();
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
			const container = await mountPage();
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

	it("closes on Escape outside edit mode, and leaves an Escape that closes the More actions menu to the menu", async () => {
		let closes = 0;
		const container = await mountPage(task, { onArchive: () => {}, onClose: () => (closes += 1) });
		await openMoreActions(container);
		const item = container.querySelector("[role='menuitem']") as HTMLElement;
		const menuEvent = await press(item, "Escape");
		expect(menuEvent.defaultPrevented).toBe(true);
		expect(container.querySelector("[role='menu']")).toBeNull();
		expect(closes).toBe(0);

		await press(taskPageOf(container), "Escape");
		expect(closes).toBe(1);
	});

	it("leaves an Escape that closes the dependency suggestions to them, and closes on the next one", async () => {
		let closes = 0;
		const dependency: Task = { ...task, id: "BACK-559", title: "Picked dependency" };
		const container = await mountPage(task, { availableTasks: [task, dependency], onClose: () => (closes += 1) });
		const field = container.querySelector("#dependency-input") as HTMLTextAreaElement;
		await act(async () => setNativeInputValue(field, "Picked"));
		expect(container.textContent).toContain("Picked dependency");

		await press(field, "Escape");
		expect(container.textContent).not.toContain("Picked dependency");
		expect(closes).toBe(0);

		await press(field, "Escape");
		expect(closes).toBe(1);
	});

	it("leaves keys pressed outside the task page alone", async () => {
		let closes = 0;
		const container = await mountPage(task, { onClose: () => (closes += 1) });
		const outside = findButton(container, "Outside the task") as HTMLButtonElement;

		for (const key of ["e", "Escape"]) {
			const event = await press(outside, key);
			expect(event.defaultPrevented, key).toBe(false);
		}
		expect(findButton(container, "Edit")).toBeTruthy();
		expect(closes).toBe(0);
	});

	it("changes the title only in edit mode, and saves it with the other edited fields", async () => {
		const update = spyOn(apiClient, "updateTask").mockImplementation(
			async (_id, updates) => ({ ...task, ...updates }) as Task,
		);
		try {
			const container = await mountPage();
			expect(container.querySelector("article h2")?.textContent).toBe(task.title);
			expect(container.querySelector("input[aria-label='Title']")).toBeNull();

			await press(taskPageOf(container), "e");
			const titleField = container.querySelector("input[aria-label='Title']") as HTMLInputElement;
			expect(titleField.value).toBe(task.title);
			await act(async () => setNativeInputValue(titleField, "Renamed in edit mode"));
			await press(titleField, "s", { metaKey: true });
			await waitFor(() => Boolean(findButton(container, "Edit")));

			expect(update).toHaveBeenCalledTimes(1);
			expect(update.mock.lastCall?.[1].title).toBe("Renamed in edit mode");
			expect(container.querySelector("article h2")?.textContent).toBe("Renamed in edit mode");
		} finally {
			update.mockRestore();
		}
	});

	it("keeps the page's keys working after Save or Cancel removes the field that had focus", async () => {
		const update = spyOn(apiClient, "updateTask").mockImplementation(
			async (_id, updates) => ({ ...task, ...updates }) as Task,
		);
		// Keys go wherever focus is, as on a real keyboard.
		const pressFocused = (key: string, init: KeyboardEventInit = {}) =>
			press(document.activeElement as Element, key, init);
		try {
			const container = await mountPage();
			await pressFocused("e");
			const titleField = container.querySelector("input[aria-label='Title']") as HTMLInputElement;
			await act(async () => setNativeInputValue(titleField, "Saved from the title field"));
			await press(titleField, "s", { metaKey: true });
			await waitFor(() => Boolean(findButton(container, "Edit")));
			// The title field became the heading, so focus is back on the page rather than lost to the document.
			expect(document.activeElement).toBe(taskPageOf(container));

			await pressFocused("e");
			expect(findButton(container, "Save")).toBeTruthy();
			await press(container.querySelector("input[aria-label='Title']") as HTMLInputElement, "Escape");
			expect(findButton(container, "Edit")).toBeTruthy();
			expect(document.activeElement).toBe(taskPageOf(container));
		} finally {
			update.mockRestore();
		}
	});

	it("leaves focus the person moved out of the page where it is when the page changes", async () => {
		const container = await mountPage();
		expect(document.activeElement).toBe(taskPageOf(container));
		// A click on empty space outside the page, the sidebar's say, leaves focus on the document body.
		act(() => (document.activeElement as HTMLElement).blur());
		expect(document.activeElement).toBe(document.body);

		// A live update of the task file changes what the page shows.
		await act(async () => {
			activeRoot?.render(
				<MemoryRouter initialEntries={[`/tasks/${task.id}`]}>
					<ThemeProvider>
						<button type="button">Outside the task</button>
						<TaskDetails task={{ ...task, description: "Written in the file meanwhile" }} onClose={() => {}} />
					</ThemeProvider>
				</MemoryRouter>,
			);
			await Promise.resolve();
		});
		expect(container.textContent).toContain("Written in the file meanwhile");
		expect(document.activeElement).toBe(document.body);
	});

	it("leaves focus on More actions when an action from it is cancelled", async () => {
		const container = await mountPage(task, { onArchive: () => {} });
		window.confirm = () => false;
		const menuButton = container.querySelector("button[aria-label='More actions']") as HTMLButtonElement;
		menuButton.focus();
		await openMoreActions(container);
		const archive = Array.from(container.querySelectorAll<HTMLButtonElement>("[role='menuitem']")).find(
			(item) => item.textContent === "Archive",
		) as HTMLButtonElement;
		archive.focus();
		await click(archive);

		expect(container.querySelector("[role='menu']")).toBeNull();
		expect(document.activeElement).toBe(menuButton);
	});

	it("leaves edit mode without a request when Save finds nothing changed", async () => {
		const update = spyOn(apiClient, "updateTask").mockImplementation(async () => task);
		try {
			const container = await mountPage();
			await click(findButton(container, "Edit") as HTMLButtonElement);
			await click(findButton(container, "Save") as HTMLButtonElement);
			await waitFor(() => Boolean(findButton(container, "Edit")));

			expect(findButton(container, "Edit")).toBeTruthy();
			expect(update).not.toHaveBeenCalled();
		} finally {
			update.mockRestore();
		}
	});
});
