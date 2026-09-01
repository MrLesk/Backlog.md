import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { type TaskDetail, taskReadiness, toTaskDetail } from "../core/task-detail.ts";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { apiClient } from "../web/lib/api.ts";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { readinessInputs, syncOpenTaskDetail } from "../web/utils/task-detail-sync.ts";

const statuses = ["To Do", "In Progress", "Done"];

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

function makeTask(id: string, status: string, dependencies: string[] = []): Task {
	return {
		id,
		title: `Task ${id}`,
		status,
		dependencies,
		assignee: [],
		labels: [],
		createdDate: new Date().toISOString().slice(0, 10),
		rawContent: "",
	};
}

const detailOf = (task: Task, corpus: Task[]): TaskDetail =>
	toTaskDetail(task, { tasks: corpus, completedTasks: [], statuses });

const setupDom = () => {
	activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
		url: "http://localhost",
	});
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
	globalThis.document = activeDom.window.document as Document;
	globalThis.navigator = activeDom.window.navigator as Navigator;
	globalThis.localStorage = activeDom.window.localStorage;
	globalThis.Element = activeDom.window.Element;
	globalThis.HTMLElement = activeDom.window.HTMLElement;
	globalThis.HTMLInputElement = activeDom.window.HTMLInputElement;
	globalThis.HTMLTextAreaElement = activeDom.window.HTMLTextAreaElement;
	globalThis.HTMLSelectElement = activeDom.window.HTMLSelectElement;
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
	htmlElementPrototype.attachEvent = () => {};
	htmlElementPrototype.detachEvent = () => {};
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
	activeDom?.window.close();
	activeDom = null;
});

