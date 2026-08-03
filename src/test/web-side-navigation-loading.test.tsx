import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
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

const renderNavigation = (isLoading: boolean, taskCount: number): string =>
	renderToString(
		<MemoryRouter>
			<SideNavigation
				taskCount={taskCount}
				docs={[]}
				decisions={[]}
				isLoading={isLoading}
				onRefreshData={async () => {}}
			/>
		</MemoryRouter>,
	);

describe("SideNavigation task loading", () => {
	it("keeps navigation mounted while only the task count is loading", () => {
		const loading = renderNavigation(true, 0);
		expect(loading).toContain("Kanban Board");
		expect(loading).toContain("All Tasks");
		expect(loading).toContain('aria-label="Loading task count"');
		expect(loading).toContain('aria-label="Loading document count"');
		expect(loading).toContain('aria-label="Loading decision count"');
		expect(loading).toContain("Loading documents…");
		expect(loading).toContain("Loading decisions…");
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
});
