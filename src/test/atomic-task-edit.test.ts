import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { TASK_LOCK_ERROR_MESSAGE } from "../file-system/operations.ts";
import { initializeTestProject, withTimeout } from "./test-utils.ts";

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
	let originalGlobalLockEnv: string | undefined;

	beforeEach(async () => {
		originalGlobalLockEnv = process.env.USE_GLOBAL_TASK_ID_LOCK;
		delete process.env.USE_GLOBAL_TASK_ID_LOCK;

		testDir = await mkdtemp(join(tmpdir(), "backlog-atomic-edit-"));
		const core = new Core(testDir);
		await initializeTestProject(core, "Atomic Edit Test", false);

		const config = await core.fs.loadConfig();
		if (config) {
			config.checkActiveBranches = false;
			await core.fs.saveConfig(config);
		}
	});

	afterEach(async () => {
		if (originalGlobalLockEnv === undefined) {
			delete process.env.USE_GLOBAL_TASK_ID_LOCK;
		} else {
			process.env.USE_GLOBAL_TASK_ID_LOCK = originalGlobalLockEnv;
		}
		await rm(testDir, { recursive: true, force: true });
	});

	it("preserves every change when concurrent edits target the same task", async () => {
		const setup = new Core(testDir);
		await setup.createTaskFromInput({ title: "Shared Task" }, false);

		// Each Core has its own ContentStore, so these race exactly like separate processes:
		// without serialisation every writer mutates the same pre-write snapshot and all but
		// one label are lost, even though every caller is told the update succeeded.
		const writerCount = 6;
		const edits = Array.from({ length: writerCount }, (_, index) => {
			const core = new Core(testDir);
			return core.updateTaskFromInput("task-1", { addLabels: [`label-${index + 1}`] }, false);
		});
		await Promise.all(edits);

		const final = await setup.fs.loadTask("task-1");
		expect(final?.labels ?? []).toEqual(
			expect.arrayContaining(Array.from({ length: writerCount }, (_, index) => `label-${index + 1}`)),
		);
		expect(final?.labels?.length).toBe(writerCount);
	});

	it("applies an edit that waited on the lock on top of the change that held it", async () => {
		const setup = new Core(testDir);
		await setup.createTaskFromInput({ title: "Shared Task" }, false);

		const holder = new Core(testDir);
		const waiter = new Core(testDir);
		const holderEntered = createDeferred<void>();
		const waiterReachedLock = createDeferred<void>();
		const lockableTask = await holder.fs.loadTask("task-1");
		if (!lockableTask) {
			throw new Error("task-1 missing during test setup");
		}

		// The holder owns the task lock and lands its write while the waiter is blocked.
		const heldEdit = holder.fs.withTaskLock(lockableTask, async () => {
			holderEntered.resolve();
			await waiterReachedLock.promise;
			const current = await holder.fs.loadTask("task-1");
			if (!current) {
				throw new Error("task-1 missing during test setup");
			}
			await holder.fs.saveTask({ ...current, labels: ["holder"] });
		});

		// Signals when the waiter has finished its pre-lock read and is about to block on the
		// lock. A lock without a re-read inside it would apply the waiter's mutation to that
		// pre-wait snapshot and lose the holder's label — the negative this test can return.
		const originalWithTaskLock = waiter.fs.withTaskLock.bind(waiter.fs);
		waiter.fs.withTaskLock = (async <T>(
			task: { id: string; filePath?: string },
			fn: () => Promise<T>,
			options?: { timeoutMs?: number; retryDelayMs?: number; staleMs?: number },
		): Promise<T> => {
			waiterReachedLock.resolve();
			return await originalWithTaskLock(task, fn, options);
		}) as typeof waiter.fs.withTaskLock;

		await holderEntered.promise;
		const waitedEdit = waiter.updateTaskFromInput("task-1", { addLabels: ["waiter"] }, false);

		await heldEdit;
		const result = await waitedEdit;

		const final = await setup.fs.loadTask("task-1");
		expect(final?.labels ?? []).toEqual(["holder", "waiter"]);
		expect(result.labels ?? []).toEqual(["holder", "waiter"]);
	});

	it("keeps concurrent edits of different tasks independent", async () => {
		const setup = new Core(testDir);
		await setup.createTaskFromInput({ title: "Task A" }, false);
		await setup.createTaskFromInput({ title: "Task B" }, false);

		await Promise.all([
			new Core(testDir).updateTaskFromInput("task-1", { addLabels: ["alpha"] }, false),
			new Core(testDir).updateTaskFromInput("task-2", { addLabels: ["beta"] }, false),
		]);

		const first = await setup.fs.loadTask("task-1");
		const second = await setup.fs.loadTask("task-2");
		expect(first?.labels ?? []).toEqual(["alpha"]);
		expect(second?.labels ?? []).toEqual(["beta"]);
	});

	it("returns a user-facing error when the task edit lock times out", async () => {
		const core = new Core(testDir);
		await core.createTaskFromInput({ title: "Lockable Task" }, false);
		const lockableTask = await core.fs.loadTask("task-1");
		if (!lockableTask) {
			throw new Error("task-1 missing during test setup");
		}
		const lockEntered = createDeferred<void>();
		const releaseLock = createDeferred<void>();

		const heldLock = core.fs.withTaskLock(
			lockableTask,
			async () => {
				lockEntered.resolve();
				await releaseLock.promise;
			},
			{ timeoutMs: 5_000, retryDelayMs: 25, staleMs: 5_000 },
		);
		await lockEntered.promise;

		await expect(
			core.fs.withTaskLock(lockableTask, async () => undefined, {
				timeoutMs: 100,
				retryDelayMs: 25,
				staleMs: 5_000,
			}),
		).rejects.toThrow(TASK_LOCK_ERROR_MESSAGE);

		releaseLock.resolve();
		await heldLock;
	});

	it("bypasses task-lock serialization when the global lock is disabled by the legacy escape hatch", async () => {
		process.env.USE_GLOBAL_TASK_ID_LOCK = "false";

		const core = new Core(testDir);
		const bothEntered = createDeferred<void>();
		const releaseBoth = createDeferred<void>();
		let entries = 0;
		const enter = async (value: string): Promise<string> => {
			entries += 1;
			if (entries === 2) bothEntered.resolve();
			await releaseBoth.promise;
			return value;
		};

		const firstOperation = core.fs.withTaskLock({ id: "task-1" }, () => enter("first"));
		const secondOperation = core.fs.withTaskLock({ id: "task-1" }, () => enter("second"));
		const outcomesPromise = Promise.allSettled([firstOperation, secondOperation]);
		let outcomes: PromiseSettledResult<string>[];

		try {
			await withTimeout(bothEntered.promise, "both operations should enter without serialization", 250);
			expect(entries).toBe(2);
		} finally {
			releaseBoth.resolve();
			outcomes = await outcomesPromise;
		}

		expect(outcomes).toEqual([
			{ status: "fulfilled", value: "first" },
			{ status: "fulfilled", value: "second" },
		]);
	});
});
