import { describe, expect, it } from "bun:test";
import type { ScreenInterface } from "neo-neo-bblessed";
import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { viewTaskEnhanced } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

type KeyEmitter = { emit: (event: string, ch: string, key: { name: string; full: string; shift: boolean }) => boolean };

/**
 * Presses a key the way the terminal delivers it: blessed hands it to the screen and then to
 * whichever widget has keyboard focus. A widget that lost focus therefore never sees the key,
 * which is exactly what these tests are about.
 */
function typeKey(screen: ScreenInterface, full: string): void {
	const name = full.replace(/^S-/, "");
	(screen.program as unknown as KeyEmitter).emit("keypress", "", { name, full, shift: full.startsWith("S-") });
}

/** Lets the viewer finish what a key press started: the editor promise, timers, next ticks. */
async function settle(): Promise<void> {
	await Bun.sleep(20);
}

async function pressKeys(screen: ScreenInterface, ...keys: string[]): Promise<void> {
	for (const key of keys) {
		typeKey(screen, key);
		await settle();
	}
}

const CREATED_DATE = new Date().toISOString().slice(0, 16).replace("T", " ");

function task(id: string): Task {
	return {
		id,
		title: `Task ${id}`,
		status: "To Do",
		assignee: [],
		createdDate: CREATED_DATE,
		labels: [],
		dependencies: [],
	};
}

const FIRST_TASK = task("TASK-1");
const TASKS = [FIRST_TASK, task("TASK-2"), task("TASK-3"), task("TASK-4")];
const STATUSES = ["To Do", "In Progress", "Done"];

async function withTaskViewer(
	options: { startWithDetailFocus?: boolean },
	run: (context: {
		screen: ScreenInterface;
		/** The task the viewer currently has selected. */
		selectedId: () => string;
		/** Push a task list through the viewer's update funnel, exactly as the file watcher does. */
		publishTasks: (tasks: Task[]) => Promise<void>;
	}) => Promise<void>,
): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	const screen = createScreen({ smartCSR: false });
	let selectedId = FIRST_TASK.id;
	let subscriber: ((tasks: Task[], statuses: string[], labels: string[]) => void) | undefined;
	let viewer: Promise<void> | undefined;
	try {
		// Stands in for the editor session: the editor closes at once and reports no change.
		const core = {
			filesystem: {
				listMilestones: async () => [],
				listArchivedMilestones: async () => [],
				listArchivedTasks: async () => [],
				loadConfig: async () => null,
			},
			getTaskWithSubtasks: async () => null,
			editTaskInTui: async (_taskId: string, _screen: unknown, selectedTask?: Task) => ({
				changed: false,
				task: selectedTask,
			}),
		} as unknown as Core;

		viewer = viewTaskEnhanced(FIRST_TASK, {
			tasks: TASKS,
			core,
			screen,
			startWithDetailFocus: options.startWithDetailFocus,
			onTaskChange: (selected) => {
				selectedId = selected.id;
			},
			subscribeUpdates: (update) => {
				subscriber = update;
			},
		});
		await settle();

		await run({
			screen,
			selectedId: () => selectedId,
			publishTasks: async (tasks) => {
				expect(subscriber).toBeDefined();
				subscriber?.(tasks, STATUSES, []);
				await settle();
			},
		});
	} finally {
		// Destroying the screen is what ends the viewer.
		screen.destroy();
		if (viewer) await withTimeout(viewer, "task viewer close", 5000);
		if (descriptor) Object.defineProperty(process.stdout, "isTTY", descriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
	}
}

describe("task viewer keeps keyboard focus when it rebuilds its panes", () => {
	it("moves the selection with j, k and the arrow keys after each of two editor sessions", async () => {
		await withTaskViewer({}, async ({ screen, selectedId }) => {
			await pressKeys(screen, "j");
			expect(selectedId()).toBe("TASK-2");

			for (let editorSession = 1; editorSession <= 2; editorSession++) {
				await pressKeys(screen, "S-e");
				expect(selectedId()).toBe("TASK-2");

				await pressKeys(screen, "j");
				expect(selectedId()).toBe("TASK-3");
				await pressKeys(screen, "k");
				expect(selectedId()).toBe("TASK-2");
				await pressKeys(screen, "down");
				expect(selectedId()).toBe("TASK-3");
				await pressKeys(screen, "up");
				expect(selectedId()).toBe("TASK-2");
			}
		});
	});

	it("keeps keys in the list when search was used before the editor opened", async () => {
		await withTaskViewer({}, async ({ screen, selectedId }) => {
			// Visiting search leaves the search input as the widget blessed falls back to.
			await pressKeys(screen, "/", "escape", "S-e");

			await pressKeys(screen, "j");
			expect(selectedId()).toBe("TASK-2");
			await pressKeys(screen, "k");
			expect(selectedId()).toBe("TASK-1");
		});
	});

	it("keeps the detail pane focused after the editor closes", async () => {
		await withTaskViewer({ startWithDetailFocus: true }, async ({ screen, selectedId }) => {
			await pressKeys(screen, "/", "escape", "S-e");

			// In the detail pane j scrolls the text; in the list it would move the selection.
			await pressKeys(screen, "j");
			expect(selectedId()).toBe("TASK-1");

			// Only the detail pane answers the left arrow by handing focus to the list.
			await pressKeys(screen, "left", "j");
			expect(selectedId()).toBe("TASK-2");
		});
	});

	it("keeps list navigation working when the tasks change on disk", async () => {
		await withTaskViewer({}, async ({ screen, selectedId, publishTasks }) => {
			await publishTasks(TASKS.map((item) => ({ ...item, title: `${item.title} (changed)` })));

			await pressKeys(screen, "j");
			expect(selectedId()).toBe("TASK-2");
		});
	});
});