describe("open task detail readiness while the corpus moves underneath it", () => {
	it("updates the modal badge when a dependency is completed out of band", async () => {
		const blocker = makeTask("BACK-1", "In Progress");
		const dependent = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const corpus = [blocker, dependent];

		setupDom();
		const container = document.getElementById("root") as HTMLElement;
		activeRoot = createRoot(container);

		// The browser renders the detail read it was handed, exactly as it arrives from the server.
		const render = async (task: Task | TaskDetail, availableTasks: Task[]) => {
			await act(async () => {
				activeRoot?.render(
					<MemoryRouter initialEntries={[`/tasks/${task.id}`]}>
						<ThemeProvider>
							<TaskIdIndexProvider tasks={availableTasks}>
								<TaskDetailsModal
									task={task}
									availableTasks={availableTasks}
									availableStatuses={statuses}
									isOpen={true}
									onClose={() => {}}
								/>
							</TaskIdIndexProvider>
						</ThemeProvider>
					</MemoryRouter>,
				);
				await Promise.resolve();
			});
		};

		const openDetail = detailOf(dependent, corpus);
		await render(openDetail, corpus);
		expect(container.textContent).toContain("Blocked by BACK-1");

		// The list refresh that follows the modal opening changes nothing, and records what the
		// verdict on screen was read against.
		const firstSync = syncOpenTaskDetail({
			open: openDetail,
			refreshed: dependent,
			corpus,
			previous: null,
			version: 1,
		});
		expect(firstSync.rereadDetail).toBe(false);
		expect(taskReadiness(firstSync.task)).toEqual(openDetail.readiness);

		// The blocker is completed somewhere else. This task's own record is untouched, and the list
		// reconcile hands back the very same object for it, which is exactly what used to leave the
		// badge stale forever.
		const completedBlocker = makeTask("BACK-1", "Done");
		const refreshedCorpus = [completedBlocker, dependent];
		const secondSync = syncOpenTaskDetail({
			open: firstSync.task,
			refreshed: dependent,
			corpus: refreshedCorpus,
			previous: { record: dependent, inputs: firstSync.readinessInputs, version: 2 },
			version: 2,
		});

		// The unchanged record must not be mistaken for an unchanged verdict.
		expect(secondSync.changed).toBe(true);
		expect(secondSync.rereadDetail).toBe(true);
		// Dropped rather than shown: the modal never claims the task is blocked by finished work.
		expect(taskReadiness(secondSync.task)).toBeUndefined();
		await render(secondSync.task, refreshedCorpus);
		expect(container.textContent).not.toContain("Blocked by BACK-1");

		// And the detail read the sync asked for delivers the verdict that replaces it.
		await render(detailOf(dependent, refreshedCorpus), refreshedCorpus);
		expect(container.textContent).toContain("Ready to start");
	});

	it("hides the verdict while an optimistic status edit is ahead of the record", async () => {
		const blocker = makeTask("BACK-1", "In Progress");
		const dependent = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const corpus = [blocker, dependent];
		const openDetail = detailOf(dependent, corpus);

		setupDom();
		const container = document.getElementById("root") as HTMLElement;
		activeRoot = createRoot(container);
		await act(async () => {
			activeRoot?.render(
				<MemoryRouter initialEntries={[`/tasks/${dependent.id}`]}>
					<ThemeProvider>
						<TaskIdIndexProvider tasks={corpus}>
							<TaskDetailsModal
								task={openDetail}
								availableTasks={corpus}
								availableStatuses={statuses}
								isOpen={true}
								onClose={() => {}}
							/>
						</TaskIdIndexProvider>
					</ThemeProvider>
				</MemoryRouter>,
			);
			await Promise.resolve();
		});
		expect(container.textContent).toContain("Blocked by BACK-1");

		// The save is left in flight, which is also what a failed one leaves behind: the shown status
		// stays ahead of the record the verdict was read for.
		const originalUpdateTask = apiClient.updateTask.bind(apiClient);
		apiClient.updateTask = () => new Promise(() => {});
		try {
			const select = Array.from(container.querySelectorAll("select")).find((element) =>
				Array.from(element.options).some((option) => option.value === "Done"),
			);
			expect(select).toBeTruthy();
			await act(async () => {
				const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
				valueSetter?.call(select, "Done");
				select?.dispatchEvent(new window.Event("change", { bubbles: true }));
				await Promise.resolve();
			});

			// A finished task is neither ready nor blocked, so the carried verdict must not stand.
			expect(container.textContent).not.toContain("Blocked by BACK-1");
			expect(container.textContent).not.toContain("Ready to start");
		} finally {
			apiClient.updateTask = originalUpdateTask;
		}
	});

	it("keeps the verdict and asks for no read when nothing readiness depends on moved", async () => {
		const blocker = makeTask("BACK-1", "In Progress");
		const dependent = makeTask("BACK-2", "To Do", ["BACK-1"]);
		const corpus = [blocker, dependent];
		const openDetail = detailOf(dependent, corpus);

		// A title edit elsewhere in the corpus, and a label edit on the task itself.
		const renamedBlocker = { ...blocker, title: "Renamed" };
		const relabelled = { ...dependent, labels: ["web"] };
		const synced = syncOpenTaskDetail({
			open: openDetail,
			refreshed: relabelled,
			corpus: [renamedBlocker, relabelled],
			previous: { record: dependent, inputs: readinessInputs(dependent, corpus), version: 7 },
			version: 7,
		});

		// The record itself changed, so the modal takes the new one, but the verdict still holds and
		// no detail read is asked for.
		expect(synced.changed).toBe(true);
		expect(synced.rereadDetail).toBe(false);
		expect(taskReadiness(synced.task)).toEqual(openDetail.readiness);
		expect(synced.task.labels).toEqual(["web"]);

		// And a refresh that changed nothing at all is a no-op the modal never re-renders for.
		const unchanged = syncOpenTaskDetail({
			open: openDetail,
			refreshed: dependent,
			corpus,
			previous: { record: dependent, inputs: readinessInputs(dependent, corpus), version: 7 },
			version: 7,
		});
		expect(unchanged.changed).toBe(false);
	});
});
