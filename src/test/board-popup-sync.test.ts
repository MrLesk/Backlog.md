import { describe, expect, it } from "bun:test";
import type { ScreenInterface } from "neo-neo-bblessed";
import type { Core, TuiTaskEditResult } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { renderBoardTui } from "../ui/board.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

type EmittingWidget = {
	emit: (event: string, ch?: string, key?: { name: string; full: string; shift?: boolean }) => boolean;
};
type TestWidget = {
	type?: string;
	children?: TestWidget[];
	getContent?: () => string;
} & EmittingWidget;

const BOARD_STATUSES = ["To Do", "In Progress", "Done"];
const OPEN_TASK_ID = "TASK-1";

function createTask(overrides: Partial<Task> = {}): Task {
	return {
		id: OPEN_TASK_ID,
		title: "Popup task",
		status: "To Do",
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
		description: "ORIGINAL-BODY",
		...overrides,
	};
}

const OTHER_TASK = createTask({ id: "TASK-2", title: "Other task", status: "Done", description: "OTHER-BODY" });

function pressKey(widget: EmittingWidget | undefined, full: string, name = full.replace(/^S-/, "")): void {
	if (!widget) throw new Error(`No widget to receive key ${full}`);
	const key = { name, full, shift: full.startsWith("S-") };
	widget.emit("keypress", "", key);
	widget.emit(`key ${full}`, "", key);
}

function collectWidgets(root: TestWidget): TestWidget[] {
	const widgets: TestWidget[] = [];
	const visit = (node: TestWidget) => {
		for (const child of node.children ?? []) {
			widgets.push(child);
			visit(child);
		}
	};
	visit(root);
	return widgets;
}

/**
 * The popup body is the only widget rendering a task's checklists, so its presence says the
 * popup is open and its identity says whether the board rebuilt it.
 */
function findPopupBody(screen: ScreenInterface): TestWidget | undefined {
	return collectWidgets(screen as unknown as TestWidget).find((widget) =>
		widget.getContent?.().includes("Acceptance Criteria"),
	);
}

function screenText(screen: ScreenInterface): string {
	return collectWidgets(screen as unknown as TestWidget)
		.map((widget) => widget.getContent?.() ?? "")
		.join("\n");
}

