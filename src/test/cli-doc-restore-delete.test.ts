import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	lstat,
	mkdir,
	readdir,
	readFile,
	readlink,
	realpath,
	rename,
	rm,
	rmdir,
	symlink,
	writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { $ } from "bun";
import { AGENT_GUIDELINES } from "../guidelines/index.ts";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	createTestDirOutsideRepository,
	initializeFilesystemTestProject,
	initializeTestProject,
	isWindows,
	safeCleanup,
} from "./test-utils.ts";

let TEST_DIR: string;
let OUTSIDE_DIR: string;
const CLI_PATH = getTestCliPath();

/** Run `backlog <args>` in the test project and return what a caller of the CLI sees. */
async function backlog(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const result = await $`bun ${[CLI_PATH, ...args]}`.cwd(TEST_DIR).nothrow().quiet();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

const git = async (...args: string[]) => (await $`git ${args}`.cwd(TEST_DIR).quiet().text()).trim();

const docsPath = (...segments: string[]) => join(TEST_DIR, "backlog", "docs", ...segments);
const archivePath = (...segments: string[]) => join(TEST_DIR, "backlog", "archive", "docs", ...segments);

/** Create a document through core, as `backlog doc create` does, and return its file name. */
async function createDocument(title: string, subPath?: string, content = `Body of ${title}`): Promise<string> {
	const document = await new Core(TEST_DIR).createDocumentFromInput({ title, path: subPath, content });
	return (document.path ?? "").split("/").pop() ?? "";
}

/** Create a document and archive it through the CLI; returns its file name. */
async function createArchivedDocument(title: string, subPath?: string): Promise<string> {
	const name = await createDocument(title, subPath);
	const id = name.split(" - ")[0] ?? "";
	expect((await backlog("doc", "archive", id)).exitCode).toBe(0);
	return name;
}

async function exists(path: string): Promise<boolean> {
	return (await lstat(path).catch(() => null)) !== null;
}

/**
 * Every file and link under `dir`, by its path from `dir`: a file with its content, a link with the
 * path it stores. Links are not followed.
 */
async function snapshot(dir: string): Promise<Record<string, string>> {
	const entries: Record<string, string> = {};
	const visit = async (current: string): Promise<void> => {
		for (const entry of await readdir(current, { withFileTypes: true }).catch(() => [])) {
			const path = join(current, entry.name);
			const key = relative(dir, path).split("\\").join("/");
			if (entry.isSymbolicLink()) entries[key] = `link -> ${await readlink(path)}`;
			else if (entry.isDirectory()) await visit(path);
			else entries[key] = await readFile(path, "utf8");
		}
	};
	await visit(dir);
	return entries;
}

const backlogSnapshot = () => snapshot(join(TEST_DIR, "backlog"));

beforeEach(async () => {
	TEST_DIR = await createTestDirOutsideRepository("test-cli-doc-restore-delete");
	OUTSIDE_DIR = await createTestDirOutsideRepository("test-cli-doc-restore-delete-outside");
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
	await safeCleanup(OUTSIDE_DIR);
});

describe("backlog doc restore", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Doc Restore Project");
	});

	it("moves the file, byte for byte, back to the same relative path and creates missing folders", async () => {
		const name = await createArchivedDocument("API Guidelines", "guides/http");
		const archived = await readFile(archivePath("guides", "http", name));
		// The folders the file came from are gone; restore creates them again.
		await rm(docsPath(), { recursive: true, force: true });

		const restored = await backlog("doc", "restore", "doc-1");

		expect(restored.exitCode).toBe(0);
		expect(restored.stdout).toBe("Restored document doc-1\n");
		expect(restored.stderr).toBe("");
		expect((await readFile(docsPath("guides", "http", name))).equals(archived)).toBe(true);
		expect(await exists(archivePath("guides", "http", name))).toBe(false);
	});

	it.each(["doc-1", "1", "doc-001", "DOC-1"])("accepts the ID written as %s, like doc view", async (id) => {
		const name = await createArchivedDocument("Any form");

		const restored = await backlog("doc", "restore", id);

		expect(restored.exitCode).toBe(0);
		expect(restored.stdout).toBe("Restored document doc-1\n");
		expect(await exists(docsPath(name))).toBe(true);
	});

	it("gives back a document that lists, searches and updates like any other", async () => {
		const name = await createArchivedDocument("Runbook");
		expect((await backlog("doc", "list", "--plain")).stdout).not.toContain("Runbook");

		expect((await backlog("doc", "restore", "doc-1")).exitCode).toBe(0);

		expect((await backlog("doc", "list", "--plain")).stdout).toContain("doc-1 - Runbook");
		expect((await backlog("doc", "search", "Runbook")).stdout).toContain("doc-1 - Runbook");
		const view = await backlog("doc", "view", "doc-1", "--plain");
		expect(view.stdout).not.toContain("This document is archived and read-only.");
		const updated = await backlog("doc", "update", "doc-1", "--content", "Changed after the restore");
		expect(updated.exitCode).toBe(0);
		expect(await readFile(docsPath(name), "utf8")).toContain("Changed after the restore");
	});

	it("never replaces a file that is already at the destination path", async () => {
		const name = await createArchivedDocument("Same name", "guides");
		// Another document now sits at the path doc-1 would return to: its frontmatter gives it another ID.
		await mkdir(docsPath("guides"), { recursive: true });
		const archived = await readFile(archivePath("guides", name), "utf8");
		await writeFile(docsPath("guides", name), archived.replace("id: doc-1", "id: doc-9"));
		const before = await backlogSnapshot();

		const refused = await backlog("doc", "restore", "doc-1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toBe(
			`Document doc-1 cannot be restored: the docs folder already has a file at backlog/docs/guides/${name}.\n`,
		);
		expect(refused.stdout).toBe("");
		expect(await backlogSnapshot()).toEqual(before);
	});

	it("refuses a document that is not archived and changes nothing", async () => {
		await createDocument("Still active");
		const before = await backlogSnapshot();

		const refused = await backlog("doc", "restore", "doc-1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toBe("Document doc-1 is not archived, so there is nothing to restore.\n");
		expect(await backlogSnapshot()).toEqual(before);
	});

	it("names the tasks and drafts that list the archive path the file left, and changes none of them", async () => {
		const name = await createArchivedDocument("Moved twice");
		const core = new Core(TEST_DIR);
		await core.createTaskFromInput({
			title: "Names the archive path",
			documentation: [`backlog/archive/docs/${name}`],
		});
		await core.createTaskFromInput({ title: "Names the docs path", documentation: [`backlog/docs/${name}`] });
		const tasksBefore = await snapshot(join(TEST_DIR, "backlog", "tasks"));

		const restored = await backlog("doc", "restore", "doc-1");

		expect(restored.stdout).toBe("Restored document doc-1\nStill listed as documentation by: TASK-1\n");
		expect(await snapshot(join(TEST_DIR, "backlog", "tasks"))).toEqual(tasksBefore);
	});
});

