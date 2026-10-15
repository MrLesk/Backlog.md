import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, readFile, readlink, realpath, rename, rm, symlink, writeFile } from "node:fs/promises";
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

const READ_ONLY_MESSAGE = (id: string) =>
	`Decision ${id} is archived. Archived decisions are read-only. Restore it first: backlog decision restore ${id}`;

/** Run `backlog <args>` in the test project and return what a caller of the CLI sees. */
async function backlog(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const result = await $`bun ${[CLI_PATH, ...args]}`.cwd(TEST_DIR).nothrow().quiet();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

const git = async (...args: string[]) => (await $`git ${args}`.cwd(TEST_DIR).quiet().text()).trim();

const decisionsPath = (...segments: string[]) => join(TEST_DIR, "backlog", "decisions", ...segments);
const archivePath = (...segments: string[]) => join(TEST_DIR, "backlog", "archive", "decisions", ...segments);

/** Create a decision through core, as `backlog decision create` does, and return its file name. */
async function createDecision(title: string): Promise<string> {
	const decision = await new Core(TEST_DIR).createDecisionWithTitle(title);
	return `${decision.id} - ${title.replaceAll(" ", "-")}.md`;
}

/** Create a decision and archive it through the CLI; returns its file name. */
async function createArchivedDecision(title: string): Promise<string> {
	const name = await createDecision(title);
	expect((await backlog("decision", "archive", name.split(" - ")[0] ?? "")).exitCode).toBe(0);
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
	TEST_DIR = await createTestDirOutsideRepository("test-cli-decision-archive");
	OUTSIDE_DIR = await createTestDirOutsideRepository("test-cli-decision-archive-outside");
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
	await safeCleanup(OUTSIDE_DIR);
});

