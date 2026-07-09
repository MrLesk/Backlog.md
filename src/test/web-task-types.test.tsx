import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard.tsx";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { apiClient, type TaskUpdateRequest } from "../web/lib/api.ts";

const createTask = (overrides: Partial<Task> = {}): Task => ({
	id: "TASK-1",
	title: "Typed task",
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

function setupDom(): HTMLElement {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
	});
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
		const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
		input.focus();
		valueSetter?.call(input, value);
		input.dispatchEvent(new window.InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
		input.dispatchEvent(new window.Event("change", { bubbles: true }));
		const reactPropsKey = Object.keys(input).find((key) => key.startsWith("__reactProps$"));
		if (reactPropsKey) {
			const reactProps = (input as unknown as Record<string, { onChange?: (event: { target: HTMLInputElement }) => void }>)[
				reactPropsKey
			];
			reactProps?.onChange?.({ target: input });
		}
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

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempts = 0; attempts < 20; attempts += 1) {
		if (predicate()) return;
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
	expect(predicate()).toBe(true);
}

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	apiClient.fetchStatuses = originalFetchStatuses;
	apiClient.fetchTasks = originalFetchTasks;
	apiClient.updateTask = originalUpdateTask;
});

describe("Web task type UI", () => {
	it("shows distinct type badges on cards and no badge for untyped tasks", () => {
		const bugHtml = renderToString(
			<TaskCard task={createTask({ type: "bug" })} onUpdate={() => {}} onEdit={() => {}} />,
		);
		const featureHtml = renderToString(
			<TaskCard task={createTask({ type: "feature" })} onUpdate={() => {}} onEdit={() => {}} />,
		);
		const customHtml = renderToString(
			<TaskCard
				task={createTask({ type: "Customer Request" })}
				onUpdate={() => {}}
				onEdit={() => {}}
				availableTypes={["Bug", "Customer Request", "Docs"]}
			/>,
		);
		const docsHtml = renderToString(
			<TaskCard
				task={createTask({ type: "Docs" })}
				onUpdate={() => {}}
				onEdit={() => {}}
				availableTypes={["Bug", "Customer Request", "Docs"]}
			/>,
		);
		const untypedHtml = renderToString(<TaskCard task={createTask()} onUpdate={() => {}} onEdit={() => {}} />);

		expect(bugHtml).toContain('data-task-type="bug"');
		expect(bugHtml).toContain("bg-red-100");
		expect(featureHtml).toContain('data-task-type="feature"');
		expect(featureHtml).toContain("bg-blue-100");
		expect(customHtml).toContain('data-task-type="Customer Request"');
		expect(customHtml).toContain("bg-blue-100");
		expect(docsHtml).toContain("bg-cyan-100");
		expect(untypedHtml).not.toContain("data-task-type");
	});

	it("creates a task with a configured custom type and defaults to untyped", async () => {
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
						availableTypes={["Bug", "Customer Request"]}
					/>
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		const typeSelect = container.querySelector("select[aria-label='Task type']") as HTMLSelectElement | null;
		expect(typeSelect).toBeTruthy();
		expect(typeSelect?.value).toBe("");
		expect(Array.from(typeSelect?.options ?? []).map((option) => option.textContent)).toEqual([
			"No type",
			"Bug",
			"Customer Request",
		]);

		const titleInput = container.querySelector("input[placeholder='Enter task title']") as HTMLInputElement | null;
		expect(titleInput).toBeTruthy();
		await setInputValue(titleInput as HTMLInputElement, "Customer interview");
		await setSelectValue(typeSelect as HTMLSelectElement, "Customer Request");

		const createButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Create",
		);
		expect(createButton).toBeTruthy();
		await act(async () => {
			createButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await waitFor(() => submitted !== undefined);

		expect(submitted?.title).toBe("Customer interview");
		expect(submitted?.type).toBe("Customer Request");
	});

	it("updates type from the task detail selector and preserves removed configured values", async () => {
		const container = setupDom();
		const task = createTask({ type: "Legacy Type" });
		let receivedUpdate: TaskUpdateRequest | undefined;
		apiClient.updateTask = async (taskId, updates) => {
			expect(taskId).toBe(task.id);
			receivedUpdate = updates;
			return { ...task, type: typeof updates.type === "string" ? updates.type : task.type };
		};

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal
						task={task}
						isOpen
						onClose={() => {}}
						availableTypes={["Bug", "Feature"]}
					/>
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		const typeSelect = container.querySelector("select[aria-label='Task type']") as HTMLSelectElement | null;
		expect(typeSelect).toBeTruthy();
		expect(typeSelect?.value).toBe("Legacy Type");
		expect(Array.from(typeSelect?.options ?? []).map((option) => option.textContent)).toEqual([
			"No type",
			"Legacy Type (not configured)",
			"Bug",
			"Feature",
		]);

		await setSelectValue(typeSelect as HTMLSelectElement, "Feature");
		await waitFor(() => receivedUpdate !== undefined);

		expect(receivedUpdate).toEqual({ type: "Feature" });
	});
});
