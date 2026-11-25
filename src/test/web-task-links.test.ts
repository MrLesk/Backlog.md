import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";
import { pageBeneath, taskLinkTarget } from "../web/lib/task-links.ts";
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
	it("opens a task from the Tasks page over that page, with its filters", () => {
		expect(taskLinkTarget(task, { pathname: "/board", search: "?lane=milestone" })).toEqual({
			to: "/board/BACK-7/show-the-task-page?lane=milestone",
			state: { background: { pathname: "/board", search: "?lane=milestone" } },
			replace: false,
		});
	});

	it("replaces an open task and keeps the page beneath it", () => {
		const openTask = { pathname: "/tasks/BACK-3/another-task", search: "?status=To%20Do" };
		const background = { pathname: "/milestones", search: "" };

		expect(taskLinkTarget(task, { ...openTask, state: { background } })).toEqual({
			to: "/tasks/BACK-7/show-the-task-page?status=To%20Do",
			state: { background },
			replace: true,
		});
		// A task opened from a link outside the app has the Tasks page beneath it, which the next one keeps too.
		expect(taskLinkTarget(task, { ...openTask, state: null })).toEqual({
			to: "/tasks/BACK-7/show-the-task-page?status=To%20Do",
			state: undefined,
			replace: true,
		});
	});

	it("opens a task from any other page over that page, in the layout used last and without its query", () => {
		rememberTaskLayout("list");

		expect(taskLinkTarget(task, { pathname: "/milestones", search: "?query=v2" })).toEqual({
			to: "/tasks/BACK-7/show-the-task-page",
			state: { background: { pathname: "/milestones", search: "?query=v2" } },
			replace: false,
		});
	});
});

describe("pageBeneath", () => {
	it("is the page a task was opened from, or the Tasks page of the route for a task opened from outside the app", () => {
		const background = { pathname: "/drafts", search: "" };
		const route = { pathname: "/board/DRAFT-1/a-draft", search: "?lane=none" };

		expect(pageBeneath({ ...route, state: { background } })).toEqual(background);
		expect(pageBeneath(route)).toEqual({ pathname: "/board", search: "?lane=none" });
	});
});
