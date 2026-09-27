import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { ScreenInterface } from "neo-neo-bblessed";
import { Core } from "../core/backlog.ts";
import type { Task } from "../types/index.ts";
import { viewTaskEnhanced } from "../ui/task-viewer-with-search.ts";
import { createScreen } from "../ui/tui.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

type Widget = {
	children?: Widget[];
	content?: string;
	items?: Widget[];
	selected?: number;
	setValue?: (value: string) => void;
	getValue?: () => string;
	emit?: (event: string, ...args: unknown[]) => void;
};
type ViewerOptions = NonNullable<Parameters<typeof viewTaskEnhanced>[1]>;
type Update = Parameters<NonNullable<ViewerOptions["subscribeUpdates"]>>[0];

function focused(screen: ScreenInterface): Widget | undefined {
	return (screen as unknown as { focused?: Widget }).focused;
}

function widgets(node: Widget): Widget[] {
	return [node, ...(node.children ?? []).flatMap(widgets)];
}

function content(screen: ScreenInterface): string {
	return widgets(screen as unknown as Widget)
		.map((widget) => widget.content ?? "")
		.join("\n");
}

function pressKey(widget: Widget | undefined, name: string, ch = ""): void {
	const key = { name, full: name };
	widget?.emit?.("keypress", ch, key);
	widget?.emit?.(`key ${name}`, ch, key);
}

async function waitUntil(predicate: () => boolean, message: string): Promise<void> {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		if (predicate()) return;
		await Bun.sleep(10);
	}
	throw new Error(`Timed out waiting for ${message}`);
}

