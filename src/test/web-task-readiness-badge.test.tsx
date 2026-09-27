import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { type TaskDetail, toTaskDetail } from "../core/task-detail.ts";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { apiClient } from "../web/lib/api.ts";
import { TaskIdIndexProvider } from "../web/contexts/TaskIdIndexContext.tsx";
import { ThemeProvider } from "../web/contexts/ThemeContext";

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

/**
 * The verdict a detail read delivered describes the record it was read for. The modal shows it only
 * while the status and dependencies on screen still match that record, so an optimistic edit - or
 * one whose save failed and left the shown status ahead of the record - never stands next to a
 * verdict about what it replaced.
 */
describe("task readiness badge against an optimistic edit", () => {
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

});
