import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { copyFile, lstat, mkdir, readdir, readFile, readlink, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { getTestCliPath } from "./test-cli.ts";
import {
	createTestDirOutsideRepository,
	initializeFilesystemTestProject,
	isWindows,
	safeCleanup,
} from "./test-utils.ts";

const CLI_PATH = getTestCliPath();
const itIfSymlinks = isWindows() ? it.skip : it;

let TEST_DIR: string;
/** A second directory outside the repository, for files kept outside the backlog folder. */
let OUTSIDE_DIR: string;

interface RecordKind {
	label: string;
	folder: string;
	createCommand: string[];
	filePrefix: string;
	/** The first line the create command prints for record number `n`. */
	printed: (n: number) => string;
	/** The ID the record file stores in its frontmatter for record number `n`. */
	storedId: (n: number) => string;
}

const TASK: RecordKind = {
	label: "task",
	folder: "tasks",
	createCommand: ["task", "create"],
	filePrefix: "task",
	printed: (n) => `Created task TASK-${n}`,
	storedId: (n) => `TASK-${n}`,
};
const DRAFT: RecordKind = {
	label: "draft",
	folder: "drafts",
	createCommand: ["task", "create", "--draft"],
	filePrefix: "draft",
	printed: (n) => `Created draft DRAFT-${n}`,
	storedId: (n) => `DRAFT-${n}`,
};
const DOCUMENT: RecordKind = {
	label: "document",
	folder: "docs",
	createCommand: ["doc", "create"],
	filePrefix: "doc",
	printed: (n) => `Created document doc-${n}`,
	storedId: (n) => `doc-${n}`,
};
const DECISION: RecordKind = {
	label: "decision",
	folder: "decisions",
	createCommand: ["decision", "create"],
	filePrefix: "decision",
	printed: (n) => `Created decision decision-${n}`,
	storedId: (n) => `decision-${n}`,
};
const ALL_KINDS = [TASK, DRAFT, DOCUMENT, DECISION];

/** Run `backlog <args>` in the test project and return what a caller of the CLI sees. */
async function backlog(...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const result = await $`bun ${[CLI_PATH, ...args]}`.cwd(TEST_DIR).nothrow().quiet();
	return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function firstLine(text: string): string {
	return text.split("\n")[0] ?? "";
}

function recordsDir(kind: RecordKind): string {
	return join(TEST_DIR, "backlog", kind.folder);
}

function fileName(kind: RecordKind, n: number, title: string): string {
	return `${kind.filePrefix}-${n} - ${title}.md`;
}

/** The name and content of every file in a records folder. */
async function readFolder(dir: string): Promise<Record<string, string>> {
	const files: Record<string, string> = {};
	for (const name of await readdir(dir)) {
		files[name] = await readFile(join(dir, name), "utf8");
	}
	return files;
}

/**
 * Creates record 1 titled "First" and rewrites its stored ID in the other letter case, as a hand
 * edit would: lower case for tasks and drafts, upper case for documents and decisions.
 */
async function createFirstWithIdInOtherLetterCase(kind: RecordKind): Promise<void> {
	await backlog(...kind.createCommand, "First");
	const firstPath = join(recordsDir(kind), fileName(kind, 1, "First"));
	const storedId = kind.storedId(1);
	const otherCaseId = storedId === storedId.toUpperCase() ? storedId.toLowerCase() : storedId.toUpperCase();
	const content = (await readFile(firstPath, "utf8")).replace(`id: ${storedId}\n`, `id: ${otherCaseId}\n`);
	expect(content).toContain(`id: ${otherCaseId}\n`);
	await writeFile(firstPath, content);
}

/**
 * Puts a link whose target is missing at `path`. No folder listing returns such a link, so the
 * number in its name is not counted, yet the path is taken.
 */
async function takePathWithLinkToMissingFile(path: string): Promise<string> {
	const missingTarget = join(OUTSIDE_DIR, "never-created.md");
	await symlink(missingTarget, path);
	return missingTarget;
}

/** Whether this file system treats two names that differ only in letter case as one file. */
async function fileSystemIgnoresLetterCase(): Promise<boolean> {
	await writeFile(join(OUTSIDE_DIR, "CaseProbe"), "");
	return await Bun.file(join(OUTSIDE_DIR, "caseprobe")).exists();
}

beforeEach(async () => {
	TEST_DIR = await createTestDirOutsideRepository("test-cli-create-preserves");
	OUTSIDE_DIR = await createTestDirOutsideRepository("test-cli-create-preserves-outside");
	await initializeFilesystemTestProject(new Core(TEST_DIR), "Create Preserves Files");
});

afterEach(async () => {
	await safeCleanup(TEST_DIR);
	await safeCleanup(OUTSIDE_DIR);
});

describe("creating a record never removes or replaces an existing file", () => {
	for (const kind of ALL_KINDS) {
		it(`${kind.label}: keeps a copied file named for the next number and takes the number after it`, async () => {
			await backlog(...kind.createCommand, "First");
			const dir = recordsDir(kind);
			// A hand-made copy: its name claims number 2 while its frontmatter still says number 1.
			await copyFile(join(dir, fileName(kind, 1, "First")), join(dir, fileName(kind, 2, "Copied")));
			const before = await readFolder(dir);

			const created = await backlog(...kind.createCommand, "Second");

			expect(created.exitCode).toBe(0);
			expect(firstLine(created.stdout)).toBe(kind.printed(3));
			expect(await readFolder(dir)).toEqual({
				...before,
				[fileName(kind, 3, "Second")]: expect.stringContaining(`id: ${kind.storedId(3)}\n`),
			});
		});

		it(`${kind.label}: counts a stored ID written in the other letter case`, async () => {
			await createFirstWithIdInOtherLetterCase(kind);
			const dir = recordsDir(kind);
			const before = await readFolder(dir);

			const created = await backlog(...kind.createCommand, "Second");

			expect(created.exitCode).toBe(0);
			expect(firstLine(created.stdout)).toBe(kind.printed(2));
			expect(await readFolder(dir)).toEqual({
				...before,
				[fileName(kind, 2, "Second")]: expect.stringContaining(`id: ${kind.storedId(2)}\n`),
			});
		});

		itIfSymlinks(`${kind.label}: leaves a symlinked record file and the file it points to alone`, async () => {
			await backlog(...kind.createCommand, "First");
			const dir = recordsDir(kind);
			const firstPath = join(dir, fileName(kind, 1, "First"));
			// The file named for the next number is a link to a file kept outside the backlog folder.
			const linkedFile = join(OUTSIDE_DIR, "linked.md");
			await copyFile(firstPath, linkedFile);
			const linkPath = join(dir, fileName(kind, 2, "Linked"));
			await symlink(linkedFile, linkPath);
			// A folder that links back to itself. It holds no records: a document reachable through two
			// paths is listed twice, which is a different problem from the one tested here.
			await mkdir(join(dir, "nested"));
			await symlink(join(dir, "nested"), join(dir, "nested", "loop"));
			const firstContent = await readFile(firstPath, "utf8");
			const linkedContent = await readFile(linkedFile, "utf8");

			const created = await backlog(...kind.createCommand, "Second");

			expect(created.exitCode).toBe(0);
			expect(firstLine(created.stdout)).toBe(kind.printed(3));
			expect((await readdir(dir)).sort()).toEqual(
				[fileName(kind, 1, "First"), fileName(kind, 2, "Linked"), fileName(kind, 3, "Second"), "nested"].sort(),
			);
			expect((await lstat(linkPath)).isSymbolicLink()).toBe(true);
			expect(await readlink(linkPath)).toBe(linkedFile);
			expect(await readFile(linkedFile, "utf8")).toBe(linkedContent);
			expect(await readFile(firstPath, "utf8")).toBe(firstContent);
		});

		itIfSymlinks(
			`${kind.label}: refuses, names the file and writes nothing when the new file's path is taken`,
			async () => {
				const dir = recordsDir(kind);
				await mkdir(dir, { recursive: true });
				// Number 1 is handed out, and the path of the new file turns out to be taken.
				const takenPath = join(dir, fileName(kind, 1, "Second"));
				const missingTarget = await takePathWithLinkToMissingFile(takenPath);

				const refused = await backlog(...kind.createCommand, "Second");

				expect(refused.exitCode).toBe(1);
				expect(refused.stderr).toContain(join("backlog", kind.folder, fileName(kind, 1, "Second")));
				expect(refused.stderr).toContain("already exists");
				expect(refused.stdout).toBe("");
				expect(await readdir(dir)).toEqual([fileName(kind, 1, "Second")]);
				expect(await readlink(takenPath)).toBe(missingTarget);
				expect(await readdir(OUTSIDE_DIR)).toEqual([]);
			},
		);
	}

	// A document file is listed under any name, so its number is counted and skipped instead.
	for (const kind of [TASK, DRAFT, DECISION]) {
		it(`${kind.label}: never overwrites a file whose name differs only in letter case`, async () => {
			await backlog(...kind.createCommand, "First");
			const dir = recordsDir(kind);
			// The upper-case prefix keeps this file out of the listing that picks the next number.
			const twinName = `${kind.filePrefix.toUpperCase()}-2 - Second.md`;
			await copyFile(join(dir, fileName(kind, 1, "First")), join(dir, twinName));
			const before = await readFolder(dir);

			const created = await backlog(...kind.createCommand, "Second");

			if (await fileSystemIgnoresLetterCase()) {
				// The new file's own path is the twin, so the create is refused.
				expect(created.exitCode).toBe(1);
				expect(created.stderr).toContain("already exists");
				expect(await readFolder(dir)).toEqual(before);
			} else {
				// The twin is a different file, so the new record is written next to it.
				expect(created.exitCode).toBe(0);
				expect(await readFolder(dir)).toEqual({
					...before,
					[fileName(kind, 2, "Second")]: expect.stringContaining(`id: ${kind.storedId(2)}\n`),
				});
			}
		});
	}

	it("draft: counts a stored ID when another draft file cannot be read", async () => {
		await backlog(...DRAFT.createCommand, "First");
		const dir = recordsDir(DRAFT);
		const firstPath = join(dir, fileName(DRAFT, 1, "First"));
		// The stored ID is higher than the number in any file name.
		await writeFile(firstPath, (await readFile(firstPath, "utf8")).replace("id: DRAFT-1\n", "id: DRAFT-5\n"));
		await writeFile(join(dir, fileName(DRAFT, 2, "Broken")), "---\nid: [unclosed\n---\n");
		const before = await readFolder(dir);
		expect(before[fileName(DRAFT, 1, "First")]).toContain("id: DRAFT-5\n");

		const created = await backlog(...DRAFT.createCommand, "Second");

		expect(created.exitCode).toBe(0);
		expect(firstLine(created.stdout)).toBe(DRAFT.printed(6));
		expect(await readFolder(dir)).toEqual({
			...before,
			[fileName(DRAFT, 6, "Second")]: expect.stringContaining("id: DRAFT-6\n"),
		});
	});
});

describe("a title change moves only the file the record was loaded from", () => {
	/**
	 * Creates record 1 titled "Guide" plus a different record (number 99 in its frontmatter) whose
	 * file name starts with the same number. Returns the content of that other record's file.
	 */
	async function createGuideAndRecordSharingItsNumber(kind: RecordKind): Promise<string> {
		await backlog(...kind.createCommand, "Guide");
		const dir = recordsDir(kind);
		const guide = await readFile(join(dir, fileName(kind, 1, "Guide")), "utf8");
		const other = guide.replace(`id: ${kind.storedId(1)}\n`, `id: ${kind.storedId(99)}\n`).replace("Guide", "Other");
		expect(other).toContain(`id: ${kind.storedId(99)}\n`);
		await writeFile(join(dir, fileName(kind, 1, "Other")), other);
		return other;
	}

	// On a file system that ignores letter case, "GUIDE" names the file the record already has.
	for (const newTitle of ["Renamed", "GUIDE"]) {
		it(`document: renames its own file to "${newTitle}" and keeps another record that shares its number`, async () => {
			const other = await createGuideAndRecordSharingItsNumber(DOCUMENT);

			const updated = await backlog("doc", "update", "doc-1", "--title", newTitle);

			expect(updated.exitCode).toBe(0);
			expect(await readFolder(recordsDir(DOCUMENT))).toEqual({
				[fileName(DOCUMENT, 1, "Other")]: other,
				[fileName(DOCUMENT, 1, newTitle)]: expect.stringContaining(`title: ${newTitle}\n`),
			});
		});

		it(`draft: renames its own file to "${newTitle}" and leaves one file`, async () => {
			await backlog(...DRAFT.createCommand, "Guide");

			const edited = await backlog("draft", "edit", "1", "-t", newTitle);

			expect(edited.exitCode).toBe(0);
			expect(await readFolder(recordsDir(DRAFT))).toEqual({
				[fileName(DRAFT, 1, newTitle)]: expect.stringContaining(`title: ${newTitle}\n`),
			});
		});
	}

	it("document: refuses to rename onto another record's file and changes nothing", async () => {
		await createGuideAndRecordSharingItsNumber(DOCUMENT);
		const before = await readFolder(recordsDir(DOCUMENT));

		const refused = await backlog("doc", "update", "doc-1", "--title", "Other");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain(join("backlog", "docs", fileName(DOCUMENT, 1, "Other")));
		expect(refused.stderr).toContain("already exists");
		expect(await readFolder(recordsDir(DOCUMENT))).toEqual(before);
	});

	// Two draft files that share a number already make every edit of that number fail as ambiguous.
	// The path a retitle needs can still be taken by a file that no listing returns.
	itIfSymlinks("draft: refuses a retitle onto a path that is already taken and changes nothing", async () => {
		await backlog(...DRAFT.createCommand, "Guide");
		const dir = recordsDir(DRAFT);
		const guidePath = join(dir, fileName(DRAFT, 1, "Guide"));
		const guide = await readFile(guidePath, "utf8");
		const takenPath = join(dir, fileName(DRAFT, 1, "Other"));
		const missingTarget = await takePathWithLinkToMissingFile(takenPath);

		const refused = await backlog("draft", "edit", "1", "-t", "Other");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain(join("backlog", "drafts", fileName(DRAFT, 1, "Other")));
		expect(refused.stderr).toContain("already exists");
		expect((await readdir(dir)).sort()).toEqual([fileName(DRAFT, 1, "Guide"), fileName(DRAFT, 1, "Other")]);
		expect(await readFile(guidePath, "utf8")).toBe(guide);
		expect(await readlink(takenPath)).toBe(missingTarget);
		expect(await readdir(OUTSIDE_DIR)).toEqual([]);
	});

	// Decisions have no update command; the web UI saves them through this Core method.
	it("decision: renames its own file and keeps another record that shares its number", async () => {
		const other = await createGuideAndRecordSharingItsNumber(DECISION);

		await new Core(TEST_DIR).updateDecisionFromContent("decision-1", "---\ntitle: Renamed\n---\n", false);

		expect(await readFolder(recordsDir(DECISION))).toEqual({
			[fileName(DECISION, 1, "Other")]: other,
			[fileName(DECISION, 1, "Renamed")]: expect.stringContaining("title: Renamed\n"),
		});
	});

	it("decision: keeps the usual file name when the stored ID is written in upper case", async () => {
		await createFirstWithIdInOtherLetterCase(DECISION);

		await new Core(TEST_DIR).updateDecisionFromContent("decision-1", "---\ntitle: Retitled\n---\n", false);

		// The one file is still named decision-1 and the stored ID stays as it was written.
		expect(await readFolder(recordsDir(DECISION))).toEqual({
			[fileName(DECISION, 1, "Retitled")]: expect.stringContaining("id: DECISION-1\ntitle: Retitled\n"),
		});
	});
});

describe("moving a record between tasks and drafts leaves every other file alone", () => {
	it("promote: takes the number after a copied task file and keeps that file", async () => {
		await backlog(...TASK.createCommand, "First");
		const tasksDir = recordsDir(TASK);
		// A hand-made copy: its name claims number 2 while its frontmatter still says number 1.
		await copyFile(join(tasksDir, fileName(TASK, 1, "First")), join(tasksDir, fileName(TASK, 2, "Copied")));
		await backlog(...DRAFT.createCommand, "Idea");
		const tasksBefore = await readFolder(tasksDir);

		const promoted = await backlog("draft", "promote", "1");

		expect(promoted.exitCode).toBe(0);
		expect(promoted.stdout).toBe("Promoted draft DRAFT-1\n");
		expect(await readFolder(tasksDir)).toEqual({
			...tasksBefore,
			[fileName(TASK, 3, "Idea")]: expect.stringContaining("id: TASK-3\n"),
		});
		expect(await readdir(recordsDir(DRAFT))).toEqual([]);
	});

	it("demote: takes the number after a copied draft file and keeps that file", async () => {
		await backlog(...DRAFT.createCommand, "First");
		const draftsDir = recordsDir(DRAFT);
		await copyFile(join(draftsDir, fileName(DRAFT, 1, "First")), join(draftsDir, fileName(DRAFT, 2, "Copied")));
		await backlog(...TASK.createCommand, "Work");
		const draftsBefore = await readFolder(draftsDir);

		const demoted = await backlog("task", "demote", "1");

		expect(demoted.exitCode).toBe(0);
		expect(firstLine(demoted.stdout)).toBe("Demoted task TASK-1");
		expect(await readFolder(draftsDir)).toEqual({
			...draftsBefore,
			[fileName(DRAFT, 3, "Work")]: expect.stringContaining("id: DRAFT-3\n"),
		});
		expect(await readdir(recordsDir(TASK))).toEqual([]);
	});

	itIfSymlinks("demote: refuses when the new draft's path is taken and leaves the task where it is", async () => {
		await backlog(...TASK.createCommand, "Work");
		const taskPath = join(recordsDir(TASK), fileName(TASK, 1, "Work"));
		const task = await readFile(taskPath, "utf8");
		const draftsDir = recordsDir(DRAFT);
		await mkdir(draftsDir, { recursive: true });
		const takenPath = join(draftsDir, fileName(DRAFT, 1, "Work"));
		const missingTarget = await takePathWithLinkToMissingFile(takenPath);

		const refused = await backlog("task", "demote", "1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain(join("backlog", "drafts", fileName(DRAFT, 1, "Work")));
		expect(refused.stderr).toContain("already exists");
		expect(await readFile(taskPath, "utf8")).toBe(task);
		expect(await readdir(draftsDir)).toEqual([fileName(DRAFT, 1, "Work")]);
		expect(await readlink(takenPath)).toBe(missingTarget);
		expect(await readdir(OUTSIDE_DIR)).toEqual([]);
	});

	itIfSymlinks("promote: refuses when the new task's path is taken and leaves the draft where it is", async () => {
		await backlog(...DRAFT.createCommand, "Idea");
		const draftPath = join(recordsDir(DRAFT), fileName(DRAFT, 1, "Idea"));
		const draft = await readFile(draftPath, "utf8");
		const tasksDir = recordsDir(TASK);
		await mkdir(tasksDir, { recursive: true });
		const takenPath = join(tasksDir, fileName(TASK, 1, "Idea"));
		const missingTarget = await takePathWithLinkToMissingFile(takenPath);

		const refused = await backlog("draft", "promote", "1");

		expect(refused.exitCode).toBe(1);
		expect(refused.stderr).toContain(join("backlog", "tasks", fileName(TASK, 1, "Idea")));
		expect(refused.stderr).toContain("already exists");
		expect(refused.stderr).not.toContain("not found");
		expect(refused.stdout).toBe("");
		expect(await readFile(draftPath, "utf8")).toBe(draft);
		expect(await readdir(tasksDir)).toEqual([fileName(TASK, 1, "Idea")]);
		expect(await readlink(takenPath)).toBe(missingTarget);
		expect(await readdir(OUTSIDE_DIR)).toEqual([]);
	});
});
