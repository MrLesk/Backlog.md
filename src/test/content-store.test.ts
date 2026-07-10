import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rename, unlink } from "node:fs/promises";
import { join } from "node:path";
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
			);
			const rootAReturned = waitForEventWithTimeout(
				store,
				(event) => event.type === "config" && event.config.projectName === "Root A returned",
				getPlatformTimeout(15000),
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
			throw new Error("Timed out waiting for content store event");
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

async function waitUntil(predicate: () => boolean, label: string): Promise<void> {
	const deadline = Date.now() + getPlatformTimeout(15000);
	while (Date.now() < deadline) {
		if (predicate()) return;
		await sleep(25);
	}
	throw new Error(`Timed out waiting for ${label}`);
}
