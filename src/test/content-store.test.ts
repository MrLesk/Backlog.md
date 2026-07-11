import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Core } from "../core/backlog.ts";
import { ContentStore, type ContentStoreEvent } from "../core/content-store.ts";
import { SearchService } from "../core/search-service.ts";
import { FileSystem } from "../file-system/operations.ts";
import { parseTask } from "../markdown/parser.ts";
import type { BacklogConfig, Decision, Document, Task } from "../types/index.ts";
import { normalizeTaskIdentity } from "../utils/task-path.ts";
import { createUniqueTestDir, getPlatformTimeout, safeCleanup, sleep } from "./test-utils.ts";

let TEST_DIR: string;

describe("ContentStore", () => {
	let filesystem: FileSystem;
	let store: ContentStore;

	const sampleTask: Task = {
		id: "task-1",
		title: "Sample Task",
		status: "To Do",
		assignee: [],
		createdDate: "2025-09-19 10:00",
		labels: [],
		dependencies: [],
		rawContent: "## Description\nSeed content",
	};

	const sampleDecision: Decision = {
		id: "decision-1",
		title: "Adopt shared cache",
		date: "2025-09-19",
		status: "proposed",
		context: "Context",
		decision: "Decision text",
		consequences: "Consequences",
		rawContent: "## Context\nContext\n\n## Decision\nDecision text\n\n## Consequences\nConsequences",
	};

	const sampleDocument: Document = {
		id: "doc-1",
		title: "Architecture Guide",
		type: "guide",
		createdDate: "2025-09-19",
		rawContent: "# Architecture Guide",
	};

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-content-store");
		filesystem = new FileSystem(TEST_DIR);
		await filesystem.ensureBacklogStructure();
		store = new ContentStore(filesystem);
	});

	afterEach(async () => {
		store?.dispose();
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors
		}
	});

	it("loads tasks, documents, and decisions during initialization", async () => {
		await filesystem.saveTask(sampleTask);
		await filesystem.saveDecision(sampleDecision);
		await filesystem.saveDocument(sampleDocument);

		const snapshot = await store.ensureInitialized();

		expect(snapshot.tasks).toHaveLength(1);
		expect(snapshot.documents).toHaveLength(1);
		expect(snapshot.decisions).toHaveLength(1);
		expect(snapshot.tasks.map((task) => task.id)).toContain("TASK-1");
	});

	it("propagates content load failures during initialization", async () => {
		store.dispose();
		store = new ContentStore(
			filesystem,
			async () => {
				throw new Error("Deterministic content load failure");
			},
			true,
		);

		await expect(store.ensureInitialized()).rejects.toThrow("Deterministic content load failure");
	});

	it("retries initialization when the physical root changes during the first snapshot", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		const heldInitialLoad = createDeferredGate();
		let taskLoads = 0;
		store = new ContentStore(
			filesystem,
			async () => {
				const tasks = await filesystem.listTasks();
				taskLoads += 1;
				if (taskLoads === 1) {
					heldInitialLoad.markStarted();
					await heldInitialLoad.waitForRelease;
				}
				return tasks;
			},
			true,
		);

		const initialization = store.ensureInitialized();
		await withTimeout(heldInitialLoad.started, "held initial root A snapshot");
		filesystem.setBacklogDirectory("root-b");
		heldInitialLoad.release();
		const firstSnapshot = await withTimeout(initialization, "root-changing initialization");

		expect(firstSnapshot.tasks.map((task) => task.id)).toEqual(["TASK-2"]);
		expect(store.getTasks().map((task) => task.id)).toEqual(["TASK-2"]);
		expect((await store.ensureInitialized()).tasks.map((task) => task.id)).toEqual(["TASK-2"]);
		expect(taskLoads).toBe(2);
	});

	it("bounds initialization retries during repeated root churn and remains retryable", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		let churnRoots = true;
		let taskLoads = 0;
		store = new ContentStore(filesystem, async () => {
			const tasks = await filesystem.listTasks();
			taskLoads += 1;
			if (churnRoots) {
				filesystem.setBacklogDirectory(filesystem.backlogDirName === "root-a" ? "root-b" : "root-a");
			}
			return tasks;
		});

		await expect(store.ensureInitialized()).rejects.toThrow(
			"ContentStore initialization could not stabilize after concurrent changes.",
		);
		expect(taskLoads).toBe(12);
		churnRoots = false;

		const snapshot = await store.ensureInitialized();

		expect(snapshot.tasks.map((task) => task.id)).toEqual(["TASK-1"]);
		expect(taskLoads).toBe(13);
	});

	it("cancels initialization retries when disposed", async () => {
		store.dispose();
		const heldInitialLoad = createDeferredGate();
		store = new ContentStore(filesystem, async () => {
			const tasks = await filesystem.listTasks();
			heldInitialLoad.markStarted();
			await heldInitialLoad.waitForRelease;
			return tasks;
		});

		const initialization = store.ensureInitialized();
		await withTimeout(heldInitialLoad.started, "held initialization before disposal");
		store.dispose();
		heldInitialLoad.release();

		await expect(initialization).rejects.toThrow("ContentStore has been disposed.");
	});

	it("keeps initialization structure setup and snapshot on the same physical root", async () => {
		store.dispose();
		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		const heldStructureSetup = createDeferredGate();
		const ensureBacklogStructure = filesystem.ensureBacklogStructure.bind(filesystem);
		let structureSetups = 0;
		filesystem.ensureBacklogStructure = async () => {
			await ensureBacklogStructure();
			structureSetups += 1;
			if (structureSetups === 1) {
				heldStructureSetup.markStarted();
				await heldStructureSetup.waitForRelease;
			}
		};
		store = new ContentStore(filesystem, undefined, true);

		const initialization = store.ensureInitialized();
		await withTimeout(heldStructureSetup.started, "held root A structure setup");
		filesystem.setBacklogDirectory("root-b");
		heldStructureSetup.release();
		await withTimeout(initialization, "root-changing structure setup");

		expect(structureSetups).toBe(2);
		expect((await stat(rootB.tasksDir)).isDirectory()).toBe(true);
		expect((store as unknown as { rootWatchersInitialized: boolean }).rootWatchersInitialized).toBe(true);
	});

	it("retries initialization when the root changes after a coherent load resolves", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		store = new ContentStore(filesystem, undefined, true);
		type Snapshot = { tasks: Task[]; documents: Document[]; decisions: Decision[] };
		const initializationInternals = store as unknown as {
			hasCurrentRootWatchers: () => boolean;
			loadCurrentContent: (epoch: number, publish: (snapshot: Snapshot) => void) => Promise<boolean>;
			publishedRoot: string;
		};
		const loadCurrentContent = initializationInternals.loadCurrentContent.bind(store);
		let switchAfterLoad = true;
		let loads = 0;
		initializationInternals.loadCurrentContent = async (epoch, publish) => {
			loads += 1;
			const loaded = await loadCurrentContent(epoch, publish);
			if (loaded && switchAfterLoad) {
				switchAfterLoad = false;
				filesystem.setBacklogDirectory("root-b");
			}
			return loaded;
		};

		const snapshot = await store.ensureInitialized();

		expect(loads).toBe(2);
		expect(snapshot.tasks.map((task) => task.id)).toEqual(["TASK-2"]);
		expect(initializationInternals.publishedRoot).toBe(rootB.backlogDir);
		expect(initializationInternals.hasCurrentRootWatchers()).toBe(true);
	});

	it("retries initialization when the root changes after initial watchers bind", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		store = new ContentStore(filesystem, undefined, true);
		const initializationInternals = store as unknown as {
			bindRootWatchers: (epoch: number) => Promise<void>;
			hasCurrentRootWatchers: () => boolean;
			publishedRoot: string;
		};
		const bindRootWatchers = initializationInternals.bindRootWatchers.bind(store);
		let watcherBindings = 0;
		initializationInternals.bindRootWatchers = async (epoch) => {
			await bindRootWatchers(epoch);
			watcherBindings += 1;
			if (watcherBindings === 1) {
				filesystem.setBacklogDirectory("root-b");
			}
		};

		const snapshot = await store.ensureInitialized();

		expect(watcherBindings).toBe(2);
		expect(snapshot.tasks.map((task) => task.id)).toEqual(["TASK-2"]);
		expect(initializationInternals.publishedRoot).toBe(rootB.backlogDir);
		expect(initializationInternals.hasCurrentRootWatchers()).toBe(true);
	});

	it("invalidates queued old-root watcher work before retrying initialization", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A stale" });
		await rootB.saveTask({ ...sampleTask, title: "Root B authoritative" });
		const rootATask = await rootA.loadTask(sampleTask.id);
		const rootBTask = await rootB.loadTask(sampleTask.id);
		if (!rootATask || !rootBTask) {
			throw new Error("Expected both root fixtures");
		}

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		const heldRootBLoad = createDeferredGate();
		let loads = 0;
		store = new ContentStore(
			filesystem,
			async () => {
				loads += 1;
				if (loads === 1) {
					return [rootATask];
				}
				heldRootBLoad.markStarted();
				await heldRootBLoad.waitForRelease;
				return [rootBTask];
			},
			true,
		);
		const initializationInternals = store as unknown as {
			bindRootWatchers: (epoch: number) => Promise<void>;
			cachedTasks: Task[];
			enqueue: (fn: () => Promise<void>) => Promise<void>;
			enqueueRoot: (epoch: number, fn: () => Promise<void>) => Promise<void>;
			hasCurrentRootWatchers: () => boolean;
			nextContentItemGeneration: (collection: "tasks", id: string) => number;
			nextContentItemVersion: (collection: "tasks", id: string) => number;
			notify: (type: "tasks") => void;
			publishedRoot: string;
			rootWatchers: Array<{ stop(): void }>;
			rootWatchersInitialized: boolean;
			tasks: Map<string, Task>;
		};
		const heldChain = createDeferredGate();
		const blockedChain = initializationInternals.enqueue(async () => {
			heldChain.markStarted();
			await heldChain.waitForRelease;
		});
		await withTimeout(heldChain.started, "blocked content-store queue");
		let watcherBindings = 0;
		let stalePublication: Promise<void> | null = null;
		initializationInternals.bindRootWatchers = async (epoch) => {
			watcherBindings += 1;
			initializationInternals.rootWatchers.push({ stop() {} });
			initializationInternals.rootWatchersInitialized = true;
			if (watcherBindings === 1) {
				stalePublication = initializationInternals.enqueueRoot(epoch, async () => {
					initializationInternals.nextContentItemGeneration("tasks", "TASK-1");
					initializationInternals.nextContentItemVersion("tasks", "TASK-1");
					initializationInternals.tasks.set("TASK-1", rootATask);
					initializationInternals.cachedTasks = [rootATask];
					initializationInternals.notify("tasks");
				});
				filesystem.setBacklogDirectory("root-b");
			}
		};

		const initialization = store.ensureInitialized();
		await withTimeout(heldRootBLoad.started, "held root B initialization load");
		heldChain.release();
		await blockedChain;
		if (!stalePublication) {
			throw new Error("Expected queued root A watcher publication");
		}
		await stalePublication;
		heldRootBLoad.release();
		const snapshot = await initialization;

		expect(loads).toBe(2);
		expect(watcherBindings).toBe(2);
		expect(snapshot.tasks[0]?.title).toBe("Root B authoritative");
		expect(initializationInternals.publishedRoot).toBe(rootB.backlogDir);
		expect(initializationInternals.hasCurrentRootWatchers()).toBe(true);
	});

	it("keeps a persisted Core task update that completes during initialization", async () => {
		store.dispose();
		const core = new Core(TEST_DIR);
		await core.fs.ensureBacklogStructure();
		await core.fs.saveTask({ ...sampleTask, type: "bug" });

		const heldInitialLoad = createDeferredGate();
		core.loadTasks = async () => {
			const tasks = await core.fs.listTasks();
			heldInitialLoad.markStarted();
			await heldInitialLoad.waitForRelease;
			return tasks;
		};

		const storePromise = core.getContentStore();
		await withTimeout(heldInitialLoad.started, "held Core initialization");
		await core.updateTask({ ...sampleTask, type: "feature", rawContent: "## Description\nNew content" });
		heldInitialLoad.release();
		store = await storePromise;

		expect((await core.fs.loadTask(sampleTask.id))?.type).toBe("feature");
		expect(store.getTasks()[0]?.type).toBe("feature");
	});

	it("keeps persisted task, document, and decision writes that complete during initialization", async () => {
		await filesystem.saveTask({ ...sampleTask, title: "Old task" });
		await filesystem.saveDocument({ ...sampleDocument, title: "Old document" });
		await filesystem.saveDecision({ ...sampleDecision, title: "Old decision" });
		store.dispose();

		const initialTaskLoad = createDeferredGate();
		const initialDocumentLoad = createDeferredGate();
		const initialDecisionLoad = createDeferredGate();
		const originalListDocuments = filesystem.listDocuments.bind(filesystem);
		const originalListDecisions = filesystem.listDecisions.bind(filesystem);
		let holdDocumentLoad = true;
		let holdDecisionLoad = true;
		filesystem.listDocuments = async () => {
			const documents = await originalListDocuments();
			if (holdDocumentLoad) {
				holdDocumentLoad = false;
				initialDocumentLoad.markStarted();
				await initialDocumentLoad.waitForRelease;
			}
			return documents;
		};
		filesystem.listDecisions = async () => {
			const decisions = await originalListDecisions();
			if (holdDecisionLoad) {
				holdDecisionLoad = false;
				initialDecisionLoad.markStarted();
				await initialDecisionLoad.waitForRelease;
			}
			return decisions;
		};
		store = new ContentStore(filesystem, async () => {
			const tasks = await filesystem.listTasks();
			initialTaskLoad.markStarted();
			await initialTaskLoad.waitForRelease;
			return tasks;
		});

		const initialization = store.ensureInitialized();
		await Promise.all([
			withTimeout(initialTaskLoad.started, "initial task snapshot"),
			withTimeout(initialDocumentLoad.started, "initial document snapshot"),
			withTimeout(initialDecisionLoad.started, "initial decision snapshot"),
		]);
		await filesystem.saveTask({ ...sampleTask, title: "New task" });
		await filesystem.saveDocument({ ...sampleDocument, title: "New document" });
		await filesystem.saveDecision({ ...sampleDecision, title: "New decision" });
		const persistedTask = await filesystem.loadTask(sampleTask.id);
		if (persistedTask) {
			store.upsertTask(persistedTask);
		}

		initialTaskLoad.release();
		initialDocumentLoad.release();
		initialDecisionLoad.release();
		await initialization;

		expect(store.getSnapshot()).toEqual({
			tasks: [expect.objectContaining({ title: "New task" })],
			documents: [expect.objectContaining({ title: "New document" })],
			decisions: [expect.objectContaining({ title: "New decision" })],
		});
	});

	it("keeps a same-root persisted write that spans initial watcher setup", async () => {
		await filesystem.saveTask({ ...sampleTask, title: "Old task" });
		store.dispose();

		const persistedWrite = createDeferredGate();
		const finishSave = createDeferredGate();
		const originalSaveTask = filesystem.saveTask.bind(filesystem);
		filesystem.saveTask = async (task) => {
			const path = await originalSaveTask(task);
			persistedWrite.markStarted();
			await finishSave.waitForRelease;
			return path;
		};
		const heldInitialLoad = createDeferredGate();
		store = new ContentStore(
			filesystem,
			async () => {
				const tasks = await filesystem.listTasks();
				heldInitialLoad.markStarted();
				await heldInitialLoad.waitForRelease;
				return tasks;
			},
			true,
		);

		const initialization = store.ensureInitialized();
		await withTimeout(heldInitialLoad.started, "held initial task load");
		const saving = filesystem.saveTask({ ...sampleTask, title: "Persisted newer" });
		await withTimeout(persistedWrite.started, "persisted initialization-spanning write");
		heldInitialLoad.release();
		await initialization;
		(store as unknown as { stopRootWatchers: () => void }).stopRootWatchers();
		finishSave.release();
		await saving;

		expect((await filesystem.loadTask(sampleTask.id))?.title).toBe("Persisted newer");
		expect(store.getTasks()[0]?.title).toBe("Persisted newer");
	});

	it("emits task updates when underlying files change", async () => {
		await filesystem.saveTask(sampleTask);
		await store.ensureInitialized();

		const waitForUpdate = waitForEventWithTimeout(store, (event) => {
			return event.type === "tasks" && event.tasks.some((task) => task.title === "Updated Task");
		});

		await filesystem.saveTask({ ...sampleTask, title: "Updated Task" });
		await waitForUpdate;

		const tasks = store.getTasks();
		expect(tasks.map((task) => task.title)).toContain("Updated Task");
	});

	it("does not let an older task refresh overwrite a newer persisted upsert", async () => {
		store.dispose();
		const saveTaskToDisk = filesystem.saveTask.bind(filesystem);
		await saveTaskToDisk({ ...sampleTask, type: "bug" });

		let nextLoadGate: DeferredGate | null = null;
		store = new ContentStore(filesystem, async () => {
			const tasks = await filesystem.listTasks();
			const gate = nextLoadGate;
			if (gate) {
				nextLoadGate = null;
				gate.markStarted();
				await gate.waitForRelease;
			}
			return tasks;
		});
		await store.ensureInitialized();

		const search = new SearchService(store);
		await search.ensureInitialized();
		const heldOldLoad = createDeferredGate();
		nextLoadGate = heldOldLoad;
		const heldOldRefresh = (store as unknown as { refreshTasksFromDisk: () => Promise<void> }).refreshTasksFromDisk();
		await withTimeout(heldOldLoad.started, "old task refresh");

		await saveTaskToDisk({ ...sampleTask, type: "feature" });
		const persistedTask = await filesystem.loadTask(sampleTask.id);
		expect(persistedTask?.type).toBe("feature");
		store.upsertTask(persistedTask as Task);
		expect(store.getTasks()[0]?.type).toBe("feature");

		heldOldLoad.release();
		await heldOldRefresh;

		expect(store.getTasks()[0]?.type).toBe("feature");
		const featureResults = search.search({ types: ["task"], filters: { type: "feature" } });
		expect(featureResults).toHaveLength(1);
		expect(featureResults[0]?.type).toBe("task");
		if (featureResults[0]?.type === "task") {
			expect(featureResults[0].task.type).toBe("feature");
		}
		search.dispose();
	});

	it("publishes a validated task refresh without a microtask overwrite window", async () => {
		store.dispose();
		const taskWithTitle = (title: string): Task => ({ ...sampleTask, title });
		const heldRefresh = createDeferredGate();
		let loadCount = 0;
		store = new ContentStore(filesystem, async () => {
			loadCount += 1;
			if (loadCount === 1) {
				return [taskWithTitle("base")];
			}
			if (loadCount === 2) {
				heldRefresh.markStarted();
				await heldRefresh.waitForRelease;
				return [taskWithTitle("stale")];
			}
			return [taskWithTitle("new")];
		});
		await store.ensureInitialized();

		const refresh = store.refreshTasks();
		await withTimeout(heldRefresh.started, "held public task refresh");
		let upsert = Promise.resolve();
		for (let depth = 0; depth < 5; depth += 1) {
			upsert = upsert.then(() => {});
		}
		upsert = upsert.then(() => store.upsertTask(taskWithTitle("new"), { root: filesystem.backlogDir }));
		heldRefresh.release();
		await Promise.all([refresh, upsert]);

		expect(store.getTasks()[0]?.title).toBe("new");
	});

	it("preserves the newest task after concurrent updates return to the starting value", async () => {
		store.dispose();
		const taskWithTitle = (title: string): Task => ({ ...sampleTask, title });
		const heldRefresh = createDeferredGate();
		let loadCount = 0;
		store = new ContentStore(filesystem, async () => {
			loadCount += 1;
			if (loadCount === 1) {
				return [taskWithTitle("base")];
			}
			heldRefresh.markStarted();
			await heldRefresh.waitForRelease;
			return [taskWithTitle("stale captured")];
		});
		await store.ensureInitialized();

		const refresh = store.refreshTasks();
		await withTimeout(heldRefresh.started, "held ABA task refresh");
		store.upsertTask(taskWithTitle("intermediate newer"), { root: filesystem.backlogDir });
		store.upsertTask(taskWithTitle("base"), { root: filesystem.backlogDir });
		heldRefresh.release();
		await refresh;

		expect(store.getTasks()[0]?.title).toBe("base");
	});

	it("terminates a refresh under sustained invalidation without publishing stale tasks", async () => {
		store.dispose();
		const secondTask: Task = { ...sampleTask, id: "TASK-2", title: "Task 2 old" };
		let loadCount = 0;
		let invalidateLoads = false;
		store = new ContentStore(filesystem, async () => {
			loadCount += 1;
			if (invalidateLoads) {
				for (let update = 1; update <= 20; update += 1) {
					store.upsertTask({ ...secondTask, title: `Task 2 upsert ${update}` }, { root: filesystem.backlogDir });
				}
				return [
					{ ...sampleTask, title: "Task 1 external new" },
					{ ...secondTask, title: "Task 2 stale refresh" },
				];
			}
			return [{ ...sampleTask, title: "Task 1 old" }, secondTask];
		});
		await store.ensureInitialized();

		invalidateLoads = true;
		await withTimeout(store.refreshTasks(), "refresh under sustained invalidation");

		expect(loadCount).toBe(2);
		expect(store.getTasks().map((task) => [task.id, task.title])).toEqual([
			["task-1", "Task 1 external new"],
			["TASK-2", "Task 2 upsert 20"],
		]);
	});

	it("does not invalidate content refreshes for identical task upserts", async () => {
		await filesystem.saveTask(sampleTask);
		await store.ensureInitialized();
		let taskEvents = 0;
		const unsubscribe = store.subscribe((event) => {
			if (event.type === "tasks") {
				taskEvents += 1;
			}
		});

		const cachedTask = store.getTasks()[0];
		if (!cachedTask) {
			throw new Error("Expected a cached task");
		}
		store.upsertTask(cachedTask);

		expect(taskEvents).toBe(0);
		unsubscribe();
	});

	it("retries a full refresh invalidated by an unrelated task upsert", async () => {
		store.dispose();
		const saveTaskToDisk = filesystem.saveTask.bind(filesystem);
		const firstTask: Task = { ...sampleTask, title: "Task 1 old" };
		const secondTask: Task = { ...sampleTask, id: "task-2", title: "Task 2 old" };
		await Promise.all([saveTaskToDisk(firstTask), saveTaskToDisk(secondTask)]);

		let nextLoadGate: DeferredGate | null = null;
		store = new ContentStore(filesystem, async () => {
			const tasks = await filesystem.listTasks();
			const gate = nextLoadGate;
			nextLoadGate = null;
			if (gate) {
				gate.markStarted();
				await gate.waitForRelease;
			}
			return tasks;
		});
		await store.ensureInitialized();

		await saveTaskToDisk({ ...firstTask, title: "Task 1 external new" });
		const heldOldLoad = createDeferredGate();
		nextLoadGate = heldOldLoad;
		const refresh = (store as unknown as { refreshTasksFromDisk: () => Promise<void> }).refreshTasksFromDisk();
		await withTimeout(heldOldLoad.started, "full task refresh");

		await saveTaskToDisk({ ...secondTask, title: "Task 2 upsert new" });
		const persistedSecondTask = await filesystem.loadTask(secondTask.id);
		if (!persistedSecondTask) {
			throw new Error("Expected the persisted second task");
		}
		store.upsertTask(persistedSecondTask);
		heldOldLoad.release();
		await refresh;

		expect(store.getTasks().map((task) => [task.id, task.title])).toEqual([
			["TASK-1", "Task 1 external new"],
			["TASK-2", "Task 2 upsert new"],
		]);
	});

	it("does not drop a targeted task refresh when an unrelated task is upserted", async () => {
		store.dispose();
		const saveTaskToDisk = filesystem.saveTask.bind(filesystem);
		const secondTask: Task = { ...sampleTask, id: "task-2", title: "Second task" };
		await Promise.all([saveTaskToDisk({ ...sampleTask, type: "bug" }), saveTaskToDisk(secondTask)]);
		store = new ContentStore(filesystem);
		await store.ensureInitialized();

		await saveTaskToDisk({ ...sampleTask, type: "feature" });
		const originalLoadTask = filesystem.loadTask.bind(filesystem);
		const heldTaskLoad = createDeferredGate();
		filesystem.loadTask = async (taskId: string) => {
			const task = await originalLoadTask(taskId);
			if (taskId.toLowerCase() === sampleTask.id.toLowerCase()) {
				heldTaskLoad.markStarted();
				await heldTaskLoad.waitForRelease;
			}
			return task;
		};

		const targetedRefresh = (
			store as unknown as { updateTaskFromDisk: (taskId: string) => Promise<void> }
		).updateTaskFromDisk(sampleTask.id);
		await withTimeout(heldTaskLoad.started, "targeted task refresh");
		const cachedSecondTask = store.getTasks().find((task) => task.id === "TASK-2");
		if (!cachedSecondTask) {
			throw new Error("Expected the second task in the content store");
		}
		store.upsertTask({ ...cachedSecondTask, title: "Second task refreshed" });

		heldTaskLoad.release();
		await targetedRefresh;

		expect(store.getTasks().find((task) => task.id === "TASK-1")?.type).toBe("feature");
		expect(store.getTasks().find((task) => task.id === "TASK-2")?.title).toBe("Second task refreshed");
	});

	it("reloads a same-root config snapshot invalidated by a newer task upsert", async () => {
		store.dispose();
		const saveTaskToDisk = filesystem.saveTask.bind(filesystem);
		await saveTaskToDisk({ ...sampleTask, type: "bug" });
		const config: BacklogConfig = {
			projectName: "Content generation fixture",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		};
		await filesystem.saveConfig(config);

		let nextTaskLoadGate: DeferredGate | null = null;
		store = new ContentStore(
			filesystem,
			async () => {
				const tasks = await filesystem.listTasks();
				const gate = nextTaskLoadGate;
				nextTaskLoadGate = null;
				if (gate) {
					gate.markStarted();
					await gate.waitForRelease;
				}
				return tasks;
			},
			true,
		);
		await store.ensureInitialized();

		const heldConfigLoad = createDeferredGate();
		nextTaskLoadGate = heldConfigLoad;
		const configRefresh = (
			store as unknown as { handleConfigChanged: (nextConfig: BacklogConfig) => Promise<void> }
		).handleConfigChanged(config);
		await withTimeout(heldConfigLoad.started, "same-root config task snapshot");

		await saveTaskToDisk({ ...sampleTask, type: "feature" });
		const persistedTask = await filesystem.loadTask(sampleTask.id);
		if (!persistedTask) {
			throw new Error("Expected the persisted task after the config snapshot started");
		}
		store.upsertTask(persistedTask);
		heldConfigLoad.release();
		await configRefresh;

		expect(store.getTasks()[0]?.type).toBe("feature");
	});

	it("keeps newer task, document, and decision refresh generations", async () => {
		store.dispose();
		const saveTaskToDisk = filesystem.saveTask.bind(filesystem);
		const saveDocumentToDisk = filesystem.saveDocument.bind(filesystem);
		const saveDecisionToDisk = filesystem.saveDecision.bind(filesystem);
		await Promise.all([
			saveTaskToDisk({ ...sampleTask, title: "Task A" }),
			saveDocumentToDisk({ ...sampleDocument, title: "Document A" }),
			saveDecisionToDisk({ ...sampleDecision, title: "Decision A" }),
		]);

		const originalListDocuments = filesystem.listDocuments.bind(filesystem);
		const originalListDecisions = filesystem.listDecisions.bind(filesystem);
		let nextTaskLoadGate: DeferredGate | null = null;
		let nextDocumentLoadGate: DeferredGate | null = null;
		let nextDecisionLoadGate: DeferredGate | null = null;
		const holdNextLoad = async <T>(result: T, gate: DeferredGate | null): Promise<T> => {
			if (gate) {
				gate.markStarted();
				await gate.waitForRelease;
			}
			return result;
		};

		filesystem.listDocuments = async () => {
			const documents = await originalListDocuments();
			const gate = nextDocumentLoadGate;
			nextDocumentLoadGate = null;
			return await holdNextLoad(documents, gate);
		};
		filesystem.listDecisions = async () => {
			const decisions = await originalListDecisions();
			const gate = nextDecisionLoadGate;
			nextDecisionLoadGate = null;
			return await holdNextLoad(decisions, gate);
		};
		store = new ContentStore(filesystem, async () => {
			const tasks = await filesystem.listTasks();
			const gate = nextTaskLoadGate;
			nextTaskLoadGate = null;
			return await holdNextLoad(tasks, gate);
		});
		await store.ensureInitialized();

		const heldTaskLoad = createDeferredGate();
		const heldDocumentLoad = createDeferredGate();
		const heldDecisionLoad = createDeferredGate();
		nextTaskLoadGate = heldTaskLoad;
		nextDocumentLoadGate = heldDocumentLoad;
		nextDecisionLoadGate = heldDecisionLoad;
		const refreshes = store as unknown as {
			refreshTasksFromDisk: () => Promise<void>;
			refreshDocumentsFromDisk: () => Promise<void>;
			refreshDecisionsFromDisk: () => Promise<void>;
		};
		const heldOldRefreshes = [
			refreshes.refreshTasksFromDisk(),
			refreshes.refreshDocumentsFromDisk(),
			refreshes.refreshDecisionsFromDisk(),
		];
		await Promise.all([
			withTimeout(heldTaskLoad.started, "old task collection refresh"),
			withTimeout(heldDocumentLoad.started, "old document collection refresh"),
			withTimeout(heldDecisionLoad.started, "old decision collection refresh"),
		]);

		await Promise.all([
			saveTaskToDisk({ ...sampleTask, title: "Task B" }),
			saveDocumentToDisk({ ...sampleDocument, title: "Document B" }),
			saveDecisionToDisk({ ...sampleDecision, title: "Decision B" }),
		]);
		await Promise.all([
			refreshes.refreshTasksFromDisk(),
			refreshes.refreshDocumentsFromDisk(),
			refreshes.refreshDecisionsFromDisk(),
		]);

		heldTaskLoad.release();
		heldDocumentLoad.release();
		heldDecisionLoad.release();
		await Promise.all(heldOldRefreshes);

		const snapshot = store.getSnapshot();
		expect(snapshot.tasks[0]?.title).toBe("Task B");
		expect(snapshot.documents[0]?.title).toBe("Document B");
		expect(snapshot.decisions[0]?.title).toBe("Decision B");
	});

	it("updates documents when new files are added", async () => {
		await store.ensureInitialized();

		const waitForDocument = waitForEventWithTimeout(store, (event) => {
			return event.type === "documents" && event.documents.some((doc) => doc.id === "doc-2");
		});

		await filesystem.saveDocument(
			{
				...sampleDocument,
				id: "doc-2",
				title: "Implementation Notes",
				rawContent: "# Implementation Notes",
			},
			"guides",
		);

		await waitForDocument;

		const documents = store.getDocuments();
		expect(documents.some((doc) => doc.id === "doc-2")).toBe(true);
	});

	it("preserves cross-branch tasks from the task loader during refresh", async () => {
		await filesystem.saveTask(sampleTask);

		const remoteTask: Task = {
			id: "task-remote",
			title: "Remote Task",
			status: "In Progress",
			assignee: ["alice"],
			createdDate: "2025-10-01 12:00",
			labels: ["remote"],
			dependencies: [],
			rawContent: "## Description\nRemote content",
			source: "remote",
		};

		let loaderCalls = 0;
		store.dispose();
		store = new ContentStore(filesystem, async () => {
			loaderCalls += 1;
			const localTasks = await filesystem.listTasks();
			return [...localTasks, remoteTask];
		});

		await store.ensureInitialized();
		expect(store.getTasks().map((task) => task.id)).toContain("task-remote");

		await (store as unknown as { refreshTasksFromDisk: () => Promise<void> }).refreshTasksFromDisk();

		const refreshedTasks = store.getTasks();
		expect(refreshedTasks.map((task) => task.id)).toContain("task-remote");
		expect(loaderCalls).toBeGreaterThanOrEqual(2);
	});

	it("removes decisions when files are deleted", async () => {
		store.dispose();
		store = new ContentStore(filesystem, undefined, true);
		await filesystem.saveDecision(sampleDecision);
		await store.ensureInitialized();

		const decisionsDir = filesystem.decisionsDir;
		const decisionFiles: string[] = [];
		for await (const file of new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir, followSymlinks: true })) {
			decisionFiles.push(file);
		}
		const decisionFile = decisionFiles.find((file) => file.startsWith("decision-1"));
		if (!decisionFile) {
			throw new Error("Expected decision file was not created");
		}

		const waitForRemoval = waitForEventWithTimeout(
			store,
			(event) => {
				return event.type === "decisions" && event.decisions.every((decision) => decision.id !== "decision-1");
			},
			getPlatformTimeout(15000),
		);

		await unlink(join(decisionsDir, decisionFile));
		await waitForRemoval;

		const decisions = store.getDecisions();
		expect(decisions.find((decision) => decision.id === "decision-1")).toBeUndefined();
	});

	it("does not reconcile a late old-root publication into a new-root snapshot", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		let nextTaskLoad: DeferredGate | null = null;
		store = new ContentStore(
			filesystem,
			async () => {
				const tasks = await filesystem.listTasks();
				const gate = nextTaskLoad;
				nextTaskLoad = null;
				if (gate) {
					gate.markStarted();
					await gate.waitForRelease;
				}
				return tasks;
			},
			true,
		);
		await store.ensureInitialized();

		const heldRootBLoad = createDeferredGate();
		nextTaskLoad = heldRootBLoad;
		filesystem.setBacklogDirectory("root-b");
		const rootBConfig: BacklogConfig = {
			projectName: "Root B",
			backlogDirectory: "root-b",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		};
		const switchingRoots = (
			store as unknown as { handleConfigChanged: (config: BacklogConfig) => Promise<void> }
		).handleConfigChanged(rootBConfig);
		await withTimeout(heldRootBLoad.started, "held root B snapshot");

		const oldRootTask = store.getTasks()[0];
		if (!oldRootTask) {
			throw new Error("Expected the old-root task");
		}
		store.upsertTask({ ...oldRootTask, title: "Late root A publication" });
		heldRootBLoad.release();
		await switchingRoots;

		expect(store.getTasks().map(({ id, title }) => ({ id, title }))).toEqual([{ id: "TASK-2", title: "Root B" }]);
	});

	it("keeps a target-root persisted publication during a held root transition", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, title: "Root B old" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		let nextTaskLoad: DeferredGate | null = null;
		store = new ContentStore(
			filesystem,
			async () => {
				const tasks = await filesystem.listTasks();
				const gate = nextTaskLoad;
				nextTaskLoad = null;
				if (gate) {
					gate.markStarted();
					await gate.waitForRelease;
				}
				return tasks;
			},
			true,
		);
		await store.ensureInitialized();

		const heldRootBLoad = createDeferredGate();
		nextTaskLoad = heldRootBLoad;
		filesystem.setBacklogDirectory("root-b");
		const rootBConfig: BacklogConfig = {
			projectName: "Root B",
			backlogDirectory: "root-b",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		};
		const switchingRoots = (
			store as unknown as { handleConfigChanged: (config: BacklogConfig) => Promise<void> }
		).handleConfigChanged(rootBConfig);
		await withTimeout(heldRootBLoad.started, "held target-root snapshot");
		(store as unknown as { stopRootWatchers: () => void }).stopRootWatchers();

		await rootB.saveTask({ ...sampleTask, title: "Root B persisted newer" });
		const persistedRootBTask = await rootB.loadTask(sampleTask.id);
		if (!persistedRootBTask) {
			throw new Error("Expected the persisted target-root task");
		}
		store.upsertTask(persistedRootBTask);
		heldRootBLoad.release();
		await switchingRoots;

		expect((await rootB.loadTask(sampleTask.id))?.title).toBe("Root B persisted newer");
		expect(store.getTasks()[0]?.title).toBe("Root B persisted newer");
	});

	it("rejects an old-root task publication after the new root is live", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A late result" });
		await rootB.saveTask({ ...sampleTask, title: "Root B authoritative" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		store = new ContentStore(filesystem, () => filesystem.listTasks(), true);
		await store.ensureInitialized();
		const lateRootATask = await rootA.loadTask(sampleTask.id);
		if (!lateRootATask) {
			throw new Error("Expected the late old-root task");
		}

		filesystem.setBacklogDirectory("root-b");
		const rootBConfig: BacklogConfig = {
			projectName: "Root B",
			backlogDirectory: "root-b",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		};
		await (store as unknown as { handleConfigChanged: (config: BacklogConfig) => Promise<void> }).handleConfigChanged(
			rootBConfig,
		);
		store.upsertTask(lateRootATask);

		expect((await rootB.loadTask(sampleTask.id))?.title).toBe("Root B authoritative");
		expect(store.getTasks()[0]?.title).toBe("Root B authoritative");
	});

	it("does not assign an ambiguous pathless task to the newly published root", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A", type: "feature" });
		await rootB.saveTask({ ...sampleTask, title: "Root B", type: "bug" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();
		const rootATask = await rootA.loadTask(sampleTask.id);
		if (!rootATask?.filePath) {
			throw new Error("Expected the root A task file");
		}
		const watcherShapedRootATask = normalizeTaskIdentity(parseTask(await Bun.file(rootATask.filePath).text()));
		store.upsertTask(watcherShapedRootATask);
		const heldRootATask = store.getTasks()[0];
		if (!heldRootATask) {
			throw new Error("Expected the root A task in the content store");
		}

		filesystem.setBacklogDirectory("root-b");
		await (store as unknown as { handleConfigChanged: (config: BacklogConfig) => Promise<void> }).handleConfigChanged({
			projectName: "Root B",
			backlogDirectory: "root-b",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		});
		expect(store.getTasks()[0]?.type).toBe("bug");

		store.upsertTask({ ...heldRootATask, rawContent: "## Description\nLate root A publication" });

		expect((await rootB.loadTask(sampleTask.id))?.type).toBe("bug");
		expect(store.getTasks()[0]?.type).toBe("bug");
	});

	it("does not publish a superseded root transition with the current root snapshot", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		const heldRefresh = createDeferredGate();
		let taskLoadCount = 0;
		store = new ContentStore(
			filesystem,
			async () => {
				const tasks = await filesystem.listTasks();
				taskLoadCount += 1;
				if (taskLoadCount === 2) {
					heldRefresh.markStarted();
					await heldRefresh.waitForRelease;
				}
				return tasks;
			},
			true,
		);
		await store.ensureInitialized();

		const configEvents: Array<{ name: string; root: string; taskIds: string[] }> = [];
		store.subscribe((event) => {
			if (event.type === "config") {
				configEvents.push({
					name: event.config.projectName,
					root: filesystem.backlogDirName,
					taskIds: event.snapshot.tasks.map((task) => task.id),
				});
			}
		});

		const refresh = store.refreshTasks();
		await withTimeout(heldRefresh.started, "held root A refresh");
		filesystem.setBacklogDirectory("root-b");
		const transitionToB = (
			store as unknown as { handleConfigChanged: (config: BacklogConfig) => Promise<void> }
		).handleConfigChanged({
			projectName: "Root B",
			backlogDirectory: "root-b",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		});
		filesystem.setBacklogDirectory("root-a");
		const transitionBackToA = (
			store as unknown as { handleConfigChanged: (config: BacklogConfig) => Promise<void> }
		).handleConfigChanged({
			projectName: "Root A returned",
			backlogDirectory: "root-a",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		});
		heldRefresh.release();

		await Promise.all([refresh, transitionToB, transitionBackToA]);

		expect(configEvents).toEqual([{ name: "Root A returned", root: "root-a", taskIds: ["TASK-1"] }]);
		expect(store.getTasks().map((task) => task.id)).toEqual(["TASK-1"]);
	});

	it("reconciles stopped current-root watchers after a root transition is superseded", async () => {
		store.dispose();
		await Bun.write(join(TEST_DIR, "backlog.config.yml"), rootConfig("Root A", "root-a"));
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = new FileSystem(TEST_DIR);
		const heldRefresh = createDeferredGate();
		let taskLoadCount = 0;
		store = new ContentStore(
			filesystem,
			async () => {
				const tasks = await filesystem.listTasks();
				taskLoadCount += 1;
				if (taskLoadCount === 2) {
					heldRefresh.markStarted();
					await heldRefresh.waitForRelease;
				}
				return tasks;
			},
			true,
		);
		await store.ensureInitialized();

		const refresh = store.refreshTasks();
		await withTimeout(heldRefresh.started, "held root A refresh before watcher recovery");
		filesystem.setBacklogDirectory("root-b");
		const transitionToB = (
			store as unknown as { handleConfigChanged: (config: BacklogConfig) => Promise<void> }
		).handleConfigChanged({
			projectName: "Root B",
			backlogDirectory: "root-b",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		});
		filesystem.setBacklogDirectory("root-a");
		const reconcileRootA = store.ensureConfigWatcher();
		heldRefresh.release();
		await Promise.all([refresh, transitionToB, reconcileRootA]);

		expect((store as unknown as { rootWatchersInitialized: boolean }).rootWatchersInitialized).toBe(true);
		const externalWrite = waitForEventWithTimeout(
			store,
			(event) => event.type === "tasks" && event.tasks.some((task) => task.id === "TASK-3"),
			getPlatformTimeout(15000),
		);
		await rootA.saveTask({ ...sampleTask, id: "TASK-3", title: "Root A after recovery" });
		await externalWrite;
	});

	it("keeps watcher binding best-effort and retries after initialization", async () => {
		await filesystem.saveConfig({
			projectName: "Watcher retry",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		});
		store.dispose();
		let taskLoads = 0;
		store = new ContentStore(
			filesystem,
			async () => {
				taskLoads += 1;
				return [{ ...sampleTask, title: taskLoads === 1 ? "Initial snapshot" : "Best-effort reload" }];
			},
			true,
		);
		const watcherInternals = store as unknown as {
			bindRootWatchers: (epoch: number) => Promise<void>;
			rootWatchersInitialized: boolean;
		};
		const bindRootWatchers = watcherInternals.bindRootWatchers.bind(store);
		let bindAttempts = 0;
		watcherInternals.bindRootWatchers = async (epoch) => {
			bindAttempts += 1;
			if (bindAttempts <= 2) {
				throw new Error("Deterministic watcher bind failure");
			}
			await bindRootWatchers(epoch);
		};
		const observedEvents: Array<{ type: ContentStoreEvent["type"]; accessor: string }> = [];
		const unsubscribe = store.subscribe((event) => {
			let accessor: string;
			try {
				accessor = store.getTasks()[0]?.title ?? "empty";
			} catch (error) {
				accessor = `throws: ${error instanceof Error ? error.message : String(error)}`;
			}
			observedEvents.push({ type: event.type, accessor });
		});

		await store.ensureInitialized();

		expect(observedEvents).toEqual([{ type: "ready", accessor: "Best-effort reload" }]);
		unsubscribe();
		expect(bindAttempts).toBe(2);
		expect(watcherInternals.rootWatchersInitialized).toBe(false);
		expect(taskLoads).toBe(2);
		expect(store.getTasks()[0]?.title).toBe("Best-effort reload");
		await store.ensureConfigWatcher();
		expect(bindAttempts).toBe(3);
		expect(watcherInternals.rootWatchersInitialized).toBe(true);
		expect(taskLoads).toBe(3);
	});

	it("rejects a transition bind failure so the config watcher can retry", async () => {
		store.dispose();
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = fixtureFilesystem(TEST_DIR, "root-a");
		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();
		const watcherInternals = store as unknown as {
			bindRootWatchers: (epoch: number) => Promise<void>;
			handleConfigChanged: (config: BacklogConfig) => Promise<void>;
			rootWatchersInitialized: boolean;
		};
		const bindRootWatchers = watcherInternals.bindRootWatchers.bind(store);
		let failNextBind = true;
		watcherInternals.bindRootWatchers = async (epoch) => {
			if (failNextBind) {
				failNextBind = false;
				throw new Error("Transient transition bind failure");
			}
			await bindRootWatchers(epoch);
		};
		const rootBConfig: BacklogConfig = {
			projectName: "Root B",
			backlogDirectory: "root-b",
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		};

		filesystem.setBacklogDirectory("root-b");
		await expect(watcherInternals.handleConfigChanged(rootBConfig)).rejects.toThrow(
			"Transient transition bind failure",
		);
		expect(watcherInternals.rootWatchersInitialized).toBe(false);

		await watcherInternals.handleConfigChanged(rootBConfig);

		expect(watcherInternals.rootWatchersInitialized).toBe(true);
		expect(store.getTasks().map((task) => task.id)).toEqual(["TASK-2"]);
	});

	it("retries public root reconciliation when content loading fails after watchers bind", async () => {
		store.dispose();
		const configPath = join(TEST_DIR, "backlog.config.yml");
		await Bun.write(configPath, rootConfig("Root A", "root-a"));
		const rootA = fixtureFilesystem(TEST_DIR, "root-a");
		const rootB = fixtureFilesystem(TEST_DIR, "root-b");
		await rootA.ensureBacklogStructure();
		await rootB.ensureBacklogStructure();
		await rootA.saveTask({ ...sampleTask, title: "Root A" });
		await rootB.saveTask({ ...sampleTask, id: "TASK-2", title: "Root B" });

		filesystem = new FileSystem(TEST_DIR);
		let taskLoads = 0;
		store = new ContentStore(
			filesystem,
			async () => {
				taskLoads += 1;
				if (taskLoads === 2) {
					throw new Error("Transient root content load failure");
				}
				return filesystem.listTasks();
			},
			true,
		);
		await store.ensureInitialized();
		const watcherInternals = store as unknown as {
			createConfigWatcher: () => null;
			hasCurrentRootWatchers: () => boolean;
			publishedRoot: string;
			stopConfigWatcher: () => void;
		};
		watcherInternals.stopConfigWatcher();
		watcherInternals.createConfigWatcher = () => null;
		filesystem.setBacklogDirectory("root-b");
		await Bun.write(configPath, rootConfig("Root B", "root-b"));

		await expect(store.ensureConfigWatcher()).rejects.toThrow("Transient root content load failure");
		expect(watcherInternals.hasCurrentRootWatchers()).toBe(true);
		expect(watcherInternals.publishedRoot).toBe(rootA.backlogDir);
		expect(store.getTasks().map((task) => task.id)).toEqual(["TASK-1"]);

		await store.ensureConfigWatcher();

		expect(taskLoads).toBe(3);
		expect(store.getTasks().map((task) => task.id)).toEqual(["TASK-2"]);
		expect(watcherInternals.publishedRoot).toBe(rootB.backlogDir);
	});

	it("publishes coherent A to B to A snapshots and rebinds every root watcher", async () => {
		store.dispose();
		const lifecycleGateTimeout = getPlatformTimeout(5000);
		const lifecycleEventTimeout = getPlatformTimeout(8000);
		const rootA = "custom/a";
		const rootB = "custom/b";
		const configPath = join(TEST_DIR, "backlog.config.yml");
		await Bun.write(configPath, rootConfig("Root A", rootA));

		filesystem = new FileSystem(TEST_DIR);
		const fixtureA = fixtureFilesystem(TEST_DIR, rootA);
		const fixtureB = fixtureFilesystem(TEST_DIR, rootB);
		await Promise.all([writeFixture(fixtureA, "101", "a-1"), writeFixture(fixtureB, "201", "b-1")]);

		let nextTaskLoadGate: DeferredGate | null = null;
		store = new ContentStore(
			filesystem,
			async () => {
				const tasks = await filesystem.listTasks();
				const gate = nextTaskLoadGate;
				if (gate) {
					nextTaskLoadGate = null;
					gate.markStarted();
					await gate.waitForRelease;
				}
				return tasks;
			},
			true,
		);

		const initial = await store.ensureInitialized();
		expect(initial.tasks.map((task) => task.id)).toEqual(["TASK-101"]);
		expect(initial.documents.map((document) => document.id)).toEqual(["doc-a-1"]);
		expect(initial.decisions.map((decision) => decision.id)).toEqual(["decision-a-1"]);

		const configEvents: Array<{ name: string; event: ContentStoreEvent }> = [];
		const unsubscribe = store.subscribe((event) => {
			if (event.type === "config") {
				configEvents.push({ name: event.config.projectName, event });
			}
		});
		const gates: DeferredGate[] = [];

		try {
			const heldOldLoad = createDeferredGate();
			gates.push(heldOldLoad);
			nextTaskLoadGate = heldOldLoad;
			const heldOldRefresh = store.refreshTasks();
			await withTimeout(heldOldLoad.started, "old-root task refresh", lifecycleGateTimeout);

			const rootBPublished = waitForEventWithTimeout(
				store,
				(event) => event.type === "config" && event.config.projectName === "Root B",
				lifecycleEventTimeout,
				"root B config publication",
			);
			await replaceRootConfig(configPath, rootConfig("Root B", rootB));
			await waitUntil(() => filesystem.backlogDirName === rootB, "root B publication");

			// This write happens after the old handles are closed while old queued work is still held.
			await writeFixture(fixtureA, "103", "a-3");

			const heldBLoad = createDeferredGate();
			gates.push(heldBLoad);
			nextTaskLoadGate = heldBLoad;
			heldOldLoad.release();
			await withTimeout(heldOldRefresh, "old-root refresh completion", lifecycleGateTimeout);
			await withTimeout(heldBLoad.started, "root B snapshot load", lifecycleGateTimeout);

			const rootBLaterWrites = waitForEventWithTimeout(
				store,
				(event) =>
					event.snapshot.tasks.some((task) => task.id === "TASK-202") &&
					event.snapshot.documents.some((document) => document.id === "doc-b-2") &&
					event.snapshot.decisions.some((decision) => decision.id === "decision-b-2"),
				lifecycleEventTimeout,
				"root B watcher publications after rebinding",
			);
			await writeFixture(fixtureB, "202", "b-2");
			heldBLoad.release();

			const [rootBEvent] = await Promise.all([rootBPublished, rootBLaterWrites]);
			expect(rootBEvent.snapshot.tasks.every((task) => task.id.startsWith("TASK-2"))).toBe(true);
			expect(rootBEvent.snapshot.documents.every((document) => document.id.startsWith("doc-b-"))).toBe(true);
			expect(rootBEvent.snapshot.decisions.every((decision) => decision.id.startsWith("decision-b-"))).toBe(true);
			expect(store.getTasks().some((task) => task.id === "TASK-103")).toBe(false);
			expect(store.getDocuments().some((document) => document.id === "doc-a-3")).toBe(false);
			expect(store.getDecisions().some((decision) => decision.id === "decision-a-3")).toBe(false);

			const heldBConfigLoad = createDeferredGate();
			gates.push(heldBConfigLoad);
			nextTaskLoadGate = heldBConfigLoad;
			const heldBPublished = waitForEventWithTimeout(
				store,
				(event) => event.type === "config" && event.config.projectName === "Root B held",
				lifecycleEventTimeout,
				"held root B config publication",
			);
			await replaceRootConfig(configPath, rootConfig("Root B held", rootB));
			await withTimeout(heldBConfigLoad.started, "held root B config load", lifecycleGateTimeout);
			const rootAReturned = waitForEventWithTimeout(
				store,
				(event) => event.type === "config" && event.config.projectName === "Root A returned",
				lifecycleEventTimeout,
				"returned root A config publication",
			);
			await replaceRootConfig(configPath, rootConfig("Root A returned", rootA));
			await sleep(getPlatformTimeout(150));
			heldBConfigLoad.release();

			const [, rootAEvent] = await Promise.all([heldBPublished, rootAReturned]);
			expect(rootAEvent.snapshot.tasks.map((task) => task.id).sort()).toEqual(["TASK-101", "TASK-103"]);
			expect(rootAEvent.snapshot.documents.map((document) => document.id).sort()).toEqual(["doc-a-1", "doc-a-3"]);
			expect(rootAEvent.snapshot.decisions.map((decision) => decision.id).sort()).toEqual([
				"decision-a-1",
				"decision-a-3",
			]);

			const rootALaterWrites = waitForEventWithTimeout(
				store,
				(event) =>
					event.snapshot.tasks.some((task) => task.id === "TASK-104") &&
					event.snapshot.documents.some((document) => document.id === "doc-a-4") &&
					event.snapshot.decisions.some((decision) => decision.id === "decision-a-4"),
				lifecycleEventTimeout,
				"root A watcher publications after return",
			);
			await writeFixture(fixtureA, "104", "a-4");
			await rootALaterWrites;
			await sleep(getPlatformTimeout(700));
			expect(configEvents.map(({ name }) => name)).toEqual(["Root B", "Root B held", "Root A returned"]);

			const disposedStore = store;
			const stoppedSnapshot = disposedStore.getSnapshot();
			store.dispose();
			await writeFixture(fixtureA, "105", "a-5");
			await sleep(getPlatformTimeout(300));
			expect(disposedStore.getSnapshot()).toEqual(stoppedSnapshot);

			store = new ContentStore(filesystem, undefined, true);
			const restarted = await store.ensureInitialized();
			expect(restarted.tasks.some((task) => task.id === "TASK-105")).toBe(true);
			expect(restarted.documents.some((document) => document.id === "doc-a-5")).toBe(true);
			expect(restarted.decisions.some((decision) => decision.id === "decision-a-5")).toBe(true);
			const restartedWrite = waitForEventWithTimeout(
				store,
				(event) =>
					event.snapshot.tasks.some((task) => task.id === "TASK-106") &&
					event.snapshot.documents.some((document) => document.id === "doc-a-6") &&
					event.snapshot.decisions.some((decision) => decision.id === "decision-a-6"),
				lifecycleEventTimeout,
				"restarted root A watcher publications",
			);
			await writeFixture(fixtureA, "106", "a-6");
			await restartedWrite;
		} finally {
			for (const gate of gates) gate.release();
			unsubscribe();
		}
	});

	it("rebinds both config and content watchers when browser initialization selects a custom root", async () => {
		store.dispose();
		filesystem = new FileSystem(TEST_DIR);
		store = new ContentStore(filesystem, undefined, true);
		await store.ensureInitialized();

		const customRoot = "planning/custom-backlog";
		const fixture = fixtureFilesystem(TEST_DIR, customRoot);
		await writeFixture(fixture, "301", "custom-1");
		filesystem.setBacklogDirectory(customRoot);
		filesystem.setConfigLocation("root");
		await filesystem.ensureBacklogStructure();
		await filesystem.saveConfig({
			projectName: "Initialized custom root",
			backlogDirectory: customRoot,
			statuses: ["To Do", "Done"],
			labels: [],
			dateFormat: "YYYY-MM-DD",
			checkActiveBranches: false,
			prefixes: { task: "TASK" },
		});

		const reconciled = waitForEventWithTimeout(
			store,
			(event) => event.type === "config" && event.config.projectName === "Initialized custom root",
			getPlatformTimeout(15000),
		);
		await store.ensureConfigWatcher();
		const event = await reconciled;
		expect(event.snapshot.tasks.map((task) => task.id)).toEqual(["TASK-301"]);
		expect(event.snapshot.documents.map((document) => document.id)).toEqual(["doc-custom-1"]);
		expect(event.snapshot.decisions.map((decision) => decision.id)).toEqual(["decision-custom-1"]);

		const reboundConfig = waitForEventWithTimeout(
			store,
			(event) => event.type === "config" && event.config.projectName === "Rebound config watcher",
			getPlatformTimeout(15000),
		);
		await replaceRootConfig(join(TEST_DIR, "backlog.config.yml"), rootConfig("Rebound config watcher", customRoot));
		const reboundEvent = await reboundConfig;
		expect(reboundEvent.snapshot.tasks.map((task) => task.id)).toEqual(["TASK-301"]);
		expect(reboundEvent.snapshot.documents.map((document) => document.id)).toEqual(["doc-custom-1"]);
		expect(reboundEvent.snapshot.decisions.map((decision) => decision.id)).toEqual(["decision-custom-1"]);

		const laterWrite = waitForEventWithTimeout(
			store,
			(event) =>
				event.snapshot.tasks.some((task) => task.id === "TASK-302") &&
				event.snapshot.documents.some((document) => document.id === "doc-custom-2") &&
				event.snapshot.decisions.some((decision) => decision.id === "decision-custom-2"),
			getPlatformTimeout(15000),
		);
		await writeFixture(fixture, "302", "custom-2");
		await laterWrite;
	});
});

