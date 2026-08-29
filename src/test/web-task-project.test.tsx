import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { BrowserRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import BoardPage from "../web/components/BoardPage.tsx";
import TaskCard from "../web/components/TaskCard.tsx";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { apiClient, type TaskUpdateRequest } from "../web/lib/api.ts";
import { setNativeInputValue } from "./react-dom-input.ts";

const createTask = (overrides: Partial<Task> = {}): Task => ({
	id: "TASK-1",
	title: "Projected task",
	status: "To Do",
	assignee: [],
	createdDate: "2026-07-09",
	labels: [],
	dependencies: [],
	...overrides,
});

const originalFetchStatuses = apiClient.fetchStatuses.bind(apiClient);
const originalFetchTasks = apiClient.fetchTasks.bind(apiClient);
const originalUpdateTask = apiClient.updateTask.bind(apiClient);
let activeRoot: Root | null = null;

function setupDom(url = "http://localhost"): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.HTMLInputElement = dom.window.HTMLInputElement;
	globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
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
	htmlElementPrototype.attachEvent ??= () => {};
	htmlElementPrototype.detachEvent ??= () => {};

	apiClient.fetchStatuses = async () => ["To Do", "In Progress", "Done"];
	apiClient.fetchTasks = async () => [];

	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	return container as HTMLElement;
}

async function setInputValue(input: HTMLInputElement, value: string): Promise<void> {
	await act(async () => {
		setNativeInputValue(input, value);
		await Promise.resolve();
	});
}

async function setSelectValue(select: HTMLSelectElement, value: string): Promise<void> {
	await act(async () => {
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
		valueSetter?.call(select, value);
		select.dispatchEvent(new window.Event("change", { bubbles: true }));
		await Promise.resolve();
	});
}

const WAIT_FOR_TIMEOUT_MS = 4000;

async function waitFor(predicate: () => boolean): Promise<void> {
	const deadline = Date.now() + WAIT_FOR_TIMEOUT_MS;
	while (!predicate()) {
		if (Date.now() >= deadline) {
			throw new Error(`Timed out after ${WAIT_FOR_TIMEOUT_MS}ms waiting for ${predicate}`);
		}
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
		});
	}
}

const getSelectByFirstOption = (container: HTMLElement, firstOptionText: string): HTMLSelectElement => {
	const select = Array.from(container.querySelectorAll("select")).find(
		(element) => element.options[0]?.textContent === firstOptionText,
	);
	expect(select).toBeTruthy();
	return select as HTMLSelectElement;
};

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	apiClient.fetchStatuses = originalFetchStatuses;
	apiClient.fetchTasks = originalFetchTasks;
	apiClient.updateTask = originalUpdateTask;
});

