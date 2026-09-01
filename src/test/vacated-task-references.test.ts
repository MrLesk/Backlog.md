import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { loadTaskDetail } from "../core/task-detail.ts";
import { isTaskLockError } from "../file-system/operations.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { taskIdsEqual } from "../utils/task-id.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

/**
 * Archiving and demoting both hand a task ID back to the allocator. A reference left behind stops
 * meaning what it said the moment the next created task is given that ID: it resolves to an
 * unrelated task instead of failing closed. Completion is the deliberate exception - a completed
 * dependency is exactly what readiness reads.
 */
describe("references to a vacated task ID", () => {
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

	const loadCompleted = async (taskId: string) =>
		(await core.filesystem.listCompletedTasks()).find((task) => taskIdsEqual(task.id, taskId));

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

	it("does not let an archived ID rebind a completed dependent to the next created task", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Completed dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);
		expect(await core.completeTask(dependent.id, false)).toBe(true);

		const archived = await core.archiveTask(target.id, false);
		expect(archived.success).toBe(true);
		expect(archived.cleanedTaskIds).toEqual([dependent.id]);

		// The archived ID is free again, so the next task is allocated exactly the vacated slot.
		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });
		expect(taskIdsEqual(unrelated.id, target.id)).toBe(true);

		const completedDependent = await loadCompleted(dependent.id);
		expect(completedDependent?.dependencies ?? []).toEqual([]);
		expect(await dependencyTitles(completedDependent)).toEqual([]);
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

	it("removes archived references from the completed corpus and the working copy alike", async () => {
		const { task: activeDependent } = await core.createTaskFromInput({ title: "Active dependent" });
		const { task: completedDependent } = await core.createTaskFromInput({ title: "Completed dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		await core.updateTaskFromInput(activeDependent.id, { dependencies: [target.id] }, false);
		await core.updateTaskFromInput(completedDependent.id, { references: [target.id] }, false);
		expect(await core.completeTask(completedDependent.id, false)).toBe(true);

		const archived = await core.archiveTask(target.id, false);
		expect(archived.success).toBe(true);
		expect(archived.cleanedTaskIds).toEqual([activeDependent.id, completedDependent.id]);

		expect((await core.filesystem.loadTask(activeDependent.id))?.dependencies ?? []).toEqual([]);
		expect((await loadCompleted(completedDependent.id))?.references ?? []).toEqual([]);
	});

	it("keeps references to a completed task, because completion does not vacate its ID", async () => {
		const { task: predecessor } = await core.createTaskFromInput({ title: "Predecessor", status: "Done" });
		const { task: dependent } = await core.createTaskFromInput({
			title: "Dependent on a completed task",
			dependencies: [predecessor.id],
		});
		const { task: completedDependent } = await core.createTaskFromInput({
			title: "Completed dependent on a completed task",
			dependencies: [predecessor.id],
			status: "Done",
		});
		expect(await core.completeTask(completedDependent.id, false)).toBe(true);

		expect(await core.completeTask(predecessor.id, false)).toBe(true);

		expect((await core.filesystem.loadTask(dependent.id))?.dependencies).toEqual([predecessor.id]);
		expect((await loadCompleted(completedDependent.id))?.dependencies).toEqual([predecessor.id]);
	});

	it("keeps an edit made between the cleanup scan and the locks", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		const editor = new Core(testDir);
		const restore = interleaveAtLockAcquisition(async () => {
			await editor.updateTaskFromInput(dependent.id, { title: "Renamed while archiving" }, false);
		});

		try {
			const archived = await core.archiveTask(target.id, false);
			expect(archived.success).toBe(true);
			expect(archived.cleanedTaskIds).toEqual([dependent.id]);
		} finally {
			restore();
		}

		// A snapshot taken before the locks would have rewritten the file from pre-edit content.
		const updated = await core.filesystem.loadTask(dependent.id);
		expect(updated?.title).toBe("Renamed while archiving");
		expect(updated?.dependencies ?? []).toEqual([]);
	});

	it("cleans a dependent that starts referencing the ID between the scan and the locks", async () => {
		const { task: late } = await core.createTaskFromInput({ title: "Late dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });

		const editor = new Core(testDir);
		const restore = interleaveAtLockAcquisition(async () => {
			await editor.updateTaskFromInput(late.id, { dependencies: [target.id] }, false);
		});

		try {
			const archived = await core.archiveTask(target.id, false);
			expect(archived.success).toBe(true);
			expect(archived.cleanedTaskIds).toEqual([late.id]);
		} finally {
			restore();
		}

		const { task: unrelated } = await core.createTaskFromInput({ title: "Totally unrelated new task" });
		expect(taskIdsEqual(unrelated.id, target.id)).toBe(true);

		const updated = await core.filesystem.loadTask(late.id);
		expect(updated?.dependencies ?? []).toEqual([]);
		expect(await dependencyTitles(updated)).toEqual([]);
	});

	it("keeps concurrent archive cleanups serialized when a bare-ID dependent completes under the lock", async () => {
		const { task: firstTarget } = await core.createTaskFromInput({ title: "First archive target" });
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent with a bare stored ID" });
		const { task: secondTarget } = await core.createTaskFromInput({ title: "Second archive target" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [firstTarget.id, secondTarget.id] }, false);

		const dependentWithLinks = await core.filesystem.loadTask(dependent.id);
		if (!dependentWithLinks?.filePath) throw new Error("Expected the dependent task file");
		await Bun.write(dependentWithLinks.filePath, serializeTask({ ...dependentWithLinks, id: "2" }));

		// The first scan sees active TASK-2. Once its locks are held, completion moves the same
		// record into the completed corpus, where the locked rescan reads its stored ID as bare "2".
		// The second archive is injected just before the first cleanup writes that completed record.
		const firstArchiver = new Core(testDir);
		const completer = new Core(testDir);
		const secondArchiver = new Core(testDir);
		const filesystem = firstArchiver.filesystem;
		const originalWithTaskLocks = filesystem.withTaskLocks.bind(filesystem);
		const originalSaveTask = filesystem.saveTask.bind(filesystem);
		let completedUnderLock = false;
		let injectedSecondArchive = false;
		let concurrentArchiveFailure: unknown;

		filesystem.withTaskLocks = async (tasks, run) =>
			await originalWithTaskLocks(tasks, async () => {
				if (!completedUnderLock) {
					completedUnderLock = true;
					expect(await completer.completeTask(dependent.id, false)).toBe(true);
				}
				return await run();
			});
		filesystem.saveTask = async (task) => {
			if (!injectedSecondArchive && taskIdsEqual(task.id, dependent.id)) {
				injectedSecondArchive = true;
				try {
					expect((await secondArchiver.archiveTask(secondTarget.id, false)).success).toBe(true);
				} catch (error) {
					concurrentArchiveFailure = error;
				}
			}
			return await originalSaveTask(task);
		};

		try {
			expect((await firstArchiver.archiveTask(firstTarget.id, false)).success).toBe(true);
		} finally {
			filesystem.withTaskLocks = originalWithTaskLocks;
			filesystem.saveTask = originalSaveTask;
		}

		// With one canonical lock, the concurrent attempt fails fast and can be retried after the
		// first archive releases it. With spelling-based locks it succeeds in the middle, and the
		// first archive then restores the second target from its older cleanup snapshot.
		if (concurrentArchiveFailure) {
			expect(isTaskLockError(concurrentArchiveFailure)).toBe(true);
			expect((await new Core(testDir).archiveTask(secondTarget.id, false)).success).toBe(true);
		}

		const completedDependent = (await new Core(testDir).filesystem.listCompletedTasks()).find((task) =>
			taskIdsEqual(task.id, dependent.id),
		);
		expect(completedDependent?.dependencies ?? []).toEqual([]);
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

	it("serves the cleaned records from the content store as soon as the archive returns", async () => {
		const { task: activeDependent } = await core.createTaskFromInput({ title: "Active dependent" });
		const { task: completedDependent } = await core.createTaskFromInput({ title: "Completed dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		await core.updateTaskFromInput(activeDependent.id, { dependencies: [target.id] }, false);
		await core.updateTaskFromInput(completedDependent.id, { dependencies: [target.id] }, false);
		expect(await core.completeTask(completedDependent.id, false)).toBe(true);

		const store = await core.getContentStore();
		expect(store.getTasks().find((task) => taskIdsEqual(task.id, activeDependent.id))?.dependencies).toEqual([
			target.id,
		]);

		expect((await core.archiveTask(target.id, false)).success).toBe(true);

		// A reader served from the store must not still see the reference the archive removed.
		expect(store.getTasks().find((task) => taskIdsEqual(task.id, activeDependent.id))?.dependencies ?? []).toEqual([]);
		const snapshot = store.getTaskCorpusSnapshot();
		expect(snapshot.completedTasks.find((task) => taskIdsEqual(task.id, completedDependent.id))?.dependencies).toEqual(
			[],
		);
		// Rewriting the completed file must not republish it as an active task.
		expect(store.getTasks().some((task) => taskIdsEqual(task.id, completedDependent.id))).toBe(false);
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

	it("leaves a contested identity contested when it cleans a completed record", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		const { task: completedDependent } = await core.createTaskFromInput({ title: "Completed dependent" });
		await core.updateTaskFromInput(completedDependent.id, { dependencies: [target.id] }, false);
		expect(await core.completeTask(completedDependent.id, false)).toBe(true);

		// A second file claims the completed record's identity from the active corpus: the conflict
		// `backlog doctor` exists to surface, which an unrelated cleanup must not dissolve.
		const duplicatePath = join(core.filesystem.tasksDir, "task-02 - Active duplicate.md");
		await Bun.write(
			duplicatePath,
			serializeTask({ ...completedDependent, id: "TASK-02", title: "Active duplicate", dependencies: [] }),
		);

		// The store was initialized before that file existed, so give it the corpus that holds both
		// claimants rather than asserting against a snapshot that never saw the conflict.
		const store = await core.getContentStore();
		await store.refreshTasks();
		expect(store.getTaskCorpusSnapshot().activeTasks.some((task) => task.filePath === duplicatePath)).toBe(true);

		expect((await core.archiveTask(target.id, false)).success).toBe(true);

		const snapshot = store.getTaskCorpusSnapshot();
		expect(
			snapshot.activeTasks.filter((task) => taskIdsEqual(task.id, completedDependent.id)).map((t) => t.filePath),
		).toEqual([duplicatePath]);
		// ...and the completed record was still cleaned.
		expect(
			snapshot.completedTasks.find((task) => taskIdsEqual(task.id, completedDependent.id))?.dependencies ?? [],
		).toEqual([]);
	});

	it("cleans a dependent whose identity is contested by a completed record", async () => {
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
		const { task: dependent } = await core.createTaskFromInput({ title: "Active dependent" });
		await core.updateTaskFromInput(dependent.id, { dependencies: [target.id] }, false);

		// A completed record claims the dependent's identity, so resolving it by ID is ambiguous.
		// The cleanup already chose the file, so it must write that file rather than ask again.
		const completedPath = join(core.filesystem.completedDir, "task-02 - Completed collision.md");
		await Bun.write(
			completedPath,
			serializeTask({ ...dependent, id: "TASK-02", title: "Completed collision", dependencies: [] }),
		);

		const archived = await core.archiveTask(target.id, false);
		expect(archived.success).toBe(true);
		expect(archived.cleanedTaskIds).toEqual([dependent.id]);

		const updated = await core.filesystem.listTasks();
		expect(updated.find((task) => task.filePath === dependent.filePath)?.dependencies ?? []).toEqual([]);
	});

	it("reports an archive whose cleanup write failed as already moved", async () => {
		const { task: dependent } = await core.createTaskFromInput({ title: "Dependent" });
		const { task: target } = await core.createTaskFromInput({ title: "Archive target" });
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
			await core.archiveTask(target.id, false);
		} catch (error) {
			failure = error;
		} finally {
			filesystem.saveTask = originalSaveTask;
		}

		// The task is in the archive, so the caller must not be told to try again.
		expect((failure as { archiveState?: string } | undefined)?.archiveState).toBe("moved");
		expect(await core.filesystem.loadTask(target.id)).toBeNull();
		expect(await Bun.file(join(core.filesystem.archiveTasksDir, basename(target.filePath ?? ""))).exists()).toBe(true);
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

	it("reports the cleaned tasks from the archive and demote commands", async () => {
		await $`bun ${cliPath} task create "Dependent one"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task create "Dependent two"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task create "Shared target"`.cwd(testDir).quiet();
		await $`bun ${cliPath} task edit TASK-1 --dep TASK-3`.cwd(testDir).quiet();
		await $`bun ${cliPath} task edit TASK-2 --dep TASK-3`.cwd(testDir).quiet();

		const archived = await $`bun ${cliPath} task archive TASK-3`.cwd(testDir).quiet();
		expect(archived.exitCode).toBe(0);
		expect(archived.stdout.toString()).toContain("Archived task TASK-3");
		expect(archived.stdout.toString()).toContain("Removed references to TASK-3 from TASK-1, TASK-2");

		await $`bun ${cliPath} task edit TASK-2 --dep TASK-1`.cwd(testDir).quiet();
		const demoted = await $`bun ${cliPath} task demote TASK-1`.cwd(testDir).quiet();
		expect(demoted.exitCode).toBe(0);
		expect(demoted.stdout.toString()).toContain("Demoted task TASK-1");
		expect(demoted.stdout.toString()).toContain("Removed references to TASK-1 from TASK-2");
	});

	it("says nothing about cleanup when no other record referenced the task", async () => {
		await $`bun ${cliPath} task create "Lonely target"`.cwd(testDir).quiet();

		const archived = await $`bun ${cliPath} task archive TASK-1`.cwd(testDir).quiet();
		expect(archived.exitCode).toBe(0);
		expect(archived.stdout.toString()).toContain("Archived task TASK-1");
		expect(archived.stdout.toString()).not.toContain("Removed references");
	});
});
