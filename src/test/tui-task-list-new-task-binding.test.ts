import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { ScreenInterface } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { getCreatedTaskListOutcome, viewTaskEnhanced } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "TASK-1",
		title: "Existing task",
		status: "To Do",
		assignee: [],
		createdDate: "2026-07-15 00:00",
		labels: [],
		dependencies: [],
		...overrides,
	};
}

type TestListWidget = {
	items?: Array<{ content?: string }>;
	selected?: number;
};

/** The project's ScreenInterface shim (src/types/neo-neo-bblessed.d.ts) doesn't model `.focused`
 * or the concrete List widget's rendered-row shape; narrow both once at this boundary. */
function focusedListWidget(screen: ScreenInterface): TestListWidget | undefined {
	const withFocus = screen as unknown as { focused?: TestListWidget | null };
	return withFocus.focused ?? undefined;
}

// Polls instead of awaiting a promise: blessed's render pipeline and the key handler's async
// composer/persist chain have no externally awaitable completion signal, only observable widget
// state. Matches the same pattern used throughout the existing TUI composer test suite.
async function waitUntil(predicate: () => boolean, message: string): Promise<void> {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		if (predicate()) return;
		await Bun.sleep(10);
	}
	throw new Error(`Timed out waiting for ${message}`);
}

describe("TUI task list 'n' key binding", () => {
	let TEST_DIR: string;
	let core: Core;
	let ttyDescriptor: PropertyDescriptor | undefined;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("list-new-task-binding");
		core = new Core(TEST_DIR);
		await initializeTestProject(core, "List New Task Binding Project");
		ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
	});

	afterEach(async () => {
		if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
		// Lets any async work still in flight against the destroyed screen (e.g. the detail
		// pane's post-selection subtask refresh) settle before the next test creates a new
		// screen; blessed tracks some widget/screen state globally across instances.
		await Bun.sleep(20);
		await safeCleanup(TEST_DIR);
	});

	it("invokes the task composer on 'n', persists the task, and focuses it in the list", async () => {
		const screen = createScreen({ smartCSR: false });
		const existing = task({ id: "TASK-1", title: "Existing task" });
		const created = task({ id: "TASK-2", title: "Created from list view" });
		let composerCalls = 0;
		let receivedStatuses: readonly string[] | undefined;

		try {
			void viewTaskEnhanced(existing, {
				core,
				tasks: [existing],
				screen,
				taskComposer: async (composerOptions) => {
					composerCalls += 1;
					receivedStatuses = composerOptions.statuses;
					return composerOptions.persist({ title: created.title, status: created.status });
				},
				createTask: async () => created,
			});

			await waitUntil(() => Boolean(focusedListWidget(screen)?.items), "the initial task list to render and focus");

			screen.emit("key n");

			await waitUntil(() => composerCalls === 1, "the task composer to be invoked");
			expect(receivedStatuses).toContain("To Do");

			await waitUntil(() => {
				const items = focusedListWidget(screen)?.items;
				return Boolean(items?.some((item) => item.content?.includes("TASK-2")));
			}, "the created task to appear in the list");

			const list = focusedListWidget(screen);
			expect(list?.items?.[list.selected ?? 0]?.content).toContain("TASK-2");
			// Not "key q": viewTaskEnhanced's quit handler calls process.exit(0) directly, which
			// would kill the whole test process. screen.destroy() below ends the view instead.
		} finally {
			screen.destroy();
		}
	});

	it("does not duplicate a task delivered by a watcher update while the composer is open", async () => {
		const screen = createScreen({ smartCSR: false });
		const existing = task({ id: "TASK-1", title: "Existing task" });
		const created = task({ id: "TASK-2", title: "Created from list view" });
		let subscriber: ((tasks: Task[], statuses: string[], labels: string[], selected?: Task) => void) | undefined;

		try {
			void viewTaskEnhanced(existing, {
				core,
				tasks: [existing],
				screen,
				subscribeUpdates: (update) => {
					subscriber = update;
				},
				taskComposer: async (composerOptions) => {
					const result = await composerOptions.persist({ title: created.title, status: created.status });
					// Simulate a file watcher delivering the same freshly-written task before the
					// composer promise resolves, racing the key handler's own append.
					subscriber?.([existing, result], ["To Do", "Done"], []);
					return result;
				},
				createTask: async () => created,
			});

			await waitUntil(() => Boolean(focusedListWidget(screen)?.items), "the initial task list to render and focus");
			expect(subscriber).toBeDefined();

			screen.emit("key n");

			await waitUntil(() => {
				const items = focusedListWidget(screen)?.items;
				return Boolean(items?.some((item) => item.content?.includes("TASK-2")));
			}, "the created task to appear in the list");

			const items = focusedListWidget(screen)?.items ?? [];
			const matches = items.filter((item) => item.content?.includes("TASK-2"));
			expect(matches.length).toBe(1);
			// Not "key q": viewTaskEnhanced's quit handler calls process.exit(0) directly, which
			// would kill the whole test process. screen.destroy() below ends the view instead.
		} finally {
			screen.destroy();
		}
	});
});

describe("getCreatedTaskListOutcome", () => {
	it("reports a draft as hidden from the list without a focus target", () => {
		const outcome = getCreatedTaskListOutcome(task({ id: "TASK-9", status: "Draft" }), false);
		expect(outcome).toEqual({
			message: "Created TASK-9 as a draft. Drafts are not shown in the task list.",
			tone: "yellow",
		});
	});

	it("reports a filtered-out task as hidden without a focus target", () => {
		const outcome = getCreatedTaskListOutcome(task({ id: "TASK-9" }), false);
		expect(outcome).toEqual({
			message: "Created TASK-9, but it is hidden by the current task list filters.",
			tone: "yellow",
		});
	});

	it("focuses a visible created task", () => {
		const outcome = getCreatedTaskListOutcome(task({ id: "TASK-9" }), true);
		expect(outcome).toEqual({ focusTaskId: "TASK-9", message: "Created TASK-9.", tone: "green" });
	});
});