describe("backlog doc delete", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Doc Delete Project");
	});

	it("removes the archived file, after which doc view no longer finds the document", async () => {
		const name = await createArchivedDocument("Obsolete", "guides");

		const deleted = await backlog("doc", "delete", "doc-1");

		expect(deleted.exitCode).toBe(0);
		expect(deleted.stdout).toBe("Deleted document doc-1\n");
		expect(deleted.stderr).toBe("");
		expect(await exists(archivePath("guides", name))).toBe(false);
		expect((await backlog("doc", "view", "doc-1", "--plain")).stderr).toBe("Document doc-1 not found.\n");
	});

	it("refuses a document that is not archived and leaves its file unchanged", async () => {
		const name = await createDocument("Still active");
		const before = await readFile(docsPath(name), "utf8");

		const refused = await backlog("doc", "delete", "doc-1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toBe(
			"Document doc-1 is not archived. A document must be archived before it can be deleted.\n",
		);
		expect(refused.stdout).toBe("");
		expect(await readFile(docsPath(name), "utf8")).toBe(before);
	});

	it("asks nothing and offers no confirmation flag", async () => {
		const name = await createArchivedDocument("No questions");

		const help = await backlog("doc", "delete", "--help");
		const options = help.stdout.split("\n").flatMap((line) => line.match(/^\s+(?:-\w, )?--[\w-]+/) ?? []);
		expect(options.map((option) => option.trim())).toEqual(["-h, --help"]);
		for (const flag of ["--yes", "--force", "-y"]) {
			const rejected = await backlog("doc", "delete", "doc-1", flag);
			expect(rejected.exitCode).not.toBe(0);
			expect(rejected.stderr).toContain("unknown option");
		}
		expect(await exists(archivePath(name))).toBe(true);

		// The test process has no terminal, so a prompt could not have been answered.
		expect((await backlog("doc", "delete", "doc-1")).exitCode).toBe(0);
		expect(await exists(archivePath(name))).toBe(false);
	});

	it("releases the ID, so the next created document receives it", async () => {
		for (const title of ["One", "Two", "Three", "Four", "Five"]) await createDocument(title);
		expect((await backlog("doc", "archive", "doc-5")).exitCode).toBe(0);
		// While doc-5 is only archived, its ID stays taken.
		expect((await backlog("doc", "create", "Six")).stdout).toContain("Created document doc-6\n");
		expect((await backlog("doc", "archive", "doc-6")).exitCode).toBe(0);
		expect((await backlog("doc", "delete", "doc-6")).exitCode).toBe(0);
		expect((await backlog("doc", "delete", "doc-5")).exitCode).toBe(0);

		const created = await backlog("doc", "create", "Created after the deletes");

		expect(created.stdout).toContain("Created document doc-5\n");
	});

	it("keeps the number reserved while another file of this checkout still claims it", async () => {
		await createDocument("One");
		await createArchivedDocument("Two");
		// A file that cannot be read as a document, whose name claims the number 2.
		await writeFile(docsPath("doc-2 - Broken.md"), "---\nid: [unclosed\n---\n");
		expect((await backlog("doc", "delete", "doc-2")).exitCode).toBe(0);

		const created = await backlog("doc", "create", "Created after the delete");

		// Without the other file the number 2 would be free again, as the test above shows.
		expect(created.stdout).toContain("Created document doc-3\n");
	});

	it("names the tasks, archived tasks and drafts that list either path of the removed file, past a damaged draft", async () => {
		const name = await createArchivedDocument("Referenced", "guides");
		const archiveRelative = `backlog/archive/docs/guides/${name}`;
		const docsRelative = `backlog/docs/guides/${name}`;
		const core = new Core(TEST_DIR);
		await core.createTaskFromInput({ title: "Archive path", documentation: [archiveRelative] });
		await core.createTaskFromInput({ title: "Path before the archive", documentation: [docsRelative] });
		await core.createTaskFromInput({ title: "With ./ and a fragment", documentation: [`./${docsRelative}#setup`] });
		await core.createTaskFromInput({ title: "A URL", documentation: [`https://example.com/${docsRelative}`] });
		await core.createTaskFromInput({ title: "An absolute path", documentation: [join(TEST_DIR, docsRelative)] });
		await core.createTaskFromInput({ title: "A bare ID", documentation: ["doc-1"] });
		await core.createTaskFromInput({ title: "Archived and naming it", documentation: [`./${archiveRelative}`] });
		expect((await backlog("task", "archive", "7")).exitCode).toBe(0);
		await core.createTaskFromInput({ title: "A draft", status: "Draft", documentation: [docsRelative] });
		// Reading this draft fails, which must not hide the draft next to it.
		await writeFile(
			join(TEST_DIR, "backlog", "drafts", "draft-2 - Bad.md"),
			"---\nid: DRAFT-2\ntitle: Bad\ndependencies:\n  - { nested: true }\n---\n",
		);
		const tasksBefore = await snapshot(join(TEST_DIR, "backlog", "tasks"));
		const archivedTasksBefore = await snapshot(join(TEST_DIR, "backlog", "archive", "tasks"));
		const draftsBefore = await snapshot(join(TEST_DIR, "backlog", "drafts"));

		const deleted = await backlog("doc", "delete", "doc-1");

		expect(deleted.exitCode).toBe(0);
		expect(deleted.stdout).toBe(
			"Deleted document doc-1\nStill listed as documentation by: TASK-1, TASK-2, TASK-3, TASK-7, DRAFT-1\n",
		);
		// Delete changes no task file and no draft file.
		expect(await snapshot(join(TEST_DIR, "backlog", "tasks"))).toEqual(tasksBefore);
		expect(await snapshot(join(TEST_DIR, "backlog", "archive", "tasks"))).toEqual(archivedTasksBefore);
		expect(await snapshot(join(TEST_DIR, "backlog", "drafts"))).toEqual(draftsBefore);
	});
});

