import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { $ } from "bun";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

describe("demotion archive safety", () => {
	let testDir: string;
	let core: Core;

	beforeEach(async () => {
		testDir = createUniqueTestDir("demotion-archive-safety");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Demotion archive safety");
	});

	afterEach(async () => {
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(testDir);
	});

	async function createTarget(): Promise<Task & { filePath: string }> {
		const { task } = await core.createTaskFromInput(
			{ title: "Demotion target", description: "Original evidence" },
			false,
		);
		if (!task.filePath) throw new Error("Expected a saved task path");
		return { ...task, filePath: task.filePath };
	}

	const archivedPath = (task: Task & { filePath: string }) => join(core.fs.archiveTasksDir, basename(task.filePath));

	async function expectOriginalAndNoDraft(task: Task & { filePath: string }, original: string): Promise<void> {
		expect(await Bun.file(task.filePath).text()).toBe(original);
		expect(await core.fs.listDrafts()).toHaveLength(0);
	}

	it("refuses an occupied archive destination without overwriting history or creating a draft", async () => {
		const task = await createTarget();
		const original = await Bun.file(task.filePath).text();
		const existing = serializeTask({ ...task, id: "TASK-99", title: "Older history" });
		await Bun.write(archivedPath(task), existing);

		await expect(core.demoteTask(task.id, false)).rejects.toThrow();

		await expectOriginalAndNoDraft(task, original);
		expect(await Bun.file(archivedPath(task)).text()).toBe(existing);
	});

	it("refuses an archived frontmatter identity claimed under a different filename", async () => {
		const task = await createTarget();
		const original = await Bun.file(task.filePath).text();
		const existingPath = join(core.fs.archiveTasksDir, "task-099 - Earlier identity.md");
		const existing = serializeTask({ ...task, title: "Earlier identity" });
		await Bun.write(existingPath, existing);

		await expect(core.editTaskOrDraft(task.id, { status: "Draft", title: "Reconsidered" }, false)).rejects.toThrow();

		await expectOriginalAndNoDraft(task, original);
		expect(await Bun.file(existingPath).text()).toBe(existing);
		expect(await Bun.file(archivedPath(task)).exists()).toBe(false);
	});

	it("preserves an archive destination created by another writer after the identity scan", async () => {
		const task = await createTarget();
		const original = await Bun.file(task.filePath).text();
		const concurrentHistory = serializeTask({ ...task, title: "Concurrent archived history" });
		const saveDraft = core.fs.saveDraft.bind(core.fs);
		core.fs.saveDraft = async (draft) => {
			const path = await saveDraft(draft);
			await Bun.write(archivedPath(task), concurrentHistory);
			return path;
		};
		try {
			await expect(core.demoteTask(task.id, false)).rejects.toThrow();
		} finally {
			core.fs.saveDraft = saveDraft;
		}

		await expectOriginalAndNoDraft(task, original);
		expect(await Bun.file(archivedPath(task)).text()).toBe(concurrentHistory);
	});

	it("preserves the task when archive storage is not a directory", async () => {
		const task = await createTarget();
		const original = await Bun.file(task.filePath).text();
		await rm(core.fs.archiveTasksDir, { recursive: true, force: true });
		await Bun.write(core.fs.archiveTasksDir, "Archive storage is blocked\n");

		await expect(core.demoteTask(task.id, false)).rejects.toThrow();

		await expectOriginalAndNoDraft(task, original);
		expect(await Bun.file(core.fs.archiveTasksDir).text()).toBe("Archive storage is blocked\n");
	});

	it("does not leave an archive reservation when saving the new draft fails", async () => {
		const task = await createTarget();
		const original = await Bun.file(task.filePath).text();
		const saveDraft = core.fs.saveDraft.bind(core.fs);
		core.fs.saveDraft = async () => {
			throw new Error("Draft storage failure");
		};
		try {
			await expect(core.editTaskOrDraft(task.id, { status: "Draft" }, false)).rejects.toThrow("Draft storage failure");
		} finally {
			core.fs.saveDraft = saveDraft;
		}

		await expectOriginalAndNoDraft(task, original);
		expect(await Bun.file(archivedPath(task)).exists()).toBe(false);
	});

	it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
		"rolls back the draft and new archive if the original task cannot be removed",
		async () => {
			const task = await createTarget();
			const original = await Bun.file(task.filePath).text();
			const saveDraft = core.fs.saveDraft.bind(core.fs);
			core.fs.saveDraft = async (draft) => {
				const path = await saveDraft(draft);
				// The original is still readable, and archive/draft storage remains writable;
				// only removing its directory entry is forbidden.
				await chmod(core.fs.tasksDir, 0o555);
				return path;
			};
			try {
				await expect(core.demoteTask(task.id, false)).rejects.toThrow();
			} finally {
				core.fs.saveDraft = saveDraft;
				await chmod(core.fs.tasksDir, 0o755);
			}

			await expectOriginalAndNoDraft(task, original);
			expect(await Bun.file(archivedPath(task)).exists()).toBe(false);
		},
	);

	for (const edit of [false, true]) {
		it(`retains the retired ID after dependency cleanup fails (${edit ? "edit into Draft" : "demote"})`, async () => {
			const { task: dependent } = await core.createTaskFromInput({ title: "Dependent" }, false);
			const task = await createTarget();
			const original = await Bun.file(task.filePath).text();
			await core.updateTaskFromInput(dependent.id, { dependencies: [task.id] }, false);
			const saveTask = core.fs.saveTask.bind(core.fs);
			core.fs.saveTask = async (record) => {
				if (record.id === dependent.id) throw new Error("Dependency cleanup failure");
				return await saveTask(record);
			};
			let failure: unknown;
			try {
				if (edit) await core.editTaskOrDraft(task.id, { status: "Draft" }, false);
				else await core.demoteTask(task.id, false);
			} catch (error) {
				failure = error;
			} finally {
				core.fs.saveTask = saveTask;
			}

			expect((failure as { demotionState?: string } | undefined)?.demotionState).toBe("moved");
			expect((failure as { demotionFailureCause?: string } | undefined)?.demotionFailureCause).toBe("cleanup");
			expect(await Bun.file(archivedPath(task)).text()).toBe(original);
			expect(await core.fs.loadTask(task.id)).toBeNull();
			expect(await core.fs.listDrafts()).toHaveLength(1);
			expect((await core.createTaskFromInput({ title: "After cleanup failure" }, false)).task.id).toBe("TASK-3");
		});
	}

	it("retains the retired ID and reports a completed move when its commit fails", async () => {
		await $`git init -b main`.cwd(testDir).quiet();
		const config = await core.fs.loadConfig();
		if (!config) throw new Error("Expected initialized config");
		await core.fs.saveConfig({ ...config, filesystemOnly: false });
		const task = await createTarget();
		const original = await Bun.file(task.filePath).text();
		const git = await core.getGitOps();
		const commitFiles = git.commitFiles.bind(git);
		git.commitFiles = async () => {
			throw new Error("Commit failure");
		};
		let failure: unknown;
		try {
			await core.demoteTask(task.id, true);
		} catch (error) {
			failure = error;
		} finally {
			git.commitFiles = commitFiles;
		}

		expect((failure as { demotionState?: string } | undefined)?.demotionState).toBe("moved");
		expect((failure as { demotionFailureCause?: string } | undefined)?.demotionFailureCause).toBe("commit");
		expect(await Bun.file(archivedPath(task)).text()).toBe(original);
		expect(await core.fs.loadTask(task.id)).toBeNull();
		expect(await core.fs.listDrafts()).toHaveLength(1);
		expect((await core.createTaskFromInput({ title: "After commit failure" }, false)).task.id).toBe("TASK-2");
	});

	it("keeps retired IDs reserved when doctor allocates a duplicate repair", async () => {
		const task = await createTarget();
		await Bun.write(
			join(core.fs.tasksDir, "task-01 - Duplicate.md"),
			serializeTask({ ...task, id: "TASK-01", title: "Duplicate" }),
		);
		const historyPath = join(core.fs.archiveTasksDir, "task-2 - Retired.md");
		const history = serializeTask({ ...task, id: "TASK-2", title: "Retired" });
		await Bun.write(historyPath, history);

		const plan = await core.previewDuplicateTaskIdRepair();

		expect(plan.repairable).toBe(true);
		expect(plan.changes).toHaveLength(1);
		expect(plan.changes[0]?.newId).toBe("TASK-3");
		await core.repairDuplicateTaskIds(plan.fingerprint);
		expect((await core.fs.loadTask("TASK-3"))?.title).toBe("Duplicate");
		expect(await Bun.file(historyPath).text()).toBe(history);
	});
});
