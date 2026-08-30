import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();

let TEST_DIR: string;
let core: Core;

async function runCli(args: string[], cwd = TEST_DIR) {
	return await $`bun ${[CLI_PATH, ...args]}`.cwd(cwd).nothrow().quiet();
}

async function addTask(id: string, title: string, dependencies: string[] = []) {
	await core.createTask(
		{ id, title, status: "To Do", assignee: [], createdDate: "2026-07-14 09:30", labels: [], dependencies },
		false,
	);
}

/** The dependency-graph block of `task view --plain`, without the surrounding detail sections. */
function graphSection(stdout: string): string[] {
	const lines = stdout.split("\n");
	const start = lines.indexOf("Dependency Graph:");
	if (start === -1) return [];
	// Everything after the heading and its rule, up to whatever section comes next. The direction
	// headings carry counts in parentheses, so they never look like a top-level section heading.
	const body = lines.slice(start + 2);
	const next = body.findIndex((line) => /^[A-Z][A-Za-z ]+:$/.test(line));
	const section = next === -1 ? body : body.slice(0, next);
	while (section.length > 0 && section[section.length - 1] === "") section.pop();
	return section;
}

describe("CLI dependency graph", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-dependency-graph");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Dependency Graph Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("shows complete forward and reverse chains with direct and transitive relationships", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Middle", ["task-1"]);
		await addTask("task-3", "Selected", ["task-2"]);
		await addTask("task-4", "Follow up", ["task-3"]);
		await addTask("task-5", "Last", ["task-4"]);

		const result = await runCli(["task", "view", "3", "--plain"]);
		expect(result.exitCode).toBe(0);
		expect(graphSection(result.stdout.toString())).toEqual([
			"Depends on (1 direct, 2 total):",
			"└─ TASK-2 - Middle [To Do]",
			"   └─ TASK-1 - Foundation [To Do]",
			"",
			"Dependents (1 direct, 2 total):",
			"└─ TASK-4 - Follow up [To Do]",
			"   └─ TASK-5 - Last [To Do]",
		]);
	});

	it("replaces the raw dependency ID list with the graph, and keeps it on write confirmations", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Selected", ["task-1"]);

		// The graph says everything the ID list would, so task detail does not repeat it.
		const viewed = (await runCli(["task", "view", "2", "--plain"])).stdout.toString();
		expect(viewed).not.toContain("Dependencies:");
		expect(viewed).toContain("Dependency Graph:");
		expect(viewed.indexOf("Dependency Graph:")).toBeLessThan(viewed.indexOf("Description:"));

		// A write confirmation carries no graph, so it still echoes what was just set.
		const edited = (await runCli(["task", "edit", "2", "--plain", "-l", "graph"])).stdout.toString();
		expect(edited).toContain("Dependencies: task-1");
		expect(edited).not.toContain("Dependency Graph:");
	});

	it("renders modified files with the plan and notes rather than in the header block", async () => {
		await addTask("task-1", "Selected");
		await runCli(["task", "edit", "1", "--notes", "Did the work", "--modified-file", "src/api.ts"]);

		const stdout = (await runCli(["task", "view", "1", "--plain"])).stdout.toString();
		expect(stdout).toContain("Modified files: src/api.ts");
		expect(stdout.indexOf("Implementation Notes:")).toBeLessThan(stdout.indexOf("Modified files:"));
		expect(stdout.indexOf("Description:")).toBeLessThan(stdout.indexOf("Modified files:"));
	});

	it("renders a diamond once and marks the repeated branch", async () => {
		await addTask("task-1", "Shared");
		await addTask("task-2", "Left", ["task-1"]);
		await addTask("task-3", "Right", ["task-1"]);
		await addTask("task-4", "Selected", ["task-2", "task-3"]);

		expect(graphSection((await runCli(["task", "view", "4", "--plain"])).stdout.toString())).toEqual([
			"Depends on (2 direct, 3 total):",
			"├─ TASK-2 - Left [To Do]",
			"│  └─ TASK-1 - Shared [To Do]",
			"└─ TASK-3 - Right [To Do]",
			"   └─ TASK-1 - Shared [To Do] (shown above)",
		]);
	});

	it("terminates a cycle instead of repeating it", async () => {
		await addTask("task-1", "Selected");
		await addTask("task-2", "Second", ["task-1"]);
		await runCli(["task", "edit", "1", "--dep", "task-2"]);

		const lines = graphSection((await runCli(["task", "view", "1", "--plain"])).stdout.toString());
		expect(lines).toEqual([
			"Depends on (1 direct, 1 total):",
			"└─ TASK-2 - Second [To Do]",
			"   └─ TASK-1 - Selected [To Do] (cycle)",
			"",
			"Dependents (1 direct, 1 total):",
			"└─ TASK-2 - Second [To Do]",
			"   └─ TASK-1 - Selected [To Do] (cycle)",
		]);
	});

	it("names a completed dependency and keeps it resolved", async () => {
		await addTask("task-1", "Finished");
		await addTask("task-2", "Selected", ["task-1"]);
		expect((await runCli(["task", "edit", "1", "-s", "Done"])).exitCode).toBe(0);
		expect((await runCli(["task", "complete", "1"])).exitCode).toBe(0);

		expect(graphSection((await runCli(["task", "view", "2", "--plain"])).stdout.toString())).toEqual([
			"Depends on (1 direct, 1 total):",
			"└─ TASK-1 - Finished [completed]",
		]);
	});

	it("reports an unknown dependency reference explicitly", async () => {
		await addTask("task-1", "Selected", ["task-404"]);

		const stdout = (await runCli(["task", "view", "1", "--plain"])).stdout.toString();
		expect(graphSection(stdout)).toEqual(["Depends on (1 direct, 1 total):", "└─ task-404 - unknown task ID"]);

		const json = JSON.parse((await runCli(["task", "view", "1", "--json"])).stdout.toString());
		expect(json.task.dependencyGraph.nodes.at(-1)).toMatchObject({ state: "missing", title: null, completed: false });
	});

	it("reports an ambiguous dependency identity explicitly and never picks a record", async () => {
		await addTask("task-1", "Contested");
		await addTask("task-2", "Selected", ["task-1"]);
		const original = join(TEST_DIR, "backlog", "tasks", "task-1 - Contested.md");
		await writeFile(join(TEST_DIR, "backlog", "tasks", "task-01 - Contested-copy.md"), await readFile(original));

		const stdout = (await runCli(["task", "view", "2", "--plain"])).stdout.toString();
		expect(graphSection(stdout)).toEqual(["Depends on (1 direct, 1 total):", "└─ TASK-1 - ambiguous task ID"]);

		const json = JSON.parse((await runCli(["task", "view", "2", "--json"])).stdout.toString());
		expect(json.task.dependencyGraph.nodes.at(-1)).toMatchObject({ state: "ambiguous", title: null, completed: false });
	});

	it("omits the section for a task with no dependencies and no dependents", async () => {
		await addTask("task-1", "Alone");
		expect((await runCli(["task", "view", "1", "--plain"])).stdout.toString()).not.toContain("Dependency Graph:");
	});

	it("adds root, nodes, and directed edges to the JSON task view without changing dependencies", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Selected", ["task-1"]);
		await addTask("task-3", "Follow up", ["task-2"]);

		for (const args of [
			["task", "view", "2", "--json"],
			["task", "2", "--json"],
		]) {
			const output = JSON.parse((await runCli(args)).stdout.toString());
			expect(output.schemaVersion).toBe(1);
			expect(output.kind).toBe("task-view");
			expect(output.task.dependencies).toEqual(["task-1"]);
			expect(output.task.dependencyGraph.root).toBe("TASK-2");
			expect(output.task.dependencyGraph.nodes).toEqual([
				{
					id: "TASK-2",
					title: "Selected",
					status: "To Do",
					state: "resolved",
					completed: false,
					dependencyDepth: 0,
					dependentDepth: 0,
				},
				{
					id: "TASK-1",
					title: "Foundation",
					status: "To Do",
					state: "resolved",
					completed: false,
					dependencyDepth: 1,
					dependentDepth: null,
				},
				{
					id: "TASK-3",
					title: "Follow up",
					status: "To Do",
					state: "resolved",
					completed: false,
					dependencyDepth: null,
					dependentDepth: 1,
				},
			]);
			expect(output.task.dependencyGraph.edges).toEqual([
				{ from: "TASK-2", to: "TASK-1" },
				{ from: "TASK-3", to: "TASK-2" },
			]);
		}
	});

	it("leaves compact list, search, and edit payloads unchanged", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Selected", ["task-1"]);

		const list = JSON.parse((await runCli(["task", "list", "--json"])).stdout.toString());
		expect(list.dependencyGraph).toBeUndefined();
		for (const summary of list.tasks) {
			expect(Object.keys(summary)).not.toContain("dependencyGraph");
			expect(Object.keys(summary)).not.toContain("dependencies");
		}

		const search = JSON.parse((await runCli(["search", "Selected", "--json"])).stdout.toString());
		expect(search.dependencyGraph).toBeUndefined();
		for (const entry of search.results) {
			expect(Object.keys(entry.data)).not.toContain("dependencyGraph");
			expect(Object.keys(entry.data)).not.toContain("dependencies");
		}

		// The edit confirmation reuses the detail formatter, and must not grow a derived section.
		const edited = await runCli(["task", "edit", "2", "--plain", "-l", "graph"]);
		expect(edited.exitCode).toBe(0);
		expect(edited.stdout.toString()).not.toContain("Dependency Graph:");
	});

	it("keeps a wide and deep graph linear in the rendered output", async () => {
		for (let position = 1; position <= 60; position++) {
			await addTask(`task-${position}`, `Chain ${position}`, position === 1 ? [] : [`task-${position - 1}`]);
		}
		for (let position = 1; position <= 20; position++) {
			await addTask(`task-${100 + position}`, `Fan ${position}`, ["task-60"]);
		}

		const lines = graphSection((await runCli(["task", "view", "60", "--plain"])).stdout.toString());
		// 59 dependencies, 20 dependents, two headings, one blank separator: every node exactly once.
		expect(lines).toHaveLength(59 + 20 + 3);
		expect(lines[0]).toBe("Depends on (1 direct, 59 total):");
		expect(lines.find((line) => line.startsWith("Dependents"))).toBe("Dependents (20 direct, 20 total):");
	});
});
