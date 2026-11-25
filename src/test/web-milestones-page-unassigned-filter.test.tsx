import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import MilestonesPage from "../web/components/MilestonesPage";

const statuses = ["To Do", "In Progress", "Done", "Closed"];

const milestones: Milestone[] = [{ id: "m-1", title: "Release 1", description: "", rawContent: "" }];

const makeTask = (overrides: Partial<Task>): Task => ({
	id: "task-1",
	title: "Task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2024-01-01",
	...overrides,
});

// A task row links to the task in the Tasks page layout used last, which the browser keeps in localStorage.
let storageWindow: JSDOM["window"] | null = null;
beforeEach(() => {
	storageWindow = new JSDOM("", { url: "http://localhost" }).window;
	globalThis.localStorage = storageWindow.localStorage;
});
afterEach(() => {
	delete (globalThis as { localStorage?: Storage }).localStorage;
	storageWindow?.close();
	storageWindow = null;
});

const renderMilestonesPage = (tasks: Task[]) =>
	renderToString(
		<MemoryRouter>
			<MilestonesPage
				tasks={tasks}
				statuses={statuses}
				milestoneEntities={milestones}
				archivedMilestones={[]}
			/>
		</MemoryRouter>,
	);

const getUnassignedCount = (html: string): string | undefined => {
	const normalizedHtml = html.replaceAll("<!-- -->", "");
	const match = normalizedHtml.match(/Unassigned tasks[\s\S]*?\((\d+)\)/);
	return match?.[1];
};

describe("MilestonesPage unassigned filtering", () => {
	it("hides done unassigned tasks and counts only non-done unassigned tasks", () => {
		const html = renderMilestonesPage([
			makeTask({ id: "task-1", title: "Unassigned active", status: "Done" }),
			makeTask({ id: "task-2", title: "Unassigned done", status: "Closed" }),
			makeTask({ id: "task-3", title: "Milestone active", milestone: "m-1", status: "To Do" }),
		]);

		expect(html).toContain("Unassigned active");
		expect(html).not.toContain("Unassigned done");
		expect(getUnassignedCount(html)).toBe("1");
		expect(html).toContain("Milestone active");
	});

	it("shows an empty state when all unassigned tasks are done", () => {
		const html = renderMilestonesPage([
			makeTask({ id: "task-1", title: "Done unassigned", status: "Closed" }),
			makeTask({ id: "task-2", title: "Complete unassigned", status: "CLOSED" }),
		]);

		expect(html).toContain("No active unassigned tasks. Completed tasks are hidden.");
		expect(html).not.toContain("Done unassigned");
		expect(html).not.toContain("Complete unassigned");
		expect(getUnassignedCount(html)).toBe("0");
	});

	it("keeps milestone-assigned groups rendering with existing behavior", () => {
		const html = renderMilestonesPage([
			makeTask({ id: "task-1", title: "Unassigned done", status: "Closed" }),
			makeTask({ id: "task-2", title: "Milestone task", milestone: "m-1", status: "In Progress" }),
		]);

		expect(html).toContain("Release 1");
		expect(html).toContain("Milestone task");
		expect(html).not.toContain("Unassigned done");
	});

	it("opens a milestone on the board and in the list, whichever layout was used last", () => {
		const html = renderMilestonesPage([makeTask({ id: "task-2", title: "Milestone task", milestone: "m-1" })]);

		// The start page opens the layout used last, so the Board link must name the board itself.
		expect(html).toContain('href="/board?lane=milestone&amp;milestone=m-1"');
		expect(html).toContain('href="/tasks?milestone=m-1"');
	});
});
