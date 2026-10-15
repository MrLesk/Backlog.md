import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, readFile, readlink, realpath, rename, symlink, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { $ } from "bun";
import { AGENT_GUIDELINES } from "../guidelines/index.ts";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	createTestDirOutsideRepository,
	HAS_PSEUDO_TERMINAL,
	initializeFilesystemTestProject,
	initializeTestProject,
	isWindows,
	runCliInPseudoTerminal,
	safeCleanup,
} from "./test-utils.ts";

let TEST_DIR: string;
let OUTSIDE_DIR: string;
const CLI_PATH = getTestCliPath();

const READ_ONLY_MESSAGE = (id: string) =>
	`Document ${id} is archived. Archived documents are read-only. Restore it first: backlog doc restore ${id}`;
const ARCHIVED_LINE = "This document is archived and read-only.";

/** Run `backlog <args>` in the test project and return what a caller of the CLI sees. */
async function backlog(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const result = await $`bun ${[CLI_PATH, ...args]}`.cwd(TEST_DIR).nothrow().quiet();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

const docsPath = (...segments: string[]) => join(TEST_DIR, "backlog", "docs", ...segments);
const archivePath = (...segments: string[]) => join(TEST_DIR, "backlog", "archive", "docs", ...segments);

/** Create a document through core, as `backlog doc create` does, and return its file name. */
async function createDocument(title: string, subPath?: string, content = `Body of ${title}`): Promise<string> {
	const document = await new Core(TEST_DIR).createDocumentFromInput({ title, path: subPath, content });
	return (document.path ?? "").split("/").pop() ?? "";
}

async function exists(path: string): Promise<boolean> {
	return (await lstat(path).catch(() => null)) !== null;
}

/**
 * Every file and link under `dir`, by its path from `dir`: a file with its content, a link with the
 * path it stores. Links are not followed, so a link loop is recorded as one entry.
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
	TEST_DIR = await createTestDirOutsideRepository("test-cli-doc-archive");
	OUTSIDE_DIR = await createTestDirOutsideRepository("test-cli-doc-archive-outside");
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
	await safeCleanup(OUTSIDE_DIR);
});

describe("backlog doc archive", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Doc Archive Project");
	});

	it("moves the file, byte for byte, to the same relative path under archive/docs", async () => {
		const name = await createDocument("API Guidelines", "guides");
		expect(name).toBe("doc-1 - API-Guidelines.md");
		const before = await readFile(docsPath("guides", name));
		// The archive folder for documents does not exist until the first document is archived.
		expect(await exists(archivePath())).toBe(false);

		const archived = await backlog("doc", "archive", "doc-1");

		expect(archived.exitCode).toBe(0);
		// No task names the file, so the confirmation is the only line.
		expect(archived.stdout).toBe("Archived document doc-1\n");
		expect(archived.stderr).toBe("");
		expect(await exists(docsPath("guides", name))).toBe(false);
		expect((await readFile(archivePath("guides", name))).equals(before)).toBe(true);
	});

	it.each(["doc-3", "3", "doc-003", "DOC-3"])("accepts the ID written as %s, like doc view", async (id) => {
		await createDocument("First");
		await createDocument("Second");
		const name = await createDocument("Third");
		expect((await backlog("doc", "view", id, "--plain")).exitCode).toBe(0);

		const archived = await backlog("doc", "archive", id);

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe("Archived document doc-3\n");
		expect(await exists(archivePath(name))).toBe(true);
		expect((await readdir(docsPath())).sort()).toEqual(["doc-1 - First.md", "doc-2 - Second.md"]);
	});

	it("never replaces a file that is already at the destination path", async () => {
		const name = await createDocument("Same name", "guides");
		// Same path in the archive, another document: its frontmatter gives it a different ID.
		const original = await readFile(docsPath("guides", name), "utf8");
		await mkdir(archivePath("guides"), { recursive: true });
		await writeFile(archivePath("guides", name), original.replace("id: doc-1", "id: doc-9"));
		const before = await backlogSnapshot();

		const refused = await backlog("doc", "archive", "1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toBe(
			`Document doc-1 cannot be archived: the archive already has a file at backlog/archive/docs/guides/${name}.\n`,
		);
		expect(refused.stdout).toBe("");
		expect(await backlogSnapshot()).toEqual(before);
	});

	it.skipIf(isWindows())("treats a link whose target is missing as a file at the destination", async () => {
		const name = await createDocument("Blocked by a link");
		await mkdir(archivePath(), { recursive: true });
		// No folder listing returns this link, so only the move itself can find the path taken.
		await symlink(join(OUTSIDE_DIR, "never-created.md"), archivePath(name));
		const before = await backlogSnapshot();

		const refused = await backlog("doc", "archive", "1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain(`the archive already has a file at backlog/archive/docs/${name}.`);
		expect(await backlogSnapshot()).toEqual(before);
		expect(await readdir(OUTSIDE_DIR)).toEqual([]);
	});

	it("refuses a document that is already archived with the read-only message", async () => {
		await createDocument("Archived once");
		expect((await backlog("doc", "archive", "1")).exitCode).toBe(0);
		const before = await backlogSnapshot();

		const again = await backlog("doc", "archive", "1");

		expect(again.exitCode).toBe(1);
		expect(again.stderr).toBe(`${READ_ONLY_MESSAGE("doc-1")}\n`);
		expect(again.stdout).toBe("");
		expect(await backlogSnapshot()).toEqual(before);
	});

	it("reports an ID that no document claims as not found and changes nothing", async () => {
		await createDocument("Only document");
		const before = await backlogSnapshot();

		const missing = await backlog("doc", "archive", "9");

		expect(missing.exitCode).toBe(1);
		expect(missing.stderr).toBe("Document not found: 9\n");
		expect(missing.stdout).toBe("");
		expect(await backlogSnapshot()).toEqual(before);
		expect(await exists(archivePath())).toBe(false);
	});

	it("fails closed when a file in the docs folder and a file in the archive claim one ID", async () => {
		const name = await createDocument("Claimed twice");
		// A file of the same name in the archive that claims the same ID.
		await mkdir(archivePath(), { recursive: true });
		await writeFile(archivePath(name), await readFile(docsPath(name)));
		const before = await backlogSnapshot();

		const archive = await backlog("doc", "archive", "1");
		const view = await backlog("doc", "view", "1", "--plain");
		const update = await backlog("doc", "update", "1", "--title", "Changed");

		for (const refused of [archive, view, update]) {
			expect(refused.exitCode).toBe(1);
			expect(refused.stdout).toBe("");
			// Each file is named with its folder, so the two files of one name can be told apart.
			expect(refused.stderr).toBe(
				[
					"Document ID doc-1 is ambiguous; 2 files match:",
					`  - backlog/archive/docs/${name}`,
					`  - backlog/docs/${name}`,
					"Run 'backlog doctor' to review the conflicting files.",
					"",
				].join("\n"),
			);
		}
		expect(await backlogSnapshot()).toEqual(before);
	});

	it("has doctor report an ID claimed in both folders as a duplicate document ID", async () => {
		const name = await createDocument("Claimed twice", "guides");
		await mkdir(archivePath("guides"), { recursive: true });
		await writeFile(archivePath("guides", name), await readFile(docsPath("guides", name)));

		const doctor = await backlog("doctor");

		expect(doctor.exitCode).toBe(1);
		expect(doctor.stdout).toContain(
			[
				"Duplicate document IDs (diagnostic only):",
				"  doc-1:",
				`    - backlog/archive/docs/guides/${name}`,
				`    - backlog/docs/guides/${name}`,
			].join("\n"),
		);
	});

	it("keeps the ID of an archived document reserved", async () => {
		await createDocument("Stays");
		await createDocument("Goes to the archive");
		expect((await backlog("doc", "archive", "2")).exitCode).toBe(0);

		const created = await backlog("doc", "create", "Created afterwards");

		expect(created.exitCode).toBe(0);
		expect(created.stdout).toContain("Created document doc-3\n");
		expect(await exists(docsPath("doc-3 - Created-afterwards.md"))).toBe(true);
	});

	it("counts the ID in an archived file's frontmatter when its name carries no number", async () => {
		const name = await createDocument("Renamed by hand");
		expect((await backlog("doc", "archive", "1")).exitCode).toBe(0);
		const archived = (await readFile(archivePath(name), "utf8")).replace("id: doc-1", "id: doc-7");
		await writeFile(archivePath("notes.md"), archived);
		await rename(archivePath(name), join(OUTSIDE_DIR, name));

		const created = await backlog("doc", "create", "Next");

		expect(created.stdout).toContain("Created document doc-8\n");
	});

	it("counts the number in an archived file's name when the file cannot be read as a document", async () => {
		await mkdir(archivePath(), { recursive: true });
		await writeFile(archivePath("doc-9 - Broken.md"), "---\nid: [unclosed\n---\n");

		const created = await backlog("doc", "create", "Next");

		expect(created.stdout).toContain("Created document doc-10\n");
	});

	it("keeps an archived document read-only for doc update", async () => {
		await createDocument("Read-only while archived", "guides");
		expect((await backlog("doc", "archive", "1")).exitCode).toBe(0);
		const before = await backlogSnapshot();

		const update = await backlog("doc", "update", "doc-1", "--title", "Must not change", "--content", "New body");

		expect(update.exitCode).toBe(1);
		expect(update.stderr).toBe(`${READ_ONLY_MESSAGE("doc-1")}\n`);
		expect(update.stdout).toBe("");
		// Nothing was rewritten in the archive and nothing was written back under the docs folder.
		expect(await backlogSnapshot()).toEqual(before);
	});

	it("still shows an archived document with doc view, with a line saying it is archived", async () => {
		const name = await createDocument("Kept for reference", "guides", "The body that stays readable.");
		const plainBeforeArchive = await backlog("doc", "view", "1", "--plain");
		expect(plainBeforeArchive.stdout).not.toContain(ARCHIVED_LINE);
		expect((await backlog("doc", "archive", "1")).exitCode).toBe(0);
		const stored = await readFile(archivePath("guides", name), "utf8");

		const view = await backlog("doc", "view", "doc-1", "--plain");

		expect(view.exitCode).toBe(0);
		// The document is printed as before the archive, under the line that says it is archived.
		expect(view.stdout).toBe(`${ARCHIVED_LINE}\n\n${plainBeforeArchive.stdout}`);
		expect(view.stdout).toContain("The body that stays readable.");
		expect(await readFile(archivePath("guides", name), "utf8")).toBe(stored);
	});

	it.skipIf(!HAS_PSEUDO_TERMINAL)("shows the archived line in the interactive viewer too", async () => {
		await createDocument("Viewed in a terminal");
		expect((await backlog("doc", "archive", "1")).exitCode).toBe(0);

		// The viewer stays open until a key closes it: "q" is typed once the end of the line is drawn.
		const viewer = await runCliInPseudoTerminal(CLI_PATH, ["doc", "view", "doc-1"], TEST_DIR, {
			question: "read-only.",
			keys: "q",
		});

		expect(viewer.timedOut).toBe(false);
		expect(viewer.exitCode).toBe(0);
		// The viewer draws the gap between two words by moving the cursor one column, not with a space.
		expect(viewer.output.replaceAll("\u001b[1C", " ")).toContain(ARCHIVED_LINE);
	});

	it("leaves an archived document out of doc list, doc search and search", async () => {
		await createDocument("Retired runbook", undefined, "Runbook steps nobody follows any more.");
		await createDocument("Current runbook", undefined, "Runbook steps in use.");
		expect((await backlog("doc", "archive", "1")).exitCode).toBe(0);

		const list = await backlog("doc", "list", "--plain");
		const docSearch = await backlog("doc", "search", "runbook");
		const search = await backlog("search", "runbook", "--plain");

		for (const output of [list, docSearch, search]) {
			expect(output.exitCode).toBe(0);
			expect(output.stdout).toContain("Current runbook");
			expect(output.stdout).not.toContain("Retired runbook");
			expect(output.stdout).not.toContain("doc-1");
		}
	});

	it.skipIf(isWindows())("keeps file links across document stores out of lists and lookups", async () => {
		const retired = await createDocument("Retired runbook");
		const current = await createDocument("Current runbook");
		expect((await backlog("doc", "archive", "1")).exitCode).toBe(0);
		await symlink(archivePath(retired), docsPath("retired-alias.md"));
		await symlink(docsPath(current), archivePath("current-alias.md"));
		const before = await backlogSnapshot();

		for (const args of [
			["doc", "list", "--plain"],
			["doc", "search", "runbook"],
			["search", "runbook", "--plain"],
		]) {
			const output = await backlog(...args);
			expect(output.exitCode).toBe(0);
			expect(output.stdout).toContain("Current runbook");
			expect(output.stdout).not.toContain("Retired runbook");
		}
		const archivedView = await backlog("doc", "view", "doc-001");
		expect(archivedView.exitCode).toBe(0);
		expect(archivedView.stdout).toContain(ARCHIVED_LINE);
		const activeView = await backlog("doc", "view", "2");
		expect(activeView.exitCode).toBe(0);
		expect(activeView.stdout).not.toContain(ARCHIVED_LINE);
		for (const args of [
			["doc", "archive", "doc-1"],
			["doc", "update", "1", "--content", "Changed"],
		]) {
			const refused = await backlog(...args);
			expect(refused.exitCode).toBe(1);
			expect(refused.stderr).toContain(READ_ONLY_MESSAGE("doc-1"));
		}
		expect(await backlogSnapshot()).toEqual(before);
	});

	it("prints the tasks and drafts whose documentation names the moved file and changes none of them", async () => {
		const name = await createDocument("API Guidelines", "guides");
		const path = `backlog/docs/guides/${name}`;
		const core = new Core(TEST_DIR);
		const createTask = async (title: string, documentation: string, status?: string) =>
			(await core.createTaskFromInput({ title, documentation: [documentation], status })).task.id;

		// These name the file: the path from the project root, with "./" in front, or with a fragment.
		expect(await createTask("Exact path", path)).toBe("TASK-1");
		expect(await createTask("Dot slash", `./${path}`)).toBe("TASK-2");
		expect(await createTask("Fragment", `${path}#authentication`)).toBe("TASK-3");
		// These do not: a URL, an absolute path, a bare ID, and the path from the docs folder.
		await createTask("URL", `https://example.com/${path}`);
		await createTask("Absolute path", docsPath("guides", name));
		await createTask("Bare ID", "doc-1");
		await createTask("Path from the docs folder", `guides/${name}`);
		// An archived task and a draft that name the file are reported too.
		expect(await createTask("Archived task", path)).toBe("TASK-8");
		expect(await core.archiveTask("TASK-8", false)).toBe(true);
		expect(await createTask("Draft", path, "Draft")).toBe("DRAFT-1");
		const recordsBefore = {
			tasks: await snapshot(join(TEST_DIR, "backlog", "tasks")),
			archivedTasks: await snapshot(join(TEST_DIR, "backlog", "archive", "tasks")),
			drafts: await snapshot(join(TEST_DIR, "backlog", "drafts")),
		};
		expect(Object.keys(recordsBefore.tasks)).toHaveLength(7);

		const archived = await backlog("doc", "archive", "doc-1");

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe(
			"Archived document doc-1\nStill listed as documentation by: TASK-1, TASK-2, TASK-3, TASK-8, DRAFT-1\n",
		);
		expect({
			tasks: await snapshot(join(TEST_DIR, "backlog", "tasks")),
			archivedTasks: await snapshot(join(TEST_DIR, "backlog", "archive", "tasks")),
			drafts: await snapshot(join(TEST_DIR, "backlog", "drafts")),
		}).toEqual(recordsBefore);
	});

	it("still names a draft when another draft cannot be read", async () => {
		const name = await createDocument("API Guidelines");
		const core = new Core(TEST_DIR);
		const draft = await core.createTaskFromInput({
			title: "Draft",
			documentation: [`backlog/docs/${name}`],
			status: "Draft",
		});
		expect(draft.task.id).toBe("DRAFT-1");
		// Reading this draft fails, which must not hide the draft next to it.
		await Bun.write(
			join(TEST_DIR, "backlog", "drafts", "draft-2 - Bad.md"),
			"---\nid: DRAFT-2\ntitle: Bad\ndependencies:\n  - { nested: true }\n---\n",
		);

		const archived = await backlog("doc", "archive", "doc-1");

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe("Archived document doc-1\nStill listed as documentation by: DRAFT-1\n");
	});

	it("lists archive in doc help and describes the command with an example", async () => {
		const docHelp = await backlog("doc", "--help");
		expect(docHelp.stdout).toMatch(/^\s+archive <docId>\s+move a document into the archive/m);

		const help = await backlog("doc", "archive", "--help");

		expect(help.exitCode).toBe(0);
		expect(help.stdout).toContain("Usage: backlog doc archive [options] <docId>");
		expect(help.stdout).toContain("- docId: Document ID - Document to archive");
		expect(help.stdout).toContain("to the same relative path under backlog/archive/docs");
		expect(help.stdout).toContain("Its ID stays reserved");
		expect(help.stdout).toContain("Examples:\n  backlog doc archive doc-1");
	});

	it("is described in the shipped guides and in CLI-INSTRUCTIONS.md", async () => {
		const executionGuide = (await backlog("instructions", "task-execution")).stdout;
		const cliInstructions = await readFile(join(import.meta.dir, "..", "..", "CLI-INSTRUCTIONS.md"), "utf8");

		for (const guide of [executionGuide, AGENT_GUIDELINES, cliInstructions]) {
			expect(guide).toContain("backlog doc archive doc-1");
			// Where the file goes, what happens to the ID, and what an archived document still allows.
			expect(guide).toContain("backlog/archive/docs/");
			expect(guide).toMatch(/ID stays reserved/);
			expect(guide).toMatch(/stays viewable/);
			expect(guide).toContain("read-only");
			// Tasks that name the file are reported, never rewritten.
			expect(guide).toMatch(/[Tt]asks and drafts whose documentation (list )?names the (moved (or removed )?)?file/);
			expect(guide).toMatch(/printed, not changed|changes no task/);
		}
	});
});

describe("backlog doc archive in a project with another backlog folder", () => {
	it("uses that folder for the archive, for the documentation match and in its messages", async () => {
		const core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Hidden Backlog Folder", ".backlog");
		const first = (await core.createDocumentFromInput({ title: "First", path: "guides", content: "" })).path ?? "";
		const second = (await core.createDocumentFromInput({ title: "Second", content: "" })).path ?? "";
		await core.createTaskFromInput({ title: "Names the file", documentation: [`.backlog/docs/${first}`] });
		// The same path under the default folder name is another file.
		await core.createTaskFromInput({ title: "Other folder name", documentation: [`backlog/docs/${first}`] });

		const archived = await backlog("doc", "archive", "doc-1");

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe("Archived document doc-1\nStill listed as documentation by: TASK-1\n");
		expect(await exists(join(TEST_DIR, ".backlog", "archive", "docs", first))).toBe(true);
		expect(await exists(join(TEST_DIR, ".backlog", "docs", first))).toBe(false);

		// A taken destination is named with the folder the project uses.
		await writeFile(join(TEST_DIR, ".backlog", "archive", "docs", second), "taken");
		const refused = await backlog("doc", "archive", "doc-2");
		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toBe(
			`Document doc-2 cannot be archived: the archive already has a file at .backlog/archive/docs/${second}.\n`,
		);
	});
});

describe.skipIf(isWindows())("backlog doc archive with symbolic links", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Doc Archive Links Project");
	});

	it.each([
		["an absolute link", (target: string) => target],
		["a relative link", (target: string) => relative(docsPath(), target)],
	])("moves a document file that is %s as a link to the same target", async (_label, linkText) => {
		const name = await createDocument("Linked document");
		// The document's file is a link to a file kept outside the backlog folder.
		const targetPath = join(OUTSIDE_DIR, "linked-document.md");
		await rename(docsPath(name), targetPath);
		await symlink(linkText(targetPath), docsPath(name));
		const targetContent = await readFile(targetPath, "utf8");

		const archived = await backlog("doc", "archive", "1");

		expect(archived.exitCode).toBe(0);
		expect(await exists(docsPath(name))).toBe(false);
		expect((await lstat(archivePath(name))).isSymbolicLink()).toBe(true);
		const linked = resolve(dirname(archivePath(name)), await readlink(archivePath(name)));
		expect(await realpath(linked)).toBe(await realpath(targetPath));
		expect(await readFile(targetPath, "utf8")).toBe(targetContent);
		// The archived link is an ordinary archived document.
		expect((await backlog("doc", "view", "1", "--plain")).stdout).toContain("Body of Linked document");
	});

	it("archives a document inside a symlinked subfolder like any other document", async () => {
		// backlog/docs/shared is a link to a folder outside the backlog folder.
		const sharedDir = join(OUTSIDE_DIR, "shared");
		await mkdir(sharedDir);
		await symlink(sharedDir, docsPath("shared"));
		const name = await createDocument("Shared guide", "shared");
		expect(await readdir(sharedDir)).toEqual([name]);
		const before = await readFile(join(sharedDir, name));

		const archived = await backlog("doc", "archive", "1");

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe("Archived document doc-1\n");
		expect(await readdir(sharedDir)).toEqual([]);
		expect((await lstat(archivePath("shared"))).isDirectory()).toBe(true);
		expect((await readFile(archivePath("shared", name))).equals(before)).toBe(true);
		expect((await backlog("doc", "list", "--plain")).stdout).toBe("No docs found.\n");
	});

	it.each([
		// A link next to the folder that sorts before it, one that sorts after it, and a shorter path.
		["0alias", "guides", "guides"],
		["zalias", "guides", "guides"],
		["shortcut", "a/b/c", "a/b/c"],
	])("keeps a document under its own folder when the link %s -> %s also leads to it", async (link, target, folder) => {
		const name = await createDocument("Nested", folder);
		await symlink(target, docsPath(link));
		// The task names the file by the path of the folder it is really in.
		await new Core(TEST_DIR).createTaskFromInput({
			title: "Names the document",
			documentation: [`backlog/docs/${folder}/${name}`],
		});

		const search = await backlog("doc", "search", "Nested");
		expect(search.stdout).toContain(`path: ${folder}/${name}`);
		expect(search.stdout).not.toContain(link);

		const archived = await backlog("doc", "archive", "doc-1");

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe("Archived document doc-1\nStill listed as documentation by: TASK-1\n");
		// The archive mirrors the real folder, not the link.
		expect(await exists(archivePath(...folder.split("/"), name))).toBe(true);
		expect(await exists(archivePath(link))).toBe(false);
		expect(await exists(docsPath(...folder.split("/"), name))).toBe(false);
	});

	it.each([
		["the docs folder", () => docsPath()],
		["the backlog folder", () => join(TEST_DIR, "backlog")],
	])("is not confused by a folder link in docs that points back at %s", async (_label, loopTarget) => {
		const stays = await createDocument("Stays", "guides");
		const goes = await createDocument("Goes to the archive");
		await symlink(loopTarget(), docsPath("guides", "loop"));

		// Each document is listed once, although the loop makes every file reachable through more paths.
		const list = await backlog("doc", "list", "--plain");
		expect(list.exitCode).toBe(0);
		expect(list.stdout).toBe("doc-2 - Goes to the archive\ndoc-1 - Stays\n");
		expect((await backlog("doc", "view", "doc-1", "--plain")).exitCode).toBe(0);

		const archived = await backlog("doc", "archive", "doc-2");

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe("Archived document doc-2\n");
		expect(await exists(docsPath(goes))).toBe(false);
		expect(await exists(archivePath(goes))).toBe(true);
		// The archived document is archived whichever path leads to it, and the other one is untouched.
		expect((await backlog("doc", "list", "--plain")).stdout).toBe("doc-1 - Stays\n");
		const view = await backlog("doc", "view", "doc-2", "--plain");
		expect(view.exitCode).toBe(0);
		expect(view.stdout).toContain(ARCHIVED_LINE);
		expect(await exists(docsPath("guides", stays))).toBe(true);
		expect((await backlog("doc", "create", "Next")).stdout).toContain("Created document doc-3\n");
	});

	it("is not confused by a folder link in the archive that points back at its parent", async () => {
		await createDocument("Stays");
		const goes = await createDocument("Goes to the archive", "guides");
		expect((await backlog("doc", "archive", "2")).exitCode).toBe(0);
		await symlink(archivePath(), archivePath("guides", "loop"));

		const view = await backlog("doc", "view", "doc-2", "--plain");
		const list = await backlog("doc", "list", "--plain");
		const again = await backlog("doc", "archive", "doc-2");
		const other = await backlog("doc", "archive", "doc-1");

		expect(view.exitCode).toBe(0);
		expect(view.stdout).toContain(ARCHIVED_LINE);
		expect(list.stdout).toBe("doc-1 - Stays\n");
		expect(again.exitCode).toBe(1);
		expect(again.stderr).toBe(`${READ_ONLY_MESSAGE("doc-2")}\n`);
		expect(other.exitCode).toBe(0);
		expect(await exists(archivePath("guides", goes))).toBe(true);
		expect(await exists(archivePath("doc-1 - Stays.md"))).toBe(true);
	});
});

describe("backlog doc archive in a Git repository", () => {
	const git = async (...args: string[]) => (await $`git ${args}`.cwd(TEST_DIR).quiet().text()).trim();
	const NAME = "doc-1 - API-Guidelines.md";

	async function setUpRepository(autoCommit: boolean): Promise<void> {
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Doc Archive Commit Project", true);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await core.filesystem.saveConfig({ ...config, autoCommit, remoteOperations: false });
		expect(await createDocument("API Guidelines", "guides")).toBe(NAME);
		await $`git add -A`.cwd(TEST_DIR).quiet();
		await $`git commit -m "Set up the project"`.cwd(TEST_DIR).quiet().nothrow();
	}

	it("commits the move of the document's file and nothing else when auto-commit is on", async () => {
		await setUpRepository(true);
		// Other work in progress: one change staged, one not. Neither belongs in the archive commit.
		await writeFile(join(TEST_DIR, "staged.txt"), "staged by the user\n");
		await git("add", "staged.txt");
		await writeFile(join(TEST_DIR, "untracked.txt"), "not staged\n");
		const commitsBefore = Number(await git("rev-list", "--count", "HEAD"));

		const archived = await backlog("doc", "archive", "1");

		expect(archived.exitCode).toBe(0);
		expect(Number(await git("rev-list", "--count", "HEAD"))).toBe(commitsBefore + 1);
		expect(await git("log", "-1", "--format=%s")).toBe("backlog: Archive document doc-1");
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(
			`R100\tbacklog/docs/guides/${NAME}\tbacklog/archive/docs/guides/${NAME}`,
		);
		expect(await git("status", "--porcelain")).toBe("A  staged.txt\n?? untracked.txt");
	});

	it("makes no commit and stages nothing when auto-commit is off", async () => {
		await setUpRepository(false);
		const head = await git("rev-parse", "HEAD");

		const archived = await backlog("doc", "archive", "1");

		expect(archived.exitCode).toBe(0);
		expect(await git("rev-parse", "HEAD")).toBe(head);
		expect(await git("diff", "--cached", "--name-only")).toBe("");
		expect(await exists(archivePath("guides", NAME))).toBe(true);
	});

	it("says that the document was archived when only the commit fails", async () => {
		await setUpRepository(true);
		const head = await git("rev-parse", "HEAD");
		// Another Git process holds the index, so the move cannot be staged.
		await writeFile(join(TEST_DIR, ".git", "index.lock"), "");

		const archived = await backlog("doc", "archive", "1");

		expect(archived.exitCode).toBe(1);
		expect(archived.stderr).toContain("Document doc-1 was archived, but committing the change failed:");
		expect(archived.stderr).toContain("index.lock");
		expect(archived.stdout).toBe("");
		expect(await exists(archivePath("guides", NAME))).toBe(true);
		expect(await exists(docsPath("guides", NAME))).toBe(false);
		expect(await git("rev-parse", "HEAD")).toBe(head);
	});

	it("does not hand out the ID of a document that was archived and committed on another branch", async () => {
		await setUpRepository(true);
		// On another branch a second document is created and archived. Both commits stay on that branch.
		await git("switch", "-c", "other");
		expect((await backlog("doc", "create", "Archived elsewhere")).stdout).toContain("Created document doc-2\n");
		expect((await backlog("doc", "archive", "2")).exitCode).toBe(0);
		expect(await git("status", "--porcelain")).toBe("");
		await git("switch", "main");
		expect(await exists(archivePath())).toBe(false);

		const created = await backlog("doc", "create", "Created on main");

		expect(created.exitCode).toBe(0);
		expect(created.stdout).toContain("Created document doc-3\n");
	});
});