describe("backlog decision archive, restore and delete", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Decision Archive Project");
	});

	it("archives the file, byte for byte and under the same name, and creates the archive folder", async () => {
		const name = await createDecision("Use Bun");
		const before = await readFile(decisionsPath(name));
		expect(await exists(archivePath())).toBe(false);

		const archived = await backlog("decision", "archive", "decision-1");

		expect(archived.exitCode).toBe(0);
		// No task names the file, so the confirmation is the only line.
		expect(archived.stdout).toBe("Archived decision decision-1\n");
		expect(archived.stderr).toBe("");
		expect(await exists(decisionsPath(name))).toBe(false);
		expect((await readFile(archivePath(name))).equals(before)).toBe(true);
	});

	it.each(["decision-2", "2", "decision-002", "DECISION-2"])("accepts the ID written as %s", async (id) => {
		await createDecision("First");
		const name = await createDecision("Second");

		const archived = await backlog("decision", "archive", id);

		expect(archived.exitCode).toBe(0);
		expect(archived.stdout).toBe("Archived decision decision-2\n");
		expect(await exists(archivePath(name))).toBe(true);
	});

	it("restores the file byte for byte, after which decision list shows it again", async () => {
		const name = await createArchivedDecision("Use Postgres");
		const archived = await readFile(archivePath(name));
		expect((await backlog("decision", "list", "--plain")).stdout).toBe("No decisions found.\n");

		const restored = await backlog("decision", "restore", "1");

		expect(restored.exitCode).toBe(0);
		expect(restored.stdout).toBe("Restored decision decision-1\n");
		expect((await readFile(decisionsPath(name))).equals(archived)).toBe(true);
		expect(await exists(archivePath(name))).toBe(false);
		expect((await backlog("decision", "list", "--plain")).stdout).toBe("decision-1 - Use Postgres (proposed)\n");
	});

	it("deletes an archived decision's file", async () => {
		const name = await createArchivedDecision("Obsolete");

		const deleted = await backlog("decision", "delete", "decision-1");

		expect(deleted.exitCode).toBe(0);
		expect(deleted.stdout).toBe("Deleted decision decision-1\n");
		expect(await exists(archivePath(name))).toBe(false);
	});

	it("asks nothing and offers no confirmation flag", async () => {
		const name = await createArchivedDecision("No questions");

		const help = await backlog("decision", "delete", "--help");
		const options = help.stdout.split("\n").flatMap((line) => line.match(/^\s+(?:-\w, )?--[\w-]+/) ?? []);
		expect(options.map((option) => option.trim())).toEqual(["-h, --help"]);
		for (const flag of ["--yes", "--force", "-y"]) {
			const rejected = await backlog("decision", "delete", "decision-1", flag);
			expect(rejected.exitCode).not.toBe(0);
			expect(rejected.stderr).toContain("unknown option");
		}
		expect(await exists(archivePath(name))).toBe(true);

		// The test process has no terminal, so a prompt could not have been answered.
		expect((await backlog("decision", "delete", "decision-1")).exitCode).toBe(0);
		expect(await exists(archivePath(name))).toBe(false);
	});

	it("refuses delete and restore of a decision that is not archived, and changes nothing", async () => {
		await createDecision("Still active");
		const before = await backlogSnapshot();

		const deleted = await backlog("decision", "delete", "decision-1");
		const restored = await backlog("decision", "restore", "decision-1");

		expect(deleted.exitCode).toBe(1);
		expect(deleted.stderr).toBe(
			"Decision decision-1 is not archived. A decision must be archived before it can be deleted.\n",
		);
		expect(restored.exitCode).toBe(1);
		expect(restored.stderr).toBe("Decision decision-1 is not archived, so there is nothing to restore.\n");
		expect(await backlogSnapshot()).toEqual(before);
	});

	it("refuses to archive an archived decision with the read-only message", async () => {
		await createArchivedDecision("Archived once");
		const before = await backlogSnapshot();

		const again = await backlog("decision", "archive", "decision-1");

		expect(again.exitCode).toBe(1);
		expect(again.stderr).toBe(`${READ_ONLY_MESSAGE("decision-1")}\n`);
		expect(await backlogSnapshot()).toEqual(before);
	});

	it("never replaces a file on archive or on restore", async () => {
		const first = await createDecision("Same name");
		// Another decision's file sits at the archive path decision-1 would move to.
		await mkdir(archivePath(), { recursive: true });
		await writeFile(
			archivePath(first),
			(await readFile(decisionsPath(first), "utf8")).replace("id: decision-1", "id: decision-9"),
		);
		let before = await backlogSnapshot();

		const archived = await backlog("decision", "archive", "decision-1");

		expect(archived.exitCode).toBe(1);
		expect(archived.stderr).toBe(
			`Decision decision-1 cannot be archived: the archive already has a file at backlog/archive/decisions/${first}.\n`,
		);
		expect(await backlogSnapshot()).toEqual(before);

		// And the other way: a second decision is archived while another file took its name in the folder.
		const second = await createArchivedDecision("Returns later");
		const secondId = second.split(" - ")[0] ?? "";
		await writeFile(
			decisionsPath(second),
			(await readFile(archivePath(second), "utf8")).replace(`id: ${secondId}`, "id: decision-8"),
		);
		before = await backlogSnapshot();

		const restored = await backlog("decision", "restore", secondId);

		expect(restored.exitCode).toBe(1);
		expect(restored.stderr).toBe(
			`Decision ${secondId} cannot be restored: the decisions folder already has a file at backlog/decisions/${second}.\n`,
		);
		expect(await backlogSnapshot()).toEqual(before);
	});

	it.each(["archive", "restore", "delete"])(
		"decision %s answers not found for an ID no decision claims",
		async (command) => {
			await createArchivedDecision("Exists");
			const before = await backlogSnapshot();

			const missing = await backlog("decision", command, "decision-42");

			expect(missing.exitCode).toBe(1);
			expect(missing.stderr).toBe("Decision not found: decision-42\n");
			expect(await backlogSnapshot()).toEqual(before);
		},
	);

	it.each(["archive", "restore", "delete"])(
		"decision %s fails closed for an ID claimed in both folders",
		async (command) => {
			const name = await createArchivedDecision("Claimed twice");
			await writeFile(decisionsPath(name), await readFile(archivePath(name)));
			const before = await backlogSnapshot();

			const ambiguous = await backlog("decision", command, "decision-1");

			expect(ambiguous.exitCode).toBe(1);
			expect(ambiguous.stdout).toBe("");
			// Each file is named with its folder, so the two files of one name can be told apart.
			expect(ambiguous.stderr).toBe(
				[
					"Decision ID decision-1 is ambiguous; 2 files match:",
					`  - backlog/archive/decisions/${name}`,
					`  - backlog/decisions/${name}`,
					"Run 'backlog doctor' to review the conflicting files.",
					"",
				].join("\n"),
			);
			expect(await backlogSnapshot()).toEqual(before);
		},
	);

	it("has doctor report an ID claimed in both folders as a duplicate decision ID", async () => {
		const name = await createArchivedDecision("Claimed twice");
		await writeFile(decisionsPath(name), await readFile(archivePath(name)));

		const doctor = await backlog("doctor");

		expect(doctor.exitCode).toBe(1);
		expect(doctor.stdout).toContain(
			[
				"Duplicate decision IDs (diagnostic only):",
				"  decision-1:",
				`    - backlog/archive/decisions/${name}`,
				`    - backlog/decisions/${name}`,
			].join("\n"),
		);
	});

	it("keeps the ID of an archived decision reserved", async () => {
		await createDecision("Stays");
		await createArchivedDecision("Goes to the archive");

		const created = await backlog("decision", "create", "Created afterwards");

		expect(created.stdout).toBe("Created decision decision-3\n");
	});

	it("counts an archived decision by the ID in its frontmatter and by the number in its name", async () => {
		const name = await createArchivedDecision("Renamed by hand");
		// The ID is only in the frontmatter: the file name carries no number.
		const content = (await readFile(archivePath(name), "utf8")).replace("id: decision-1", "id: decision-7");
		await writeFile(archivePath("decision-notes.md"), content);
		await rm(archivePath(name));
		expect((await backlog("decision", "create", "Next")).stdout).toBe("Created decision decision-8\n");

		// The number is only in the file name: the file cannot be read as a decision.
		await writeFile(archivePath("decision-12 - Broken.md"), "---\nid: [unclosed\n---\n");
		expect((await backlog("decision", "create", "After the broken file")).stdout).toBe(
			"Created decision decision-13\n",
		);
	});

	it("releases the ID, so the next created decision receives it", async () => {
		for (const title of ["One", "Two", "Three"]) await createDecision(title);
		expect((await backlog("decision", "archive", "decision-3")).exitCode).toBe(0);
		expect((await backlog("decision", "delete", "decision-3")).exitCode).toBe(0);

		const created = await backlog("decision", "create", "Created after the delete");

		expect(created.stdout).toBe("Created decision decision-3\n");
	});

	it("keeps the number reserved while another file of this checkout still claims it", async () => {
		await createDecision("One");
		await createArchivedDecision("Two");
		// A file that cannot be read as a decision, whose name claims the number 2.
		await writeFile(decisionsPath("decision-2 - Broken.md"), "---\nid: [unclosed\n---\n");
		expect((await backlog("decision", "delete", "decision-2")).exitCode).toBe(0);

		// Without the other file the number 2 would be free again, as the test above shows.
		expect((await backlog("decision", "create", "Created after the delete")).stdout).toBe(
			"Created decision decision-3\n",
		);
	});

	it("leaves an archived decision out of decision list, plain and --json, and out of search", async () => {
		await createDecision("Retired runbook policy");
		await createDecision("Current runbook policy");
		expect((await backlog("decision", "archive", "1")).exitCode).toBe(0);

		const plain = await backlog("decision", "list", "--plain");
		const json = JSON.parse((await backlog("decision", "list", "--json")).stdout) as {
			decisions: Array<{ id: string }>;
		};
		const search = await backlog("search", "runbook", "--plain");

		expect(plain.stdout).toBe("decision-2 - Current runbook policy (proposed)\n");
		expect(json.decisions.map((decision) => decision.id)).toEqual(["decision-2"]);
		expect(search.stdout).toContain("Current runbook policy");
		expect(search.stdout).not.toContain("Retired runbook policy");
	});

	it("names the tasks, archived tasks and drafts that list the file, changing none of them", async () => {
		const name = await createDecision("Referenced");
		const decisionsRelative = `backlog/decisions/${name}`;
		const archiveRelative = `backlog/archive/decisions/${name}`;
		const core = new Core(TEST_DIR);
		await core.createTaskFromInput({ title: "Names the path", documentation: [decisionsRelative] });
		await core.createTaskFromInput({ title: "With ./ and a fragment", documentation: [`./${decisionsRelative}#why`] });
		await core.createTaskFromInput({ title: "A URL", documentation: [`https://example.com/${decisionsRelative}`] });
		await core.createTaskFromInput({ title: "An absolute path", documentation: [join(TEST_DIR, decisionsRelative)] });
		await core.createTaskFromInput({ title: "A bare ID", documentation: ["decision-1"] });
		await core.createTaskFromInput({ title: "Names the archive path", documentation: [archiveRelative] });
		await core.createTaskFromInput({ title: "Archived and naming it", documentation: [decisionsRelative] });
		expect((await backlog("task", "archive", "7")).exitCode).toBe(0);
		await core.createTaskFromInput({ title: "A draft", status: "Draft", documentation: [decisionsRelative] });
		const tasksBefore = await snapshot(join(TEST_DIR, "backlog", "tasks"));
		const archivedTasksBefore = await snapshot(join(TEST_DIR, "backlog", "archive", "tasks"));
		const draftsBefore = await snapshot(join(TEST_DIR, "backlog", "drafts"));

		// Archive names the records that list the path the file had before the move.
		const archived = await backlog("decision", "archive", "decision-1");
		expect(archived.stdout).toBe(
			"Archived decision decision-1\nStill listed as documentation by: TASK-1, TASK-2, TASK-7, DRAFT-1\n",
		);
		// Restore names the records that list the archive path it left.
		const restored = await backlog("decision", "restore", "decision-1");
		expect(restored.stdout).toBe("Restored decision decision-1\nStill listed as documentation by: TASK-6\n");
		// Delete names the records that list either path.
		expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
		const deleted = await backlog("decision", "delete", "decision-1");
		expect(deleted.stdout).toBe(
			"Deleted decision decision-1\nStill listed as documentation by: TASK-1, TASK-2, TASK-6, TASK-7, DRAFT-1\n",
		);

		expect(await snapshot(join(TEST_DIR, "backlog", "tasks"))).toEqual(tasksBefore);
		expect(await snapshot(join(TEST_DIR, "backlog", "archive", "tasks"))).toEqual(archivedTasksBefore);
		expect(await snapshot(join(TEST_DIR, "backlog", "drafts"))).toEqual(draftsBefore);
	});
});

