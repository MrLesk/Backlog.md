import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SideNavigation from "../web/components/SideNavigation";

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

		const loaded = renderNavigation(false, 3).replaceAll("<!-- -->", "");
		expect(loaded).toContain("Kanban Board");
		expect(loaded).toContain("All Tasks");
		expect(loaded).toContain("Tasks (3)");
		expect(loaded).not.toContain('aria-label="Loading task count"');
	});
});
