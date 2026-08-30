import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import type { TaskDetail } from "../core/task-detail.ts";
import { FileSystem } from "../file-system/operations.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup, withTimeout } from "./test-utils.ts";

type DetailServerHandlers = {
	handleGetTask(taskId: string): Promise<Response>;
	handleListTasks(request: Request): Promise<Response>;
};

describe("BacklogServer task detail dependency graph", () => {
	let testDir: string;
	let server: BacklogServer | null;
	let handlers: DetailServerHandlers;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("server-task-detail-graph");
		await mkdir(testDir, { recursive: true });
		await $`git init -b main`.cwd(testDir).quiet();
		const filesystem = new FileSystem(testDir);
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Task detail graph",
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
		handlers = server as unknown as DetailServerHandlers;
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

	const detailFor = async (taskId: string): Promise<TaskDetail> => {
		const response = await withTimeout(handlers.handleGetTask(taskId), "task detail", 5_000);
		expect(response.status).toBe(200);
		return (await response.json()) as TaskDetail;
	};

	it("delivers the graph as a property of the task detail, in one response", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Selected", ["task-1"]);
		await addTask("task-3", "Follow up", ["task-2"]);

		const detail = await detailFor("task-2");
		// The record's own editable list is untouched, and the derived graph rides along with it.
		expect(detail.dependencies).toEqual(["task-1"]);
		expect(detail.dependencyGraph.rootId).toBe("TASK-2");
		expect(detail.dependencyGraph.nodes.map((node) => node.id)).toEqual(["TASK-2", "TASK-1", "TASK-3"]);
		expect(detail.dependencyGraph.edges).toEqual([
			{ from: "TASK-2", to: "TASK-1" },
			{ from: "TASK-3", to: "TASK-2" },
		]);
	});

	it("does not serve a standalone dependency-graph surface any more", async () => {
		// The graph belongs to the detail read; a second endpoint would be a second way to get it.
		expect((server as unknown as Record<string, unknown>).handleGetTaskDependencyGraph).toBeUndefined();
	});

	it("keeps the compact list free of the graph", async () => {
		await addTask("task-1", "Foundation");
		await addTask("task-2", "Selected", ["task-1"]);

		const response = await withTimeout(
			handlers.handleListTasks(new Request("http://localhost/api/tasks")),
			"task list",
			5_000,
		);
		const tasks = (await response.json()) as Task[];
		expect(tasks.length).toBeGreaterThan(0);
		for (const task of tasks) {
			expect((task as Partial<TaskDetail>).dependencyGraph).toBeUndefined();
		}
	});

	it("reports unresolved identities instead of guessing", async () => {
		await addTask("task-1", "Contested");
		await addTask("task-2", "Selected", ["task-1", "task-404"]);
		const original = join(testDir, "backlog", "tasks", "task-1 - Contested.md");
		await writeFile(join(testDir, "backlog", "tasks", "task-01 - Contested-copy.md"), await readFile(original));

		const detail = await detailFor("task-2");
		expect(detail.dependencyGraph.nodes.map((node) => [node.id, node.state])).toEqual([
			["TASK-2", "resolved"],
			["TASK-1", "ambiguous"],
			["task-404", "missing"],
		]);
	});

	it("fails closed for an ambiguous selected task and rejects an invalid ID", async () => {
		await addTask("task-1", "Contested");
		const original = join(testDir, "backlog", "tasks", "task-1 - Contested.md");
		await writeFile(join(testDir, "backlog", "tasks", "task-01 - Contested-copy.md"), await readFile(original));

		expect((await withTimeout(handlers.handleGetTask("task-1"), "ambiguous", 5_000)).status).toBe(409);
		expect((await withTimeout(handlers.handleGetTask("nope!"), "invalid", 5_000)).status).toBe(400);
		expect((await withTimeout(handlers.handleGetTask("task-777"), "missing", 5_000)).status).toBe(404);
	});
});
