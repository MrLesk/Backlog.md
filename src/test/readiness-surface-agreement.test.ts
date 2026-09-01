import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { type TaskCorpus, type TaskDetail, toTaskDetail, withReadiness } from "../core/task-detail.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { BacklogServer } from "../server/index.ts";
import { generateDetailContent } from "../ui/task-viewer-with-search.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup, withTimeout } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();

/**
 * Readiness is derived once in core, and every surface renders that one verdict. These tests pin
 * the agreement on a single project covering each way the question can be answered: a dependency
 * completed and filed away, an unfinished chain, a dependency nothing claims, a dependency more
 * than one record claims, and a task that is already finished.
 */
describe("readiness agreement across surfaces", () => {
	let testDir: string;
	let core: Core;
	let mcpServer: McpServer;
	let server: BacklogServer | null;
	let handlers: { handleGetTask(taskId: string): Promise<Response> };

	/** The verdict every surface has to reach for this project, by task ID. */
	const expectedReadiness: Record<string, boolean> = {
		// Its only dependency was completed and moved into backlog/completed.
		"TASK-2": true,
		// Unfinished with no dependencies at all.
		"TASK-3": true,
		// Waits on unfinished TASK-3.
		"TASK-4": false,
		// Names a dependency nothing claims.
		"TASK-5": false,
		// Already finished, so it is neither ready to start nor blocked.
		"TASK-6": false,
	};

	const readyIds = Object.entries(expectedReadiness)
		.filter(([, isReady]) => isReady)
		.map(([id]) => id);
	const notReadyIds = Object.entries(expectedReadiness)
		.filter(([, isReady]) => !isReady)
		.map(([id]) => id);

	beforeEach(async () => {
		testDir = createUniqueTestDir("readiness-surface-agreement");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Readiness Agreement");

		// Dates come from the run clock so the fixture never ages into a different meaning.
		const createdDate = new Date().toISOString().slice(0, 10);
		const addTask = async (id: string, title: string, status: string, dependencies: string[] = []) => {
			await core.createTask(
				{ id, title, status, assignee: [], labels: [], dependencies, createdDate, rawContent: "" },
				false,
			);
		};

		await addTask("task-1", "Completed dependency", "Done");
		await addTask("task-2", "Waits on the completed dependency", "To Do", ["task-1"]);
		await addTask("task-3", "Unfinished blocker", "In Progress");
		await addTask("task-4", "Waits on the unfinished blocker", "To Do", ["task-3"]);
		await addTask("task-5", "Waits on nothing known", "To Do", ["task-404"]);
		await addTask("task-6", "Already finished", "Done");

		// The dependency leaves the active corpus: only its location in backlog/completed still says
		// the work is finished.
		expect(await core.completeTask("task-1", false)).toBe(true);

		mcpServer = new McpServer(testDir, "Test instructions");
		const mcpConfig = await mcpServer.filesystem.loadConfig();
		if (!mcpConfig) throw new Error("Expected MCP test config");
		registerTaskTools(mcpServer, mcpConfig);

		server = new BacklogServer(testDir);
		handlers = server as unknown as typeof handlers;
	});

	afterEach(async () => {
		await server?.stop();
		server = null;
		await mcpServer.stop();
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	const runCli = async (args: string[]) => await $`bun ${[CLI_PATH, ...args]}`.cwd(testDir).nothrow().quiet();

	const tuiCorpus = async (): Promise<TaskCorpus> => ({
		// The corpus the interactive task list resolves against: the working copy it displays plus
		// the completed records it loads alongside the milestone metadata.
		tasks: await core.queryTasks({ includeCrossBranch: false }),
		completedTasks: await core.filesystem.listCompletedTasks(),
		statuses: (await core.filesystem.loadConfig())?.statuses,
	});

	it("carries the same isReady on the task list JSON contract as --ready filters on", async () => {
		const listResult = await runCli(["task", "list", "--json"]);
		expect(listResult.exitCode).toBe(0);
		const rows = JSON.parse(listResult.stdout.toString()).tasks as Array<{ id: string; isReady: boolean }>;
		const listVerdicts = Object.fromEntries(rows.map((row) => [row.id, row.isReady]));
		expect(listVerdicts).toMatchObject(expectedReadiness);

		const readyResult = await runCli(["task", "list", "--plain", "--ready"]);
		expect(readyResult.exitCode).toBe(0);
		const readyOutput = readyResult.stdout.toString();
		for (const id of readyIds) expect(readyOutput).toContain(id);
		for (const id of notReadyIds) expect(readyOutput).not.toContain(id);
	});

	it("explains the same verdict in task view JSON, with unresolved dependencies failing closed", async () => {
		const detailFor = async (id: string) => {
			const result = await runCli(["task", "view", id, "--json"]);
			expect(result.exitCode).toBe(0);
			return JSON.parse(result.stdout.toString()).task;
		};

		const readyDetail = await detailFor("2");
		expect(readyDetail.isReady).toBe(true);
		expect(readyDetail.readiness).toEqual({
			isReady: true,
			isBlocked: false,
			blockingDependencies: [],
			missingDependencies: [],
		});

		const blockedDetail = await detailFor("4");
		expect(blockedDetail.isReady).toBe(false);
		expect(blockedDetail.readiness).toEqual({
			isReady: false,
			isBlocked: true,
			blockingDependencies: ["TASK-3"],
			missingDependencies: [],
		});

		const unknownDetail = await detailFor("5");
		expect(unknownDetail.readiness).toEqual({
			isReady: false,
			isBlocked: true,
			blockingDependencies: [],
			missingDependencies: ["task-404"],
		});

		// A finished task is neither ready to start nor blocked.
		const finishedDetail = await detailFor("6");
		expect(finishedDetail.isReady).toBe(false);
		expect(finishedDetail.readiness.isBlocked).toBe(false);
	});

	it("returns the same verdicts through MCP, the browser detail read, and the interactive corpus", async () => {
		const mcpResult = await mcpServer.testInterface.callTool({
			params: { name: "task_list", arguments: { ready: true } },
		});
		// One content item per status group, so the whole result is the list.
		const mcpOutput = (mcpResult.content as Array<{ text?: string }>).map((item) => item.text ?? "").join("\n");
		for (const id of readyIds) expect(mcpOutput).toContain(id);
		for (const id of notReadyIds) expect(mcpOutput).not.toContain(id);

		// What the browser is handed when it opens a task: the modal renders this, it does not
		// resolve anything of its own.
		for (const [id, isReady] of Object.entries(expectedReadiness)) {
			const response = await withTimeout(handlers.handleGetTask(id), `task detail ${id}`, 5_000);
			expect(response.status).toBe(200);
			const detail = (await response.json()) as TaskDetail;
			expect([id, detail.readiness.isReady]).toEqual([id, isReady]);
		}

		const corpus = await tuiCorpus();
		const interactiveVerdicts = Object.fromEntries(
			withReadiness(corpus.tasks, corpus).map((row) => [row.id, row.isReady]),
		);
		expect(interactiveVerdicts).toMatchObject(expectedReadiness);

		// And the line the interactive detail pane renders comes from that same derived field.
		const blocked = corpus.tasks.find((task) => task.id === "TASK-4");
		if (!blocked) throw new Error("Expected TASK-4 in the interactive corpus");
		expect(generateDetailContent(toTaskDetail(blocked, corpus)).bodyContent.join("\n")).toContain(
			"● Blocked by TASK-3",
		);
	});

	it("fails closed on a dependency identity more than one record claims", async () => {
		const createdDate = new Date().toISOString().slice(0, 10);
		await core.createTask(
			{
				id: "task-7",
				title: "Contested identity",
				status: "Done",
				assignee: [],
				labels: [],
				dependencies: [],
				createdDate,
				rawContent: "",
			},
			false,
		);
		await core.createTask(
			{
				id: "task-8",
				title: "Waits on the contested identity",
				status: "To Do",
				assignee: [],
				labels: [],
				dependencies: ["task-7"],
				createdDate,
				rawContent: "",
			},
			false,
		);
		// A second file claiming TASK-7. Its copy is finished, so a read that picked a winner would
		// call the dependent ready.
		const contested = join(testDir, "backlog", "tasks", "task-7 - Contested-identity.md");
		await writeFile(join(testDir, "backlog", "tasks", "task-07 - Contested-copy.md"), await readFile(contested));

		const unresolved = {
			isReady: false,
			isBlocked: true,
			blockingDependencies: [],
			missingDependencies: ["task-7"],
		};

		const viewResult = await runCli(["task", "view", "8", "--json"]);
		expect(viewResult.exitCode).toBe(0);
		const viewed = JSON.parse(viewResult.stdout.toString()).task;
		expect(viewed.isReady).toBe(false);
		expect(viewed.readiness).toEqual(unresolved);

		const response = await withTimeout(handlers.handleGetTask("8"), "task detail 8", 5_000);
		expect(response.status).toBe(200);
		expect(((await response.json()) as TaskDetail).readiness).toEqual(unresolved);

		const corpus = await tuiCorpus();
		const contestedDependent = withReadiness(corpus.tasks, corpus).find((row) => row.id === "TASK-8");
		expect(contestedDependent?.isReady).toBe(false);
	});
});
