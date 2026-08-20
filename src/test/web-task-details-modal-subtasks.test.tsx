import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import type { Task } from "../types/index.ts";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { ThemeProvider } from "../web/contexts/ThemeContext";

const STATUSES = ["To Do", "In Progress", "Done"];

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;

	if (!window.matchMedia) {
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
	}
};

const makeTask = (id: string, status: string, parentTaskId?: string, title?: string): Task =>
	({
		id,
		title: title ?? `Task ${id}`,
		status,
		assignee: [],
		createdDate: "2026-08-17",
		labels: [],
		dependencies: [],
		...(parentTaskId ? { parentTaskId } : {}),
	}) as Task;

const renderModal = (task: Task, availableTasks: Task[]) => {
	setupDom();
	return renderToString(
		<ThemeProvider>
			<TaskDetailsModal
				task={task}
				isOpen={true}
				onClose={() => {}}
				availableTasks={availableTasks}
				availableStatuses={STATUSES}
				onNavigateToTask={() => {}}
			/>
		</ThemeProvider>,
	);
};

// Mirrors the real corpus shape this feature was built for: a parent whose children are spread
// across statuses, one of which has children of its own.
const nestedCorpus = (): Task[] => [
	makeTask("TASK-2", "In Progress", undefined, "Parent with six children"),
	makeTask("TASK-2.1", "Done", "TASK-2"),
	makeTask("TASK-2.2", "Done", "TASK-2"),
	makeTask("TASK-2.3", "Done", "TASK-2"),
	makeTask("TASK-2.4", "Done", "TASK-2"),
	makeTask("TASK-2.5", "Done", "TASK-2"),
	makeTask("TASK-2.6", "To Do", "TASK-2", "Child that has children"),
	makeTask("TASK-2.6.1", "Done", "TASK-2.6"),
	makeTask("TASK-2.6.2", "To Do", "TASK-2.6"),
	makeTask("TASK-2.6.3", "To Do", "TASK-2.6"),
	makeTask("TASK-2.6.4", "To Do", "TASK-2.6"),
];

describe("Web task details modal subtask hierarchy", () => {
	it("omits both sections for a task with no parent and no children", () => {
		const tasks = [makeTask("TASK-1", "To Do"), makeTask("TASK-9", "Done")];
		const html = renderModal(tasks[0] as Task, tasks);

		expect(html).not.toContain("data-subtask-list");
		expect(html).not.toContain("data-parent-task-id");
		expect(html).not.toContain("Subtasks");
	});

	it("lists direct children with their ids and titles", () => {
		const tasks = nestedCorpus();
		const html = renderModal(tasks[0] as Task, tasks);

		expect(html).toContain("data-subtask-list");
		expect(html).toContain('data-subtask-id="TASK-2.1"');
		expect(html).toContain('data-subtask-id="TASK-2.6"');
		expect(html).toContain('aria-label="Open subtask TASK-2.1: Task TASK-2.1 (Done)"');
		expect(html).toContain("Child that has children");
		// Grandchildren are not flattened into the parent's list.
		expect(html).not.toContain('data-subtask-id="TASK-2.6.1"');
	});

	it("summarises progress over direct children only", () => {
		const tasks = nestedCorpus();
		const html = renderModal(tasks[0] as Task, tasks);

		// Five of six direct children are Done; the sixth has its own children but is not itself Done.
		expect(html).toContain("5 of 6 complete");
		expect(html).not.toContain("6 of 10 complete");
	});

	it("marks a child that has children of its own with its nested progress", () => {
		const tasks = nestedCorpus();
		const html = renderModal(tasks[0] as Task, tasks);
		const document = new JSDOM(html).window.document;

		expect(html).toContain('data-nested-progress="1/4"');
		expect(document.querySelector('[data-nested-progress="1/4"]')?.textContent).toBe("1 of 4 complete");
	});

	it("counts only the configured terminal status as complete", () => {
		const tasks = [
			makeTask("TASK-3", "To Do"),
			makeTask("TASK-3.1", "Done", "TASK-3"),
			makeTask("TASK-3.2", "In Progress", "TASK-3"),
			makeTask("TASK-3.3", "To Do", "TASK-3"),
		];
		const html = renderModal(tasks[0] as Task, tasks);

		// In Progress must not be counted as complete.
		expect(html).toContain("1 of 3 complete");
	});

	it("links each child to its canonical task route", () => {
		const tasks = nestedCorpus();
		const html = renderModal(tasks[0] as Task, tasks);

		expect(html).toContain('data-subtask-href="/tasks/TASK-2.1/task-task-21"');
	});

	it("shows the parent task on a child, linked to its canonical route", () => {
		const tasks = nestedCorpus();
		const child = tasks.find((task) => task.id === "TASK-2.6") as Task;
		const html = renderModal(child, tasks);

		expect(html).toContain("data-task-hierarchy");
		expect(html).toContain('data-parent-task-id="TASK-2"');
		expect(html).toContain("Parent with six children");
		expect(html).toContain('aria-label="Open parent task TASK-2: Parent with six children (In Progress)"');
		expect(html).toContain('data-parent-task-href="/tasks/TASK-2/parent-with-six-children"');
	});

	it("omits the parent section when the parent is absent from the corpus", () => {
		const tasks = [makeTask("TASK-4.1", "To Do", "TASK-4")];
		const html = renderModal(tasks[0] as Task, tasks);

		expect(html).not.toContain("data-parent-task-id");
	});
});
