import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { toTaskDetail } from "../core/task-detail.ts";
import { formatDependencyGraphEntries } from "../formatters/dependency-graph-text.ts";
import { Core } from "../index.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import type { Task } from "../types/index.ts";
import { formatDependencyNodeTuiLabel } from "../ui/dependencies-tui.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
const CREATED_DATE = new Date().toISOString().slice(0, 10);

let TEST_DIR: string;
let core: Core;

async function runCli(args: string[], cwd = TEST_DIR) {
	return await $`bun ${[CLI_PATH, ...args]}`.cwd(cwd).nothrow().quiet();
}

async function addTask(id: string, title: string, dependencies: string[] = []) {
	await core.createTask(
		{ id, title, status: "To Do", assignee: [], createdDate: CREATED_DATE, labels: [], dependencies },
		false,
	);
}

describe("CLI task dependencies command", () => {
	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-cli-task-dependencies");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Task Dependencies Test");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("prints both directions of a chain with the task-view graph layout", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Middle", ["task-1"]);
		await addTask("task-3", "Selected", ["task-2"]);
		await addTask("task-4", "Follow up", ["task-3"]);
		await addTask("task-5", "Last", ["task-4"]);

		const result = await runCli(["task", "dependencies", "3", "--plain"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString().trimEnd().split("\n")).toEqual([
			"Task TASK-3 - Selected",
			"",
			"Dependency Graph:",
			"-".repeat(50),
			"Depends on (1 direct, 2 total):",
			"└─ TASK-2 - Middle [To Do]",
			"   └─ TASK-1 - Foundation [To Do]",
			"",
			"Dependents (1 direct, 2 total):",
			"└─ TASK-4 - Follow up [To Do]",
			"   └─ TASK-5 - Last [To Do]",
		]);

		// The identical graph block the full task view renders: one serializer, no drift.
		const viewed = (await runCli(["task", "view", "3", "--plain"])).stdout.toString();
		const graphBlock = result.stdout.toString().split("\n").slice(2).join("\n").trimEnd();
		expect(viewed).toContain(graphBlock);
	});

	it("renders branches and diamonds once and marks the repeated branch", async () => {
		await addTask("task-1", "Shared");
		await addTask("task-2", "Left", ["task-1"]);
		await addTask("task-3", "Right", ["task-1"]);
		await addTask("task-4", "Selected", ["task-2", "task-3"]);

		const stdout = (await runCli(["task", "dependencies", "4", "--plain"])).stdout.toString();
		expect(stdout.trimEnd().split("\n").slice(4)).toEqual([
			"Depends on (2 direct, 3 total):",
			"├─ TASK-2 - Left [To Do]",
			"│  └─ TASK-1 - Shared [To Do]",
			"└─ TASK-3 - Right [To Do]",
			"   └─ TASK-1 - Shared [To Do] (shown above)",
		]);
	});

	it("terminates a cycle instead of repeating it", async () => {
		// Validation refuses to create a cycle, so store one directly as the legacy defect
		// `backlog doctor` reports; the view must still render it honestly.
		await addTask("task-1", "Selected", ["task-2"]);
		await addTask("task-2", "Second", ["task-1"]);

		const stdout = (await runCli(["task", "dependencies", "1", "--plain"])).stdout.toString();
		expect(stdout.trimEnd().split("\n").slice(4)).toEqual([
			"Depends on (1 direct, 1 total):",
			"└─ TASK-2 - Second [To Do]",
			"   └─ TASK-1 - Selected [To Do] (cycle)",
			"",
			"Dependents (1 direct, 1 total):",
			"└─ TASK-2 - Second [To Do]",
			"   └─ TASK-1 - Selected [To Do] (cycle)",
		]);
	});

	it("reports unknown and ambiguous references explicitly and fails closed", async () => {
		await addTask("task-1", "Contested");
		await addTask("task-2", "Selected", ["task-1", "task-404"]);
		const original = join(TEST_DIR, "backlog", "tasks", "task-1 - Contested.md");
		await writeFile(join(TEST_DIR, "backlog", "tasks", "task-01 - Contested-copy.md"), await readFile(original));

		const stdout = (await runCli(["task", "dependencies", "2", "--plain"])).stdout.toString();
		expect(stdout.trimEnd().split("\n").slice(4)).toEqual([
			"Depends on (2 direct, 2 total):",
			"├─ TASK-1 - ambiguous task ID",
			"└─ task-404 - unknown task ID",
		]);

		const json = JSON.parse((await runCli(["task", "dependencies", "2", "--json"])).stdout.toString());
		const states = new Map(
			json.dependencyGraph.nodes.map((node: { id: string; state: string }) => [node.id, node.state]),
		);
		expect(states.get("TASK-1")).toBe("ambiguous");
		expect(states.get("task-404")).toBe("missing");
	});

	it("prints a one-line message for a task with no dependencies and no dependents", async () => {
		await addTask("task-1", "Alone");

		const result = await runCli(["task", "dependencies", "1", "--plain"]);
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString().trimEnd()).toBe("Task TASK-1 - Alone has no dependencies and no dependents.");
	});

	it("exposes the normalized graph representation with --json", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Selected", ["task-1"]);
		await addTask("task-3", "Follow up", ["task-2"]);

		const output = JSON.parse((await runCli(["task", "dependencies", "2", "--json"])).stdout.toString());
		expect(output.schemaVersion).toBe(1);
		expect(output.kind).toBe("task-dependencies");
		expect(output.dependencyGraph.root).toBe("TASK-2");
		expect(output.dependencyGraph.nodes).toEqual([
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
		expect(output.dependencyGraph.edges).toEqual([
			{ from: "TASK-2", to: "TASK-1" },
			{ from: "TASK-3", to: "TASK-2" },
		]);
	});

	it("rejects --json combined with --plain and reports a missing task", async () => {
		await addTask("task-1", "Only");

		const combined = await runCli(["task", "dependencies", "1", "--json", "--plain"]);
		expect(combined.exitCode).toBe(1);

		const missing = await runCli(["task", "dependencies", "404", "--plain"]);
		expect(missing.exitCode).toBe(1);
		expect(missing.stderr.toString()).toContain("Task 404 not found");
	});
});

