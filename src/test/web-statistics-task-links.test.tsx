import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "../types/index.ts";
import Statistics from "../web/components/Statistics.tsx";
import { apiClient } from "../web/lib/api.ts";

const task: Task = {
	id: "TASK-7",
	title: "Recently created task",
	status: "To Do",
	assignee: [],
	labels: [],
	dependencies: [],
	createdDate: "2026-11-20",
};

let activeRoot: Root | null = null;
let activeDom: JSDOM | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => activeRoot?.unmount());
		activeRoot = null;
	}
	activeDom?.window.close();
	activeDom = null;
});

describe("Statistics task links", () => {
	it("keeps its task links through a render, so a task opened from one returns focus to it", async () => {
		activeDom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost" });
		(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		globalThis.window = activeDom.window as unknown as Window & typeof globalThis;
		globalThis.document = activeDom.window.document as Document;
		globalThis.navigator = activeDom.window.navigator as Navigator;
		globalThis.localStorage = activeDom.window.localStorage;
		const fetchStatistics = spyOn(apiClient, "fetchStatistics").mockResolvedValue({
			statusCounts: { "To Do": 1 },
			priorityCounts: {},
			noPriorityCount: 1,
			totalTasks: 1,
			completedTasks: 0,
			completionPercentage: 0,
			draftCount: 0,
			recentActivity: { created: [task], updated: [] },
			projectHealth: { averageTaskAge: 5, staleTasks: [], blockedTasks: [] },
		});

		try {
			activeRoot = createRoot(document.getElementById("root") as HTMLElement);
			// The page as the app shows it: each render of the app renders it again with the same data.
			const render = async () => {
				await act(async () => {
					activeRoot?.render(
						<MemoryRouter initialEntries={["/statistics"]}>
							<Statistics statuses={["To Do", "Done"]} />
						</MemoryRouter>,
					);
				});
			};
			await render();
			const link = document.querySelector("a[href^='/board/TASK-7/']");
			expect(link).toBeTruthy();

			await render();
			expect(link?.isConnected).toBe(true);
			expect(document.querySelector("a[href^='/board/TASK-7/']")).toBe(link);
		} finally {
			fetchStatistics.mockRestore();
		}
	});
});
