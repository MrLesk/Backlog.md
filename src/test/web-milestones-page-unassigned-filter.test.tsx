import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { Milestone, Task } from "../types/index.ts";
import MilestonesPage from "../web/components/MilestonesPage";

const statuses = ["To Do", "In Progress", "Done"];

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

const renderMilestonesPage = (tasks: Task[]) =>
	renderToString(
		<MemoryRouter>
			<MilestonesPage
				tasks={tasks}
				statuses={statuses}
				milestoneEntities={milestones}
				archivedMilestones={[]}
				onEditTask={() => {}}
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
			makeTask({ id: "task-1", title: "Unassigned active", status: "To Do" }),
			makeTask({ id: "task-2", title: "Unassigned done", status: "Done" }),
			makeTask({ id: "task-3", title: "Milestone active", milestone: "m-1", status: "To Do" }),
		]);

		expect(html).toContain("Unassigned active");
		expect(html).not.toContain("Unassigned done");
		expect(getUnassignedCount(html)).toBe("1");
		expect(html).toContain("Milestone active");
	});

	it("shows an empty state when all unassigned tasks are done", () => {
		const html = renderMilestonesPage([
			makeTask({ id: "task-1", title: "Done unassigned", status: "Done" }),
			makeTask({ id: "task-2", title: "Complete unassigned", status: "Complete" }),
		]);

		expect(html).toContain("No active unassigned tasks. Completed tasks are hidden.");
		expect(html).not.toContain("Done unassigned");
		expect(html).not.toContain("Complete unassigned");
		expect(getUnassignedCount(html)).toBe("0");
	});

	it("keeps milestone-assigned groups rendering with existing behavior", () => {
		const html = renderMilestonesPage([
			makeTask({ id: "task-1", title: "Unassigned done", status: "Done" }),
			makeTask({ id: "task-2", title: "Milestone task", milestone: "m-1", status: "In Progress" }),
		]);

		expect(html).toContain("Release 1");
		expect(html).toContain("Milestone task");
		expect(html).not.toContain("Unassigned done");
	});
});