describe("dependency graph entries for the interactive view", () => {
	const STATUSES = ["To Do", "In Progress", "Done"] as const;

	function makeTask(id: string, title: string, dependencies: string[] = [], status = "To Do"): Task {
		return { id, title, status, assignee: [], createdDate: CREATED_DATE, labels: [], dependencies };
	}

	it("keeps a node reference on every task line and none on headings or separators", () => {
		const corpus = [
			makeTask("TASK-1", "Foundation", [], "Done"),
			makeTask("TASK-2", "Selected", ["TASK-1", "TASK-404"]),
			makeTask("TASK-3", "Follow up", ["TASK-2"]),
		];
		const detail = toTaskDetail(corpus[1] as Task, { tasks: corpus, completedTasks: [], statuses: STATUSES });
		const entries = formatDependencyGraphEntries(detail.dependencyGraph);

		expect(entries.map((entry) => [entry.text, entry.node?.id ?? null])).toEqual([
			["Depends on (2 direct, 2 total):", null],
			["├─ TASK-1 - Foundation [completed]", "TASK-1"],
			["└─ TASK-404 - unknown task ID", "TASK-404"],
			["", null],
			["Dependents (1 direct, 1 total):", null],
			["└─ TASK-3 - Follow up [To Do]", "TASK-3"],
		]);
		// Unresolved nodes carry their state so the view can refuse to navigate into them.
		expect(entries[2]?.node?.state).toBe("missing");
	});

	it("colors the TUI labels and escapes blessed tags without changing the shared wording", () => {
		const styled = makeTask("TASK-7", "Style {red-fg}accent{/} braces");
		const root = makeTask("TASK-8", "Root", ["TASK-7"]);
		const detail = toTaskDetail(root, { tasks: [root, styled], completedTasks: [], statuses: STATUSES });
		const entries = formatDependencyGraphEntries(detail.dependencyGraph, {
			formatLabel: formatDependencyNodeTuiLabel,
		});

		expect(entries[1]?.text).toContain("TASK-7 - Style {open}red-fg{close}accent{open}/{close} braces [To Do]");

		const missing = toTaskDetail(makeTask("TASK-9", "Root", ["TASK-404"]), {
			tasks: [],
			completedTasks: [],
			statuses: STATUSES,
		});
		const missingEntries = formatDependencyGraphEntries(missing.dependencyGraph, {
			formatLabel: formatDependencyNodeTuiLabel,
		});
		expect(missingEntries[1]?.text).toContain("{yellow-fg}TASK-404 - unknown task ID{/}");
	});
});

describe("MCP task_dependencies tool", () => {
	let mcpServer: McpServer;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("mcp-task-dependencies");
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await mcpServer.filesystem.ensureBacklogStructure();
		await initializeFilesystemTestProject(mcpServer, "Task Dependencies MCP Test");
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) throw new Error("Failed to load backlog configuration for tests");
		registerTaskTools(mcpServer, config);
	});

	afterEach(async () => {
		await mcpServer.stop();
		await safeCleanup(TEST_DIR);
	});

	const callTaskDependencies = async (id: string) =>
		await mcpServer.testInterface.callTool({ params: { name: "task_dependencies", arguments: { id } } });

	it("returns content equivalent to the CLI --plain output", async () => {
		const create = async (title: string, dependencies?: string[]) =>
			await mcpServer.testInterface.callTool({
				params: { name: "task_create", arguments: { title, ...(dependencies ? { dependencies } : {}) } },
			});
		await create("Foundation");
		await create("Selected", ["TASK-1"]);
		await create("Follow up", ["TASK-2"]);

		const result = await callTaskDependencies("TASK-2");
		const text = (result.content?.[0] as { text?: string } | undefined)?.text ?? "";
		expect(text.trimEnd().split("\n")).toEqual([
			"Task TASK-2 - Selected",
			"",
			"Dependency Graph:",
			"-".repeat(50),
			"Depends on (1 direct, 1 total):",
			"└─ TASK-1 - Foundation [To Do]",
			"",
			"Dependents (1 direct, 1 total):",
			"└─ TASK-3 - Follow up [To Do]",
		]);

		const cli = await runCli(["task", "dependencies", "TASK-2", "--plain"]);
		expect(text.trimEnd()).toBe(cli.stdout.toString().trimEnd());
	});

	it("prints the one-line message for an isolated task and errors for a missing one", async () => {
		await mcpServer.testInterface.callTool({
			params: { name: "task_create", arguments: { title: "Alone" } },
		});

		const isolated = await callTaskDependencies("TASK-1");
		const text = (isolated.content?.[0] as { text?: string } | undefined)?.text ?? "";
		expect(text.trimEnd()).toBe("Task TASK-1 - Alone has no dependencies and no dependents.");

		const missing = await callTaskDependencies("TASK-404");
		expect(missing.isError).toBe(true);
	});
});
