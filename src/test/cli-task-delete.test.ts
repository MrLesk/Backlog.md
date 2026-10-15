import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, rename, symlink } from "node:fs/promises";
import { join } from "node:path";
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

async function taskFiles(folder: "tasks" | "archive/tasks" | "drafts"): Promise<string[]> {
	return (await readdir(join(TEST_DIR, "backlog", folder))).sort();
}

describe("backlog task delete", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("test-cli-task-delete");
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Delete Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("permanently removes an archived task, so view no longer finds it", async () => {
		await task("create", "Short-lived");
		await task("archive", "1");
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Short-lived.md"]);

		const deleted = await task("delete", "1");

		expect(deleted.exitCode).toBe(0);
		expect(deleted.stdout).toBe("Deleted task TASK-1\n");
		expect(await taskFiles("archive/tasks")).toEqual([]);
		const view = await task("view", "1", "--plain");
		expect(view.exitCode).toBe(1);
		expect(view.stderr).toContain("Task 1 not found.");
		// Deleting it again finds nothing to delete.
		const again = await task("delete", "1");
		expect(again.exitCode).toBe(1);
		expect(again.stderr).toContain("Task 1 not found.");
	});

	it("refuses a task that is not archived and leaves it unchanged", async () => {
		await task("create", "Still on the board");
		const path = join(TEST_DIR, "backlog", "tasks", "task-1 - Still-on-the-board.md");
		const before = await Bun.file(path).text();

		const refused = await task("delete", "1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain("Task TASK-1 is not archived. A task must be archived before it can be deleted.");
		expect(refused.stdout).toBe("");
		expect(await Bun.file(path).text()).toBe(before);
	});

	it("asks nothing and offers no confirmation flag", async () => {
		await task("create", "No questions");
		await task("archive", "1");

		const help = await task("delete", "--help");
		const options = help.stdout.split("\n").flatMap((line) => line.match(/^\s+(?:-\w, )?--[\w-]+/) ?? []);
		expect(options.map((option) => option.trim())).toEqual(["-h, --help"]);
		for (const flag of ["--yes", "--force", "-y"]) {
			const rejected = await task("delete", "1", flag);
			expect(rejected.exitCode).not.toBe(0);
			expect(rejected.stderr).toContain("unknown option");
		}
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - No-questions.md"]);

		// The test process has no terminal, so a prompt could not have been answered.
		expect((await task("delete", "1")).exitCode).toBe(0);
		expect(await taskFiles("archive/tasks")).toEqual([]);
	});

	it("releases the ID, so the next created task receives it", async () => {
		await task("create", "Keeps its ID");
		await task("create", "Gives its ID back");
		await task("archive", "2");
		// While the task is only archived, its ID stays taken.
		expect((await task("create", "Created while 2 is archived", "--plain")).stdout).toContain("Task TASK-3 - ");
		await task("archive", "3");
		await task("delete", "3");
		await task("delete", "2");

		const created = await task("create", "Created after the deletes", "--plain");

		expect(created.stdout).toContain("Task TASK-2 - Created after the deletes");
	});

	it("removes the links other tasks hold to the deleted task and names the changed tasks", async () => {
		await task("create", "Target");
		await task("create", "Depends on the target", "--dep", "task-1");
		await task("create", "Refers to the target", "--ref", "TASK-1", "--ref", "https://example.com/TASK-1");
		await task("create", "Archived and depends on the target", "--dep", "task-1", "--dep", "task-2");
		await task("create", "Unrelated", "--dep", "task-2");
		await task("archive", "4");
		await task("archive", "1");

		const deleted = await task("delete", "1");

		expect(deleted.exitCode).toBe(0);
		expect(deleted.stdout).toBe("Deleted task TASK-1\nRemoved references to TASK-1 from TASK-2, TASK-3, TASK-4\n");
		const core = new Core(TEST_DIR);
		expect((await core.filesystem.loadTask("task-2"))?.dependencies).toEqual([]);
		// A URL that merely contains the ID is not a reference to the task.
		expect((await core.filesystem.loadTask("task-3"))?.references).toEqual(["https://example.com/TASK-1"]);
		const archived = (await core.filesystem.listArchivedTasks()).find((candidate) => candidate.id === "TASK-4");
		expect(archived?.dependencies).toEqual(["TASK-2"]);
		expect((await core.filesystem.loadTask("task-5"))?.dependencies).toEqual(["TASK-2"]);
	});

	it("is refused while subtasks of the task exist, on the board or in the archive", async () => {
		await task("create", "Parent");
		await task("create", "Child", "-p", "1");
		await task("archive", "1");
		const expected = "Task TASK-1 cannot be deleted while its subtasks exist: TASK-1.1.";

		const withBoardSubtask = await task("delete", "1");
		expect(withBoardSubtask.exitCode).toBe(1);
		expect(withBoardSubtask.stderr).toContain(expected);
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Parent.md"]);
		expect(await taskFiles("tasks")).toEqual(["task-1.1 - Child.md"]);

		await task("archive", "1.1");
		const withArchivedSubtask = await task("delete", "1");
		expect(withArchivedSubtask.exitCode).toBe(1);
		expect(withArchivedSubtask.stderr).toContain(expected);
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Parent.md", "task-1.1 - Child.md"]);

		// Once the subtask is deleted, the parent can go too.
		expect((await task("delete", "1.1")).exitCode).toBe(0);
		expect((await task("delete", "1")).exitCode).toBe(0);
		expect(await taskFiles("archive/tasks")).toEqual([]);
	});

	describe("with a subtask that was demoted to a draft", () => {
		const draftPath = () => join(TEST_DIR, "backlog", "drafts", "draft-1 - Child.md");

		beforeEach(async () => {
			await task("create", "Parent");
			await task("create", "Child", "-p", "1");
			await task("demote", "1.1");
			await task("archive", "1");
			// The draft still names the archived task as its parent.
			expect(await Bun.file(draftPath()).text()).toContain("parent_task_id: TASK-1");
		});

		it("is refused, names the draft and changes nothing, until the draft's task is deleted", async () => {
			const draftBefore = await Bun.file(draftPath()).text();

			const refused = await task("delete", "1");

			expect(refused.exitCode).toBe(1);
			expect(refused.stderr).toContain("Task TASK-1 cannot be deleted while its subtasks exist: DRAFT-1.");
			expect(refused.stdout).not.toContain("Deleted task");
			expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Parent.md"]);
			expect(await taskFiles("drafts")).toEqual(["draft-1 - Child.md"]);
			expect(await Bun.file(draftPath()).text()).toBe(draftBefore);

			// The draft becomes a task again; once that task is archived and deleted, the parent can go.
			expect((await $`bun ${[CLI_PATH, "draft", "promote", "1"]}`.cwd(TEST_DIR).nothrow().quiet()).exitCode).toBe(0);
			expect(await taskFiles("tasks")).toEqual(["task-1.1 - Child.md"]);
			expect((await task("delete", "1")).exitCode).toBe(1);
			await task("archive", "1.1");
			expect((await task("delete", "1.1")).exitCode).toBe(0);
			expect((await task("delete", "1")).stdout).toBe("Deleted task TASK-1\n");
			expect(await taskFiles("archive/tasks")).toEqual([]);
		});

		it("is still refused and names the draft when another draft cannot be read", async () => {
			// Reading this draft fails, which must not hide the demoted subtask next to it.
			const damagedPath = join(TEST_DIR, "backlog", "drafts", "draft-2 - Bad.md");
			await Bun.write(damagedPath, "---\nid: DRAFT-2\ntitle: Bad\ndependencies:\n  - { nested: true }\n---\n");
			const draftBefore = await Bun.file(draftPath()).text();

			const refused = await task("delete", "1");

			expect(refused.exitCode).toBe(1);
			expect(refused.stderr).toContain("Task TASK-1 cannot be deleted while its subtasks exist: DRAFT-1.");
			expect(refused.stdout).not.toContain("Deleted task");
			expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Parent.md"]);
			expect(await taskFiles("drafts")).toEqual(["draft-1 - Child.md", "draft-2 - Bad.md"]);
			expect(await Bun.file(draftPath()).text()).toBe(draftBefore);
		});

		it("succeeds once the draft no longer names the task as its parent", async () => {
			const filesystem = new Core(TEST_DIR).filesystem;
			const draft = await filesystem.loadDraft("draft-1");
			if (!draft) throw new Error("Expected the demoted draft");
			await filesystem.saveDraft({ ...draft, parentTaskId: undefined });
			expect(await Bun.file(draftPath()).text()).not.toContain("parent_task_id");

			const deleted = await task("delete", "1");

			expect(deleted.exitCode).toBe(0);
			expect(deleted.stdout).toBe("Deleted task TASK-1\n");
			expect(await taskFiles("archive/tasks")).toEqual([]);
			expect(await taskFiles("drafts")).toEqual(["draft-1 - Child.md"]);
		});
	});

	it("fails closed when more than one record claims the ID", async () => {
		await task("create", "Archived claimant");
		await task("archive", "1");
		const boardClaimant = join(TEST_DIR, "backlog", "tasks", "task-01 - Board-claimant.md");
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

		const refused = await task("delete", "1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain("ambiguous");
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Archived-claimant.md"]);
		expect(await Bun.file(boardClaimant).exists()).toBe(true);
	});

	it("refuses parent deletion when its child tries to archive between corpus enumerations", async () => {
		const core = new Core(TEST_DIR);
		const { task: parent } = await core.createTaskFromInput({ title: "Parent" }, false);
		const { task: child } = await core.createTaskFromInput({ title: "Child", parentTaskId: parent.id }, false);
		await core.archiveTask(parent.id, false, { includeCrossBranch: false });
		const archivedParent = join(core.filesystem.archiveTasksDir, "task-1 - Parent.md");
		const parentBytes = await Bun.file(archivedParent).text();
		const childBytes = await Bun.file(child.filePath as string).text();
		const archiver = new Core(TEST_DIR);
		archiver.withCreateLock = (run) => archiver.filesystem.withCreateLock(run, { timeoutMs: 0 });
		const originalLock = core.withCreateLock.bind(core);
		const originalActive = core.filesystem.listTasks.bind(core.filesystem);
		const originalArchived = core.filesystem.listArchivedTasks.bind(core.filesystem);
		let inAllocator = false;
		let activeCalls = 0;
		let archivedCalls = 0;
		let archiveError: unknown;
		let archiveReady!: () => void;
		const archiveSnapshotReady = new Promise<void>((resolve) => {
			archiveReady = resolve;
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
		core.filesystem.listArchivedTasks = async () => {
			const snapshot = await originalArchived();
			if (inAllocator && ++archivedCalls === 2) archiveReady();
			return snapshot;
		};
		core.filesystem.listTasks = async (...args) => {
			if (inAllocator && ++activeCalls === 2) {
				await archiveSnapshotReady;
				// The archived snapshot is fixed before this actual move is attempted; active is read after.
				try {
					await archiver.archiveTask(child.id, false, { includeCrossBranch: false });
				} catch (error) {
					archiveError = error;
				}
			}
			return await originalActive(...args);
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

		expect((archiveError as Error)?.message).toContain(CREATE_LOCK_ERROR_MESSAGE);
		expect(await Bun.file(archivedParent).text()).toBe(parentBytes);
		expect(await Bun.file(child.filePath as string).text()).toBe(childBytes);
		expect(await archiver.archiveTask(child.id, false, { includeCrossBranch: false })).toBe(true);
		expect(await Bun.file(join(core.filesystem.archiveTasksDir, "task-1.1 - Child.md")).text()).toBe(childBytes);
		expect((await task("delete", parent.id)).stderr).toContain(child.id);
		expect((await task("delete", child.id)).exitCode).toBe(0);
		expect((await task("delete", parent.id)).exitCode).toBe(0);
		expect((await task("create", "Replacement", "--plain")).stdout).toContain(`Task ${parent.id} - Replacement`);
	});

	it("removes a symlinked archived task as a link and leaves the file it points to", async () => {
		await task("create", "Linked record");
		await task("archive", "1");
		const linkPath = join(TEST_DIR, "backlog", "archive", "tasks", "task-1 - Linked-record.md");
		const targetDirectory = join(TEST_DIR, "elsewhere");
		const targetPath = join(targetDirectory, "linked-record.md");
		await mkdir(targetDirectory);
		await rename(linkPath, targetPath);
		await symlink(targetPath, linkPath);
		const targetContent = await Bun.file(targetPath).text();
		expect((await task("view", "1", "--plain")).stdout).toContain("Task TASK-1 - Linked record");

		const deleted = await task("delete", "1");

		expect(deleted.exitCode).toBe(0);
		expect(await lstat(linkPath).catch(() => null)).toBeNull();
		expect(await Bun.file(targetPath).text()).toBe(targetContent);
	});
});

describe("backlog task delete with auto-commit", () => {
	const base = { status: "To Do", assignee: [], createdDate: "2025-01-01", labels: [] };
	const lastCommit = async () => (await $`git log -1 --format=%s`.cwd(TEST_DIR).text()).trim();

	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("test-cli-task-delete-commit");
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Delete Commit Project", true);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true });

		// The project as one commit: an archived task and a board task that depends on it.
		await core.createTask({ ...base, id: "task-1", title: "Target", dependencies: [] }, false);
		await core.createTask({ ...base, id: "task-2", title: "Depends on the target", dependencies: ["task-1"] }, false);
		expect(await core.archiveTask("task-1", false)).toBe(true);
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Set up the project"`.cwd(TEST_DIR).quiet();
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	it("commits the removed task together with the tasks it cleaned", async () => {
		const deleted = await task("delete", "1");

		expect(deleted.exitCode).toBe(0);
		expect(deleted.stdout).toContain("Removed references to TASK-1 from TASK-2");
		expect(await lastCommit()).toBe("backlog: Delete task TASK-1");
		const committed = (await $`git show --name-status --format= HEAD`.cwd(TEST_DIR).text()).trim().split("\n").sort();
		expect(committed).toEqual([
			"D\tbacklog/archive/tasks/task-1 - Target.md",
			"M\tbacklog/tasks/task-2 - Depends-on-the-target.md",
		]);
		expect((await $`git status --porcelain`.cwd(TEST_DIR).text()).trim()).toBe("");
	});

	it.each(["staging", "committing"])("keeps a concurrent create out of the delete commit while %s", async (step) => {
		const core = new Core(TEST_DIR);
		const { task: target } = await core.createTaskFromInput({ title: "Same name" }, false);
		await core.archiveTask(target.id, false);
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Archive the race target"`.cwd(TEST_DIR).quiet();
		const archivedPath = join(core.filesystem.archiveTasksDir, "task-3 - Same-name.md");
		const creator = new Core(TEST_DIR);
		// Fail immediately on contention, so the attempted create runs at this exact boundary.
		creator.withCreateLock = (run) => creator.filesystem.withCreateLock(run, { timeoutMs: 0 });
		let createError: unknown;
		const attemptCreate = async () => {
			try {
				await creator.createTaskFromInput({ title: target.title }, false);
			} catch (error) {
				createError = error;
			}
		};
		const originalAdd = core.gitOps.addFile.bind(core.gitOps);
		const originalCommit = core.gitOps.commitFiles.bind(core.gitOps);
		core.gitOps.addFile = async (path, ...args) => {
			if (step === "staging" && path === archivedPath) await attemptCreate();
			await originalAdd(path, ...args);
		};
		core.gitOps.commitFiles = async (...args) => {
			if (step === "committing") await attemptCreate();
			await originalCommit(...args);
		};

		try {
			expect(await core.deleteTask(target.id, true)).toEqual({ success: true, cleanedTaskIds: [] });
		} finally {
			core.gitOps.addFile = originalAdd;
			core.gitOps.commitFiles = originalCommit;
		}

		expect(await lastCommit()).toBe("backlog: Delete task TASK-3");
		expect((await $`git show --name-status --format= HEAD`.cwd(TEST_DIR).text()).trim()).toBe(
			"D\tbacklog/archive/tasks/task-3 - Same-name.md",
		);
		expect(createError).toBeInstanceOf(Error);
		expect((createError as Error).message).toContain(CREATE_LOCK_ERROR_MESSAGE);
		expect((await task("view", target.id, "--plain")).exitCode).toBe(1);
		// Once deletion has finished, the same ID and filename can be reused outside its commit.
		const created = await creator.createTaskFromInput({ title: target.title }, false);
		expect(created.task.id).toBe(target.id);
		expect(created.task.filePath).toBe(target.filePath);
		expect((await $`git ls-tree -r --name-only HEAD backlog/tasks`.cwd(TEST_DIR).text()).trim()).not.toContain(
			"task-3 - Same-name.md",
		);
	});

	it("cleans a CLI create completed just before allocator acquisition, before the ID can be reused", async () => {
		const core = new Core(TEST_DIR);
		const { task: target } = await core.createTaskFromInput({ title: "Late create target" }, false);
		await core.archiveTask(target.id, false);
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Archive before late create"`.cwd(TEST_DIR).quiet();
		const original = core.withCreateLock.bind(core);
		let created = false;
		core.withCreateLock = async (run) => {
			if (!created) {
				created = true;
				const late = await task("create", "Late dependent", "-p", "TASK-2", "--dep", target.id, "--ref", target.id);
				expect(late.exitCode).toBe(0);
			}
			return await original(run);
		};

		try {
			expect(await core.deleteTask(target.id, true)).toEqual({ success: true, cleanedTaskIds: ["TASK-2.1"] });
		} finally {
			core.withCreateLock = original;
		}

		expect(await lastCommit()).toBe(`backlog: Delete task ${target.id}`);
		expect((await $`git show --name-status --format= HEAD`.cwd(TEST_DIR).text()).trim().split("\n").sort()).toEqual([
			"D\tbacklog/archive/tasks/task-3 - Late-create-target.md",
			"M\tbacklog/tasks/task-2.1 - Late-dependent.md",
		]);
		expect((await $`git status --porcelain`.cwd(TEST_DIR).text()).trim()).toBe("");
		const replacement = await task("create", "Unrelated replacement", "--plain");
		expect(replacement.exitCode).toBe(0);
		expect(replacement.stdout).toContain(`Task ${target.id} - Unrelated replacement`);
		const late = await core.filesystem.loadTask("TASK-2.1");
		expect(late?.dependencies ?? []).toEqual([]);
		expect(late?.references ?? []).toEqual([]);
	});

	it.each([false, true])("reports deletion when releasing a lock fails, with auto-commit %s", async (autoCommit) => {
		const core = new Core(TEST_DIR);
		const { task: target } = await core.createTaskFromInput({ title: "Release failure" }, false);
		await core.archiveTask(target.id, false);
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Archive before release failure"`.cwd(TEST_DIR).quiet();
		const original = core.filesystem.withTaskLocks.bind(core.filesystem);
		core.filesystem.withTaskLocks = async (tasks, run) => {
			await original(tasks, run);
			throw new Error("task lock release failed");
		};

		try {
			await expect(core.deleteTask(target.id, autoCommit)).rejects.toThrow(
				"Task TASK-3 was deleted, but releasing deletion locks failed: task lock release failed",
			);
		} finally {
			core.filesystem.withTaskLocks = original;
		}

		const view = await task("view", target.id, "--plain");
		expect(view.exitCode).toBe(1);
		expect(view.stderr).toContain(`Task ${target.id} not found.`);
		expect(await lastCommit()).toBe(autoCommit ? "backlog: Delete task TASK-3" : "Archive before release failure");
		if (autoCommit) {
			expect((await $`git show --name-status --format= HEAD`.cwd(TEST_DIR).text()).trim()).toBe(
				"D\tbacklog/archive/tasks/task-3 - Release-failure.md",
			);
			expect((await $`git status --porcelain`.cwd(TEST_DIR).text()).trim()).toBe("");
		}
	});

	it("reads the auto-commit setting before deleting anything", async () => {
		const core = new Core(TEST_DIR);
		core.shouldAutoCommit = async () => {
			throw new Error("Cannot read auto-commit setting");
		};
		await expect(core.deleteTask("TASK-1")).rejects.toThrow("Cannot read auto-commit setting");
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Target.md"]);
		expect((await core.filesystem.loadTask("TASK-2"))?.dependencies).toEqual(["task-1"]);
		expect(await lastCommit()).toBe("Set up the project");
	});

	it("commits a draft it cleaned, also when the save gives the draft file a new name", async () => {
		// DRAFT-1 depends on TASK-1, and its file is not named after its title.
		const core = new Core(TEST_DIR);
		const savedPath = await core.filesystem.saveDraft({
			...base,
			id: "draft-1",
			title: "Linked draft",
			status: "Draft",
			dependencies: ["TASK-1"],
		});
		await rename(savedPath, join(TEST_DIR, "backlog", "drafts", "draft-1 - Old-title.md"));
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add a draft"`.cwd(TEST_DIR).quiet();

		const deleted = await task("delete", "1");

		expect(deleted.exitCode).toBe(0);
		expect(deleted.stdout).toBe("Deleted task TASK-1\nRemoved references to TASK-1 from TASK-2, DRAFT-1\n");
		expect(await lastCommit()).toBe("backlog: Delete task TASK-1");
		const committed = (await $`git show --name-status --no-renames --format= HEAD`.cwd(TEST_DIR).text())
			.trim()
			.split("\n")
			.sort();
		expect(committed).toEqual([
			"A\tbacklog/drafts/draft-1 - Linked-draft.md",
			"D\tbacklog/archive/tasks/task-1 - Target.md",
			"D\tbacklog/drafts/draft-1 - Old-title.md",
			"M\tbacklog/tasks/task-2 - Depends-on-the-target.md",
		]);
		expect((await $`git status --porcelain`.cwd(TEST_DIR).text()).trim()).toBe("");
	});

	it("says the commit failed when the removal cannot be staged, and does not report success", async () => {
		// Nothing refers to TASK-3, so removing its committed file is the only change there is to stage.
		const core = new Core(TEST_DIR);
		await core.createTask({ ...base, id: "task-3", title: "Unreferenced", dependencies: [] }, false);
		expect(await core.archiveTask("task-3", false)).toBe(true);
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Archive an unreferenced task"`.cwd(TEST_DIR).quiet();
		// Another Git process holds the index, so nothing can be staged.
		await Bun.write(join(TEST_DIR, ".git", "index.lock"), "");

		const deleted = await task("delete", "3");

		expect(deleted.exitCode).toBe(1);
		expect(deleted.stderr).toContain("Task TASK-3 was deleted, but committing the change failed");
		expect(deleted.stderr).toContain("index.lock");
		expect(deleted.stdout).not.toContain("Deleted task");
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Target.md"]);
		expect(await lastCommit()).toBe("Archive an unreferenced task");
	});

	it("deletes an archived task that was never committed without a commit", async () => {
		const core = new Core(TEST_DIR);
		await core.createTask({ ...base, id: "task-3", title: "Never committed", dependencies: [] }, false);
		expect(await core.archiveTask("task-3", false)).toBe(true);

		const deleted = await task("delete", "3");

		expect(deleted.exitCode).toBe(0);
		expect(deleted.stdout).toBe("Deleted task TASK-3\n");
		expect(await taskFiles("archive/tasks")).toEqual(["task-1 - Target.md"]);
		expect(await lastCommit()).toBe("Set up the project");
	});

	it("commits the board file's removal when the archive was not committed", async () => {
		// TASK-3 is committed on the board, then archived without a commit, so Git still has it in tasks/.
		const core = new Core(TEST_DIR);
		await core.createTask({ ...base, id: "task-3", title: "Archived without a commit", dependencies: [] }, false);
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Add a board task"`.cwd(TEST_DIR).quiet();
		expect(await core.archiveTask("task-3", false)).toBe(true);

		const deleted = await task("delete", "3");

		expect(deleted.exitCode).toBe(0);
		expect(await lastCommit()).toBe("backlog: Delete task TASK-3");
		const committed = (await $`git show --name-status --format= HEAD`.cwd(TEST_DIR).text()).trim();
		expect(committed).toBe("D\tbacklog/tasks/task-3 - Archived-without-a-commit.md");
		expect((await $`git ls-tree -r --name-only HEAD backlog/tasks`.cwd(TEST_DIR).text()).trim()).toBe(
			"backlog/tasks/task-2 - Depends-on-the-target.md",
		);
		expect((await $`git status --porcelain`.cwd(TEST_DIR).text()).trim()).toBe("");
	});
});