async function settle(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
	await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("TUI task list new-task binding", () => {
	let testDir: string;
	let core: Core;
	let screen: ScreenInterface;
	let initial: Task[];
	let selectionReads: Array<Promise<Task | null>>;
	let viewer: Promise<void> | undefined;
	let ttyDescriptor: PropertyDescriptor | undefined;

	beforeEach(async () => {
		testDir = createUniqueTestDir("list-new-task-binding");
		core = new Core(testDir);
		selectionReads = [];
		const loadSelectedTask = core.getTaskWithSubtasks.bind(core);
		core.getTaskWithSubtasks = (...args) => {
			const reading = loadSelectedTask(...args);
			selectionReads.push(reading);
			return reading;
		};
		await initializeFilesystemTestProject(core, "List New Task Binding Project");
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Missing fixture configuration");
		await core.filesystem.saveConfig({
			...config,
			remoteOperations: false,
			checkActiveBranches: false,
			statuses: ["Review", "Closed"],
			defaultStatus: "Closed",
			types: ["Incident", "Feature"],
			priorities: ["urgent", "later"],
			projects: ["Web", "API"],
			defaultAssignee: ["@owner"],
			definitionOfDone: ["Review completed"],
		});
		initial = [];
		for (const title of ["First task", "Second task"]) {
			initial.push((await core.createTaskFromInput({ title, status: "Review", priority: "urgent" }, false)).task);
		}
		await core.getContentStore();
		ttyDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
		Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true });
		screen = createScreen({ smartCSR: false });
		Object.defineProperty(screen, "width", { configurable: true, value: 100, writable: true });
		Object.defineProperty(screen, "height", { configurable: true, value: 30, writable: true });
	});

	afterEach(async () => {
		// Destroying the screen ends the view without its CLI-only process.exit handler.
		screen.destroy();
		await viewer;
		viewer = undefined;
		await settle();
		await Promise.all(selectionReads);
		core.disposeContentStore();
		if (ttyDescriptor) Object.defineProperty(process.stdout, "isTTY", ttyDescriptor);
		else Reflect.deleteProperty(process.stdout, "isTTY");
		await safeCleanup(testDir);
	});

	async function start(options: ViewerOptions = {}): Promise<void> {
		const first = initial[0];
		if (!first) throw new Error("Missing seeded task");
		viewer = viewTaskEnhanced(first, { core, tasks: initial, screen, ...options });
		await waitUntil(() => Boolean(focused(screen)), "the initial viewer focus");
		await settle();
	}

	async function fillComposer(title: string): Promise<void> {
		screen.emit("key n");
		await waitUntil(() => typeof focused(screen)?.setValue === "function", "the composer title field");
		focused(screen)?.setValue?.(title);
		// Use the composer's real keyboard navigation, including the configured Project field.
		for (let step = 0; step < 9 && focused(screen)?.content !== "Create task"; step += 1) {
			pressKey(focused(screen), "tab");
		}
		expect(focused(screen)?.content).toBe("Create task");
	}

	async function expectSelected(id: string): Promise<void> {
		await waitUntil(() => {
			const list = focused(screen);
			return Boolean(list?.items?.[list.selected ?? 0]?.content?.includes(id));
		}, `${id} selected in the focused list`);
		await settle();
		const list = focused(screen);
		expect(list?.items?.[list.selected ?? 0]?.content).toContain(id);
	}

	async function expectNavigation(): Promise<void> {
		if (!focused(screen)?.items) pressKey(focused(screen), "left");
		await expectSelected("TASK-1");
		pressKey(focused(screen), "down");
		await expectSelected("TASK-2");
	}

	it("opens the actual composer from detail focus and persists once through the supplied Core with project defaults", async () => {
		await start({ startWithDetailFocus: true });
		await fillComposer("Created from list view");
		pressKey(focused(screen), "enter", "\r");
		await expectSelected("TASK-3");
		const saved = await core.filesystem.loadTask("TASK-3");
		expect(saved).toMatchObject({ title: "Created from list view", status: "Review", assignee: ["@owner"] });
		expect(saved?.definitionOfDoneItems).toEqual([{ index: 1, text: "Review completed", checked: false }]);
		expect(await core.filesystem.listTasks()).toHaveLength(3);
		expect(content(screen)).toContain("Created TASK-3.");
		pressKey(focused(screen), "up");
		await expectSelected("TASK-2");
	});

	for (const key of ["N", "S-n"]) {
		it(`supports ${key} and passes configured composer choices without inheriting filters`, async () => {
			let calls = 0;
			await start({
				priorityFilter: "urgent",
				taskComposer: async (options) => {
					calls += 1;
					expect(options.statuses).toEqual(["Review", "Closed"]);
					expect(options.types).toEqual(["Incident", "Feature"]);
					expect(options.priorities).toEqual(["urgent", "later"]);
					expect(options.projects).toEqual(["Web", "API"]);
					return options.persist({ title: "Hidden task", status: "Review" });
				},
			});
			screen.emit(`key ${key}`);
			await waitUntil(() => content(screen).includes("hidden by the current task list filters"), "hidden feedback");
			expect(calls).toBe(1);
			expect((await core.filesystem.loadTask("TASK-3"))?.priority).toBeUndefined();
			await expectNavigation();
		});
	}

	for (const timing of ["before persistence", "before close", "after close"] as const) {
		it(`keeps one selected row when the watcher delivers ${timing}`, async () => {
			let update: Update | undefined;
			let created: Task | undefined;
			await start({
				subscribeUpdates: (subscriber) => {
					update = subscriber;
				},
				taskComposer: async ({ persist }) => {
					const previousList = focused(screen);
					if (timing === "before persistence") {
						update?.(
							[...initial, { ...(initial[0] as Task), id: "TASK-3", title: "Watcher task" }],
							["Review", "Closed"],
							[],
						);
					}
					created = await persist({ title: "Watcher task", status: "Review" });
					if (timing === "before close") update?.([...initial, created], ["Review", "Closed"], []);
					expect(focused(screen)).toBe(previousList);
					return created;
				},
			});
			screen.emit("key n");
			await expectSelected("TASK-3");
			if (timing === "after close" && created) update?.([...initial, created], ["Review", "Closed"], []);
			await expectSelected("TASK-3");
			expect(focused(screen)?.items?.filter((item) => item.content?.includes("TASK-3"))).toHaveLength(1);
			expect(await core.filesystem.listTasks()).toHaveLength(3);
			pressKey(focused(screen), "up");
			await expectSelected("TASK-2");
		});
	}

	for (const result of ["draft", "hidden"] as const) {
		for (const pane of ["list", "detail"] as const) {
			it(`restores ${pane} focus after a ${result} result`, async () => {
				await start({
					startWithDetailFocus: pane === "detail",
					priorityFilter: "urgent",
					taskComposer: ({ persist }) =>
						persist({ title: "Outside view", status: result === "draft" ? "Draft" : "Review" }),
				});
				screen.emit("key n");
				await waitUntil(
					() => content(screen).includes(result === "draft" ? "as a draft" : "hidden by"),
					"creation feedback",
				);
				await settle();
				expect(Boolean(focused(screen)?.items)).toBe(pane === "list");
				if (result === "draft") expect(await core.filesystem.loadDraft("DRAFT-1")).not.toBeNull();
				await expectNavigation();
			});
		}
	}

	for (const outcome of ["cancel", "reject"] as const) {
		for (const pending of [false, true]) {
			it(`restores navigation after ${outcome} with pending update ${pending}`, async () => {
				let update: Update | undefined;
				let calls = 0;
				await start({
					startWithDetailFocus: true,
					subscribeUpdates: (subscriber) => {
						update = subscriber;
					},
					taskComposer: async () => {
						calls += 1;
						if (pending) update?.(initial, ["Review", "Closed"], []);
						if (outcome === "reject") throw new Error("composer setup failed");
						return null;
					},
				});
				screen.emit("key n");
				await waitUntil(() => calls === 1, "composer result");
				await settle();
				if (outcome === "reject") expect(content(screen)).toContain("composer setup failed");
				await expectNavigation();
				screen.emit("key n");
				await waitUntil(() => calls === 2, "released modal guard");
				expect(await core.filesystem.listTasks()).toHaveLength(2);
			});
		}
	}

	for (const recovery of ["retry", "cancel"] as const) {
		it(`keeps the actual composer usable after a persistence error and ${recovery}`, async () => {
			let attempts = 0;
			await start({
				createTask: async (input) => {
					attempts += 1;
					if (attempts === 1) throw new Error("Try creation again");
					return (await core.createTaskFromInput(input, false)).task;
				},
			});
			await fillComposer("Recoverable task");
			pressKey(focused(screen), "enter", "\r");
			await waitUntil(() => content(screen).includes("Try creation again"), "persistence error");
			expect(focused(screen)?.content).toBe("Create task");
			if (recovery === "retry") {
				pressKey(focused(screen), "enter", "\r");
				await expectSelected("TASK-3");
				expect((await core.filesystem.loadTask("TASK-3"))?.title).toBe("Recoverable task");
				expect(attempts).toBe(2);
			} else {
				pressKey(focused(screen), "escape");
				await settle();
				await expectNavigation();
				expect(await core.filesystem.listTasks()).toHaveLength(2);
			}
		});
	}

	it("keeps the empty filtered view usable after hidden creation and actual cancellation", async () => {
		await start({ priorityFilter: "later", startWithDetailFocus: true });
		await fillComposer("Still outside view");
		pressKey(focused(screen), "enter", "\r");
		await waitUntil(() => content(screen).includes("hidden by the current task list filters"), "hidden result");
		expect(focused(screen)?.content).toContain("No tasks match");
		screen.emit("key n");
		await waitUntil(() => typeof focused(screen)?.setValue === "function", "second composer");
		pressKey(focused(screen), "escape");
		await settle();
		expect(focused(screen)?.content).toContain("No tasks match");
		screen.emit("key /");
		await waitUntil(() => typeof focused(screen)?.setValue === "function", "search focus");
	});
});
