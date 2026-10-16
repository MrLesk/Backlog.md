import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { loadTaskDetail } from "../core/task-detail.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { taskIdsEqual } from "../utils/task-id.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

/**
 * Demoting hands a task ID back to the allocator. A reference left behind stops meaning what it
 * said the moment the next created task is given that ID: it resolves to an unrelated task instead
 * of failing closed. Archiving is the deliberate contrast - an archived task keeps its ID, so the
 * references to it are left exactly as they are.
 */
describe("references to an archived or vacated task ID", () => {
	const cliPath = getTestCliPath();
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-vacated-references");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Vacated References Project");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	const loadArchived = async (taskId: string) =>
		(await core.filesystem.listArchivedTasks()).find((task) => taskIdsEqual(task.id, taskId));

	/**
	 * Run `interleave` once, at the exact moment the operation asks for its task locks. The cleanup
	 * set is scanned before that call, so this reproduces the window between the scan and the locks
	 * without sleeping on or racing against anything.
	 */
	const interleaveAtLockAcquisition = (interleave: () => Promise<void>) => {
		const filesystem = core.filesystem;
		const original = filesystem.withTaskLocks.bind(filesystem);
		let injected = false;
		filesystem.withTaskLocks = async (tasks, run) => {
			if (!injected) {
				injected = true;
				await interleave();
			}
			return await original(tasks, run);
		};
		return () => {
			filesystem.withTaskLocks = original;
		};
	};

	/** What the dependency graph actually resolves the stored references to. */
	const dependencyTitles = async (task: Task | undefined | null) => {
		if (!task) return null;
		const detail = await loadTaskDetail(core, task);
		return detail.dependencyGraph.nodes
			.filter((node) => node.dependencyDepth === 1)
			.map((node) => `${node.id} - ${node.title ?? node.state}`);
	};

	it.each(["Done", "Closed"])(
		"archives %s work without changing any other record, and its dependents become ready",
		async (status) => {
			const config = await core.filesystem.loadConfig();
			if (!config) throw new Error("Missing test config");
			await core.filesystem.saveConfig({ ...config, statuses: ["To Do", "In Progress", status] });
			const { task: target } = await core.createTaskFromInput({ title: "Finished work", status });
			const { task: active } = await core.createTaskFromInput({
				title: "Active dependent",
				dependencies: [target.id],
				references: [target.id],
			});
			const { task: archivedDependent } = await core.createTaskFromInput({
				title: "Archived dependent",
				status,
				dependencies: [target.id],
				references: [target.id],
			});
			expect(await core.archiveTask(archivedDependent.id, false)).toBe(true);
			const paths = [active.filePath, (await loadArchived(archivedDependent.id))?.filePath];
			const before = await Promise.all(paths.map((path) => Bun.file(path as string).text()));

			expect(await core.archiveTask(target.id, false)).toBe(true);

			expect(await Promise.all(paths.map((path) => Bun.file(path as string).text()))).toEqual(before);
			expect((await loadArchived(target.id))?.status).toBe(status);
			const dependent = await core.filesystem.loadTask(active.id);
			expect(await dependencyTitles(dependent)).toEqual([`${target.id} - Finished work`]);
			expect(await dependencyTitles(await loadArchived(archivedDependent.id))).toEqual([
				`${target.id} - Finished work`,
			]);
			expect((await loadTaskDetail(core, dependent as Task)).readiness).toMatchObject({
				isReady: true,
				isBlocked: false,
			});
		},
	);

	it("archives unfinished work without rewriting its dependents, which stay blocked", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Set aside" });
		const { task: dependent } = await core.createTaskFromInput({
			title: "Dependent",
			dependencies: [target.id],
			references: [target.id],
		});
		const before = await Bun.file(dependent.filePath as string).text();

		expect(await core.archiveTask(target.id, false)).toBe(true);

		expect(await Bun.file(dependent.filePath as string).text()).toBe(before);
		const unchanged = await core.filesystem.loadTask(dependent.id);
		expect(await dependencyTitles(unchanged)).toEqual([`${target.id} - Set aside`]);
		// Archived is not the same as finished: only the final status satisfies a dependency.
		expect((await loadTaskDetail(core, unchanged as Task)).readiness).toMatchObject({
			isReady: false,
			blockingDependencies: [target.id],
			missingDependencies: [],
		});
	});

	it("does not hand an archived ID to the next created task", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		// The target holds the highest ID, the one allocation would reissue if archiving released it.
		expect(await core.archiveTask(target.id, false)).toBe(true);
		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });

		expect(taskIdsEqual(unrelated.id, target.id)).toBe(false);
		expect(await dependencyTitles(await core.filesystem.loadTask(dependent.id))).toEqual([
			`${target.id} - Archive target`,
		]);
	});

	it("archives the record a concurrent edit left behind", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Finishing work" });
		const editor = new Core(testDir);
		const filesystem = core.filesystem;
		const originalWithTaskLock = filesystem.withTaskLock.bind(filesystem);
		let edited = false;
		filesystem.withTaskLock = async (task, run) => {
			if (!edited) {
				edited = true;
				await editor.updateTaskFromInput(target.id, { status: "Done" }, false);
			}
			return await originalWithTaskLock(task, run);
		};

		try {
			expect(await core.archiveTask(target.id, false)).toBe(true);
		} finally {
			filesystem.withTaskLock = originalWithTaskLock;
		}

		expect((await loadArchived(target.id))?.status).toBe("Done");
	});

	it("reports an archive whose commit failed as already moved", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		core.shouldAutoCommit = async () => true;
		core.gitOps.stageFileMove = async () => {
			throw new Error("index is locked");
		};

		let failure: unknown;
		try {
			await core.archiveTask(target.id, true);
		} catch (error) {
			failure = error;
		}

		// The task is in the archive, so the caller must not be told to try again.
		expect((failure as { archiveState?: string } | undefined)?.archiveState).toBe("moved");
		expect(await core.filesystem.loadTask(target.id)).toBeNull();
		expect(await Bun.file(join(core.filesystem.archiveTasksDir, basename(target.filePath ?? ""))).exists()).toBe(true);
	});

	it("does not let a demoted ID rebind an active dependent to the next created task", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Active dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		const demotion = await core.demoteTask(target.id, false);
		expect(demotion.success).toBe(true);
		expect(demotion.cleanedTaskIds).toEqual([dependent.id]);

		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });
		expect(taskIdsEqual(unrelated.id, target.id)).toBe(true);

		// The reference is removed, not rewritten to the draft the record became.
		const drafts = await core.filesystem.listDrafts();
		expect(drafts).toHaveLength(1);
		const updatedDependent = await core.filesystem.loadTask(dependent.id);
		expect(updatedDependent?.dependencies ?? []).toEqual([]);
		expect(await dependencyTitles(updatedDependent)).toEqual([]);
	});

	it("cleans references when an edit demotes a task into the Draft status", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent of edited task" });
		const { task: target } = await core.createTaskFromInput({ title: "Edited into a draft" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id], references: [target.id] }, false);

		const { task: demoted } = await core.editTaskOrDraft(target.id, { status: "Draft" }, false);
		expect(demoted.id.startsWith("DRAFT-")).toBe(true);

		const updatedDependent = await core.filesystem.loadTask(dependent.id);
		expect(updatedDependent?.dependencies ?? []).toEqual([]);
		expect(updatedDependent?.references ?? []).toEqual([]);
	});

	it.each(["demote", "edit"])(
		"cleans late-created task and draft links when %s acquires the allocator",
		async (operation) => {
			const { task: anchor } = await core.createTaskFromInput({ title: "Stable parent" }, false);
			const { task: target } = await core.createTaskFromInput({ title: "Vacated target" }, false);
			const creator = new Core(testDir);
			const original = core.filesystem.withCreateLock.bind(core.filesystem);
			let created = false;
			core.filesystem.withCreateLock = async (run, options) => {
				if (!created) {
					created = true;
					await creator.createTaskFromInput(
						{
							title: "Late task",
							parentTaskId: anchor.id,
							dependencies: [target.id],
							references: [target.id],
						},
						false,
					);
					await creator.createTaskFromInput(
						{
							title: "Late draft",
							status: "Draft",
							dependencies: [target.id],
							references: [target.id],
						},
						false,
					);
				}
				return await original(run, options);
			};

			try {
				const result =
					operation === "demote"
						? await core.demoteTask(target.id, false)
						: await core.editTaskOrDraft(target.id, { status: "Draft", labels: ["edited"] }, false);
				expect(result.cleanedTaskIds).toEqual([`${anchor.id}.1`, "DRAFT-1"]);
			} finally {
				core.filesystem.withCreateLock = original;
				await creator.disposeContentStore();
			}

			expect((await core.createTaskFromInput({ title: "Unrelated replacement" }, false)).task.id).toBe(target.id);
			const lateTask = await core.filesystem.loadTask(`${anchor.id}.1`);
			expect(lateTask?.dependencies ?? []).toEqual([]);
			expect(lateTask?.references ?? []).toEqual([]);
			expect(await dependencyTitles(lateTask)).toEqual([]);
			const drafts = await core.filesystem.listDrafts();
			expect(drafts.map((draft) => draft.id)).toEqual(["DRAFT-1", "DRAFT-2"]);
			expect(drafts[0]?.dependencies ?? []).toEqual([]);
			expect(drafts[0]?.references ?? []).toEqual([]);
			if (operation === "edit") expect(drafts[1]?.labels).toEqual(["edited"]);
		},
	);

	it("removes demoted references from the archived corpus and the working copy alike", async () => {
		const { task: activeDependent } = await core.createTaskFromInput({ title: "Active dependent" });
		const { task: archivedDependent } = await core.createTaskFromInput({ title: "Archived dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		await core.updateTaskFromInput(activeDependent.id, { dependencies: [target.id] }, false);
		await core.updateTaskFromInput(archivedDependent.id, { references: [target.id] }, false);
		expect(await core.archiveTask(archivedDependent.id, false)).toBe(true);

		const demotion = await core.demoteTask(target.id, false);
		expect(demotion.success).toBe(true);
		expect(demotion.cleanedTaskIds).toEqual([activeDependent.id, archivedDependent.id]);

		expect((await core.filesystem.loadTask(activeDependent.id))?.dependencies ?? []).toEqual([]);
		expect((await loadArchived(archivedDependent.id))?.references ?? []).toEqual([]);
	});

	it("keeps an edit made between the cleanup scan and the locks", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		const editor = new Core(testDir);
		const restore = interleaveAtLockAcquisition(async () => {
			await editor.updateTaskFromInput(dependent.id, { title: "Renamed while demoting" }, false);
		});

		try {
			const demotion = await core.demoteTask(target.id, false);
			expect(demotion.success).toBe(true);
			expect(demotion.cleanedTaskIds).toEqual([dependent.id]);
		} finally {
			restore();
		}

		// A snapshot taken before the locks would have rewritten the file from pre-edit content.
		const updated = await core.filesystem.loadTask(dependent.id);
		expect(updated?.title).toBe("Renamed while demoting");
		expect(updated?.dependencies ?? []).toEqual([]);
	});

	it("cleans a dependent that starts referencing the ID between the scan and the locks", async () => {
		const { task: late } = await core.createTaskFromInput({ title: "Late dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });

		const editor = new Core(testDir);
		const restore = interleaveAtLockAcquisition(async () => {
			await editor.updateTaskFromInput(late.id, { dependencies: [target.id] }, false);
		});

		try {
			const demotion = await core.demoteTask(target.id, false);
			expect(demotion.success).toBe(true);
			expect(demotion.cleanedTaskIds).toEqual([late.id]);
		} finally {
			restore();
		}

		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });
		expect(taskIdsEqual(unrelated.id, target.id)).toBe(true);

		const updated = await core.filesystem.loadTask(late.id);
		expect(updated?.dependencies ?? []).toEqual([]);
		expect(await dependencyTitles(updated)).toEqual([]);
	});

	describe("drafts that link to the vacated ID", () => {
		/** DRAFT-1, written to disk the way a draft is saved, with the links it is given. */
		const saveDraft = async (links: string[]) => {
			const path = await core.filesystem.saveDraft({
				id: "draft-1",
				title: "Linked draft",
				status: "Draft",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: links,
				references: links,
			});
			return await core.filesystem.draftReferenceFromPath(path);
		};
		const draftLinks = async () => {
			const draft = await core.filesystem.loadDraft("draft-1");
			return { dependencies: draft?.dependencies ?? [], references: draft?.references ?? [] };
		};

		it("keeps a draft edit made between the cleanup scan and the locks", async () => {
			const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
			const draft = await saveDraft([target.id]);

			const editor = new Core(testDir);
			const restore = interleaveAtLockAcquisition(async () => {
				await editor.updateDraftFromInput(draft, { labels: ["edited-while-demoting"] }, false);
			});

			try {
				const demotion = await core.demoteTask(target.id, false);
				expect(demotion.success).toBe(true);
				expect(demotion.cleanedTaskIds).toEqual(["DRAFT-1"]);
			} finally {
				restore();
			}

			// A snapshot taken before the locks would have rewritten the file from pre-edit content.
			expect((await core.filesystem.loadDraft("draft-1"))?.labels).toEqual(["edited-while-demoting"]);
			expect(await draftLinks()).toEqual({ dependencies: [], references: [] });
			// The draft is still one file, next to the draft the demoted task became.
			expect((await core.filesystem.listDrafts()).map((listed) => listed.id)).toEqual(["DRAFT-1", "DRAFT-2"]);
		});

		it("cleans a draft that starts linking to the ID between the scan and the locks", async () => {
			const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
			const draft = await saveDraft([]);

			const editor = new Core(testDir);
			const restore = interleaveAtLockAcquisition(async () => {
				await editor.updateDraftFromInput(draft, { dependencies: [target.id], references: [target.id] }, false);
			});

			try {
				const demotion = await core.demoteTask(target.id, false);
				expect(demotion.cleanedTaskIds).toEqual(["DRAFT-1"]);
			} finally {
				restore();
			}

			expect(await draftLinks()).toEqual({ dependencies: [], references: [] });
		});

		it("fails and changes nothing when a linked draft is renamed between the scan and the locks", async () => {
			const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
			const draft = await saveDraft([target.id]);

			// A new title gives the draft file a new name, so the file that was scanned is gone.
			const editor = new Core(testDir);
			const restore = interleaveAtLockAcquisition(async () => {
				await editor.updateDraftFromInput(draft, { title: "Renamed while demoting" }, false);
			});

			try {
				await expect(core.demoteTask(target.id, false)).rejects.toThrow(
					"DRAFT-1 was moved or removed by another process",
				);
			} finally {
				restore();
			}

			expect((await core.filesystem.loadTask(target.id))?.title).toBe("Demote target");
			expect(await draftLinks()).toEqual({ dependencies: [target.id], references: [target.id] });
			// Running the demotion again finds the draft under its new name.
			expect((await core.demoteTask(target.id, false)).cleanedTaskIds).toEqual(["DRAFT-1"]);
			expect(await draftLinks()).toEqual({ dependencies: [], references: [] });
		});

		it("fails and changes nothing while a draft that links to the task is being edited", async () => {
			const { task: target } = await core.createTaskFromInput({ title: "Delete target" });
			const draft = await saveDraft([target.id]);
			expect(await core.archiveTask(target.id, false)).toBe(true);
			const before = await Bun.file(draft.filePath).text();

			// Another editor holds the draft's lock, as a draft edit does for its read-modify-write.
			await core.filesystem.withDraftLock(draft, async () => {
				await expect(core.deleteTask(target.id, false)).rejects.toThrow("DRAFT-1 is being modified by another process");
			});

			expect(await loadArchived(target.id)).toBeDefined();
			expect(await Bun.file(draft.filePath).text()).toBe(before);
		});

		it("leaves a draft alone when another file claims its ID, and the delete still succeeds", async () => {
			const { task: target } = await core.createTaskFromInput({ title: "Delete target" });
			const draft = await saveDraft([target.id]);
			const twinPath = join(dirname(draft.filePath), "draft-01 - Twin.md");
			await Bun.write(twinPath, (await Bun.file(draft.filePath).text()).replace("Linked draft", "Twin"));
			expect(await core.archiveTask(target.id, false)).toBe(true);
			const before = [await Bun.file(draft.filePath).text(), await Bun.file(twinPath).text()];

			// A draft edit refuses an ID that two files claim, and so does the cleanup: neither is rewritten.
			expect(await core.deleteTask(target.id, false)).toEqual({ success: true, cleanedTaskIds: [] });

			expect([await Bun.file(draft.filePath).text(), await Bun.file(twinPath).text()]).toEqual(before);
		});
	});

	it("reports a demotion whose cleanup write failed as already moved", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		const filesystem = core.filesystem;
		const originalSaveTask = filesystem.saveTask.bind(filesystem);
		filesystem.saveTask = async (task) => {
			if (taskIdsEqual(task.id, dependent.id)) {
				throw new Error("dependent file is not writable");
			}
			return await originalSaveTask(task);
		};

		let failure: unknown;
		try {
			await core.demoteTask(target.id, false);
		} catch (error) {
			failure = error;
		} finally {
			filesystem.saveTask = originalSaveTask;
		}

		// The record is already a draft, so the caller must not be told the demotion did not happen.
		expect((failure as { demotionState?: string } | undefined)?.demotionState).toBe("moved");
		expect((failure as { demotionFailureCause?: string } | undefined)?.demotionFailureCause).toBe("cleanup");
		expect(await core.filesystem.loadTask(target.id)).toBeNull();
		expect(await core.filesystem.listDrafts()).toHaveLength(1);
	});

	it("serves the cleaned records from the content store as soon as the demotion returns", async () => {
		const { task: activeDependent } = await core.createTaskFromInput({ title: "Active dependent" });
		const { task: archivedDependent } = await core.createTaskFromInput({ title: "Archived dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		await core.updateTaskFromInput(activeDependent.id, { dependencies: [target.id] }, false);
		await core.updateTaskFromInput(archivedDependent.id, { dependencies: [target.id] }, false);
		expect(await core.archiveTask(archivedDependent.id, false)).toBe(true);

		const store = await core.getContentStore();
		expect(store.getTasks().find((task) => taskIdsEqual(task.id, activeDependent.id))?.dependencies).toEqual([
			target.id,
		]);

		expect((await core.demoteTask(target.id, false)).success).toBe(true);

		// A reader served from the store must not still see the reference the demotion removed.
		expect(store.getTasks().find((task) => taskIdsEqual(task.id, activeDependent.id))?.dependencies ?? []).toEqual([]);
		const snapshot = store.getTaskCorpusSnapshot();
		expect(snapshot.archivedTasks.find((task) => taskIdsEqual(task.id, archivedDependent.id))?.dependencies).toEqual(
			[],
		);
		// Rewriting the archived file must not republish it as an active task.
		expect(store.getTasks().some((task) => taskIdsEqual(task.id, archivedDependent.id))).toBe(false);
	});

	it("removes the vacated ID from the demoted record's own references", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Self-referencing target" });
		await core.updateTaskFromInput(target.id, { references: [target.id, "docs/notes.md"] }, false);

		expect((await core.demoteTask(target.id, false)).success).toBe(true);

		const drafts = await core.filesystem.listDrafts();
		expect(drafts).toHaveLength(1);
		expect(drafts[0]?.references ?? []).toEqual(["docs/notes.md"]);

		// The freed ID goes to the next task, which the draft must not have started naming.
		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });
		expect(taskIdsEqual(unrelated.id, target.id)).toBe(true);
	});

	it("removes the vacated ID from a record demoted by an edit into the Draft status", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Self-referencing target" });
		await core.updateTaskFromInput(target.id, { references: [target.id, "docs/notes.md"] }, false);

		const { task: demoted } = await core.editTaskOrDraft(target.id, { status: "Draft" }, false);
		expect(demoted.id.startsWith("DRAFT-")).toBe(true);
		expect(demoted.references ?? []).toEqual(["docs/notes.md"]);
	});

	it("cleans a zero-padded reference and does not let it rebind to the reissued ID", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Padded reference holder" });
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		// One identity, spelled with padding. Everything else in the product treats TASK-01 and
		// TASK-1 as the same task, so the cleanup has to as well.
		const paddedSpelling = target.id.replace(/(\d+)$/, (digits) => `0${digits}`);
		await core.updateTaskFromInput(dependent.id, { references: [paddedSpelling] }, false);
		expect((await core.filesystem.loadTask(dependent.id))?.references).toEqual([paddedSpelling]);

		const demotion = await core.demoteTask(target.id, false);
		expect(demotion.success).toBe(true);
		expect(demotion.cleanedTaskIds).toEqual([dependent.id]);

		// The freed ID goes to the next task created, which the padded reference must not name.
		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });
		expect(taskIdsEqual(unrelated.id, target.id)).toBe(true);

		const updated = await core.filesystem.loadTask(dependent.id);
		expect(updated?.references ?? []).toEqual([]);
		expect((updated?.references ?? []).some((reference) => taskIdsEqual(reference, unrelated.id))).toBe(false);
	});

	it("leaves a contested identity contested when it cleans an archived record", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		const { task: archivedDependent } = await core.createTaskFromInput({ title: "Archived dependent" });
		await core.updateTaskFromInput(archivedDependent.id, { dependencies: [target.id] }, false);
		expect(await core.archiveTask(archivedDependent.id, false)).toBe(true);

		// A second file claims the archived record's identity from the active corpus: the conflict
		// `backlog doctor` exists to surface, which an unrelated cleanup must not dissolve.
		const duplicatePath = join(core.filesystem.tasksDir, "task-02 - Active duplicate.md");
		await Bun.write(
			duplicatePath,
			serializeTask({ ...archivedDependent, id: "TASK-02", title: "Active duplicate", dependencies: [] }),
		);

		// The store was initialized before that file existed, so give it the corpus that holds both
		// claimants rather than asserting against a snapshot that never saw the conflict.
		const store = await core.getContentStore();
		await store.refreshTasks();
		expect(store.getTaskCorpusSnapshot().activeTasks.some((task) => task.filePath === duplicatePath)).toBe(true);

		expect((await core.demoteTask(target.id, false)).success).toBe(true);

		const snapshot = store.getTaskCorpusSnapshot();
		expect(
			snapshot.activeTasks.filter((task) => taskIdsEqual(task.id, archivedDependent.id)).map((t) => t.filePath),
		).toEqual([duplicatePath]);
		// ...and the archived record was still cleaned.
		expect(
			snapshot.archivedTasks.find((task) => taskIdsEqual(task.id, archivedDependent.id))?.dependencies ?? [],
		).toEqual([]);
	});

	it("cleans a dependent whose identity is contested by an archived record", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Demote target" });
		const { task: dependent } = await core.createTaskFromInput({ title: "Active dependent" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		// An archived record claims the dependent's identity, so resolving it by ID is ambiguous.
		// The cleanup already chose the file, so it must write that file rather than ask again.
		const archivedPath = join(core.filesystem.archiveTasksDir, "task-02 - Archived collision.md");
		await Bun.write(
			archivedPath,
			serializeTask({ ...dependent, id: "TASK-02", title: "Archived collision", dependencies: [] }),
		);

		const demotion = await core.demoteTask(target.id, false);
		expect(demotion.success).toBe(true);
		expect(demotion.cleanedTaskIds).toEqual([dependent.id]);

		const updated = await core.filesystem.listTasks();
		expect(updated.find((task) => task.filePath === dependent.filePath)?.dependencies ?? []).toEqual([]);
	});

	it("reports an edit into the Draft status whose cleanup write failed as already moved", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Edited into a draft" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		const filesystem = core.filesystem;
		const originalSaveTask = filesystem.saveTask.bind(filesystem);
		filesystem.saveTask = async (task) => {
			if (taskIdsEqual(task.id, dependent.id)) {
				throw new Error("dependent file is not writable");
			}
			return await originalSaveTask(task);
		};

		let failure: unknown;
		try {
			await core.editTaskOrDraft(target.id, { status: "Draft" }, false);
		} catch (error) {
			failure = error;
		} finally {
			filesystem.saveTask = originalSaveTask;
		}

		expect((failure as { demotionState?: string } | undefined)?.demotionState).toBe("moved");
		expect((failure as { demotionFailureCause?: string } | undefined)?.demotionFailureCause).toBe("cleanup");
		expect(await core.filesystem.loadTask(target.id)).toBeNull();
		expect(await core.filesystem.listDrafts()).toHaveLength(1);
	});

	it("reports the cleaned tasks from the demote command, and archive changes none", async () => {
		await $`bun ${cliPath} task create "Dependent one"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task create "Dependent two"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task create "Shared target"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task edit TASK-1 --dep TASK-3`.cwd(testDir).quiet();
		await $`bun ${cliPath} task edit TASK-2 --dep TASK-3`.cwd(testDir).quiet();

		const archived = await $`bun ${cliPath} task archive TASK-3`.cwd(testDir).quiet();
		expect(archived.exitCode).toBe(0);
		expect(archived.stdout.toString()).toContain("Archived task TASK-3");
		expect(archived.stdout.toString()).not.toContain("Removed references");
		expect((await core.filesystem.loadTask("TASK-1"))?.dependencies).toEqual(["TASK-3"]);
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual(["TASK-3"]);

		await $`bun ${cliPath} task edit TASK-2 --dep TASK-1`.cwd(testDir).quiet();
		const demoted = await $`bun ${cliPath} task demote TASK-1`.cwd(testDir).quiet();
		expect(demoted.exitCode).toBe(0);
		expect(demoted.stdout.toString()).toContain("Demoted task TASK-1");
		expect(demoted.stdout.toString()).toContain("Removed references to TASK-1 from TASK-2");
	});
});