function waitForEventWithTimeout(
	store: ContentStore,
	predicate: (event: ContentStoreEvent) => boolean,
	timeout = getPlatformTimeout(),
	label = "content store event",
): Promise<ContentStoreEvent> {
	return new Promise<ContentStoreEvent>((resolve, reject) => {
		let unsubscribe = () => {};
		let settled = false;
		const timer = setTimeout(() => {
			settled = true;
			unsubscribe();
			reject(new Error(`Timed out waiting for ${label}`));
		}, timeout);

		unsubscribe = store.subscribe((event) => {
			if (settled || !predicate(event)) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			unsubscribe();
			resolve(event);
		});
		if (settled) {
			unsubscribe();
		}
	});
}

interface DeferredGate {
	started: Promise<void>;
	markStarted(): void;
	waitForRelease: Promise<void>;
	release(): void;
}

function createDeferredGate(): DeferredGate {
	let markStarted = () => {};
	let release = () => {};
	const started = new Promise<void>((resolve) => {
		markStarted = resolve;
	});
	const waitForRelease = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { started, markStarted, waitForRelease, release };
}

function rootConfig(projectName: string, backlogDirectory: string): string {
	return [
		`project_name: "${projectName}"`,
		`backlog_directory: "${backlogDirectory}"`,
		'statuses: ["To Do", "Done"]',
		"labels: []",
		"date_format: YYYY-MM-DD",
		"check_active_branches: false",
		'task_prefix: "TASK"',
		"",
	].join("\n");
}

