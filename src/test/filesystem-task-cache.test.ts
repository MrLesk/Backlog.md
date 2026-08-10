import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { stat, unlink, utimes } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FileSystem } from "../file-system/operations.ts";
import * as markdownParser from "../markdown/parser.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

function task(id: string, title: string): Task {
	return {
		id,
		title,
		status: "To Do",
		assignee: ["@owner"],
		createdDate: "2026-08-10",
		labels: ["cache"],
		dependencies: [],
		description: "Cached task",
		acceptanceCriteriaItems: [{ checked: false, text: "Stay independent", index: 1 }],
		comments: [{ body: "Keep the cached value isolated", createdDate: "2026-08-10", index: 1 }],
	};
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolvePromise!: (value: T) => void;
	const promise = new Promise<T>((resolve) => {
		resolvePromise = resolve;
	});
	return { promise, resolve: resolvePromise };
}

interface TaskCacheHarness {
	readParsedTaskFile(filepath: string, cacheEpoch?: number): Promise<Task>;
	readTaskFiles(
		directory: string,
		files: string[],
		options: { normalizeIdentity: boolean; debugLabel: string },
		cacheEpoch?: number,
	): Promise<Task[]>;
	parsedTaskFiles: Map<string, { content: string; task: Task }>;
	taskFileReadGenerations: Map<string, number>;
	taskParseCacheEpoch: number;
}

