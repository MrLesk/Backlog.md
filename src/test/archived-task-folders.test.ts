import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, readlink, symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
import { moveArchivedTasks, moveWithoutReplacing, previewArchivedTaskMove } from "../core/archived-task-move.ts";
import { Core } from "../core/backlog.ts";
import { serializeTask } from "../markdown/serializer.ts";
import type { Task } from "../types/index.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

/**
 * Archived tasks are read from the archive folder and from a `completed` folder that older
 * projects still have. Real projects also link files and folders inside the backlog directory, so
 * the reader and the mover are exercised against linked files, linked folders, and link cycles.
 */
describe("archived task folders", () => {
	// Creating file symlinks on Windows needs extra privileges; directory junctions do not.
	const itWithFileSymlinks = it.skipIf(process.platform === "win32");
	let testDir: string;
	let core: Core;
	let archiveFolder: string;
	let completedFolder: string;

	const makeTask = (id: string, title: string, status = "Done"): Task => ({
		id,
		title,
		status,
		assignee: [],
		createdDate: "2025-01-01",
		labels: [],
		dependencies: [],
	});

	const writeTask = async (folder: string, fileName: string, task: Task): Promise<string> => {
		await mkdir(folder, { recursive: true });
		const path = join(folder, fileName);
		await Bun.write(path, serializeTask(task));
		return path;
	};

	const archivedIds = async () => (await core.filesystem.listArchivedTasks()).map((task) => task.id);

	beforeEach(async () => {
		testDir = createUniqueTestDir("test-archived-task-folders");
		await mkdir(testDir, { recursive: true });
		core = new Core(testDir);
		await initializeFilesystemTestProject(core, "Archived Task Folders");
		archiveFolder = core.filesystem.archiveTasksDir;
		completedFolder = join(core.filesystem.backlogDir, "completed");
	});

	afterEach(async () => {
		await safeCleanup(testDir);
	});

	describe("reading", () => {
		it("reads the archive folder and a completed folder as one archived corpus", async () => {
			await writeTask(archiveFolder, "task-1 - Set-aside.md", makeTask("TASK-1", "Set aside", "To Do"));
			await writeTask(completedFolder, "task-2 - Finished.md", makeTask("TASK-2", "Finished"));

			expect(await archivedIds()).toEqual(["TASK-1", "TASK-2"]);
			const finished = await core.getTask("task-2");
			expect(finished?.source).toBe("archived");
			expect(finished?.filePath).toBe(join(completedFolder, "task-2 - Finished.md"));
			// A record in either folder is read-only and keeps its ID reserved.
			await expect(core.updateTaskFromInput("task-2", { title: "Changed" }, false)).rejects.toThrow(
				"Task TASK-2 is archived. Archived tasks are read-only.",
			);
			expect((await core.createTaskFromInput({ title: "Next" }, false)).task.id).toBe("TASK-3");
		});

		it("works when neither archived folder exists", async () => {
			await safeCleanup(join(core.filesystem.backlogDir, "archive"));

			expect(await core.filesystem.getArchivedTaskDirs()).toEqual([]);
			expect(await archivedIds()).toEqual([]);
		});

		it("reads a completed folder that is a link to a directory elsewhere", async () => {
			const outside = join(testDir, "shared-completed");
			await writeTask(outside, "task-4 - Linked-folder.md", makeTask("TASK-4", "Linked folder"));
			await symlink(outside, completedFolder, "junction");

			expect(await archivedIds()).toEqual(["TASK-4"]);
		});

		it("reads each real directory once when one archived folder links to the other", async () => {
			await writeTask(archiveFolder, "task-5 - Once.md", makeTask("TASK-5", "Once"));
			await symlink(archiveFolder, completedFolder, "junction");

			expect(await core.filesystem.getArchivedTaskDirs()).toEqual([archiveFolder]);
			expect(await archivedIds()).toEqual(["TASK-5"]);
			// Read twice, the one file would claim its ID twice and every lookup would fail closed.
			expect((await core.getTask("task-5"))?.title).toBe("Once");
			expect((await core.previewDuplicateTaskIdRepair()).groups).toEqual([]);
		});

		it("does not follow a link cycle inside or between the archived folders", async () => {
			await writeTask(archiveFolder, "task-6 - Beside-a-loop.md", makeTask("TASK-6", "Beside a loop"));
			// A folder that links back to its own parent, and an archived folder that links to itself.
			await symlink(archiveFolder, join(archiveFolder, "task-loop"), "junction");
			await symlink(completedFolder, completedFolder, "junction").catch(() => {});

			expect(await archivedIds()).toEqual(["TASK-6"]);
			expect((await previewArchivedTaskMove(core)).moves).toEqual([]);
		});

		itWithFileSymlinks("reads a linked task file and skips a dangling link", async () => {
			const outside = await writeTask(
				join(testDir, "elsewhere"),
				"shared.md",
				makeTask("TASK-7", "Linked file", "To Do"),
			);
			await mkdir(completedFolder, { recursive: true });
			await symlink(outside, join(completedFolder, "task-7 - Linked-file.md"));
			await symlink(join(testDir, "missing.md"), join(completedFolder, "task-8 - Dangling.md"));

			expect(await archivedIds()).toEqual(["TASK-7"]);
		});
	});

	describe("moving into the archive folder", () => {
		it("previews without changing files, then moves them with the same names and IDs", async () => {
			await writeTask(archiveFolder, "task-1 - Already-archived.md", makeTask("TASK-1", "Already archived", "To Do"));
			const finished = await writeTask(completedFolder, "task-2 - Finished.md", makeTask("TASK-2", "Finished"));
			await writeTask(completedFolder, "task-3 - Also-finished.md", makeTask("TASK-3", "Also finished"));
			const content = await Bun.file(finished).text();

			const preview = await previewArchivedTaskMove(core);

			expect(preview).toEqual({
				archiveDirectory: "backlog/archive/tasks",
				moves: [
					{
						sourcePath: "backlog/completed/task-2 - Finished.md",
						targetPath: "backlog/archive/tasks/task-2 - Finished.md",
					},
					{
						sourcePath: "backlog/completed/task-3 - Also-finished.md",
						targetPath: "backlog/archive/tasks/task-3 - Also-finished.md",
					},
				],
				blocked: [],
			});
			expect((await readdir(completedFolder)).sort()).toEqual(["task-2 - Finished.md", "task-3 - Also-finished.md"]);

			const moved = await moveArchivedTasks(core);

			expect(moved.moves).toEqual(preview.moves);
			expect(await readdir(completedFolder)).toEqual([]);
			expect(await Bun.file(join(archiveFolder, "task-2 - Finished.md")).text()).toBe(content);
			expect(await archivedIds()).toEqual(["TASK-1", "TASK-2", "TASK-3"]);
			expect((await previewArchivedTaskMove(core)).moves).toEqual([]);
		});

		it("never replaces a file that is already in the archive folder", async () => {
			const fileName = "task-41 - Same-name.md";
			const inArchive = await writeTask(archiveFolder, fileName, makeTask("TASK-99", "Kept in the archive", "To Do"));
			const inCompleted = await writeTask(completedFolder, fileName, makeTask("TASK-41", "Kept in completed"));
			await writeTask(completedFolder, "task-42 - Free-name.md", makeTask("TASK-42", "Free name"));
			const before = [await Bun.file(inArchive).text(), await Bun.file(inCompleted).text()];

			expect((await previewArchivedTaskMove(core)).blocked).toEqual([`backlog/completed/${fileName}`]);
			const moved = await moveArchivedTasks(core);

			expect(moved.moves.map((move) => move.sourcePath)).toEqual(["backlog/completed/task-42 - Free-name.md"]);
			expect(moved.blocked).toEqual([`backlog/completed/${fileName}`]);
			expect([await Bun.file(inArchive).text(), await Bun.file(inCompleted).text()]).toEqual(before);
		});

		it("refuses to move while two records claim one task ID", async () => {
			await writeTask(archiveFolder, "task-5 - Older-record.md", makeTask("TASK-5", "Older record", "To Do"));
			await writeTask(completedFolder, "task-5 - Finished-record.md", makeTask("TASK-5", "Finished record"));

			await expect(moveArchivedTasks(core)).rejects.toThrow("Repair the duplicate task IDs before moving");

			expect(await readdir(completedFolder)).toEqual(["task-5 - Finished-record.md"]);
		});

		it("moves out of a completed folder that is a link, and finds nothing behind a link to the archive folder", async () => {
			const outside = join(testDir, "shared-completed");
			await writeTask(outside, "task-6 - Behind-a-link.md", makeTask("TASK-6", "Behind a link"));
			await symlink(outside, completedFolder, "junction");

			const moved = await moveArchivedTasks(core);

			expect(moved.moves.map((move) => move.targetPath)).toEqual(["backlog/archive/tasks/task-6 - Behind-a-link.md"]);
			expect(await readdir(outside)).toEqual([]);
			expect(await archivedIds()).toEqual(["TASK-6"]);

			// With the folders linked to each other there is one directory and nothing to move.
			await safeCleanup(completedFolder);
			await symlink(archiveFolder, completedFolder, "junction");
			expect(await previewArchivedTaskMove(core)).toEqual({
				archiveDirectory: "backlog/archive/tasks",
				moves: [],
				blocked: [],
			});
		});

		itWithFileSymlinks("keeps a linked task file a link to the same file", async () => {
			const outside = await writeTask(join(testDir, "elsewhere"), "shared.md", makeTask("TASK-7", "Linked file"));
			await mkdir(completedFolder, { recursive: true });
			// Relative, so it only resolves from the directory the link lives in.
			await symlink(join("..", "..", "elsewhere", "shared.md"), join(completedFolder, "task-7 - Linked-file.md"));

			const moved = await moveArchivedTasks(core);

			const target = join(archiveFolder, "task-7 - Linked-file.md");
			expect(moved.moves).toHaveLength(1);
			expect((await lstat(target)).isSymbolicLink()).toBe(true);
			expect(await readlink(target)).toBe(join("..", "..", "..", "elsewhere", "shared.md"));
			expect(await Bun.file(target).text()).toBe(await Bun.file(outside).text());
			expect(await archivedIds()).toEqual(["TASK-7"]);
		});
	});

	describe("records that share a task ID", () => {
		it("keeps the ID on the board task and renumbers the archived record", async () => {
			await writeTask(archiveFolder, "task-1 - Archived-earlier.md", makeTask("TASK-1", "Archived earlier", "To Do"));
			await writeTask(
				core.filesystem.tasksDir,
				"task-1 - On-the-board.md",
				makeTask("TASK-1", "On the board", "To Do"),
			);

			// Until repaired, the ID is ambiguous and every command on it fails closed.
			await expect(core.getTask("task-1")).rejects.toThrow("is ambiguous");
			const plan = await core.previewDuplicateTaskIdRepair();

			expect(plan.changes.map((change) => [change.sourcePath, change.location, change.newId])).toEqual([
				["backlog/archive/tasks/task-1 - Archived-earlier.md", "archived", "TASK-2"],
			]);
			await core.repairDuplicateTaskIds(plan.fingerprint);
			expect((await core.getTask("task-1"))?.title).toBe("On the board");
			expect((await core.getTask("task-2"))?.title).toBe("Archived earlier");
		});

		it("keeps the ID on the record in the completed folder, then lets it move into the archive folder", async () => {
			// The same file name in both folders: the record already in the archive folder is the stale one.
			const fileName = "task-41 - Same-name.md";
			await writeTask(archiveFolder, fileName, makeTask("TASK-41", "Stale copy", "To Do"));
			await writeTask(completedFolder, fileName, makeTask("TASK-41", "Finished work"));

			const plan = await core.previewDuplicateTaskIdRepair();

			expect(plan.changes.map((change) => [change.sourcePath, change.newId])).toEqual([
				[`backlog/archive/tasks/${fileName}`, "TASK-42"],
			]);
			await core.repairDuplicateTaskIds(plan.fingerprint);
			const moved = await moveArchivedTasks(core);

			expect(moved).toEqual({
				archiveDirectory: "backlog/archive/tasks",
				moves: [{ sourcePath: `backlog/completed/${fileName}`, targetPath: `backlog/archive/tasks/${fileName}` }],
				blocked: [],
			});
			expect((await core.getTask("task-41"))?.title).toBe("Finished work");
			expect((await core.getTask("task-42"))?.title).toBe("Stale copy");
		});
	});
});