describe("backlog doc restore and delete with IDs no single file claims", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Doc Lookup Project");
	});

	it.each(["restore", "delete"])("doc %s answers not found for an ID no document claims", async (command) => {
		await createArchivedDocument("Exists");
		const before = await backlogSnapshot();

		const missing = await backlog("doc", command, "doc-42");

		expect(missing.exitCode).toBe(1);
		expect(missing.stderr).toBe("Document not found: doc-42\n");
		expect(await backlogSnapshot()).toEqual(before);
	});

	it.each(["restore", "delete"])("doc %s fails closed for an ID claimed in both folders", async (command) => {
		const name = await createArchivedDocument("Claimed twice");
		await writeFile(docsPath(name), await readFile(archivePath(name)));
		const before = await backlogSnapshot();

		const ambiguous = await backlog("doc", command, "doc-1");

		expect(ambiguous.exitCode).toBe(1);
		expect(ambiguous.stderr).toContain("Document ID doc-1 is ambiguous; 2 files match:");
		expect(ambiguous.stderr).toContain(`  - backlog/archive/docs/${name}`);
		expect(ambiguous.stderr).toContain(`  - backlog/docs/${name}`);
		expect(await backlogSnapshot()).toEqual(before);
	});
});

describe("the read-only message of an archived document", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Read-only Project");
	});

	it("names the restore command for doc update and doc archive", async () => {
		await createArchivedDocument("Archived");
		const message =
			"Document doc-1 is archived. Archived documents are read-only. Restore it first: backlog doc restore doc-1\n";

		for (const args of [
			["doc", "update", "doc-1", "--content", "New body"],
			["doc", "archive", "doc-1"],
		]) {
			const refused = await backlog(...args);
			expect(refused.exitCode).toBe(1);
			expect(refused.stderr).toBe(message);
		}
	});
});

