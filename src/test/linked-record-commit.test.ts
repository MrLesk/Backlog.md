import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, realpath, rename, rm, symlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { McpServer } from "../mcp/server.ts";
import { registerTaskTools } from "../mcp/tools/tasks/index.ts";
import { getTestCliPath } from "./test-cli.ts";
import { createTestDirOutsideRepository, initializeTestProject, isWindows, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let OUTSIDE_DIR: string;
const CLI_PATH = getTestCliPath();
const TASK_FILE = "task-1 - Linked-task.md";

/** Run `backlog <args>` in the test project and return what a caller of the CLI sees. */
async function backlog(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const result = await $`bun ${[CLI_PATH, ...args]}`.cwd(TEST_DIR).nothrow().quiet();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

type TaskChange = "archive" | "restore" | "delete" | "append-notes";

/** One change to TASK-1 through one interface. `error` is what the interface reported, empty on success. */
type ChangeTask = (change: TaskChange) => Promise<{ ok: boolean; error: string }>;

const changeTaskWithCli: ChangeTask = async (change) => {
	const args =
		change === "append-notes"
			? ["task", "edit", "1", "--append-notes", "Edited through the link"]
			: ["task", change, "1"];
	const result = await backlog(...args);
	return { ok: result.exitCode === 0, error: result.stderr };
};

const changeTaskWithMcp: ChangeTask = async (change) => {
	const server = new McpServer(TEST_DIR, "Test instructions");
	try {
		const config = await server.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await server.ensureConfigLoaded();
		registerTaskTools(server, config);
		const call =
			change === "append-notes"
				? { name: "task_edit", arguments: { id: "task-1", notesAppend: ["Edited through the link"] } }
				: { name: `task_${change}`, arguments: { id: "task-1" } };
		const result = await server.testInterface.callTool({ params: call });
		const text = (result.content?.[0] as { text?: string } | undefined)?.text ?? "";
		return { ok: result.isError !== true, error: result.isError ? text : "" };
	} finally {
		await server.stop().catch(() => {});
	}
};

const INTERFACES = [
	["the CLI", changeTaskWithCli],
	["MCP", changeTaskWithMcp],
] as const;

const git = async (...args: string[]) => (await $`git ${args}`.cwd(TEST_DIR).quiet().text()).trim();

/** What the last commit holds, without rename detection: one "A", "D", "M" or "T" line per path. */
const lastCommit = async () =>
	(await git("show", "--no-renames", "--name-status", "--format=", "HEAD")).split("\n").sort();

/** The mode Git tracks a path under: 120000 for a symbolic link, 100644 for a regular file. */
const trackedMode = async (path: string) => (await git("ls-files", "-s", "--", path)).split(" ")[0];

/** Where the link target of a record file is kept, relative to the repository. */
const TARGETS = [
	["inside the repository", (name: string) => join(TEST_DIR, "notes", name)],
	["outside the repository", (name: string) => join(OUTSIDE_DIR, name)],
] as const;

/** Turns a record file into a relative symbolic link to a file kept at `targetPath`. Nothing is committed. */
async function replaceWithLink(recordPath: string, targetPath: string): Promise<void> {
	await mkdir(dirname(targetPath), { recursive: true });
	await rename(recordPath, targetPath);
	await symlink(relative(dirname(recordPath), targetPath), recordPath);
}

/** As `replaceWithLink`, and commits that state, so the link is a file Git already has. */
async function replaceWithCommittedLink(recordPath: string, targetPath: string): Promise<void> {
	await replaceWithLink(recordPath, targetPath);
	await git("add", "-A");
	await git("commit", "-m", "Make the record file a link");
}

describe.skipIf(isWindows())("auto-commit of record files reached through a symbolic link", () => {
	beforeEach(async () => {
		// Real paths, so a relative link from the project to the outside folder resolves on macOS too.
		TEST_DIR = await realpath(await createTestDirOutsideRepository("test-linked-record"));
		OUTSIDE_DIR = await realpath(await createTestDirOutsideRepository("test-linked-record-outside"));
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Linked Record Commit", true);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await core.filesystem.saveConfig({ ...config, autoCommit: true, remoteOperations: false });
		await core.createTaskFromInput({ title: "Linked task" }, false);
		await git("add", "-A");
		await git("commit", "-m", "Set up the project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
		await safeCleanup(OUTSIDE_DIR);
	});

	it.each(
		INTERFACES.flatMap(([via, changeTask]) =>
			TARGETS.map(([where, targetOf]) => [via, where, changeTask, targetOf] as const),
		),
	)(
		"archives, restores and deletes a task as a link through %s when its target is %s",
		async (_via, _where, changeTask, targetOf) => {
			await replaceWithCommittedLink(join(TEST_DIR, "backlog", "tasks", TASK_FILE), targetOf("task.md"));

			expect(await changeTask("archive")).toEqual({ ok: true, error: "" });
			expect(await git("log", "-1", "--format=%s")).toBe("backlog: Archive task TASK-1");
			// The commit holds the link under its new path and the removal of the old one, nothing else.
			expect(await lastCommit()).toEqual([`A\tbacklog/archive/tasks/${TASK_FILE}`, `D\tbacklog/tasks/${TASK_FILE}`]);
			expect(await trackedMode(`backlog/archive/tasks/${TASK_FILE}`)).toBe("120000");
			expect(await git("status", "--porcelain")).toBe("");

			expect(await changeTask("restore")).toEqual({ ok: true, error: "" });
			expect(await git("log", "-1", "--format=%s")).toBe("backlog: Restore task TASK-1");
			expect(await lastCommit()).toEqual([`A\tbacklog/tasks/${TASK_FILE}`, `D\tbacklog/archive/tasks/${TASK_FILE}`]);
			expect(await trackedMode(`backlog/tasks/${TASK_FILE}`)).toBe("120000");
			expect(await git("status", "--porcelain")).toBe("");

			expect(await changeTask("archive")).toEqual({ ok: true, error: "" });
			expect(await changeTask("delete")).toEqual({ ok: true, error: "" });
			expect(await git("log", "-1", "--format=%s")).toBe("backlog: Delete task TASK-1");
			// Delete removes the link. The file it pointed to is not the task's to remove.
			expect(await lastCommit()).toEqual([`D\tbacklog/archive/tasks/${TASK_FILE}`]);
			expect(await git("status", "--porcelain")).toBe("");
			expect((await lstat(targetOf("task.md"))).isFile()).toBe(true);
		},
	);

	it.each(INTERFACES)(
		"still commits the file a link points to when a task is edited through %s",
		async (_via, changeTask) => {
			await replaceWithCommittedLink(join(TEST_DIR, "backlog", "tasks", TASK_FILE), join(TEST_DIR, "notes", "task.md"));

			// The link itself does not change. The edit lands in the file it points to.
			expect(await changeTask("append-notes")).toEqual({ ok: true, error: "" });
			expect(await lastCommit()).toEqual(["M\tnotes/task.md"]);
			expect(await git("status", "--porcelain")).toBe("");
		},
	);

	it("commits only the link on the first edit through a link that is not committed yet", async () => {
		// A known corner of the rule in GitOperations.changedFileLinkPath: the link is new, so the link
		// is the path that is staged, and the edit in the file it points to waits for the next commit.
		await replaceWithLink(join(TEST_DIR, "backlog", "tasks", TASK_FILE), join(TEST_DIR, "notes", "task.md"));

		expect((await backlog("task", "edit", "1", "--append-notes", "First edit")).exitCode).toBe(0);
		expect(await lastCommit()).toEqual([`T\tbacklog/tasks/${TASK_FILE}`]);
		expect(await git("status", "--porcelain")).toBe("?? notes/");

		expect((await backlog("task", "edit", "1", "--append-notes", "Second edit")).exitCode).toBe(0);
		expect(await lastCommit()).toEqual(["A\tnotes/task.md"]);
		expect(await git("status", "--porcelain")).toBe("");
	});

	it.each(INTERFACES)("stages nothing through %s when auto-commit is off", async (_via, changeTask) => {
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await core.filesystem.saveConfig({ ...config, autoCommit: false });
		await replaceWithCommittedLink(join(TEST_DIR, "backlog", "tasks", TASK_FILE), join(TEST_DIR, "notes", "task.md"));
		const head = await git("rev-parse", "HEAD");

		for (const change of ["archive", "restore", "archive", "delete"] as const) {
			expect(await changeTask(change)).toEqual({ ok: true, error: "" });
			expect(await git("diff", "--cached", "--name-only")).toBe("");
		}
		expect(await git("rev-parse", "HEAD")).toBe(head);
		// The commands did run: the link is gone from the board, and that change is not staged.
		expect(await git("diff", "--name-only")).toBe(`backlog/tasks/${TASK_FILE}`);
	});

	it.each(INTERFACES)(
		"says through %s that the commit failed when the archive folder leads outside the repository",
		async (_via, changeTask) => {
			// backlog/archive/tasks is a link to a folder outside the repository. Git tracks the link, not
			// the files behind it, so the file the archive moves there cannot be committed.
			const archive = join(OUTSIDE_DIR, "archived-tasks");
			await mkdir(archive);
			await rm(join(TEST_DIR, "backlog", "archive", "tasks"), { recursive: true, force: true });
			await symlink(archive, join(TEST_DIR, "backlog", "archive", "tasks"));
			await git("add", "-A");
			await git("commit", "-m", "Link the archive folder");
			const head = await git("rev-parse", "HEAD");

			const archived = await changeTask("archive");

			// The move is done and the interface does not pretend that it was committed.
			expect(archived.ok).toBe(false);
			expect(archived.error).toContain("Task TASK-1 was archived, but committing the change failed:");
			expect(await readdir(archive)).toEqual([TASK_FILE]);
			expect(await git("rev-parse", "HEAD")).toBe(head);
		},
	);

	/** Documents and decisions go through the same archive, restore and delete; each kind is checked. */
	const CONTENT_KINDS = [
		{ noun: "document", command: "doc", folder: "docs", id: "doc-1", name: "doc-1 - Linked-record.md" },
		{
			noun: "decision",
			command: "decision",
			folder: "decisions",
			id: "decision-1",
			name: "decision-1 - Linked-record.md",
		},
	] as const;

	it.each(
		CONTENT_KINDS.flatMap((kind) => TARGETS.map(([where, targetOf]) => [kind.noun, where, kind, targetOf] as const)),
	)("archives, restores and deletes a %s as a link when its target is %s", async (_noun, _where, kind, targetOf) => {
		const { noun, command, folder, id, name } = kind;
		expect((await backlog(command, "create", "Linked record")).exitCode).toBe(0);
		await replaceWithCommittedLink(join(TEST_DIR, "backlog", folder, name), targetOf("record.md"));

		const archived = await backlog(command, "archive", id);

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe(`Archived ${noun} ${id}\n`);
		expect(await git("log", "-1", "--format=%s")).toBe(`backlog: Archive ${noun} ${id}`);
		// The commit holds the link under its new path and the removal of the old one, nothing else.
		expect(await lastCommit()).toEqual([`A\tbacklog/archive/${folder}/${name}`, `D\tbacklog/${folder}/${name}`]);
		expect(await trackedMode(`backlog/archive/${folder}/${name}`)).toBe("120000");
		expect(await git("status", "--porcelain")).toBe("");
		expect((await lstat(join(TEST_DIR, "backlog", "archive", folder, name))).isSymbolicLink()).toBe(true);

		expect((await backlog(command, "restore", id)).stdout).toBe(`Restored ${noun} ${id}\n`);
		expect(await git("log", "-1", "--format=%s")).toBe(`backlog: Restore ${noun} ${id}`);
		expect(await lastCommit()).toEqual([`A\tbacklog/${folder}/${name}`, `D\tbacklog/archive/${folder}/${name}`]);
		expect(await trackedMode(`backlog/${folder}/${name}`)).toBe("120000");
		expect(await git("status", "--porcelain")).toBe("");

		expect((await backlog(command, "archive", id)).exitCode).toBe(0);
		expect((await backlog(command, "delete", id)).stdout).toBe(`Deleted ${noun} ${id}\n`);
		expect(await git("log", "-1", "--format=%s")).toBe(`backlog: Delete ${noun} ${id}`);
		// Delete removes the link. The file it pointed to is not the record's to remove.
		expect(await lastCommit()).toEqual([`D\tbacklog/archive/${folder}/${name}`]);
		expect(await git("status", "--porcelain")).toBe("");
		expect((await lstat(targetOf("record.md"))).isFile()).toBe(true);
	});

	it("still commits the file a link points to when a document is edited through the link", async () => {
		expect((await backlog("doc", "create", "Linked doc")).exitCode).toBe(0);
		await replaceWithCommittedLink(
			join(TEST_DIR, "backlog", "docs", "doc-1 - Linked-doc.md"),
			join(TEST_DIR, "notes", "doc.md"),
		);

		// The link itself does not change. The edit lands in the file it points to.
		expect((await backlog("doc", "update", "doc-1", "--content", "Edited through the link")).exitCode).toBe(0);
		expect(await lastCommit()).toEqual(["M\tnotes/doc.md"]);
		expect(await git("status", "--porcelain")).toBe("");
	});

	it("says that the commit failed for a document in a linked folder that Git cannot track", async () => {
		// backlog/docs/shared is a link to a folder outside the repository. Git tracks the link, not
		// the files behind it, so the file the archive moves was never in the repository.
		const shared = join(OUTSIDE_DIR, "shared");
		await mkdir(shared);
		await symlink(shared, join(TEST_DIR, "backlog", "docs", "shared"));
		await new Core(TEST_DIR).createDocumentFromInput({ title: "Shared guide", path: "shared", content: "" }, false);
		await git("add", "-A");
		await git("commit", "-m", "Add the linked folder");
		const head = await git("rev-parse", "HEAD");

		const archived = await backlog("doc", "archive", "doc-1");

		// The move is done and the command does not pretend that it was committed.
		expect(archived.exitCode).toBe(1);
		expect(archived.stderr).toContain("Document doc-1 was archived, but committing the change failed:");
		expect(archived.stdout).toBe("");
		expect(await readdir(join(TEST_DIR, "backlog", "archive", "docs", "shared"))).toEqual(["doc-1 - Shared-guide.md"]);
		expect(await readdir(shared)).toEqual([]);
		expect(await git("rev-parse", "HEAD")).toBe(head);
	});
});
