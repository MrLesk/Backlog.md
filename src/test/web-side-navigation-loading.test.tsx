import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SideNavigation from "../web/components/SideNavigation";
import TasksPage from "../web/components/TasksPage";

const storage = new Map<string, string>();
globalThis.localStorage = {
	getItem: (key) => storage.get(key) ?? null,
	setItem: (key, value) => storage.set(key, value),
	removeItem: (key) => storage.delete(key),
	clear: () => storage.clear(),
	key: (index) => [...storage.keys()][index] ?? null,
	get length() {
		return storage.size;
	},
} as Storage;

const renderNavigation = (isLoading: boolean, taskCount: number, error?: Error, path = "/"): string =>
	renderToString(
		<MemoryRouter initialEntries={[path]}>
			<SideNavigation
				taskCount={taskCount}
				docs={[]}
				decisions={[]}
				isLoading={isLoading}
				error={error}
				onRetry={async () => {}}
				onRefreshData={async () => {}}
			/>
		</MemoryRouter>,
	);

// The text a reader sees in server-rendered markup, read with Bun's HTML parser: no tags, no comments.
const visibleText = (html: string): string => {
	let text = "";
	new HTMLRewriter()
		.onDocument({
			text(chunk) {
				text += chunk.text;
			},
		})
		.transform(html);
	return text;
};

/** The href, aria-current and visible text of the sidebar's Tasks entry. */
const tasksEntry = (html: string): { href: string | null; current: string | null; text: string } => {
	const links: Array<{ href: string | null; current: string | null; text: string }> = [];
	new HTMLRewriter()
		.on("a", {
			element(element) {
				links.push({ href: element.getAttribute("href"), current: element.getAttribute("aria-current"), text: "" });
			},
			text(chunk) {
				const link = links.at(-1);
				if (link) link.text += chunk.text;
			},
		})
		.transform(html);
	const entry = links.find((link) => link.text.startsWith("Tasks"));
	return entry ?? { href: null, current: null, text: "" };
};

const renderBoard = (isLoading: boolean, error?: Error): string =>
	renderToString(
		<MemoryRouter initialEntries={["/board"]}>
			<TasksPage
				layout="board"
				tasks={[]}
				statuses={["To Do", "Done"]}
				availableLabels={[]}
				milestones={[]}
				milestoneEntities={[]}
				archivedMilestones={[]}
				availableTypes={[]}
				availableProjects={[]}
				isLoading={isLoading}
				loadError={error}
				hideEmptyColumns={false}
				onEditTask={() => {}}
				onNewTask={() => {}}
				onRefreshData={async () => {}}
				onTasksUpdated={() => {}}
			/>
		</MemoryRouter>,
	);

describe("SideNavigation task loading", () => {
	it("keeps navigation mounted while only the task count is loading", () => {
		const loading = renderNavigation(true, 0);
		expect(tasksEntry(loading).href).toBe("/board");
		expect(loading).toContain('aria-label="Loading task count"');
		expect(loading).toContain('aria-label="Loading document count"');
		expect(loading).toContain('aria-label="Loading decision count"');
		expect(loading).toContain('aria-label="Loading content"');
		expect(loading).not.toContain("No documents");
		expect(loading).not.toContain("No decisions");

		const loaded = renderNavigation(false, 3);
		const loadedText = visibleText(loaded);
		// The entry's label followed by its count.
		expect(tasksEntry(loaded).text).toBe("Tasks3");
		expect(loadedText).toContain("Documents (0)");
		expect(loadedText).toContain("Decisions (0)");
		expect(loadedText).toContain("No documents");
		expect(loadedText).toContain("No decisions");
		expect(loaded).not.toContain('aria-label="Loading task count"');
	});

	it("offers one Tasks entry that is current on both layouts and opens the layout used last", () => {
		const onBoard = renderNavigation(false, 3, undefined, "/board/BACK-1/open-task");
		expect(visibleText(onBoard)).not.toContain("Kanban Board");
		expect(visibleText(onBoard)).not.toContain("All Tasks");
		expect(tasksEntry(onBoard)).toMatchObject({ href: "/board", current: "page" });
		expect(tasksEntry(renderNavigation(false, 3, undefined, "/tasks"))).toMatchObject({ href: "/tasks", current: "page" });

		storage.set("backlog.tasks.layout", "list");
		try {
			expect(tasksEntry(renderNavigation(false, 3, undefined, "/milestones"))).toMatchObject({ href: "/tasks", current: null });
		} finally {
			storage.delete("backlog.tasks.layout");
		}
		expect(tasksEntry(renderNavigation(false, 3, undefined, "/milestones"))).toMatchObject({ href: "/board", current: null });
	});

	it("shows a distinct unavailable presentation and exposes retry after a corpus failure", () => {
		const failed = renderNavigation(false, 0, new Error("corpus failed"));
		expect(failed).toContain("Failed to load navigation");
		expect(failed).toContain("Retry");
		expect(failed).toContain('aria-label="task count unavailable"');
		expect(failed).not.toContain('aria-label="Loading task count"');
		expect(failed).not.toContain("No documents");
		expect(failed).not.toContain("No decisions");
	});

	it("keeps a retryable load failure visible when the sidebar is collapsed", () => {
		storage.set("sideNavCollapsed", "true");
		try {
			const failed = renderNavigation(false, 0, new Error("corpus failed"));
			expect(failed).toContain('role="alert"');
			expect(failed).toContain('aria-label="Failed to load navigation. Retry"');
			expect(failed).toContain("Retry");
		} finally {
			storage.delete("sideNavCollapsed");
		}
	});

	it("keeps board loading, loaded-empty, and error states distinct", () => {
		const loading = renderBoard(true);
		expect(loading).toContain('role="status"');
		expect(loading).not.toContain("Empty");

		const loadedEmpty = renderBoard(false);
		expect(loadedEmpty).toContain("Empty");
		expect(loadedEmpty).not.toContain('aria-label="Loading tasks"');

		const failed = renderBoard(false, new Error("corpus failed"));
		expect(failed).toContain("Failed to load tasks");
		expect(failed).toContain("corpus failed");
		expect(failed).toContain("Retry");
		expect(failed).not.toContain("Empty");
	});
});
