import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import React from "react";
import { renderToString } from "react-dom/server";
import type { Milestone, Task } from "../types/index.ts";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";

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

describe("Web task popup Final Summary display", () => {
	it("renders Final Summary section in preview when present", () => {
		setupDom();

		const task: Task = {
			id: "TASK-1",
			title: "Task with summary",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			finalSummary: "PR-style summary",
		};

		const html = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);

		expect(html).toContain("Final Summary");
		expect(html).toContain("PR-style summary");
	});

	it("hides Final Summary section in preview when empty", () => {
		setupDom();

		const task: Task = {
			id: "TASK-2",
			title: "Task without summary",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
		};

		const html = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);

		expect(html).not.toContain("Final Summary");
	});

	it("shows Final Summary editor in create mode", () => {
		setupDom();

		const html = renderToString(
			<ThemeProvider>
				<TaskDetailsModal isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);

		expect(html).toContain("Final Summary");
		expect(html).toContain("PR-style summary of what was implemented");
	});

	it("resolves numeric milestone aliases to milestone IDs in the milestone selector", () => {
		setupDom();

		const task: Task = {
			id: "TASK-3",
			title: "Task with numeric milestone alias",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			milestone: "1",
		};
		const milestones: Milestone[] = [
			{
				id: "m-1",
				title: "Release 1",
				description: "Milestone: Release 1",
				rawContent: "## Description\n\nMilestone: Release 1",
			},
		];

		const html = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} milestoneEntities={milestones} />
			</ThemeProvider>,
		);

		expect(html).toContain('option value="m-1"');
		expect(html).toContain("Release 1");
		expect(html).not.toContain('option value="1"');
	});

	it("resolves zero-padded milestone aliases to canonical milestone IDs in the milestone selector", () => {
		setupDom();

		const task: Task = {
			id: "TASK-4",
			title: "Task with zero-padded milestone alias",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			milestone: "m-01",
		};
		const milestones: Milestone[] = [
			{
				id: "m-1",
				title: "Release 1",
				description: "Milestone: Release 1",
				rawContent: "## Description\n\nMilestone: Release 1",
			},
		];

		const html = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} milestoneEntities={milestones} />
			</ThemeProvider>,
		);

		expect(html).toContain('option value="m-1"');
		expect(html).not.toContain('option value="m-01"');
	});

	it("prefers archived milestone IDs over active title matches for ID-shaped values", () => {
		setupDom();

		const task: Task = {
			id: "TASK-5",
			title: "Task with ID-shaped collision",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			milestone: "m-0",
		};
		const milestones: Milestone[] = [
			{
				id: "m-2",
				title: "m-0",
				description: "Milestone: m-0",
				rawContent: "## Description\n\nMilestone: m-0",
			},
		];
		const archivedMilestones: Milestone[] = [
			{
				id: "m-0",
				title: "Archived source",
				description: "Milestone: Archived source",
				rawContent: "## Description\n\nMilestone: Archived source",
			},
		];

		const html = renderToString(
			<ThemeProvider>
				<TaskDetailsModal
					task={task}
					isOpen={true}
					onClose={() => {}}
					milestoneEntities={milestones}
					archivedMilestoneEntities={archivedMilestones}
				/>
			</ThemeProvider>,
		);

		expect(html).toContain('option value="m-0"');
		expect(html).not.toContain('option value="m-2" selected');
	});
});