describe.skipIf(isWindows())("backlog decision archive, restore and delete with symbolic links", () => {
	beforeEach(async () => {
		// Real paths, so relative links between the project and the outside folder resolve on macOS too.
		TEST_DIR = await realpath(TEST_DIR);
		OUTSIDE_DIR = await realpath(OUTSIDE_DIR);
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Decision Link Project");
	});

	/** Turn decision-1's file into a link to a file kept at `targetPath`. */
	async function makeLink(relativeLink: boolean, targetPath: string): Promise<string> {
		const name = await createDecision("Linked");
		const path = decisionsPath(name);
		await mkdir(dirname(targetPath), { recursive: true });
		await rename(path, targetPath);
		await symlink(relativeLink ? relative(dirname(path), targetPath) : targetPath, path);
		return name;
	}

	it.each([
		["a relative link to a file inside the project", true, () => join(TEST_DIR, "notes", "decision.md")],
		["an absolute link to a file outside the project", false, () => join(OUTSIDE_DIR, "decision.md")],
	])(
		"archives and restores %s as a link to the same file, and deletes only the link",
		async (_kind, relativeLink, target) => {
			const targetPath = target();
			const name = await makeLink(relativeLink, targetPath);
			const content = await readFile(targetPath, "utf8");

			expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
			expect((await lstat(archivePath(name))).isSymbolicLink()).toBe(true);
			expect(await realpath(archivePath(name))).toBe(targetPath);

			expect((await backlog("decision", "restore", "decision-1")).exitCode).toBe(0);
			expect((await lstat(decisionsPath(name))).isSymbolicLink()).toBe(true);
			expect(await realpath(decisionsPath(name))).toBe(targetPath);

			expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
			expect((await backlog("decision", "delete", "decision-1")).exitCode).toBe(0);
			expect(await exists(archivePath(name))).toBe(false);
			expect(await readFile(targetPath, "utf8")).toBe(content);
		},
	);
});

