import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import BoardPage from "../web/components/BoardPage";
import SideNavigation from "../web/components/SideNavigation";

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

const renderNavigation = (isLoading: boolean, taskCount: number, error?: Error, loadingMessage?: string): string =>
	renderToString(
		<MemoryRouter>
			<SideNavigation
				taskCount={taskCount}
				docs={[]}
				decisions={[]}
				isLoading={isLoading}
				loadingMessage={loadingMessage}
				error={error}
				onRetry={async () => {}}
				onRefreshData={async () => {}}
			/>
		</MemoryRouter>,
	);

const renderBoard = (isLoading: boolean, error?: Error, loadingMessage?: string): string =>
	renderToString(
		<MemoryRouter>
			<BoardPage
				onEditTask={() => {}}
				onNewTask={() => {}}
				tasks={[]}
				statuses={["To Do", "Done"]}
				milestones={[]}
				availableLabels={[]}
				milestoneEntities={[]}
				archivedMilestones={[]}
				isLoading={isLoading}
				loadingMessage={loadingMessage}
				loadError={error}
				onRefreshData={async () => {}}
			/>
		</MemoryRouter>,
	);

describe("SideNavigation task loading", () => {
	it("keeps navigation mounted while only the task count is loading", () => {
		const phase = "Loading tasks from 7 local branches...";
		const loading = renderNavigation(true, 0, undefined, phase);
		expect(loading).toContain("Kanban Board");
		expect(loading).toContain("All Tasks");
		expect(loading).toContain('aria-label="Loading task count"');
		expect(loading).toContain('aria-label="Loading document count"');
		expect(loading).toContain('aria-label="Loading decision count"');
		expect(loading).toContain(phase);
		expect(loading).not.toContain("No documents");
		expect(loading).not.toContain("No decisions");

		const loaded = renderNavigation(false, 3).replaceAll("<!-- -->", "");
		expect(loaded).toContain("Kanban Board");
		expect(loaded).toContain("All Tasks");
		expect(loaded).toContain("Tasks (3)");
		expect(loaded).toContain("Documents (0)");
		expect(loaded).toContain("Decisions (0)");
		expect(loaded).toContain("No documents");
		expect(loaded).toContain("No decisions");
		expect(loaded).not.toContain('aria-label="Loading task count"');
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

	it("keeps Kanban loading, loaded-empty, and error states distinct", () => {
		const phase = "Applying latest task states from branch scans...";
		const loading = renderBoard(true, undefined, phase);
		expect(loading).toContain("Kanban Board");
		expect(loading).toContain(phase);
		expect(loading).toContain('role="status"');
		expect(loading).not.toContain("Empty");

		const loadedEmpty = renderBoard(false);
		expect(loadedEmpty).toContain("Empty");
		expect(loadedEmpty).not.toContain(phase);

		const failed = renderBoard(false, new Error("corpus failed"));
		expect(failed).toContain("Failed to load tasks");
		expect(failed).toContain("corpus failed");
		expect(failed).toContain("Retry");
		expect(failed).not.toContain("Empty");
	});
});
