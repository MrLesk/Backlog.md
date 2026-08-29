import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { DependencyGraph } from "../utils/dependency-graph.ts";
import { createUniqueTestDir, safeCleanup, withTimeout } from "./test-utils.ts";

type GraphPayload = { root: string; nodes: DependencyGraph["nodes"]; edges: DependencyGraph["edges"] };
type GraphServerHandlers = {
	handleGetTaskDependencyGraph(taskId: string): Promise<Response>;
	handleGetTask(taskId: string): Promise<Response>;
};

describe("BacklogServer task dependency graph endpoint", () => {
	let testDir: string;
	let server: BacklogServer | null;
	let handlers: GraphServerHandlers;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("server-dependency-graph");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		const filesystem = new FileSystem(testDir);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Dependency graph endpoint",
			statuses: ["To Do", "In Progress", "Done"],
			labels: [],
			milestones: [],
			dateFormat: "YYYY-MM-DD",
			remoteOperations: false,
			checkActiveBranches: false,
			autoCommit: false,
		});
		core = new Core(testDir);
		server = new BacklogServer(testDir);
		handlers = server as unknown as GraphServerHandlers;
	});

	afterEach(async () => {
		await server?.stop();
		server = null;
		await safeCleanup(testDir);
	});

	const addTask = async (id: string, title: string, dependencies: string[] = []) => {
		await core.createTask(
			{ id, title, status: "To Do", assignee: [], createdDate: "2026-07-14 09:30", labels: [], dependencies },
			false,
		);
	};

	const graphFor = async (taskId: string): Promise<GraphPayload> => {
		const response = await withTimeout(
			handlers.handleGetTaskDependencyGraph(taskId),
			"dependency graph endpoint",
			5_000,
		);
		expect(response.status).toBe(200);
		return (await response.json()) as GraphPayload;
	};

	it("serves the root, nodes, and directed edges for one task", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Selected", ["task-1"]);
		await addTask("task-3", "Follow up", ["task-2"]);

		const graph = await graphFor("task-2");
		expect(graph.root).toBe("TASK-2");
		expect(graph.nodes.map((node) => node.id)).toEqual(["TASK-2", "TASK-1", "TASK-3"]);
		expect(graph.edges).toEqual([
			{ from: "TASK-2", to: "TASK-1" },
			{ from: "TASK-3", to: "TASK-2" },
		]);
	});

	it("keeps the task record itself free of derived graph data", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Selected", ["task-1"]);

		const response = await withTimeout(handlers.handleGetTask("task-2"), "task endpoint", 5_000);
		const task = (await response.json()) as Record<string, unknown>;
		expect(task.dependencies).toEqual(["task-1"]);
		expect(task.dependencyGraph).toBeUndefined();
	});

	it("reports unresolved identities instead of guessing", async () => {
		await addTask("task-1", "Contested");
		await addTask("task-2", "Selected", ["task-1", "task-404"]);
		const original = join(testDir, "backlog", "tasks", "task-1 - Contested.md");
		await writeFile(join(testDir, "backlog", "tasks", "task-01 - Contested-copy.md"), await readFile(original));

		const graph = await graphFor("task-2");
		expect(graph.nodes.map((node) => [node.id, node.state])).toEqual([
			["TASK-2", "resolved"],
			["TASK-1", "ambiguous"],
			["task-404", "missing"],
		]);
	});

	it("fails closed for an ambiguous selected task and rejects an invalid ID", async () => {
		await addTask("task-1", "Contested");
		const original = join(testDir, "backlog", "tasks", "task-1 - Contested.md");
		await writeFile(join(testDir, "backlog", "tasks", "task-01 - Contested-copy.md"), await readFile(original));

		const ambiguous = await withTimeout(handlers.handleGetTaskDependencyGraph("task-1"), "ambiguous", 5_000);
		expect(ambiguous.status).toBe(409);

		const invalid = await withTimeout(handlers.handleGetTaskDependencyGraph("nope!"), "invalid", 5_000);
		expect(invalid.status).toBe(400);

		const missing = await withTimeout(handlers.handleGetTaskDependencyGraph("task-777"), "missing", 5_000);
		expect(missing.status).toBe(404);
	});
});
