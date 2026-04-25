import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import MilestonesPage from "../web/components/MilestonesPage.tsx";
import { apiClient } from "../web/lib/api.ts";

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

const milestoneEntities: Milestone[] = [
	{
		id: "m-1",
		title: "Release 1",
		description: "Milestone: Release 1",
		rawContent: "## Description\n\nMilestone: Release 1",
	},
	{
		id: "m-2",
		title: "Release 2",
		description: "Milestone: Release 2",
		rawContent: "## Description\n\nMilestone: Release 2",
	},
];

const baseTasks: Task[] = [
	createTask({ id: "task-101", title: "Setup authentication flow", status: "In Progress", milestone: "m-1" }),
	createTask({ id: "task-202", title: "Deploy pipeline", status: "To Do", milestone: "m-1" }),
	createTask({ id: "task-404", title: "Ship docs site", status: "To Do", milestone: "m-2" }),
	createTask({ id: "task-303", title: "Draft release notes", status: "To Do" }),
];

let activeRoot: Root | null = null;
const originalUpdateMilestone = apiClient.updateMilestone.bind(apiClient);
const originalRemoveMilestone = apiClient.removeMilestone.bind(apiClient);

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
	globalThis.localStorage = dom.window.localStorage as unknown as Storage;

	if (!window.matchMedia) {
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
	}

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
	}
	if (typeof htmlElementPrototype.detachEvent !== "function") {
		htmlElementPrototype.detachEvent = () => {};
	}
};

const renderPage = (
	tasks: Task[] = baseTasks,
	options: {
		onRefreshData?: () => Promise<void>;
	} = {},
): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<MemoryRouter>
				<MilestonesPage
					tasks={tasks}
					statuses={["To Do", "In Progress", "Done"]}
					milestoneEntities={milestoneEntities}
					archivedMilestones={[]}
					onEditTask={() => {}}
					onRefreshData={options.onRefreshData}
				/>
			</MemoryRouter>,
		);
	});
	return container as HTMLElement;
};

const getSearchInput = (container: HTMLElement): HTMLInputElement => {
	const input = container.querySelector("input[aria-label='Search milestones']");
	expect(input).toBeTruthy();
	return input as HTMLInputElement;
};

const setSearchValue = (container: HTMLElement, value: string) => {
	const input = getSearchInput(container);
	act(() => {
		input.value = value;
		input.dispatchEvent(new window.Event("input", { bubbles: true }));
	});
};

const clickElement = (element: Element) => {
	act(() => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
};

const setInputValue = (input: HTMLInputElement, value: string) => {
	act(() => {
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
		valueSetter?.call(input, value);
		input.dispatchEvent(new window.Event("input", { bubbles: true }));
		input.dispatchEvent(new window.Event("change", { bubbles: true }));
	});
};

const submitForm = async (form: HTMLFormElement) => {
	await act(async () => {
		form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
		await Promise.resolve();
	});
};

const clickElementAsync = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	apiClient.updateMilestone = originalUpdateMilestone;
	apiClient.removeMilestone = originalRemoveMilestone;
});