describe.skipIf(isWindows())("backlog doc restore and delete with symbolic links", () => {
	beforeEach(async () => {
		// Real paths, so relative links between the project and the outside folder resolve on macOS too.
		TEST_DIR = await realpath(TEST_DIR);
		OUTSIDE_DIR = await realpath(OUTSIDE_DIR);
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Doc Link Project");
	});

	/** Archive doc-1 and turn its archived file into a link to a file kept at `targetPath`. */
	async function archiveAsLink(relativeLink: boolean, targetPath: string): Promise<string> {
		const name = await createArchivedDocument("Linked", "guides");
		const archived = archivePath("guides", name);
		await mkdir(dirname(targetPath), { recursive: true });
		await rename(archived, targetPath);
		await symlink(relativeLink ? relative(dirname(archived), targetPath) : targetPath, archived);
		return name;
	}

	it.each([
		["a relative link to a file inside the project", true, () => join(TEST_DIR, "notes", "doc.md")],
		["an absolute link to a file outside the project", false, () => join(OUTSIDE_DIR, "doc.md")],
	])("restores %s as a link to the same file", async (_kind, relativeLink, target) => {
		const targetPath = target();
		const name = await archiveAsLink(relativeLink, targetPath);
		const content = await readFile(targetPath, "utf8");

		const restored = await backlog("doc", "restore", "doc-1");

		expect(restored.exitCode).toBe(0);
		const restoredPath = docsPath("guides", name);
		expect((await lstat(restoredPath)).isSymbolicLink()).toBe(true);
		expect(await realpath(restoredPath)).toBe(targetPath);
		expect(await readFile(targetPath, "utf8")).toBe(content);
		expect(await exists(archivePath("guides", name))).toBe(false);
	});

	it.each([
		["inside the project", () => join(TEST_DIR, "notes", "doc.md")],
		["outside the project", () => join(OUTSIDE_DIR, "doc.md")],
	])("deletes only the link when the archived file is a link to a file %s", async (_where, target) => {
		const targetPath = target();
		const name = await archiveAsLink(true, targetPath);
		const content = await readFile(targetPath, "utf8");

		const deleted = await backlog("doc", "delete", "doc-1");

		expect(deleted.exitCode).toBe(0);
		expect(await exists(archivePath("guides", name))).toBe(false);
		expect(await readFile(targetPath, "utf8")).toBe(content);
	});
});

