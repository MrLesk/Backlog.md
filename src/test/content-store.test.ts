import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { EventEmitter } from "node:events";
import * as nodeFs from "node:fs";
import { rename, unlink } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { ContentStore, type ContentStoreEvent } from "../core/content-store.ts";
import { FileSystem } from "../file-system/operations.ts";
import type { Decision, Document, Task } from "../types/index.ts";
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

	it("keeps already-published content observations from blocking queued work", async () => {
		await Promise.all([
			filesystem.saveTask(sampleTask),
			filesystem.saveDocument(sampleDocument),
			filesystem.saveDecision(sampleDecision),
		]);
		await store.ensureInitialized();

		const published = store.getSnapshot();
		const publishedTask = published.tasks[0];
		const publishedDocument = published.documents[0];
		const publishedDecision = published.decisions[0];
		if (!publishedTask) {
			throw new Error("Expected the published task");
		}
		if (!publishedDocument) {
			throw new Error("Expected the published document");
		}
		if (!publishedDecision) {
			throw new Error("Expected the published decision");
		}

		const delays: number[] = [];
		const internals = store as unknown as {
			enqueue: (fn: () => Promise<void>) => Promise<void>;
			refreshDecisionsFromDisk: (expectedId?: string) => Promise<void>;
			refreshDocumentsFromDisk: (expectedId?: string) => Promise<void>;
			refreshTasksFromDisk: (expectedId?: string) => Promise<void>;
			startDeferredTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
			updateDecisionFromDisk: (decisionId: string) => Promise<void>;
			updateTaskFromDisk: (taskId: string) => Promise<void>;
		};
		internals.startDeferredTimer = (callback, delayMs) => {
			delays.push(delayMs);
			const timer = setTimeout(callback, 0);
			timer.unref();
			return timer;
		};

		const alreadyPublishedWork = internals.enqueue(async () => {
			await internals.updateTaskFromDisk(publishedTask.id);
			await internals.refreshTasksFromDisk(publishedTask.id);
			await internals.refreshDocumentsFromDisk(publishedDocument.id);
			await internals.updateDecisionFromDisk(publishedDecision.id);
			await internals.refreshDecisionsFromDisk(publishedDecision.id);
		});
		let followUpRan = false;
		const followUp = internals.enqueue(async () => {
			followUpRan = true;
		});
		await Promise.all([alreadyPublishedWork, followUp]);

		expect(delays).toEqual([]);
		expect(followUpRan).toBe(true);
		expect(store.getSnapshot()).toEqual(published);
	});

	it("rechecks delayed task, document, and decision writes after a single watcher event", async () => {
		store.dispose();
		await Promise.all([
			filesystem.saveTask(sampleTask),
			filesystem.saveDocument(sampleDocument),
			filesystem.saveDecision(sampleDecision),
		]);

		const callbacks = new Map<string, CapturedWatchCallback>();
		const watchSpy = spyOn(nodeFs, "watch").mockImplementation(((
			path: Parameters<typeof nodeFs.watch>[0],
			...args: unknown[]
		) => {
			const callback = args.findLast((argument) => typeof argument === "function");
			if (typeof callback !== "function") {
				throw new Error(`Expected a watcher callback for ${String(path)}`);
			}
			callbacks.set(resolve(String(path)), callback as CapturedWatchCallback);
			const watcher = new EventEmitter() as EventEmitter & { close(): void };
			watcher.close = () => {};
			return watcher as unknown as nodeFs.FSWatcher;
		}) as typeof nodeFs.watch);

		try {
			store = new ContentStore(filesystem, undefined, true);
			const initial = await store.ensureInitialized();
			const task = initial.tasks[0];
			const document = initial.documents[0];
			const decision = initial.decisions[0];
			if (!task?.filePath || !document?.path || !decision) {
				throw new Error("Expected initialized task, document, and decision paths");
			}

			const decisionFile = await findDecisionFile(filesystem.decisionsDir, decision.id);
			getCapturedWatcher(callbacks, filesystem.tasksDir)("change", basename(task.filePath));
			getCapturedWatcher(callbacks, filesystem.docsDir)("change", document.path);
			getCapturedWatcher(callbacks, filesystem.decisionsDir)("change", decisionFile);

			const internals = store as unknown as {
				chainTail: Promise<void>;
				enqueue: (fn: () => Promise<void>) => Promise<void>;
			};
			let followUpRan = false;
			await internals.enqueue(async () => {
				followUpRan = true;
			});
			expect(followUpRan).toBe(true);
			expect(store.getTasks()[0]?.status).toBe(sampleTask.status);
			expect(store.getDocuments()[0]?.type).toBe(sampleDocument.type);
			expect(store.getDecisions()[0]?.status).toBe(sampleDecision.status);

			const writer = new FileSystem(TEST_DIR);
			await Promise.all([
				writer.saveTask({ ...sampleTask, status: "In Progress" }),
				writer.saveDocument({ ...sampleDocument, type: "specification" }),
				writer.saveDecision({ ...sampleDecision, status: "accepted" }),
			]);

			await waitUntil(
				() => store.getTasks()[0]?.status === "In Progress",
				"delayed task visibility after one watcher event",
				getPlatformTimeout(1000),
			);
			await waitUntil(
				() => store.getDocuments()[0]?.type === "specification",
				"delayed document visibility after one watcher event",
				getPlatformTimeout(1000),
			);
			await waitUntil(
				() => store.getDecisions()[0]?.status === "accepted",
				"delayed decision visibility after one watcher event",
				getPlatformTimeout(1000),
			);
		} finally {
			watchSpy.mockRestore();
		}
	});

	it("cancels stale path rechecks after same-content filename-only rename reconciliation", async () => {
		store.dispose();
		await Promise.all([
			filesystem.saveTask(sampleTask),
			filesystem.saveDocument(sampleDocument),
			filesystem.saveDecision(sampleDecision),
		]);

		const callbacks = new Map<string, CapturedWatchCallback>();
		const watchSpy = spyOn(nodeFs, "watch").mockImplementation(((
			path: Parameters<typeof nodeFs.watch>[0],
			...args: unknown[]
		) => {
			const callback = args.findLast((argument) => typeof argument === "function");
			if (typeof callback !== "function") {
				throw new Error(`Expected a watcher callback for ${String(path)}`);
			}
			callbacks.set(resolve(String(path)), callback as CapturedWatchCallback);
			const watcher = new EventEmitter() as EventEmitter & { close(): void };
			watcher.close = () => {};
			return watcher as unknown as nodeFs.FSWatcher;
		}) as typeof nodeFs.watch);

		try {
			store = new ContentStore(filesystem, undefined, true);
			const initial = await store.ensureInitialized();
			const task = initial.tasks[0];
			const document = initial.documents[0];
			const decision = initial.decisions[0];
			if (!task?.filePath || !document?.path || !decision) {
				throw new Error("Expected initialized task, document, and decision paths");
			}

			const oldTaskFile = basename(task.filePath);
			const oldDocumentPath = document.path;
			const oldDecisionFile = await findDecisionFile(filesystem.decisionsDir, decision.id);
			const timerCallbacks: Array<() => void> = [];
			const internals = store as unknown as {
				chainTail: Promise<void>;
				deferredRechecks: Map<string, unknown>;
				enqueue: (fn: () => Promise<void>) => Promise<void>;
				startDeferredTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
			};
			internals.startDeferredTimer = (callback) => {
				timerCallbacks.push(callback);
				const timer = setTimeout(() => {}, 60_000);
				timer.unref();
				return timer;
			};

			getCapturedWatcher(callbacks, filesystem.tasksDir)("change", oldTaskFile);
			getCapturedWatcher(callbacks, filesystem.docsDir)("change", oldDocumentPath);
			getCapturedWatcher(callbacks, filesystem.decisionsDir)("change", oldDecisionFile);
			await internals.enqueue(async () => {});
			expect(internals.deferredRechecks.size).toBe(3);
			expect(timerCallbacks).toHaveLength(3);

			const newTaskPath = join(filesystem.tasksDir, "task-1 - Cosmetic filename.md");
			const newDocumentPath = "doc-1 - Cosmetic filename.md";
			const newDecisionFile = "decision-1 - Cosmetic filename.md";
			await Promise.all([
				rename(task.filePath, newTaskPath),
				rename(join(filesystem.docsDir, oldDocumentPath), join(filesystem.docsDir, newDocumentPath)),
				rename(join(filesystem.decisionsDir, oldDecisionFile), join(filesystem.decisionsDir, newDecisionFile)),
			]);

			getCapturedWatcher(callbacks, filesystem.tasksDir)("rename", basename(newTaskPath));
			getCapturedWatcher(callbacks, filesystem.docsDir)("rename", newDocumentPath);
			getCapturedWatcher(callbacks, filesystem.decisionsDir)("rename", newDecisionFile);
			await internals.enqueue(async () => {});

			expect(store.getTasks()[0]?.title).toBe(sampleTask.title);
			expect(store.getTasks()[0]?.filePath).toBe(newTaskPath);
			expect(store.getDocuments()[0]?.title).toBe(sampleDocument.title);
			expect(store.getDocuments()[0]?.path).toBe(newDocumentPath);
			expect(store.getDecisions()[0]?.title).toBe(sampleDecision.title);

			for (const callback of timerCallbacks) callback();
			await internals.chainTail;

			expect(store.getTasks()[0]?.title).toBe(sampleTask.title);
			expect(store.getTasks()[0]?.filePath).toBe(newTaskPath);
			expect(store.getDocuments()[0]?.title).toBe(sampleDocument.title);
			expect(store.getDocuments()[0]?.path).toBe(newDocumentPath);
			expect(store.getDecisions()[0]?.title).toBe(sampleDecision.title);
		} finally {
			watchSpy.mockRestore();
		}
	});

	it("coalesces deferred rechecks and invalidates them across root changes and disposal", async () => {
		await store.ensureInitialized();
		const timerCallbacks: Array<() => void> = [];
		const internals = store as unknown as {
			chainTail: Promise<void>;
			deferredRechecks: Map<string, unknown>;
			enqueue: (fn: () => Promise<void>) => Promise<void>;
			reconcileOrSchedule: (key: string, epoch: number, reconcile: () => Promise<boolean>) => Promise<void>;
			rootWatcherEpoch: number;
			startDeferredTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
			stopRootWatchers: () => void;
		};
		internals.startDeferredTimer = (callback) => {
			timerCallbacks.push(callback);
			const timer = setTimeout(() => {}, 60_000);
			timer.unref();
			return timer;
		};

		let oldRootReads = 0;
		const oldRootReconcile = async () => {
			oldRootReads += 1;
			return true;
		};
		await internals.enqueue(async () => {
			await internals.reconcileOrSchedule("task:TASK-1", internals.rootWatcherEpoch, oldRootReconcile);
		});
		await internals.enqueue(async () => {
			await internals.reconcileOrSchedule("task:TASK-1", internals.rootWatcherEpoch, oldRootReconcile);
		});
		let followUpRan = false;
		await internals.enqueue(async () => {
			followUpRan = true;
		});
		expect(followUpRan).toBe(true);
		expect(oldRootReads).toBe(2);
		expect(timerCallbacks).toHaveLength(1);
		expect(internals.deferredRechecks.size).toBe(1);

		internals.rootWatcherEpoch += 1;
		internals.stopRootWatchers();
		expect(internals.deferredRechecks.size).toBe(0);
		timerCallbacks[0]?.();
		await internals.chainTail;
		expect(oldRootReads).toBe(2);

		let newRootReads = 0;
		await internals.enqueue(async () => {
			await internals.reconcileOrSchedule("task:TASK-1", internals.rootWatcherEpoch, async () => {
				newRootReads += 1;
				return true;
			});
		});
		expect(newRootReads).toBe(1);
		expect(timerCallbacks).toHaveLength(2);
		expect(internals.deferredRechecks.size).toBe(1);

		store.dispose();
		expect(internals.deferredRechecks.size).toBe(0);
		timerCallbacks[1]?.();
		await Promise.resolve();
		expect(newRootReads).toBe(1);
	});

	it("retries incomplete content observations before publishing them", async () => {
		await Promise.all([
			filesystem.saveTask(sampleTask),
			filesystem.saveDocument(sampleDocument),
			filesystem.saveDecision(sampleDecision),
		]);
		await store.ensureInitialized();

		const published = store.getSnapshot();
		const publishedTask = published.tasks[0];
		const publishedDocument = published.documents[0];
		const publishedDecision = published.decisions[0];
		if (!publishedTask) {
			throw new Error("Expected the published task");
		}
		if (!publishedDocument) {
			throw new Error("Expected the published document");
		}
		if (!publishedDecision) {
			throw new Error("Expected the published decision");
		}
		const observedTaskIds: string[] = [];
		const observedDocumentIds: string[] = [];
		const observedDecisionIds: string[] = [];
		const unsubscribe = store.subscribe((event) => {
			if (event.type === "tasks") {
				observedTaskIds.push(...event.tasks.map((task) => task.id));
			}
			if (event.type === "documents") {
				observedDocumentIds.push(...event.documents.map((document) => document.id));
			}
			if (event.type === "decisions") {
				observedDecisionIds.push(...event.decisions.map((decision) => decision.id));
			}
		});

		const delays: number[] = [];
		const internals = store as unknown as {
			enqueue: (fn: () => Promise<void>) => Promise<void>;
			loadTasksWithLoader: () => Promise<Task[]>;
			refreshDecisionsFromDisk: (expectedId?: string) => Promise<void>;
			refreshDocumentsFromDisk: (expectedId?: string) => Promise<void>;
			refreshTasksFromDisk: (expectedId?: string) => Promise<void>;
			startDeferredTimer: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
			updateDecisionFromDisk: (decisionId: string) => Promise<void>;
			updateTaskFromDisk: (taskId: string) => Promise<void>;
		};
		internals.startDeferredTimer = (callback, delayMs) => {
			delays.push(delayMs);
			const timer = setTimeout(callback, 0);
			timer.unref();
			return timer;
		};

		const loadTask = filesystem.loadTask.bind(filesystem);
		let targetedReads = 0;
		filesystem.loadTask = async () => {
			targetedReads += 1;
			if (targetedReads === 1) {
				return { ...publishedTask, id: "TASK-999", title: "Foreign task" };
			}
			return targetedReads === 2 ? null : { ...publishedTask, title: "Targeted retry" };
		};
		try {
			await internals.enqueue(async () => {
				await internals.updateTaskFromDisk(publishedTask.id);
			});
			let followUpRan = false;
			await internals.enqueue(async () => {
				followUpRan = true;
			});
			expect(followUpRan).toBe(true);
			await waitUntil(() => targetedReads === 3, "targeted task retries", getPlatformTimeout(1000));
		} finally {
			filesystem.loadTask = loadTask;
		}

		let collectionReads = 0;
		internals.loadTasksWithLoader = async () => {
			collectionReads += 1;
			if (collectionReads === 1) {
				return [{ ...publishedTask, id: "TASK-998", title: "Foreign task collection" }];
			}
			return collectionReads === 2 ? [] : [{ ...publishedTask, title: "Collection retry" }];
		};
		await internals.refreshTasksFromDisk(publishedTask.id);
		await waitUntil(() => collectionReads === 3, "task collection retries", getPlatformTimeout(1000));

		const listDocuments = filesystem.listDocuments.bind(filesystem);
		let documentReads = 0;
		filesystem.listDocuments = async () => {
			documentReads += 1;
			if (documentReads === 1) {
				return [{ ...publishedDocument, id: "doc-999", title: "Foreign document" }];
			}
			return documentReads === 2 ? [] : [{ ...publishedDocument, title: "Document retry" }];
		};
		try {
			await internals.refreshDocumentsFromDisk(publishedDocument.id);
			await waitUntil(() => documentReads === 3, "document collection retries", getPlatformTimeout(1000));
		} finally {
			filesystem.listDocuments = listDocuments;
		}

		const loadDecision = filesystem.loadDecision.bind(filesystem);
		let targetedDecisionReads = 0;
		filesystem.loadDecision = async () => {
			targetedDecisionReads += 1;
			if (targetedDecisionReads === 1) {
				return { ...publishedDecision, id: "decision-999", title: "Foreign decision" };
			}
			return targetedDecisionReads === 2 ? null : { ...publishedDecision, title: "Targeted decision retry" };
		};
		try {
			await internals.updateDecisionFromDisk(publishedDecision.id);
			await waitUntil(() => targetedDecisionReads === 3, "targeted decision retries", getPlatformTimeout(1000));
		} finally {
			filesystem.loadDecision = loadDecision;
		}

		const listDecisions = filesystem.listDecisions.bind(filesystem);
		let decisionCollectionReads = 0;
		filesystem.listDecisions = async () => {
			decisionCollectionReads += 1;
			if (decisionCollectionReads === 1) {
				return [{ ...publishedDecision, id: "decision-998", title: "Foreign decision collection" }];
			}
			return decisionCollectionReads === 2 ? [] : [{ ...publishedDecision, title: "Decision collection retry" }];
		};
		try {
			await internals.refreshDecisionsFromDisk(publishedDecision.id);
			await waitUntil(() => decisionCollectionReads === 3, "decision collection retries", getPlatformTimeout(1000));
		} finally {
			filesystem.listDecisions = listDecisions;
		}
		unsubscribe();

		expect(targetedReads).toBe(3);
		expect(collectionReads).toBe(3);
		expect(documentReads).toBe(3);
		expect(targetedDecisionReads).toBe(3);
		expect(decisionCollectionReads).toBe(3);
		expect(delays).toEqual([75, 150, 75, 150, 75, 150, 75, 150, 75, 150]);
		expect(observedTaskIds).not.toContain("TASK-999");
		expect(observedTaskIds).not.toContain("TASK-998");
		expect(observedDocumentIds).not.toContain("doc-999");
		expect(observedDecisionIds).not.toContain("decision-999");
		expect(observedDecisionIds).not.toContain("decision-998");
		expect(store.getTasks()[0]?.title).toBe("Collection retry");
		expect(store.getDocuments()[0]?.title).toBe("Document retry");
		expect(store.getDecisions()[0]?.title).toBe("Decision collection retry");
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

	it("removes tasks, documents, and decisions when files are deleted", async () => {
		store.dispose();
		store = new ContentStore(filesystem, undefined, true);
		await Promise.all([
			filesystem.saveTask(sampleTask),
			filesystem.saveDocument(sampleDocument),
			filesystem.saveDecision(sampleDecision),
		]);
		await store.ensureInitialized();

		const task = store.getTasks()[0];
		const document = store.getDocuments()[0];
		if (!task?.filePath) {
			throw new Error("Expected the task file path");
		}
		if (!document?.path) {
			throw new Error("Expected the document path");
		}

		const decisionsDir = filesystem.decisionsDir;
		const decisionFiles: string[] = [];
		for await (const file of new Bun.Glob("decision-*.md").scan({ cwd: decisionsDir, followSymlinks: true })) {
			decisionFiles.push(file);
		}
		const decisionFile = decisionFiles.find((file) => file.startsWith("decision-1"));
		if (!decisionFile) {
			throw new Error("Expected decision file was not created");
		}

		const waitForTaskRemoval = waitForEventWithTimeout(
			store,
			(event) => event.snapshot.tasks.every((item) => item.id !== task.id),
			getPlatformTimeout(15000),
		);
		await unlink(task.filePath);
		await waitForTaskRemoval;

		const waitForDocumentRemoval = waitForEventWithTimeout(
			store,
			(event) => event.snapshot.documents.every((item) => item.id !== document.id),
			getPlatformTimeout(15000),
		);
		await unlink(join(filesystem.docsDir, ...document.path.split("/")));
		await waitForDocumentRemoval;

		const waitForDecisionRemoval = waitForEventWithTimeout(
			store,
			(event) => event.snapshot.decisions.every((item) => item.id !== "decision-1"),
			getPlatformTimeout(15000),
		);
		await unlink(join(decisionsDir, decisionFile));
		await waitForDecisionRemoval;

		expect(store.getTasks().some((item) => item.id === task.id)).toBe(false);
		expect(store.getDocuments().some((item) => item.id === document.id)).toBe(false);
		expect(store.getDecisions().some((item) => item.id === "decision-1")).toBe(false);
	});

	it("publishes coherent A to B to A snapshots and rebinds every root watcher", async () => {
		store.dispose();
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
			await withTimeout(heldOldLoad.started, "old-root task refresh");

			const rootBPublished = waitForEventWithTimeout(
				store,
				(event) => event.type === "config" && event.config.projectName === "Root B",
				getPlatformTimeout(15000),
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
			await heldOldRefresh;
			await withTimeout(heldBLoad.started, "root B snapshot load");

			const rootBLaterWrites = waitForEventWithTimeout(
				store,
				(event) =>
					event.snapshot.tasks.some((task) => task.id === "TASK-202") &&
					event.snapshot.documents.some((document) => document.id === "doc-b-2") &&
					event.snapshot.decisions.some((decision) => decision.id === "decision-b-2"),
				getPlatformTimeout(15000),
				"root B content writes",
			);
			await writeFixture(fixtureB, "202", "b-2");
			heldBLoad.release();

			const rootBEvent = await rootBPublished;
			await rootBLaterWrites;
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
				getPlatformTimeout(15000),
				"held root B config publication",
			);
			const rootAReturned = waitForEventWithTimeout(
				store,
				(event) => event.type === "config" && event.config.projectName === "Root A returned",
				getPlatformTimeout(15000),
				"root A return publication",
			);
			await replaceRootConfig(configPath, rootConfig("Root B held", rootB));
			await withTimeout(heldBConfigLoad.started, "held root B config load");
			await replaceRootConfig(configPath, rootConfig("Root A returned", rootA));
			await sleep(getPlatformTimeout(150));
			heldBConfigLoad.release();

			await heldBPublished;
			const rootAEvent = await rootAReturned;
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
				getPlatformTimeout(15000),
				"root A content writes",
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
				getPlatformTimeout(15000),
				"restarted root A content writes",
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
	const eventPromise = new Promise<ContentStoreEvent>((resolve) => {
		const unsubscribe = store.subscribe((event) => {
			if (!predicate(event)) {
				return;
			}
			unsubscribe();
			resolve(event);
		});
	});

	return Promise.race([
		eventPromise,
		sleep(timeout).then(() => {
			throw new Error(`Timed out waiting for ${label}`);
		}),
	]);
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

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
	return await Promise.race([
		promise,
		sleep(getPlatformTimeout(15000)).then(() => {
			throw new Error(`Timed out waiting for ${label}`);
		}),
	]);
}

type CapturedWatchCallback = (eventType: string, filename: string | Buffer | null) => void;

function getCapturedWatcher(callbacks: Map<string, CapturedWatchCallback>, path: string): CapturedWatchCallback {
	const callback = callbacks.get(resolve(path));
	if (!callback) {
		throw new Error(`Expected captured watcher for ${path}`);
	}
	return callback;
}

async function findDecisionFile(decisionsDir: string, decisionId: string): Promise<string> {
	for await (const file of new Bun.Glob(`${decisionId}*.md`).scan({ cwd: decisionsDir, followSymlinks: true })) {
		return file;
	}
	throw new Error(`Expected decision file for ${decisionId}`);
}

async function waitUntil(predicate: () => boolean, label: string, timeout = getPlatformTimeout(15000)): Promise<void> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await sleep(25);
	}
	throw new Error(`Timed out waiting for ${label}`);
}