async function withBoardPopup(
	options: {
		editTaskInTui?: () => Promise<TuiTaskEditResult>;
		tasks?: Task[];
		hideEmptyColumns?: boolean;
		/** Columns to step right through before opening the popup. */
		startColumn?: number;
	},
	run: (context: {
		screen: ScreenInterface & EmittingWidget;
		/** Push a new task list through the board's update funnel, exactly as the watcher does. */
		publishTasks: (tasks: Task[]) => Promise<void>;
		popupBody: () => TestWidget | undefined;
		text: () => string;
		focused: () => EmittingWidget | undefined;
	}) => Promise<void>,
): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false }) as ScreenInterface & EmittingWidget;
	let subscriber: ((nextTasks: Task[], nextStatuses: string[]) => void) | undefined;
	try {
		const core = { editTaskInTui: options.editTaskInTui ?? (async () => ({ changed: false })) } as unknown as Core;
		const boardPromise = renderBoardTui(options.tasks ?? [createTask(), OTHER_TASK], BOARD_STATUSES, "horizontal", 20, {
			screen,
			core,
			hideEmptyColumns: options.hideEmptyColumns,
			subscribeUpdates: (update) => {
				subscriber = update;
			},
		});
		await Bun.sleep(20);

		for (let step = 0; step < (options.startColumn ?? 0); step++) {
			pressKey(screen, "right");
			await Bun.sleep(10);
		}

		// Open the popup on the selected task in the focused column.
		pressKey(screen, "enter");
		await Bun.sleep(30);
		expect(findPopupBody(screen)).toBeDefined();

		await run({
			screen,
			publishTasks: async (tasks) => {
				expect(subscriber).toBeDefined();
				subscriber?.(tasks, BOARD_STATUSES);
				await Bun.sleep(30);
			},
			popupBody: () => findPopupBody(screen),
			text: () => screenText(screen),
			focused: () => (screen as unknown as { focused?: EmittingWidget }).focused,
		});

		// The board ignores q while a popup or modal is open, so dismiss them first.
		for (let attempt = 0; attempt < 2 && findPopupBody(screen); attempt++) {
			pressKey((screen as unknown as { focused?: EmittingWidget }).focused, "escape");
			await Bun.sleep(20);
		}
		pressKey(screen, "q");
		await withTimeout(boardPromise, "board close", 5000);
	} finally {
		screen.destroy();
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

describe("board task popup stays in sync with live task state", () => {
	it("rebuilds the popup after an in-popup editor edit", async () => {
		const edited = createTask({ title: "Edited title", description: "UPDATED-BODY" });
		await withBoardPopup(
			{ editTaskInTui: async () => ({ changed: true, task: edited }) },
			async ({ popupBody, text, focused }) => {
				const original = popupBody();

				pressKey(focused(), "e");
				await Bun.sleep(40);

				const refreshed = popupBody();
				expect(refreshed).toBeDefined();
				expect(refreshed).not.toBe(original);
				expect(refreshed?.getContent?.()).toContain("UPDATED-BODY");
				expect(refreshed?.getContent?.()).not.toContain("ORIGINAL-BODY");
				expect(text()).toContain("Edited title");
			},
		);
	});

	it("rebuilds the popup when the task changes outside the board", async () => {
		await withBoardPopup({}, async ({ publishTasks, popupBody, text }) => {
			const original = popupBody();

			await publishTasks([createTask({ title: "Renamed by CLI", description: "UPDATED-BODY" }), OTHER_TASK]);

			const refreshed = popupBody();
			expect(refreshed).toBeDefined();
			expect(refreshed).not.toBe(original);
			expect(refreshed?.getContent?.()).toContain("UPDATED-BODY");
			expect(refreshed?.getContent?.()).not.toContain("ORIGINAL-BODY");
			expect(text()).toContain("Renamed by CLI");
		});
	});

	it("closes the popup with a notice when the task leaves the board", async () => {
		await withBoardPopup({}, async ({ publishTasks, popupBody, text }) => {
			await publishTasks([OTHER_TASK]);

			expect(popupBody()).toBeUndefined();
			expect(text()).toContain(`${OPEN_TASK_ID} is no longer on the board`);
		});
	});

	it("defers the rebuild while a confirmation dialog is stacked on the popup", async () => {
		await withBoardPopup({}, async ({ publishTasks, popupBody, text, focused }) => {
			pressKey(focused(), "c");
			await Bun.sleep(30);
			const dialog = focused();
			expect(text()).toContain("as completed?");

			// An external edit lands while the user is still answering the dialog.
			await publishTasks([createTask({ title: "Renamed by CLI", description: "UPDATED-BODY" }), OTHER_TASK]);

			// The dialog must keep both the screen and the keyboard until it is answered.
			expect(text()).toContain("as completed?");
			expect(focused()).toBe(dialog);

			// Answering it still works, and the deferred refresh lands afterwards.
			pressKey(focused(), "escape");
			await Bun.sleep(40);
			expect(text()).not.toContain("as completed?");
			expect(popupBody()?.getContent?.()).toContain("UPDATED-BODY");
		});
	});

	it("restores focus to a real column when the board loses columns as the task disappears", async () => {
		// hideEmptyColumns drops the Done lane once its only task is gone, so the column the
		// popup was opened from no longer exists when focus has to go somewhere.
		const todo = createTask({ id: "TASK-A", status: "To Do" });
		const inProgress = createTask({ id: "TASK-B", status: "In Progress" });
		const done = createTask({ id: "TASK-C", status: "Done" });
		await withBoardPopup(
			{ tasks: [todo, inProgress, done], hideEmptyColumns: true, startColumn: 2 },
			async ({ publishTasks, popupBody, text, focused }) => {
				await publishTasks([todo, inProgress]);

				expect(popupBody()).toBeUndefined();
				expect(text()).toContain("TASK-C is no longer on the board");
				// Focus must land on a surviving column list, not nowhere.
				expect((focused() as TestWidget | undefined)?.type).toBe("list");
			},
		);
	});

	it("leaves the popup untouched when an update carries no content change", async () => {
		await withBoardPopup({}, async ({ publishTasks, popupBody }) => {
			const original = popupBody();
			expect(original).toBeDefined();

			// The watcher echo of a just-saved task differs only in read metadata.
			await publishTasks([
				createTask({ lastModified: new Date("2030-01-01"), filePath: "/elsewhere/task-1.md" }),
				OTHER_TASK,
			]);

			expect(popupBody()).toBe(original);
		});
	});
});
