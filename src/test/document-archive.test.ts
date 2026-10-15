import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmod, mkdir, readdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	ContentRecordArchivedError,
	ContentRecordFileExistsError,
	ContentRecordNotArchivedError,
	Core,
	RecordRefusedError,
} from "../core/backlog.ts";
import { EntityType } from "../types/index.ts";
import { AmbiguousIdError } from "../utils/entity-id.ts";
import { documentationEntryNamesFile, formatDocumentationReferencesMessage } from "../utils/task-links.ts";
import {
	createTestDirOutsideRepository,
	initializeFilesystemTestProject,
	isWindows,
	safeCleanup,
} from "./test-utils.ts";

describe("documentationEntryNamesFile", () => {
	const path = "backlog/docs/guides/doc-3 - API-Guidelines.md";

	it.each([
		["the path from the project root", path],
		["the path with ./ in front", `./${path}`],
		["the path with a fragment", `${path}#authentication`],
		["the path with ./ in front and a fragment", `./${path}#authentication`],
		["the path with spaces around it", `  ${path}  `],
	])("matches %s", (_label, entry) => {
		expect(documentationEntryNamesFile(entry, path)).toBe(true);
	});

	it.each([
		["a URL that ends in the path", `https://example.com/${path}`],
		["an absolute path", `/home/me/project/${path}`],
		["a bare document ID", "doc-3"],
		["the path from the docs folder", "guides/doc-3 - API-Guidelines.md"],
		["the file name alone", "doc-3 - API-Guidelines.md"],
		["another file that starts with the same characters", `${path}.bak`],
		["the path with ../ in front", `../${path}`],
		["the path with ./ twice in front", `././${path}`],
		["the path in another letter case", path.toUpperCase()],
		["the archive path of the same file", "backlog/archive/docs/guides/doc-3 - API-Guidelines.md"],
		["an empty entry", ""],
	])("does not match %s", (_label, entry) => {
		expect(documentationEntryNamesFile(entry, path)).toBe(false);
	});

	it("takes the fragment after the whole path when the file name contains #", () => {
		const named = "backlog/docs/doc-4 - C#-Notes.md";
		expect(documentationEntryNamesFile(named, named)).toBe(true);
		expect(documentationEntryNamesFile(`${named}#intro`, named)).toBe(true);
		expect(documentationEntryNamesFile("backlog/docs/doc-4 - C", named)).toBe(false);
	});
});

describe("formatDocumentationReferencesMessage", () => {
	it("names the records on one line and says nothing when there are none", () => {
		expect(formatDocumentationReferencesMessage(["TASK-2", "DRAFT-1"])).toBe(
			"Still listed as documentation by: TASK-2, DRAFT-1",
		);
		expect(formatDocumentationReferencesMessage([])).toBeNull();
	});
});

