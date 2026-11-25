import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { taskLinkTarget } from "../web/lib/task-links.ts";
import { rememberTaskLayout } from "../web/lib/task-view.ts";

const task = { id: "BACK-7", title: "Show the task page" };

// A link from a page outside the Tasks page reads the layout used last, which the browser keeps in localStorage.
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

describe("taskLinkTarget", () => {
	it("opens a task from the Tasks page over that page, with its filters, and closes back to it", () => {
		expect(taskLinkTarget(task, { pathname: "/board", search: "?lane=milestone" })).toEqual({
			to: "/board/BACK-7/show-the-task-page?lane=milestone",
			state: { openedInApp: true },
			replace: false,
		});
	});

	it("replaces an open task and keeps how that task was opened", () => {
		const openTask = { pathname: "/tasks/BACK-3/another-task", search: "?status=To%20Do" };

		expect(taskLinkTarget(task, { ...openTask, state: { openedInApp: true } })).toEqual({
			to: "/tasks/BACK-7/show-the-task-page?status=To%20Do",
			state: { openedInApp: true },
			replace: true,
		});
		// A task opened from a link outside the app has nothing to go back to, so the next one closes to the Tasks page.
		expect(taskLinkTarget(task, { ...openTask, state: null })).toEqual({
			to: "/tasks/BACK-7/show-the-task-page?status=To%20Do",
			state: undefined,
			replace: true,
		});
	});

	it("opens a task from any other page over the layout used last, without that page's query", () => {
		rememberTaskLayout("list");

		expect(taskLinkTarget(task, { pathname: "/milestones", search: "?query=v2" })).toEqual({
			to: "/tasks/BACK-7/show-the-task-page",
			state: { openedInApp: true },
			replace: false,
		});
	});
});
