import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { ContentStore } from "../core/content-store.ts";
import { SearchService } from "../core/search-service.ts";
import { withReadiness } from "../core/task-detail.ts";
import { FileSystem } from "../file-system/operations.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { Task, TaskSearchResult } from "../types/index.ts";
import { NO_MILESTONE_FILTER_VALUE } from "../utils/milestone-filter.ts";
import {
	applyTaskFilters,
	buildTaskSearchBodyText,
	createTaskSearchIndex,
	type TaskFilterOptions,
} from "../utils/task-search.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

/**
 * The local one-shot index (`task list --search`, the TUI views, the MCP adapter) and the
 * cross-branch SearchService (`backlog search`, the web API) must agree on what a query matches
 * and on what a filter means. These tests pin that agreement.
 */

const labelledTask: Task = {
	id: "task-1",
	title: "Rework the exporter",
	status: "To Do",
	assignee: ["@morgan"],
	reporter: "@morgan",
	createdDate: "2026-01-05 09:00",
	labels: ["backend", "infrastructure"],
	dependencies: [],
	rawContent: "## Description\nNothing here mentions the label or the assignee.",
	description: "Nothing here mentions the label or the assignee.",
};

const otherTask: Task = {
	id: "task-2",
	title: "Polish the sidebar",
	status: "To Do",
	assignee: ["@riley"],
	reporter: "@riley",
	createdDate: "2026-01-05 09:00",
	labels: ["backend"],
	dependencies: [],
	rawContent: "## Description\nUnrelated body text.",
	description: "Unrelated body text.",
};

const tasks = [labelledTask, otherTask];

function taskIds(results: Task[]): string[] {
	return results.map((task) => task.id).sort();
}

describe("task search corpus", () => {
	it("puts labels and assignees in the searchable text", () => {
		const bodyText = buildTaskSearchBodyText(labelledTask);
		expect(bodyText).toContain("infrastructure");
		expect(bodyText).toContain("@morgan");
	});
});

describe("cross-surface search parity", () => {
	let TEST_DIR: string;
	let filesystem: FileSystem;
	let store: ContentStore;
	let search: SearchService;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("task-search-parity");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		for (const task of tasks) {
			await filesystem.saveTask(task);
		}
		store = new ContentStore(filesystem);
		search = new SearchService(store);
		await search.ensureInitialized();
	});

	afterEach(async () => {
		search?.dispose();
		store?.dispose();
		await safeCleanup(TEST_DIR);
	});

	const searchServiceTaskIds = (query: string): string[] =>
		search
			.search({ query, types: ["task"] })
			.filter((result): result is TaskSearchResult => result.type === "task")
			.map((result) => result.task.id)
			.sort();

	it("finds a task by a label it carries through both surfaces", () => {
		const localMatches = taskIds(createTaskSearchIndex(tasks).search({ query: "infrastructure" }));

		expect(localMatches).toEqual(["task-1"]);
		expect(searchServiceTaskIds("infrastructure")).toEqual(["TASK-1"]);
	});

	it("finds a task by its assignee through both surfaces", () => {
		const localMatches = taskIds(createTaskSearchIndex(tasks).search({ query: "morgan" }));

		expect(localMatches).toEqual(["task-1"]);
		expect(searchServiceTaskIds("morgan")).toEqual(["TASK-1"]);
	});

	it("agrees on a label filter applied without a query", () => {
		const localMatches = taskIds(applyTaskFilters(tasks, { labels: ["backend"] }));
		const serviceMatches = search
			.search({ types: ["task"], filters: { labels: ["backend"] } })
			.filter((result): result is TaskSearchResult => result.type === "task")
			.map((result) => result.task.id)
			.sort();

		expect(localMatches).toEqual(["task-1", "task-2"]);
		expect(serviceMatches).toEqual(["TASK-1", "TASK-2"]);
	});

	it("agrees on an assignee filter applied without a query", () => {
		const localMatches = taskIds(applyTaskFilters(tasks, { assignee: "@MORGAN" }));
		const serviceMatches = search
			.search({ types: ["task"], filters: { assignee: "@MORGAN" } })
			.filter((result): result is TaskSearchResult => result.type === "task")
			.map((result) => result.task.id)
			.sort();

		expect(localMatches).toEqual(["task-1"]);
		expect(serviceMatches).toEqual(["TASK-1"]);
	});

	it("applies the same labelMatch semantics with and without a query", () => {
		const bothLabels = ["backend", "infrastructure"];

		expect(taskIds(applyTaskFilters(tasks, { labels: bothLabels, labelMatch: "all" }))).toEqual(["task-1"]);
		expect(taskIds(applyTaskFilters(tasks, { labels: bothLabels, labelMatch: "any" }))).toEqual(["task-1", "task-2"]);

		const withQuery = { query: "the", labels: bothLabels } as const;
		expect(taskIds(applyTaskFilters(tasks, { ...withQuery, labelMatch: "all" }))).toEqual(["task-1"]);
		expect(taskIds(applyTaskFilters(tasks, { ...withQuery, labelMatch: "any" }))).toEqual(["task-1", "task-2"]);
	});
});