function fixtureFilesystem(projectRoot: string, backlogDirectory: string): FileSystem {
	const fixture = new FileSystem(projectRoot);
	fixture.setBacklogDirectory(backlogDirectory);
	return fixture;
}

function makeTask(idSuffix: string, title: string): Task {
	return {
		id: `TASK-${idSuffix}`,
		title,
		status: "To Do",
		assignee: [],
		createdDate: "2025-09-19 10:00",
		labels: [],
		dependencies: [],
		rawContent: `## Description\n${title}`,
	};
}

async function writeFixture(filesystem: FileSystem, taskId: string, namespace: string): Promise<void> {
	await filesystem.ensureBacklogStructure();
	await Promise.all([
		filesystem.saveTask(makeTask(taskId, `Task ${namespace}`)),
		filesystem.saveDocument({
			id: `doc-${namespace}`,
			title: `Document ${namespace}`,
			type: "guide",
			createdDate: "2025-09-19",
			rawContent: `# Document ${namespace}`,
		}),
		filesystem.saveDecision({
			id: `decision-${namespace}`,
			title: `Decision ${namespace}`,
			date: "2025-09-19",
			status: "proposed",
			context: `Context ${namespace}`,
			decision: `Decision ${namespace}`,
			consequences: `Consequences ${namespace}`,
			rawContent: `## Context\nContext ${namespace}\n\n## Decision\nDecision ${namespace}\n\n## Consequences\nConsequences ${namespace}`,
		}),
	]);
}

async function replaceRootConfig(configPath: string, content: string): Promise<void> {
	const replacementPath = `${configPath}.replacement`;
	await Bun.write(replacementPath, content);
	await rename(replacementPath, configPath);
}

async function withTimeout<T>(promise: Promise<T>, label: string, timeout = getPlatformTimeout(15000)): Promise<T> {
	return await new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeout);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

async function waitUntil(predicate: () => boolean, label: string): Promise<void> {
	const deadline = Date.now() + getPlatformTimeout(15000);
	while (Date.now() < deadline) {
		if (predicate()) return;
		await sleep(25);
	}
	throw new Error(`Timed out waiting for ${label}`);
}