describe("backlog decision archive, restore and delete in a Git repository", () => {
	const NAME = "decision-1 - Use-Bun.md";

	async function setUpRepository(autoCommit: boolean): Promise<void> {
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		const core = new Core(TEST_DIR);
		await initializeTestProject(core, "Decision Commit Project", true);
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await core.filesystem.saveConfig({ ...config, autoCommit, remoteOperations: false });
		expect(await createDecision("Use Bun")).toBe(NAME);
		await git("add", "-A");
		await git("commit", "-m", "Set up the project");
	}

	it("commits each archive, restore and delete on its own, with nothing else in it", async () => {
		await setUpRepository(true);
		// Other work in progress: one change staged, one not. Neither belongs in a commit of Backlog.
		await writeFile(join(TEST_DIR, "staged.txt"), "staged by the user\n");
		await git("add", "staged.txt");
		await writeFile(join(TEST_DIR, "untracked.txt"), "not staged\n");
		const commitsBefore = Number(await git("rev-list", "--count", "HEAD"));

		expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
		expect(await git("log", "-1", "--format=%s")).toBe("backlog: Archive decision decision-1");
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(
			`R100\tbacklog/decisions/${NAME}\tbacklog/archive/decisions/${NAME}`,
		);

		expect((await backlog("decision", "restore", "decision-1")).exitCode).toBe(0);
		expect(await git("log", "-1", "--format=%s")).toBe("backlog: Restore decision decision-1");
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(
			`R100\tbacklog/archive/decisions/${NAME}\tbacklog/decisions/${NAME}`,
		);

		expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
		expect((await backlog("decision", "delete", "decision-1")).exitCode).toBe(0);
		expect(await git("log", "-1", "--format=%s")).toBe("backlog: Delete decision decision-1");
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(`D\tbacklog/archive/decisions/${NAME}`);

		expect(Number(await git("rev-list", "--count", "HEAD"))).toBe(commitsBefore + 4);
		expect(await git("status", "--porcelain")).toBe("A  staged.txt\n?? untracked.txt");
	});

	it.each([false, true])(
		"commits both record paths after an uncommitted archive (archive staged: %s)",
		async (stageArchive) => {
			await setUpRepository(false);
			await writeFile(join(TEST_DIR, "unstaged.txt"), "original\n");
			await git("add", "unstaged.txt");
			await git("commit", "-m", "Track unrelated work");
			const activePath = `backlog/decisions/${NAME}`;
			const archivedPath = `backlog/archive/decisions/${NAME}`;
			const headBefore = await git("rev-parse", "HEAD");

			expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
			expect(await git("rev-parse", "HEAD")).toBe(headBefore);
			expect(await git("diff", "--cached", "--name-only")).toBe("");
			if (stageArchive) await git("add", "--", activePath, archivedPath);
			expect((await backlog("config", "set", "autoCommit", "true")).exitCode).toBe(0);
			await writeFile(join(TEST_DIR, "staged.txt"), "staged by the user\n");
			await git("add", "staged.txt");
			await writeFile(join(TEST_DIR, "staged.txt"), "unstaged edit of staged work\n");
			await writeFile(join(TEST_DIR, "unstaged.txt"), "user edit\n");
			await writeFile(join(TEST_DIR, "untracked.txt"), "not staged\n");
			const unrelatedPaths = ["staged.txt", "unstaged.txt", "backlog/config.yml"];
			const stagedBefore = await git("diff", "--cached", "--", ...unrelatedPaths);
			const unstagedBefore = await git("diff", "--", ...unrelatedPaths);
			const commitsBefore = Number(await git("rev-list", "--count", "HEAD"));

			const deleted = await backlog("decision", "delete", "decision-1");

			expect(deleted).toEqual({ exitCode: 0, stdout: "Deleted decision decision-1\n", stderr: "" });
			expect(Number(await git("rev-list", "--count", "HEAD"))).toBe(commitsBefore + 1);
			expect(await git("ls-tree", "-r", "--name-only", "HEAD", "--", activePath, archivedPath)).toBe("");
			expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(`D\t${activePath}`);
			expect(await git("diff", "--cached", "--", ...unrelatedPaths)).toBe(stagedBefore);
			expect(await git("diff", "--", ...unrelatedPaths)).toBe(unstagedBefore);
			expect(await readFile(join(TEST_DIR, "untracked.txt"), "utf8")).toBe("not staged\n");
			expect(await exists(decisionsPath(NAME))).toBe(false);
			expect(await exists(archivePath(NAME))).toBe(false);
			expect((await backlog("decision", "create", "Created after mixed auto-commit")).stdout).toBe(
				"Created decision decision-1\n",
			);
		},
	);

	it("makes no commit and stages nothing when auto-commit is off", async () => {
		await setUpRepository(false);
		const head = await git("rev-parse", "HEAD");

		for (const command of ["archive", "restore", "archive", "delete"]) {
			expect((await backlog("decision", command, "decision-1")).exitCode).toBe(0);
			expect(await git("diff", "--cached", "--name-only")).toBe("");
		}

		expect(await git("rev-parse", "HEAD")).toBe(head);
		expect(await exists(archivePath(NAME))).toBe(false);
	});

	it("releases the ID of a deleted decision when auto-commit is on", async () => {
		await setUpRepository(true);
		expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
		expect((await backlog("decision", "delete", "decision-1")).exitCode).toBe(0);

		expect((await backlog("decision", "create", "Created after the delete")).stdout).toBe(
			"Created decision decision-1\n",
		);
	});

	it("keeps the number of a committed decision until its deletion is committed when auto-commit is off", async () => {
		await setUpRepository(false);
		expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
		expect((await backlog("decision", "delete", "decision-1")).exitCode).toBe(0);

		// The last commit still holds the file, so the number stays taken.
		expect((await backlog("decision", "create", "Created before the commit")).stdout).toBe(
			"Created decision decision-2\n",
		);
		await rm(decisionsPath("decision-2 - Created-before-the-commit.md"));
		await git("add", "-A");
		await git("commit", "-m", "Commit the deletion");

		expect((await backlog("decision", "create", "Created after the commit")).stdout).toBe(
			"Created decision decision-1\n",
		);
	});

	it("keeps the number reserved while a committed file on another branch still claims it", async () => {
		await setUpRepository(true);
		// Another branch still holds the decision in its last commit.
		await git("branch", "other");
		expect((await backlog("decision", "archive", "decision-1")).exitCode).toBe(0);
		expect((await backlog("decision", "delete", "decision-1")).exitCode).toBe(0);

		expect((await backlog("decision", "create", "Created after the delete")).stdout).toBe(
			"Created decision decision-2\n",
		);
	});

	it("does not hand out the ID of a decision that was archived and committed on another branch", async () => {
		await setUpRepository(true);
		await git("switch", "-c", "other");
		expect((await backlog("decision", "create", "Archived elsewhere")).stdout).toBe("Created decision decision-2\n");
		expect((await backlog("decision", "archive", "2")).exitCode).toBe(0);
		await git("switch", "main");
		expect(await exists(archivePath())).toBe(false);

		expect((await backlog("decision", "create", "Created on main")).stdout).toBe("Created decision decision-3\n");
	});
});