/**
 * The TUI task viewer used to re-implement the milestone, labelMatch=all, and readiness filters by
 * hand on top of a query, so those three could drift from the same filters applied without one.
 * They all live in the shared predicate now; these pin that a query no longer changes what a filter
 * means.
 */
describe("filters mean the same thing with and without a query", () => {
	const milestoneTasks: Task[] = [
		{
			id: "task-10",
			title: "Wire the release checklist",
			status: "To Do",
			assignee: [],
			createdDate: "2026-01-05 09:00",
			labels: [],
			dependencies: [],
			milestone: "m-1",
		},
		{
			id: "task-11",
			title: "Wire the follow-up checklist",
			status: "To Do",
			assignee: [],
			createdDate: "2026-01-05 09:00",
			labels: [],
			dependencies: ["task-10"],
			milestone: "m-2",
		},
		{
			id: "task-12",
			title: "Wire the unscheduled checklist",
			status: "To Do",
			assignee: [],
			createdDate: "2026-01-05 09:00",
			labels: [],
			dependencies: [],
		},
	];
	const resolveMilestoneLabel = (milestone: string) => (milestone === "m-1" ? "Release 1" : "Release 2");
	// Every task's title matches, so the query narrows nothing and only the filter can change the set.
	const query = "checklist";

	it("resolves a milestone title the same way with and without a query", () => {
		const options = { milestone: "Release 1", resolveMilestoneLabel } as const;
		expect(taskIds(applyTaskFilters(milestoneTasks, options))).toEqual(["task-10"]);
		expect(taskIds(applyTaskFilters(milestoneTasks, { ...options, query }))).toEqual(["task-10"]);
	});

	it("keeps the no-milestone filter meaning the same with and without a query", () => {
		const options = { milestone: NO_MILESTONE_FILTER_VALUE, resolveMilestoneLabel } as const;
		expect(taskIds(applyTaskFilters(milestoneTasks, options))).toEqual(["task-12"]);
		expect(taskIds(applyTaskFilters(milestoneTasks, { ...options, query }))).toEqual(["task-12"]);
	});

	it("keeps dependency readiness meaning the same with and without a query", () => {
		// Readiness is no longer a filter predicate: it is derived over whatever the other filters
		// left, against the whole corpus. A query must not change which rows come back ready.
		const corpus = { tasks: milestoneTasks, completedTasks: [], statuses: ["To Do", "In Progress", "Done"] };
		const readyIds = (options: TaskFilterOptions) =>
			withReadiness(applyTaskFilters(milestoneTasks, options), corpus)
				.filter((row) => row.isReady)
				.map((row) => row.id);
		// task-11 depends on an unfinished task-10, so it is the one readiness must drop.
		expect(readyIds({})).toEqual(["task-10", "task-12"]);
		expect(readyIds({ query })).toEqual(["task-10", "task-12"]);
	});
});

describe("labelMatch semantics", () => {
	it("defaults to matching any selected label", () => {
		expect(taskIds(applyTaskFilters(tasks, { labels: ["backend", "infrastructure"] }))).toEqual(["task-1", "task-2"]);
	});

	it("requires every label when the caller asks for all", () => {
		expect(taskIds(applyTaskFilters(tasks, { labels: ["backend", "infrastructure"], labelMatch: "all" }))).toEqual([
			"task-1",
		]);
	});

	it("matches labels case-insensitively in both modes", () => {
		expect(taskIds(applyTaskFilters(tasks, { labels: ["BACKEND"] }))).toEqual(["task-1", "task-2"]);
		expect(taskIds(applyTaskFilters(tasks, { labels: ["BackEnd", "INFRASTRUCTURE"], labelMatch: "all" }))).toEqual([
			"task-1",
		]);
	});
});

/**
 * Filters reach the shared predicate through several different call sites, and an argument dropped
 * at any one of them is invisible to a test that only exercises the predicate directly. These tests
 * drive the real CLI and MCP surfaces so the wiring itself is pinned.
 */