describe("Web task project UI", () => {
	it("shows a project badge on cards and no badge for unprojected tasks", () => {
		const webHtml = renderToString(
			<TaskCard
				task={createTask({ project: "Web" })}
				onUpdate={() => {}}
				onEdit={() => {}}
				availableProjects={["Web"]}
			/>,
		);
		const untaggedHtml = renderToString(
			<TaskCard task={createTask()} onUpdate={() => {}} onEdit={() => {}} availableProjects={["Web"]} />,
		);

		expect(webHtml).toContain('data-task-project="Web"');
		expect(untaggedHtml).not.toContain("data-task-project");
	});

	it("hides the project badge when no projects are configured, even if the task has one", () => {
		const html = renderToString(
			<TaskCard task={createTask({ project: "Web" })} onUpdate={() => {}} onEdit={() => {}} />,
		);

		expect(html).not.toContain("data-task-project");
	});

	it("omits the project select from the task detail modal when no projects are configured", async () => {
		const container = setupDom();
		const task = createTask({ project: undefined });

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal task={task} isOpen onClose={() => {}} />
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		const projectSelect = Array.from(container.querySelectorAll("select")).find(
			(element) => element.options[0]?.textContent === "No Project",
		);
		expect(projectSelect).toBeUndefined();
	});

	it("shows a project select with a No Project default and immediately saves changes", async () => {
		const container = setupDom();
		const task = createTask({ project: undefined });
		const receivedUpdates: TaskUpdateRequest[] = [];
		apiClient.updateTask = async (_taskId, updates) => {
			receivedUpdates.push(updates);
			return { ...task, project: typeof updates.project === "string" && updates.project ? updates.project : undefined };
		};

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal task={task} isOpen onClose={() => {}} availableProjects={["Web", "API"]} />
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		const projectSelect = getSelectByFirstOption(container, "No Project");
		expect(Array.from(projectSelect.options).map((option) => option.textContent)).toEqual([
			"No Project",
			"Web",
			"API",
		]);
		expect(projectSelect.value).toBe("");

		await setSelectValue(projectSelect, "Web");
		await waitFor(() => receivedUpdates.length === 1);
		expect(receivedUpdates[0]).toEqual({ project: "Web" });
	});

	// The project select only renders when projects are configured, so an edit-mode Save must
	// not carry project at all: otherwise saving a task in a repo with no projects: silently
	// cleared a stored value the form never showed, and a value no longer in the config list
	// failed the whole save with "Invalid project".
	it("omits project from an edit-mode save so an unshown value survives", async () => {
		const container = setupDom();
		const task = createTask({ project: "Retired" });
		const receivedUpdates: TaskUpdateRequest[] = [];
		apiClient.updateTask = async (_taskId, updates) => {
			receivedUpdates.push(updates);
			return task;
		};

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal task={task} isOpen onClose={() => {}} />
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		const clickButton = async (label: string) => {
			const button = Array.from(container.querySelectorAll("button")).find(
				(element) => element.textContent?.trim() === label,
			);
			expect(button).toBeTruthy();
			await act(async () => {
				button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
				await Promise.resolve();
			});
		};

		await clickButton("Edit");
		await clickButton("Save");
		await waitFor(() => receivedUpdates.length === 1);

		expect(receivedUpdates[0]).not.toHaveProperty("project");
	});

	it("creates a task with a configured project", async () => {
		const container = setupDom();
		let submitted: Partial<Task> | undefined;
		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal
						isOpen
						onClose={() => {}}
						onSubmit={async (taskData) => {
							submitted = taskData;
						}}
						availableStatuses={["To Do", "In Progress", "Done"]}
						availableProjects={["Web", "API"]}
					/>
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		const projectSelect = getSelectByFirstOption(container, "No Project");
		const titleInput = container.querySelector("input[placeholder='Enter task title']") as HTMLInputElement | null;
		expect(titleInput).toBeTruthy();
		await setInputValue(titleInput as HTMLInputElement, "API onboarding");
		await setSelectValue(projectSelect, "API");

		const createButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Create",
		);
		expect(createButton).toBeTruthy();
		await act(async () => {
			createButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await waitFor(() => submitted !== undefined);

		expect(submitted?.title).toBe("API onboarding");
		expect(submitted?.project).toBe("API");
	});
});

describe("Web board project filter", () => {
	const tasks: Task[] = [
		createTask({ id: "task-101", title: "Web task", project: "Web" }),
		createTask({ id: "task-102", title: "API task", project: "API" }),
		createTask({ id: "task-103", title: "Unprojected task" }),
	];

	const renderBoardPage = (url: string | undefined, availableProjects: string[] | undefined): HTMLElement => {
		const container = setupDom(url ?? "http://localhost/board");
		activeRoot = createRoot(container);
		act(() => {
			activeRoot?.render(
				<BrowserRouter>
					<BoardPage
						tasks={tasks}
						statuses={["To Do", "In Progress", "Done"]}
						milestones={[]}
						availableLabels={[]}
						milestoneEntities={[]}
						archivedMilestones={[]}
						isLoading={false}
						onEditTask={() => {}}
						onNewTask={() => {}}
						availableProjects={availableProjects}
					/>
				</BrowserRouter>,
			);
		});
		return container;
	};

	it("omits the project filter select when no projects are configured", () => {
		const container = renderBoardPage(undefined, undefined);
		expect(container.querySelector("select[aria-label='Filter board by project']")).toBeNull();
	});

	it("filters board cards by project and updates the URL", async () => {
		const container = renderBoardPage(undefined, ["Web", "API"]);

		const projectSelect = container.querySelector(
			"select[aria-label='Filter board by project']",
		) as HTMLSelectElement | null;
		expect(projectSelect).toBeTruthy();
		expect(Array.from(projectSelect?.options ?? []).map((option) => option.textContent)).toEqual([
			"All projects",
			"Web",
			"API",
		]);

		await setSelectValue(projectSelect as HTMLSelectElement, "Web");
		expect(new URLSearchParams(window.location.search).get("project")).toBe("Web");
		const text = container.textContent ?? "";
		expect(text).toContain("Web task");
		expect(text).not.toContain("API task");
		expect(text).not.toContain("Unprojected task");
	});

	it("clears unsupported project URL values", async () => {
		const container = renderBoardPage("http://localhost/board?project=mobile", ["Web", "API"]);

		await waitFor(() => new URLSearchParams(window.location.search).get("project") === null);

		const projectSelect = container.querySelector(
			"select[aria-label='Filter board by project']",
		) as HTMLSelectElement | null;
		expect(projectSelect?.value).toBe("");
		const text = container.textContent ?? "";
		expect(text).toContain("Web task");
		expect(text).toContain("API task");
		expect(text).toContain("Unprojected task");
	});
});
