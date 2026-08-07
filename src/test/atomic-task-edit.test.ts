import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { isTaskLockError, taskLockErrorMessage } from "../file-system/operations.ts";
import { McpServer } from "../mcp/server.ts";
import { TaskHandlers } from "../mcp/tools/tasks/handlers.ts";
import { BacklogServer } from "../server/index.ts";
import type { Task } from "../types/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, retry, safeCleanup, withTimeout } from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
const CONTENDED_ID = "TASK-1";
const CONTENTION_MESSAGE = taskLockErrorMessage(CONTENDED_ID);

type Deferred<T> = {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("atomic task editing", () => {
	let testDir: string;
	let setup: Core;
	let originalGlobalLockEnv: string | undefined;

	beforeEach(async () => {
		originalGlobalLockEnv = process.env.USE_GLOBAL_TASK_ID_LOCK;
		delete process.env.USE_GLOBAL_TASK_ID_LOCK;

		testDir = createUniqueTestDir("atomic-task-edit");
		await mkdir(testDir, { recursive: true });
		setup = new Core(testDir);
		await initializeFilesystemTestProject(setup, "Atomic Edit Test");
	});

	afterEach(async () => {
		setup.disposeContentStore();
		if (originalGlobalLockEnv === undefined) {
			delete process.env.USE_GLOBAL_TASK_ID_LOCK;
		} else {
			process.env.USE_GLOBAL_TASK_ID_LOCK = originalGlobalLockEnv;
		}
		await safeCleanup(testDir);
	});

	async function createContendedTask(): Promise<Task> {
		await setup.createTaskFromInput({ title: "Shared Task" }, false);
		const task = await setup.fs.loadTask(CONTENDED_ID);
		if (!task) throw new Error(`${CONTENDED_ID} missing during test setup`);
		return task;
	}

	async function finalLabels(): Promise<string[]> {
		const task = await setup.fs.loadTask(CONTENDED_ID);
		return [...(task?.labels ?? [])].sort();
	}

	it("never silently loses a concurrent edit: winners land, losers fail loudly", async () => {
		await createContendedTask();

		// Every Core has its own ContentStore, so these race like separate processes: without
		// serialization each one mutates the same pre-write snapshot, every caller is told the
		// edit succeeded, and all but one label disappear from the file.
		const writerCount = 6;
		const labels = Array.from({ length: writerCount }, (_, index) => `label-${index + 1}`);
		const writers = labels.map((label) => ({ label, core: new Core(testDir) }));
		let outcomes: PromiseSettledResult<Task>[];
		try {
			outcomes = await Promise.allSettled(
				writers.map(({ label, core }) => core.updateTaskFromInput(CONTENDED_ID, { addLabels: [label] }, false)),
			);
		} finally {
			for (const { core } of writers) core.disposeContentStore();
		}

		const succeeded = labels.filter((_, index) => outcomes[index]?.status === "fulfilled");
		expect(succeeded.length).toBeGreaterThanOrEqual(1);

		// Nothing waits, merges, or retries: a loser fails immediately with an actionable message.
		for (const outcome of outcomes) {
			if (outcome.status === "fulfilled") continue;
			expect(isTaskLockError(outcome.reason)).toBe(true);
			expect((outcome.reason as Error).message).toBe(CONTENTION_MESSAGE);
		}

		// The file matches exactly the writers that were told they succeeded — no more, no less.
		expect(await finalLabels()).toEqual([...succeeded].sort());
	});

	it("keeps concurrent edits of different tasks independent", async () => {
		await setup.createTaskFromInput({ title: "Task A" }, false);
		await setup.createTaskFromInput({ title: "Task B" }, false);

		const first = new Core(testDir);
		const second = new Core(testDir);
		try {
			await Promise.all([
				first.updateTaskFromInput("TASK-1", { addLabels: ["alpha"] }, false),
				second.updateTaskFromInput("TASK-2", { addLabels: ["beta"] }, false),
			]);
		} finally {
			first.disposeContentStore();
			second.disposeContentStore();
		}

		expect((await setup.fs.loadTask("TASK-1"))?.labels ?? []).toEqual(["alpha"]);
		expect((await setup.fs.loadTask("TASK-2"))?.labels ?? []).toEqual(["beta"]);
	});

	it("blocks a second process while the first holds the lock", async () => {
		const task = await createContendedTask();
		const lockEntered = createDeferred<void>();
		const releaseLock = createDeferred<void>();

		// The lock lives on the filesystem, so a completely separate backlog process sees it.
		const heldLock = setup.fs.withTaskLock(task, async () => {
			lockEntered.resolve();
			await releaseLock.promise;
		});
		await withTimeout(lockEntered.promise, "the lock to be held", 5_000);

		const blocked = await $`bun ${CLI_PATH} task edit ${CONTENDED_ID} --add-label blocked`
			.cwd(testDir)
			.quiet()
			.nothrow();
		releaseLock.resolve();
		await heldLock;

		expect(blocked.exitCode).not.toBe(0);
		expect(`${blocked.stderr.toString()}${blocked.stdout.toString()}`).toContain(CONTENTION_MESSAGE);
		expect(await finalLabels()).toEqual([]);

		// Once the holder is done the same command succeeds, so nothing is left wedged.
		const retried = await $`bun ${CLI_PATH} task edit ${CONTENDED_ID} --add-label retried`
			.cwd(testDir)
			.quiet()
			.nothrow();
		expect(retried.exitCode).toBe(0);
		expect(await finalLabels()).toEqual(["retried"]);
	});

	it("survives parallel CLI processes editing the same task", async () => {
		// Filler tasks widen each process's read phase so the read-modify-write windows really
		// overlap; without them bun's startup variance usually serializes the racers by accident.
		for (let index = 0; index < 40; index += 1) {
			await setup.createTaskFromInput({ title: `Filler ${index + 1}` }, false);
		}
		const sharedId = "TASK-41";
		await setup.createTaskFromInput({ title: "Shared Task" }, false);

		const jobCount = 6;
		const labels = Array.from({ length: jobCount }, (_, index) => `cli-${index + 1}`);
		const results = await Promise.all(
			labels.map((label) =>
				$`bun ${CLI_PATH} task edit ${sharedId} --add-label ${label}`.cwd(testDir).quiet().nothrow(),
			),
		);

		const succeeded = labels.filter((_, index) => results[index]?.exitCode === 0);
		expect(succeeded.length).toBeGreaterThanOrEqual(1);

		for (const result of results) {
			if (result.exitCode === 0) continue;
			expect(`${result.stderr.toString()}${result.stdout.toString()}`).toContain(taskLockErrorMessage(sharedId));
		}

		const shared = await setup.fs.loadTask(sharedId);
		expect([...(shared?.labels ?? [])].sort()).toEqual([...succeeded].sort());
	}, 60_000);

	it("returns HTTP 409 from the web update endpoint on contention", async () => {
		const task = await createContendedTask();
		const server = new BacklogServer(testDir);
		await server.start(0, false);
		const port = server.getPort() ?? 0;
		expect(port).toBeGreaterThan(0);

		const lockEntered = createDeferred<void>();
		const releaseLock = createDeferred<void>();
		const heldLock = setup.fs.withTaskLock(task, async () => {
			lockEntered.resolve();
			await releaseLock.promise;
		});

		try {
			await retry(async () => {
				const ping = await fetch(`http://127.0.0.1:${port}/api/tasks`);
				if (!ping.ok) throw new Error(`server not ready: ${ping.status}`);
			});
			await withTimeout(lockEntered.promise, "the lock to be held", 5_000);

			const response = await fetch(`http://127.0.0.1:${port}/api/tasks/${CONTENDED_ID}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...task, labels: ["from-web"] }),
			});

			expect(response.status).toBe(409);
			expect((await response.json()).error).toBe(CONTENTION_MESSAGE);
		} finally {
			releaseLock.resolve();
			await heldLock;
			await server.stop();
		}
	});

	it("reports an MCP operation error on contention", async () => {
		const task = await createContendedTask();
		const mcpServer = new McpServer(testDir, "Test instructions");
		const handlers = new TaskHandlers(mcpServer);

		const lockEntered = createDeferred<void>();
		const releaseLock = createDeferred<void>();
		const heldLock = setup.fs.withTaskLock(task, async () => {
			lockEntered.resolve();
			await releaseLock.promise;
		});
		await withTimeout(lockEntered.promise, "the lock to be held", 5_000);

		try {
			await handlers.editTask({ id: CONTENDED_ID, addLabels: ["from-mcp"] });
			throw new Error("editTask should have failed while the task lock was held");
		} catch (error) {
			expect((error as Error).message).toBe(CONTENTION_MESSAGE);
			expect((error as { code?: string }).code).toBe("OPERATION_FAILED");
		} finally {
			releaseLock.resolve();
			await heldLock;
			await mcpServer.stop();
		}
	});

	it("bypasses the task lock when the legacy escape hatch is set", async () => {
		const task = await createContendedTask();
		process.env.USE_GLOBAL_TASK_ID_LOCK = "false";

		const bothEntered = createDeferred<void>();
		const releaseBoth = createDeferred<void>();
		let entries = 0;
		const enter = async (value: string): Promise<string> => {
			entries += 1;
			if (entries === 2) bothEntered.resolve();
			await releaseBoth.promise;
			return value;
		};

		const operations = Promise.all([
			setup.fs.withTaskLock(task, () => enter("first")),
			setup.fs.withTaskLock(task, () => enter("second")),
		]);
		try {
			await withTimeout(bothEntered.promise, "both operations to enter without serialization", 250);
		} finally {
			releaseBoth.resolve();
		}
		expect(await operations).toEqual(["first", "second"]);
	});
});
