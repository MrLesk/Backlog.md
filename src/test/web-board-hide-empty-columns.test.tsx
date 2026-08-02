import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Task } from "../types/index.ts";
import Board from "../web/components/Board.tsx";

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

const tasks: Task[] = [createTask({ id: "TASK-1", title: "Only task", status: "To Do" })];
const statuses = ["To Do", "In Progress", "Done"];

let activeRoot: Root | null = null;

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as unknown as Document;
	globalThis.navigator = dom.window.navigator as unknown as Navigator;
};

const renderBoard = (options: {
	hideEmptyColumns?: boolean;
	onToggleHideEmptyColumns?: () => void;
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
				tasks={tasks}
				statuses={statuses}
				isLoading={false}
				milestones={[]}
				availableLabels={[]}
				milestoneEntities={[]}
				archivedMilestones={[]}
				laneMode="none"
				onLaneChange={() => {}}
				hideEmptyColumns={options.hideEmptyColumns}
				onToggleHideEmptyColumns={options.onToggleHideEmptyColumns}
			/>,
		);
	});
	return container as HTMLElement;
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

describe("Board hideEmptyColumns", () => {
	it("hides empty status columns when hideEmptyColumns is true", () => {
		const container = renderBoard({ hideEmptyColumns: true });
		expect(container.textContent).toContain("To Do");
		expect(container.textContent).not.toContain("In Progress");
		expect(container.textContent).not.toContain("Done");
	});

	it("shows all status columns when hideEmptyColumns is false", () => {
		const container = renderBoard({ hideEmptyColumns: false });
		expect(container.textContent).toContain("To Do");
		expect(container.textContent).toContain("In Progress");
		expect(container.textContent).toContain("Done");
	});

	it("renders the toggle button with correct aria-pressed and label, and calls the handler on click", () => {
		let toggled = 0;
		const container = renderBoard({
			hideEmptyColumns: false,
			onToggleHideEmptyColumns: () => {
				toggled += 1;
			},
		});

		const button = container.querySelector('button[aria-pressed]') as HTMLButtonElement | null;
		expect(button).toBeTruthy();
		expect(button?.getAttribute("aria-pressed")).toBe("false");
		expect(button?.getAttribute("title") ?? button?.textContent ?? "").toMatch(/hide empty columns/i);

		act(() => {
			button?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});

		expect(toggled).toBe(1);
	});

	it("does not keep the default light colors on the active toggle button", () => {
		// Tailwind resolves conflicting utilities by stylesheet order, not class order,
		// so the active button must not carry the default background/text classes at all.
		const container = renderBoard({ hideEmptyColumns: true, onToggleHideEmptyColumns: () => {} });
		const button = container.querySelector("button[aria-pressed]") as HTMLButtonElement | null;
		expect(button).toBeTruthy();

		const classes = (button?.className ?? "").split(/\s+/);
		expect(classes).toContain("bg-stone-700");
		expect(classes).toContain("text-white");
		expect(classes).not.toContain("bg-white");
		expect(classes).not.toContain("text-gray-700");
	});

	it("does not render the toggle button when onToggleHideEmptyColumns is not provided", () => {
		const container = renderBoard({ hideEmptyColumns: false });
		expect(container.querySelector('button[aria-pressed]')).toBeFalsy();
	});

	it("does not re-show hidden columns synchronously on dragstart, only after the drag is committed", async () => {
		const container = renderBoard({ hideEmptyColumns: true });
		const card = container.querySelector('[draggable="true"]') as HTMLElement | null;
		expect(card).toBeTruthy();

		const dragStart = new window.Event("dragstart", { bubbles: true });
		Object.defineProperty(dragStart, "dataTransfer", {
			value: { setData: () => {}, effectAllowed: "" },
		});

		// Synchronously after dragstart the empty columns must stay hidden;
		// mutating the board here would cancel the native drag in the browser.
		act(() => {
			card?.dispatchEvent(dragStart);
		});
		expect(container.textContent).not.toContain("In Progress");
		expect(container.textContent).not.toContain("Done");

		// Once the drag is committed (next task), empty columns reappear as drop targets.
		await act(async () => {
			await new Promise(resolve => setTimeout(resolve, 0));
		});
		expect(container.textContent).toContain("In Progress");
		expect(container.textContent).toContain("Done");
	});
});
