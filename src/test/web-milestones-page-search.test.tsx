import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import MilestonesPage from "../web/components/MilestonesPage.tsx";

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

const renderPage = (tasks: Task[] = baseTasks): HTMLElement => {
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

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
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
});