describe("moving a task file without replacing", () => {
	let directory: string;
	let source: string;
	let target: string;
	const withoutHardLinks = {
		link: async () => {
			throw Object.assign(new Error("cross-device link not permitted"), { code: "EXDEV" });
		},
	};
	const targetFolder = async () => await readdir(join(directory, "to"));

	beforeEach(async () => {
		directory = createUniqueTestDir("move-without-replacing");
		await mkdir(join(directory, "from"), { recursive: true });
		await mkdir(join(directory, "to"), { recursive: true });
		source = join(directory, "from", "task-1 - Moved.md");
		target = join(directory, "to", "task-1 - Moved.md");
		await Bun.write(source, "moved content");
	});

	afterEach(async () => {
		await safeCleanup(directory);
	});

	it("copies under a name it claimed first where a hard link is not possible", async () => {
		await moveWithoutReplacing(source, target, withoutHardLinks);

		expect(await Bun.file(target).text()).toBe("moved content");
		expect(await Bun.file(source).exists()).toBe(false);
	});

	it("keeps both files when the target name is taken, with or without hard links", async () => {
		await Bun.write(target, "already there");

		await expect(moveWithoutReplacing(source, target)).rejects.toMatchObject({ code: "EEXIST" });
		await expect(moveWithoutReplacing(source, target, withoutHardLinks)).rejects.toMatchObject({ code: "EEXIST" });

		expect(await Bun.file(target).text()).toBe("already there");
		expect(await Bun.file(source).text()).toBe("moved content");
	});

	it.each([
		["a hard link", {}],
		["a copy", withoutHardLinks],
	])("leaves one file, the source, when the source cannot be removed after %s", async (_name, operations) => {
		const removalError = Object.assign(new Error("permission denied"), { code: "EACCES" });
		let targetWasCreated = false;
		const failToRemoveSource = async (path: string) => {
			if (path !== source) return await unlink(path);
			targetWasCreated = (await Bun.file(target).text()) === "moved content";
			throw removalError;
		};

		await expect(moveWithoutReplacing(source, target, { ...operations, unlink: failToRemoveSource })).rejects.toBe(
			removalError,
		);

		// The removal failed after the move had produced a complete second file, and that file is gone.
		expect(targetWasCreated).toBe(true);
		expect(await targetFolder()).toEqual([]);
		expect(await Bun.file(source).text()).toBe("moved content");
	});

	it("removes a half-written target when the copy fails", async () => {
		const copyError = Object.assign(new Error("no space left on device"), { code: "ENOSPC" });
		const failHalfway = async (_sourcePath: string, targetPath: string) => {
			await Bun.write(targetPath, "moved con");
			throw copyError;
		};

		await expect(moveWithoutReplacing(source, target, { ...withoutHardLinks, copyFile: failHalfway })).rejects.toBe(
			copyError,
		);

		expect(await targetFolder()).toEqual([]);
		expect(await Bun.file(source).text()).toBe("moved content");
	});
});
