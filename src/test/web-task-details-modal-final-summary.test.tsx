import { afterEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { Milestone, Task } from "../types/index.ts";
import { ThemeProvider } from "../web/contexts/ThemeContext";
import { TaskDetailsModal } from "../web/components/TaskDetailsModal";
import { apiClient } from "../web/lib/api.ts";

let activeRoot: Root | null = null;

const setFormValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
	const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
	valueSetter?.call(element, value);
	element.dispatchEvent(new window.Event("input", { bubbles: true }));
	element.dispatchEvent(new window.Event("change", { bubbles: true }));
};

const setupDom = () => {
	const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
	(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	globalThis.window = dom.window as unknown as Window & typeof globalThis;
	globalThis.document = dom.window.document as Document;
	globalThis.navigator = dom.window.navigator as Navigator;
	globalThis.localStorage = dom.window.localStorage;
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(callback, 0);
	globalThis.cancelAnimationFrame = (handle: number) => window.clearTimeout(handle);

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

	const htmlElementPrototype = window.HTMLElement.prototype as unknown as {
		attachEvent?: () => void;
		detachEvent?: () => void;
	};
	if (typeof htmlElementPrototype.attachEvent !== "function") {
		htmlElementPrototype.attachEvent = () => {};
	}
	if (typeof htmlElementPrototype.detachEvent !== "function") {
		htmlElementPrototype.detachEvent = () => {};
	}
};

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	}
});

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

	it("renders Comments section in preview when present", () => {
		setupDom();

		const task: Task = {
			id: "TASK-10",
			title: "Task with comments",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			comments: [
				{
					index: 1,
					author: "@reviewer",
					createdDate: "2025-01-02 12:00",
					body: "Rendered comment body",
				},
			],
		};

		const html = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);

		expect(html).toContain("Comments");
		expect(html).toContain("@reviewer");
		expect(html).toContain("Rendered comment body");
		expect(html).not.toContain("Add comment");
	});

	it("renders an empty Comments section as read-only in preview", () => {
		setupDom();

		const task: Task = {
			id: "TASK-10A",
			title: "Task without comments",
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

		expect(html).toContain("Comments");
		expect(html).toContain("No comments");
		expect(html).not.toContain("Add comment");
	});

	it("does not render comment form for cross-branch tasks", () => {
		setupDom();

		const task: Task = {
			id: "TASK-11",
			title: "Read-only comments",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			branch: "feature/comments",
			comments: [{ index: 1, createdDate: "2025-01-02 12:00", body: "Read-only comment" }],
		};

		const html = renderToString(
			<ThemeProvider>
				<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
			</ThemeProvider>,
		);

		expect(html).toContain("Read-only comment");
		expect(html).not.toContain("Add comment");
	});

	it("shows the comment form while editing an existing task", async () => {
		setupDom();

		const task: Task = {
			id: "TASK-12",
			title: "Editable comments",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			comments: [{ index: 1, createdDate: "2025-01-02 12:00", body: "Visible comment" }],
		};
		const container = document.getElementById("root");
		expect(container).toBeTruthy();
		activeRoot = createRoot(container as HTMLElement);

		await act(async () => {
			activeRoot?.render(
				<ThemeProvider>
					<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
				</ThemeProvider>,
			);
			await Promise.resolve();
		});

		expect(container?.textContent).toContain("Visible comment");
		expect(container?.textContent).not.toContain("Add comment");

		const editButton = Array.from((container as HTMLElement).querySelectorAll("button")).find((button) =>
			button.textContent?.includes("Edit"),
		);
		expect(editButton).toBeTruthy();
		await act(async () => {
			editButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
			await Promise.resolve();
		});

		expect(container?.textContent).toContain("Visible comment");
		expect(container?.textContent).toContain("Add comment");
	});

	it("stays in edit mode after adding a comment and receiving refreshed task data", async () => {
		setupDom();

		const originalUpdateTask = apiClient.updateTask.bind(apiClient);
		const task: Task = {
			id: "TASK-12B",
			title: "Editable comments refresh",
			status: "To Do",
			assignee: [],
			createdDate: "2025-01-01",
			labels: [],
			dependencies: [],
			comments: [{ index: 1, createdDate: "2025-01-02 12:00", body: "Visible comment" }],
		};
		const updatedTask: Task = {
			...task,
			comments: [
				...(task.comments ?? []),
				{ index: 2, author: "@reviewer", createdDate: "2025-01-03 12:00", body: "New comment" },
			],
		};
		apiClient.updateTask = async (id, updates) => {
			expect(id).toBe("TASK-12B");
			expect(updates.commentsAppend).toEqual(["New comment"]);
			expect(updates.commentAuthor).toBe("@reviewer");
			return updatedTask;
		};

		try {
			const container = document.getElementById("root");
			expect(container).toBeTruthy();
			activeRoot = createRoot(container as HTMLElement);

			await act(async () => {
				activeRoot?.render(
					<ThemeProvider>
						<TaskDetailsModal task={task} isOpen={true} onClose={() => {}} />
					</ThemeProvider>,
				);
				await Promise.resolve();
			});

			const editButton = Array.from((container as HTMLElement).querySelectorAll("button")).find((button) =>
				button.textContent?.includes("Edit"),
			);
			expect(editButton).toBeTruthy();
			await act(async () => {
				editButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
				await Promise.resolve();
			});

			const authorInput = (container as HTMLElement).querySelector("input[placeholder='Author']") as HTMLInputElement | null;
			const commentTextarea = (container as HTMLElement).querySelector(
				"textarea[placeholder='Add a comment...']",
			) as HTMLTextAreaElement | null;
			expect(authorInput).toBeTruthy();
			expect(commentTextarea).toBeTruthy();
			await act(async () => {
				setFormValue(authorInput!, "@reviewer");
				setFormValue(commentTextarea!, "New comment");
				await Promise.resolve();
			});

			const addButton = Array.from((container as HTMLElement).querySelectorAll("button")).find((button) =>
				button.textContent?.includes("Add comment"),
			);
			expect(addButton).toBeTruthy();
			await act(async () => {
				addButton?.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
				await Promise.resolve();
			});

			await act(async () => {
				activeRoot?.render(
					<ThemeProvider>
						<TaskDetailsModal task={updatedTask} isOpen={true} onClose={() => {}} />
					</ThemeProvider>,
				);
				await Promise.resolve();
			});

			expect(container?.textContent).toContain("New comment");
			expect(container?.textContent).toContain("Add comment");
			expect(container?.textContent).toContain("Save");
		} finally {
			apiClient.updateTask = originalUpdateTask;
		}
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