describe("decision archive, restore and delete help and guides", () => {
	beforeEach(async () => {
		await initializeFilesystemTestProject(new Core(TEST_DIR), "Decision Help Project");
	});

	it("lists archive, restore and delete in decision help and describes each with an example", async () => {
		const decisionHelp = await backlog("decision", "--help");
		expect(decisionHelp.stdout).toMatch(/archive <decisionId>\s+move a decision into the archive/);
		expect(decisionHelp.stdout).toMatch(/restore <decisionId>\s+move an archived decision back/);
		expect(decisionHelp.stdout).toMatch(/delete <decisionId>\s+permanently delete an archived decision/);

		for (const [command, schemaLine, example] of [
			["archive", "- decisionId: Decision ID - Decision to archive", "backlog decision archive decision-1"],
			["restore", "- decisionId: Decision ID - Archived decision to restore", "backlog decision restore decision-1"],
			["delete", "- decisionId: Decision ID - Archived decision to delete", "backlog decision delete decision-1"],
		] as const) {
			const help = await backlog("decision", command, "--help");
			expect(help.exitCode).toBe(0);
			expect(help.stdout).toContain(`Usage: backlog decision ${command} [options] <decisionId>`);
			expect(help.stdout).toContain(schemaLine);
			expect(help.stdout).toContain(example);
		}
	});

	it("is described in the shipped guides and in CLI-INSTRUCTIONS.md", async () => {
		const executionGuide = (await backlog("instructions", "task-execution")).stdout;
		const cliInstructions = await readFile(join(import.meta.dir, "..", "..", "CLI-INSTRUCTIONS.md"), "utf8");

		for (const guide of [executionGuide, AGENT_GUIDELINES, cliInstructions]) {
			expect(guide).toContain("backlog decision archive decision-1");
			expect(guide).toContain("backlog decision restore decision-1");
			expect(guide).toContain("backlog decision delete decision-1");
			expect(guide).toContain("backlog/archive/decisions/");
			// The reserved ID, the read-only state, and delete without a question that releases the ID.
			expect(guide).toMatch(/ID (stays )?reserved/);
			expect(guide).toContain("read-only");
			expect(guide).toMatch(/without a question|asks no question/);
			expect(guide).toMatch(/releases the ID/);
		}
	});
});