describe("filter wiring across surfaces", () => {
	const cliPath = getTestCliPath();
	let testDir: string;
	let core: Core;
	let mcpServer: McpServer;

	beforeEach(async () => {
		testDir = createUniqueTestDir("task-search-wiring");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Filter Wiring");
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected test config");
		await core.filesystem.saveConfig({ ...config, projects: ["Web", "API"] });

		await core.createTaskFromInput(
			{ title: "Wiring both labels", project: "web", status: "To Do", labels: ["backend", "infrastructure"] },
			false,
		);
		await core.createTaskFromInput(
			{ title: "Wiring one label", project: "api", status: "To Do", labels: ["backend"] },
			false,
		);
		await core.createTaskFromInput({ title: "Wiring no labels", status: "To Do" }, false);

		mcpServer = new McpServer(testDir, "Test instructions");
		const mcpConfig = await mcpServer.filesystem.loadConfig();
		if (!mcpConfig) throw new Error("Expected MCP test config");
		registerTaskTools(mcpServer, mcpConfig);
	});

	afterEach(async () => {
		await mcpServer.stop();
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	const mcpTaskList = async (args: Record<string, unknown>): Promise<string> => {
		const result = await mcpServer.testInterface.callTool({ params: { name: "task_list", arguments: args } });
		const content = result.content as Array<{ text?: string }> | undefined;
		return content?.[0]?.text ?? "";
	};

	it("requires every label through the MCP task_list labels argument", async () => {
		const bothLabels = await mcpTaskList({ labels: ["backend", "infrastructure"] });
		expect(bothLabels).toContain("Wiring both labels");
		expect(bothLabels).not.toContain("Wiring one label");
		expect(bothLabels).not.toContain("Wiring no labels");

		const oneLabel = await mcpTaskList({ labels: ["backend"] });
		expect(oneLabel).toContain("Wiring both labels");
		expect(oneLabel).toContain("Wiring one label");
	});

	it("matches MCP labels case-insensitively like every other surface", async () => {
		const upper = await mcpTaskList({ labels: ["BACKEND", "INFRASTRUCTURE"] });
		expect(upper).toContain("Wiring both labels");
		expect(upper).not.toContain("Wiring one label");
	});

	it("requires every label through the CLI task list --labels flag", async () => {
		const both = await $`bun ${cliPath} task list --labels backend,infrastructure --plain`.cwd(testDir).quiet();
		expect(both.exitCode).toBe(0);
		expect(both.stdout.toString()).toContain("Wiring both labels");
		expect(both.stdout.toString()).not.toContain("Wiring one label");

		const single = await $`bun ${cliPath} task list --labels backend --plain`.cwd(testDir).quiet();
		expect(single.exitCode).toBe(0);
		expect(single.stdout.toString()).toContain("Wiring both labels");
		expect(single.stdout.toString()).toContain("Wiring one label");
	});

	it("filters by project identically through Core, the search service, MCP, and both CLI entry points", async () => {
		const expected = ["Wiring both labels"];

		// Core.queryTasks backs `task list` and `GET /api/tasks`.
		const coreTasks = await core.queryTasks({ filters: { project: "web" }, includeCrossBranch: false });
		expect(coreTasks.map((task) => task.title)).toEqual(expected);

		// SearchService backs `backlog search` and `GET /api/search`.
		const searchService = await core.getSearchService();
		const serviceTitles = searchService
			.search({ types: ["task"], filters: { project: "web" } })
			.filter((result): result is TaskSearchResult => result.type === "task")
			.map((result) => result.task.title);
		expect(serviceTitles).toEqual(expected);

		const mcpOutput = await mcpTaskList({ project: ["web"] });
		expect(mcpOutput).toContain("Wiring both labels");
		expect(mcpOutput).not.toContain("Wiring one label");
		expect(mcpOutput).not.toContain("Wiring no labels");

		const list = await $`bun ${cliPath} task list --project web --plain`.cwd(testDir).quiet();
		expect(list.exitCode).toBe(0);
		expect(list.stdout.toString()).toContain("Wiring both labels");
		expect(list.stdout.toString()).not.toContain("Wiring one label");

		const search = await $`bun ${cliPath} search "Wiring" --project web --plain`.cwd(testDir).quiet();
		expect(search.exitCode).toBe(0);
		expect(search.stdout.toString()).toContain("Wiring both labels");
		expect(search.stdout.toString()).not.toContain("Wiring one label");
	});

	it("keeps OR semantics when several projects are requested", async () => {
		const both = await core.queryTasks({ filters: { project: ["WEB", "api"] }, includeCrossBranch: false });
		expect(both.map((task) => task.title).sort()).toEqual(["Wiring both labels", "Wiring one label"]);
		// A task with no project never matches a non-empty project filter.
		expect(both.some((task) => task.project === undefined)).toBe(false);
	});
});