describe("backlog doc restore and delete in a Git repository", () => {
	const NAME = "doc-1 - API-Guidelines.md";

	async function setUpRepository(autoCommit: boolean, subPath = "guides"): Promise<void> {
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doc Restore Delete Commit Project", true);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await core.filesystem.saveConfig({ ...config, autoCommit, remoteOperations: false });
		expect(await createDocument("API Guidelines", subPath)).toBe(NAME);
		await core.archiveContentRecord("document", "doc-1", false);
		await git("add", "-A");
		await git("commit", "-m", "Set up the project");
	}

	/** Other work in progress: one change staged, one not. Neither belongs in a commit of Backlog. */
	async function startOtherWork(): Promise<void> {
		await writeFile(join(TEST_DIR, "staged.txt"), "staged by the user\n");
		await git("add", "staged.txt");
		await writeFile(join(TEST_DIR, "untracked.txt"), "not staged\n");
	}

	it("commits the restore as the move of the file and nothing else when auto-commit is on", async () => {
		await setUpRepository(true);
		await startOtherWork();
		const commitsBefore = Number(await git("rev-list", "--count", "HEAD"));

		expect((await backlog("doc", "restore", "doc-1")).exitCode).toBe(0);

		expect(Number(await git("rev-list", "--count", "HEAD"))).toBe(commitsBefore + 1);
		expect(await git("log", "-1", "--format=%s")).toBe("backlog: Restore document doc-1");
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(
			`R100\tbacklog/archive/docs/guides/${NAME}\tbacklog/docs/guides/${NAME}`,
		);
		expect(await git("status", "--porcelain")).toBe("A  staged.txt\n?? untracked.txt");
	});

	it("commits the delete as the removal of the file and nothing else when auto-commit is on", async () => {
		await setUpRepository(true);
		await startOtherWork();
		const commitsBefore = Number(await git("rev-list", "--count", "HEAD"));

		expect((await backlog("doc", "delete", "doc-1")).exitCode).toBe(0);

		expect(Number(await git("rev-list", "--count", "HEAD"))).toBe(commitsBefore + 1);
		expect(await git("log", "-1", "--format=%s")).toBe("backlog: Delete document doc-1");
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(`D\tbacklog/archive/docs/guides/${NAME}`);
		expect(await git("status", "--porcelain")).toBe("A  staged.txt\n?? untracked.txt");
	});

	it.each([
		[false, 0],
		[true, 0],
		[false, 1],
		[true, 1],
		[false, 3],
		[true, 3],
	] as const)(
		"commits both record paths after an uncommitted archive (archive staged: %s, removed parents: %s)",
		async (stageArchive, removedParents) => {
			await setUpRepository(false, "guides/http/api");
			expect((await backlog("doc", "restore", "doc-1")).exitCode).toBe(0);
			await writeFile(join(TEST_DIR, "unstaged.txt"), "original\n");
			await git("add", "-A");
			await git("commit", "-m", "Track the active document");
			const activePath = `backlog/docs/guides/http/api/${NAME}`;
			const archivedPath = `backlog/archive/docs/guides/http/api/${NAME}`;
			const headBefore = await git("rev-parse", "HEAD");

			expect((await backlog("doc", "archive", "doc-1")).exitCode).toBe(0);
			expect(await git("rev-parse", "HEAD")).toBe(headBefore);
			expect(await git("diff", "--cached", "--name-only")).toBe("");
			if (stageArchive) await git("add", "--", activePath, archivedPath);
			for (const folder of ["guides/http/api", "guides/http", "guides"].slice(0, removedParents)) {
				await rmdir(docsPath(folder));
			}
			expect((await backlog("config", "set", "autoCommit", "true")).exitCode).toBe(0);
			await startOtherWork();
			await writeFile(join(TEST_DIR, "staged.txt"), "unstaged edit of staged work\n");
			await writeFile(join(TEST_DIR, "unstaged.txt"), "user edit\n");
			const unrelatedPaths = ["staged.txt", "unstaged.txt", "backlog/config.yml"];
			const stagedBefore = await git("diff", "--cached", "--", ...unrelatedPaths);
			const unstagedBefore = await git("diff", "--", ...unrelatedPaths);
			const commitsBefore = Number(await git("rev-list", "--count", "HEAD"));

			const deleted = await backlog("doc", "delete", "doc-1");

			expect(deleted).toEqual({ exitCode: 0, stdout: "Deleted document doc-1\n", stderr: "" });
			expect(Number(await git("rev-list", "--count", "HEAD"))).toBe(commitsBefore + 1);
			expect(await git("ls-tree", "-r", "--name-only", "HEAD", "--", activePath, archivedPath)).toBe("");
			expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(`D\t${activePath}`);
			expect(await git("diff", "--cached", "--", ...unrelatedPaths)).toBe(stagedBefore);
			expect(await git("diff", "--", ...unrelatedPaths)).toBe(unstagedBefore);
			expect(await readFile(join(TEST_DIR, "untracked.txt"), "utf8")).toBe("not staged\n");
			expect(await exists(docsPath("guides/http/api", NAME))).toBe(false);
			expect(await exists(archivePath("guides/http/api", NAME))).toBe(false);
			expect((await backlog("doc", "create", "Created after mixed auto-commit")).stdout).toContain(
				"Created document doc-1\n",
			);
		},
	);

	it("makes no commit and stages nothing for restore and delete when auto-commit is off", async () => {
		await setUpRepository(false);
		const head = await git("rev-parse", "HEAD");

		expect((await backlog("doc", "restore", "doc-1")).exitCode).toBe(0);
		expect(await git("diff", "--cached", "--name-only")).toBe("");
		expect((await backlog("doc", "archive", "doc-1")).exitCode).toBe(0);
		expect((await backlog("doc", "delete", "doc-1")).exitCode).toBe(0);
		expect(await git("diff", "--cached", "--name-only")).toBe("");

		expect(await git("rev-parse", "HEAD")).toBe(head);
		expect(await exists(archivePath("guides", NAME))).toBe(false);
	});

	it("releases the ID of a deleted document when auto-commit is on", async () => {
		await setUpRepository(true);

		expect((await backlog("doc", "delete", "doc-1")).exitCode).toBe(0);

		expect((await backlog("doc", "create", "Created after the delete")).stdout).toContain("Created document doc-1\n");
	});

	it("keeps the number of a committed document until its deletion is committed when auto-commit is off", async () => {
		await setUpRepository(false);
		expect((await backlog("doc", "delete", "doc-1")).exitCode).toBe(0);

		// The last commit still holds the archived file, so the number stays taken.
		expect((await backlog("doc", "create", "Created before the commit")).stdout).toContain("Created document doc-2\n");
		await rm(docsPath("doc-2 - Created-before-the-commit.md"));
		await git("add", "-A");
		await git("commit", "-m", "Commit the deletion");

		expect((await backlog("doc", "create", "Created after the commit")).stdout).toContain("Created document doc-1\n");
	});

	it("keeps the number of a committed document when fetching from the remote fails", async () => {
		await setUpRepository(false);
		const core = new Core(TEST_DIR);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await core.filesystem.saveConfig({ ...config, remoteOperations: true });
		// A remote whose path does not exist, so every fetch fails.
		await git("remote", "add", "origin", join(OUTSIDE_DIR, "missing-remote"));
		expect((await backlog("doc", "delete", "doc-1")).exitCode).toBe(0);

		// The last commit still holds the archived file, so the number stays taken.
		expect((await backlog("doc", "create", "Created after the delete")).stdout).toContain("Created document doc-2\n");
	});

	it("keeps the number reserved while a committed file on another branch still claims it", async () => {
		await setUpRepository(true);
		// Another branch still holds the archived file in its last commit.
		await git("branch", "other");
		expect((await backlog("doc", "delete", "doc-1")).exitCode).toBe(0);

		expect((await backlog("doc", "create", "Created after the delete")).stdout).toContain("Created document doc-2\n");
	});
});

