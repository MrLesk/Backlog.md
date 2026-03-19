import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { CREATE_LOCK_ERROR_MESSAGE } from "../file-system/operations.ts";
import type { Task } from "../types";
import { initializeTestProject } from "./test-utils.ts";

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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function expectResolvesWithin(promise: Promise<unknown>, timeoutMs: number, label: string): Promise<void> {
	const result = await Promise.race([promise.then(() => "resolved"), sleep(timeoutMs).then(() => "timeout")]);
	expect(result, label).toBe("resolved");
}

describe("atomic task creation", () => {
	let testDir: string;
	let originalGlobalLockEnv: string | undefined;

	beforeEach(async () => {
		originalGlobalLockEnv = process.env.USE_GLOBAL_TASK_ID_LOCK;
		delete process.env.USE_GLOBAL_TASK_ID_LOCK;

		testDir = await mkdtemp(join(tmpdir(), "backlog-atomic-create-"));
		const core = new Core(testDir);
		await initializeTestProject(core, "Atomic Create Test", false);

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

	it("serializes create-time writes and assigns unique ids by default", async () => {
		const first = new Core(testDir);
		const second = new Core(testDir);
		const firstEnteredSave = createDeferred<void>();
		const releaseFirstSave = createDeferred<void>();
		const secondEnteredSave = createDeferred<void>();
		let saveEntries = 0;

		const patchSaveTask = (core: Core) => {
			const original = core.fs.saveTask.bind(core.fs);
			core.fs.saveTask = (async (task: Task): Promise<string> => {
				saveEntries += 1;
				if (task.title === "Alpha") {
					firstEnteredSave.resolve();
					await releaseFirstSave.promise;
				}
				if (task.title === "Beta") {
					secondEnteredSave.resolve();
				}
				return await original(task);
			}) as typeof core.fs.saveTask;
		};

		patchSaveTask(first);
		patchSaveTask(second);

		const firstCreate = first.createTaskFromInput({ title: "Alpha" }, false);
		await firstEnteredSave.promise;

		const secondCreate = second.createTaskFromInput({ title: "Beta" }, false);
		await Promise.resolve();
		await Promise.resolve();
		expect(saveEntries).toBe(1);

		releaseFirstSave.resolve();
		const [createdA, createdB] = await Promise.all([firstCreate, secondCreate]);
		await secondEnteredSave.promise;

		expect(new Set([createdA.task.id, createdB.task.id]).size).toBe(2);
		expect([createdA.task.id, createdB.task.id].sort()).toEqual(["TASK-1", "TASK-2"]);
	});

	it("allows concurrent entry into the save path when USE_GLOBAL_TASK_ID_LOCK=false", async () => {
		process.env.USE_GLOBAL_TASK_ID_LOCK = "false";

		const first = new Core(testDir);
		const second = new Core(testDir);
		const bothEnteredSave = createDeferred<void>();
		let saveEntries = 0;

		const patchSaveTask = (core: Core) => {
			const original = core.fs.saveTask.bind(core.fs);
			core.fs.saveTask = (async (task: Task): Promise<string> => {
				saveEntries += 1;
				if (saveEntries === 2) {
					bothEnteredSave.resolve();
				}
				await bothEnteredSave.promise;
				return await original(task);
			}) as typeof core.fs.saveTask;
		};

		patchSaveTask(first);
		patchSaveTask(second);

		const firstCreate = first.createTaskFromInput({ title: "Alpha" }, false);
		const secondCreate = second.createTaskFromInput({ title: "Beta" }, false);

		await expectResolvesWithin(bothEnteredSave.promise, 250, "both creates should reach saveTask without the lock");
		expect(saveEntries).toBe(2);

		await Promise.all([firstCreate, secondCreate]);
	});

	it("assigns unique ids when two draft promotions race", async () => {
		const setup = new Core(testDir);
		await setup.createTaskFromInput({ title: "Draft A", status: "Draft" }, false);
		await setup.createTaskFromInput({ title: "Draft B", status: "Draft" }, false);

		const first = new Core(testDir);
		const second = new Core(testDir);
		const firstEnteredSave = createDeferred<void>();
		const releaseFirstSave = createDeferred<void>();
		let saveEntries = 0;

		const patchSaveTask = (core: Core) => {
			const original = core.fs.saveTask.bind(core.fs);
			core.fs.saveTask = (async (task: Task): Promise<string> => {
				saveEntries += 1;
				if (task.title === "Draft A") {
					firstEnteredSave.resolve();
					await releaseFirstSave.promise;
				}
				return await original(task);
			}) as typeof core.fs.saveTask;
		};

		patchSaveTask(first);
		patchSaveTask(second);

		const promoteA = first.promoteDraft("draft-1", false);
		await firstEnteredSave.promise;

		const promoteB = second.promoteDraft("draft-2", false);
		await Promise.resolve();
		await Promise.resolve();
		expect(saveEntries).toBe(1);

		releaseFirstSave.resolve();
		await Promise.all([promoteA, promoteB]);

		const tasks = await setup.fs.listTasks();
		expect(tasks.map((task) => task.id)).toEqual(["TASK-1", "TASK-2"]);
		expect(tasks.map((task) => task.title)).toEqual(["Draft A", "Draft B"]);
	});

	it("assigns unique ids when two task demotions race", async () => {
		const setup = new Core(testDir);
		await setup.createTaskFromInput({ title: "Task A" }, false);
		await setup.createTaskFromInput({ title: "Task B" }, false);

		const first = new Core(testDir);
		const second = new Core(testDir);
		const firstEnteredSave = createDeferred<void>();
		const releaseFirstSave = createDeferred<void>();
		let saveEntries = 0;

		const patchSaveDraft = (core: Core) => {
			const original = core.fs.saveDraft.bind(core.fs);
			core.fs.saveDraft = (async (task: Task): Promise<string> => {
				saveEntries += 1;
				if (task.title === "Task A") {
					firstEnteredSave.resolve();
					await releaseFirstSave.promise;
				}
				return await original(task);
			}) as typeof core.fs.saveDraft;
		};

		patchSaveDraft(first);
		patchSaveDraft(second);

		const demoteA = first.demoteTask("task-1", false);
		await firstEnteredSave.promise;

		const demoteB = second.demoteTask("task-2", false);
		await Promise.resolve();
		await Promise.resolve();
		expect(saveEntries).toBe(1);

		releaseFirstSave.resolve();
		await Promise.all([demoteA, demoteB]);

		const drafts = await setup.fs.listDrafts();
		expect(drafts.map((draft) => draft.id)).toEqual(["DRAFT-1", "DRAFT-2"]);
		expect(drafts.map((draft) => draft.title)).toEqual(["Task A", "Task B"]);
	});

	it("returns a user-facing error when the create lock times out", async () => {
		const core = new Core(testDir);
		const lockEntered = createDeferred<void>();
		const releaseLock = createDeferred<void>();

		const heldLock = core.fs.withCreateLock(
			async () => {
				lockEntered.resolve();
				await releaseLock.promise;
			},
			{ timeoutMs: 5_000, retryDelayMs: 25, staleMs: 5_000 },
		);
		await lockEntered.promise;

		await expect(
			core.fs.withCreateLock(async () => undefined, {
				timeoutMs: 100,
				retryDelayMs: 25,
				staleMs: 5_000,
			}),
		).rejects.toThrow(CREATE_LOCK_ERROR_MESSAGE);

		releaseLock.resolve();
		await heldLock;
	});
});
