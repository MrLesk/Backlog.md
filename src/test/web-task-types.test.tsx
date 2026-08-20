import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { installDomGlobals } from "./dom-globals.ts";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import TaskCard from "../web/components/TaskCard.tsx";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext.tsx";
import { apiClient, type TaskUpdateRequest } from "../web/lib/api.ts";
import { setNativeInputValue } from "./react-dom-input.ts";

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
	installDomGlobals(dom);
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

// A fixed number of event-loop turns is a budget of milliseconds on a fast machine and the
// same milliseconds on a slow one, so the wait is bounded by wall clock instead, and reports
// what it was waiting for rather than `expected true, received false`.
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
	it("displays and clears a task due date through the edit form", async () => {
		const container = setupDom();
		const task = createTask({ dueDate: "2026-08-10 14:30" });
		const receivedUpdates: TaskUpdateRequest[] = [];
		apiClient.updateTask = async (_taskId, updates) => {
			receivedUpdates.push(updates);
			return { ...task, dueDate: updates.dueDate ?? undefined };
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
		expect(container.textContent).toContain("Due (UTC):");

		const editButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Edit",
		);
		expect(editButton).toBeTruthy();
		await act(async () => {
			editButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});

		const dueDateInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement | null;
		expect(dueDateInput?.value).toBe("2026-08-10T14:30");
		await setInputValue(dueDateInput as HTMLInputElement, "");
		const saveButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Save",
		);
		await act(async () => {
			saveButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await waitFor(() => receivedUpdates.length === 1);
		expect(receivedUpdates[0]?.dueDate).toBeNull();
	});

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
		const datedHtml = renderToString(
			<TaskCard
				task={createTask({ dueDate: "2026-08-10 14:30" })}
				onUpdate={() => {}}
				onEdit={() => {}}
				dateFormat="dd/mm/yyyy hh:mm"
			/>,
		);

		expect(bugHtml).toContain('data-task-type="bug"');
		expect(bugHtml).toContain("bg-red-100");
		expect(featureHtml).toContain('data-task-type="feature"');
		expect(featureHtml).toContain("bg-blue-100");
		expect(customHtml).toContain('data-task-type="Customer Request"');
		expect(customHtml).toContain("bg-blue-100");
		expect(docsHtml).toContain("bg-cyan-100");
		expect(untypedHtml).not.toContain("data-task-type");
		expect(datedHtml).toContain("Due (UTC):");
		expect(datedHtml).toContain("10/08/2026 14:30");
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
		const dueDateInput = container.querySelector('input[type="datetime-local"]') as HTMLInputElement | null;
		expect(titleInput).toBeTruthy();
		expect(dueDateInput).toBeTruthy();
		await setInputValue(titleInput as HTMLInputElement, "Customer interview");
		await setInputValue(dueDateInput as HTMLInputElement, "2026-08-11T09:45");
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
		expect(submitted?.dueDate).toBe("2026-08-11T09:45");
		// A blank assignee field is omitted so the configured defaultAssignee still applies;
		// an explicit empty list means "unassigned" everywhere else.
		expect(submitted && "assignee" in submitted).toBe(false);
	});

	it("keeps the selected type visible when create validation fails", async () => {
		const container = setupDom();
		const errorMessage = "Invalid type: Feature. Valid types are: Bug";
		let closeCalls = 0;
		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal
						isOpen
						onClose={() => {
							closeCalls += 1;
						}}
						onSubmit={async () => {
							throw new Error(errorMessage);
						}}
						availableStatuses={["To Do", "In Progress", "Done"]}
						availableTypes={["Bug", "Feature"]}
					/>
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		const typeSelect = container.querySelector("select[aria-label='Task type']") as HTMLSelectElement;
		const titleInput = container.querySelector("input[placeholder='Enter task title']") as HTMLInputElement;
		await setInputValue(titleInput, "Stale configured type");
		await setSelectValue(typeSelect, "Feature");
		const createButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent?.trim() === "Create",
		);
		await act(async () => {
			createButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});
		await waitFor(() => container.querySelector("[role='alert']")?.textContent === errorMessage);

		expect(typeSelect.value).toBe("Feature");
		expect(closeCalls).toBe(0);
	});

	it("updates and clears type while preserving a removed value across a config refresh", async () => {
		const container = setupDom();
		const task = createTask({ type: "Legacy Type" });
		const receivedUpdates: TaskUpdateRequest[] = [];
		apiClient.updateTask = async (taskId, updates) => {
			expect(taskId).toBe(task.id);
			receivedUpdates.push(updates);
			return { ...task, type: typeof updates.type === "string" && updates.type ? updates.type : undefined };
		};

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal
							task={task}
							isOpen
							onClose={() => {}}
							availableTypes={["Legacy Type", "Bug", "Feature"]}
						/>
					</ThemeProvider>,
				);
			await Promise.resolve();
		});

		let typeSelect = container.querySelector("select[aria-label='Task type']") as HTMLSelectElement;
		expect(typeSelect.value).toBe("Legacy Type");
		expect(Array.from(typeSelect.options).map((option) => option.textContent)).toEqual([
			"No type",
			"Legacy Type",
			"Bug",
			"Feature",
		]);

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

		typeSelect = container.querySelector("select[aria-label='Task type']") as HTMLSelectElement;
		expect(typeSelect.value).toBe("Legacy Type");
		expect(Array.from(typeSelect.options).map((option) => option.textContent)).toEqual([
			"No type",
			"Legacy Type (not configured)",
			"Bug",
			"Feature",
		]);

		await setSelectValue(typeSelect, "Feature");
		await waitFor(() => receivedUpdates.length === 1);
		expect(receivedUpdates[0]).toEqual({ type: "Feature" });
		expect(typeSelect.value).toBe("Feature");

		await setSelectValue(typeSelect, "");
		await waitFor(() => receivedUpdates.length === 2);

		expect(receivedUpdates[1]).toEqual({ type: "" });
		expect(typeSelect.value).toBe("");
	});

	it("rolls back a rejected edit type and exposes the server error accessibly", async () => {
		const container = setupDom();
		const task = createTask({ type: "Bug" });
		const errorMessage = "Invalid type: Feature. Valid types are: Bug";
		let updateCalls = 0;
		let savedCalls = 0;
		apiClient.updateTask = async () => {
			updateCalls += 1;
			throw new Error(errorMessage);
		};

		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal
						task={task}
						isOpen
						onClose={() => {}}
						onSaved={async () => {
							savedCalls += 1;
						}}
						availableTypes={["Bug", "Feature"]}
					/>
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		const typeSelect = container.querySelector("select[aria-label='Task type']") as HTMLSelectElement;
		await setSelectValue(typeSelect, "Feature");
		await waitFor(() => container.querySelector("#task-type-update-error")?.textContent?.trim() === errorMessage);

		expect(updateCalls).toBe(1);
		expect(savedCalls).toBe(0);
		expect(typeSelect.value).toBe("Bug");
		expect(typeSelect.disabled).toBe(false);
		expect(typeSelect.getAttribute("aria-invalid")).toBe("true");
		expect(typeSelect.getAttribute("aria-describedby")).toBe("task-type-update-error");
		expect(container.querySelector("#task-type-update-error")?.getAttribute("role")).toBe("alert");
	});

	it("keeps an in-flight type write locked across same-task refreshes", async () => {
		const container = setupDom();
		const task = createTask({ type: "Bug" });
		let updateCalls = 0;
		let savedCalls = 0;
		let receivedUpdate: TaskUpdateRequest | undefined;
		let resolveUpdate: ((updatedTask: Task) => void) | undefined;
		const updateResult = new Promise<Task>((resolve) => {
			resolveUpdate = resolve;
		});
		apiClient.updateTask = async (taskId, updates) => {
			expect(taskId).toBe(task.id);
			updateCalls += 1;
			receivedUpdate = updates;
			return updateResult;
		};

		const renderModal = async (refreshedTask: Task, availableTypes: string[], availableStatuses: string[]) => {
			await act(async () => {
				activeRoot?.render(
					<ThemeProvider>
						<TaskDetailsModal
							task={refreshedTask}
							isOpen
							onClose={() => {}}
							onSaved={async () => {
								savedCalls += 1;
							}}
							availableTypes={availableTypes}
							availableStatuses={availableStatuses}
						/>
					</ThemeProvider>,
				);
				await Promise.resolve();
			});
		};

		activeRoot = createRoot(container);
		await renderModal(task, ["Bug", "feature"], ["To Do", "Done"]);
		let typeSelect = container.querySelector("select[aria-label='Task type']") as HTMLSelectElement;
		await setSelectValue(typeSelect, "feature");
		await waitFor(() => updateCalls === 1 && typeSelect.disabled);

		const refreshedTask = { ...task, description: "Refreshed while the type write is pending" };
		await renderModal(refreshedTask, ["Bug", "Feature"], ["Backlog", "To Do", "Done"]);
		typeSelect = container.querySelector("select[aria-label='Task type']") as HTMLSelectElement;
		expect(typeSelect.disabled).toBe(true);
		expect(typeSelect.value).toBe("Feature");

		await setSelectValue(typeSelect, "Bug");
		expect(updateCalls).toBe(1);
		expect(receivedUpdate).toEqual({ type: "feature" });

		await act(async () => {
			resolveUpdate?.({ ...refreshedTask, type: "Feature" });
			await updateResult;
			await Promise.resolve();
		});
		await waitFor(() => !typeSelect.disabled && typeSelect.value === "Feature");

		expect(updateCalls).toBe(1);
		expect(savedCalls).toBe(1);
	});
});