describe("archived documents in core and storage", () => {
	let TEST_DIR: string;
	let core: Core;

	const docsPath = (...segments: string[]) => join(TEST_DIR, "backlog", "docs", ...segments);
	const archivePath = (...segments: string[]) => join(TEST_DIR, "backlog", "archive", "docs", ...segments);

	async function createDocument(title: string, subPath?: string): Promise<string> {
		const document = await core.createDocumentFromInput({ title, path: subPath, content: `Body of ${title}` });
		return document.path ?? "";
	}

	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("test-document-archive");
		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Document Archive Core");
	});

	afterEach(async () => {
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(TEST_DIR);
	});

	it("archives through one core function that reports what it did and refuses with typed errors", async () => {
		const path = await createDocument("API Guidelines", "guides");
		await core.createTaskFromInput({ title: "Names the file", documentation: [`backlog/docs/${path}`] });

		expect(await core.archiveContentRecord("document", "9")).toBeNull();
		expect(await core.archiveContentRecord("document", "doc-001")).toEqual({
			id: "doc-1",
			listedAsDocumentationBy: ["TASK-1"],
		});

		const again = await core.archiveContentRecord("document", "doc-1").catch((error: unknown) => error);
		expect(again).toBeInstanceOf(ContentRecordArchivedError);
		expect(again).toBeInstanceOf(RecordRefusedError);
		const update = await core
			.updateDocumentFromInput({ id: "doc-1", content: "New body" })
			.catch((error: unknown) => error);
		expect(update).toBeInstanceOf(ContentRecordArchivedError);
		expect((update as Error).message).toBe((again as Error).message);
	});

	it("refuses a taken destination with a typed error and leaves both files alone", async () => {
		const path = await createDocument("Same name");
		const original = await readFile(docsPath(path), "utf8");
		await mkdir(archivePath(), { recursive: true });
		await writeFile(archivePath(path), original.replace("id: doc-1", "id: doc-9"));

		const refused = await core.archiveContentRecord("document", "doc-1").catch((error: unknown) => error);

		expect(refused).toBeInstanceOf(ContentRecordFileExistsError);
		expect(refused).toBeInstanceOf(RecordRefusedError);
		expect(await readFile(docsPath(path), "utf8")).toBe(original);
		expect(await readFile(archivePath(path), "utf8")).toContain("id: doc-9");
	});

	it("lists archived documents apart from the documents in the docs folder", async () => {
		await createDocument("Stays");
		const archivedPath = await createDocument("Goes to the archive", "guides");
		await core.archiveContentRecord("document", "doc-2");

		expect((await core.filesystem.listDocuments()).map((document) => document.id)).toEqual(["doc-1"]);
		const archived = await core.filesystem.listArchivedDocuments();
		expect(archived).toHaveLength(1);
		expect(archived[0]).toMatchObject({ id: "doc-2", path: archivedPath, archived: true });
		expect((await core.getDocument("doc-1"))?.archived).toBeUndefined();
		expect((await core.getDocument("doc-2"))?.archived).toBe(true);
		// The docs-folder loader does not see the archive; user-facing lookups go through core.
		expect(core.filesystem.loadDocument("doc-2")).rejects.toThrow("Document not found: doc-2");
	});

	it("never saves an archived document, so no second file can appear for its ID", async () => {
		await createDocument("Read-only while archived");
		await core.archiveContentRecord("document", "doc-1");
		const archived = await core.getDocument("doc-1");
		if (!archived) throw new Error("Expected the archived document");

		const saved = await core.filesystem
			.saveDocument({ ...archived, title: "Changed" })
			.catch((error: unknown) => error);

		expect(saved).toBeInstanceOf(Error);
		expect((saved as Error).message).toContain("Cannot save document doc-1: it is archived");
		expect(await readdir(docsPath())).toEqual([]);
		expect(await readdir(archivePath())).toEqual(["doc-1 - Read-only-while-archived.md"]);
	});

	it("counts archived documents in the core ID allocator as well", async () => {
		await createDocument("Stays");
		await createDocument("Goes to the archive");
		await core.archiveContentRecord("document", "doc-2");

		// This allocator writes the prefix in upper case; the number is what the archive must reserve.
		expect((await core.generateNextId(EntityType.Document)).toLowerCase()).toBe("doc-3");
	});

	it("takes an archived document out of an initialized content store without a file watcher", async () => {
		await createDocument("Stays");
		await createDocument("Goes to the archive");
		// This Core runs no watchers, so only the archive operation itself can update the store.
		const store = await core.getContentStore();
		expect(store.getDocuments().map((document) => document.id)).toEqual(["doc-2", "doc-1"]);

		await core.archiveContentRecord("document", "doc-2");

		expect(store.getDocuments().map((document) => document.id)).toEqual(["doc-1"]);
	});

	it("restores and deletes through one core function each, refusing with typed errors", async () => {
		const path = await createDocument("API Guidelines", "guides");
		await core.createTaskFromInput({ title: "Names the old path", documentation: [`backlog/docs/${path}`] });
		await core.createTaskFromInput({ title: "Names the archive", documentation: [`backlog/archive/docs/${path}`] });

		for (const operation of ["restore", "delete"] as const) {
			const run = () =>
				operation === "restore"
					? core.restoreContentRecord("document", "doc-1")
					: core.deleteContentRecord("document", "doc-1");
			const refused = await run().catch((error: unknown) => error);
			expect(refused).toBeInstanceOf(ContentRecordNotArchivedError);
			expect(refused).toBeInstanceOf(RecordRefusedError);
		}
		expect(await core.restoreContentRecord("document", "9")).toBeNull();
		expect(await core.deleteContentRecord("document", "9")).toBeNull();

		await core.archiveContentRecord("document", "doc-1");
		// Restore names the records that list the archive path the file left.
		expect(await core.restoreContentRecord("document", "doc-001")).toEqual({
			id: "doc-1",
			listedAsDocumentationBy: ["TASK-2"],
		});
		await core.archiveContentRecord("document", "doc-1");
		// Delete names the records that list either path of the removed file.
		expect(await core.deleteContentRecord("document", "doc-1")).toEqual({
			id: "doc-1",
			listedAsDocumentationBy: ["TASK-1", "TASK-2"],
		});
		expect(await core.getDocument("doc-1")).toBeNull();
	});

	it("puts a restored document into an initialized content store without a file watcher", async () => {
		await createDocument("Stays");
		await createDocument("Comes back");
		await core.archiveContentRecord("document", "doc-2");
		// This Core runs no watchers, so only the restore operation itself can update the store.
		const store = await core.getContentStore();
		expect(store.getDocuments().map((document) => document.id)).toEqual(["doc-1"]);

		await core.restoreContentRecord("document", "doc-2");

		expect(store.getDocuments().map((document) => document.id)).toEqual(["doc-2", "doc-1"]);
		// A restored document looks like one listed from the docs folder: it has no `archived` key.
		const restored = store.getDocuments().find((document) => document.id === "doc-2");
		expect(restored && "archived" in restored).toBe(false);
	});

	describe("removeArchivedContentRecordFile", () => {
		it("removes the file of an archived document and returns its path", async () => {
			const path = await createDocument("Goes for good", "guides");
			await core.archiveContentRecord("document", "doc-1");
			const archived = await core.getDocument("doc-1");
			if (!archived) throw new Error("Expected the archived document");

			expect(await core.filesystem.removeArchivedContentRecordFile("document", archived)).toBe(
				archivePath(...path.split("/")),
			);
			expect(await readdir(archivePath("guides"))).toEqual([]);
		});

		it("refuses a document that is not archived and removes nothing", async () => {
			const path = await createDocument("Active");
			const active = await core.getDocument("doc-1");
			if (!active) throw new Error("Expected the document");

			const refused = core.filesystem.removeArchivedContentRecordFile("document", active);

			await expect(refused).rejects.toThrow(
				"The file of document doc-1 was not removed: the document is not archived.",
			);
			expect(await readdir(docsPath())).toEqual([path]);
		});

		it("refuses a file that another document took the place of, and removes nothing", async () => {
			const path = await createDocument("Listed first");
			await core.archiveContentRecord("document", "doc-1");
			const archived = await core.getDocument("doc-1");
			if (!archived) throw new Error("Expected the archived document");
			// After the lookup another document's file is written to the same path.
			const replacement = (await readFile(archivePath(path), "utf8")).replace("id: doc-1", "id: doc-4");
			await writeFile(archivePath(path), replacement);

			const refused = core.filesystem.removeArchivedContentRecordFile("document", archived);

			await expect(refused).rejects.toThrow(`backlog/archive/docs/${path} is the file of doc-4.`);
			expect(await readFile(archivePath(path), "utf8")).toBe(replacement);
		});

		it("refuses a path that climbs out of the archive folder", async () => {
			await createDocument("Kept");
			const outside = join(TEST_DIR, "backlog", "archive", "escape.md");
			await writeFile(outside, "not a document");

			const refused = core.filesystem.removeArchivedContentRecordFile("document", {
				id: "doc-1",
				path: "../escape.md",
				archived: true,
			});

			await expect(refused).rejects.toThrow("Document path cannot include traversal segments.");
			expect(await readFile(outside, "utf8")).toBe("not a document");
		});

		it.skipIf(isWindows())("removes a link as a link and leaves the file it points to", async () => {
			const path = await createDocument("Linked");
			await core.archiveContentRecord("document", "doc-1");
			const target = join(TEST_DIR, "kept.md");
			await rename(archivePath(path), target);
			await symlink(target, archivePath(path));
			const archived = await core.getDocument("doc-1");
			if (!archived) throw new Error("Expected the archived document");

			await core.filesystem.removeArchivedContentRecordFile("document", archived);

			expect(await readdir(archivePath())).toEqual([]);
			expect(await readFile(target, "utf8")).toContain("id: doc-1");
		});
	});

	it.skipIf(isWindows())("lists a file once when a folder link makes it reachable through more paths", async () => {
		await createDocument("Top level");
		await createDocument("Nested", "guides");
		// One link back to the docs folder and one to the parent of the folder it is in.
		await symlink(docsPath(), docsPath("self"));
		await symlink("..", docsPath("guides", "up"));

		const documents = await core.filesystem.listDocuments();

		// Each document once, under the path of the folder it is really in.
		expect(documents.map((document) => document.path).sort()).toEqual([
			"doc-1 - Top-level.md",
			"guides/doc-2 - Nested.md",
		]);
		expect((await core.getDocument("doc-2"))?.path).toBe("guides/doc-2 - Nested.md");
		const report = await core.diagnoseContentIdentity();
		expect(report.documents.duplicates).toEqual([]);
	});

	it.skipIf(isWindows()).each([
		// The link's path is as long as the folder's own and sorts before it, or after it.
		["a link that sorts before the folder", "0alias", "guides", "guides"],
		["a link that sorts after the folder", "zalias", "guides", "guides"],
		// The link's path is shorter than the folder's own.
		["a shortcut to a deep folder", "shortcut", "a/b/c", "a/b/c"],
		// The link sits deeper than the folder it leads to.
		["a link from a deeper folder", "x/y/back", "../../guides", "guides"],
	])(
		"lists a document under the folder it is really in when %s leads there too",
		async (_label, link, target, folder) => {
			const path = await createDocument("Nested", folder);
			await mkdir(docsPath(...link.split("/").slice(0, -1)), { recursive: true });
			await symlink(target, docsPath(...link.split("/")));

			const documents = await core.filesystem.listDocuments();

			expect(path).toBe(`${folder}/doc-1 - Nested.md`);
			expect(documents.map((document) => document.path)).toEqual([path]);
			const [listed] = documents;
			if (!listed) throw new Error("Expected the document to be listed");
			// The path a task's `documentation` entry and the archive destination are built from.
			expect(core.filesystem.contentRecordProjectPath("document", listed)).toBe(`backlog/docs/${path}`);
		},
	);

	it.skipIf(isWindows())("reads a folder outside the docs folder once, under the shortest link to it", async () => {
		const outside = await createTestDirOutsideRepository("test-document-archive-outside");
		try {
			// Two links lead to the same outside folder, and that folder links back to itself.
			await mkdir(docsPath("deep", "er"), { recursive: true });
			await symlink(outside, docsPath("deep", "er", "long-way"));
			await symlink(outside, docsPath("short-way"));
			await symlink(outside, join(outside, "again"));
			const path = await createDocument("Kept outside", "short-way");

			const documents = await core.filesystem.listDocuments();

			expect(documents.map((document) => document.path)).toEqual([path]);
			expect(path).toBe("short-way/doc-1 - Kept-outside.md");
		} finally {
			await safeCleanup(outside);
		}
	});

	it.skipIf(isWindows())("ends on link loops that lead into each other, however deep they nest", async () => {
		await createDocument("Top level");
		await createDocument("Nested", "guides/deep");
		// Every folder holds a link back to the docs folder, so each loop leads into all the others.
		await symlink(docsPath(), docsPath("a"));
		await symlink(docsPath(), docsPath("guides", "b"));
		await symlink(docsPath("guides"), docsPath("guides", "deep", "c"));
		await symlink("../..", docsPath("guides", "deep", "d"));

		const documents = await core.filesystem.listDocuments();

		expect(documents.map((document) => document.path).sort()).toEqual([
			"doc-1 - Top-level.md",
			"guides/deep/doc-2 - Nested.md",
		]);
	});

	it.skipIf(isWindows())(
		"takes the same files for documents as before: no hidden ones, no missing targets",
		async () => {
			const listed = await createDocument("Listed", "guides");
			const content = await readFile(docsPath(listed), "utf8");
			const variant = (id: string) => content.replace("id: doc-1", `id: ${id}`);
			// A link to a file is a document. These are not: hidden names, another extension, an extension
			// in upper case, a link whose target is missing, and a README.
			await symlink(docsPath(listed), docsPath("doc-2 - Link-to-a-file.md"));
			await writeFile(docsPath(".doc-3 - Hidden-file.md"), variant("doc-3"));
			await mkdir(docsPath(".hidden"));
			await writeFile(docsPath(".hidden", "doc-4 - In-a-hidden-folder.md"), variant("doc-4"));
			await writeFile(docsPath("doc-5 - Text-file.txt"), variant("doc-5"));
			await writeFile(docsPath("doc-6 - UPPER.MD"), variant("doc-6"));
			await symlink(docsPath("never-created.md"), docsPath("doc-7 - Missing-target.md"));
			await writeFile(docsPath("guides", "README.md"), variant("doc-8"));
			const unreadable: string[] = [];

			const documents = await core.filesystem.listDocuments(unreadable);

			expect(documents.map((document) => document.path).sort()).toEqual(["doc-2 - Link-to-a-file.md", listed]);
			expect(unreadable).toEqual([]);
		},
	);

	it.skipIf(isWindows())("reports a subfolder it cannot read and still lists the other documents", async () => {
		await createDocument("Readable");
		const locked = await createDocument("Locked away", "private");
		await chmod(docsPath("private"), 0o000);
		// chmod changes nothing for root, so make sure the folder really cannot be read.
		const reallyLocked = await readdir(docsPath("private")).then(
			() => false,
			() => true,
		);
		try {
			if (!reallyLocked) return;
			const unreadable: string[] = [];

			const documents = await core.filesystem.listDocuments(unreadable);

			expect(documents.map((document) => document.id)).toEqual(["doc-1"]);
			expect(unreadable).toEqual(["private"]);
			expect((await core.diagnoseContentIdentity()).documents.unreadable).toEqual(["backlog/docs/private"]);
		} finally {
			await chmod(docsPath("private"), 0o755);
		}
		expect(locked).toBe("private/doc-2 - Locked-away.md");
	});

	it.skipIf(isWindows()).each(["same store", "outside"])(
		"still fails closed for two different file links to one target in %s",
		async (where) => {
			const outside = await createTestDirOutsideRepository("test-document-links-outside");
			try {
				const path = await createDocument("Linked twice");
				const target = where === "outside" ? join(outside, path) : docsPath(path);
				if (where === "outside") await rename(docsPath(path), target);
				await symlink(target, docsPath("doc-1 - First-link.md"));
				await symlink(target, docsPath("doc-1 - Second-link.md"));
				const before = (await readdir(docsPath())).sort();

				expect((await core.filesystem.listDocuments()).map((document) => document.path).sort()).toEqual(before);
				const lookup = await core.getDocument("doc-1").catch((error: unknown) => error);
				const archive = await core.archiveContentRecord("document", "doc-1").catch((error: unknown) => error);

				expect(lookup).toBeInstanceOf(AmbiguousIdError);
				expect(archive).toBeInstanceOf(AmbiguousIdError);
				expect((await readdir(docsPath())).sort()).toEqual(before);
			} finally {
				await safeCleanup(outside);
			}
		},
	);

	it.skipIf(isWindows()).each([false, true])(
		"keeps store membership for a file link to an opposite-store document (archived: %s)",
		async (archived) => {
			const path = await createDocument("Linked across stores", "guides");
			await mkdir(archivePath(), { recursive: true });
			if (archived) await core.archiveContentRecord("document", "doc-1");
			const target = archived ? archivePath(path) : docsPath(path);
			const link = archived ? docsPath("alias.md") : archivePath("alias.md");
			await symlink(target, link);

			expect((await core.filesystem.listDocuments()).map((document) => document.path)).toEqual(archived ? [] : [path]);
			expect((await core.filesystem.listArchivedDocuments()).map((document) => document.path)).toEqual(
				archived ? [path] : [],
			);
			expect(await core.getDocument("doc-001")).toMatchObject({ id: "doc-1", path });
			expect((await core.getDocument("1"))?.archived).toBe(archived ? true : undefined);
			expect((await core.diagnoseContentIdentity()).documents.duplicates).toEqual([]);
			if (archived) {
				await expect(core.updateDocumentFromInput({ id: "1", content: "Changed" })).rejects.toBeInstanceOf(
					ContentRecordArchivedError,
				);
			}
		},
	);

	it.skipIf(isWindows())("does not list an archived document as active through a link into the archive", async () => {
		await createDocument("Stays");
		await createDocument("Goes to the archive");
		await core.archiveContentRecord("document", "doc-2");
		// A link in the docs folder that leads into the archive, and one in the archive that leads back.
		await symlink(archivePath(), docsPath("old"));
		await symlink(docsPath(), archivePath("current"));

		expect((await core.filesystem.listDocuments()).map((document) => document.id)).toEqual(["doc-1"]);
		expect((await core.filesystem.listArchivedDocuments()).map((document) => document.id)).toEqual(["doc-2"]);
		expect((await core.getDocument("doc-2"))?.archived).toBe(true);
		expect((await core.getDocument("doc-1"))?.archived).toBeUndefined();
	});

	it.skipIf(isWindows())(
		"keeps archived documents in sight when the archive is a link into the docs folder",
		async () => {
			await createDocument("Stays");
			const archivedPath = await createDocument("Goes to the archive");
			// The archive folder for documents is a link to a folder inside the docs folder.
			await mkdir(docsPath("_archive"));
			await symlink(docsPath("_archive"), archivePath());

			await core.archiveContentRecord("document", "doc-2");

			expect(await readdir(docsPath("_archive"))).toEqual([archivedPath]);
			expect((await core.filesystem.listDocuments()).map((document) => document.id)).toEqual(["doc-1"]);
			expect((await core.filesystem.listArchivedDocuments()).map((document) => document.id)).toEqual(["doc-2"]);
			expect((await core.getDocument("doc-2"))?.archived).toBe(true);
		},
	);

	it.skipIf(isWindows())("fails closed when the docs folder and the archive are one folder", async () => {
		const path = await createDocument("In both folders at once");
		await symlink(docsPath(), archivePath());

		const lookup = await core.getDocument("doc-1").catch((error: unknown) => error);
		const archive = await core.archiveContentRecord("document", "doc-1").catch((error: unknown) => error);

		// Every file is in the docs folder and in the archive, so no ID names one document.
		expect(lookup).toBeInstanceOf(AmbiguousIdError);
		expect(archive).toBeInstanceOf(AmbiguousIdError);
		expect(await readdir(docsPath())).toEqual([path]);
	});
});
