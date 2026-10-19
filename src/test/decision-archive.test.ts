import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, readdir, readFile, rename, symlink, writeFile } from "node:fs/promises";
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
import {
	createTestDirOutsideRepository,
	initializeFilesystemTestProject,
	isWindows,
	safeCleanup,
} from "./test-utils.ts";

/**
 * Decisions go through the archive, restore and delete that documents use. These tests cover what
 * is specific to decisions in core and storage: the flat folders, the lookup over both folders, the
 * read-only saves, the store and the ID allocator.
 */
describe("archived decisions in core and storage", () => {
	let TEST_DIR: string;
	let core: Core;

	const decisionsPath = (...segments: string[]) => join(TEST_DIR, "backlog", "decisions", ...segments);
	const archivePath = (...segments: string[]) => join(TEST_DIR, "backlog", "archive", "decisions", ...segments);

	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("test-decision-archive");
		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Decision Archive Core");
	});

	afterEach(async () => {
		core.disposeSearchService();
		core.disposeContentStore();
		await safeCleanup(TEST_DIR);
	});

	it("archives, restores and deletes through the shared functions, refusing with typed errors", async () => {
		await core.createDecisionWithTitle("Use Bun");
		await core.createTaskFromInput({
			title: "Names the file",
			documentation: ["backlog/decisions/decision-1 - Use-Bun.md"],
		});

		expect(await core.archiveContentRecord("decision", "9")).toBeNull();
		for (const refused of [
			await core.restoreContentRecord("decision", "decision-1").catch((error: unknown) => error),
			await core.deleteContentRecord("decision", "decision-1").catch((error: unknown) => error),
		]) {
			expect(refused).toBeInstanceOf(ContentRecordNotArchivedError);
			expect(refused).toBeInstanceOf(RecordRefusedError);
		}

		expect(await core.archiveContentRecord("decision", "decision-001")).toEqual({
			id: "decision-1",
			listedAsDocumentationBy: ["TASK-1"],
		});
		const again = await core.archiveContentRecord("decision", "decision-1").catch((error: unknown) => error);
		expect(again).toBeInstanceOf(ContentRecordArchivedError);
		expect(await core.deleteContentRecord("decision", "decision-1")).toEqual({
			id: "decision-1",
			listedAsDocumentationBy: ["TASK-1"],
		});
		expect(await core.getDecision("decision-1")).toBeNull();
	});

	it("refuses a taken destination with a typed error and leaves both files alone", async () => {
		await core.createDecisionWithTitle("Same name");
		const original = await readFile(decisionsPath("decision-1 - Same-name.md"), "utf8");
		await mkdir(archivePath(), { recursive: true });
		await writeFile(archivePath("decision-1 - Same-name.md"), original.replace("id: decision-1", "id: decision-9"));

		const refused = await core.archiveContentRecord("decision", "decision-1").catch((error: unknown) => error);

		expect(refused).toBeInstanceOf(ContentRecordFileExistsError);
		expect(await readFile(decisionsPath("decision-1 - Same-name.md"), "utf8")).toBe(original);
	});

	it("lists archived decisions apart and resolves an ID over both folders", async () => {
		await core.createDecisionWithTitle("Stays");
		await core.createDecisionWithTitle("Goes to the archive");
		await core.archiveContentRecord("decision", "decision-2");

		expect((await core.filesystem.listDecisions()).map((decision) => decision.id)).toEqual(["decision-1"]);
		expect(await core.filesystem.listArchivedDecisions()).toMatchObject([
			{ id: "decision-2", path: "decision-2 - Goes-to-the-archive.md", archived: true },
		]);
		expect((await core.getDecision("decision-1"))?.archived).toBeUndefined();
		expect((await core.getDecision("2"))?.archived).toBe(true);
		// The decisions-folder loader does not see the archive; user-facing lookups go through core.
		expect(await core.filesystem.loadDecision("decision-2")).toBeNull();

		// A copy of the archived file in the decisions folder: two files claim decision-2.
		await writeFile(
			decisionsPath("decision-2 - Goes-to-the-archive.md"),
			await readFile(archivePath("decision-2 - Goes-to-the-archive.md")),
		);
		const ambiguous = await core.getDecision("decision-2").catch((error: unknown) => error);
		expect(ambiguous).toBeInstanceOf(AmbiguousIdError);
		expect((ambiguous as AmbiguousIdError).candidates).toEqual([
			"backlog/archive/decisions/decision-2 - Goes-to-the-archive.md",
			"backlog/decisions/decision-2 - Goes-to-the-archive.md",
		]);
	});

	it("refuses every save of an archived decision and writes no file", async () => {
		await core.createDecisionWithTitle("Read-only while archived");
		await core.archiveContentRecord("decision", "decision-1");
		const archivedFile = archivePath("decision-1 - Read-only-while-archived.md");
		const before = await readFile(archivedFile, "utf8");
		const archived = await core.getDecision("decision-1");
		if (!archived) throw new Error("Expected the archived decision");

		const update = await core
			.updateDecisionFromContent("decision-1", "---\ntitle: Changed\n---\n")
			.catch((error: unknown) => error);
		const save = await core.createDecision({ ...archived, title: "Changed" }).catch((error: unknown) => error);

		expect(update).toBeInstanceOf(ContentRecordArchivedError);
		expect((update as Error).message).toBe(
			"Decision decision-1 is archived. Archived decisions are read-only. Restore it first: backlog decision restore decision-1",
		);
		expect((save as Error).message).toContain("Cannot save decision decision-1: it is archived");
		expect(await readFile(archivedFile, "utf8")).toBe(before);
		expect(await readdir(decisionsPath())).toEqual([]);
	});

	it("takes an archived decision out of the content store and puts a restored one back", async () => {
		await core.createDecisionWithTitle("Stays");
		await core.createDecisionWithTitle("Moves");
		// This Core runs no watchers, so only the operations themselves can update the store.
		const store = await core.getContentStore();
		expect(store.getDecisions().map((decision) => decision.id)).toEqual(["decision-1", "decision-2"]);

		await core.archiveContentRecord("decision", "decision-2");
		expect(store.getDecisions().map((decision) => decision.id)).toEqual(["decision-1"]);

		await core.restoreContentRecord("decision", "decision-2");
		const restored = store.getDecisions().find((decision) => decision.id === "decision-2");
		expect(restored?.title).toBe("Moves");
		// A restored decision looks like one listed from its folder: it has no `archived` key.
		expect(restored && "archived" in restored).toBe(false);
	});

	it("counts archived decisions in the core ID allocator as well", async () => {
		await core.createDecisionWithTitle("Stays");
		await core.createDecisionWithTitle("Goes to the archive");
		await core.archiveContentRecord("decision", "decision-2");

		// This allocator writes the prefix in upper case; the number is what the archive must reserve.
		expect((await core.generateNextId(EntityType.Decision)).toLowerCase()).toBe("decision-3");
	});

	describe("removeArchivedContentRecordFile for a decision", () => {
		it("refuses a decision that is not archived and removes nothing", async () => {
			const active = await core.createDecisionWithTitle("Active");

			const refused = core.filesystem.removeArchivedContentRecordFile("decision", {
				id: active.id,
				path: "decision-1 - Active.md",
			});

			await expect(refused).rejects.toThrow(
				"The file of decision decision-1 was not removed: the decision is not archived.",
			);
			expect(await readdir(decisionsPath())).toEqual(["decision-1 - Active.md"]);
		});

		it("refuses a file that another decision took the place of", async () => {
			await core.createDecisionWithTitle("Listed first");
			await core.archiveContentRecord("decision", "decision-1");
			const archived = await core.getDecision("decision-1");
			if (!archived) throw new Error("Expected the archived decision");
			const path = archivePath("decision-1 - Listed-first.md");
			const replacement = (await readFile(path, "utf8")).replace("id: decision-1", "id: decision-4");
			await writeFile(path, replacement);

			const refused = core.filesystem.removeArchivedContentRecordFile("decision", archived);

			await expect(refused).rejects.toThrow(
				"backlog/archive/decisions/decision-1 - Listed-first.md is the file of decision-4.",
			);
			expect(await readFile(path, "utf8")).toBe(replacement);
		});

		it("refuses a decision path with a folder in it, because decisions are stored flat", async () => {
			await mkdir(archivePath("nested"), { recursive: true });
			await writeFile(archivePath("nested", "decision-1 - Hidden.md"), "kept");

			const refused = core.filesystem.removeArchivedContentRecordFile("decision", {
				id: "decision-1",
				path: "nested/decision-1 - Hidden.md",
				archived: true,
			});

			await expect(refused).rejects.toThrow("Decision path must be one file name in its folder");
			expect(await readFile(archivePath("nested", "decision-1 - Hidden.md"), "utf8")).toBe("kept");
		});

		it.skipIf(isWindows())("removes a link as a link and leaves the file it points to", async () => {
			await core.createDecisionWithTitle("Linked");
			await core.archiveContentRecord("decision", "decision-1");
			const target = join(TEST_DIR, "kept.md");
			await rename(archivePath("decision-1 - Linked.md"), target);
			await symlink(target, archivePath("decision-1 - Linked.md"));
			const archived = await core.getDecision("decision-1");
			if (!archived) throw new Error("Expected the archived decision");

			await core.filesystem.removeArchivedContentRecordFile("decision", archived);

			expect(await readdir(archivePath())).toEqual([]);
			expect(await readFile(target, "utf8")).toContain("id: decision-1");
		});
	});
});
