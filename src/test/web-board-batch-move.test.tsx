import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Milestone, Task } from "../types/index.ts";
import Board from "../web/components/Board.tsx";
import { apiClient, type MoveTasksPayload } from "../web/lib/api.ts";

const STATUSES = ["To Do", "In Progress", "Done"];

const MILESTONE: Milestone = {
	id: "Release 1",
	title: "Release 1",
	description: "",
	rawContent: "",
};

const buildTask = (id: string, ordinal: number): Task => ({
	id,
	title: `Card ${id}`,
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-01-01",
	ordinal,
});

const TASKS = [buildTask("TASK-1", 1000), buildTask("TASK-2", 2000), buildTask("TASK-3", 3000)];

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

const renderBoard = (onEditTask: (task: Task) => void = () => {}): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<Board
				onEditTask={onEditTask}
				onNewTask={() => {}}
				tasks={TASKS}
				statuses={STATUSES}
				isLoading={false}
				milestones={[]}
				availableLabels={[]}
				milestoneEntities={[]}
				archivedMilestones={[]}
				laneMode="none"
				onLaneChange={() => {}}
			/>,
		);
	});
	return container as HTMLElement;
};

// A lane with no tasks is hidden, so the milestone lane needs a card of its own to exist at all.
const MILESTONE_TASKS = [TASKS[0], TASKS[1], { ...TASKS[2], milestone: MILESTONE.title }] as Task[];

const renderMilestoneBoard = (): HTMLElement => {
	setupDom();
	const container = document.getElementById("root");
	expect(container).toBeTruthy();
	activeRoot = createRoot(container as HTMLElement);
	act(() => {
		activeRoot?.render(
			<Board
				onEditTask={() => {}}
				onNewTask={() => {}}
				tasks={MILESTONE_TASKS}
				statuses={STATUSES}
				isLoading={false}
				milestones={[MILESTONE.title]}
				availableLabels={[]}
				milestoneEntities={[MILESTONE]}
				archivedMilestones={[]}
				laneMode="milestone"
				onLaneChange={() => {}}
			/>,
		);
	});
	return container as HTMLElement;
};

const getCard = (container: HTMLElement, taskId: string): HTMLElement => {
	const card = Array.from(container.querySelectorAll('[draggable="true"]')).find((element) =>
		element.textContent?.includes(taskId),
	);
	expect(card).toBeTruthy();
	return card as HTMLElement;
};

const selectedCardIds = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll('[aria-selected="true"]')).map(
		(element) => element.querySelector(".font-mono")?.textContent ?? "",
	);

const clickCard = async (card: HTMLElement, modifiers: { ctrlKey?: boolean; shiftKey?: boolean } = {}) => {
	await act(async () => {
		card.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, ...modifiers }));
		await Promise.resolve();
	});
};

const findButton = (container: HTMLElement, label: string): HTMLButtonElement => {
	const button = Array.from(container.querySelectorAll("button")).find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	expect(button).toBeTruthy();
	return button as HTMLButtonElement;
};

const dispatchDrop = (target: HTMLElement, data: Record<string, string>) => {
	const event = new window.Event("drop", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "dataTransfer", {
		value: { setData: () => {}, getData: (key: string) => data[key] ?? "", effectAllowed: "" },
	});
	target.dispatchEvent(event);
};

const getColumn = (container: HTMLElement, status: string): HTMLElement => {
	const heading = Array.from(container.querySelectorAll("h3")).find((element) => element.textContent === status);
	const column = heading?.closest(".rounded-lg");
	expect(column).toBeTruthy();
	return column as HTMLElement;
};

