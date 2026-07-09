import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { ContentStore } from "../core/content-store.ts";
import { createTaskSearchIndex } from "../utils/task-search.ts";
import { createUniqueTestDir, initializeTestProject, safeCleanup } from "./test-utils.ts";

let testDir: string;
let core: Core;

describe("task type filtering", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		testDir = createUniqueTestDir("task-type-filtering");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await $`git init -b main`.cwd(testDir).quiet();
		await $`git config user.name "Test User"`.cwd(testDir).quiet();
		await $`git config user.email test@example.com`.cwd(testDir).quiet();

		await initializeTestProject(core, "Task Type Filtering");
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected test config");
		await core.filesystem.saveConfig({ ...config, types: ["Bug", "Feature", "Spike"] });

		await core.createTaskFromInput(
			{
				title: "Shared API failure",
				type: "bug",
				status: "To Do",
				priority: "high",
				labels: ["api", "urgent"],
			},
			false,
		);
		await core.createTaskFromInput(
			{
				title: "Shared API capability",
				type: "feature",
				status: "In Progress",
				priority: "medium",
				labels: ["api"],
			},
			false,
		);
		await core.createTaskFromInput(
			{
				title: "Shared API exploration",
				type: "spike",
				status: "To Do",
				priority: "low",
				labels: ["research"],
			},
			false,
		);
		await core.createTaskFromInput({ title: "Shared legacy task", status: "To Do" }, false);
	});

	afterEach(async () => {
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	it("applies OR type semantics through Core queries with and without search text", async () => {
		const bugs = await core.queryTasks({ filters: { type: "bug" }, includeCrossBranch: false });
		expect(bugs.map((task) => task.title)).toEqual(["Shared API failure"]);

		const bugsAndSpikes = await core.queryTasks({
			query: "Shared API",
			filters: { type: ["BUG", "spike"] },
			includeCrossBranch: false,
		});
		expect(bugsAndSpikes.map((task) => task.title).sort()).toEqual(["Shared API exploration", "Shared API failure"]);
		expect(bugsAndSpikes.some((task) => task.type === undefined)).toBe(false);
	});

	it("composes type with status, priority, labels, and exclude-status filters", async () => {
		const tasks = await core.queryTasks({
			filters: {
				type: ["Bug", "Feature"],
				status: "To Do",
				excludeStatus: "Done",
				priority: "high",
				labels: ["urgent"],
			},
			includeCrossBranch: false,
		});
		expect(tasks.map((task) => task.title)).toEqual(["Shared API failure"]);
	});

	it("uses the same type semantics in direct filesystem, content-store, and interactive search helpers", async () => {
		const filesystemTasks = await core.filesystem.listTasks({ type: ["feature", "SPIKE"] });
		expect(filesystemTasks.map((task) => task.title).sort()).toEqual([
			"Shared API capability",
			"Shared API exploration",
		]);

		const store = new ContentStore(core.filesystem);
		try {
			await store.ensureInitialized();
			expect(store.getTasks({ type: "BUG" }).map((task) => task.title)).toEqual(["Shared API failure"]);
			const interactiveMatches = createTaskSearchIndex(store.getTasks()).search({
				query: "Shared API",
				type: ["Bug", "Spike"],
			});
			expect(interactiveMatches.map((task) => task.title).sort()).toEqual([
				"Shared API exploration",
				"Shared API failure",
			]);
		} finally {
			store.dispose();
		}
	});

	it("filters CLI task list with repeated and comma-separated canonicalized values", async () => {
		const comma = await $`bun ${cliPath} task list --type bug,spike --plain`.cwd(testDir).quiet();
		const repeated = await $`bun ${cliPath} task list --type BUG --type Spike --plain`.cwd(testDir).quiet();

		for (const result of [comma, repeated]) {
			expect(result.exitCode).toBe(0);
			const output = result.stdout.toString();
			expect(output).toContain("Shared API failure");
			expect(output).toContain("Shared API exploration");
			expect(output).not.toContain("Shared API capability");
			expect(output).not.toContain("Shared legacy task");
		}
	});

	it("filters CLI search by task type and composes with existing filters", async () => {
		const search =
			await $`bun ${cliPath} search "Shared API" --task-type bug,feature --status "To Do" --priority high --plain`
				.cwd(testDir)
				.quiet();
		expect(search.exitCode).toBe(0);
		const output = search.stdout.toString();
		expect(output).toContain("Shared API failure");
		expect(output).not.toContain("Shared API capability");
		expect(output).not.toContain("Shared API exploration");

		const typeOnly = await $`bun ${cliPath} search --task-type Feature --plain`.cwd(testDir).quiet();
		expect(typeOnly.stdout.toString()).toContain("Shared API capability");
		expect(typeOnly.stdout.toString()).not.toContain("Documents:");
	});

	it("rejects invalid configured task types clearly", async () => {
		const list = await $`bun ${cliPath} task list --type chore --plain`.cwd(testDir).nothrow().quiet();
		expect(list.exitCode).toBe(1);
		expect(list.stderr.toString()).toContain("Invalid type: chore. Valid types are: Bug, Feature, Spike");

		const search = await $`bun ${cliPath} search --task-type chore --plain`.cwd(testDir).nothrow().quiet();
		expect(search.exitCode).toBe(1);
		expect(search.stderr.toString()).toContain("Invalid task-type: chore. Valid types are: Bug, Feature, Spike");
	});

	it("documents configured task-type filters without changing search result-type semantics", async () => {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected test config");
		await core.filesystem.saveConfig({ ...config, types: ["Bug", "Epic"] });

		const listHelp = await $`bun ${cliPath} task list --help`.cwd(testDir).text();
		const searchHelp = await $`bun ${cliPath} search --help`.cwd(testDir).text();
		expect(listHelp).toContain("--type <type>");
		expect(listHelp).toContain("type: one or more of configured task types: Bug, Epic");
		expect(listHelp).toContain('backlog task list --type "Bug" --plain');
		expect(searchHelp).toContain("--type <type>");
		expect(searchHelp).toContain("--task-type <type>");
		expect(searchHelp).toContain("task-type: one or more of configured task types: Bug, Epic");
		expect(searchHelp).toContain('backlog search "crash" --task-type "Bug" --plain');

		const taskCreationGuide = await $`bun ${cliPath} instructions task-creation`.cwd(testDir).text();
		expect(taskCreationGuide).toContain('backlog task list --type "Bug" --plain');
		expect(taskCreationGuide).not.toContain("--type bug,spike");

		const advertisedList = await $`bun ${cliPath} task list --type Bug --plain`.cwd(testDir).quiet();
		const advertisedSearch = await $`bun ${cliPath} search "Shared API" --task-type Bug --plain`.cwd(testDir).quiet();
		expect(advertisedList.exitCode).toBe(0);
		expect(advertisedSearch.exitCode).toBe(0);

		for (const completionLine of ["backlog task list --type ", "backlog search --task-type "]) {
			const completion =
				await $`bun ${cliPath} completion __complete ${completionLine} ${String(completionLine.length)}`
					.cwd(testDir)
					.quiet();
			expect(completion.stdout.toString().trim().split("\n")).toEqual(["Bug", "Epic"]);
		}
		for (const unsupportedLine of ["backlog task create --task-type ", "backlog task list --task-type "]) {
			const completion =
				await $`bun ${cliPath} completion __complete ${unsupportedLine} ${String(unsupportedLine.length)}`
					.cwd(testDir)
					.quiet();
			expect(completion.stdout.toString().trim()).toBe("");
		}

		const incompatible = await $`bun ${cliPath} search --type document --task-type Bug --plain`
			.cwd(testDir)
			.nothrow()
			.quiet();
		expect(incompatible.exitCode).toBe(1);
		expect(incompatible.stderr.toString()).toContain(
			"--task-type filters task results. Include --type task or omit --type.",
		);
	});
});