describe("Web milestones page search", () => {
	it("renders a keyboard-focusable search input near the header", () => {
		const container = renderPage();
		expect(container.textContent).toContain("Milestones");

		const input = getSearchInput(container);
		expect(input.disabled).toBe(false);

		input.focus();
		expect(document.activeElement).toBe(input);
	});

	it("searching one milestone still renders other milestone sections", () => {
		const container = renderPage();
		const initialText = container.textContent ?? "";
		expect(initialText).toContain("Setup authentication flow");
		expect(initialText).toContain("Deploy pipeline");
		expect(initialText).toContain("Ship docs site");
		expect(initialText).toContain("Draft release notes");
		expect(initialText).toContain("Release 1");
		expect(initialText).toContain("Release 2");

		setSearchValue(container, "authentication");
		const filteredText = container.textContent ?? "";
		expect(filteredText).toContain("Release 1");
		expect(filteredText).toContain("Release 2");
		expect(filteredText).toContain("Setup authentication flow");
		expect(filteredText).not.toContain("Deploy pipeline");
		expect(filteredText).not.toContain("Ship docs site");
		expect(filteredText).toContain("No tasks");
	});

	it("keeps unassigned section visible during search even when no unassigned tasks match", () => {
		const container = renderPage();

		setSearchValue(container, "task-404");
		const filteredText = container.textContent ?? "";
		expect(filteredText).toContain("Unassigned tasks");
		expect(filteredText).toContain("No matching unassigned tasks.");
		expect(filteredText).not.toContain("Draft release notes");

		const clearSearchButton = container.querySelector("button[aria-label='Clear milestone search']");
		expect(clearSearchButton).toBeTruthy();
		clickElement(clearSearchButton as HTMLButtonElement);

		const restoredText = container.textContent ?? "";
		expect(restoredText).toContain("Setup authentication flow");
		expect(restoredText).toContain("Deploy pipeline");
		expect(restoredText).toContain("Draft release notes");
	});

	it("no-match search keeps milestone and unassigned sections visible", () => {
		const container = renderPage();

		setSearchValue(container, "zzzz-no-match");
		const noMatchText = container.textContent ?? "";
		expect(noMatchText).toContain('No milestones or tasks match "zzzz-no-match".');
		expect(noMatchText).toContain("Release 1");
		expect(noMatchText).toContain("Release 2");
		expect(noMatchText).toContain("Unassigned tasks");
	});

	it("opens an edit modal from each milestone card", () => {
		const container = renderPage();
		const editButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
			button.textContent?.includes("Edit"),
		);
		expect(editButtons.length).toBeGreaterThanOrEqual(2);

		clickElement(editButtons[0] as HTMLButtonElement);

		expect(container.textContent).toContain("Edit milestone");
		const input = container.querySelector("#edit-milestone-name") as HTMLInputElement | null;
		expect(input).toBeTruthy();
		expect(input?.value).toBe("Release 2");
	});

	it("opens a remove confirmation with clear and reassign choices", () => {
		const container = renderPage();
		const removeButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
			button.textContent?.includes("Remove"),
		);
		expect(removeButtons.length).toBeGreaterThanOrEqual(2);

		clickElement(removeButtons[0] as HTMLButtonElement);

		const text = container.textContent ?? "";
		expect(text).toContain("Remove milestone");
		expect(text).toContain("Leave tasks unassigned");
		expect(text).toContain("Reassign tasks");

		const select = container.querySelector("select") as HTMLSelectElement | null;
		expect(select).toBeTruthy();
		expect(Array.from(select?.options ?? []).map((option) => option.value)).toContain("m-1");
	});

	it("submits milestone edits through the API and refreshes data", async () => {
		let updateArgs: [string, string] | undefined;
		let refreshCount = 0;
		apiClient.updateMilestone = async (id: string, title: string) => {
			updateArgs = [id, title];
			return { success: true, milestone: { ...milestoneEntities[1]!, title } };
		};

		const container = renderPage(baseTasks, {
			onRefreshData: async () => {
				refreshCount += 1;
			},
		});
		const editButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
			button.textContent?.includes("Edit"),
		);
		clickElement(editButtons[0] as HTMLButtonElement);

		const input = container.querySelector("#edit-milestone-name") as HTMLInputElement | null;
		expect(input).toBeTruthy();
		setInputValue(input as HTMLInputElement, "Release 2.1");
		await submitForm(input?.closest("form") as HTMLFormElement);

		expect(updateArgs?.[0]).toBe("m-2");
		expect(updateArgs?.[1]).toBe("Release 2.1");
		expect(refreshCount).toBe(1);
	});

	it("submits milestone removal with reassign options through the API", async () => {
		let removeArgs: [
			string,
			{ taskHandling?: "clear" | "keep" | "reassign"; reassignTo?: string } | undefined,
		] | undefined;
		let refreshCount = 0;
		apiClient.removeMilestone = async (id, options) => {
			removeArgs = [id, options];
			return { success: true };
		};

		const container = renderPage(baseTasks, {
			onRefreshData: async () => {
				refreshCount += 1;
			},
		});
		const removeButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
			button.textContent?.includes("Remove"),
		);
		clickElement(removeButtons[0] as HTMLButtonElement);

		const reassignRadio = container.querySelector("input[value='reassign']") as HTMLInputElement | null;
		expect(reassignRadio).toBeTruthy();
		clickElement(reassignRadio as HTMLInputElement);
		const select = container.querySelector("select") as HTMLSelectElement | null;
		expect(select).toBeTruthy();
		act(() => {
			if (select) {
				select.value = "m-1";
				select.dispatchEvent(new window.Event("change", { bubbles: true }));
			}
		});
		const submitButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Remove milestone",
		);
		expect(submitButton).toBeTruthy();
		await clickElementAsync(submitButton as HTMLButtonElement);

		expect(removeArgs?.[0]).toBe("m-2");
		expect(removeArgs?.[1]).toEqual({ taskHandling: "reassign", reassignTo: "m-1" });
		expect(refreshCount).toBe(1);
	});

	it("keeps milestone archive available as a separate action", () => {
		const container = renderPage();
		const archiveButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
			button.textContent?.includes("Archive"),
		);
		expect(archiveButtons.length).toBeGreaterThanOrEqual(2);
	});
});