describe("FileSystem task parse cache", () => {
	let testDir: string;
	let filesystem: FileSystem;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-task-file-cache");
		filesystem = new FileSystem(testDir);
		await filesystem.ensureBacklogStructure();
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	it("reuses exact active and completed contents without sharing mutable parse results", async () => {
		await filesystem.saveTask(task("TASK-1", "Active task"));
		await Bun.write(
			join(filesystem.completedDir, "task-2 - Completed task.md"),
			serializeTask({ ...task("TASK-2", "Completed task"), status: "Done" }),
		);
		const parseSpy = spyOn(markdownParser, "parseTask");

		try {
			const [firstActive, firstCompleted] = await Promise.all([
				filesystem.listTasks(),
				filesystem.listCompletedTasks(),
			]);
			expect(parseSpy).toHaveBeenCalledTimes(2);

			firstActive[0]?.labels.push("mutated");
			if (firstActive[0]?.acceptanceCriteriaItems?.[0]) {
				firstActive[0].acceptanceCriteriaItems[0].text = "Mutated criterion";
			}
			firstCompleted[0]?.assignee.push("@mutated");

			const [secondActive, secondCompleted] = await Promise.all([
				filesystem.listTasks(),
				filesystem.listCompletedTasks(),
			]);
			expect(parseSpy).toHaveBeenCalledTimes(2);
			expect(secondActive[0]).not.toBe(firstActive[0]);
			expect(secondActive[0]?.labels).toEqual(["cache"]);
			expect(secondActive[0]?.acceptanceCriteriaItems?.[0]?.text).toBe("Stay independent");
			expect(secondCompleted[0]?.assignee).toEqual(["@owner"]);
		} finally {
			parseSpy.mockRestore();
		}
	});

	it("reparses an exact-content change even when size and timestamps are unchanged", async () => {
		const original = serializeTask(task("TASK-1", "Alpha"));
		const replacement = serializeTask(task("TASK-1", "Bravo"));
		expect(Buffer.byteLength(replacement)).toBe(Buffer.byteLength(original));
		const taskPath = join(filesystem.tasksDir, "task-1 - Stable path.md");
		await Bun.write(taskPath, original);
		const parseSpy = spyOn(markdownParser, "parseTask");

		try {
			expect((await filesystem.listTasks())[0]?.title).toBe("Alpha");
			expect(parseSpy).toHaveBeenCalledTimes(1);
			const originalStats = await stat(taskPath);

			await Bun.write(taskPath, replacement);
			await utimes(taskPath, originalStats.atime, originalStats.mtime);

			expect((await filesystem.listTasks())[0]?.title).toBe("Bravo");
			expect(parseSpy).toHaveBeenCalledTimes(2);
			await filesystem.listTasks();
			expect(parseSpy).toHaveBeenCalledTimes(2);
		} finally {
			parseSpy.mockRestore();
		}
	});

	it("never serves a stale cached task while the file is malformed", async () => {
		const original = serializeTask(task("TASK-1", "Valid task"));
		const taskPath = join(filesystem.tasksDir, "task-1 - Valid task.md");
		await Bun.write(taskPath, original);
		const parseSpy = spyOn(markdownParser, "parseTask");

		try {
			expect(await filesystem.listTasks()).toHaveLength(1);
			await Bun.write(taskPath, "---\nid: TASK-1\nlabels: [broken\n---\n");

			expect(await filesystem.listTasks()).toEqual([]);
			expect(await filesystem.listTasks()).toEqual([]);
			expect(parseSpy).toHaveBeenCalledTimes(3);

			await Bun.write(taskPath, original);
			expect((await filesystem.listTasks())[0]?.title).toBe("Valid task");
			expect(parseSpy).toHaveBeenCalledTimes(3);
		} finally {
			parseSpy.mockRestore();
		}
	});

	it("prunes deleted paths before a later file reuses the same name", async () => {
		const original = serializeTask(task("TASK-1", "Original task"));
		const taskPath = join(filesystem.tasksDir, "task-1 - Reused path.md");
		await Bun.write(taskPath, original);
		const parseSpy = spyOn(markdownParser, "parseTask");

		try {
			expect(await filesystem.listTasks()).toHaveLength(1);
			await unlink(taskPath);
			expect(await filesystem.listTasks()).toEqual([]);

			await Bun.write(taskPath, original);
			expect((await filesystem.listTasks())[0]?.title).toBe("Original task");
			expect(parseSpy).toHaveBeenCalledTimes(2);
		} finally {
			parseSpy.mockRestore();
		}
	});

	it("clears parsed tasks when the configured backlog root changes", async () => {
		await filesystem.saveTask(task("TASK-1", "Primary root"));
		const parseSpy = spyOn(markdownParser, "parseTask");

		try {
			expect((await filesystem.listTasks())[0]?.title).toBe("Primary root");
			filesystem.setBacklogDirectory("secondary");
			await filesystem.ensureBacklogStructure();
			await filesystem.saveTask(task("TASK-1", "Secondary root"));
			expect((await filesystem.listTasks())[0]?.title).toBe("Secondary root");

			filesystem.setBacklogDirectory("backlog");
			expect((await filesystem.listTasks())[0]?.title).toBe("Primary root");
			expect(parseSpy).toHaveBeenCalledTimes(3);
		} finally {
			parseSpy.mockRestore();
		}
	});

	it("does not let an older in-flight read replace a newer cached value", async () => {
		const original = serializeTask(task("TASK-1", "Older value"));
		const replacement = serializeTask(task("TASK-1", "Newer value"));
		const taskPath = join(filesystem.tasksDir, "task-1 - Concurrent.md");
		const olderRead = deferred<string>();
		const newerRead = deferred<string>();
		const harness = filesystem as unknown as TaskCacheHarness;
		let readCount = 0;
		const fileSpy = spyOn(Bun, "file").mockImplementation(((filepath: string | URL) => {
			expect(resolve(String(filepath))).toBe(resolve(taskPath));
			const content = readCount++ === 0 ? olderRead.promise : readCount === 2 ? newerRead.promise : replacement;
			return { text: async () => await content } as ReturnType<typeof Bun.file>;
		}) as typeof Bun.file);
		const parseSpy = spyOn(markdownParser, "parseTask");

		try {
			const older = harness.readParsedTaskFile(taskPath);
			const newer = harness.readParsedTaskFile(taskPath);

			newerRead.resolve(replacement);
			expect((await newer).title).toBe("Newer value");
			olderRead.resolve(original);
			expect((await older).title).toBe("Older value");

			expect((await harness.readParsedTaskFile(taskPath)).title).toBe("Newer value");
			expect(parseSpy).toHaveBeenCalledTimes(2);
		} finally {
			parseSpy.mockRestore();
			fileSpy.mockRestore();
		}
	});

	it("does not repopulate the cache from reads invalidated by a root change", async () => {
		const content = serializeTask(task("TASK-1", "Old root"));
		const taskPath = join(filesystem.tasksDir, "task-1 - Old root.md");
		const inFlightRead = deferred<string>();
		const harness = filesystem as unknown as TaskCacheHarness;
		const staleEpoch = harness.taskParseCacheEpoch;
		let readCount = 0;
		const fileSpy = spyOn(Bun, "file").mockImplementation(((filepath: string | URL) => {
			expect(resolve(String(filepath))).toBe(resolve(taskPath));
			const result = readCount++ === 0 ? inFlightRead.promise : content;
			return { text: async () => await result } as ReturnType<typeof Bun.file>;
		}) as typeof Bun.file);

		try {
			const startedBeforeRootChange = harness.readParsedTaskFile(taskPath, staleEpoch);
			filesystem.setBacklogDirectory("secondary");

			// Models a worker from the old scan that was queued behind the read limit.
			expect((await harness.readParsedTaskFile(taskPath, staleEpoch)).title).toBe("Old root");
			expect(harness.parsedTaskFiles.has(resolve(taskPath))).toBe(false);
			expect(harness.taskFileReadGenerations.has(resolve(taskPath))).toBe(false);

			inFlightRead.resolve(content);
			expect((await startedBeforeRootChange).title).toBe("Old root");
			expect(harness.parsedTaskFiles.has(resolve(taskPath))).toBe(false);
			expect(harness.taskFileReadGenerations.has(resolve(taskPath))).toBe(false);
		} finally {
			fileSpy.mockRestore();
		}
	});

	it("does not restore a path pruned while its read was in flight", async () => {
		const content = serializeTask(task("TASK-1", "Deleted task"));
		const taskPath = join(filesystem.tasksDir, "task-1 - Deleted task.md");
		const inFlightRead = deferred<string>();
		const harness = filesystem as unknown as TaskCacheHarness;
		const fileSpy = spyOn(Bun, "file").mockImplementation(((filepath: string | URL) => {
			expect(resolve(String(filepath))).toBe(resolve(taskPath));
			return { text: async () => await inFlightRead.promise } as ReturnType<typeof Bun.file>;
		}) as typeof Bun.file);

		try {
			const staleRead = harness.readParsedTaskFile(taskPath);
			await harness.readTaskFiles(filesystem.tasksDir, [], {
				normalizeIdentity: true,
				debugLabel: "task file",
			});
			inFlightRead.resolve(content);
			expect((await staleRead).title).toBe("Deleted task");
			expect(harness.parsedTaskFiles.has(resolve(taskPath))).toBe(false);
		} finally {
			fileSpy.mockRestore();
		}
	});

	it("caps task file reads across concurrent scans", async () => {
		const content = serializeTask(task("TASK-1", "Concurrent read"));
		const harness = filesystem as unknown as TaskCacheHarness;
		let nextReadStarted = deferred<void>();
		const pendingReads: Array<{ resolved: boolean; resolve: () => void }> = [];
		let started = 0;
		let active = 0;
		let maximumActive = 0;
		const fileSpy = spyOn(Bun, "file").mockImplementation(((_filepath: string | URL) => {
			started++;
			active++;
			maximumActive = Math.max(maximumActive, active);
			const read = deferred<string>();
			const pending = {
				resolved: false,
				resolve: () => {
					if (pending.resolved) return;
					pending.resolved = true;
					active--;
					read.resolve(content);
				},
			};
			pendingReads.push(pending);
			const startedSignal = nextReadStarted;
			nextReadStarted = deferred<void>();
			startedSignal.resolve();
			return { text: async () => await read.promise } as ReturnType<typeof Bun.file>;
		}) as typeof Bun.file);

		try {
			const reads = Promise.all([
				harness.readTaskFiles(
					filesystem.tasksDir,
					Array.from({ length: 32 }, (_, index) => `task-${index} - Active.md`),
					{ normalizeIdentity: true, debugLabel: "task file" },
				),
				harness.readTaskFiles(
					filesystem.completedDir,
					Array.from({ length: 32 }, (_, index) => `task-${index + 32} - Completed.md`),
					{ normalizeIdentity: false, debugLabel: "completed task file" },
				),
			]);

			expect(started).toBeGreaterThan(0);
			while (started < 64) {
				const wave = pendingReads.filter((pending) => !pending.resolved);
				if (wave.length === 0) {
					await nextReadStarted.promise;
					continue;
				}

				const startedBeforeRelease = started;
				const nextStart = nextReadStarted.promise;
				for (const pending of wave) pending.resolve();
				if (started === startedBeforeRelease) await nextStart;
			}
			expect(maximumActive).toBeLessThanOrEqual(32);
			for (const pending of pendingReads) pending.resolve();
			const [activeTasks, completedTasks] = await reads;
			expect(activeTasks).toHaveLength(32);
			expect(completedTasks).toHaveLength(32);
		} finally {
			fileSpy.mockRestore();
		}
	});
});
