import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, readlink, realpath, rename, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { $ } from "bun";
import { CREATE_LOCK_ERROR_MESSAGE } from "../file-system/operations.ts";
import { Core } from "../index.ts";
import { serializeTask } from "../markdown/serializer.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	createTestDirOutsideRepository,
	initializeFilesystemTestProject,
	initializeTestProject,
	safeCleanup,
} from "./test-utils.ts";

let TEST_DIR: string;
const CLI_PATH = getTestCliPath();

/** Run `backlog task <args>` in the test project and return what a caller of the CLI sees. */
async function task(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const result = await $`bun ${[CLI_PATH, "task", ...args]}`.cwd(TEST_DIR).nothrow().quiet();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

async function taskFiles(folder: "tasks" | "archive/tasks" | "completed"): Promise<string[]> {
	return (await readdir(join(TEST_DIR, "backlog", folder))).sort();
}

const boardPath = (name: string) => join(TEST_DIR, "backlog", "tasks", name);
const archivePath = (name: string) => join(TEST_DIR, "backlog", "archive", "tasks", name);

describe("backlog task restore", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("test-cli-task-restore");
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Restore Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("moves an archived task back to the board with the same ID and the status it had", async () => {
		await task("create", "Comes back", "-s", "In Progress");
		const name = "task-1 - Comes-back.md";
		const beforeArchive = await Bun.file(boardPath(name)).text();
		await task("archive", "1");
		expect(await taskFiles("tasks")).toEqual([]);

		const restored = await task("restore", "1");

		expect(restored.exitCode).toBe(0);
		expect(restored.stdout).toBe("Restored task TASK-1\n");
		expect(await taskFiles("archive/tasks")).toEqual([]);
		// The record is the same file content it was before it was archived.
		expect(await Bun.file(boardPath(name)).text()).toBe(beforeArchive);
		const view = (await task("view", "1", "--plain")).stdout;
		expect(view).toContain("Task TASK-1 - Comes back");
		expect(view).toContain("In Progress");
		expect(view).not.toContain("(archived)");
	});

	it("leaves a restored task behaving like any other task on the board", async () => {
		await task("create", "Edited after restore");
		await task("archive", "1");
		await task("restore", "1");

		const list = await task("list", "--plain");
		expect(list.stdout).toContain("TASK-1 - Edited after restore");
		const edit = await task("edit", "1", "-s", "In Progress", "--append-notes", "Back on the board");
		expect(edit.exitCode).toBe(0);
		const stored = await new Core(TEST_DIR).filesystem.loadTask("task-1");
		expect(stored?.status).toBe("In Progress");
		expect(stored?.implementationNotes).toContain("Back on the board");
		// It can be archived again, and its ID is still its own.
		expect((await task("archive", "1")).exitCode).toBe(0);
		expect((await task("create", "Next", "--plain")).stdout).toContain("Task TASK-2 - Next");
	});

	it("refuses parent deletion when its child tries to restore between corpus enumerations", async () => {
		const core = new Core(TEST_DIR);
		const { task: parent } = await core.createTaskFromInput({ title: "Parent" }, false);
		const { task: child } = await core.createTaskFromInput({ title: "Child", parentTaskId: parent.id }, false);
		await core.archiveTask(parent.id, false, { includeCrossBranch: false });
		await core.archiveTask(child.id, false, { includeCrossBranch: false });
		const parentPath = archivePath("task-1 - Parent.md");
		const childPath = archivePath("task-1.1 - Child.md");
		const parentBytes = await Bun.file(parentPath).text();
		const childBytes = await Bun.file(childPath).text();
		const restorer = new Core(TEST_DIR);
		restorer.withCreateLock = (run) => restorer.filesystem.withCreateLock(run, { timeoutMs: 0 });
		const originalLock = core.withCreateLock.bind(core);
		const originalActive = core.filesystem.listTasks.bind(core.filesystem);
		const originalArchived = core.filesystem.listArchivedTasks.bind(core.filesystem);
		let inAllocator = false;
		let activeCalls = 0;
		let archivedCalls = 0;
		let restoreError: unknown;
		let activeReady!: () => void;
		const activeSnapshotReady = new Promise<void>((resolve) => {
			activeReady = resolve;
		});
		core.withCreateLock = (run) =>
			originalLock(async () => {
				inAllocator = true;
				try {
					return await run();
				} finally {
					inAllocator = false;
				}
			});
		core.filesystem.listTasks = async (...args) => {
			const snapshot = await originalActive(...args);
			if (inAllocator && ++activeCalls === 3) activeReady();
			return snapshot;
		};
		core.filesystem.listArchivedTasks = async () => {
			if (inAllocator && ++archivedCalls === 3) {
				await activeSnapshotReady;
				// Active is fixed before this actual restore is attempted; archived is read after.
				try {
					await restorer.restoreTask(child.id, false, { includeCrossBranch: false });
				} catch (error) {
					restoreError = error;
				}
			}
			return await originalArchived();
		};

		try {
			await expect(core.deleteTask(parent.id, false, { includeCrossBranch: false })).rejects.toThrow(
				`Task ${parent.id} cannot be deleted while its subtasks exist: ${child.id}`,
			);
		} finally {
			core.withCreateLock = originalLock;
			core.filesystem.listTasks = originalActive;
			core.filesystem.listArchivedTasks = originalArchived;
		}

		expect((restoreError as Error)?.message).toContain(CREATE_LOCK_ERROR_MESSAGE);
		expect(await Bun.file(parentPath).text()).toBe(parentBytes);
		expect(await Bun.file(childPath).text()).toBe(childBytes);
		expect(await taskFiles("tasks")).toEqual([]);
		expect(await restorer.restoreTask(child.id, false, { includeCrossBranch: false })).toBe(true);
		expect(await Bun.file(boardPath("task-1.1 - Child.md")).text()).toBe(childBytes);
		expect(await Bun.file(childPath).exists()).toBe(false);
		expect((await task("delete", parent.id)).stderr).toContain(child.id);
	});

	it("keeps an archived task read-only and names the restore command when it is edited", async () => {
		await task("create", "Read-only while archived");
		await task("archive", "1");
		const path = archivePath("task-1 - Read-only-while-archived.md");
		const before = await Bun.file(path).text();

		const edit = await task("edit", "1", "--title", "Must not change");

		expect(edit.exitCode).toBe(1);
		expect(edit.stderr).toContain(
			"Task TASK-1 is archived. Archived tasks are read-only. Restore it to the board first: backlog task restore TASK-1",
		);
		expect(edit.stderr).not.toContain("not found");
		expect(await Bun.file(path).text()).toBe(before);
	});

	it("refuses a task that is already on the board and an unknown ID, and changes nothing", async () => {
		await task("create", "Already on the board");
		const path = boardPath("task-1 - Already-on-the-board.md");
		const before = await Bun.file(path).text();

		const onBoard = await task("restore", "1");
		expect(onBoard.exitCode).toBe(1);
		expect(onBoard.stderr).toContain("Task TASK-1 is not archived. It is already on the board.");
		expect(onBoard.stdout).toBe("");
		expect(await Bun.file(path).text()).toBe(before);

		const unknown = await task("restore", "99");
		expect(unknown.exitCode).toBe(1);
		expect(unknown.stderr).toContain("Task 99 not found.");
		expect(await taskFiles("tasks")).toEqual(["task-1 - Already-on-the-board.md"]);
		expect(await taskFiles("archive/tasks")).toEqual([]);
	});

	it("fails closed when more than one record claims the ID", async () => {
		await task("create", "Archived claimant");
		await task("archive", "1");
		const boardClaimant = boardPath("task-01 - Board-claimant.md");
		await Bun.write(
			boardClaimant,
			serializeTask({
				id: "TASK-01",
				title: "Board claimant",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
			}),
		);

		const refused = await task("restore", "1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain("ambiguous");
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Archived-claimant.md"]);
		expect(await taskFiles("tasks")).toEqual(["task-01 - Board-claimant.md"]);
	});

	it("never replaces a board file that already has the archived file's name", async () => {
		await task("create", "Same name");
		await task("archive", "1");
		const name = "task-1 - Same-name.md";
		const archived = await Bun.file(archivePath(name)).text();
		// Same file name, another task: the frontmatter gives it a different ID.
		await Bun.write(boardPath(name), archived.replace("id: TASK-1", "id: TASK-9"));
		const onBoard = await Bun.file(boardPath(name)).text();

		const refused = await task("restore", "1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain(
			"Task TASK-1 cannot be restored: the board already has a file named task-1 - Same-name.md.",
		);
		expect(await Bun.file(boardPath(name)).text()).toBe(onBoard);
		expect(await Bun.file(archivePath(name)).text()).toBe(archived);
	});

	it("restores a task that is archived in a leftover completed folder", async () => {
		await task("create", "From the old folder", "-s", "Done");
		await task("archive", "1");
		const name = "task-1 - From-the-old-folder.md";
		await mkdir(join(TEST_DIR, "backlog", "completed"));
		await rename(archivePath(name), join(TEST_DIR, "backlog", "completed", name));
		expect((await task("view", "1", "--plain")).stdout).toContain("Done (archived)");

		const restored = await task("restore", "1");

		expect(restored.exitCode).toBe(0);
		expect(await taskFiles("tasks")).toEqual([name]);
		expect(await taskFiles("completed")).toEqual([]);
		expect((await new Core(TEST_DIR).filesystem.loadTask("task-1"))?.status).toBe("Done");
	});

	it.each([
		["an absolute link", (target: string) => target],
		["a relative link", (target: string) => join("..", "..", "..", "elsewhere", target.split("/").pop() ?? "")],
	])("restores a symlinked archived task as %s to the same file", async (_name, linkText) => {
		await task("create", "Linked record");
		await task("archive", "1");
		const name = "task-1 - Linked-record.md";
		const targetPath = join(TEST_DIR, "elsewhere", "linked-record.md");
		await mkdir(dirname(targetPath));
		await rename(archivePath(name), targetPath);
		await symlink(linkText(targetPath), archivePath(name));
		const targetContent = await Bun.file(targetPath).text();

		const restored = await task("restore", "1");

		expect(restored.exitCode).toBe(0);
		expect(await lstat(archivePath(name)).catch(() => null)).toBeNull();
		expect((await lstat(boardPath(name))).isSymbolicLink()).toBe(true);
		const linked = resolve(dirname(boardPath(name)), await readlink(boardPath(name)));
		expect(await realpath(linked)).toBe(await realpath(targetPath));
		expect(await Bun.file(targetPath).text()).toBe(targetContent);
		// The restored link is an ordinary board task: an edit lands in the file it points to.
		expect((await task("edit", "1", "--append-notes", "Edited through the link")).exitCode).toBe(0);
		expect((await task("view", "1", "--plain")).stdout).toContain("Edited through the link");
	});
});

describe("backlog task restore with auto-commit", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("test-cli-task-restore-commit");
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Restore Commit Project", true);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true });

		// The project as one commit, with one archived task.
		await core.createTask(
			{
				id: "task-1",
				title: "Target",
				status: "To Do",
				assignee: [],
				createdDate: "2025-01-01",
				labels: [],
				dependencies: [],
			},
			false,
		);
		expect(await core.archiveTask("task-1", false)).toBe(true);
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Set up the project"`.cwd(TEST_DIR).quiet();
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("commits the move back to the board", async () => {
		const restored = await task("restore", "1");

		expect(restored.exitCode).toBe(0);
		expect((await $`git log -1 --format=%s`.cwd(TEST_DIR).text()).trim()).toBe("backlog: Restore task TASK-1");
		const committed = (await $`git show --name-status --format= HEAD`.cwd(TEST_DIR).text()).trim();
		expect(committed).toBe("R100\tbacklog/archive/tasks/task-1 - Target.md\tbacklog/tasks/task-1 - Target.md");
		expect((await $`git status --porcelain`.cwd(TEST_DIR).text()).trim()).toBe("");
	});
});