/** Milestone view renders one column per status per lane, so the column has to be found inside its lane. */
const getLaneColumn = (container: HTMLElement, laneLabel: string, status: string): HTMLElement => {
	const lane = Array.from(container.querySelectorAll("h3")).find(
		(heading) => heading.textContent?.trim() === laneLabel,
	);
	expect(lane).toBeTruthy();
	const laneRoot = lane?.closest(".rounded-lg.border") as HTMLElement | null;
	expect(laneRoot).toBeTruthy();
	const column = Array.from((laneRoot as HTMLElement).querySelectorAll("h3"))
		.find((heading) => heading.textContent === status)
		?.closest(".rounded-lg");
	expect(column).toBeTruthy();
	return column as HTMLElement;
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("Web board batch move", () => {
	it("adds a card to the selection on ctrl-click and removes it on a second ctrl-click", async () => {
		const container = renderBoard();

		await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
		await clickCard(getCard(container, "TASK-2"), { ctrlKey: true });
		expect(selectedCardIds(container)).toEqual(["TASK-1", "TASK-2"]);

		await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
		expect(selectedCardIds(container)).toEqual(["TASK-2"]);
	});

	it("selects the range between the anchor card and the shift-clicked card", async () => {
		const container = renderBoard();

		await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
		await clickCard(getCard(container, "TASK-3"), { shiftKey: true });

		expect(selectedCardIds(container)).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
	});

	it("marks a selected card in both the light and the dark theme", async () => {
		const container = renderBoard();

		await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });

		const card = getCard(container, "TASK-1");
		expect(card.className).toContain("ring-blue-500");
		expect(card.className).toContain("dark:ring-blue-400");
	});

	it("clears the selection on a click on empty board space", async () => {
		const container = renderBoard();

		await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
		expect(selectedCardIds(container)).toEqual(["TASK-1"]);

		const board = container.firstElementChild as HTMLElement;
		await act(async () => {
			board.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
			await Promise.resolve();
		});

		expect(selectedCardIds(container)).toEqual([]);
	});

	it("opens the task editor on a plain click", async () => {
		const opened: string[] = [];
		const container = renderBoard((task) => opened.push(task.id));

		await clickCard(getCard(container, "TASK-2"));

		expect(opened).toEqual(["TASK-2"]);
		expect(selectedCardIds(container)).toEqual([]);
	});

	it("clears the selection on Escape", async () => {
		const container = renderBoard();

		await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
		expect(selectedCardIds(container)).toEqual(["TASK-1"]);

		await act(async () => {
			document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			await Promise.resolve();
		});

		expect(selectedCardIds(container)).toEqual([]);
	});

	it("moves the whole selection through the toolbar", async () => {
		const originalMoveTasks = apiClient.moveTasks.bind(apiClient);
		const calls: MoveTasksPayload[] = [];
		apiClient.moveTasks = async (payload) => {
			calls.push(payload);
			return { success: true, tasks: [], changedTasks: [], failures: [] };
		};

		try {
			const container = renderBoard();
			await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
			await clickCard(getCard(container, "TASK-3"), { ctrlKey: true });

			const select = container.querySelector("#batch-move-status") as HTMLSelectElement;
			expect(select).toBeTruthy();
			await act(async () => {
				select.value = "Done";
				select.dispatchEvent(new window.Event("change", { bubbles: true }));
				await Promise.resolve();
			});

			await act(async () => {
				findButton(container, "Move").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
				await Promise.resolve();
			});

			expect(calls).toEqual([{ taskIds: ["TASK-1", "TASK-3"], targetStatus: "Done" }]);
			expect(selectedCardIds(container)).toEqual([]);
		} finally {
			apiClient.moveTasks = originalMoveTasks;
		}
	});

	it("moves the whole selection when one selected card is dragged", async () => {
		const originalMoveTasks = apiClient.moveTasks.bind(apiClient);
		const calls: MoveTasksPayload[] = [];
		apiClient.moveTasks = async (payload) => {
			calls.push(payload);
			return { success: true, tasks: [], changedTasks: [], failures: [] };
		};

		try {
			const container = renderBoard();
			await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
			await clickCard(getCard(container, "TASK-2"), { ctrlKey: true });

			await act(async () => {
				dispatchDrop(getColumn(container, "In Progress"), { "text/plain": "TASK-1", "text/status": "To Do" });
				await Promise.resolve();
			});

			expect(calls).toEqual([{ taskIds: ["TASK-1", "TASK-2"], targetStatus: "In Progress" }]);
		} finally {
			apiClient.moveTasks = originalMoveTasks;
		}
	});

	it("carries the milestone lane a batch is dropped into, exactly as a single-card drop does", async () => {
		const originalMoveTasks = apiClient.moveTasks.bind(apiClient);
		const calls: MoveTasksPayload[] = [];
		apiClient.moveTasks = async (payload) => {
			calls.push(payload);
			return { success: true, tasks: [], changedTasks: [], failures: [] };
		};

		try {
			const container = renderMilestoneBoard();
			await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
			await clickCard(getCard(container, "TASK-2"), { ctrlKey: true });

			await act(async () => {
				dispatchDrop(getLaneColumn(container, MILESTONE.title, "In Progress"), {
					"text/plain": "TASK-1",
					"text/status": "To Do",
				});
				await Promise.resolve();
			});

			expect(calls).toEqual([
				{ taskIds: ["TASK-1", "TASK-2"], targetStatus: "In Progress", targetMilestone: MILESTONE.title },
			]);
		} finally {
			apiClient.moveTasks = originalMoveTasks;
		}
	});

	it("clears the milestone when a batch is dropped into the no-milestone lane", async () => {
		const originalMoveTasks = apiClient.moveTasks.bind(apiClient);
		const calls: MoveTasksPayload[] = [];
		apiClient.moveTasks = async (payload) => {
			calls.push(payload);
			return { success: true, tasks: [], changedTasks: [], failures: [] };
		};

		try {
			const container = renderMilestoneBoard();
			await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
			await clickCard(getCard(container, "TASK-2"), { ctrlKey: true });

			await act(async () => {
				dispatchDrop(getLaneColumn(container, "Unassigned", "Done"), {
					"text/plain": "TASK-1",
					"text/status": "To Do",
				});
				await Promise.resolve();
			});

			expect(calls).toEqual([{ taskIds: ["TASK-1", "TASK-2"], targetStatus: "Done", targetMilestone: null }]);
		} finally {
			apiClient.moveTasks = originalMoveTasks;
		}
	});

	it("leaves the milestone alone when the toolbar moves the selection", async () => {
		const originalMoveTasks = apiClient.moveTasks.bind(apiClient);
		const calls: MoveTasksPayload[] = [];
		apiClient.moveTasks = async (payload) => {
			calls.push(payload);
			return { success: true, tasks: [], changedTasks: [], failures: [] };
		};

		try {
			const container = renderMilestoneBoard();
			await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });

			const select = container.querySelector("#batch-move-status") as HTMLSelectElement;
			await act(async () => {
				select.value = "Done";
				select.dispatchEvent(new window.Event("change", { bubbles: true }));
				await Promise.resolve();
			});
			await act(async () => {
				findButton(container, "Move").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
				await Promise.resolve();
			});

			expect(calls).toEqual([{ taskIds: ["TASK-1"], targetStatus: "Done" }]);
		} finally {
			apiClient.moveTasks = originalMoveTasks;
		}
	});

	// A range only ever adds to the selection, so a second shift-click reaches the same union whether
	// it extends from the first anchor or from the card just clicked. This pins that down so a later
	// change to replacing selections has to decide the anchor question deliberately.
	it("reaches the same selection from two shift-clicks in a row", async () => {
		const container = renderBoard();

		await clickCard(getCard(container, "TASK-2"), { ctrlKey: true });
		await clickCard(getCard(container, "TASK-1"), { shiftKey: true });
		await clickCard(getCard(container, "TASK-3"), { shiftKey: true });

		expect(selectedCardIds(container)).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
	});

	it("reports the tasks that failed to move", async () => {
		const originalMoveTasks = apiClient.moveTasks.bind(apiClient);
		apiClient.moveTasks = async () => ({
			success: false,
			tasks: [],
			changedTasks: [],
			failures: [{ taskId: "TASK-2", reason: "Task TASK-2 not found." }],
		});

		try {
			const container = renderBoard();
			await clickCard(getCard(container, "TASK-1"), { ctrlKey: true });
			await clickCard(getCard(container, "TASK-2"), { ctrlKey: true });

			await act(async () => {
				dispatchDrop(getColumn(container, "Done"), { "text/plain": "TASK-1", "text/status": "To Do" });
				await Promise.resolve();
			});

			expect(container.textContent).toContain("TASK-2");
			expect(container.textContent).toContain("Could not move 1 of 2 tasks");
		} finally {
			apiClient.moveTasks = originalMoveTasks;
		}
	});
});
