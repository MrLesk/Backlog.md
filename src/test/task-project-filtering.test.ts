import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { ContentStore } from "../core/content-store.ts";
import { createTaskSearchIndex } from "../utils/task-search.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let testDir: string;
let core: Core;

describe("task project filtering", () => {
	const cliPath = getTestCliPath();

	beforeEach(async () => {
		testDir = createUniqueTestDir("task-project-filtering");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);

		await initializeFilesystemTestProject(core, "Task Project Filtering");
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected test config");
		await core.filesystem.saveConfig({ ...config, projects: ["Web", "API", "Mobile"] });

		await core.createTaskFromInput(
			{
				title: "Shared Web failure",
				project: "web",
				status: "To Do",
				priority: "high",
				labels: ["ui", "urgent"],
			},
			false,
		);
		await core.createTaskFromInput(
			{
				title: "Shared API capability",
				project: "api",
				status: "In Progress",
				priority: "medium",
				labels: ["ui"],
			},
			false,
		);
		await core.createTaskFromInput(
			{
				title: "Shared Mobile exploration",
				project: "mobile",
				status: "To Do",
				priority: "low",
				labels: ["research"],
			},
			false,
		);
		await core.createTaskFromInput({ title: "Shared unprojected task", status: "To Do" }, false);
	});

	afterEach(async () => {
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	it("applies OR project semantics through Core queries with and without search text", async () => {
		const webTasks = await core.queryTasks({ filters: { project: "web" }, includeCrossBranch: false });
		expect(webTasks.map((task) => task.title)).toEqual(["Shared Web failure"]);

		const webAndMobile = await core.queryTasks({
			query: "Shared",
			filters: { project: ["WEB", "mobile"] },
			includeCrossBranch: false,
		});
		expect(webAndMobile.map((task) => task.title).sort()).toEqual(["Shared Mobile exploration", "Shared Web failure"]);
		expect(webAndMobile.some((task) => task.project === undefined)).toBe(false);
	});

	it("composes project with status, priority, labels, and exclude-status filters", async () => {
		const tasks = await core.queryTasks({
			filters: {
				project: ["Web", "API"],
				status: "To Do",
				excludeStatus: "Done",
				priority: "high",
				labels: ["urgent"],
			},
			includeCrossBranch: false,
		});
		expect(tasks.map((task) => task.title)).toEqual(["Shared Web failure"]);
	});

	it("uses the same project semantics in direct filesystem, content-store, and interactive search helpers", async () => {
		const filesystemTasks = await core.filesystem.listTasks({ project: ["api", "MOBILE"] });
		expect(filesystemTasks.map((task) => task.title).sort()).toEqual([
			"Shared API capability",
			"Shared Mobile exploration",
		]);

		const store = new ContentStore(core.filesystem);
		try {
			await store.ensureInitialized();
			expect(store.getTasks({ project: "WEB" }).map((task) => task.title)).toEqual(["Shared Web failure"]);
			const interactiveMatches = createTaskSearchIndex(store.getTasks()).search({
				query: "Shared",
				project: ["Web", "Mobile"],
			});
			expect(interactiveMatches.map((task) => task.title).sort()).toEqual([
				"Shared Mobile exploration",
				"Shared Web failure",
			]);
		} finally {
			store.dispose();
		}
	});

	it("filters CLI task list with repeated and comma-separated canonicalized values", async () => {
		const comma = await $`bun ${cliPath} task list --project web,mobile --plain`.cwd(testDir).quiet();
		const repeated = await $`bun ${cliPath} task list --project WEB --project Mobile --plain`.cwd(testDir).quiet();

		for (const result of [comma, repeated]) {
			expect(result.exitCode).toBe(0);
			const output = result.stdout.toString();
			expect(output).toContain("Shared Web failure");
			expect(output).toContain("Shared Mobile exploration");
			expect(output).not.toContain("Shared API capability");
			expect(output).not.toContain("Shared unprojected task");
		}
	});

	it("filters CLI search by project and composes with existing filters", async () => {
		const search = await $`bun ${cliPath} search "Shared" --project web,api --status "To Do" --priority high --plain`
			.cwd(testDir)
			.quiet();
		expect(search.exitCode).toBe(0);
		const output = search.stdout.toString();
		expect(output).toContain("Shared Web failure");
		expect(output).not.toContain("Shared API capability");
		expect(output).not.toContain("Shared Mobile exploration");

		const projectOnly = await $`bun ${cliPath} search --project API --plain`.cwd(testDir).quiet();
		expect(projectOnly.stdout.toString()).toContain("Shared API capability");
		expect(projectOnly.stdout.toString()).not.toContain("Documents:");
	});

	it("rejects invalid configured projects clearly", async () => {
		const list = await $`bun ${cliPath} task list --project desktop --plain`.cwd(testDir).nothrow().quiet();
		expect(list.exitCode).toBe(1);
		expect(list.stderr.toString()).toContain("Invalid project: desktop. Valid projects are: Web, API, Mobile");

		const search = await $`bun ${cliPath} search --project desktop --plain`.cwd(testDir).nothrow().quiet();
		expect(search.exitCode).toBe(1);
		expect(search.stderr.toString()).toContain("Invalid project: desktop. Valid projects are: Web, API, Mobile");
	});

	it("fails closed on project filters when no projects are configured", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected test config");
		await core.filesystem.saveConfig({ ...config, projects: [] });

		const list = await $`bun ${cliPath} task list --project web --plain`.cwd(testDir).nothrow().quiet();
		expect(list.exitCode).toBe(1);
		expect(list.stderr.toString()).toContain("No projects are configured. Add a 'projects:' list to");

		const search = await $`bun ${cliPath} search --project web --plain`.cwd(testDir).nothrow().quiet();
		expect(search.exitCode).toBe(1);
		expect(search.stderr.toString()).toContain("No projects are configured. Add a 'projects:' list to");
	});

	it("documents configured project filters and completes their values", async () => {
		const listHelp = await $`bun ${cliPath} task list --help`.cwd(testDir).text();
		const searchHelp = await $`bun ${cliPath} search --help`.cwd(testDir).text();
		expect(listHelp).toContain("--project <project>");
		expect(listHelp).toContain("project: one or more of configured projects: Web, API, Mobile");
		expect(searchHelp).toContain("--project <project>");
		expect(searchHelp).toContain("project: one or more of configured projects: Web, API, Mobile");

		for (const completionLine of ["backlog task list --project ", "backlog search --project "]) {
			const completion =
				await $`bun ${cliPath} completion __complete ${completionLine} ${String(completionLine.length)}`
					.cwd(testDir)
					.quiet();
			expect(completion.stdout.toString().trim().split("\n")).toEqual(["Web", "API", "Mobile"]);
		}
	});
});
