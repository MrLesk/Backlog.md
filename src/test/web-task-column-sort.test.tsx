import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import TaskColumn from "../web/components/TaskColumn.tsx";
import type { ReorderTaskPayload } from "../web/lib/api.ts";

const createTask = (overrides: Partial<Task>): Task => ({
	id: "TASK-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	...overrides,
});

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
};

const renderTaskColumn = (
	tasks: Task[],
	onTaskReorder: (payload: ReorderTaskPayload) => void,
	options: { title?: string; onCleanup?: () => void } = {},
): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<TaskColumn
				title={options.title ?? "To Do"}
				tasks={tasks}
				onTaskUpdate={() => {}}
				onEditTask={() => {}}
				onTaskReorder={onTaskReorder}
				onCleanup={options.onCleanup}
			/>,
		);
	});
	return container as HTMLElement;
};

const clickElement = async (element: Element) => {
	await act(async () => {
		element.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
};

const openActionsMenu = async (container: HTMLElement) => {
	const actionsButton = container.querySelector("button[title='Column actions']");
	expect(actionsButton).toBeTruthy();
	await clickElement(actionsButton as Element);
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("TaskColumn priority sorting", () => {
	it("emits a full-column reorder payload sorted by priority", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderTaskColumn(
			[
				createTask({ id: "TASK-1", title: "Low", priority: "low" }),
				createTask({ id: "TASK-2", title: "High", priority: "high" }),
				createTask({ id: "TASK-3", title: "None" }),
				createTask({ id: "TASK-4", title: "Medium", priority: "medium" }),
			],
			(payload) => payloads.push(payload),
		);

		await openActionsMenu(container);
		const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Sort by Priority"),
		);
		expect(sortButton).toBeTruthy();
		await clickElement(sortButton as Element);

		expect(payloads).toEqual([
			{
				taskId: "TASK-2",
				targetStatus: "To Do",
				orderedTaskIds: ["TASK-2", "TASK-4", "TASK-1", "TASK-3"],
			},
		]);
	});

	it("does not emit a reorder payload when priority order is unchanged", async () => {
		const payloads: ReorderTaskPayload[] = [];
		const container = renderTaskColumn(
			[
				createTask({ id: "TASK-2", title: "High", priority: "high" }),
				createTask({ id: "TASK-4", title: "Medium", priority: "medium" }),
				createTask({ id: "TASK-1", title: "Low", priority: "low" }),
				createTask({ id: "TASK-3", title: "None" }),
			],
			(payload) => payloads.push(payload),
		);

		await openActionsMenu(container);
		const sortButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Sort by Priority"),
		);
		expect(sortButton).toBeTruthy();
		await clickElement(sortButton as Element);

		expect(payloads).toEqual([]);
	});
});

describe("TaskColumn cleanup affordance", () => {
	it("renders cleanup when supplied for a non-Done terminal column", async () => {
		let cleanupCalls = 0;
		const container = renderTaskColumn([createTask({ status: "Closed" })], () => {}, {
			title: "Closed",
			onCleanup: () => {
				cleanupCalls += 1;
			},
		});

		const cleanupButton = Array.from(container.querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Clean Up Old Tasks"),
		);
		expect(cleanupButton).toBeTruthy();

		await clickElement(cleanupButton as Element);
		expect(cleanupCalls).toBe(1);
	});
});
