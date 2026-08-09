import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import { apiClient } from "../web/lib/api.ts";
import Board from "../web/components/Board.tsx";

// jsdom has no drag controller, so it cannot show the browser bug this guards: Chromium aborts a
// native drag whose dragstart handler mutates the board layout, which is what re-showing the
// hidden columns inside the event used to do. What jsdom can prove is the invariant that avoids
// it - dragstart leaves the rendered columns untouched, and the hidden ones only arrive on a later
// task - plus that they really do become drop targets once they arrive. The drag surviving in a
// real browser was verified by hand in Chromium (see the task record).

const STATUSES = ["To Do", "In Progress", "Done", "Blocked"];

const draggedTask: Task = {
	id: "task-1",
	title: "Draggable card",
	status: "In Progress",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
};

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost/board",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
};

const renderBoard = (options: {
	hideEmptyColumns: boolean;
	onTasksUpdated?: (tasks: Task[], requestTask: Task) => void;
}): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<Board
				onEditTask={() => {}}
				onNewTask={() => {}}
				tasks={[draggedTask]}
				statuses={STATUSES}
				isLoading={false}
				milestones={[]}
				availableLabels={[]}
				milestoneEntities={[]}
				archivedMilestones={[]}
				laneMode="none"
				onLaneChange={() => {}}
				hideEmptyColumns={options.hideEmptyColumns}
				onTasksUpdated={options.onTasksUpdated}
			/>,
		);
	});
	return container as HTMLElement;
};

const renderedColumns = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll("h3")).map((heading) => heading.textContent ?? "");

const getCard = (container: HTMLElement): HTMLElement => {
	const card = container.querySelector('[draggable="true"]');
	expect(card).toBeTruthy();
	return card as HTMLElement;
};

const getColumn = (container: HTMLElement, status: string): HTMLElement => {
	const heading = Array.from(container.querySelectorAll("h3")).find((element) => element.textContent === status);
	const column = heading?.closest(".rounded-lg");
	expect(column).toBeTruthy();
	return column as HTMLElement;
};

const dispatchDragEvent = (target: HTMLElement, type: string, data: Record<string, string> = {}) => {
	const event = new window.Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, "dataTransfer", {
		value: {
			setData: (key: string, value: string) => {
				data[key] = value;
			},
			getData: (key: string) => data[key] ?? "",
			effectAllowed: "",
		},
	});
	target.dispatchEvent(event);
};

// The reveal is deferred by exactly one task, so a single macrotask hop is enough to observe it.
const flushTasks = async () => {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 0));
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

describe("Web board drag and drop with hidden empty columns", () => {
	it("leaves the rendered columns untouched during dragstart and reveals them on the next task", async () => {
		const container = renderBoard({ hideEmptyColumns: true });
		expect(renderedColumns(container)).toEqual(["In Progress"]);

		act(() => {
			dispatchDragEvent(getCard(container), "dragstart");
		});
		// Mutating the board here is what cancels the native drag in Chromium.
		expect(renderedColumns(container)).toEqual(["In Progress"]);

		await flushTasks();
		expect(renderedColumns(container)).toEqual(STATUSES);
	});

	it("drops onto a column that was hidden before the drag", async () => {
		const originalReorderTask = apiClient.reorderTask.bind(apiClient);
		const movedTask: Task = { ...draggedTask, status: "Done", ordinal: 1000 };
		const reorderCalls: Array<{ taskId: string; targetStatus: string }> = [];
		const publishedTasks: Task[] = [];
		apiClient.reorderTask = async (payload) => {
			reorderCalls.push({ taskId: payload.taskId, targetStatus: payload.targetStatus });
			return { success: true, task: movedTask, changedTasks: [movedTask] };
		};

		try {
			const container = renderBoard({
				hideEmptyColumns: true,
				onTasksUpdated: (changedTasks) => publishedTasks.push(...changedTasks),
			});
			const card = getCard(container);
			const transfer: Record<string, string> = {};

			act(() => {
				dispatchDragEvent(card, "dragstart", transfer);
			});
			await flushTasks();

			const doneColumn = getColumn(container, "Done");
			expect(doneColumn.textContent).toContain("Drop to move");

			await act(async () => {
				dispatchDragEvent(doneColumn, "dragover", transfer);
				dispatchDragEvent(doneColumn, "drop", transfer);
				await Promise.resolve();
			});

			expect(reorderCalls).toEqual([{ taskId: draggedTask.id, targetStatus: "Done" }]);
			expect(publishedTasks).toEqual([movedTask]);
		} finally {
			apiClient.reorderTask = originalReorderTask;
		}
	});

	it("hides the empty columns again once the drag ends", async () => {
		const container = renderBoard({ hideEmptyColumns: true });
		const card = getCard(container);

		act(() => {
			dispatchDragEvent(card, "dragstart");
		});
		await flushTasks();
		expect(renderedColumns(container)).toEqual(STATUSES);

		act(() => {
			dispatchDragEvent(card, "dragend");
		});
		expect(renderedColumns(container)).toEqual(["In Progress"]);

		// A drag that ends before the deferred reveal runs must not reveal anything afterwards.
		act(() => {
			dispatchDragEvent(card, "dragstart");
			dispatchDragEvent(card, "dragend");
		});
		await flushTasks();
		expect(renderedColumns(container)).toEqual(["In Progress"]);
	});

	it("keeps every column rendered throughout a drag when hideEmptyColumns is off", async () => {
		const container = renderBoard({ hideEmptyColumns: false });
		expect(renderedColumns(container)).toEqual(STATUSES);

		const card = getCard(container);
		act(() => {
			dispatchDragEvent(card, "dragstart");
		});
		expect(renderedColumns(container)).toEqual(STATUSES);

		await flushTasks();
		expect(renderedColumns(container)).toEqual(STATUSES);
		expect(getColumn(container, "Done").textContent).toContain("Drop to move");

		act(() => {
			dispatchDragEvent(card, "dragend");
		});
		expect(renderedColumns(container)).toEqual(STATUSES);
	});
});
