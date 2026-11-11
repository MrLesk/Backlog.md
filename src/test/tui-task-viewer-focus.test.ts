import { describe, expect, it, spyOn } from "bun:test";
import type { ElementInterface, ScreenInterface } from "neo-neo-bblessed";
import type { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { viewTaskEnhanced } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";
import { withTimeout } from "./test-utils.ts";

type KeyEmitter = {
	emit: (event: string, ch: string, key: { name: string; full: string; shift: boolean; ctrl: boolean }) => boolean;
};

type Popup = ElementInterface & {
	options?: { label?: string };
	children: Array<{ content?: string; emit: (event: string) => void }>;
};

function quitPrompt(screen: ScreenInterface): Popup | undefined {
	return (screen as unknown as { children: Popup[] }).children.find(
		(child) => child.options?.label === " Quit Backlog.md? ",
	);
}

/**
 * Presses a key the way the terminal delivers it: blessed hands it to the screen and then to
 * whichever widget has keyboard focus. A widget that lost focus therefore never sees the key,
 * which is exactly what these tests are about.
 */
function typeKey(screen: ScreenInterface, full: string): void {
	const name = full.replace(/^(S-|C-)/, "");
	(screen.program as unknown as KeyEmitter).emit("keypress", full.length === 1 ? full : "", {
		name,
		full,
		shift: full.startsWith("S-"),
		ctrl: full.startsWith("C-"),
	});
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
	options: { startWithDetailFocus?: boolean; confirmExit?: boolean; loadTasks?: boolean },
	run: (context: {
		screen: ScreenInterface;
		exitCode: () => number | string | undefined;
		handoffs: () => number;
		/** The task the viewer currently has selected. */
		selectedId: () => string;
		/** Push a task list through the viewer's update funnel, exactly as the file watcher does. */
		publishTasks: (tasks: Task[]) => Promise<void>;
	}) => Promise<void>,
): Promise<void> {
	const descriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
	Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	let screen: ScreenInterface | undefined;
	let exitCode: number | string | undefined;
	const exit = spyOn(process, "exit").mockImplementation(((code) => {
		exitCode = code ?? undefined;
	}) as typeof process.exit);
	let handoffs = 0;
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
				loadConfig: async () => ({ confirmExit: options.confirmExit }),
			},
			getContentStore: async () => ({ dispose: () => {} }),
			queryTasks: async () => TASKS,
			getTaskWithSubtasks: async () => null,
			editTaskInTui: async (_taskId: string, _screen: unknown, selectedTask?: Task) => ({
				changed: false,
				task: selectedTask,
			}),
		} as unknown as Core;

		viewer = viewTaskEnhanced(FIRST_TASK, {
			tasks: options.loadTasks ? undefined : TASKS,
			core,
			// Create the viewer screen after its loading screen closes, as the real entry point does.
			get screen() {
				screen = createScreen({ smartCSR: false });
				Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
				Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
				return screen;
			},
			startWithDetailFocus: options.startWithDetailFocus,
			onTabPress: async () => {
				handoffs++;
			},
			onTaskChange: (selected) => {
				selectedId = selected.id;
			},
			subscribeUpdates: (update) => {
				subscriber = update;
			},
		});
		await settle();
		if (!screen) throw new Error("Task viewer did not create its screen");

		await run({
			screen,
			exitCode: () => exitCode,
			handoffs: () => handoffs,
			selectedId: () => selectedId,
			publishTasks: async (tasks) => {
				expect(subscriber).toBeDefined();
				subscriber?.(tasks, STATUSES, []);
				await settle();
			},
		});
	} finally {
		// Destroying the screen is what ends the viewer.
		screen?.destroy();
		exit.mockRestore();
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

describe("task viewer quit confirmation", () => {
	it.each([false, true])("reads confirmation config when loadTasks is %s", async (loadTasks) => {
		await withTaskViewer({ confirmExit: true, loadTasks }, async ({ screen, exitCode }) => {
			await pressKeys(screen, "q");
			expect(quitPrompt(screen)).toBeDefined();
			expect(exitCode()).toBeUndefined();
			await pressKeys(screen, "enter");
			expect(exitCode()).toBe(0);
		});
	});

	it.each(["q", "C-c", "escape"])("opens on %s without exiting on the opening key", async (key) => {
		await withTaskViewer({ confirmExit: true }, async ({ screen, exitCode }) => {
			await pressKeys(screen, key);
			expect(quitPrompt(screen)).toBeDefined();
			expect(exitCode()).toBeUndefined();
			await pressKeys(screen, "escape");
			expect(quitPrompt(screen)).toBeUndefined();
			expect(exitCode()).toBeUndefined();
		});
	});

	for (const selectCancel of [false, true]) {
		it.each(["q", "C-c"])(`confirms on %s with Cancel selected: ${selectCancel}`, async (key) => {
			await withTaskViewer({ confirmExit: true }, async ({ screen, exitCode }) => {
				await pressKeys(screen, key);
				expect(exitCode()).toBeUndefined();
				if (selectCancel) await pressKeys(screen, "left");
				await pressKeys(screen, key);
				expect(exitCode()).toBe(0);
			});
		});
	}

	for (const startWithDetailFocus of [false, true]) {
		it.each(["escape", "enter", "click"])(
			`restores focus after %s cancellation, detail: ${startWithDetailFocus}`,
			async (cancel) => {
				await withTaskViewer({ confirmExit: true, startWithDetailFocus }, async ({ screen, exitCode, handoffs }) => {
					const originalFocus = screen.focused;
					await pressKeys(screen, "q", "tab");
					expect(handoffs()).toBe(0);
					if (cancel === "click") {
						const button = quitPrompt(screen)?.children.find((child) => child.content === "[Cancel]");
						expect(button).toBeDefined();
						button?.emit("click");
						await settle();
					} else {
						await pressKeys(screen, cancel);
					}
					expect(quitPrompt(screen)).toBeUndefined();
					expect(exitCode()).toBeUndefined();
					expect(screen.focused).toBe(originalFocus);
				});
			},
		);
	}

	it("preserves Escape navigation, filter popup dismissal, and Tab handoff", async () => {
		await withTaskViewer({ confirmExit: true, startWithDetailFocus: true }, async ({ screen, exitCode, handoffs }) => {
			const detailFocus = screen.focused;
			await pressKeys(screen, "/", "escape");
			expect(screen.focused).toBe(detailFocus);
			expect(quitPrompt(screen)).toBeUndefined();
			await pressKeys(screen, "escape");
			expect(screen.focused).not.toBe(detailFocus);
			expect(quitPrompt(screen)).toBeUndefined();
			await pressKeys(screen, "s", "escape");
			expect(quitPrompt(screen)).toBeUndefined();
			await pressKeys(screen, "escape"); // Leave the filter header before switching views.
			expect(exitCode()).toBeUndefined();
			await pressKeys(screen, "tab");
			expect(handoffs()).toBe(1);
			expect(exitCode()).toBeUndefined();
		});
	});

	it("keeps the prompt focused during task updates and restores list navigation", async () => {
		await withTaskViewer({ confirmExit: true }, async ({ screen, publishTasks, selectedId, exitCode }) => {
			await pressKeys(screen, "q");
			const popup = quitPrompt(screen);
			await publishTasks(TASKS.map((item) => ({ ...item, title: `${item.title} updated` })));
			expect(screen.focused).toBe(popup);
			await pressKeys(screen, "escape", "j");
			expect(selectedId()).toBe("TASK-2");
			expect(exitCode()).toBeUndefined();
		});
	});

	for (const confirmExit of [false, undefined]) {
		it.each(["q", "C-c", "escape"])(`exits immediately on %s with confirmExit ${confirmExit}`, async (key) => {
			await withTaskViewer({ confirmExit }, async ({ screen, exitCode }) => {
				await pressKeys(screen, key);
				expect(quitPrompt(screen)).toBeUndefined();
				expect(exitCode()).toBe(0);
			});
		});
	}
});
