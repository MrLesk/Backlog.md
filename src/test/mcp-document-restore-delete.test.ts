import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { lstat, mkdir, readdir, readFile, rmdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { McpServer } from "../mcp/server.ts";
import { registerDocumentTools } from "../mcp/tools/documents/index.ts";
import { createTestDirOutsideRepository, initializeTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;
let mcpServer: McpServer;

type ToolResult = { isError: boolean; text: string; code?: string };

/** Call a tool and return the text and the error code an MCP client receives. */
async function call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
	const result = await mcpServer.testInterface.callTool({ params: { name, arguments: args } });
	const first = result.content?.[0] as { text?: string } | undefined;
	const structured = result.structuredContent as { code?: string } | undefined;
	return { isError: result.isError === true, text: first?.text ?? "", code: structured?.code };
}

const git = async (...args: string[]) => (await $`git ${args}`.cwd(TEST_DIR).quiet().text()).trim();
const docsPath = (...segments: string[]) => join(TEST_DIR, "backlog", "docs", ...segments);
const archivePath = (...segments: string[]) => join(TEST_DIR, "backlog", "archive", "docs", ...segments);

async function exists(path: string): Promise<boolean> {
	return (await lstat(path).catch(() => null)) !== null;
}

/** The content of every file directly inside a folder, by file name. */
async function readFolder(dir: string): Promise<Record<string, string>> {
	const files: Record<string, string> = {};
	for (const name of await readdir(dir).catch(() => [])) {
		files[name] = await readFile(join(dir, name), "utf8");
	}
	return files;
}

/** Create a document and archive it through the tools, as an MCP client does; returns its file name. */
async function createArchivedDocument(title: string, content = `Body of ${title}`): Promise<string> {
	const created = await call("document_create", { title, content });
	expect(created.isError).toBe(false);
	const name = (created.text.match(/^Path: (.+)$/m)?.[1] ?? "").split("/").pop() ?? "";
	const id = name.split(" - ")[0] ?? "";
	expect((await call("document_archive", { id })).isError).toBe(false);
	return name;
}

async function setAutoCommit(autoCommit: boolean): Promise<void> {
	const config = await mcpServer.filesystem.loadConfig();
	if (!config) throw new Error("Expected the project config");
	await mcpServer.filesystem.saveConfig({ ...config, autoCommit });
}

describe("MCP document_restore and document_delete", () => {
	beforeEach(async () => {
		TEST_DIR = await createTestDirOutsideRepository("mcp-document-restore-delete");
		await $`git init -b main`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email test@example.com`.cwd(TEST_DIR).quiet();
		mcpServer = new McpServer(TEST_DIR, "Test instructions");
		await initializeTestProject(mcpServer, "Document Restore Delete Project", true);
		const config = await mcpServer.filesystem.loadConfig();
		if (!config) throw new Error("Expected the project config");
		await mcpServer.filesystem.saveConfig({ ...config, remoteOperations: false });
		await mcpServer.ensureConfigLoaded();
		registerDocumentTools(mcpServer, config);
	});

	afterEach(async () => {
		await mcpServer.stop().catch(() => {});
		await safeCleanup(TEST_DIR);
	});

	it.each(["document_restore", "document_delete"])(
		"offers %s with the one-ID input of document_view and rejects any other field",
		async (tool) => {
			const tools = (await mcpServer.testInterface.listTools()).tools;
			const offered = tools.find((candidate) => candidate.name === tool);
			const viewTool = tools.find((candidate) => candidate.name === "document_view");
			expect(offered?.inputSchema).toEqual(viewTool?.inputSchema);
			expect(offered?.inputSchema).toMatchObject({ required: ["id"], additionalProperties: false });
			const name = await createArchivedDocument("Kept");

			const rejected = await call(tool, { id: "doc-1", confirm: true });

			expect(rejected.isError).toBe(true);
			expect(rejected.text).toContain("Unknown field 'confirm' is not allowed");
			expect(await exists(archivePath(name))).toBe(true);
		},
	);

	it("restores the file unchanged, after which the document lists, searches and updates again", async () => {
		const name = await createArchivedDocument("Runbook", "Runbook steps.");
		const archived = await readFile(archivePath(name), "utf8");
		// The search index is built while the document is archived, so this checks that it is updated.
		expect((await call("document_search", { query: "runbook" })).text).not.toContain("doc-1 - Runbook");

		const restored = await call("document_restore", { id: "1" });

		expect(restored).toEqual({ isError: false, text: "Restored document doc-1.", code: undefined });
		expect(await readFile(docsPath(name), "utf8")).toBe(archived);
		expect(await exists(archivePath(name))).toBe(false);
		expect((await call("document_list", {})).text).toContain("doc-1 - Runbook");
		expect((await call("document_search", { query: "runbook" })).text).toContain("doc-1 - Runbook");
		const updated = await call("document_update", { id: "doc-1", content: "Changed after the restore" });
		expect(updated.isError).toBe(false);
		expect(await readFile(docsPath(name), "utf8")).toContain("Changed after the restore");
	});

	it("deletes the archived file and names the tasks and drafts that list either path, changing none", async () => {
		const name = await createArchivedDocument("Obsolete");
		await mcpServer.createTaskFromInput({ title: "Archive path", documentation: [`backlog/archive/docs/${name}`] });
		await mcpServer.createTaskFromInput({ title: "Old path", documentation: [`./backlog/docs/${name}#usage`] });
		await mcpServer.createTaskFromInput({
			title: "A URL",
			documentation: [`https://example.com/backlog/docs/${name}`],
		});
		await mcpServer.createTaskFromInput({ title: "Draft", status: "Draft", documentation: [`backlog/docs/${name}`] });
		const tasksBefore = await readFolder(join(TEST_DIR, "backlog", "tasks"));
		const draftsBefore = await readFolder(join(TEST_DIR, "backlog", "drafts"));

		const deleted = await call("document_delete", { id: "doc-1" });

		expect(deleted.isError).toBe(false);
		// The CLI prints the same two lines, without the closing periods.
		expect(deleted.text).toBe("Deleted document doc-1.\nStill listed as documentation by: TASK-1, TASK-2, DRAFT-1.");
		expect(await exists(archivePath(name))).toBe(false);
		expect((await call("document_view", { id: "doc-1" })).code).toBe("DOCUMENT_NOT_FOUND");
		expect(await readFolder(join(TEST_DIR, "backlog", "tasks"))).toEqual(tasksBefore);
		expect(await readFolder(join(TEST_DIR, "backlog", "drafts"))).toEqual(draftsBefore);
	});

	it("releases the ID of a deleted document for the next document_create", async () => {
		await createArchivedDocument("Goes for good");
		expect((await call("document_delete", { id: "doc-1" })).isError).toBe(false);

		const created = await call("document_create", { title: "Created afterwards", content: "Body" });

		expect(created.text).toContain("Document doc-1 - Created afterwards");
	});

	it("refuses with the messages of the CLI: not archived, destination taken, not found, ambiguous", async () => {
		const created = await call("document_create", { title: "Active", content: "Body" });
		expect(created.isError).toBe(false);
		const restoreActive = await call("document_restore", { id: "doc-1" });
		expect(restoreActive.code).toBe("VALIDATION_ERROR");
		expect(restoreActive.text).toContain("Document doc-1 is not archived, so there is nothing to restore.");
		const deleteActive = await call("document_delete", { id: "doc-1" });
		expect(deleteActive.code).toBe("VALIDATION_ERROR");
		expect(deleteActive.text).toContain(
			"Document doc-1 is not archived. A document must be archived before it can be deleted.",
		);

		// Another document's file sits at the path doc-2 would return to.
		const second = await createArchivedDocument("Same name");
		const archived = await readFile(archivePath(second), "utf8");
		await writeFile(docsPath(second), archived.replace("id: doc-2", "id: doc-9"));
		const taken = await call("document_restore", { id: "doc-2" });
		expect(taken.code).toBe("VALIDATION_ERROR");
		expect(taken.text).toContain(
			`Document doc-2 cannot be restored: the docs folder already has a file at backlog/docs/${second}.`,
		);
		expect(await exists(archivePath(second))).toBe(true);

		for (const tool of ["document_restore", "document_delete"]) {
			const missing = await call(tool, { id: "77" });
			expect(missing.code).toBe("DOCUMENT_NOT_FOUND");
			expect(missing.text).toContain("Document not found: 77");
		}

		// A copy of an archived file under the docs folder: two files claim its ID.
		const third = await createArchivedDocument("Claimed twice");
		const thirdId = third.split(" - ")[0] ?? "";
		await mkdir(docsPath(), { recursive: true });
		await writeFile(docsPath(third), await readFile(archivePath(third)));
		for (const tool of ["document_restore", "document_delete"]) {
			const ambiguous = await call(tool, { id: thirdId });
			expect(ambiguous.code).toBe("AMBIGUOUS_ID");
			expect(ambiguous.text).toContain(`Document ID ${thirdId} is ambiguous; 2 files match:`);
		}
		expect(await exists(docsPath(third))).toBe(true);
		expect(await exists(archivePath(third))).toBe(true);
	});

	it("names the restore command in the read-only message of document_update and document_archive", async () => {
		await createArchivedDocument("Archived");
		const message =
			"Document doc-1 is archived. Archived documents are read-only. Restore it first: backlog doc restore doc-1";

		const update = await call("document_update", { id: "doc-1", content: "New body" });
		const archive = await call("document_archive", { id: "doc-1" });

		for (const refused of [update, archive]) {
			expect(refused.code).toBe("VALIDATION_ERROR");
			expect(refused.text).toBe(message);
		}
	});

	it("commits the restore as a move and the delete as a removal when auto-commit is on", async () => {
		await setAutoCommit(true);
		const name = await createArchivedDocument("Committed document");
		await git("add", "-A");
		await git("commit", "-m", "Set up the project");

		expect((await call("document_restore", { id: "doc-1" })).isError).toBe(false);
		expect(await git("log", "-1", "--format=%s")).toBe("backlog: Restore document doc-1");
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(
			`R100\tbacklog/archive/docs/${name}\tbacklog/docs/${name}`,
		);

		expect((await call("document_archive", { id: "doc-1" })).isError).toBe(false);
		expect((await call("document_delete", { id: "doc-1" })).isError).toBe(false);
		expect(await git("log", "-1", "--format=%s")).toBe("backlog: Delete document doc-1");
		expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(`D\tbacklog/archive/docs/${name}`);
		expect(await git("status", "--porcelain")).toBe("");
	});

	it.each([
		[false, 0],
		[true, 0],
		[false, 1],
		[true, 1],
		[false, 2],
		[true, 2],
	] as const)(
		"commits both record paths after an uncommitted archive (archive staged: %s, removed parents: %s)",
		async (stageArchive, removedParents) => {
			await setAutoCommit(false);
			const created = await call("document_create", {
				title: "Mixed auto-commit",
				content: "Committed content",
				path: "guides/http",
			});
			expect(created.isError).toBe(false);
			const name = "doc-1 - Mixed-auto-commit.md";
			const activePath = `backlog/docs/guides/http/${name}`;
			const archivedPath = `backlog/archive/docs/guides/http/${name}`;
			await writeFile(join(TEST_DIR, "unstaged.txt"), "original\n");
			await git("add", "-A");
			await git("commit", "-m", "Track the active document");
			const headBefore = await git("rev-parse", "HEAD");

			expect((await call("document_archive", { id: "doc-1" })).isError).toBe(false);
			expect(await git("rev-parse", "HEAD")).toBe(headBefore);
			expect(await git("diff", "--cached", "--name-only")).toBe("");
			if (stageArchive) await git("add", "--", activePath, archivedPath);
			for (const folder of ["guides/http", "guides"].slice(0, removedParents)) {
				await rmdir(docsPath(folder));
			}
			await setAutoCommit(true);
			await writeFile(join(TEST_DIR, "staged.txt"), "staged by the user\n");
			await git("add", "staged.txt");
			await writeFile(join(TEST_DIR, "staged.txt"), "unstaged edit of staged work\n");
			await writeFile(join(TEST_DIR, "unstaged.txt"), "user edit\n");
			const unrelatedPaths = ["staged.txt", "unstaged.txt", "backlog/config.yml"];
			const stagedBefore = await git("diff", "--cached", "--", ...unrelatedPaths);
			const unstagedBefore = await git("diff", "--", ...unrelatedPaths);
			const commitsBefore = Number(await git("rev-list", "--count", "HEAD"));

			const deleted = await call("document_delete", { id: "doc-1" });

			expect(deleted).toEqual({ isError: false, text: "Deleted document doc-1.", code: undefined });
			expect(Number(await git("rev-list", "--count", "HEAD"))).toBe(commitsBefore + 1);
			expect(await git("ls-tree", "-r", "--name-only", "HEAD", "--", activePath, archivedPath)).toBe("");
			expect(await git("show", "--name-status", "--format=", "HEAD")).toBe(`D\t${activePath}`);
			expect(await git("diff", "--cached", "--", ...unrelatedPaths)).toBe(stagedBefore);
			expect(await git("diff", "--", ...unrelatedPaths)).toBe(unstagedBefore);
			expect(await exists(docsPath("guides", "http", name))).toBe(false);
			expect(await exists(archivePath("guides", "http", name))).toBe(false);
			expect((await call("document_create", { title: "Created afterwards", content: "Body" })).text).toContain(
				"Document doc-1 - Created afterwards",
			);
		},
	);

	it("makes no commit and stages nothing when auto-commit is off", async () => {
		await setAutoCommit(false);
		await createArchivedDocument("Uncommitted document");
		await git("add", "-A");
		await git("commit", "-m", "Set up the project");
		const head = await git("rev-parse", "HEAD");

		expect((await call("document_restore", { id: "doc-1" })).isError).toBe(false);
		expect((await call("document_archive", { id: "doc-1" })).isError).toBe(false);
		expect((await call("document_delete", { id: "doc-1" })).isError).toBe(false);

		expect(await git("rev-parse", "HEAD")).toBe(head);
		expect(await git("diff", "--cached", "--name-only")).toBe("");
	});
});