describe("doc restore and doc delete help and guides", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Doc Help Project");
	});

	it("lists restore and delete in doc help and describes each with an example", async () => {
		const docHelp = await backlog("doc", "--help");
		expect(docHelp.stdout).toMatch(/restore <docId>\s+move an archived document back to the docs folder/);
		expect(docHelp.stdout).toMatch(/delete <docId>\s+permanently delete an archived document/);

		const restoreHelp = await backlog("doc", "restore", "--help");
		expect(restoreHelp.exitCode).toBe(0);
		expect(restoreHelp.stdout).toContain("Usage: backlog doc restore [options] <docId>");
		expect(restoreHelp.stdout).toContain("- docId: Document ID - Archived document to restore");
		expect(restoreHelp.stdout).toContain("back to the same relative path under backlog/docs");
		expect(restoreHelp.stdout).toContain("Examples:\n  backlog doc restore doc-1");

		const deleteHelp = await backlog("doc", "delete", "--help");
		expect(deleteHelp.exitCode).toBe(0);
		expect(deleteHelp.stdout).toContain("Usage: backlog doc delete [options] <docId>");
		expect(deleteHelp.stdout).toContain("- docId: Document ID - Archived document to delete");
		expect(deleteHelp.stdout).toContain("There is no prompt.");
		expect(deleteHelp.stdout).toContain("Its ID is released");
		expect(deleteHelp.stdout).toContain("Examples:\n  backlog doc archive doc-1\n  backlog doc delete doc-1");
	});

	it("is described in the shipped guides and in CLI-INSTRUCTIONS.md", async () => {
		const executionGuide = (await backlog("instructions", "task-execution")).stdout;
		const cliInstructions = await readFile(join(import.meta.dir, "..", "..", "CLI-INSTRUCTIONS.md"), "utf8");

		for (const guide of [executionGuide, AGENT_GUIDELINES, cliInstructions]) {
			expect(guide).toContain("backlog doc restore doc-1");
			expect(guide).toContain("backlog doc delete doc-1");
			// Two steps, no question, the ID released, tasks reported and not changed.
			expect(guide).toMatch(/takes two steps|archive first|Archive first/);
			expect(guide).toMatch(/asks no question/);
			expect(guide).toMatch(/releases the ID/);
			expect(guide).toMatch(/printed, not changed|changes no task|Delete changes no task/);
		}
	});
});
